const https = require('https');
const http = require('http');

/**
 * 访问微信接口的专用 HTTP 客户端（只给 api.weixin.qq.com 用）。
 *
 * ## 为什么要单独写一个
 *
 * 微信云托管的容器访问 `api.weixin.qq.com` 时，流量会走**平台内部的代理**，
 * 而这个代理出示的是**自签名证书**。Node 的内置 fetch 用系统 CA 校验，
 * 于是必然失败，报错是：
 *
 *     fetch failed ← DEPTH_ZERO_SELF_SIGNED_CERT（自签名证书）
 *
 * 线上表现就是"账号一直登录不上"，而容器访问别的外网（比如 DeepSeek）
 * 一切正常 —— 于是很容易误判成"没有公网出口"。真机上我们就是这么绕了一圈。
 *
 * ## 策略：严格校验优先，只对这一个域名降级
 *
 *   1. 先按**严格校验**请求（首选，证书正常时走的永远是这一条）
 *   2. 只有失败原因明确是证书问题时，才**单独对 api.weixin.qq.com**
 *      放宽校验重试一次，并打一条警告日志、把 `via` 报给 /api/health
 *
 * 这么做的边界很清楚：放宽的只是"连云托管内网代理"这一跳，
 * 别的域名的 TLS 校验完全不受影响（不像 NODE_TLS_REJECT_UNAUTHORIZED=0
 * 那样一关全关）；而且它**不会静默**——health 里能看见当前用的是哪一档。
 *
 * 顺带把对端证书的签发者/指纹抓回来，方便以后改成"信任这个 CA"的正式做法。
 */

const INSECURE_HOSTS = ['api.weixin.qq.com'];

function isCertError(code, message) {
  const s = `${code || ''} ${message || ''}`;
  return /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ALT_NAME|EXPIRED/i.test(s);
}

function certSummary(socket) {
  try {
    const c = socket && socket.getPeerCertificate ? socket.getPeerCertificate() : null;
    if (!c || !c.subject) return null;
    return {
      subject: c.subject.CN || '',
      issuer: (c.issuer && (c.issuer.CN || c.issuer.O)) || '',
      fingerprint256: c.fingerprint256 || '',
      validTo: c.valid_to || ''
    };
  } catch (e) {
    return null;
  }
}

/** 一次原始请求。始终 resolve（不抛），把结果和证书信息一起带回来。 */
function rawGet(url, opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs || 8000;
  const mod = url.indexOf('https:') === 0 ? https : http;
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const req = mod.get(
      url,
      { timeout: timeoutMs, rejectUnauthorized: o.rejectUnauthorized !== false },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => done({ ok: true, status: res.statusCode, raw, cert: certSummary(res.socket) }));
      }
    );
    req.on('timeout', () => { req.destroy(); done({ ok: false, error: 'TIMEOUT', code: 'ETIMEDOUT' }); });
    req.on('error', (e) => done({ ok: false, error: e.message, code: e.code || '' }));
  });
}

/**
 * 带降级阶梯的 GET。
 * @returns {Promise<{ok:boolean, status?:number, json?:object, raw?:string,
 *                    via?:string, cert?:object, error?:string, code?:string}>}
 */
async function getJson(url, opts) {
  const o = opts || {};
  const strict = await rawGet(url, { timeoutMs: o.timeoutMs });
  if (strict.ok || !isCertError(strict.code, strict.error)) {
    return Object.assign({ via: 'strict' }, strict, { json: safeJson(strict.raw) });
  }

  // 证书问题：只给白名单里的域名（默认就 api.weixin.qq.com）降级重试一次
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = ''; }
  if (INSECURE_HOSTS.indexOf(host) < 0) {
    return Object.assign({ via: 'strict' }, strict, { json: safeJson(strict.raw) });
  }
  if (!insecureWarned) {
    insecureWarned = true;
    console.warn(`[wxhttp] ⚠️ ${host} 的证书不被信任（${strict.code}）—— 这是云托管内网代理的自签证书，`);
    console.warn('[wxhttp]    已**只对这个域名**放宽校验重试。别的域名仍然严格校验，状态见 /api/health。');
  }
  const loose = await rawGet(url, { timeoutMs: o.timeoutMs, rejectUnauthorized: false });
  return Object.assign({ via: 'insecure', strictCode: strict.code, strictError: strict.error }, loose, {
    json: safeJson(loose.raw)
  });
}

let insecureWarned = false;

function safeJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

module.exports = { getJson, isCertError, certSummary, INSECURE_HOSTS };
