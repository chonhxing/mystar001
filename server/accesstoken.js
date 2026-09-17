const { CONFIG } = require('./config.js');

/**
 * Access Token 管理。
 *
 * 所有服务端接口（发货推送之外的那些：queryOrder、msgSecCheck、数据分析…）都要它，
 * 所以"拿 token"这件事必须做对，否则后面全是 40001。
 *
 * 用官方推荐的 **stable_token**（`/cgi-bin/stable_token`），不是老的 `getAccessToken`：
 *   - 官方原文：「此接口和 getAccessToken 互相隔离，且比其更加稳定，推荐使用此接口替代」
 *   - 普通模式（force_refresh=false）**有效期内重复调用不会刷新 token**，
 *     所以可以放心地缓存、反复请求，不会把别处的 token 顶掉
 *   - 「普通模式下平台会提前 5 分钟更新 access_token」→ 我们也提前 5 分钟续期
 *   - 强制刷新模式每天限 20 次且需间隔 30 秒，**我们不用**（用错会把线上 token 打废）
 *
 * ⚠️ 两个容易踩的坑：
 *   1. **IP 白名单**：错误码 40164 表示"服务器 IP 不在白名单"，要去 MP 后台加。
 *      这个错误在本地开发时很常见，提示语要直接指出解决办法。
 *   2. **并发**：多个人同时请求不能各拿一次 token（会浪费配额也可能互相顶掉）。
 *      这里用 single-flight 把并发请求合并成一次。
 */

let cache = { token: '', expireAt: 0 };
let inflight = null;

/** 提前续期窗口：官方说平台提前 5 分钟更新，我们跟着提前 */
const EARLY_MS = 5 * 60 * 1000;

function configured() {
  return !!(CONFIG.wechat.appid && CONFIG.wechat.secret);
}

/**
 * 拿一个可用的 access_token。
 * @param {object} store 可选：传了就把 token 落盘，进程重启后还能复用（少调一次接口）
 * @returns {Promise<{ ok:boolean, token?:string, fromCache?:boolean, error?:string, message?:string }>}
 */
function get(store) {
  const now = Date.now();
  if (cache.token && cache.expireAt > now) {
    return Promise.resolve({ ok: true, token: cache.token, fromCache: true });
  }

  // 落盘缓存（进程重启后复用）
  if (store && store.getAccessToken) {
    const saved = store.getAccessToken();
    if (saved && saved.token && saved.expireAt > now + 60000) {
      cache = { token: saved.token, expireAt: saved.expireAt };
      return Promise.resolve({ ok: true, token: saved.token, fromCache: true });
    }
  }

  if (!configured()) {
    return Promise.resolve({
      ok: false,
      error: 'NOT_CONFIGURED',
      message: '未配置 WX_APPID / WX_SECRET，无法获取 access_token'
    });
  }

  // single-flight：并发时只发一次请求
  if (inflight) return inflight;

  const url = `${CONFIG.wechat.apiBase}/cgi-bin/stable_token`;
  const body = JSON.stringify({
    grant_type: 'client_credential',
    appid: CONFIG.wechat.appid,
    secret: CONFIG.wechat.secret
    // 不传 force_refresh：普通模式下有效期内不会刷新，最安全
  });

  inflight = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10000)
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.access_token) {
        const code = data && data.errcode;
        return {
          ok: false,
          error: `HTTP_${code || 'UNKNOWN'}`,
          message: explain(code, data && data.errmsg)
        };
      }
      const ttl = (Number(data.expires_in) || 7200) * 1000;
      cache = { token: data.access_token, expireAt: Date.now() + ttl - EARLY_MS };
      if (store && store.setAccessToken) store.setAccessToken(cache);
      return { ok: true, token: data.access_token, fromCache: false };
    })
    .catch((e) => ({
      ok: false,
      error: 'NETWORK',
      message: `获取 access_token 失败：${(e && e.message) || '网络异常'}`
    }))
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** 把官方错误码翻成人话，尤其是"要去后台做什么" */
function explain(code, errmsg) {
  const map = {
    40013: 'AppID 不合法（检查 MP 后台的 AppID）',
    40125: 'AppSecret 不正确',
    // 这两个是本地开发最常撞上的
    40164: '服务器 IP 不在白名单：去 MP 后台「开发管理-开发设置-IP 白名单」把本机出口 IP 加上',
    45009: '接口调用超过天级限额',
    45011: '接口调用太频繁，稍后再试',
    89503: '此次调用需要管理员确认'
  };
  return map[code] || `获取失败（errcode=${code}${errmsg ? ` ${errmsg}` : ''}）`;
}

/** 仅供测试与排障：清掉内存缓存 */
function clearCache() {
  cache = { token: '', expireAt: 0 };
  inflight = null;
}

module.exports = { get, clearCache, configured, explain };
