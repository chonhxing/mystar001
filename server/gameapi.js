const crypto = require('crypto');
const { CONFIG } = require('./config.js');
const accesstoken = require('./accesstoken.js');

/**
 * 微信服务端接口封装（`api.weixin.qq.com`）。
 *
 * 这些接口**只能在服务端调**（官方原文：「接口应在服务器端调用，不可在前端直接调用」），
 * 而且都要 access_token。
 *
 * 目前实现了两个：
 *   - `pay_v2.queryOrder`  —— 查订单状态。**这是"用户到底付没付钱"的权威来源**，
 *     有它就不用只信客户端的报告（见 server/pay.js 的 /api/pay/confirm）。
 *   - `gameMsgSecCheck`    —— 游戏专用文本内容安全。⚠️ 注意官方明确说：
 *     「原 1.0 和 2.0 内容安全接口适配小程序通用场景，**小游戏建议使用游戏专用场景内容安全接口**」，
 *     所以用的是 `/wxa/game/content_spam/msg_sec_check`，不是小程序那个 msgSecCheck。
 */

// ============================================================ 支付签名

/**
 * ⚠️⚠️ 这里有一个**必须核实**的点。
 *
 * 官方的《支付请求签名算法说明》和《支付类订阅事件签名算法说明》都放在腾讯文档里
 * （https://docs.qq.com/doc/DVVZZdHFsYkttYmxl），**不在微信文档站内，且需要权限才能打开**。
 * 所以"拼接串里到底放接口英文名、路径、还是事件名"这一条我们无法从公开文档确认。
 *
 * 能确定的只有 `wx.requestMidasPaymentGameItem` 文档里给的例子：
 *     paySig = to_hex(hmac_sha256(appKey, 'requestMidasPaymentGameItem' + '&' + signData))
 * 注意它用的是**接口英文名**，不是 URL 路径。
 *
 * 所以这里按同一套口径实现，并把模式做成可配置 —— 接入真实支付时如果签名报错
 * （queryOrder 返回 **90011 = pay_sig 签名错误**、**90010 = signature 签名错误**），
 * 直接改 MIDAS_SIG_MODE 换一种拼法即可，不用改代码结构。
 */
const SIG_MODES = {
  // 接口英文名（和 requestMidasPaymentGameItem 的例子一致，默认）
  english_name: (name, path, body) => `${name}&${body}`,
  // URL 路径
  path: (name, path, body) => `${path}&${body}`,
  // 路径去掉前导斜杠
  path_no_slash: (name, path, body) => `${path.replace(/^\//, '')}&${body}`,
  // 只对 body 签名
  body_only: (name, path, body) => String(body)
};

function sigMode() {
  const m = CONFIG.pay.sigMode || 'english_name';
  return SIG_MODES[m] || SIG_MODES.english_name;
}

/**
 * 生成 pay_sig。
 * @param {string} englishName 接口英文名，如 pay_v2.queryOrder
 * @param {string} path 接口路径，如 /wxa/game/queryorderinfo
 * @param {string} body 请求体**原文**（必须是实际发送的那个字符串）
 */
function paySig(englishName, path, body) {
  const appKey = CONFIG.pay.appKey || '';
  const text = sigMode()(englishName, path, body);
  return crypto.createHmac('sha256', appKey).update(text, 'utf8').digest('hex');
}

/** 用户登录态签名：signature = hmac_sha256(session_key, 请求体原文)（官方 signature.html 明确写了） */
function userSignature(sessionKey, body) {
  return crypto.createHmac('sha256', sessionKey).update(String(body), 'utf8').digest('hex');
}

// ============================================================ 底层请求

function explain(code, errmsg) {
  const map = {
    '-1': '系统繁忙，稍后再试',
    40001: 'access_token 无效：检查 IP 白名单与 AppSecret',
    42001: 'access_token 已过期',
    90010: 'signature（用户登录态签名）错误',
    90011: 'pay_sig（支付签名）错误 —— 可能是 MIDAS_SIG_MODE 需要换一种拼法',
    90016: 'session_key 已过期，需要重新登录',
    90018: '参数错误',
    90019: '订单号未找到（可能还没支付过）',
    40013: 'AppID 不合法'
  };
  return map[code] || `调用失败（errcode=${code}${errmsg ? ` ${errmsg}` : ''}）`;
}

