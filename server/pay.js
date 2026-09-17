const crypto = require('crypto');
const { CONFIG } = require('./config.js');

/**
 * 虚拟支付 2.0 · 道具直购的服务端部分。
 *
 * 这一层存在的唯一理由：**签名用的密钥（AppKey）和用户态签名用的 session_key
 * 绝不能进客户端包体**。小游戏包体可以被解包，任何写进前端的密钥都等于公开。
 *
 * 官方要求的两个签名：
 *   paySig    = to_hex(hmac_sha256(AppKey,     'requestMidasPaymentGameItem&' + signData))
 *   signature = to_hex(hmac_sha256(sessionKey, signData))
 * 注意 signData 必须**原样**传递（包括空格和换行），所以它是服务端生成好下发的字符串，
 * 客户端不能自己重新序列化一遍，否则签名对不上。
 *
 * ⚠️ 开通门槛（官方《虚拟支付进件》原文）：
 *    主体须为个体工商户或企业 + 已接入中宣部实名认证系统 + **游戏版号/软著/授权**。
 *    没有版号就开不了虚拟支付 —— 所以这里所有能力在没配 key 时都返回"未开通"，不会报错。
 */

/** 后台配置里读出来的密钥（都不下发客户端） */
function keys() {
  return {
    appKey: CONFIG.pay.appKey || '',
    sessionKey: '' // 每个用户不同，走 store
  };
}

function isConfigured() {
  return !!keys().appKey && !!(CONFIG.pay.offerId || '').length;
}

function hmacHex(key, text) {
  return crypto.createHmac('sha256', key).update(text, 'utf8').digest('hex');
}

/**
 * 组装 signData。字段和顺序按官方文档来，全部必填项都要有。
 * @param {object} p { offerId, zoneId, env, productId, price(分), outTradeNo, attach }
 */
function buildSignData(p) {
  return JSON.stringify({
    mode: 'goods', // 道具直购
    offerId: p.offerId,
    buyQuantity: 1,
    env: Number(p.env) || 0,
    currencyType: 'CNY',
    platform: 'android', // iOS 现在也走这个参数；平台用 checkIsSupportMidasPayment 单独判定
    zoneId: String(p.zoneId || '1'),
    productId: p.productId,
    goodsPrice: Number(p.price) || 0, // ⚠️ 单位是分
    outTradeNo: p.outTradeNo,
    attach: p.attach || ''
  });
}

function signDataFor({ productId, price, outTradeNo, attach }) {
  return buildSignData({
    offerId: CONFIG.pay.offerId,
    zoneId: CONFIG.pay.zoneId,
    env: CONFIG.pay.env,
    productId,
    price,
    outTradeNo,
    attach
  });
}

/** 支付签名（服务端用 AppKey 签） */
function paySig(signData) {
  return hmacHex(keys().appKey, `requestMidasPaymentGameItem&${signData}`);
}

/** 用户态签名（服务端用该用户的 session_key 签） */
function userSignature(signData, sessionKey) {
  return hmacHex(sessionKey, signData);
}

/**
 * 校验发货推送的签名（PayEventSig）。
 * ⚠️ 官方文档只说"见支付类订阅事件签名算法说明"，没有在这页给出算法细节。
 *    这里按"对 Payload 原文做 HMAC-SHA256"实现，**接真实支付前必须对着官方说明核一遍**。
 *    校验不通过一律拒收，宁可漏发也不能收伪造的发货请求。
 */
function verifyEventSig(payload, sig) {
  if (!isConfigured() || !sig) return false;
  const expect = hmacHex(keys().appKey, payload);
  if (expect.length !== String(sig).length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(String(sig)));
  } catch (e) {
    return false;
  }
}

/** 生成业务订单号：32 字符内，只允许数字/大小写字母/_-|*@，且不能以下划线开头 */
function genOrderNo() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `MZ${stamp}${rand}`.slice(0, 32);
}

/**
 * 发放权益（服务端权威）。
 *
 * 为什么权益要放服务端：付费权益如果只存客户端本地，换设备就没了，用户会投诉。
 * 而且本地存储可篡改，涉及钱的东西不能只靠它。
 *
 * 幂等是硬要求：官方明确说"同样的发货请求可能被请求多次，
 * 开发者需要确保只发货一次，且回包要和第一次一样返回发货成功"。
 *
 * @returns {{ granted: boolean, passExpireAt: number }}
 */
function deliver(store, openid, orderNo, days) {
  const user = store.getUser(openid) || {};
  user.orders = user.orders || {};

  if (user.orders[orderNo] && user.orders[orderNo].delivered) {
    // 已经发过：返回和第一次一样的结果
    return { granted: false, duplicate: true, passExpireAt: user.passExpireAt || 0 };
  }

  const base = Math.max(Date.now(), user.passExpireAt || 0);
  const expireAt = base + Math.max(1, Number(days) || 1) * 24 * 3600 * 1000;

  user.orders[orderNo] = Object.assign({}, user.orders[orderNo], {
    delivered: true,
    deliveredAt: Date.now(),
    days: Math.max(1, Number(days) || 1)
  });
  user.passExpireAt = expireAt;

  // 只留最近 100 笔订单，避免无限增长
  const orderKeys = Object.keys(user.orders);
  if (orderKeys.length > 100) {
    orderKeys
      .sort((a, b) => (user.orders[a].deliveredAt || 0) - (user.orders[b].deliveredAt || 0))
      .slice(0, orderKeys.length - 100)
      .forEach((k) => {
        delete user.orders[k];
      });
  }

  store.setUser(openid, user);
  return { granted: true, duplicate: false, passExpireAt: expireAt };
}

module.exports = {
  isConfigured,
  buildSignData,
  signDataFor,
  paySig,
  userSignature,
  verifyEventSig,
  genOrderNo,
  deliver,
  hmacHex
};
