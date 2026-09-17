const { LAYOUT } = require('./theme.js');

/**
 * 屏幕适配。
 *
 * 小游戏只有一个上屏画布，尺寸必须自己算。这里的做法是**用设计稿坐标画图**：
 * 所有布局代码都按 750 宽的设计稿写（和 rpx 一个尺度），
 * 由这里统一把 ctx 缩放好，所以 draw 代码里不需要关心设备分辨率。
 *
 * 关键点：
 *  - canvas.width/height 设成 物理像素（逻辑尺寸 × pixelRatio），否则高清屏发虚；
 *  - ctx.scale(scale × dpr) 之后，坐标空间就等于 750 宽的设计稿；
 *  - 安全区（刘海/底部横条）通过 safeTop / safeBottom 暴露给场景自己留白；
 *  - ⚠️ **右上角的胶囊按钮**（更多/关闭）是原生控件，画在所有内容之上。
 *    只避开"刘海"是不够的 —— 胶囊通常会一直延伸到刘海下方，
 *    所以内容的上边界要用 safeTop 和胶囊底边的**较大值**，这个值就是 contentTop。
 */

/**
 * 屏幕信息从哪来的。
 *
 * 为什么要记这个：小游戏的桥（jsbridge）在**启动那一瞬间可能还没就绪**，
 * 开发者工具里尤其明显（控制台会打 `[jsbridge] invoke getSystemInfo fail: jsbridge not ready`）。
 * 这时候任何一个系统信息 API 都会抛，我们只能用一个兜底尺寸 ——
 * 而"用错尺寸"是静默事故：画面看着能用，其实底部被裁掉、胶囊位置也算错了。
 * 所以把来源记下来，让启动日志能自证，也让 boot 知道该不该补测一次。
 */
const SOURCE = {
  windowInfo: 'windowInfo', // wx.getWindowInfo（2.20.1+，推荐）
  systemInfo: 'systemInfo', // wx.getSystemInfoSync（老 API，兜底）
  fallback: 'fallback' // 两个都拿不到 → 用的是写死的尺寸
};

function getWindowInfo() {
  // 两个 API **分开 try**：以前写在一个 try 里，getWindowInfo 一抛就直接跳到 catch，
  // 连 getSystemInfoSync 兜底的机会都没有了。
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const info = wx.getWindowInfo();
      if (info && info.windowWidth && info.windowHeight) {
        return Object.assign({ source: SOURCE.windowInfo }, info);
      }
    }
  } catch (e) {
    /* 桥还没就绪，往下试老 API */
  }
  try {
    if (typeof wx.getSystemInfoSync === 'function') {
      const info = wx.getSystemInfoSync();
      if (info && info.windowWidth && info.windowHeight) {
        return Object.assign({ source: SOURCE.systemInfo }, info);
      }
    }
  } catch (e) {
    /* 还是不行，只能兜底 */
  }
  // 兜底：真机上不会走到，启动瞬间桥没就绪时才会
  return {
    source: SOURCE.fallback,
    windowWidth: 375,
    windowHeight: 812,
    pixelRatio: 2,
    safeArea: null,
    statusBarHeight: 20
  };
}

/**
 * 胶囊按钮的位置。它不受 safeArea 影响，必须单独取。
 * 低版本或异常时返回 null，调用方退回"只按安全区算"。
 */
function getCapsule() {
  try {
    if (typeof wx.getMenuButtonBoundingClientRect !== 'function') return null;
    const r = wx.getMenuButtonBoundingClientRect();
    if (!r || !isFinite(r.bottom) || r.bottom <= 0) return null;
    return r;
  } catch (e) {
    return null;
  }
}

function create(canvas) {
  const info = getWindowInfo();
  const dpr = Math.max(1, Math.min(3, info.pixelRatio || 2));
  const cssWidth = info.windowWidth || 375;
  const cssHeight = info.windowHeight || 812;

  // 画布后备存储用物理像素，避免高清屏模糊
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  const scale = cssWidth / LAYOUT.designWidth; // 设计稿 → 逻辑像素
  const ctx = canvas.getContext('2d');
  ctx.scale(scale * dpr, scale * dpr);

  const safe = info.safeArea || null;
  const safeTop = safe ? Math.max(safe.top, info.statusBarHeight || 0) / scale : LAYOUT.safeTopMin;
  const safeBottom = safe ? (cssHeight - (safe.bottom || cssHeight)) / scale : 0;

  // 胶囊：换到设计稿坐标
  const cap = getCapsule();
  const capsule = cap
    ? {
        width: cap.width / scale,
        height: cap.height / scale,
        top: cap.top / scale,
        bottom: cap.bottom / scale,
        right: cap.right / scale,
        left: cap.left / scale
      }
    : null;

  // 内容上边界：取安全区顶部和胶囊底边的较大值，再加一点呼吸空间。
  // 场景里凡是"贴着顶部的标题/工具栏"都应该从 contentTop 开始，而不是 safeTop。
  const contentTop = Math.max(safeTop, capsule ? capsule.bottom : 0);

  return {
    canvas,
    ctx,
    dpr,
    scale,
    /** 屏幕信息来自哪个 API（windowInfo / systemInfo / fallback） */
    source: info.source || SOURCE.fallback,
    /** 是否真的量到了屏幕。false 表示用的是兜底尺寸，应当找机会补测（见 stage.reapply） */
    measured: (info.source || SOURCE.fallback) !== SOURCE.fallback,
    // 设计稿坐标系下的屏幕尺寸（场景里的宽高全用它）
    width: LAYOUT.designWidth,
    height: cssHeight / scale,
    safeTop,
    safeBottom,
    /** 内容可用的上边界（已避开胶囊按钮） */
    contentTop,
    /** 胶囊按钮在设计稿坐标里的位置；没有则为 null */
    capsule,
    /** 右上角胶囊左侧的 x：标题/操作区不该越过这条线 */
    contentRight: capsule ? capsule.left : LAYOUT.designWidth,
    cssWidth,
    cssHeight,
    // 设计稿坐标 → 逻辑像素（给需要和原生 API 交互的地方用，比如键盘）
    toCss(designValue) {
      return designValue * scale;
    },
    toDesign(cssValue) {
      return cssValue / scale;
    }
  };
}

module.exports = { create, getWindowInfo, getCapsule, SOURCE };
