const crypto = require('crypto');
const { CONFIG } = require('./config.js');

/**
 * 微信登录 + 无状态会话 token。
 *
 * 小程序端 wx.login() 拿 code → 发到这里 → 服务端换 openid → 签一个 token 回去。
 * token 是无状态的（openid.过期时间.HMAC），所以不需要 session 表；
 * 想强制下线就换 AUTH_SECRET。
 *
 * 没配 WX_APPID 时进入开发模式：客户端可以直接传一个 devId，
 * 这样在开发者工具里不接微信也能把整条链路跑通。
 */

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 会话签名密钥。
 *
 * ⚠️ 这里**不能**用一个写死在仓库里的默认值。token 就是 `openid.exp.签名`，
 * 密钥一旦是公开的（比如默认值 `dev-only-change-me` —— 这个仓库是可读的），
 * 任何人手算一个 HMAC 就能签发任意 openid 的 token，等于**冒充任意用户**：
 * 读别人的账号、改别人的权益、花别人的配额。这不是"弱密码"，是没有鉴权。
 *
 * 所以策略是：
 *   · 配了够长的 AUTH_SECRET → 用它（唯一正确的做法）
 *   · 没配 / 还是占位符 / 太短 → **本次进程随机生成一个**，并大声警告。
 *     代价是重启或换副本后旧会话失效（用户要重新登录一次，
 *     权益会在下次 syncFromServer 时恢复）—— 这远好过一个能被冒充的公开密钥。
 */
const UNSAFE_SECRETS = ['', 'dev-only-change-me', 'change-me-to-a-long-random-string'];

/**
 * 这个密钥能不能用（不能用 = 抛掉它，改用临时随机）。
 *
 * ⚠️ 只做"精确字符串比对"是不够的 —— 第一版就栽在这儿：
 *    实际躺在 .env 里的占位符是 `dev-only-change-me-to-a-long-random-...`
 *    这种**变体**，长度 36、看着像真密钥，精确比对全都不命中，
 *    于是被原样抄进了部署表，等于把签名密钥公开出去。
 *    所以这里改成"形态判断"：明显是占位符的、或熵太低的，一律不认。
 */
const PLACEHOLDER_HINTS = ['change-me', 'changeme', 'dev-only', 'placeholder', 'example', 'todo', 'xxxx', 'your-secret', 'test-secret'];
function isWeakSecret(v) {
  const s = String(v || '');
  if (s.length < 32) return true;
  if (UNSAFE_SECRETS.indexOf(s) >= 0) return true;
  const low = s.toLowerCase();
  if (PLACEHOLDER_HINTS.some((h) => low.indexOf(h) >= 0)) return true;
  // 熵太低：真正的随机串（hex/base64）字符种类很多；"aaaa...""secretsecret..." 这种不像
  if (new Set(s).size < 8) return true;
  return false;
}

let ephemeralSecret = null;

function usingEnvSecret() {
  return !isWeakSecret(CONFIG.auth.secret);
}

function secret() {
  if (usingEnvSecret()) return String(CONFIG.auth.secret);
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[auth] ⚠️ 没有配置 AUTH_SECRET（或还是占位符/太短）→ 本次启动用一个随机密钥。');
    console.warn('[auth]    影响：重启或换副本后所有会话失效，用户需要重新登录（权益会在下次同步时恢复）。');
    console.warn('[auth]    修复：云托管「服务设置 → 环境变量」里配一个长随机串；');
    console.warn('[auth]        `node tools/make-env-sheet.js` 会自动生成一个并写进粘贴表。');
  }
  return ephemeralSecret;
}

/** 密钥来源：env = 配好了；generated = 临时随机（重启后要重新登录） */
function secretSource() {
  return usingEnvSecret() ? 'env' : 'generated';
}

function sign(payload) {
  return b64url(crypto.createHmac('sha256', secret()).update(payload).digest()).slice(0, 43);
}

