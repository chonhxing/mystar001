const { CONFIG } = require('../config/index.js');
const storage = require('../utils/storage.js');
const payload = require('../core/payload.js');

/**
 * 网络层。客户端只认识自己的后端，不认识任何大模型。
 *
 * 三条设计底线：
 *  1. 命盘在本地算，网络只负责"拿 AI 写好的解读"。所以断网、超时、
 *     后端挂了，用户看到的依然是一份完整的占卜结果（模板文案），而不是一个报错页。
 *  2. API key 只在服务端，客户端连模型名字都不该知道。
 *  3. 上行只有匿名数字（见 core/payload.js），姓名生辰不出手机。
 */

let token = '';

/**
 * 弱网状态。官方给了 `wx.onNetworkWeakChange`（基础库 2.21.0+），
 * 弱网时直接走本机解读 —— 与其让用户干等 50 秒再失败，不如立刻给结果。
 */
let weakNetwork = false;

function watchNetwork() {
  if (typeof wx === 'undefined' || typeof wx.onNetworkWeakChange !== 'function') return;
  try {
    wx.onNetworkWeakChange((res) => {
      weakNetwork = !!(res && res.weakNet);
    });
  } catch (e) {
    /* 忽略 */
  }
}

/**
 * 等 AI 的时候把屏幕保持常亮。
 * 官方文档明确写了「小程序进入后台运行后，如果 5s 内网络请求没有结束，会回调错误信息
 * fail interrupted」—— 而我们的 AI 要等 16~37 秒。用户等得无聊锁屏，
 * 这次请求就白费了。所以等待期间保持常亮，拿到结果立刻恢复。
 */
let screenKeptOn = false;

function keepScreenOn(on) {
  if (typeof wx === 'undefined' || typeof wx.setKeepScreenOn !== 'function') return;
  if (on === screenKeptOn) return;
  screenKeptOn = on;
  try {
    wx.setKeepScreenOn({ keepScreenOn: on });
  } catch (e) {
    /* 忽略 */
  }
}

function reasonOf(err) {
  const msg = String((err && err.errMsg) || err || '');
  if (msg.indexOf('timeout') >= 0) return 'TIMEOUT';
  if (msg.indexOf('domain') >= 0 || msg.indexOf('合法域名') >= 0) return 'DOMAIN';
  // 云调用失败单独算一类：它跟"公网连不上"的原因完全不是一回事
  // （服务名写错 / 环境 ID 不对 / 服务还没部署），提示也要分开给
  if (msg.toLowerCase().indexOf('callcontainer') >= 0 || msg.toLowerCase().indexOf('cloud') >= 0) {
    return 'CLOUD';
  }
  if (msg.indexOf('fail') >= 0) return 'NETWORK';
  return 'NETWORK';
}

/**
 * 统一请求封装，永远 resolve，不抛异常。
 *
 * 带一层**登录态自愈**：服务端返回 401 TOKEN_EXPIRED 时，强制重新登录一次再重试。
 * 没有这一层的话，token 一过期用户付费权益就会"消失"（服务端按 IP 认人查不到数据），
 * 而他完全不知道发生了什么。只重试一次，避免死循环。
 */
function request(path, opts) {
  return doRequest(path, opts, false);
}

/**
 * 微信云托管的「云调用」。
 *
 * 为什么用它：`wx.cloud.callContainer` 走微信内网，**不需要备案域名、
 * 也不用在 MP 后台配 request 合法域名**，真机预览就能连上 ——
 * 这正是"开发机本地后端在真机上连不上"（127.0.0.1 指向手机自己）的正解。
 *
 * ⚠️ 两个平台限制（决定了哪些请求不能走它）：
 *   1. **单次超时不超过 15s** —— 我们的 AI 解读要 16~37 秒，走它会必然超时，
 *      所以长请求仍然走公网域名（见 CLOUD_MAX_TIMEOUT 与 docs/DEPLOY-CLOUD.md）
 *   2. 请求体不超过 100KB —— 我们上行只有几百字节的匿名数字，够用
 */
const CLOUD_MAX_TIMEOUT = 14000;

function cloudReady() {
  const c = CONFIG.CLOUD;
  return !!(
    c &&
    c.ENABLED &&
    c.ENV &&
    c.SERVICE &&
    typeof wx !== 'undefined' &&
    wx.cloud &&
    typeof wx.cloud.callContainer === 'function'
  );
}

