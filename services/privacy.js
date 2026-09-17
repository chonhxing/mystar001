/**
 * 微信隐私授权（wx.onNeedPrivacyAuthorization）。
 *
 * 官方规则（基础库 2.32.3+）：
 *   - 注册了 onNeedPrivacyAuthorization 的监听，就进入「自定义隐私弹窗模式」：
 *     调用隐私相关接口（如 wx.createUserInfoButton 触发的头像昵称授权）时，
 *     平台不弹统一弹窗，而是触发我们这里的回调；
 *   - **必须调用 resolve**（{ event: 'agree' | 'disagree' }），否则隐私接口会一直挂起；
 *   - 必须在**用户点击**时调用 resolve（所以 resolve 挂在弹窗按钮的 tap 上）；
 *   - 未注册监听时平台自己弹统一弹窗（我们注册了，所以用自己的，界面才统一）。
 *
 * 本模块与 UI 解耦：boot 里调 setup() 注册监听；弹窗层（ui/agreement.js）
 * 把「怎么展示、用户点了哪个」通过 registerPresenter 接进来。
 * 这样在测试里也能用假 wx 完整走一遍授权流程。
 */

const { CONFIG } = require('../config/index.js');

let pendingResolves = [];
let presenter = null; // UI 注册的展示器：fn({resolve}) -> 由 UI 弹窗并在按钮 tap 时调用 resolve
let supported = false;

/** 展示器接口：UI 层注册一个函数，需要授权时会被调用 */
function registerPresenter(fn) {
  presenter = typeof fn === 'function' ? fn : null;
}

function setup() {
  if (supported) return;
  if (typeof wx === 'undefined' || typeof wx.onNeedPrivacyAuthorization !== 'function') return;
  supported = true;
  wx.onNeedPrivacyAuthorization((resolve) => {
    pendingResolves.push(resolve);
    if (presenter) {
      // 触发 UI 弹隐私授权窗；按钮 tap 时 UI 会调 agree()/disagree()
      presenter();
    } else {
      // UI 还没接好（理论上不会发生）：兜底直接同意，避免隐私接口挂死
      flush('agree');
    }
  });
}

/** 用户点了「同意」：把挂起的 resolve 全部按同意处理 */
function agree() {
  flush('agree');
}

/** 用户点了「拒绝」：隐私接口会返回 fail（API:fail privacy permission is not authorized） */
function disagree() {
  flush('disagree');
}

function flush(event) {
  const list = pendingResolves;
  pendingResolves = [];
  list.forEach((resolve) => {
    try {
      resolve({ event });
    } catch (e) {
      /* 平台内部处理，忽略 */
    }
  });
}

/** 是否有挂起的授权请求（UI 用来决定要不要弹窗） */
function hasPending() {
  return pendingResolves.length > 0;
}

/** 打开官方隐私保护指引（可读全文），老基础库没有这个 API 时静默 */
function openContract() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({});
    }
  } catch (e) {
    /* 老版本忽略 */
  }
}

/** 查询是否需要隐私授权（没有这个 API 的旧基础库返回 false = 不需要处理） */
function getSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.getPrivacySetting !== 'function') {
      resolve({ needAuthorization: false, unsupported: true });
      return;
    }
    wx.getPrivacySetting({
      success: (res) => resolve({ needAuthorization: !!res.needAuthorization, raw: res }),
      fail: () => resolve({ needAuthorization: false, failed: true })
    });
  });
}

/**
 * 主动触发一次隐私检查（wx.requirePrivacyAuthorize）。
 * 已同意 → success；未同意且注册了监听 → 走我们的弹窗流程。
 * 用于登录前把授权前置，避免"点了登录才弹窗"的割裂感。
 */
function requireAuthorize() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.requirePrivacyAuthorize !== 'function') {
      // 没有这个 API 的基础库：假定已授权（平台会自己兜底）
      resolve({ ok: true, unsupported: true });
      return;
    }
    wx.requirePrivacyAuthorize({
      success: () => resolve({ ok: true }),
      fail: () => resolve({ ok: false })
    });
  });
}

function isSupported() {
  return supported;
}

module.exports = {
  setup,
  registerPresenter,
  agree,
  disagree,
  hasPending,
  openContract,
  getSetting,
  requireAuthorize,
  isSupported,
  // 测试用
  _reset() {
    pendingResolves = [];
    presenter = null;
    supported = false;
  }
};

// 引用 CONFIG 是为了和项目其它模块保持一致的口径：将来如果要加
// 「隐私弹窗只在正式版弹」这类开关，就放 CONFIG 里，这里读它。
void CONFIG;
