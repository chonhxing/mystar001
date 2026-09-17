/**
 * 用户协议 / 隐私政策的同意状态。
 *
 * 状态只有一个用途：首次启动时挡一次弹窗（见 src/js/ui/agreement.js 的
 * ensureAgreed）。同意过就写进本地存储，之后不再打扰 ——
 * 官方要求的是"应用内可随时查看协议全文"，而不是"每次启动都弹"。
 * （每次启动都弹一次同意框属于骚扰式交互，反而容易挨投诉。）
 */

const storage = require('../utils/storage.js');

function hasAgreed() {
  return storage.get(storage.KEYS.agreement, '') === '1';
}

function accept() {
  storage.set(storage.KEYS.agreement, '1');
}

/** 测试/清空全部数据时会用到：把同意状态一起重置 */
function reset() {
  storage.set(storage.KEYS.agreement, '');
}

module.exports = { hasAgreed, accept, reset };