/** 这次请求适不适合走云调用（超时太长的必须走公网） */
function useCloud(opts) {
  return cloudReady() && (opts.timeout || 8000) <= CLOUD_MAX_TIMEOUT;
}

let cloudInited = false;
function setupCloud() {
  if (cloudInited || !cloudReady()) return;
  cloudInited = true;
  try {
    wx.cloud.init({ env: CONFIG.CLOUD.ENV, traceUser: false });
  } catch (e) {
    /* 初始化失败就退回普通请求，别让启动挂在这儿 */
  }
}

/**
 * 发一次请求。云调用与普通 https 在这里分叉，上层逻辑完全一样。
 * @param {function} done 收 { statusCode, data } 或 { fail }
 */
function send(path, o, header, done) {
  if (useCloud(o)) {
    setupCloud();
    try {
      wx.cloud.callContainer({
        config: { env: CONFIG.CLOUD.ENV },
        path,
        method: o.method || 'GET',
        header: Object.assign({ 'X-WX-SERVICE': CONFIG.CLOUD.SERVICE }, header),
        data: o.data,
        success: (res) => done({ statusCode: res.statusCode, data: res.data }),
        fail: (err) => done({ fail: err })
      });
      return;
    } catch (e) {
      // 落到普通请求（比如基础库不支持云调用）
    }
  }
  wx.request({
    url: `${CONFIG.API_BASE.replace(/\/+$/, '')}${path}`,
    method: o.method || 'GET',
    data: o.data,
    timeout: o.timeout || 8000,
    header,
    success: (res) => done({ statusCode: res.statusCode, data: res.data }),
    fail: (err) => done({ fail: err })
  });
}

function doRequest(path, opts, retried) {
  const o = opts || {};
  return new Promise((resolve) => {
    const header = Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {}
    );
    send(path, o, header, (res) => {
      if (res.fail) {
        resolve({ ok: false, status: 0, reason: reasonOf(res.fail), message: res.fail && res.fail.errMsg });
        return;
      }
      const body = res.data && typeof res.data === 'object' ? res.data : null;
      if (res.statusCode >= 200 && res.statusCode < 300 && body && body.ok) {
        resolve({ ok: true, status: res.statusCode, body });
        return;
      }
      // 登录态过期：强制重登后重试一次
      if (res.statusCode === 401 && body && body.error === 'TOKEN_EXPIRED' && !retried) {
        ensureSession(true).then((tk) => {
          if (tk) doRequest(path, opts, true).then(resolve);
          else {
            resolve({
              ok: false,
              status: 401,
              reason: 'TOKEN_EXPIRED',
              body,
              message: '登录状态已过期'
            });
          }
        });
        return;
      }
      resolve({
        ok: false,
        status: res.statusCode,
        reason: `HTTP_${res.statusCode}`,
        body,
        message: body && body.message
      });
    });
  });
}

/**
 * wx.login 拿 code。
 *
 * ⚠️ 失败原因**必须留下来**。以前两处都写成 `fail: () => send(null)`，
 *    于是"客户端没带 code"这件事在两端都看不见：服务端只回一句 401 + MISSING_CODE、
 *    3 毫秒就返回，客户端连提示都没有 —— 排查时只能靠猜（真机上踩过）。
 *    现在把原因带回上层，并由状态页显示出来。
 *
 * @returns {Promise<{code:string, reason:string}>} reason 非空表示失败原因
 */
function wxLoginCode() {
  return new Promise((resolve) => {
    if (typeof wx.login !== 'function') {
      resolve({ code: '', reason: 'NO_WX_LOGIN_API' });
      return;
    }
    wx.login({
      success: (r) => resolve({ code: (r && r.code) || '', reason: r && r.code ? '' : 'EMPTY_CODE' }),
      fail: (e) => resolve({ code: '', reason: (e && e.errMsg) || 'WX_LOGIN_FAIL' })
    });
  });
}

/** 最近一次 wx.login 的失败原因（状态页会给用户/开发者看） */
let lastLoginFail = '';
function setLoginFail(reason) {
  if (reason) lastLoginFail = String(reason).slice(0, 120);
  // 这里刻意不引 analytics：本模块是底层传输层，报告由上层（boot/account）做，
  // 免得把上报依赖牵进来、也免得在"连不上后端"时反而卡住
}

