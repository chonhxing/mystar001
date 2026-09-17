const crypto = require('crypto');
const { CONFIG } = require('./config.js');

/**
 * 小游戏消息推送（道具发货推送）。
 *
 * ⚠️ 这个文件的写法完全由官方协议决定，和"普通的 Webhook"很不一样：
 *
 *   1. **URL 验证是 GET，不是 POST**。在 MP 后台填 URL 时，微信会先发一个
 *      GET `/api/pay/notify?signature=..&timestamp=..&nonce=..&echostr=..`，
 *      我们要按 `sha1(sort([Token, timestamp, nonce]).join(''))` 算出签名与之比对，
 *      通过后**原样返回 echostr**。没有这一步，后台会一直显示"未通过"，配置存不下。
 *
 *   2. **需要 Token 与 EncodingAESKey**（在 MP 后台「虚拟支付2.0 - 基本配置 - 基础配置」
 *      的"发货推送配置"里自己填）。Token 参与上面的验签；EncodingAESKey 用于解消息体。
 *
 *   3. **安全模式下消息体是 AES-256-CBC 加密的**（官方推荐安全模式）。
 *      明文结构：random(16) + msgLen(4, 大端) + msg + appId，
 *      PKCS#7 填充，aeskey = base64decode(EncodingAESKey + '=')，iv = aeskey 前 16 字节。
 *      **回复微信服务器的内容不需要加密。**
 *
 *   4. 消息格式只支持 JSON。
 */

/** 后台填的 Token（参与 URL 验签） */
function token() {
  return CONFIG.pay.notifyToken || '';
}

/** 后台填的 EncodingAESKey（43 字符 base64，用于解消息体） */
function aesKey() {
  return CONFIG.pay.encodingAESKey || '';
}

function isConfigured() {
  return !!token();
}

/**
 * 校验"这个请求确实来自微信"。
 * 官方流程：把 token、timestamp、nonce 三个参数按字典序排序，
 * 拼接成一个字符串做 sha1，与 signature 比对。
 */
function checkSignature(signature, timestamp, nonce) {
  const t = token();
  if (!t || !signature || !timestamp || !nonce) return false;
  const raw = [t, String(timestamp), String(nonce)].sort().join('');
  const expect = crypto.createHash('sha1').update(raw).digest('hex');
  if (expect.length !== String(signature).length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(String(signature)));
  } catch (e) {
    return false;
  }
}

/**
 * 解密消息体（安全模式）。
 * @returns {{ ok:boolean, msg?:string, appId?:string, error?:string }}
 */
function decryptMessage(encrypted) {
  const key = aesKey();
  if (!key) return { ok: false, error: 'NO_AES_KEY' };
  try {
    const aesKeyBuf = Buffer.from(`${key}=`, 'base64'); // 43 字符 + '=' → 32 字节
    const iv = aesKeyBuf.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKeyBuf, iv);
    decipher.setAutoPadding(false);
    let buf = Buffer.concat([
      decipher.update(Buffer.from(String(encrypted), 'base64')),
      decipher.final()
    ]);

    // 去掉 PKCS#7 填充
    const pad = buf[buf.length - 1];
    if (pad < 1 || pad > 32) return { ok: false, error: 'BAD_PADDING' };
    buf = buf.slice(0, buf.length - pad);
    if (buf.length < 20) return { ok: false, error: 'TOO_SHORT' };

    // 结构：random(16) + msgLen(4, 大端) + msg + appId
    const msgLen = buf.readUInt32BE(16);
    if (buf.length < 20 + msgLen) return { ok: false, error: 'BAD_LENGTH' };
    const msg = buf.slice(20, 20 + msgLen).toString('utf8');
    const appId = buf.slice(20 + msgLen).toString('utf8');
    return { ok: true, msg, appId };
  } catch (e) {
    return { ok: false, error: `DECRYPT_FAILED:${e.message}` };
  }
}

/**
 * 校验发货推送里的 PayEventSig。
 *
 * ⚠️ 官方在这一页只写了"见《支付请求签名算法说明》（PayEventSig）"，
 *    没有直接给出算法。这里按虚拟支付的一贯做法实现：**对 Payload 原文做 HMAC-SHA256**。
 *    **接入真实支付前必须对着那份说明核一遍**（签名错会让发货全部被拒）。
 *
 * @param {boolean} isMock 模拟推送（MP 后台点"模拟推送"）时签名口径可能不同，宽松处理
 */
function checkPayEventSig(payload, sig, isMock) {
  const appKey = CONFIG.pay.appKey || '';
  if (!appKey) return false;
  if (isMock && !sig) return true; // 后台模拟推送可能不带签名
  if (!sig) return false;
  const expect = crypto.createHmac('sha256', appKey).update(String(payload), 'utf8').digest('hex');
  if (expect.length !== String(sig).length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(String(sig)));
  } catch (e) {
    return false;
  }
}

/**
 * 从各种可能的请求形态里取出"消息体"和"是否模拟推送"。
 * 明文模式直接给 JSON；安全模式需要解密。
 * @returns {{ ok:boolean, data?:object, error?:string, mock?:boolean }}
 */
function parsePush(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'BAD_BODY' };

  // 安全模式：消息在 Encrypt 字段里
  if (body.Encrypt) {
    const r = decryptMessage(body.Encrypt);
    if (!r.ok) return { ok: false, error: r.error };
    let data = null;
    try {
      data = JSON.parse(r.msg);
    } catch (e) {
      return { ok: false, error: 'BAD_JSON_AFTER_DECRYPT' };
    }
    return { ok: true, data, mock: !!data.IsMock };
  }

  // 明文模式
  return { ok: true, data: body, mock: !!(body.MiniGame && body.MiniGame.IsMock) };
}

module.exports = {
  isConfigured,
  checkSignature,
  decryptMessage,
  checkPayEventSig,
  parsePush,
  token,
  aesKey
};
