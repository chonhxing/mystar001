const { CONFIG } = require('../config/index.js');
const entitlement = require('./entitlement.js');
const analytics = require('./analytics.js');

/**
 * 虚拟支付 2.0 · 道具直购（`wx.requestMidasPaymentGameItem`）。
 *
 * ⚠️ 三个必须知道的前提：
 *
 * 1. **开通有硬门槛**：官方《虚拟支付进件》要求「主体为个体工商户或企业 + 已接入中宣部
 *    实名认证系统 + 游戏版号/软著/授权」。没版号就开不了，所以 CONFIG.PAY.ENABLED 默认 false，
 *    整条链路自动隐藏，产品能在纯广告（IAA）状态下先上线。
 *
 * 2. **iOS 的情况是"有条件支持"**：`wx.checkIsSupportMidasPayment`（基础库 3.10.3+）说明
 *    iOS 需要 iOS 15+ / 客户端 8.0.68+ 才可能支持；且「若该 API 都不存在，则 iOS 一定不支持」。
 *    错误码 701001 就是 "ios禁止支付"。所以**必须先探测再拉起支付**，不能假设能用。
 *
 * 3. **支付成功 ≠ 权益到账**。平台是"扣费成功后向开发者服务端推送发货消息"，
 *    客户端必须再向后端确认一次；确认不到就给用户"稍后到账"的提示，绝不能当成功。
 *
 * 金额单位是**分**（接口字段 goodsPrice），所以 6 元 = 600。
 */

/** 同步判断：当前环境有没有虚拟支付能力（不发起网络请求） */
function isSupported() {
  if (!CONFIG.PAY || !CONFIG.PAY.ENABLED) return { ok: false, reason: 'DISABLED' };
  if (typeof wx === 'undefined') return { ok: false, reason: 'NO_WX' };
  if (typeof wx.requestMidasPaymentGameItem !== 'function') {
    // 官方原文：若该 API 都不存在，则 iOS 一定不支持虚拟支付
    return { ok: false, reason: 'API_MISSING' };
  }
  return { ok: true, reason: 'OK' };
}

/**
 * 异步探测：优先用官方能力检测接口，拿不到就退回 API 存在性判断。
 * 每次进付费面板探一次即可，结果缓存起来（同一会话内环境不会变）。
 */
let probeCache = null;

function probe(force) {
  if (probeCache && !force) return Promise.resolve(probeCache);

  const quick = isSupported();
  if (!quick.ok) {
    probeCache = quick;
    return Promise.resolve(quick);
  }

  return new Promise((resolve) => {
    if (typeof wx.checkIsSupportMidasPayment !== 'function') {
      // 老基础库没有这个接口：只能按"API 存在即支持"处理，
      // 真不支持时会在拉起支付时报 701001，那时再给用户解释。
      probeCache = { ok: true, reason: 'OK_NO_PROBE' };
      resolve(probeCache);
      return;
    }
    try {
      wx.checkIsSupportMidasPayment({
        success(res) {
          const allow = !!(res && res.data && res.data.allow_pay);
          probeCache = {
            ok: allow,
            reason: allow ? 'OK' : 'PLATFORM_DENIED',
            errMsg: res && res.data ? res.data.err_msg : ''
          };
          resolve(probeCache);
        },
        fail(err) {
          // 检测本身失败：不当成"不支持"，否则会把能付费的用户挡掉。
          // 让它继续走支付流程，真不行会在拉起时报错。
          probeCache = { ok: true, reason: 'PROBE_FAILED', errMsg: err && err.errMsg };
          resolve(probeCache);
        }
      });
    } catch (e) {
      probeCache = { ok: false, reason: 'PROBE_THREW' };
      resolve(probeCache);
    }
  });
}

/** 商品列表（价格在这里是"分"，UI 自己转成元） */
function products() {
  return (CONFIG.PAY && CONFIG.PAY.PRODUCTS) || [];
}

function findProduct(productId) {
  return products().find((p) => p.id === productId) || null;
}

/** 把错误码翻译成人话。官方错误码表见 wx.requestMidasPaymentGameItem 文档。 */
function messageOf(code, fallback) {
  const map = {
    '-1': '系统繁忙，请稍后再试',
    '-2': '已取消支付',
    1: '已取消支付',
    7: '已取消支付',
    2: '正在支付中，请完成上一笔',
    3: '需要先安装 Google Play',
    '-15009': '本次支付超出限额（受健康系统限制）',
    '-15016': '道具价格不一致，请联系客服',
    '-15005': '当前小程序没有虚拟支付权限',
    '-15013': '代币尚未发布，请联系客服',
    '-15012': '支付签名校验失败',
    '-15014': '支付签名错误',
    701001: '当前设备不支持支付（iOS 需 iOS 15 及以上 + 微信 8.0.68 及以上）'
  };
  return map[String(code)] || fallback || '支付未完成';
}

/** 取消类错误码：不该当成"失败"来报警，用户就是不想付 */
const CANCEL_CODES = ['-2', '1', '7'];

/** 拉起原生支付面板 */
function requestPay(signed) {
  return new Promise((resolve) => {
    try {
      wx.requestMidasPaymentGameItem({
        signData: signed.signData,
        paySig: signed.paySig,
        signature: signed.signature,
        success: () => resolve({ ok: true }),
        fail: (err) => {
          const code = err && (err.errCode !== undefined ? err.errCode : err.errCode);
          resolve({
            ok: false,
            cancelled: CANCEL_CODES.indexOf(String(code)) >= 0,
            reason: `PAY_${code}`,
            code,
            message: messageOf(code, err && err.errMsg)
          });
        }
      });
    } catch (e) {
      resolve({ ok: false, reason: 'PAY_THREW', message: '支付未能发起' });
    }
  });
}