/**
 * 建立会话：wx.login 拿 code → 换 token。
 * 服务端没配微信 appid 时会进入开发模式，用本地 devId 认人。
 */
function ensureSession(force) {
  if (token && !force) return Promise.resolve(token);
  token = storage.getToken();

  return new Promise((resolve) => {
    const send = (code) => {
      request('/api/session', {
        method: 'POST',
        timeout: 8000,
        data: { code: code || '', devId: storage.getDevId() }
      }).then((res) => {
        if (res.ok && res.body.token) {
          token = res.body.token;
          storage.setToken(token);
          resolve(token);
        } else {
          resolve(null);
        }
      });
    };

    // 登录失败（开发者工具没登录、项目 appid 还是测试号…）也照样试一次：
    // 服务端处于开发模式时还能用 devId；失败原因留给状态页显示
    wxLoginCode().then((r) => {
      if (r.reason) setLoginFail(r.reason);
      send(r.code);
    });
  });
}

/**
 * 「提交任务 + 轮询」版的解读。
 *
 * 为什么需要：微信云托管的云调用单次超时上限 15s，而解读要 16~37s。
 * 提交后服务端在后台跑 AI，客户端每 1.5 秒问一次，最多问 API_TIMEOUT 那么久。
 *
 * @returns {Promise<object|null>} 成功/降级都返回结果对象；**服务端没有这个接口时返回 null**
 *   （null 表示"你走同步那条路吧"）
 */
const TASK_POLL_MS = 1500;