/** 带 access_token 的 POST */
async function callApi(path, query, bodyObj, opts) {
  const o = opts || {};
  const tokenRes = await accesstoken.get(o.store);
  if (!tokenRes.ok) return { ok: false, error: tokenRes.error, message: tokenRes.message };

  // ⚠️ 请求体必须先序列化成字符串：签名要对**实际发送的原文**做，
  //    重新 JSON.stringify 一次可能因为键顺序不同导致签名对不上。
  const bodyStr = JSON.stringify(bodyObj);
  const qs = Object.assign({ access_token: tokenRes.token }, query || {});
  const url =
    `${CONFIG.wechat.apiBase}${path}?` +
    Object.keys(qs)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(qs[k])}`)
      .join('&');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      signal: AbortSignal.timeout(o.timeoutMs || 8000)
    });
    const data = await res.json();
    if (data && data.errcode !== undefined && data.errcode !== 0) {
      return {
        ok: false,
        error: `WX_${data.errcode}`,
        code: data.errcode,
        message: explain(data.errcode, data.errmsg),
        data
      };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'NETWORK', message: `请求失败：${(e && e.message) || '网络异常'}` };
  }
}

// ============================================================ 查订单状态

const QUERY_ORDER_PATH = '/wxa/game/queryorderinfo';
const QUERY_ORDER_NAME = 'pay_v2.queryOrder';

/**
 * 查订单。**这是判断"用户是否真的付了钱"的权威来源。**
 *
 * @param {object} p { openid, outTradeNo, sessionKey, store }
 * @returns {Promise<{ok:boolean, payState?:number, deliverState?:number, productId?:string, message?:string}>}
 *   payState: 1 = 未支付，2 = 已支付
 *   deliverState: 1 = 未发货，2 = 已发货
 */
async function queryOrder(p) {
  if (!CONFIG.pay.appKey || !CONFIG.pay.offerId) {
    return { ok: false, error: 'PAY_NOT_CONFIGURED', message: '支付未开通' };
  }
  if (!p.openid || !p.outTradeNo) {
    return { ok: false, error: 'MISSING_PARAMS', message: '缺少 openid 或订单号' };
  }
  if (!p.sessionKey) {
    return { ok: false, error: 'NO_SESSION_KEY', message: '用户登录态已过期' };
  }

  const body = {
    openid: p.openid,
    offer_id: CONFIG.pay.offerId,
    ts: Math.floor(Date.now() / 1000), // 单位：秒
    zone_id: String(CONFIG.pay.zoneId || '1'),
    env: Number(CONFIG.pay.env) || 0,
    out_trade_no: p.outTradeNo,
    biz_id: 2 // 1 = 代币，2 = 道具直购。我们是道具直购
  };

  // 顺序按官方签名要求：access_token / signature / sig_method / pay_sig
  const bodyStr = JSON.stringify(body);
  const query = {
    signature: userSignature(p.sessionKey, bodyStr),
    sig_method: 'hmac_sha256',
    pay_sig: paySig(QUERY_ORDER_NAME, QUERY_ORDER_PATH, bodyStr)
  };

  const r = await callApi(QUERY_ORDER_PATH, query, body, { store: p.store });
  if (!r.ok) return r;

  const d = r.data || {};
  return {
    ok: true,
    payState: Number(d.pay_state) || 0,
    deliverState: Number(d.deliver_state) || 0,
    productId: d.product_id || '',
    outTradeNo: d.out_trade_no || p.outTradeNo,
    paid: Number(d.pay_state) === 2,
    delivered: Number(d.deliver_state) === 2,
    raw: d
  };
}

// ============================================================ 登录态校验

const CHECK_SESSION_PATH = '/wxa/checksession';
const RESET_SESSION_PATH = '/wxa/resetusersessionkey';

/**
 * ⚠️ 这两个接口的签名是 **对空字符串签名**：
 *     signature = hmac_sha256(session_key, "")
 * 而支付那边的用户登录态签名是对**请求体原文**签名。
 * 两者容易搞混，所以单独抽一个函数出来，不要复用 payment 那套。
 */
function emptyBodySignature(sessionKey) {
  return crypto.createHmac('sha256', sessionKey).update('', 'utf8').digest('hex');
}

/**
 * 校验服务端保存的 session_key 是否还有效。
 *
 * 为什么需要：session_key 会因为两种原因失效 ——
 *   1. 过期
 *   2. **被顶替**：用户重新 wx.login 或触发数据预拉取都会生成新的 session_key，
 *      同一个用户同一时刻只有一个有效（官方原文：「session_key 具有唯一性」）
 * session_key 失效会导致支付签名失败（错误码 90016 / -15015），所以要能提前发现。
 *
 * @param {object} p { openid, sessionKey, store }
 * @returns {Promise<{ok:boolean, valid?:boolean, error?:string}>}
 */
async function checkSessionKey(p) {
  if (!p.openid || !p.sessionKey) return { ok: false, error: 'MISSING_PARAMS' };
  const query = {
    openid: p.openid,
    signature: emptyBodySignature(p.sessionKey),
    sig_method: 'hmac_sha256'
  };
  const r = await callApi(CHECK_SESSION_PATH, query, {}, { store: p.store });
  if (r.ok) return { ok: true, valid: true };
  // 87009 = 无效签名 → session_key 已失效（被顶替或过期）
  if (r.code === 87009) return { ok: true, valid: false, error: 'SESSION_INVALID' };
  return { ok: false, error: r.error, code: r.code, message: r.message };
}

/**
 * 重置 session_key。
 *
 * ⚠️ 三个官方约束，别乱调：
 *   1. **重置后原 session_key 立即失效** —— 会影响用户正在进行的支付签名
 *   2. **重置不能续期**，新 key 继承原 key 的过期时间（所以它解决的是"被顶替"，不是"过期"）
 *   3. **不允许频繁重置同一个用户的登录态**
 *
 * 适用场景：session_key 被别处顶替，但我们还需要继续用（比如支付前的补救）。
 * 正常情况下，重新 wx.login 是更好的选择。
 *
 * @returns {Promise<{ok:boolean, sessionKey?:string, error?:string}>}
 */
async function resetUserSessionKey(p) {
  if (!p.openid || !p.sessionKey) return { ok: false, error: 'MISSING_PARAMS' };
  const query = {
    openid: p.openid,
    signature: emptyBodySignature(p.sessionKey),
    sig_method: 'hmac_sha256'
  };
  const r = await callApi(RESET_SESSION_PATH, query, {}, { store: p.store });
  if (r.ok && r.data && r.data.session_key) {
    return { ok: true, sessionKey: r.data.session_key, openid: r.data.openid || p.openid };
  }
  const map = {
    87007: 'session_key 不存在或已过期（重置无法续期，这种情况要重新登录）',
    87008: 'sig_method 不支持',
    87009: '签名无效（session_key 已经被顶替）',
    40097: '参数错误'
  };
  return {
    ok: false,
    error: r.error || 'RESET_FAILED',
    code: r.code,
    message: map[r.code] || r.message
  };
}

// ============================================================ 内容安全

const MSG_SEC_CHECK_PATH = '/wxa/game/content_spam/msg_sec_check';

const MSG_SCENE = {
  PROFILE: 1, // 资料
  COMMENT: 2, // 评论
  FORUM: 3, // 论坛
  SOCIAL_LOG: 4, // 社交日志
  CHAT: 5 // 聊天
};

/**
 * 游戏文本内容安全检测。
 *
 * ⚠️ 什么时候必须调它（官方原文）：
 *   「所有在微信端展示的数据，都建议请求本接口，包括**小游戏用户产生的内容**，
 *     以及其他渠道产生但会在微信端曝光的内容」
 * 我们现在**没有**任何用户产生且对外展示的内容（"称呼"只存本地、不上传、不给人看），
 * 所以暂时不需要调。但一旦加了 UGC（昵称公开、留言、分享文案带用户输入），
 * **必须**在这里过一道，否则会撞运营规范 5.18「内容安全」。
 *
 * 性能：官方说同步返回、一般 500ms 内，建议超时设 1s。
 *
 * @param {object} p { openid, content, scene, nickname, store }
 * @returns {Promise<{ok:boolean, pass?:boolean, label?:number, replaced?:string, message?:string}>}
 */
async function msgSecCheck(p) {
  if (!p.openid || !p.content) return { ok: false, error: 'MISSING_PARAMS' };
  const content = String(p.content).slice(0, 2500); // 官方上限 2500 字

  const body = {
    openid: p.openid,
    version: 2, // 接口版本号，固定值
    scene: p.scene || MSG_SCENE.PROFILE,
    content
  };
  if (p.nickname) body.nickname = String(p.nickname).slice(0, 100);

  const r = await callApi(MSG_SEC_CHECK_PATH, {}, body, { store: p.store, timeoutMs: 3000 });
  if (!r.ok) return r;

  const d = r.data || {};
  const result = d.result || {};
  return {
    ok: true,
    pass: result.suggest !== 'risky',
    suggest: result.suggest || '',
    label: result.label || 0,
    replaced: result.replaced_content || content,
    traceId: d.trace_id || '',
    detail: d.detail || []
  };
}

module.exports = {
  queryOrder,
  checkSessionKey,
  resetUserSessionKey,
  emptyBodySignature,
  msgSecCheck,
  paySig,
  userSignature,
  explain,
  MSG_SCENE,
  SIG_MODES,
  QUERY_ORDER_NAME,
  QUERY_ORDER_PATH
};