/**
 * 买一个档位。
 *
 * 完整链路：探测能力 → 后端签名 → 拉起支付 → 后端确认订单 → 发放权益
 * 任何一步失败都返回结构化的结果，让 UI 能给出准确的话术。
 *
 * @param {string} productId
 * @param {object} hooks { onPayStart } 让你在拉起原生面板前先收起自己的界面
 */
async function purchase(productId, hooks) {
  const h = hooks || {};
  const product = findProduct(productId);
  if (!product) return { ok: false, reason: 'UNKNOWN_PRODUCT', message: '没有这个档位' };

  const support = await probe();
  if (!support.ok) {
    analytics.report(analytics.REPORTABLE.PAY_UNSUPPORTED, { reason: support.reason });
    return {
      ok: false,
      reason: support.reason,
      message:
        support.reason === 'DISABLED'
          ? '当前版本未开通支付'
          : '当前设备不支持支付，可以先用看广告的方式解锁'
    };
  }

  // 客户端只认识自己的后端（key 绝不能进包体）
  const api = require('./api.js');

  const signed = await api.paySign(productId);
  if (!signed || !signed.ok) {
    analytics.report(analytics.REPORTABLE.PAY_FAILED, { product: productId, stage: 'sign' });
    return {
      ok: false,
      reason: (signed && signed.reason) || 'SIGN_FAILED',
      message: (signed && signed.message) || '下单失败，请稍后再试'
    };
  }

  analytics.report(analytics.REPORTABLE.PAY_START, { product: productId, price: product.price });
  if (h.onPayStart) h.onPayStart();

  const paid = await requestPay(signed);
  if (!paid.ok) {
    // 用户主动取消不算失败，不打扰他
    if (!paid.cancelled) {
      analytics.report(analytics.REPORTABLE.PAY_FAILED, {
        product: productId,
        stage: 'pay',
        code: paid.code
      });
    }
    // ⚠️ code 必须透出去：UI 要靠它区分完全不同的处理方式 ——
    //    iOS 禁止支付（701001）应当引导用户去看广告，
    //    而道具价格不一致（-15016）是我们自己的配置错误，要提示联系客服。
    //    只给一句中文 message 的话，UI 只能做文本匹配，非常脆。
    return {
      ok: false,
      cancelled: !!paid.cancelled,
      reason: paid.reason,
      code: paid.code,
      message: paid.message
    };
  }

  // ---- 支付成功，确认发货 ----
  // 平台是异步推送发货消息到服务端，客户端这里主动确认一次，避免用户干等。
  const orderNo = signed.outTradeNo;
  const confirmed = await api.payConfirm(orderNo);

  // ⚠️ 服务端会对平台做一次权威查询（pay_v2.queryOrder）。如果平台明确说"这笔没付"，
  //    说明客户端上报的支付成功不可信（被改包或异常），**绝不能发权益**。
  if (confirmed && confirmed.ok === false && confirmed.error === 'NOT_PAID') {
    analytics.report(analytics.REPORTABLE.PAY_FAILED, {
      product: productId,
      stage: 'verify',
      code: 'NOT_PAID'
    });
    return {
      ok: false,
      reason: 'NOT_PAID',
      verified: true,
      message: '未检测到这笔支付，请稍后重试或联系客服'
    };
  }

  const granted = entitlement.grantPassOnce(orderNo, product.days);

  analytics.report(analytics.REPORTABLE.PAY_SUCCESS, {
    product: productId,
    price: product.price,
    days: product.days,
    confirmed: !!(confirmed && confirmed.ok)
  });

  if (granted) {
    // 常规路径：后端确认到了（或后端明确说订单有效），本地已发放
    return {
      ok: true,
      days: product.days,
      orderNo,
      pending: !(confirmed && confirmed.ok),
      message: `畅玩卡已到账，${product.days} 天内不限次`
    };
  }
  // 幂等命中：这单之前已经发过了（比如用户重复点了支付）
  return { ok: true, days: 0, orderNo, duplicate: true, message: '这笔订单已经到账过了' };
}

/**
 * 从服务端同步付费权益。
 *
 * 为什么需要：付费权益如果只存本地，换设备就没了，用户会投诉。
 * 所以**涉及钱的权益以服务端为准**（见 server/pay.js），本地只是缓存。
 * 免费次数和广告券不涉及钱，留在本地就行。
 */
async function syncFromServer() {
  if (!CONFIG.PAY || !CONFIG.PAY.ENABLED) return { ok: false, reason: 'DISABLED' };
  const api = require('./api.js');
  const remote = await api.entitlementSync();
  if (!remote || !remote.ok) return { ok: false, reason: 'SYNC_FAILED' };

  const current = entitlement.readState();
  const remoteExpire = Number(remote.passExpireAt) || 0;
  // 取较晚的那个：避免服务端（或本地）某一侧时钟/记录滞后把用户的时长吃掉
  if (remoteExpire > current.passExpireAt) {
    entitlement.grantPassUntil(remoteExpire);
    return { ok: true, changed: true, passExpireAt: remoteExpire };
  }
  return { ok: true, changed: false };
}

module.exports = {
  isSupported,
  probe,
  products,
  findProduct,
  purchase,
  syncFromServer,
  messageOf,
  resetProbeCache() {
    probeCache = null;
  }
};