async function divinateByTask(facts, localResult) {
  const submit = await request('/api/divinate/task', { method: 'POST', data: facts, timeout: 12000 });

  // 老服务端：没有这个接口 → 交给调用方走同步版
  if (!submit.ok && (submit.status === 404 || submit.status === 405)) return null;

  if (!submit.ok) {
    // 配额类错误：把后端那句人话原样透给用户（和同步版一个口径）
    if (submit.status === 429 || submit.status === 503) {
      return {
        result: localResult,
        source: 'local',
        limited: true,
        quota: submit.body && submit.body.meta ? submit.body.meta.quota : null,
        notice: submit.message || payload.localNotice('QUOTA'),
        reason: (submit.body && submit.body.error) || 'QUOTA'
      };
    }
    return {
      result: localResult,
      source: 'local',
      notice: payload.localNotice(submit.reason),
      reason: submit.reason
    };
  }

  const body = submit.body || {};
  // 服务端已经把答案给我们了（命中了缓存 / 没配 AI）：不用轮询
  if (body.status === 'done') return mergeDivinate(localResult, body);

  const jobId = body.jobId;
  if (!jobId) return null; // 形状不对，退回同步版更稳

  // 总共愿意等多久。⚠️ 必须大于服务端的总预算（server/config.js 的 ai.budgetMs），
  // 否则会出现"客户端已经降级、服务端刚把 AI 文案算完"的错位：
  // 用户白看一版模板文案，我们还照样付了 AI 的钱。见 config/index.js 的注释。
  const deadline = Date.now() + (CONFIG.DIVINATE_WAIT_MS || 80000);
  // 首次问得快一点（600ms）：多数情况 AI 几百毫秒就写完了，
  // 固定等 1.5 秒会让用户白等一秒多。之后按 TASK_POLL_MS 的节奏问。
  let wait = 600;
  while (Date.now() < deadline) {
    await sleep(wait);
    wait = TASK_POLL_MS;
    // eslint-disable-next-line no-await-in-loop
    const poll = await request(`/api/divinate/task?jobId=${encodeURIComponent(jobId)}`, { timeout: 8000 });
    if (poll.ok && poll.body) {
      if (poll.body.status === 'done') return mergeDivinate(localResult, poll.body);
      if (poll.body.status === 'failed') {
        return {
          result: localResult,
          source: 'local',
          notice: payload.localNotice('AI_FAILED'),
          reason: 'AI_FAILED'
        };
      }
    } else if (poll.status === 404 || poll.status === 401) {
      // 任务找不到（实例被回收）或登录态丢了：别再空转
      break;
    }
  }

  return {
    result: localResult,
    source: 'local',
    notice: payload.localNotice('TIMEOUT'),
    reason: 'TIMEOUT'
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 服务端返回体 → 客户端统一的结果对象（同步版与任务版共用，口径必须一致） */
function mergeDivinate(localResult, body) {
  const merged = payload.applyServerResponse(localResult, body);
  return {
    result: merged.result,
    source: body.source || 'ai',
    applied: merged.applied,
    quota: body.meta ? body.meta.quota : null,
    notice: null,
    reason: merged.applied.copy ? null : 'AI_FAILED'
  };
}

/**
 * 占卜：本地命盘 + 后端 AI 解读。
 *
 * @param {object} localResult core.divinate() 的本地结果（永远是完整的）
 * @returns {Promise<{result, source, notice, quota, limited}>}
 *   source: 'ai' | 'cache' | 'local'
 *   notice: 需要提示给用户的一句话（降级原因），null 表示一切正常
 */
async function divinate(localResult, opts) {
  const settings = storage.getSettings();
  const disabled = !CONFIG.USE_REMOTE || !settings.useAi;

  if (disabled) {
    return { result: localResult, source: 'local', notice: null, reason: 'DISABLED' };
  }

  // 弱网就别试了：直接本机出结果，比让用户等 50 秒再失败体验好得多
  if (weakNetwork) {
    return {
      result: localResult,
      source: 'local',
      notice: payload.localNotice('NETWORK'),
      reason: 'WEAK_NETWORK'
    };
  }

  await ensureSession();

  const facts = payload.buildFacts(localResult, opts);
  // 等 AI 期间保持屏幕常亮，避免用户锁屏导致请求被中断
  keepScreenOn(true);
  let res;
  try {
    /**
     * 优先走「提交任务 + 轮询」。
     *
     * 为什么不是一次请求：微信云托管的**云调用单次超时上限 15 秒**，
     * 而解读要 16~37 秒 —— 同步接口在真机上会被截断，AI 文案永远拿不到。
     * 拆成两个秒级请求就没这个问题了。
     *
     * 服务端还没升级时（新接口 404），自动退回同步请求，两边可以独立升级。
     */
    const viaTask = await divinateByTask(facts, localResult);
    if (viaTask) return viaTask;
    res = await request('/api/divinate', {
      method: 'POST',
      data: facts,
      timeout: CONFIG.API_TIMEOUT
    });
  } finally {
    keepScreenOn(false);
  }

  if (!res.ok) {
    // 429 是配额闸门，要把后端那句人话原样透给用户
    if (res.status === 429 || res.status === 503) {
      return {
        result: localResult,
        source: 'local',
        limited: true,
        quota: res.body && res.body.meta ? res.body.meta.quota : null,
        notice: res.message || payload.localNotice('QUOTA'),
        reason: (res.body && res.body.error) || 'QUOTA'
      };
    }
    if (!CONFIG.FALLBACK_TO_LOCAL) {
      return { result: localResult, source: 'local', notice: 'AI 解读暂时不可用', reason: res.reason };
    }
    return {
      result: localResult,
      source: 'local',
      // 直接把真实原因传下去 —— 之前写死了 'NETWORK'，超时也被说成网络问题
      notice: payload.localNotice(res.reason),
      reason: res.reason
    };
  }

  // 同步版（老服务端 / 任务接口不可用）的收尾也走同一个 merge，口径不会漂
  return mergeDivinate(localResult, res.body);
}

/**
 * 请求后端签名。**key 绝不能进包体**，所以签名只能在服务端做。
 * 服务端返回 { signData, paySig, signature, outTradeNo }，
 * 其中 signData 必须**原样**传给支付接口（服务端生成的字符串，客户端不能重新序列化）。
 */
function paySign(productId) {
  return request('/api/pay/sign', {
    method: 'POST',
    data: { productId },
    timeout: 10000
  }).then((res) => {
    if (res.ok && res.body && res.body.signData) {
      return Object.assign({ ok: true }, res.body);
    }
    return {
      ok: false,
      reason: (res.body && res.body.error) || res.reason || 'SIGN_FAILED',
      message: (res.body && res.body.message) || '下单失败'
    };
  });
}

/** 支付成功后向后端确认订单（平台的发货推送是异步的，这里主动问一次） */
function payConfirm(outTradeNo) {
  return request('/api/pay/confirm', {
    method: 'POST',
    data: { outTradeNo },
    timeout: 12000
  }).then((res) => (res.ok ? res.body : { ok: false, reason: res.reason }));
}

/** 同步付费权益（换设备/重装后把畅玩卡找回来） */
function entitlementSync() {
  return request('/api/entitlement', { timeout: 8000 }).then((res) =>
    res.ok ? res.body : { ok: false, reason: res.reason }
  );
}

/**
 * 重新登录。用 `/api/account/relogin` 而不是 `/api/session`，
 * 因为它能区分「高风险用户被平台拦截」（40226）和普通失败，
 * 前者不该给用户"重试"的错觉。
 */
function relogin() {
  return new Promise((resolve) => {
    const send = (code, isRetry) => {
      request('/api/account/relogin', {
        method: 'POST',
        timeout: 10000,
        data: { code: code || '', devId: storage.getDevId() }
      }).then((res) => {
        if (res.ok && res.body.token) {
          token = res.body.token;
          storage.setToken(token);
          resolve({ ok: true, dev: !!res.body.dev });
          return;
        }
        const error = (res.body && res.body.error) || res.reason || 'RELOGIN_FAILED';
        /**
         * 微信返回 40029 = code 无效（多半是**被用过**）。这不是用户的错：
         * wx.login 在很短时间内可能给出同一个 code，而我们有两条登录路径
         * （`/api/session` 和这里），先走的那条会把 code 消耗掉，
         * 后走的那条就必然 40029 —— 真机上就是这么撞的（日志里 75ms 那次）。
         * 所以重拿一次 code 再试一轮，只重试一次。
         */
        if (error === 'WX_40029' && !isRetry) {
          wxLoginCode().then((again) => {
            if (again.code) send(again.code, true);
            else resolve({ ok: false, error: 'WX_LOGIN_NO_CODE', message: `微信登录没拿到凭证：${again.reason}` });
          });
          return;
        }
        resolve({
          ok: false,
          blocked: !!(res.body && res.body.blocked),
          error,
          message: res.message || (res.body && res.body.message)
        });
      });
    };
    wxLoginCode().then((r) => {
      if (r.reason) {
        setLoginFail(r.reason);
        // 没拿到 code 就别发请求了：服务端只会回一句 401（3 毫秒），
        // 用户看到"重新登录失败"、我们看不到原因 —— 那是真机上踩过的坑
        resolve({ ok: false, error: 'WX_LOGIN_NO_CODE', message: `微信登录没拿到凭证：${r.reason}` });
        return;
      }
      send(r.code, false);
    });
  });
}

/** 拉取角色库（可选：让运营能不发版就换角色表） */
function getRoster() {
  return request('/api/roster', { timeout: 8000 }).then((res) => (res.ok ? res.body : null));
}

/**
 * 失败原因的"人话版"。
 *
 * 之前降级提示统一写"星象信号不好"，用户根本不知道要改什么 ——
 * 而实际原因几乎总是这三种之一，每一种都有明确的解决办法。
 * 这条信息放在设置页的"解读服务状态"里（技术上，不该给普通用户看）。
 */
const REASON_TEXT = {
  DOMAIN: '域名未校验 —— 开发者工具 → 详情 → 本地设置 → 勾选「不校验合法域名」',
  NETWORK: '连不上 —— 确认后端已启动（npm start），地址见下方',
  TIMEOUT: '超时 —— 后端响应太慢，或 IP 不通',
  CLOUD: '云调用失败 —— 多半是服务名/环境 ID 不对，或服务还没部署成功（见 docs/DEPLOY-CLOUD.md 第 5 节）',
  HTTP_503: '后端已连上，但 AI 未配置 —— 检查 server/.env 的 DEEPSEEK_API_KEY',
  HTTP_401: '登录态问题 —— 试试重新登录',
  HTTP_404: '接口不存在 —— 检查 API_BASE 是否指向本项目的后端'
};

/** 健康检查，我的页面用来显示后端状态 */
function health() {
  return request('/api/health', { timeout: 5000 }).then((res) => (res.ok ? res.body : null));
}

/** 失败原因 → 人话（账号页、设置页共用同一套口径，别各写一份） */
function reasonText(reason, status) {
  const key = status ? `HTTP_${status}` : reason;
  return REASON_TEXT[key] || '';
}

/**
 * 真机最容易踩的一条：`127.0.0.1` 在手机上指向**手机自己**，永远连不上开发机的后端。
 * 给出可执行的提示（改局域网 IP + 真机只能走「真机调试」）。
 */
function baseHint() {
  const base = String(CONFIG.API_BASE || '');
  if (base.indexOf('127.0.0.1') >= 0 || base.indexOf('localhost') >= 0) {
    return '真机预览时 127.0.0.1 指向手机自己 —— 要改成开发机的局域网 IP（如 http://192.168.1.5:8787）；'
      + '而且真机只能用「真机调试」连本地后端，「预览」会拦未备案域名';
  }
  return '';
}

/**
 * 诊断解读服务。比 health 多返回"为什么失败 + 该怎么办"。
 * 给设置页用，方便一眼看出是配置问题还是服务没起。
 */
function diagnose() {
  // 这次健康检查实际会走哪条路（云调用还是公网）—— 排查部署问题时，
  // "走的是哪条路"和"通不通"一样重要：云调用失败和服务没起，解决办法完全不同
  const via = useCloud({ timeout: 5000 }) ? 'cloud' : 'http';
  return request('/api/health', { timeout: 5000 }).then((res) => {
    const base = CONFIG.API_BASE;
    const cloud = { env: CONFIG.CLOUD.ENV, service: CONFIG.CLOUD.SERVICE, ready: cloudReady() };
    const where = via === 'cloud' ? `云调用（${cloud.service} / ${cloud.env}）` : `公网 ${base}`;
    if (res.ok) {
      const ai = res.body.ai || {};
      const login = res.body.login || {};
      const auth = res.body.auth || {};
      // ⚠️ 这两个"静默降级"都要说出来：
      //    · 没配 WX_SECRET → 按设备认人，用户换手机才暴露
      //    · 没配 AUTH_SECRET → 临时随机密钥，重启后所有人要重新登录
      //    两种都不报错，只能靠这一屏看出来。
      const warns = [];
      if (login.devMode) {
        warns.push('云托管还没配 WX_SECRET：现在是按设备认人，换手机后畅玩卡/记录不跟随（见 docs/DEPLOY-CLOUD.md 第 3 节）');
      }
      if (auth.secretSource === 'generated') {
        warns.push('云托管还没配 AUTH_SECRET：会话密钥是临时生成的，服务重启后所有人需要重新登录一次');
      }
      return {
        ok: true,
        base,
        via,
        cloud,
        where,
        aiConfigured: !!ai.configured,
        model: ai.model || '',
        devLogin: !!login.devMode,
        message: ai.configured ? `正常（AI 已配置 · 走${where}）` : `后端正常，但 AI 未配置 key（走${where}）`,
        hint: ai.configured ? warns.join('\n') : '检查云托管控制台（或 server/.env）的 DEEPSEEK_API_KEY',
        reason: ''
      };
    }
    const key = res.status ? `HTTP_${res.status}` : res.reason;
    return {
      ok: false,
      base,
      via,
      cloud,
      where,
      // 形状要保持一致：连不上时"是不是按设备认人"无从得知，报 false 而不是 undefined，
      // 调用方就不用写 `=== true` 这种防御式判断
      devLogin: false,
      reason: key,
      message: `${REASON_TEXT[key] || res.message || '连不上解读服务'}（走的是${where}）`,
      hint: key === 'CLOUD'
        ? `确认云托管里的服务名是「${cloud.service || '(空)'}」、环境 ID 是「${cloud.env || '(空)'}」，` +
          '并且服务已经部署成功（控制台能看到运行中的副本）'
        : baseHint()
    };
  });
}

/** 只要运势（不走 AI，不花配额） */
function fortuneOnly(localResult) {
  return request('/api/fortune', {
    method: 'POST',
    data: payload.buildFacts(localResult),
    timeout: 6000
  }).then((res) => (res.ok ? res.body.fortune : null));
}

function sessionInfo() {
  return {
    hasToken: !!token,
    base: CONFIG.API_BASE,
    remote: CONFIG.USE_REMOTE,
    weakNetwork,
    // 微信登录最近一次失败的原因（空 = 没失败过）。
    // 真机上"账号登录不上"绝大多数是这一类，而它发生在客户端、服务端看不到。
    loginFail: lastLoginFail
  };
}

module.exports = {
  request,
  ensureSession,
  relogin,
  diagnose,
  REASON_TEXT,
  divinate,
  paySign,
  payConfirm,
  reasonText,
  baseHint,
  entitlementSync,
  getRoster,
  health,
  fortuneOnly,
  sessionInfo,
  watchNetwork,
  keepScreenOn,
  isWeakNetwork: () => weakNetwork
};
