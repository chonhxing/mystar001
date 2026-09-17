/**
 * 小工具：日期、文案截断、wx 原生弹层的 Promise 化。
 */

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 本地日期字符串 YYYY-MM-DD（不要用 toISOString，那是 UTC，会差一天） */
function dateStr(d) {
  const date = d || new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeStr(d) {
  const date = d || new Date();
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 相对时间：刚刚 / 3分钟前 / 昨天 / 09-12 */
function fromNow(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 48 * 3600 * 1000) return '昨天';
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shorten(str, max) {
  const s = String(str || '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function toast(title, icon) {
  wx.showToast({ title: String(title).slice(0, 20), icon: icon || 'none', duration: 1800 });
}

function loading(title) {
  wx.showLoading({ title: title || '加载中', mask: true });
}

function hideLoading() {
  try {
    wx.hideLoading();
  } catch (e) {
    /* ignore */
  }
}

function confirm(content, title) {
  return new Promise((resolve) => {
    wx.showModal({
      title: title || '确认',
      content: content || '',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    });
  });
}

function vibrate(type) {
  try {
    wx.vibrateShort({ type: type || 'light' });
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  pad,
  dateStr,
  timeStr,
  fromNow,
  shorten,
  toast,
  loading,
  hideLoading,
  confirm,
  vibrate
};
