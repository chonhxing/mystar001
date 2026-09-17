/**
 * 震动反馈（haptics）。
 *
 * 轻震动只做"点到了"的确认，不做任何业务提示 —— 所以它必须：
 *   1. 全局统一一处调用（input.js 的 tap 分发），不在每个按钮里各写一份；
 *   2. 尊重用户的设置开关（我的 → 设置 → 震动反馈）；
 *   3. 老基础库 / 不支持时静默跳过。
 */

const storage = require('../utils/storage.js');

/** 是否开了震动（默认开） */
function enabled() {
  const s = storage.getSettings();
  return s.vibration !== false;
}

/** 一次轻震动。调用点：input.js 的 tap 分发 */
function tap() {
  if (!enabled()) return;
  try {
    if (typeof wx !== 'undefined' && typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }
  } catch (e) {
    /* 不支持就静默 */
  }
}

module.exports = { tap, enabled };