function issueToken(openid) {
  const exp = Date.now() + CONFIG.auth.tokenTtlHours * 3600 * 1000;
  const payload = `${b64url(openid)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expect = sign(payload);
  // 定长比较，避免时序侧信道
  if (parts[2].length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expect))) return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  try {
    return Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (e) {
    return null;
  }
}

/**
 * 用 code 换 openid + session_key。
 *
 * ⚠️ 两个错误要区别对待，不能都当成"登录失败"：
 *   - **40029** code 无效：多半是 code 被用过或过期了（code 只能用一次），重新 wx.login 即可
 *   - **40226** code blocked：**高风险等级用户，平台直接拦截登录**。
 *     这不是我们或用户操作的问题，也不能靠重试解决 —— 要给一句得体的话术，
 *     而且**不能因此挡住游戏本身**（命盘是本机算的，不登录也能玩）。
 */
async function code2session(code) {
  const url =
    `${CONFIG.wechat.loginUrl}?appid=${encodeURIComponent(CONFIG.wechat.appid)}` +
    `&secret=${encodeURIComponent(CONFIG.wechat.secret)}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (data && data.openid) {
    return {
      openid: data.openid,
      // unionid 只在"小程序已绑定微信开放平台"时才返回；绑了才能跨应用识别同一用户
      unionid: data.unionid || '',
      sessionKey: data.session_key
    };
  }
  return {
    error: (data && data.errmsg) || 'WX_LOGIN_FAILED',
    code: data && data.errcode,
    blocked: !!(data && data.errcode === 40226)
  };
}

const isDevMode = () => !CONFIG.wechat.appid || !CONFIG.wechat.secret;

/**
 * 会话入口。返回 { ok, token, openid, dev }
 *
 * ⚠️ session_key 会让返回值多一个 sessionKey 字段，**调用方必须只把它存服务端，
 *    绝不能下发客户端** —— 它能用来伪造用户态签名。
 *
 * @param {object} body { code, devId }
 * @param {object} store 可选：传了就把 session_key 存起来（支付签名要用）
 */
async function login(body, store) {
  if (body && body.code && !isDevMode()) {
    try {
      const r = await code2session(body.code);
      if (r.openid) {
        if (store && r.sessionKey) store.setSessionKey(r.openid, r.sessionKey);
        return {
          ok: true,
          token: issueToken(r.openid),
          openid: r.openid,
          unionid: r.unionid,
          dev: false,
          // 只在服务端内部流转，绝不出现在 HTTP 响应里
          sessionKey: r.sessionKey
        };
      }
      return {
        ok: false,
        error: r.blocked ? 'USER_BLOCKED' : r.code ? `WX_${r.code}` : 'WX_LOGIN_FAILED',
        // 40226：平台判定高风险用户并拦截登录。既不是我们的 bug 也不是用户能修的，
        // 所以单独给一句得体的话术，并且**不能因此挡住游戏**。
        blocked: !!r.blocked,
        message: r.blocked
          ? '当前微信账号暂时无法完成登录'
          : r.code === 40029
          ? '登录凭证已失效，请重试'
          : r.error
      };
    } catch (e) {
      return { ok: false, error: 'WX_UNREACHABLE' };
    }
  }

  if (isDevMode()) {
    // 开发模式：devId 由客户端生成并存在本地，仅用于区分配额
    const devId = String((body && body.devId) || '').slice(0, 64) || 'anonymous';
    const openid = `dev_${devId}`;
    return { ok: true, token: issueToken(openid), openid, dev: true };
  }

  return { ok: false, error: 'MISSING_CODE' };
}

/** 从请求头里取 owner（token 优先，其次 IP），用于配额与缓存归属 */
function ownerOf(req, token) {
  const fromToken = verifyToken(token);
  if (fromToken) return fromToken;
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown';
  return `ip_${ip}`;
}

/**
 * 更严格的归属解析，用于**涉及钱和账号的接口**。
 *
 * 为什么需要它：`ownerOf` 在 token 失效时会**悄悄回退到 IP**。
 * 对配额统计无所谓，但对付费权益是灾难 —— 用户登录态一过期，
 * 他的 owner 就从 `openid` 变成了 `ip_x.x.x.x`，查到的权益是空的，
 * 表现就是"我买的畅玩卡突然没了"。
 *
 * 所以这里把三种情况分开：
 *   - 没带 token  → 匿名（开发模式、或不涉及账号的调用）
 *   - token 有效  → 正常
 *   - token 失效  → **明确报错让客户端重新登录**，绝不静默降级
 *
 * @returns {{ owner:string|null, expired:boolean, anonymous:boolean }}
 */
function resolveOwner(req, token) {
  if (!token) return { owner: ownerOf(req, ''), expired: false, anonymous: true };
  const openid = verifyToken(token);
  if (openid) return { owner: openid, expired: false, anonymous: false };
  return { owner: null, expired: true, anonymous: false };
}

module.exports = {
  login, issueToken, verifyToken, ownerOf, resolveOwner, isDevMode, secretSource,
  // 生成部署配置的工具要用同一份判断，别在两处各写一遍（第一版就是这么错的）
  isWeakSecret, UNSAFE_SECRETS
};
