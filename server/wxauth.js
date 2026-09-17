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

function sign(payload) {
  return b64url(crypto.createHmac('sha256', CONFIG.auth.secret).update(payload).digest()).slice(0, 43);
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

module.exports = { login, issueToken, verifyToken, ownerOf, resolveOwner, isDevMode };
