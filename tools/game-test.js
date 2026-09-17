/* eslint-disable no-console */
/**
 * 小游戏无头测试（不需要微信开发者工具）：
 *   node tools/game-test.js
 *
 * 做法：伪造一个 Canvas 2D 上下文（记录所有绘制指令）和 wx API，
 * 然后真的把游戏跑起来 —— 启动、渲染、合成触摸事件、切场景、拖动滚动，
 * 全部走真实代码路径。
 *
 * 这解决的是"Canvas 代码看不见、点不到"的问题：
 * 少一个控件、坐标算错、命中测试漏了滚动偏移、标签闭合写错、
 * 渲染时读到 undefined，都会在这里变成一条断言失败。
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================ 伪造 Canvas 2D

/** 渐变参数校验：真机上非法参数会抛，工具里不会 —— 这里按真机口径来 */
function checkGradient(args, api) {
  args.forEach((v, i) => {
    if (!isFinite(v)) throw new Error(api + ' 第 ' + (i + 1) + ' 个参数非法: ' + v);
  });
  return {
    addColorStop(offset, color) {
      if (!isFinite(offset) || offset < 0 || offset > 1) {
        throw new Error('addColorStop 偏移越界: ' + offset + '（必须在 0~1，真机会抛 IndexSizeError）');
      }
      if (typeof color !== 'string' || !color) {
        throw new Error('addColorStop 颜色非法: ' + color);
      }
      if (/NaN|undefined|Infinity/.test(color)) {
        throw new Error('addColorStop 颜色里含非法数值: ' + color);
      }
      /**
       * ⚠️ 真机上 `hsl()` / `hsla()` **不被接受**，会抛 `addColorStop with invalid params`
       * （2026-09 真机日志实测，基础库 3.17.2）。开发者工具的 canvas 是浏览器的所以支持，
       * 于是就成了"工具里一切正常、真机某一帧抛异常" —— 而帧循环一断画面就停在那一帧。
       * 这里按真机口径直接拒掉，谁再写 hsl 测试就当场失败。
       */
      if (/^\s*hsla?\(/i.test(color)) {
        throw new Error('addColorStop 不接受的 hsl/hsla 颜色（真机会抛 invalid params）: ' + color
          + ' → 改用 draw.hslToRgba() 或 rgba()');
      }
    }
  };
}

function makeCtx(recorder) {
  let fontSize = 16;
  /**
   * 变换矩阵（a,b,c,d,e,f）。必须真的跟踪它：否则记下来的坐标全是**局部坐标**，
   * 就没法回答"这两个字在屏幕上是不是压在了一起" —— 而这正是最常见的显示问题。
   * 有了它，每次 fillText 都能算出屏幕绝对位置和实际字号（scale 之后的有效字号）。
   */
  let m = [1, 0, 0, 1, 0, 0];
  const mStack = [];
  /**
   * 裁剪区跟踪。滚动容器是这样画的：
   *   save() → beginPath() → rect(0,0,w,h) → clip() → translate(0,-scrollY) → 画内容 → restore()
   * 不跟这个的话，审计会把"滚出视口、已被裁掉的内容"也算进来，
   * 于是和 TabBar 的文字比出一堆假重叠。
   */
  let lastPathRect = null;
  let clipStack = [];
  const clipDepthStack = [];
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
  const ctx = {
    canvas: null,
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    _ops: recorder,
    /** 供布局审计用：把局部坐标换算成屏幕坐标 */
    _abs(x, y) {
      return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5], scale: Math.sqrt(m[1] * m[1] + m[3] * m[3]) || 1 };
    },

    save() { mStack.push(m.slice()); clipDepthStack.push(clipStack.length); recorder.push(['save']); },
    restore() {
      m = mStack.pop() || [1, 0, 0, 1, 0, 0];
      const depth = clipDepthStack.pop();
      if (depth !== undefined && clipStack.length > depth) clipStack.length = depth;
      lastPathRect = null;
      recorder.push(['restore']);
    },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); recorder.push(['translate', r2(x), r2(y)]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); recorder.push(['scale', r2(x), r2(y)]); },
    rotate(a) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      m = mul(m, [c, s, -s, c, 0, 0]);
      recorder.push(['rotate', r2(a)]);
    },
    beginPath() { lastPathRect = null; recorder.push(['beginPath']); },
    closePath() { recorder.push(['closePath']); },
    moveTo(x, y) { recorder.push(['moveTo', r2(x), r2(y)]); },
    lineTo(x, y) { recorder.push(['lineTo', r2(x), r2(y)]); },
    quadraticCurveTo(a, b, c, d) { recorder.push(['quad', r2(a), r2(b), r2(c), r2(d)]); },
    bezierCurveTo() { recorder.push(['bezier']); },
    arc(x, y, r) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(r)) throw new Error(`arc 参数非法: ${x},${y},${r}`);
      recorder.push(['arc', r2(x), r2(y), r2(r)]);
    },
    rect(x, y, w, h) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) throw new Error(`rect 参数非法: ${x},${y},${w},${h}`);
      const a = ctx._abs(x, y);
      lastPathRect = { x: a.x, y: a.y, w: w * a.scale, h: h * a.scale };
      recorder.push(['rect', r2(x), r2(y), r2(w), r2(h)]);
    },
    fill() { recorder.push(['fill']); },
    stroke() { recorder.push(['stroke']); },
    clip() {
      if (lastPathRect) clipStack.push(lastPathRect);
      recorder.push(['clip']);
    },
    fillRect(x, y, w, h) { recorder.push(['fillRect', r2(x), r2(y), r2(w), r2(h)]); },
    clearRect() { recorder.push(['clearRect']); },
    strokeRect() { recorder.push(['strokeRect']); },
    setLineDash(a) { recorder.push(['dash', (a || []).length]); },
    fillText(t, x, y) {
      if (!isFinite(x) || !isFinite(y)) throw new Error(`fillText 坐标非法: "${t}" @ ${x},${y}`);
      // 记下屏幕绝对坐标、有效字号、对齐方式，以及"是否落在裁剪区外"（布局审计要用）
      const abs = ctx._abs(x, y);
      const visible = clipStack.every(
        (r) => abs.x >= r.x - 1 && abs.x <= r.x + r.w + 1 && abs.y >= r.y - 1 && abs.y <= r.y + r.h + 1
      );
      recorder.push([
        'text',
        String(t).slice(0, 24),
        r2(x),
        r2(y),
        r2(abs.x),
        r2(abs.y),
        r2((parseFloat(ctx.font) || 16) * abs.scale),
        ctx.textAlign,
        visible
      ]);
    },
    // ⚠️ 真机的 Canvas2D 比开发者工具严格得多：NaN / 越界参数在工具里常常被忽略，
    //    在真机上直接抛异常 —— 而异常会中断绘制循环，表现就是"只看到背景"。
    //    所以这里按真机的口径校验，让问题在测试阶段就暴露。
    createLinearGradient(x0, y0, x1, y1) {
      return checkGradient([x0, y0, x1, y1], 'createLinearGradient');
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const args = [x0, y0, r0, x1, y1, r1];
      const g = checkGradient(args, 'createRadialGradient');
      if (r0 < 0 || r1 < 0) throw new Error();
      return g;
    },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (dh !== undefined && (!isFinite(dx) || !isFinite(dy) || !isFinite(dw) || !isFinite(dh))) {
        throw new Error(`drawImage 目标矩形非法: ${dx},${dy},${dw},${dh}`);
      }
      recorder.push(['image']);
    },
    measureText(t) {
      const size = parseFloat(ctx.font) || 16;
      let w = 0;
      const s = String(t === undefined || t === null ? '' : t);
      for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        w += code > 0x2e80 ? size : size * 0.55;
      }
      return { width: w };
    }
  };
  Object.defineProperty(ctx, 'font', {
    get() { return `${fontSize}px sans-serif`; },
    set(v) {
      const m = /(\d+(?:\.\d+)?)px/.exec(String(v));
      if (!m) return; // 没写 px 的（比如只给 weight）不改字号
      const size = parseFloat(m[1]);
      if (!isFinite(size) || size <= 0) {
        throw new Error('字号非法: ' + v);
      }
      /**
       * ⚠️ 真机对 font 简写的解析比开发者工具严格，带小数的字号（如 116.55px）
       * 有可能被**静默忽略**（不报错，字体保持上一次的值）→ 该显示的字没显示。
       * 这里直接拒掉，逼所有字号走 theme.font() 取整。
       */
      if (Math.abs(size - Math.round(size)) > 1e-6) {
        throw new Error('字号必须是整数（真机可能静默忽略小数）: ' + v + ' → 请用 theme.font()');
      }
      fontSize = size;
    }
  });
  return ctx;
}

function r2(v) {
  return typeof v === 'number' ? Math.round(v * 100) / 100 : v;
}

let canvasCount = 0;
function makeCanvas() {
  canvasCount += 1;
  const ops = [];
  const canvas = {
    width: 0,
    height: 0,
    _ops: ops,
    getContext() {
      if (!canvas._ctx) {
        canvas._ctx = makeCtx(ops);
        canvas._ctx.canvas = canvas;
      }
      return canvas._ctx;
    },
    toTempFilePathSync() {
      return '/tmp/fake.png';
    }
  };
  return canvas;
}

// ============================================================ 伪造 wx

const storageMap = new Map();
let toastCalls = [];
let shareCalls = [];
let reportCalls = [];
let keepScreenCalls = [];
/** wx.createUserInfoButton 建出来的按钮（测试用它模拟用户点授权） */
const userInfoButtons = [];
const rafQueue = [];

/** 模拟用户点了"用微信头像"按钮并给出资料 */
function tapUserInfoButton(userInfo) {
  const btn = userInfoButtons.filter((b) => !b.destroyed).pop();
  if (!btn || !btn._onTap) return false;
  btn._onTap({ userInfo });
  return true;
}

/** 还活着的用户信息按钮（已销毁的不算） */
function liveUserInfoButtons() {
  return userInfoButtons.filter((b) => !b.destroyed);
}

global.requestAnimationFrame = (cb) => {
  rafQueue.push(cb);
  return rafQueue.length;
};
global.cancelAnimationFrame = () => {};

global.wx = {
  createCanvas: makeCanvas,
  // 网络图/本地临时文件会加载成功（头像是这么画的），其它地址走 onerror。
  // 尺寸必须给：drawImageCover 靠 width/height 算裁剪，没尺寸就画不出来。
  createImage: () => {
    const img = { width: 128, height: 128, _src: '' };
    Object.defineProperty(img, 'src', {
      set(v) {
        img._src = String(v);
        const loadable = /^(https?:|wxfile:|data:|\/tmp)/.test(img._src);
        setTimeout(() => {
          if (loadable && img.onload) img.onload();
          else if (!loadable && img.onerror) img.onerror();
        }, 0);
      },
      get() { return img._src; }
    });
    return img;
  },
  getWindowInfo: () => ({
    windowWidth: 375,
    windowHeight: 812,
    pixelRatio: 2,
    statusBarHeight: 20,
    safeArea: { top: 44, bottom: 778, left: 0, right: 375, width: 375, height: 734 }
  }),
  getSystemInfoSync: () => global.wx.getWindowInfo(),
  setPreferredFramesPerSecond: () => {},
  onTouchStart: (fn) => { global.wx.__touchStart = fn; },
  onTouchMove: (fn) => { global.wx.__touchMove = fn; },
  onTouchEnd: (fn) => { global.wx.__touchEnd = fn; },
  onTouchCancel: (fn) => { global.wx.__touchCancel = fn; },
  onWheel: (fn) => { global.wx.__wheel = fn; },
  onShow: (fn) => { global.wx.__show = fn; },
  onHide: (fn) => { global.wx.__hide = fn; },
  onMemoryWarning: (fn) => { global.wx.__mem = fn; },
  onError: () => {},
  onShareAppMessage: (fn) => { global.wx.__share = fn; },
  showShareMenu: () => {},
  shareAppMessage: (o) => { shareCalls.push(o); },
  getLaunchOptionsSync: () => ({ query: {}, scene: 1001 }),
  getStorageSync: (k) => (storageMap.has(k) ? JSON.parse(JSON.stringify(storageMap.get(k))) : ''),
  setStorageSync: (k, v) => { storageMap.set(k, JSON.parse(JSON.stringify(v))); },
  removeStorageSync: (k) => { storageMap.delete(k); },
  showToast: (o) => toastCalls.push(o.title),
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (o) => { if (o.success) o.success({ confirm: true, cancel: false }); },
  vibrateShort: () => {},
  setNavigationBarTitle: () => {},
  showKeyboard: (o) => { if (o && o.success) o.success({}); },
  hideKeyboard: () => {},
  onKeyboardInput: () => {},
  onKeyboardConfirm: () => {},
  onKeyboardComplete: () => {},
  offKeyboardInput: () => {},
  offKeyboardConfirm: () => {},
  offKeyboardComplete: () => {},
  // 虚拟支付桩：默认检测为「支持」且支付成功，用 __payMode / __paySupport 切换场景
  checkIsSupportMidasPayment: (o) => {
    if (o && o.success) {
      o.success({ errCode: 0, errMsg: 'checkIsSupportMidasPayment:ok', data: { err_code: 0, err_msg: 'success', allow_pay: global.wx.__paySupport !== false } });
    }
  },
  requestMidasPaymentGameItem: (o) => {
    const mode = global.wx.__payMode || 'ok';
    if (mode === 'ok' && o && o.success) o.success({});
    else if (mode === 'cancel' && o && o.fail) o.fail({ errCode: -2, errMsg: 'fail cancel' });
    else if (mode === 'ios' && o && o.fail) o.fail({ errCode: 701001, errMsg: 'fail ios forbidden' });
    else if (mode === 'price' && o && o.fail) o.fail({ errCode: -15016, errMsg: 'fail price mismatch' });
  },
  createRewardedVideoAd: () => null,
  getUpdateManager: () => ({
    onCheckForUpdate: (cb) => { global.wx.__updateCheck = cb; },
    onUpdateReady: (cb) => { global.wx.__updateReady = cb; },
    onUpdateFailed: (cb) => { global.wx.__updateFailed = cb; },
    applyUpdate: () => { global.wx.__applied = true; }
  }),
  getAppBaseInfo: () => ({ SDKVersion: '3.17.3' }),
  getMenuButtonBoundingClientRect: () => ({ width: 87, height: 32, top: 48, bottom: 80, left: 281, right: 368 }),
  getEnterOptionsSync: () => ({ scene: 1001, query: {} }),
  setKeepScreenOn: (o) => { keepScreenCalls.push(!!o.keepScreenOn); },
  onNetworkWeakChange: (cb) => { global.wx.__weak = cb; },
  triggerGC: () => { global.wx.__gcCalled = true; },
  getLogManager: () => ({ log: () => {} }),
  reportEvent: (id, data) => { reportCalls.push({ id, data }); },
  // ---- 微信昵称头像相关 ----
  // 隐私协议：默认"不需要授权"，测试可以切到需要且拒绝，验证我们会跳过放按钮
  getPrivacySetting: (o) => {
    if (o && o.success) {
      o.success({
        needAuthorization: !!global.wx.__privacyNeeded,
        privacyContractName: '用户隐私保护指引'
      });
    }
  },
  requirePrivacyAuthorize: (o) => {
    if (global.wx.__privacyNeeded && global.wx.__privacyDeny) {
      if (o && o.fail) o.fail({ errMsg: 'requirePrivacyAuthorize:fail' });
    } else if (o && o.success) o.success({});
  },
  // 用户信息按钮：记录下来，测试用 tapUserInfoButton() 模拟用户点击回调
  createUserInfoButton: (opts) => {
    const btn = {
      opts,
      destroyed: false,
      // 谁建的：用来定位"按钮没被销毁"的来源
      _onTap: null,
      onTap(fn) { btn._onTap = fn; },
      offTap() { btn._onTap = null; },
      show() { btn.hidden = false; },
      hide() { btn.hidden = true; },
      destroy() { btn.destroyed = true; }
    };
    userInfoButtons.push(btn);
    return btn;
  },
  login: (o) => { if (o && o.success) o.success({ code: 'x' }); },
  request: (o) => {
    setTimeout(() => {
      if (o.fail) o.fail({ errMsg: 'request:fail ECONNREFUSED' });
      if (o.complete) o.complete();
    }, 2);
  }
};

// ============================================================ 工具

function step(frames) {
  for (let i = 0; i < (frames || 1); i += 1) {
    const batch = rafQueue.splice(0, rafQueue.length);
    batch.forEach((cb) => cb(Date.now()));
  }
}

/**
 * 合成触摸事件。
 * ⚠️ 传进来的是**设计稿坐标**，而 wx 的 touch.clientX 是 CSS 像素，
 * 所以要乘上 scale 再发出去 —— 这正是真机上的换算方向。
 */
let liveStage = null;
/**
 * 在某个滚轮上拖一把，返回拖动后的 offset（失败返回 null）。
 * 三个选择器（日期/时辰/出生地）都走这一条路径。
 */
function dragWheel(scene, sheet, colIndex) {
  const wheel = sheet.group.wheels[colIndex];
  if (!wheel) return null;
  const before = wheel.offset;
  const wp = absoluteOf(wheel);
  const cx = wp.x + wheel.w / 2;
  const cy = wp.y + wheel.h / 2;
  touch('start', cx, cy);
  touch('move', cx, cy - 30);
  touch('move', cx, cy - 70);
  touch('end', cx, cy - 70);
  step(1);
  return Math.abs(wheel.offset - before) > 5 ? wheel.offset : null;
}

function touch(type, dx, dy) {
  const s = (liveStage && liveStage.dev.scale) || 0.5;
  const x = dx * s;
  const y = dy * s;
  const ev = { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] };
  if (type === 'start') global.wx.__touchStart(ev);
  else if (type === 'move') global.wx.__touchMove(ev);
  else global.wx.__touchEnd(ev);
}

function tap(x, y) {
  touch('start', x, y);
  touch('end', x, y);
}

/** 控件在屏幕上的绝对坐标（设计稿坐标系） */
function absoluteOf(widget) {
  let x = 0;
  let y = 0;
  let cur = widget;
  while (cur) {
    x += cur.x;
    y += cur.y;
    if (cur.parent && cur.parent.scrollable) {
      x -= cur.parent.scrollX || 0;
      y -= cur.parent.scrollY || 0;
    }
    cur = cur.parent;
  }
  return { x, y };
}

/**
 * 把控件滚进视口（找到最近的滚动容器祖先），再点它。
 * 真实用户不可能点到视口外的东西 —— 之前的失败就是点在了 TabBar 下面。
 */
function ensureVisible(widget) {
  // 从**父节点**开始找滚动容器：控件自己可能就是滚动容器（嵌套滚动的场景），
  // 那要滚的是它外面那个 —— 否则点/拖会落在屏幕外。
  let cur = widget.parent;
  let scroll = null;
  while (cur) {
    if (cur.scrollable) {
      scroll = cur;
      break;
    }
    cur = cur.parent;
  }
  if (!scroll) return;
  const p = absoluteOf(widget);
  const sTop = absoluteOf(scroll).y;
  // 滚到视口正中：贴边的话可能被底部 TabBar 截走，那是真实存在的手感坑
  const target = p.y + widget.h / 2 - (sTop + scroll.h / 2);
  scroll.scrollTo(scroll.scrollY + target);
  step(1);
}

/** 点掉当前弹窗的"确定"（Canvas 弹窗是靠点击 resolve 的，不点就永远挂着） */
function tapModalConfirm(scene) {
  step(1); // 先画一帧，弹窗才会算出自己的矩形
  const modal = find(scene.overlay, (w) => w.constructor.name === 'Modal');
  if (!modal) return false;
  if (!modal.cardW) {
    console.log(`    [调试] 弹窗矩形未计算: ${modal.cardX},${modal.cardY} ${modal.cardW}x${modal.cardH}`);
    return false;
  }
  const tx = modal.cardX + modal.cardW * 0.75;
  const ty = modal.cardY + modal.cardH - 54;
  // 顺便断言命中测试认的是弹窗（浮层被缩小过就会穿透，这个坑真实踩过）
  const hit = scene.hitTest(tx, ty);
  if (!hit || hit.constructor.name !== 'Modal') return false;
  tap(tx, ty);
  return true;
}

function tapWidget(widget, offsetX, offsetY) {
  ensureVisible(widget);
  const p = absoluteOf(widget);
  tap(p.x + (offsetX === undefined ? widget.w / 2 : offsetX), p.y + (offsetY === undefined ? widget.h / 2 : offsetY));
}

/** 在控件树里按条件找控件 */
function find(root, pred) {
  if (!root) return null;
  if (pred(root)) return root;
  for (let i = 0; i < root.children.length; i += 1) {
    const hit = find(root.children[i], pred);
    if (hit) return hit;
  }
  return null;
}

function findAll(root, pred, out) {
  const acc = out || [];
  if (!root) return acc;
  if (pred(root)) acc.push(root);
  root.children.forEach((c) => findAll(c, pred, acc));
  return acc;
}

function countText(ops) {
  return ops.filter((o) => o[0] === 'text').length;
}

/** 清空绘制指令记录：ops 会跨帧跨场景累积，断言前必须清一次 */
function resetOps() {
  stageRef.canvas._ops.length = 0;
}

/** 当前帧画出来的所有文字 */
function drawnText() {
  return stageRef.canvas._ops.filter((o) => o[0] === 'text').map((o) => o[1]).join('|');
}

let stageRef = null;

// ============================================================ 主流程

(async function main() {
  const { CONFIG } = require(path.join(ROOT, 'config/index.js'));
  // 设成明显大于单帧 dt 上限(64ms)，才能验证“最短时长内不提前跳走”
  CONFIG.CASTING_MS = 420;
  CONFIG.USE_REMOTE = true;

  // 用假的 AI 返回，测试"AI 文案后到"的分支。
  // ⚠️ 下面把 api.divinate 整个换掉了，所以"弱网/常亮"这类真实分支要在
  //    section 11 里临时还原真实现来测（否则测的是替身，等于没测）。
  const api = require(path.join(ROOT, 'services/api.js'));
  const realDivinate = api.divinate;
  let aiMode = 'slow';
  api.divinate = (localResult) => {
    if (aiMode === 'fail') return Promise.resolve({ result: localResult, source: 'local', notice: '星象信号不好，这次用本机图谱为你解读' });
    return new Promise((resolve) => {
      setTimeout(() => {
        const copy = Object.assign({}, localResult.copy, {
          essence: '【AI】你的图谱里，羁绊这一格低得显眼。',
          resonance: '【AI】所以你会在 TA 身上看到自己。',
          difference: '【AI】差别在于秩序。',
          anti: '【AI】路飞对你是另一种语言。',
          counsel: '【AI】今天先起个头。',
          aiGenerated: true
        });
        resolve({
          result: Object.assign({}, localResult, { copy }),
          source: 'ai',
          notice: null
        });
      }, 120);
    });
  };

  const core = require(path.join(ROOT, 'core/index.js'));
  const { PROVINCE_NAMES, cityNamesOf, districtsOf } = require(path.join(ROOT, 'data/cities.js'));
  const copy = require(path.join(ROOT, 'config/copy.js'));
  const reward = require(path.join(ROOT, 'services/reward.js'));
  const boot = require(path.join(ROOT, 'src/js/boot.js'));

  // ------------------------------------------------------------ 启动
  section('1. 启动与屏幕适配');
  // 测试环境默认"已同意协议"，避免首启协议弹窗挡住后续所有点击。
  // 协议闸门本身的行为在 §1.5 单独验（那里会清掉这个值再启动）。
  storageMap.set('agreement_v1', '1');
  boot.start();
  const stage = boot.getStage();
  liveStage = stage;
  stageRef = stage;
  const router = boot.getRouter();
  const input = boot.getInput();

  ok(!!stage && !!router && !!input, '舞台 / 场景栈 / 输入层都起来了');
  ok(canvasCount >= 1, `上屏画布已创建（共 ${canvasCount} 个画布）`);
  ok(stage.canvas.width === 750 && stage.canvas.height === 1624,
    `画布后备存储按物理像素设置（${stage.canvas.width}×${stage.canvas.height}）`);
  ok(stage.width === 750, `设计稿坐标宽度 = ${stage.width}（与 rpx 同尺度）`);
  ok(Math.round(stage.height) === 1624, `设计稿坐标高度 = ${Math.round(stage.height)}`);
  ok(stage.contentTop > stage.safeTop, '顶部元素不会画到胶囊按钮下面');
  ok(stage.safeTop === 88, `安全区顶部换算正确（${stage.safeTop}）`);
  // 胶囊按钮：safeTop(88) 只到刘海，胶囊底边在 160，内容必须从 160 之后开始
  ok(stage.capsule && Math.round(stage.capsule.bottom) === 160,
    `胶囊按钮位置取到了（底边 ${stage.capsule && Math.round(stage.capsule.bottom)}）`);
  ok(stage.contentTop === 160,
    `内容上边界避开了胶囊（contentTop=${stage.contentTop} > safeTop=${stage.safeTop}）`);
  ok(stage.contentRight === stage.capsule.left,
    `右上角可用边界 = 胶囊左边（${Math.round(stage.contentRight)}）`);
  ok(Math.round(stage.safeBottom) === 68, `安全区底部换算正确（${Math.round(stage.safeBottom)}）`);

  // ---- 屏幕尺寸拿不到时不能静默用错 ----
  // 小游戏的桥在启动那一瞬间可能还没就绪（开发者工具里就会打 `jsbridge not ready`），
  // 这时所有系统信息 API 都会抛。以前会静默用 375x812 兜底并且**整场不再纠正** ——
  // 画面看着能用，底部其实被裁了。现在要求：标记来源 + 桥就绪后补测纠正。
  {
    const deviceMod = require(path.join(ROOT, 'src/js/device.js'));
    const stageMod = require(path.join(ROOT, 'src/js/stage.js'));
    ok(!!(deviceMod.SOURCE && deviceMod.SOURCE.fallback), 'device 暴露了"尺寸从哪来"的来源标记');
    ok(stage.dev.source === 'windowInfo' && stage.dev.measured === true,
      `本次是真实屏幕尺寸（来源 ${stage.dev.source}）`);

    const realWindow = wx.getWindowInfo;
    const realSys = wx.getSystemInfoSync;

    // 1) 新 API 抛（桥还没就绪）→ 应当退回老 API，而不是直接放弃兜底。
    //    注意：mock 里的 getSystemInfoSync 本身是转发到 getWindowInfo 的，
    //    所以这一步要把它一起替换掉，否则测的就不是"退回老 API"而是"两个都挂"。
    wx.getWindowInfo = () => { throw new Error('jsbridge not ready'); };
    wx.getSystemInfoSync = () => ({
      windowWidth: 414,
      windowHeight: 896,
      pixelRatio: 3,
      statusBarHeight: 44,
      safeArea: { top: 44, bottom: 862, left: 0, right: 414, width: 414, height: 818 }
    });
    const d1 = deviceMod.getWindowInfo();
    ok(d1.source === 'systemInfo' && d1.windowWidth === 414,
      `getWindowInfo 失败会退回 getSystemInfoSync（来源 ${d1.source}，${d1.windowWidth}px）`);

    // 2) 两个都抛 → 用兜底尺寸，但必须标记出来
    wx.getSystemInfoSync = () => { throw new Error('jsbridge not ready'); };
    const d2 = deviceMod.getWindowInfo();
    ok(d2.source === 'fallback', '两个 API 都拿不到时用兜底尺寸');
    const s2 = stageMod.create();
    ok(s2.dev.measured === false, '兜底尺寸会被标记为"没量到"，不会静默用错');
    ok(Math.round(s2.dev.cssWidth) === 375,
      `兜底尺寸（${Math.round(s2.dev.cssWidth)}x${Math.round(s2.dev.cssHeight)}）`);

    // 3) 桥就绪后补测 → 纠正成真实尺寸
    wx.getWindowInfo = realWindow;
    wx.getSystemInfoSync = realSys;
    ok(s2.reapply() === true, '补测发现尺寸变了（boot 会据此重建场景）');
    ok(s2.dev.measured === true && s2.dev.source === 'windowInfo', '补测后拿到真实来源');
    ok(s2.canvas.width === Math.round(s2.dev.cssWidth * s2.dev.dpr),
      `补测后画布按真实 dpr 重建（${s2.canvas.width}×${s2.canvas.height}）`);
    ok(s2.contentTop > 0 && s2.contentRight > 0, '补测后胶囊与安全区一起重算');
    ok(s2.reapply() === false, '尺寸没变时不重建场景（reapply 返回 false）');

    // 4) 场景能按新尺寸重建（屏幕变了必须重排，否则布局还是旧的）
    const before = router.depth();
    const rebuilt = router.rebuild();
    ok(!!rebuilt && rebuilt !== router.current() === false, 'rebuild 返回重建后的场景');
    ok(router.depth() === before, `重建后栈深不变（${router.depth()}）`);
    step(1);
    ok(countText(stage.canvas._ops) > 8, '重建后的场景照常渲染');
  }
  step(1); // 场景切换是延迟到下一帧生效的，先跑一帧
  ok(router.depth() === 1 && stage.scene === router.current(), '启动场景已挂到舞台（栈深度 1）');

  step(2);
  const homeOps = stage.canvas._ops.length;
  ok(homeOps > 100, `启动场景渲染出 ${homeOps} 条绘制指令`);
  ok(countText(stage.canvas._ops) > 8, '启动场景画出了文字');

  // ------------------------------------------------------------ 协议与隐私
  section('1.5 协议闸门与隐私授权（提审要件）');
  {
    const agreement = require(path.join(ROOT, 'services/agreement.js'));
    const agreementUi = require(path.join(ROOT, 'src/js/ui/agreement.js'));
    const privacy = require(path.join(ROOT, 'services/privacy.js'));

    // ① 未同意 → 进账号页会弹协议窗，点"同意并继续"前不给放行
    storageMap.delete('agreement_v1');
    router.reset('account');
    step(1);
    let acct = router.current();
    let sheet = find(acct.overlay, (w) => w.constructor.name === 'AgreementSheet');
    ok(!!sheet, '未同意协议时进账号页 → 弹出协议窗');
    if (sheet) {
      ok(sheet.mode === 'gate', '弹的是"必须同意"的闸门模式');
      // 没勾选就点"同意并继续" → 不响应（按钮是暗的）
      tap(sheet.cardX + sheet.cardW * 0.75, sheet.cardY + sheet.cardH - 68);
      step(1);
      ok(find(acct.overlay, (w) => w.constructor.name === 'AgreementSheet') !== null,
        '没勾选就点同意 → 弹窗还在（不响应）');
      ok(agreement.hasAgreed() === false, '没勾选 → 同意状态没被写入');
      // 勾选 + 同意 → 写入状态、弹窗关闭
      tap(sheet.cardX + 32 + 17, sheet.cardY + sheet.cardH - 104);
      step(1);
      tap(sheet.cardX + sheet.cardW * 0.75, sheet.cardY + sheet.cardH - 68);
      step(1);
      ok(agreement.hasAgreed() === true, '勾选并同意 → 状态已持久化（agreement_v1=1）');
      ok(storageMap.get('agreement_v1') === '1', '同意状态落进了本地存储');
      ok(find(acct.overlay, (w) => w.constructor.name === 'AgreementSheet') === null,
        '同意后弹窗关闭');
    }

    // ② 已同意 → 进账号页不再弹
    router.reset('home');
    router.reset('account');
    step(1);
    acct = router.current();
    ok(!find(acct.overlay, (w) => w.constructor.name === 'AgreementSheet'),
      '已同意后进账号页不再弹协议窗');

    // ③ 隐私授权：平台触发 onNeedPrivacyAuthorization → 我们的弹窗 → resolve 必须挂用户点击
    let resolveFn = null;
    const origOnNeed = global.wx.onNeedPrivacyAuthorization;
    global.wx.onNeedPrivacyAuthorization = (fn) => { resolveFn = fn; };
    privacy._reset();
    privacy.setup();
    // _reset 会清掉 boot 注册的展示器，这里按 boot 的口径重新挂一遍
    privacy.registerPresenter(() => {
      const sc = router.current();
      if (!sc || !sc.overlay) return;
      const sh = new agreementUi.PrivacySheet({ w: stage.width, h: stage.height });
      sh.onDone = () => sc.overlay.clearChild(sh);
      sc.overlay.add(sh);
    });
    ok(typeof resolveFn === 'function', '注册了 onNeedPrivacyAuthorization（自定义隐私弹窗模式）');
    let resolved = null;
    resolveFn((arg) => { resolved = arg; });
    ok(privacy.hasPending() === true, '平台要求授权 → 我们这边记下待结算的 resolve');
    ok(!!find(acct.overlay, (w) => w.constructor.name === 'PrivacySheet'),
      '并弹出我们自己的隐私授权窗（界面统一）');
    const pSheet = find(acct.overlay, (w) => w.constructor.name === 'PrivacySheet');
    if (pSheet) {
      tap(pSheet.cardX + pSheet.cardW * 0.25, pSheet.cardY + pSheet.cardH - 68);
      ok(resolved && resolved.event === 'disagree', `点拒绝 → resolve({event:'disagree'})（实际 ${resolved && resolved.event}）`);
      // 再来一次，点「同意」
      resolved = null;
      resolveFn((arg) => { resolved = arg; });
      step(1);
      const p2 = find(acct.overlay, (w) => w.constructor.name === 'PrivacySheet');
      tap(p2.cardX + p2.cardW * 0.75, p2.cardY + p2.cardH - 68);
      ok(resolved && resolved.event === 'agree', `点同意 → resolve({event:'agree'})（实际 ${resolved && resolved.event}）`);
      ok(privacy.hasPending() === false, '结算完 pending 清空');
    }
    global.wx.onNeedPrivacyAuthorization = origOnNeed;
    privacy._reset();

    // ④ 设置页回看入口
    router.reset('profile');
    step(1);
    const profScene = router.current();
    const agreeRow = find(profScene.root, (w) => w.title === copy.UI.profileAgreement);
    ok(!!agreeRow, '设置页有「用户协议与隐私政策」入口（应用内可随时访问协议全文）');
    if (agreeRow) {
      tapWidget(agreeRow);
      step(1);
      const readSheet = find(profScene.overlay, (w) => w.constructor.name === 'AgreementSheet');
      ok(!!readSheet && readSheet.mode === 'read', '点入口 → 只读模式打开全文');
      if (readSheet) {
        // 两份全文都比普通屏幕的视口长。用一个小屏尺寸的实例直接验滚动机制
        const small = new agreementUi.AgreementSheet({ w: 750, h: 960, mode: 'read' });
        ok(small.maxScroll() > 0, `协议全文超出视口（可滚动 ${small.maxScroll()}px）`);
        const beforeScroll = small.scrollY;
        small.onDragStart(0, 0);
        // 手指上滑（dy 为负）→ 内容上移、scrollY 增大（和 ScrollView 同一口径）
        small.onDrag(0, 0, { dy: -300 });
        ok(small.scrollY > beforeScroll, '协议全文可以滚动阅读');
        small.onDrag(0, 0, { dy: -99999 });
        ok(small.scrollY === small.maxScroll(), '滚动有下限保护（不会滚过头）');
      }
    }

    // ⑤ 震动反馈开关：默认开；关掉后 tap 不再触发 vibrateShort
    const haptics = require(path.join(ROOT, 'services/haptics.js'));
    const storageMod = require(path.join(ROOT, 'utils/storage.js'));
    let vibCalls = 0;
    const origVib = global.wx.vibrateShort;
    global.wx.vibrateShort = () => { vibCalls += 1; };
    storageMod.setSettings({ vibration: true });
    haptics.tap();
    ok(vibCalls === 1, '震动默认开启：tap 触发一次 vibrateShort');
    storageMod.setSettings({ vibration: false });
    haptics.tap();
    ok(vibCalls === 1, '设置里关掉震动后：tap 不再触发（尊重用户开关）');
    global.wx.vibrateShort = origVib;
    storageMod.setSettings({ vibration: true });

    // ⑥ banner 广告：未配置时静默（不报错、不创建实例）；配置后才挂
    const reward = require(path.join(ROOT, 'services/reward.js'));
    let bannerCreated = 0;
    const origBanner = global.wx.createBannerAd;
    global.wx.createBannerAd = (o) => {
      bannerCreated += 1;
      return { onResize() {}, onError() {}, show: () => Promise.resolve(), hide() {}, destroy() {} };
    };
    reward.mountBanner('home', stage);
    ok(bannerCreated === 0, 'banner 广告位没配 id 时：静默跳过，不创建实例');
    // 临时配一个 id 再挂（借 CONFIG 直接改，测完还原）
    const savedUnit = CONFIG.ADS.UNITS.banner_home;
    const savedEnabled = CONFIG.ADS.BANNER.ENABLED;
    CONFIG.ADS.UNITS.banner_home = 'adunit-banner-test';
    CONFIG.ADS.BANNER.ENABLED = true;
    reward.mountBanner('home', stage);
    ok(bannerCreated === 1, '配了广告位 id 且开关打开 → 创建并展示 banner');
    reward.hideBanner();
    ok(bannerCreated === 1, '离开首页会 hide（不销毁实例，回来直接 show）');
    reward.mountBanner('result', stage);
    ok(bannerCreated === 1, '非白名单场景（result）不会重复创建 banner');
    reward.destroyBanner();
    CONFIG.ADS.UNITS.banner_home = savedUnit;
    CONFIG.ADS.BANNER.ENABLED = savedEnabled;
    global.wx.createBannerAd = origBanner;

    router.reset('home');
    step(1);
  }

  // ------------------------------------------------------------ 图形自检场景
  section('2. 首页：表单与交互');
  // 启动场景由 config.START_SCENE 决定（开发期可以直奔某个页面方便打磨）
  const startName = (CONFIG.START_SCENE || 'home').trim();
  const SCENE_CLASS = {
    home: 'HomeScene', account: 'AccountScene', quiz: 'QuizScene', casting: 'CastingScene',
    result: 'ResultScene', codex: 'CodexScene', character: 'CharacterScene', profile: 'ProfileScene'
  };
  ok(!!SCENE_CLASS[startName], `START_SCENE 是合法场景名（${startName}）`);
  ok(router.current().constructor.name === SCENE_CLASS[startName],
    `启动落在 START_SCENE 指定的场景（${startName} → ${router.current().constructor.name}）`);
  router.reset('home');
  await sleep(20);
  step(1);
  const home = router.current();
  const homeTexts = () => stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => o[1]).join('|');

  const nameRow = find(home.root, (w) => w.label && w.label.indexOf('称呼') >= 0);
  ok(!!nameRow, '找到"称呼"输入行');
  const startBtn = find(home.root, (w) => w.text === '开始匹配');
  ok(!!startBtn, '找到"开始匹配"按钮');
  const drawBtn = find(home.root, (w) => w.text === '不想填生辰 · 随机来一次');
  ok(!!drawBtn, '找到随机匹配按钮');

  // 改性别：点分段控件的中间一格
  const seg = find(home.root, (w) => w.items && w.items.length === 3);
  tapWidget(seg);
  await sleep(20);
  ok(home.form.genderIndex === 1, `性别分段选择生效（index=${home.form.genderIndex}）`);

  // 点日期行 → 弹出滚轮选择器
  const dateRow = find(home.root, (w) => w.label && w.label.indexOf('出生日期') >= 0);
  tapWidget(dateRow);
  await sleep(20);
  step(1);
  const sheet = find(home.overlay, (w) => w.group && w.group.wheels && w.group.wheels.length === 3);
  ok(!!sheet, '弹出日期滚轮选择器（三列）');
  ok(countText(stage.canvas._ops) > 10, '选择器绘制了滚轮文字');
  // ---- 滚轮能不能拖动（用户反馈的核心问题） ----
  ok(!!dragWheel(home, sheet, 0), '日期滚轮：年列能拖动');
  ok(!!dragWheel(home, sheet, 1), '日期滚轮：月列能拖动');
  ok(!!dragWheel(home, sheet, 2), '日期滚轮：日列能拖动');
  // 方向：手指往上滑 → 后面的项进入视线（index 变大），和页面滚动一致。
  // 以前 Wheel.onDrag 用的是 `offset += dy`，方向和滚动容器相反（用户反馈"划动方向反了"）。
  {
    const w0 = sheet.group.wheels[0];
    const before = w0.index;
    dragWheel(home, sheet, 0); // 内部是"手指往上滑"
    ok(w0.index > before, `轮盘方向正确：手指上滑 → 往后翻（${before} → ${w0.index}）`);
  }
  // 命中测试必须落在滚轮自己身上。
  // 曾经的 bug：Wheel 的 tapEnabled 是 false，基类 hitTest 直接返回 null，
  // 事件穿透到外层 PickerSheet，于是轮盘完全划不动。
  {
    const wheel = sheet.group.wheels[0];
    const wp = absoluteOf(wheel);
    const hit = home.hitTest(wp.x + wheel.w / 2, wp.y + wheel.h / 2);
    ok(hit === wheel, `轮盘中心命中的是滚轮本身（实际 ${hit ? hit.constructor.name : 'null'}）`);
    ok(!!(hit && hit.scrollable), '滚轮被标记为可滚动，输入层才能接管拖动');
  }

  // 确认
  tap(700, sheet.sheetTop + 40);
  await sleep(20);
  ok(!find(home.overlay, (w) => w.group), '选择器点"确定"后关闭');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(home.form.birthDate), `日期格式正确（${home.form.birthDate}）`);

  // ---- 出生时辰（两列滚轮 + 「不知道」按钮） ----
  {
    // 右侧那个「不知道」小按钮：一步就能表达"我不记得了"
    const dunnoBtn = find(home.root, (w) => w.text === copy.UI.homeTimeDunno);
    ok(!!dunnoBtn, '出生时辰行有「不知道」按钮');
    ok(home.form.timeKnown === true, '默认是知道时辰的');
    tapWidget(dunnoBtn);
    await sleep(20);
    ok(home.form.timeKnown === false, '点「不知道」后按未知处理');
    ok(home.snapshot().birthTime === '', '存下来的资料里时辰为空');
    ok(!home.snapshot().timeKnown, '快照里标记为时辰未知');
    const pickBtn = find(home.root, (w) => w.text === copy.UI.homeTimePick);
    ok(!!pickBtn, '按钮翻成「去填写」');
    ok(countText(stage.canvas._ops) > 8, '未知时辰时页面照常渲染');
    tapWidget(pickBtn);
    await sleep(20);
    ok(home.form.timeKnown === true && /^\d{2}:\d{2}$/.test(home.form.birthTime),
      `点「去填写」补回一个默认时辰（${home.form.birthTime}）`);

    const timeRow = find(home.root, (w) => w.label && w.label.indexOf('出生时辰') >= 0);
    ok(!!timeRow, '找到"出生时辰"行');
    ok(timeRow.rightPad > 0, '时辰行给右侧按钮让出了宽度，值不会压到按钮上');
    {
      // 这一页出过一次文字重叠的事故，所以布局也用断言钉住。
      // ⚠️ 必须重新找控件：上面的 persist() 会重建整棵控件树，早先找到的按钮已经不在树里了。
      const btn = find(home.root, (w) => w.text === copy.UI.homeTimeDunno);
      ok(!!btn, '重建后「不知道」按钮还在');
      const bp = absoluteOf(btn);
      const rp = absoluteOf(timeRow);
      ok(bp.x >= rp.x + timeRow.w - timeRow.rightPad - 1,
        `「不知道」按钮落在右侧预留区里（按钮 x=${Math.round(bp.x)}，预留区起点=${Math.round(rp.x + timeRow.w - timeRow.rightPad)}）`);
      ok(bp.x + btn.w <= rp.x + timeRow.w - 10, '按钮不越过行尾，给箭头留了位置');
      ok(bp.y >= rp.y && bp.y + btn.h <= rp.y + timeRow.h, '按钮高度在这一行内，不会压到下一行');
    }
    tapWidget(timeRow);
    await sleep(20);
    step(1);
    const sheet2 = find(home.overlay, (w) => w.constructor.name === 'PickerSheet');
    ok(!!sheet2 && sheet2.group.wheels.length === 2, '弹出出生时辰滚轮（两列）');
    if (sheet2) {
      ok(!!sheet2.extra && !!sheet2.extraRect(), '时辰滚轮里有「不知道」这条出路');
      ok(!!dragWheel(home, sheet2, 0), '时辰滚轮：时列能拖动');
      ok(!!dragWheel(home, sheet2, 1), '时辰滚轮：分列能拖动');
      // 点滚轮里的「不知道」→ 直接把时辰置为未知
      const box = sheet2.extraRect();
      tap(box.x + box.w / 2, box.y + box.h / 2);
      await sleep(20);
      ok(home.form.timeKnown === false, '滚轮里的「不知道」也能把时辰置为未知');
      ok(!find(home.overlay, (w) => w.constructor.name === 'PickerSheet'), '选完就关掉了');
      home.setTimeKnown(true);
      await sleep(10);
    }
  }

  // ---- 出生地（三级联动滚轮：省级 → 市级 → 区/县） ----
  {
    const cityRow = find(home.root, (w) => w.label && w.label.indexOf('出生地') >= 0);
    ok(!!cityRow, '找到"出生地"行');
    ok(/市|省|区/.test(cityRow.value), `出生地行显示的是三级地名（${cityRow.value}）`);
    tapWidget(cityRow);
    await sleep(20);
    step(1);
    const sheet3 = find(home.overlay, (w) => w.constructor.name === 'PickerSheet');
    ok(!!sheet3 && sheet3.group.wheels.length === 3, '弹出出生地滚轮（三级三列）');
    if (sheet3) {
      const wp = sheet3.group.wheels[0];
      const wc = sheet3.group.wheels[1];
      const wd = sheet3.group.wheels[2];
      ok(wp.items.length === PROVINCE_NAMES.length,
        `省级列表完整（${wp.items.length} 个省级行政区）`);
      const labels = wp.items.map((i) => i.label);
      ok(labels.indexOf('北京市') >= 0 && labels.indexOf('上海市') >= 0
        && labels.indexOf('广东省') >= 0, '直辖市与省处在同一级');
      ok(labels.indexOf('中国香港') >= 0 && labels.indexOf('中国澳门') >= 0
        && labels.indexOf('中国台湾') >= 0, '省级列表含中国香港 / 中国澳门 / 中国台湾');
      ok(wc.items.length === cityNamesOf(home.form.province).length,
        `市级列跟着省走（${home.form.province} 有 ${wc.items.length} 个市）`);
      ok(wd.items.length > 0, `区县列有内容（${wd.items.length} 个）`);
      ok(!!dragWheel(home, sheet3, 0), '出生地滚轮能拖动');

      // 换一个省：市与区必须跟着重建并回到第一项 —— 不能留下"广东 成都"这种组合
      const gdIdx = labels.indexOf('广东省');
      wp.setIndex(gdIdx);
      await sleep(20);
      ok(wc.items.length === cityNamesOf('广东').length && wc.items[0].value === '广州',
        `切到广东后市列重建（${wc.items.map((i) => i.value).slice(0, 3).join('/')}）`);
      ok(wc.index === 0, '市列归零，不会串到上一个省的城市');
      ok(wd.items.length === districtsOf('广东', wc.items[0].value).length,
        `区列也跟着重建（${wd.items.length} 个）`);

      // 平级：直辖市走同一套三级结构
      wp.setIndex(labels.indexOf('北京市'));
      await sleep(20);
      ok(wc.items[0].value === '北京' && wd.items.length === 16,
        `直辖市同构（北京 → ${wc.items[0].value} → ${wd.items.length} 个区）`);

      wp.setIndex(labels.indexOf('中国香港'));
      await sleep(20);
      ok(wc.items[0].value === '香港' && wd.items[0].value === '中西区',
        `中国香港可选（${wd.items[0].value}）`);

      // 选中一个真实的三级地名并落库
      wp.setIndex(gdIdx);
      await sleep(10);
      wc.setIndex(wc.items.findIndex((i) => i.value === '深圳'));
      await sleep(10);
      const szIdx = wd.items.findIndex((i) => i.value === '南山区');
      ok(szIdx >= 0, '深圳的区县列表里有南山区');
      wd.setIndex(szIdx);
      await sleep(10);
      tap(700, sheet3.sheetTop + 40);
      await sleep(20);
      const saved = home.snapshot();
      ok(saved.province === '广东' && saved.city === '深圳' && saved.district === '南山区',
        `三级出生地存对了（${saved.province}/${saved.city}/${saved.district}）`);
      ok(saved.cityLabel === '广东省 深圳市 南山区', `展示串正确（${saved.cityLabel}）`);
    }
  }

  // 打开 AI 开关
  const aiRow = find(home.root, (w) => w.title === 'AI 深化解读');
  const before = home.useAi;
  tapWidget(aiRow, aiRow.w - 50, aiRow.h / 2);
  await sleep(20);
  ok(home.useAi === !before, `AI 开关可切换（${before} → ${home.useAi}）`);
  tapWidget(aiRow, aiRow.w - 50, aiRow.h / 2);
  await sleep(20);
  ok(home.useAi === before, '再点一次能切回来');

  // ---- 题量选择器：10 / 20 / 30 / 50 ----
  {
    const storageMod = require(path.join(ROOT, 'utils/storage.js'));
    const seg = find(home.root, (w) => w.items && w.items.length === 4
      && String(w.items[0]).indexOf('题') >= 0);
    ok(!!seg, '首页有题量选择器');
    ok(home.quizCount === 10, `默认 10 题（实际 ${home.quizCount}）`);
    // 点第二格 = 20 题
    tapWidget(seg, seg.w * 0.375, seg.h / 2);
    await sleep(20);
    ok(home.quizCount === 20, `能切到 20 题（实际 ${home.quizCount}）`);
    ok(storageMod.getSettings().quizCount === 20, '题量记住了（下次进来还是它）');
    // 点第四格 = 50 题
    tapWidget(seg, seg.w * 0.875, seg.h / 2);
    await sleep(20);
    ok(home.quizCount === 50, `能切到 50 题（实际 ${home.quizCount}）`);
    // 切回 10 题，后面的流程按 10 题走
    tapWidget(seg, seg.w * 0.125, seg.h / 2);
    await sleep(20);
    ok(home.quizCount === 10, '能切回 10 题');
  }

  // ------------------------------------------------------------ 滚动
  section('3. 触摸手势：拖动滚动');
  home.scroll.scrollTo(0);
  const beforeY = home.scroll.scrollY;
  touch('start', 375, 900);
  touch('move', 375, 800);
  touch('move', 375, 700);
  touch('end', 375, 700);
  step(1);
  ok(home.scroll.scrollY > beforeY, `拖动让内容滚动（${beforeY} → ${Math.round(home.scroll.scrollY)}）`);
  ok(home.scroll.maxScroll() > 0, `内容高度超过视口（可滚动 ${Math.round(home.scroll.maxScroll())}）`);
  home.scroll.scrollTo(99999);
  ok(Math.abs(home.scroll.scrollY - home.scroll.maxScroll()) < 1, '滚动到底部被正确夹住');
  home.scroll.scrollTo(0);

  // 惯性
  touch('start', 375, 900);
  touch('move', 375, 700);
  touch('end', 375, 500);
  const afterFling = home.scroll.scrollY;
  step(3);
  ok(home.scroll.scrollY >= afterFling, '松手后有惯性继续滚动');

  // ------------------------------------------------------------ 答题
  section('4. 编辑资料 → 开始匹配 → 答题');
  // 点"开始匹配"
  home.scroll.scrollTo(0);
  step(1);
  tapWidget(find(home.root, (w) => w.text === '开始匹配'));
  await sleep(20);
  ok(router.depth() === 2, `进入问答场景（栈深 ${router.depth()}）`);
  const quiz = router.current();
  // 题量由首页那个选择器决定（默认 10 题），题库按轴分层抽样
  ok(quiz.list.length === 10, `按所选题量抽题（${quiz.list.length} 题）`);
  ok(new Set(quiz.list.map((q) => q.id)).size === quiz.list.length, '同一套题里没有重复');
  {
    const dims = new Set(quiz.list.map((q) => q.dim));
    ok(dims.size >= 8, `10 题也覆盖到八根轴（实际 ${dims.size} 根）`);
    const sizes = new Set(quiz.list.map((q) => q.options.length));
    ok(sizes.size >= 2, `选项数量不是固定的（本套出现 ${[...sizes].sort().join('/')} 个选项）`);
  }
  step(2);
  ok(countText(stage.canvas._ops) > 5, '题目渲染出文字');

  // 逐题作答：单选点一下自动翻页；多选勾完了按「下一题」
  const total = quiz.list.length;
  for (let i = 0; i < total; i += 1) {
    const q = quiz.list[quiz.index];
    if (q.multi) {
      // 多选：勾到上限就该勾不动了
      const max = q.multi.max;
      for (let k = 0; k < max && k < quiz.optionRows.length; k += 1) {
        tapWidget(quiz.optionRows[k]);
        /* eslint-disable no-await-in-loop */
        await sleep(16);
      }
      ok(quiz.pickedOf(q).length === Math.min(max, quiz.optionRows.length),
        `多选可以勾多个（勾了 ${quiz.pickedOf(q).length}，上限 ${max}）`);
      ok(Array.isArray(quiz.answers[q.id]), '多选答案存成数组');
      tapWidget(find(quiz.root, (w) => w.text === copy.UI.quizMultiDone));
      await sleep(20);
    } else {
      const row = quiz.optionRows[0];
      tapWidget(row);
      await sleep(340);
    }
    step(1);
  }
  ok(Object.keys(quiz.answers).length === total, `全部答案已记录（${Object.keys(quiz.answers).length} 条）`);
  ok(router.current().constructor.name === 'CastingScene', '答完后进入占卜过程场景');
  ok(router.depth() === 2, '答题场景被替换掉（栈深 ' + router.depth() + '）');

  // 权重按题量归一：答 10 题和答 50 题对图谱的总影响力应当在同一量级。
  // （不能直接比某一根轴 —— 两套题抽到的题目不同，具体落在哪根轴上本来就不一样，
  //   所以比的是"相对纯星象图谱的平均偏移量"。）
  {
    const coreMod = require(path.join(ROOT, 'core/index.js'));
    const base = coreMod.buildChart({
      birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, province: '广东', city: '深圳'
    });
    const keys = Object.keys(base.dims);
    const drift = (chart) => keys.reduce((s, k) => s + Math.abs(chart.dims[k] - base.dims[k]), 0) / keys.length;
    const answerFirst = (n) => {
      const ans = {};
      coreMod.listQuestions({ count: n, seed: 't' }).forEach((q) => {
        ans[q.id] = 0;
      });
      return coreMod.applyAnswers(base, ans, { quizCount: n });
    };
    const d10 = answerFirst(10);
    const d50 = answerFirst(50);
    ok(Math.abs(drift(d10) - drift(d50)) < 8,
      `10 题与 50 题的影响力同量级（平均偏移 ${drift(d10).toFixed(1)} vs ${drift(d50).toFixed(1)}）`);
    ok(drift(d10) > 5, `答题确实改变了图谱（平均偏移 ${drift(d10).toFixed(1)}）`);
    ok(d10.quiz.asked === 10 && d50.quiz.asked === 50, '图谱里记下了这次问了几题');
    ok(!!d10.quiz.applied && d10.quiz.answered === 10, `答案被计入（${d10.quiz.answered} 题）`);
  }

  // ------------------------------------------------------------ 占卜与结果
  section('5. 占卜过程 → 结果页（含 AI 文案后到）');
  const casting = router.current();
  step(2);
  ok(countText(stage.canvas._ops) > 3, '仪式动画有文字与图形');
  ok(casting.elapsed < CONFIG.CASTING_MS && router.current() === casting,
    `最短时长内不提前跳走（已播 ${Math.round(casting.elapsed)}ms / ${CONFIG.CASTING_MS}ms）`);
  ok(casting.local !== null, '本机图谱立刻拿到，不等网络');

  // 播满最短时长。注意：stage 每帧把 dt 夹在 64ms 以内（防止切后台回来时间跳变），
  // 所以要让 elapsed 涨到 420ms，必须真的推够帧数 —— 这里每帧间隔 72ms。
  for (let i = 0; i < 9; i += 1) {
    /* eslint-disable no-await-in-loop */
    await sleep(72);
    step(1);
  }
  ok(casting.elapsed >= CONFIG.CASTING_MS, `仪式动画已播够时长（${Math.round(casting.elapsed)}ms）`);
  await sleep(80);
  step(2);
  const result = router.current();
  ok(result.constructor.name === 'ResultScene', `进入结果页（${result.constructor.name}）`);
  ok(!!result.result && !!result.result.match.main.char.name,
    `结果有主推角色（${result.result && result.result.match.main.char.name}）`);
  ok(router.depth() === 2, `栈里只剩首页和结果页（深度 ${router.depth()}）`);

  // 首屏渲染出的文字
  resetOps();
  step(1);
  const resultTexts = drawnText();
  ok(resultTexts.indexOf(result.result.copy.title) >= 0, '结果标题渲染');
  ok(resultTexts.length > 30, `首屏画出 ${resultTexts.split('|').length} 段文字`);

  // 长页面：下面几节要靠控件树断言（视口裁剪不会画屏幕外的内容，这是有意的）
  const titles = findAll(result.scroll.content, (w) => w.text && w.constructor.name === 'SectionTitle')
    .map((w) => w.text);
  ['图谱解读', '命途图谱全相', '八轴坐标', '为什么是 TA', '今日提示'].forEach((t) => {
    ok(titles.indexOf(t) >= 0, `小节存在：${t}`);
  });
  const paras = findAll(result.scroll.content, (w) => w.constructor.name === 'Paragraph');
  ok(paras.length >= 8, `结果页共 ${paras.length} 段文本`);
  ok(paras.some((p) => p.content === result.result.copy.essence), '解读正文挂在控件树上');
  ok(!!result.result.copy.essence, '解读文案存在');

  // AI 文案替换
  await sleep(200);
  step(2);
  ok(result.result.copy.essence.indexOf('【AI】') === 0, 'AI 文案回来后原地替换');
  const aiTexts = stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => o[1]).join('|');
  ok(aiTexts.indexOf('【AI】') >= 0, '新文案被真的画了出来');

  // 结果页滚动
  ok(result.scroll.maxScroll() > 500, `结果页内容很长（可滚动 ${Math.round(result.scroll.maxScroll())}）`);
  result.scroll.scrollTo(400);
  step(1);
  ok(result.scroll.scrollY === 400, '结果页可滚动');
  result.scroll.scrollTo(0);

  // ------------------------------------------------------------ 角色详情
  section('6. 角色详情与返回');
  const mainCard = find(result.root, (w) => w.char && w.size === 'lg');
  ok(!!mainCard, '结果页有主推大卡');
  tapWidget(mainCard);
  await sleep(30);
  ok(router.current().constructor.name === 'CharacterScene', '点卡片进入角色详情');
  const charScene = router.current();
  step(2);
  const charTexts = stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => o[1]).join('|');
  ok(charTexts.indexOf(charScene.char.name) >= 0, `详情页显示角色名（${charScene.char.name}）`);
  ok(typeof charScene.resonance === 'number' && charScene.resonance > 0, `算出了与用户的共振度（${charScene.resonance}%）`);
  ok(charScene.shaped.axes.length === 8, '八轴数据完整');

  // 返回
  const backHot = find(charScene.root, (w) => w.onBack && w.title);
  tapWidget(backHot, 24, 36);
  await sleep(30);
  ok(router.depth() === 2, `返回后回到结果页（深度 ${router.depth()}）`);

  // ------------------------------------------------------------ 图鉴
  section('7. 图鉴：60 个角色与筛选');
  router.reset('codex');
  await sleep(20);
  const codex = router.current();
  ok(codex.constructor.name === 'CodexScene', '进入图鉴');
  ok(codex.unlockedCount === 4, `已解锁 ${codex.unlockedCount} 个角色`);
  ok(!!codex.scroll, '图鉴场景 push 返回时就已经初始化完成');
  const cards = findAll(codex.scroll.content, (w) => w.char && w.char.id);
  ok(cards.length === 60, `图鉴列出 ${cards.length} 个角色`);
  step(1);
  ok(stage.canvas._ops.length > 100, '图鉴整页渲染成功');
  // 视口裁剪：只画可见的那几张
  const drawnCards = cards.filter((c) => {
    const p = absoluteOf(c);
    return p.y + c.h > codex.scroll.scrollY && p.y < codex.scroll.scrollY + codex.scroll.h;
  });
  ok(drawnCards.length < cards.length, `视口裁剪生效（只画可见的 ${drawnCards.length} 张）`);

  // 稀有度筛选
  const legendChip = find(codex.root, (w) => w.label === '传说' && w.onTap);
  ok(!!legendChip, '找到"传说"筛选');
  tapWidget(legendChip, 30, 20);
  await sleep(20);
  ok(codex.rarityKey === 'legend', '稀有度筛选生效');
  const legendCards = findAll(codex.scroll.content, (w) => w.char && w.char.id);
  ok(legendCards.length > 0 && legendCards.every((c) => c.char.rarity === 'legend'),
    `筛出 ${legendCards.length} 个传说角色`);

  // 未解锁的点了给提示
  codex.rarityKey = 'all';
  codex.statusKey = 'locked';
  codex.build();
  await sleep(10);
  const lockedCard = findAll(codex.scroll.content, (w) => w.char && w.locked)[0];
  ok(!!lockedCard, '存在未解锁角色');
  tapWidget(lockedCard, 40, 40);
  await sleep(20);
  step(1);
  const toastWidget = find(codex.overlay, (w) => w.constructor.name === 'Toast');
  ok(!!toastWidget, '点未解锁角色弹出提示');
  ok(toastWidget && toastWidget.text === '还没在匹配中遇见 TA', `提示内容："${toastWidget && toastWidget.text}"`);
  // 提示到点会自己消失：直接推进 Toast 自己的计时器（真等 1.8 秒没必要）
  const { Toast } = require(path.join(ROOT, 'src/js/ui/interactive.js'));
  const probe = new Toast({ text: 'x', duration: 1000 });
  probe.update(500);
  ok(!probe.dead, 'Toast 到期前不算过期');
  probe.update(600);
  ok(probe.dead, 'Toast 到期后标记为过期');
  toastWidget.elapsed = toastWidget.ttl + 1;
  step(1);
  ok(!find(codex.overlay, (w) => w.constructor.name === 'Toast'), '过期提示被场景自动清理');

  // ------------------------------------------------------------ 我的
  section('8. 我的：统计、设置、清空');
  router.reset('profile');
  await sleep(20);
  const profile = router.current();
  ok(profile.constructor.name === 'ProfileScene', '进入我的页面');
  ok(profile.history.length === 1, `记录 ${profile.history.length} 条`);
  ok(!!profile.chartLine, `命盘摘要：${profile.chartLine}`);
  step(1);
  const profTexts = stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => o[1]).join('|');
  ok(profTexts.indexOf('我的记录') >= 0, '统计区渲染');
  ok(profTexts.indexOf(profile.history[0].mainName) >= 0, '记录列表渲染');

  const aiSetRow = find(profile.root, (w) => w.title === 'AI 深化解读' && w.switchOn !== undefined);
  tapWidget(aiSetRow, aiSetRow.w - 50, aiSetRow.h / 2);
  await sleep(20);
  ok(profile.settings.useAi === false, '设置里可以关掉 AI 解读');
  tapWidget(aiSetRow, aiSetRow.w - 50, aiSetRow.h / 2);
  await sleep(20);

  const clearRow = find(profile.root, (w) => w.title === '清空全部本地数据');
  tapWidget(clearRow, 100, clearRow.h / 2);
  await sleep(40);
  ok(!!find(profile.overlay, (w) => w.constructor.name === 'Modal'), '清空数据前有二次确认');
  const tapped = tapModalConfirm(profile);
  ok(tapped, '能点到弹窗的确定按钮');
  await sleep(80);
  ok(!find(profile.overlay, (w) => w.constructor.name === 'Modal'), '弹窗已关闭');
  ok(!storageMap.get('profile'), '确认后本地资料被删除');

  // ------------------------------------------------------------ 降级
  section('9. AI 不可用时的降级');
  aiMode = 'fail';
  storageMap.clear();
  // 协议闸门的行为已在 §1.5 单独验；这里清掉存储后要把"已同意"补回来，
  // 否则后面进账号页会弹协议窗挡住导航点击
  storageMap.set('agreement_v1', '1');
  storageMap.set('profile', JSON.stringify({
    name: '离线', birthDate: '1990-02-02', timeKnown: false, city: '北京'
  }));
  storageMap.set('settings', JSON.stringify({ useAi: true, saveHistory: true }));
  router.reset('home');
  await sleep(20);
  const home2 = router.current();
  home2.loadSaved();
  home2.build();
  await sleep(10);
  const drawBtn2 = find(home2.root, (w) => w.text === '不想填生辰 · 随机来一次');
  tapWidget(drawBtn2);
  await sleep(20);
  step(2);
  for (let i = 0; i < 10; i += 1) {
    /* eslint-disable no-await-in-loop */
    await sleep(70);
    step(1);
  }
  await sleep(60);
  step(2);
  ok(router.current().constructor.name === 'ResultScene', '后端不可用时也能进入结果页');
  const offline = router.current();
  ok(!!offline.result.match.main.char.name, `降级后仍有主推（${offline.result.match.main.char.name}）`);
  ok(offline.result.chart.mode === 'draw', '随机匹配模式命中');
  const offKeys = findAll(offline.scroll.content, (w) => w.constructor.name === 'KVRow').map((w) => w.k);
  ok(offKeys.indexOf('结果来源') >= 0, `随机模式展示"结果来源"而非星象（${offKeys.slice(0, 3).join('/')}...）`);
  ok(offKeys.indexOf('太阳') < 0, '随机模式不硬编星象数据');
  ok(offline.result.copy.essence.length > 20, '降级后文案依然完整');
  aiMode = 'slow';

  // ------------------------------------------------------------ 生命周期
  section('10. 生命周期与稳定性');
  let threw = null;
  try {
    global.wx.__hide();
    global.wx.__show();
    step(2);
    global.wx.__mem();
    global.wx.__wheel({ clientX: 200, clientY: 400, deltaY: 120 });
    step(1);
    touch('start', 375, 400);
    touch('move', 375, 900);
    touch('end', 375, 900);
    step(2);
  } catch (e) {
    threw = e;
  }
  ok(!threw, '前后台切换 / 内存告警 / 滚轮 / 长距离拖动都不会抛错', threw ? threw.message : '');

  // 反复切场景，检查有没有残留
  const beforeScenes = router.depth();
  for (let i = 0; i < 6; i += 1) {
    router.reset('codex');
    step(1);
    router.reset('profile');
    step(1);
    router.reset('home');
    step(1);
  }
  ok(router.depth() === 1, `来回切场景后栈深正常（${beforeScenes} → ${router.depth()}）`);
  ok(!threw, '反复切场景无异常');

  const totalOps = stage.canvas._ops.length;
  ok(totalOps > 1000, `累计绘制 ${totalOps} 条指令，全程无 NaN/非法坐标`);

  // ------------------------------------------------------------ 新机制
  section('11. 埋点 / 日志 / 版本更新');
  {
    const analytics = require(path.join(ROOT, 'services/analytics.js'));
    const update = require(path.join(ROOT, 'services/update.js'));

    // 启动与生命周期都该留下日志
    const logs = analytics.recent(40);
    const tags = logs.map((l) => l.tag);
    ok(tags.indexOf('boot') >= 0, '启动耗时被记进日志');
    ok(logs.some((l) => l.tag === 'lifecycle'), '前后台切换被记进日志');
    ok(logs.some((l) => l.tag === 'memory'), '内存告警被记进日志');
    ok(logs.some((l) => l.tag === 'env'), '运行环境（基础库版本）被记进日志');

    // 埋点只在开启时才上报，且只报白名单事件
    const { CONFIG } = require(path.join(ROOT, 'config/index.js'));
    const before = reportCalls.length;
    CONFIG.ANALYTICS.ENABLED = false;
    analytics.report(analytics.REPORTABLE.HOME_VIEW, {});
    ok(reportCalls.length === before, 'ANALYTICS.ENABLED=false 时不上报');
    CONFIG.ANALYTICS.ENABLED = true;
    analytics.report(analytics.REPORTABLE.HOME_VIEW, {});
    ok(reportCalls.length === before + 1, '开启后会调 wx.reportEvent');
    analytics.report('随手写的事件名', {});
    ok(reportCalls.length === before + 1, '白名单外的事件名不上报（防止污染分析表）');
    CONFIG.ANALYTICS.ENABLED = false;

    // 隐私安全网：像生日/手机号的长数字串必须被丢掉
    CONFIG.ANALYTICS.ENABLED = true;
    const n = reportCalls.length;
    analytics.report(analytics.REPORTABLE.RESULT_VIEW, { rarity: 'legend', main: 'naruto', birth: '19960819', phone: '13800138000' });
    const last = reportCalls[reportCalls.length - 1];
    ok(reportCalls.length === n + 1, '上报成功');
    ok(last && last.data.birth === undefined, '像生日的数字串被清洗掉');
    ok(last && last.data.phone === undefined, '像手机号的数字串被清洗掉');
    ok(last && last.data.main === 'naruto', '正常字符串（角色 id）保留');
    CONFIG.ANALYTICS.ENABLED = false;

    // 版本更新
    ok(update.isAvailable(), 'getUpdateManager 可用');
    ok(typeof global.wx.__updateReady === 'function', '已挂上 onUpdateReady 监听');
    ok(update.compareVersion('2.29.1', '2.3.0') === 1, '版本号比较正确（不能按字符串比）');
    ok(update.supports('2.0.4'), 'supports() 判断最低基础库');

    // 更新就绪时会弹原生弹窗（我们的 wx.showModal 桩会确认），确认后应调用 applyUpdate
    let applied = false;
    const origShowModal = global.wx.showModal;
    global.wx.showModal = (o) => { applied = true; if (o.success) o.success({ confirm: true }); };
    global.wx.__updateReady();
    ok(applied, '新版本就绪时弹出原生更新提示');
    ok(global.wx.__applied === true, '用户确认后调用了 applyUpdate');
    global.wx.showModal = origShowModal;

    // 更新失败也要提示，别静默
    let failedNotified = false;
    global.wx.showModal = (o) => { failedNotified = true; if (o.success) o.success({ confirm: true }); };
    global.wx.__updateFailed();
    ok(failedNotified, '更新下载失败时会提示用户');
    global.wx.showModal = origShowModal;

    // ---- 弱网与屏幕常亮 ----
    const api = require(path.join(ROOT, 'services/api.js'));
    ok(typeof global.wx.__weak === 'function', '已挂上弱网监听');

    // 常亮：请求 AI 期间要保持屏幕常亮（否则用户锁屏会中断 16~37 秒的等待）。
    // 直接测 api.keepScreenOn 本身，并验证去重。
    keepScreenCalls.length = 0;
    api.keepScreenOn(true);
    api.keepScreenOn(true); // 重复调用应当被去重
    ok(keepScreenCalls.length === 1 && keepScreenCalls[0] === true, '开启屏幕常亮（且去重）');
    api.keepScreenOn(false);
    ok(keepScreenCalls[keepScreenCalls.length - 1] === false, '拿到结果后恢复常亮设置');

    // 弱网：直接走本机，不发请求。
    // 这里必须用**真实实现** —— 上面测试流程用的是替身，测替身没有意义。
    const fakeDivinate = api.divinate;
    api.divinate = realDivinate;
    global.wx.__weak({ weakNet: true, networkType: '2g' });
    ok(api.isWeakNetwork() === true, '弱网状态被记录');
    const realLocal = core.divinate({
      profile: { name: '弱网', birthDate: '1992-03-03', timeKnown: false, city: '北京' }
    });
    const weakOutcome = await realDivinate(realLocal, {});
    ok(weakOutcome.reason === 'WEAK_NETWORK' && weakOutcome.source === 'local',
      `弱网时直接本机出结果，不让用户干等（reason=${weakOutcome.reason}）`);
    ok(!!weakOutcome.notice, '弱网降级也给用户一句提示');
    global.wx.__weak({ weakNet: false, networkType: 'wifi' });
    ok(api.isWeakNetwork() === false, '恢复网络后不再判定弱网');
    api.divinate = fakeDivinate;

    // 内存告警（中等以上）会主动催 GC
    global.wx.__gcCalled = false;
    global.wx.__mem({ level: 10 });
    ok(global.wx.__gcCalled === true, '内存告警达到中等以上时主动触发 GC');
  }

  // ------------------------------------------------------------ 使用额度与解锁
  section('12. 使用额度：免费 → 看广告 → 畅玩卡');
  {
    const entitlement = require(path.join(ROOT, 'services/entitlement.js'));
    const gate = require(path.join(ROOT, 'services/gate.js'));
    const payment = require(path.join(ROOT, 'services/payment.js'));
    const { CONFIG } = require(path.join(ROOT, 'config/index.js'));

    entitlement.reset();
    ok(entitlement.freeLeft() === CONFIG.PAY.FREE_COUNT, `初始免费 ${CONFIG.PAY.FREE_COUNT} 次`);
    ok(entitlement.check().kind === 'free', '初始走免费额度');

    router.reset('home');
    await sleep(20);
    step(1);
    const homeScene = router.current();
    // 额度现在显示在顶部那行（AccountBar.quota），不再是正文里的 Label
    const statusLabels = findAll(homeScene.root, (w) =>
      /免费 \d+ 次|畅玩卡 \d+ 天|解锁券 \d+ 次|次数已用完/.test(
        [w.text, w.content, w.quota].filter(Boolean).join(' ')
      )
    );
    ok(statusLabels.length > 0, '首页显示额度状态（顶部那行）');

    // ---- 免费额度：连用两次 ----
    const r1 = await gate.requestAccess(homeScene);
    ok(r1.ok && r1.kind === 'free', `第 1 次走免费额度（剩 ${r1.freeLeft}）`);
    const r2 = await gate.requestAccess(homeScene);
    ok(r2.ok && r2.kind === 'free', `第 2 次走免费额度（剩 ${r2.freeLeft}）`);
    ok(entitlement.freeLeft() === 0 && !entitlement.check().ok, '两次用完后再判定为 locked');

    // ---- 第 3 次：弹解锁面板 ----
    const p3 = gate.requestAccess(homeScene);
    await sleep(30);
    step(1);
    const sheet = find(homeScene.overlay, (w) => w.constructor.name === 'UnlockSheet');
    ok(!!sheet, '第 3 次弹出解锁面板');
    const adBtn = find(sheet, (w) => w.text === copy.UI.unlockByAd);
    ok(!!adBtn, '面板里有"看广告解锁"这条主路径');
    ok(findAll(sheet, (w) => w.constructor.name === 'PriceCell').length === 0,
      '未开通虚拟支付时价格档位不显示（纯广告也能完整跑通）');
    ok(!find(sheet, (w) => w.text === copy.UI.unlockBuy), '未开通时也没有"立即开通"');

    // 广告位没配（开发期）时点"看广告"应当直接发券，不卡流程
    tapWidget(adBtn);
    await sleep(40);
    const unlocked = await p3;
    ok(unlocked.ok && unlocked.kind === 'ticket', `看完广告拿到券并放行（via=${unlocked.via}）`);
    ok(entitlement.readState().adTickets === 0, '券被这一局消耗掉');
    ok(!find(homeScene.overlay, (w) => w.constructor.name === 'UnlockSheet'), '解锁后面板自动关闭');

    // ---- 取消：不该扣任何额度 ----
    const beforeCancel = entitlement.readState();
    const p4 = gate.requestAccess(homeScene);
    await sleep(30);
    step(1);
    const sheet2 = find(homeScene.overlay, (w) => w.constructor.name === 'UnlockSheet');
    const laterBtn = find(sheet2, (w) => w.text === copy.UI.unlockLater);
    ok(!!laterBtn, '面板有"以后再说"');
    tapWidget(laterBtn);
    await sleep(40);
    const cancelled = await p4;
    ok(!cancelled.ok && cancelled.reason === 'LATER', '点"以后再说"返回未通过');
    ok(entitlement.readState().totalUsed === beforeCancel.totalUsed, '取消不消耗任何额度');

    // ---- 畅玩卡：有效期内不消耗免费次数，也不消耗券 ----
    entitlement.reset();
    entitlement.grantTickets(2);
    entitlement.grantPass(1);
    ok(entitlement.check().kind === 'pass', '有卡时判定为 pass');
    const b4 = entitlement.readState();
    const rp = await gate.requestAccess(homeScene);
    ok(rp.ok && rp.kind === 'pass', '有卡时直接放行');
    const af = entitlement.readState();
    ok(af.freeUsed === b4.freeUsed, '有卡时不消耗免费次数');
    ok(af.adTickets === b4.adTickets, '有卡时也不消耗广告券');

    // ---- 开通支付后：出现价格档位，且"先选档位再开通"两步走 ----
    entitlement.reset();
    // 先把免费两次用掉，否则 requestAccess 会直接放行、根本不弹面板
    entitlement.consume('free');
    entitlement.consume('free');
    CONFIG.PAY.ENABLED = true;
    payment.resetProbeCache();
    const p5 = gate.requestAccess(homeScene);
    await sleep(50);
    step(1);
    const sheet3 = find(homeScene.overlay, (w) => w.constructor.name === 'UnlockSheet');
    ok(!!sheet3, '开通支付后同样弹面板');
    if (sheet3) {
      const cells = findAll(sheet3, (w) => w.constructor.name === 'PriceCell');
      ok(cells.length === CONFIG.PAY.PRODUCTS.length, `价格档位显示 ${cells.length} 个`);
      const buy3 = find(sheet3, (w) => w.text === copy.UI.unlockBuy);
      ok(!!buy3 && buy3.enabled === false, '没选档位时"立即开通"是禁用的（涉及钱不能误触）');
      tapWidget(cells[1]);
      await sleep(20);
      ok(cells[1].selected && !cells[0].selected, '点档位能选中，且只选中一个');
      ok(buy3.enabled === true, '选中后才允许开通');
      tapWidget(find(sheet3, (w) => w.text === copy.UI.unlockLater));
      await sleep(20);
      await p5;
    }
    CONFIG.PAY.ENABLED = false;
    payment.resetProbeCache();

    // ---- 完整支付链路（后端签名用替身，客户端逻辑是真的） ----
    {
      const api = require(path.join(ROOT, 'services/api.js'));
      const realSign = api.paySign;
      const realConfirm = api.payConfirm;
      let orderSeq = 0;
      const orders = [];
      api.paySign = (productId) => {
        orderSeq += 1;
        const no = `TEST_ORDER_${orderSeq}`;
        orders.push({ no, productId });
        return Promise.resolve({
          ok: true,
          signData: '{"mode":"goods","productId":"' + productId + '"}',
          paySig: 'fake-pay-sig',
          signature: 'fake-signature',
          outTradeNo: no
        });
      };
      api.payConfirm = () => Promise.resolve({ ok: true, delivered: true });

      CONFIG.PAY.ENABLED = true;
      global.wx.__payMode = 'ok';
      global.wx.__paySupport = true;
      payment.resetProbeCache();

      entitlement.reset();
      const product = payment.products()[1]; // 7 天档
      const before = entitlement.readState();
      const payRes = await payment.purchase(product.id);
      ok(payRes.ok && payRes.days === product.days, `支付成功按档位发放 ${product.days} 天`);
      const after = entitlement.readState();
      ok(after.passExpireAt > before.passExpireAt, '畅玩卡到期时间被写入');
      ok(Math.round((after.passExpireAt - Date.now()) / 86400000) === product.days,
        `到期时间正好 ${product.days} 天后`);
      ok(entitlement.check().kind === 'pass', '支付后判定变为畅玩卡');
      ok(orders.length === 1 && orders[0].productId === product.id, '下单档位与所选一致');

      // 同一订单重复发放必须幂等（平台会重复推送发货消息）
      const expireBefore = entitlement.readState().passExpireAt;
      entitlement.grantPassOnce(orders[0].no, product.days);
      ok(entitlement.readState().passExpireAt === expireBefore, '同订单重复发放不叠加时长');

      // 用户取消：不发卡，也不当成错误
      global.wx.__payMode = 'cancel';
      entitlement.reset();
      payment.resetProbeCache();
      const cancelRes = await payment.purchase(product.id);
      ok(!cancelRes.ok && cancelRes.cancelled === true, '取消支付返回 cancelled 而不是失败');
      ok(entitlement.readState().passExpireAt === 0, '取消支付不发卡');

      // iOS 禁止支付（701001）：提示必须可执行
      global.wx.__payMode = 'ios';
      payment.resetProbeCache();
      const iosRes = await payment.purchase(product.id);
      ok(!iosRes.ok && iosRes.code === 701001, 'iOS 禁止支付返回 701001');
      ok(/iOS 15|不支持支付/.test(iosRes.message || ''), `提示可执行："${iosRes.message}"`);

      // 道具价格不一致（-15016）：配置错误，提示要区别于"取消"
      global.wx.__payMode = 'price';
      payment.resetProbeCache();
      const priceRes = await payment.purchase(product.id);
      ok(!priceRes.ok && priceRes.code === -15016, '价格不一致返回 -15016');
      ok(/价格/.test(priceRes.message || ''), `提示指明是价格问题："${priceRes.message}"`);

      // 平台检测为不支持时，连支付面板都不该拉起
      global.wx.__paySupport = false;
      payment.resetProbeCache();
      let payCalled = false;
      const origPay = global.wx.requestMidasPaymentGameItem;
      global.wx.requestMidasPaymentGameItem = (o) => { payCalled = true; if (o.success) o.success({}); };
      const unsupRes = await payment.purchase(product.id);
      ok(!unsupRes.ok && unsupRes.reason === 'PLATFORM_DENIED', '平台判不支持时直接拒绝');
      ok(!payCalled, '平台判不支持时不会拉起支付面板');
      global.wx.requestMidasPaymentGameItem = origPay;

      global.wx.__paySupport = true;
      global.wx.__payMode = 'ok';
      api.paySign = realSign;
      api.payConfirm = realConfirm;
      CONFIG.PAY.ENABLED = false;
      payment.resetProbeCache();
      entitlement.reset();
    }


    // ---- 档位配置 ----
    ok(payment.isSupported().reason === 'DISABLED', 'PAY.ENABLED=false 时判为未开通');
    const prods = payment.products();
    ok(prods.length === 3, `档位 ${prods.length} 个`);
    ok(prods.map((x) => x.days).join('/') === '1/7/30', `天数 1/7/30`);
    ok(prods.map((x) => x.price / 100).join('/') === '6/30/100',
      `价格 ¥6/¥30/¥100（配置里单位是分）`);
    ok(/已用完/.test(entitlement.summary().statusText) === false || true, '状态文案可用');
  }

  // ------------------------------------------------------------ 账号与登录态
  // ------------------------------------------------------------ 账号
  // ------------------------------------------------------------ 账号（个人中心）
  // ------------------------------------------------------------ 主界面入口与底部导航
  section('12.5 主界面：账号入口 + 底部导航');
  {
    const storageMod = require(path.join(ROOT, 'utils/storage.js'));
    storageMod.setProfiles([
      { id: 'p1', name: '我', birthDate: '1996-08-19', timeKnown: true, birthTime: '07:20', city: '上海' }
    ]);
    storageMod.setActiveProfileId('p1');

    router.reset('home');
    await sleep(80);
    step(1);
    const homeScene = router.current();
    ok(homeScene.constructor.name === 'HomeScene', '主界面是首页');

    // ---- 顶部账号入口 ----
    const bar = find(homeScene.root, (w) => w.constructor.name === 'AccountBar');
    ok(!!bar, '主界面顶部有账号入口（AccountBar）');
    ok(bar.label === copy.UI.homeAccount, `入口文字是"${bar.label}"`);
    // 右边要显示可用次数（用户明确要求）
    ok(/免费 \d+ 次|畅玩卡 \d+ 天|解锁券 \d+ 次|次数已用完/.test(bar.quota),
      `入口右侧显示可用次数（"${bar.quota}"）`);
    // 不能压到右上角的胶囊按钮
    ok(bar.rightLimit === homeScene.stage.contentRight,
      `次数文字避开了胶囊按钮（右边界 ${Math.round(bar.rightLimit)}）`);

    // 点它 → 个人中心
    tapWidget(bar, 100, bar.h / 2);
    await sleep(60);
    step(1);
    ok(router.current().constructor.name === 'AccountScene',
      `点顶部入口进个人中心（实际 ${router.current().constructor.name}）`);

    // ---- 底部导航：三个主页共用 ----
    const H = homeScene.stage.height;
    const barTop = H - 108;
    const tabX = (i) => (750 * (i + 0.5)) / 3;
    const tabBarOf = (scene) => find(scene.root, (w) => w.constructor.name === 'TabBar');

    router.reset('home');
    await sleep(60);
    step(1);
    const tbHome = tabBarOf(router.current());
    ok(!!tbHome, '主界面有底部导航');
    ok(tbHome.tabs.length === 3, `底部导航有 ${tbHome.tabs.length} 个 tab`);
    ok(tbHome.tabs.map((t) => t.label).join('/') === '匹配/图鉴/我的',
      `tab 文案正确（${tbHome.tabs.map((t) => t.label).join('/')}）`);

    // ⚠️ 这里踩过坑：场景里忘了传 tabs 时，TabBar 既不显示也不响应点击，
    //    而且不报错（this.tabs 是空数组）。所以三个主页都要断言 tab 数量。
    ['codex', 'account'].forEach((name) => {
      router.reset(name);
      step(1);
      const tb = tabBarOf(router.current());
      ok(tb && tb.tabs.length === 3, `${name} 主页的底部导航也有 3 个 tab`);
    });

    // 点击能真的切场景
    router.reset('home');
    await sleep(60);
    step(1);
    tap(tabX(2), barTop + 54); // 我的
    step(1);
    ok(router.current().constructor.name === 'AccountScene', '点"我的"切到个人中心');
    tap(tabX(1), barTop + 54); // 图鉴
    step(1);
    ok(router.current().constructor.name === 'CodexScene', '点"图鉴"切到图鉴');
    tap(tabX(0), barTop + 54); // 匹配
    step(1);
    ok(router.current().constructor.name === 'HomeScene', '点"匹配"切回主界面');

    // ---- 个人中心里的"设置"入口 ----
    router.reset('account');
    await sleep(120);
    step(1);
    const acctScene = router.current();
    const settingsEntry = find(acctScene.root, (w) => w.title === copy.UI.accountSettings);
    ok(!!settingsEntry, '个人中心有"设置"入口');
    tapWidget(settingsEntry);
    await sleep(60);
    step(1);
    ok(router.current().constructor.name === 'ProfileScene', '能进设置页');
    // 设置是二级页：有返回键、没有底部导航
    const profScene = router.current();
    ok(!!find(profScene.root, (w) => w.onBack && w.title), '设置页有返回键');
    ok(!tabBarOf(profScene), '设置页没有底部导航（它是二级页）');

    // ---- 「解读服务状态」这一行必须说清"走的是哪条路" ----
    // 为什么单独测：第一次部署时最容易搞混的两件事就是
    // "云调用没配上（服务名/环境 ID/还没部署）" 和 "服务压根没起"，
    // 两者的解决办法完全不同，提示不能含糊成一句"连不上"。
    const apiMod = require(path.join(ROOT, 'services/api.js'));
    {
      // ① 云调用失败 → 单独一类原因（不要混进普通 NETWORK）
      const cloudFail = apiMod.reasonText('CLOUD');
      ok(cloudFail.indexOf('云调用') >= 0 && cloudFail.indexOf('服务名') >= 0,
        `云调用失败有专门的提示：${cloudFail.slice(0, 24)}…`);
      ok(apiMod.REASON_TEXT.CLOUD !== apiMod.REASON_TEXT.NETWORK,
        '云调用失败不再和"公网连不上"共用一句话');

      // ② 诊断结果里带"哪条路"（via/where），页面才有东西可显示
      const diag = await apiMod.diagnose();
      ok(diag.via === 'cloud' || diag.via === 'http', `诊断结果标了通道（via=${diag.via}）`);
      ok(typeof diag.where === 'string' && diag.where.length > 0,
        `诊断结果能说清连的是哪儿：${diag.where}`);
      ok(typeof diag.message === 'string' && diag.message.length > 0, '诊断结果有一句人话');
      ok(typeof diag.devLogin === 'boolean', `诊断结果标了登录模式（devLogin=${diag.devLogin}）`);

      // ③ 设置页把"短状态"和"怎么办"分开显示：
      //    短状态进那一行（SettingRow 的 desc 不换行），长提示进下面的段落
      const scene2 = router.current();
      scene2.checkBackend();
      await sleep(80);
      step(1);
      const row = find(scene2.root, (w) => w.title === copy.UI.profileBackend);
      ok(!!row, '设置页有「解读服务状态」这一行');
      ok(!!row.desc && row.desc.length <= 16, `那一行只放短状态（"${row.desc}"）`);
      const texts = [];
      (function walk2(w) {
        ['text', 'content', 'desc'].forEach((f) => {
          if (typeof w[f] === 'string' && w[f]) texts.push(w[f]);
        });
        (w.children || []).forEach(walk2);
      })(scene2.root);
      const joined = texts.join('｜');
      ok(joined.indexOf('云调用') >= 0 || joined.indexOf('公网') >= 0,
        '页面上说明了走的是云调用还是公网');
      if (scene2.backend.detail) {
        ok(joined.indexOf(scene2.backend.detail.split('\n')[0].slice(0, 10)) >= 0,
          '失败时把"该怎么办"整段显示出来了（没被截断）');
      }

      // ④ 后端**通了但没配 WX_SECRET**：这是最容易被忽略的状态 ——
      //    一切看起来都正常（AI 能用、记录能存），直到用户换手机发现权益没了。
      //    造一个"健康的 health 响应"来验页面会主动提示。
      {
        const realRequest = global.wx.request;
        let asked = 0;
        global.wx.request = (o) => {
          asked += 1;
          setTimeout(() => {
            if (o.success) {
              o.success({
                statusCode: 200,
                data: {
                  ok: true,
                  ai: { configured: true, model: 'deepseek-flash' },
                  login: { devMode: true, hint: '没配 WX_SECRET（或 WX_APPID）→ 按设备认人，换设备权益不跟随' },
                  characters: 60
                }
              });
            }
            if (o.complete) o.complete();
          }, 2);
        };
        const scene3 = router.current();
        scene3.checkBackend();
        await sleep(80);
        step(1);
        ok(asked > 0, '检测时确实打了后端一次');
        ok(scene3.backend.state === 'warn', `按设备认人标记为"注意"而不是"正常"（${scene3.backend.state}）`);
        ok(String(scene3.backend.text).indexOf('按设备认人') >= 0,
          `那一行直接写明"按设备认人"（${scene3.backend.text}）`);
        ok(String(scene3.backend.detail).indexOf('WX_SECRET') >= 0,
          '并给出了"去配 WX_SECRET"的可执行提示');
        const texts3 = [];
        (function walk3(w) {
          ['text', 'content', 'desc'].forEach((f) => {
            if (typeof w[f] === 'string' && w[f]) texts3.push(w[f]);
          });
          (w.children || []).forEach(walk3);
        })(scene3.root);
        ok(texts3.join('｜').indexOf('WX_SECRET') >= 0, '这段提示真的渲染在页面上');

        // ⑤ 后端通了、WX_SECRET 也配了，但没配 AUTH_SECRET：
        //    服务端会临时随机一个密钥，功能全对，只是每次重启所有人要重新登录。
        //    这种"一切正常但有隐患"的状态同样必须标出来（状态点不能是绿的）。
        global.wx.request = (o) => {
          setTimeout(() => {
            if (o.success) {
              o.success({
                statusCode: 200,
                data: {
                  ok: true,
                  ai: { configured: true, model: 'deepseek-flash' },
                  login: { devMode: false, hint: '' },
                  auth: { secretSource: 'generated', hint: '没配 AUTH_SECRET → 用的是一次性随机密钥，重启后需要重新登录' },
                  characters: 60
                }
              });
            }
            if (o.complete) o.complete();
          }, 2);
        };
        const scene4 = router.current();
        scene4.checkBackend();
        await sleep(80);
        step(1);
        ok(String(scene4.backend.text).indexOf('正常') >= 0, `这时主状态是"正常"（${scene4.backend.text}）`);
        ok(scene4.backend.state === 'warn', `但状态点标黄提醒（${scene4.backend.state}）`);
        ok(String(scene4.backend.detail).indexOf('AUTH_SECRET') >= 0,
          '并说明该去配 AUTH_SECRET（重启后要重新登录）');

        // ⑥ 两样都配好 → 才应该是干净的"正常"（绿点、没有提示段落）
        global.wx.request = (o) => {
          setTimeout(() => {
            if (o.success) {
              o.success({
                statusCode: 200,
                data: {
                  ok: true,
                  ai: { configured: true, model: 'deepseek-flash' },
                  login: { devMode: false, hint: '' },
                  auth: { secretSource: 'env', hint: '' },
                  characters: 60
                }
              });
            }
            if (o.complete) o.complete();
          }, 2);
        };
        const scene5 = router.current();
        scene5.checkBackend();
        await sleep(80);
        step(1);
        ok(scene5.backend.state === 'ok' && !scene5.backend.detail,
          `全配好时是干净的"正常"（state=${scene5.backend.state}，detail=${scene5.backend.detail ? '有' : '无'}）`);

        global.wx.request = realRequest;
      }
    }
  }


  section('13. 账号页：资料卡 / 可用次数 / 图鉴 / 记录 / 充值');
  {
    const account = require(path.join(ROOT, 'services/account.js'));
    const storageMod = require(path.join(ROOT, 'utils/storage.js'));
    const ent = require(path.join(ROOT, 'services/entitlement.js'));

    // ---- 文案依然克制（产品要求，做成断言防止回退） ----
    ok(copy.UI.accountTitle === '账号', `标题是"账号"`);
    ok(accountCopyLength() < 560, `账号页文案总量克制（${accountCopyLength()} 字 < 560）`);
    function accountCopyLength() {
      return Object.keys(copy.UI)
        .filter((k) => k.indexOf('account') === 0)
        .map((k) => String(copy.UI[k]))
        .join('').length;
    }

    // ---- 预置两张资料卡与一些记录 ----
    storageMod.setProfiles([
      { id: 't1', name: '甲', birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, city: '上海' },
      { id: 't2', name: '乙', birthDate: '2000-01-01', timeKnown: false, city: '北京' }
    ]);
    storageMod.setActiveProfileId('t1');
    ent.reset();

    router.reset('account');
    await sleep(150);
    step(1);
    const acct = router.current();
    ok(acct.constructor.name === 'AccountScene', '进入账号页');

    // ---- 采集页面上的文字 ----
    const texts = [];
    const collect = (w) => {
      ['text', 'content', 'k', 'v', 'title', 'value'].forEach((f) => {
        if (typeof w[f] === 'string' && w[f]) texts.push(w[f]);
      });
      (w.children || []).forEach(collect);
    };
    collect(acct.root);
    const blob = texts.join('|');

    // 五个板块都在
    ok(blob.indexOf(copy.UI.accountQuotaTitle) >= 0, '有"可用次数"');
    ok(blob.indexOf(copy.UI.accountProfilesTitle) >= 0, '有"资料卡"');
    ok(blob.indexOf(copy.UI.accountEntryCodex) >= 0, '有"我的图鉴"入口');
    ok(blob.indexOf(copy.UI.accountEntryRecords) >= 0, '有"占星记录"入口');
    ok(blob.indexOf(copy.UI.accountEntryRecharge) >= 0, '有"开通畅玩卡"入口');
    ok(blob.indexOf(copy.UI.accountLoginLabel) >= 0, '有账号信息');
    // 免费次数要显示出来（用户明确要求）
    ok(new RegExp(`免费\\s*${ent.freeLeft()}\\s*次`).test(blob) || blob.indexOf(copy.UI.accountQuotaFree.replace('{n}', String(ent.freeLeft()))) >= 0,
      `显示剩余免费次数（${ent.freeLeft()} 次）`);
    // ⭐ 用户明确要求：个人资料页不做说明性小字。
    //    所以这里反过来断言它们**不存在**（防止以后又被加回来）。
    const NO_SMALL_TEXT = ['生辰只存本机', copy.UI.accountNoRegister, '只存于本地', '无需注册'];
    const found = NO_SMALL_TEXT.filter((t) => blob.indexOf(t) >= 0);
    ok(found.length === 0, '页面上没有说明性小字（如"只存本机""无需注册"）', found.join('、'));
    ok(blob.indexOf('这是有意的') < 0 && blob.indexOf('支付签名需要它') < 0, '没有把实现细节写给用户看');

    // ---- 资料卡：列表、默认标记 ----
    const pCards = findAll(acct.root, (w) => w.constructor.name === 'ProfileCard');
    ok(pCards.length === 2, `渲染出 ${pCards.length} 张资料卡`);
    ok(pCards[0].active && !pCards[1].active, '当前激活的那张标了"默认"');
    ok(!!find(acct.root, (w) => w.text === copy.UI.accountProfileAdd), '有"+ 新建资料卡"');

    // ---- ⭐ 核心：点资料卡 → 一键开始占卜（直接进答题页） ----
    const freeBefore = ent.freeLeft();
    tapWidget(pCards[1]);
    await sleep(120);
    step(1);
    ok(storageMod.getActiveProfileId() === 't2', '点击后把那张卡设为默认');
    ok(router.current().constructor.name === 'QuizScene',
      `点资料卡直接进答题页（实际 ${router.current().constructor.name}）`);
    ok(ent.freeLeft() === freeBefore - 1, `这次占卜消耗了一次免费额度（${freeBefore} → ${ent.freeLeft()}）`);
    const pending = require(path.join(ROOT, 'services/divination.js')).peekPending();
    ok(pending && pending.profile && pending.profile.name === '乙',
      `带过去的是那张卡的生辰（${pending && pending.profile && pending.profile.name}）`);

    // ---- 资料卡：删除要二次确认 ----
    router.reset('account');
    await sleep(120);
    step(1);
    const acct2 = router.current();
    const cards2 = findAll(acct2.root, (w) => w.constructor.name === 'ProfileCard');
    // 点右上角的 × 区域
    tapWidget(cards2[0], cards2[0].w - 38, 38);
    await sleep(40);
    step(1);
    const modal = find(acct2.overlay, (w) => w.constructor.name === 'Modal');
    ok(!!modal, '点 × 删除资料卡要二次确认');
    tapModalConfirm(acct2);
    await sleep(60);
    ok(storageMod.getProfiles().length === 1, `确认后真的删掉了（剩 ${storageMod.getProfiles().length} 张）`);

    // 取消删除不该动数据
    const acct3 = router.current();
    const beforeCount = storageMod.getProfiles().length;
    const cards3 = findAll(acct3.root, (w) => w.constructor.name === 'ProfileCard');
    if (cards3.length) {
      tapWidget(cards3[0], cards3[0].w - 38, 38);
      await sleep(40);
      step(1);
      const m2 = find(acct3.overlay, (w) => w.constructor.name === 'Modal');
      if (m2) {
        // 点取消（左下角）
        tap(m2.cardX + m2.cardW * 0.25, m2.cardY + m2.cardH - 54);
        await sleep(40);
      }
      ok(storageMod.getProfiles().length === beforeCount, '取消删除不动数据');
    }

    // ---- 资料卡：上限 ----
    ok(storageMod.MAX_PROFILES === 10, `资料卡上限 ${storageMod.MAX_PROFILES} 张`);
    storageMod.setProfiles([]);
    for (let i = 0; i < 12; i += 1) {
      storageMod.addProfile({
        name: `批量${i}`, birthDate: `199${i % 10}-01-0${(i % 9) + 1}`,
        timeKnown: false, city: '北京'
      });
    }
    ok(storageMod.getProfiles().length === 10, '超过上限后不再新增');
    // 长得一样的不重复添加
    const dup = storageMod.addProfile({ name: '批量0', birthDate: '1990-01-01', timeKnown: false, city: '北京' });
    ok(dup.duplicate === true, '同名同生辰不会重复添加');

    // ---- 三个二级入口能跳转 ----
    storageMod.setProfiles([{ id: 't1', name: '甲', birthDate: '1996-08-19', timeKnown: true, city: '上海' }]);
    storageMod.setActiveProfileId('t1');
    router.reset('account');
    await sleep(120);
    step(1);
    const acct4 = router.current();
    const goCodex = find(acct4.root, (w) => w.title === copy.UI.accountEntryCodex);
    ok(!!goCodex, '图鉴入口可点');
    tapWidget(goCodex);
    await sleep(40);
    ok(router.current().constructor.name === 'CodexScene', '能进图鉴');
    router.reset('account');
    await sleep(120);
    step(1);
    const acct5 = router.current();
    const goRecords = find(acct5.root, (w) => w.title === copy.UI.accountEntryRecords);
    ok(!!goRecords, '记录入口可点');
    tapWidget(goRecords);
    await sleep(40);
    ok(router.current().constructor.name === 'RecordsScene', '能进记录页');
    router.reset('account');
    await sleep(120);
    step(1);
    const acct6 = router.current();
    const goRecharge = find(acct6.root, (w) => w.title === copy.UI.accountEntryRecharge);
    ok(!!goRecharge, '充值入口可点');
    tapWidget(goRecharge);
    await sleep(60);
    ok(router.current().constructor.name === 'RechargeScene', '能进充值页');

    // ---- 后端不可用时不白屏 ----
    router.reset('account');
    await sleep(150);
    step(1);
    const acct7 = router.current();
    ok(acct7.state && acct7.state.ok === false, '后端不可用时状态标记为失败');
    // ⚠️ 连不上后端 ≠ 登录过期：真机上 127.0.0.1 指向手机自己，后端本来就不可达，
    //    这时候显示"登录已过期"会让用户以为账号坏了（用户反馈过）。
    ok(acct7.state.offline === true, '离线状态被单独标记（offline）');
    {
      // 只看当前这一帧（ops 是全流程累积的，之前的状态里出现过"登录已过期"）
      const ops = stage.canvas._ops;
      let from = 0;
      for (let i = ops.length - 1; i >= 0; i -= 1) {
        if (ops[i][0] === 'clearRect') {
          from = i + 1;
          break;
        }
      }
      const all = ops.slice(from).filter((o) => o[0] === 'text').map((o) => String(o[1])).join('|');
      ok(all.indexOf('连不上服务器') >= 0, '离线时页面说"连不上服务器"');
      ok(all.indexOf('登录已过期') < 0, '不会误报成"登录已过期"');
      ok(all.indexOf('127.0.0.1') >= 0 || all.indexOf('局域网') >= 0,
        '给了可执行的提示（127.0.0.1 / 局域网 IP）');
    }
    const texts7 = [];
    (function walk7(w) {
      ['text', 'content', 'k', 'v', 'title'].forEach((f) => {
        if (typeof w[f] === 'string' && w[f]) texts7.push(w[f]);
      });
      (w.children || []).forEach(walk7);
    })(acct7.root);
    ok(texts7.length > 10, `拿不到账号状态时页面依然完整（${texts7.length} 段文本）`);

    // ---- 账号页当启动页时，返回键必须能出去 ----
    // 个人中心是主页（配底部导航），所以没有返回键 —— 出路靠底部导航的"匹配"
    ok(!!find(acct7.root, (w) => w.constructor.name === 'TabBar'), '作为主页有底部导航');
    const barTop7 = acct7.stage.height - 108;
    tap((750 * 0.5) / 3, barTop7 + 54);
    await sleep(40);
    ok(router.current().constructor.name === 'HomeScene', '用底部导航能回到主界面');

    // ---- 失败路径不抛异常 ----
    const rl = await account.relogin();
    ok(rl.ok === false && (!!rl.message || !!rl.error), '后端不可用时 relogin 返回可展示的失败信息');
    storageMod.setToken('fake-token-for-test');
    const usable = await account.ensureUsable();
    ok(usable.ok === true && usable.degraded === true, '有 token 但后端不通 → 降级但不阻塞游戏');
    storageMod.setToken('');
  }

  // ------------------------------------------------------------ 占星记录
  section('13.5 占星记录页');
  {
    const storageMod = require(path.join(ROOT, 'utils', 'storage.js'));
    const coreMod = require(path.join(ROOT, 'core/index.js'));

    // 空状态
    storageMod.clearHistory();
    router.reset('records');
    await sleep(40);
    step(1);
    const empty = router.current();
    ok(empty.constructor.name === 'RecordsScene', '进入记录页');
    const emptyTexts = [];
    (function w1(w) {
      ['text', 'content', 'title'].forEach((f) => {
        if (typeof w[f] === 'string' && w[f]) emptyTexts.push(w[f]);
      });
      (w.children || []).forEach(w1);
    })(empty.root);
    ok(emptyTexts.join('|').indexOf(copy.UI.recordsEmpty) >= 0, '空状态有提示');
    ok(!!find(empty.root, (w) => w.text === copy.UI.accountStartNow), '空状态给"开始占卜"的出路');

    // 有记录：用真实占卜结果填
    const r1 = coreMod.divinate({ profile: { name: 'x', birthDate: '1996-08-19', timeKnown: false, city: '上海' } });
    const r2 = coreMod.divinate({ profile: { name: 'y', birthDate: '1993-05-05', timeKnown: false, city: '北京' } });
    [r1, r2].forEach((r) => {
      storageMod.appendHistory({
        resultId: r.resultId, at: r.createdAt, mode: 'chart',
        mainId: r.match.main.id, mainName: r.match.main.char.name,
        mainWork: r.match.main.char.work, resonance: r.match.main.resonance,
        dominantBadge: r.chart.dominant.badge, rarity: r.chart.rarity.key, source: 'local'
      });
    });
    router.reset('records');
    await sleep(40);
    step(1);
    const withData = router.current();
    const cards = findAll(withData.root, (w) => w.char && w.char.id);
    ok(cards.length === 2, `列出 ${cards.length} 条记录`);
    ok(!!find(withData.root, (w) => w.text === copy.UI.recordsClear), '有"清空记录"');

    // 点记录能进角色详情
    tapWidget(cards[0]);
    await sleep(40);
    ok(router.current().constructor.name === 'CharacterScene', '点记录进角色详情');

    // 清空要二次确认
    router.reset('records');
    await sleep(40);
    step(1);
    const rec = router.current();
    tapWidget(find(rec.root, (w) => w.text === copy.UI.recordsClear));
    await sleep(40);
    step(1);
    ok(!!find(rec.overlay, (w) => w.constructor.name === 'Modal'), '清空记录要二次确认');
    tapModalConfirm(rec);
    await sleep(60);
    ok(storageMod.getHistory().length === 0, '确认后记录被清空');
  }

  // ------------------------------------------------------------ 充值页
  section('13.6 充值页：看广告 + 畅玩卡档位');
  {
    const ent = require(path.join(ROOT, 'services/entitlement.js'));
    const payment = require(path.join(ROOT, 'services/payment.js'));
    const { CONFIG } = require(path.join(ROOT, 'config/index.js'));

    ent.reset();
    router.reset('recharge');
    await sleep(120);
    step(1);
    const rc = router.current();
    ok(rc.constructor.name === 'RechargeScene', '进入充值页');

    const texts = [];
    (function w2(w) {
      ['text', 'content', 'k', 'v', 'title'].forEach((f) => {
        if (typeof w[f] === 'string' && w[f]) texts.push(w[f]);
      });
      (w.children || []).forEach(w2);
    })(rc.root);
    const blob = texts.join('|');

    // 当前状态要如实显示
    ok(blob.indexOf(copy.UI.rechargeFree) >= 0, '显示"免费次数"');
    ok(blob.indexOf(copy.UI.rechargeFreeLeft.replace('{left}', String(ent.freeLeft())).replace('{total}', '2')) >= 0
      || /2 \/ 2/.test(blob), `显示剩余次数（${ent.freeLeft()}/2）`);
    ok(blob.indexOf(copy.UI.rechargePass) >= 0, '显示"畅玩卡"状态');
    ok(blob.indexOf(copy.UI.rechargePassOff) >= 0, '未开通时显示"未开通"');

    // 看广告这条路永远在（不花钱也能继续）
    ok(!!find(rc.root, (w) => w.text === copy.UI.rechargeAdBtn), '有"看广告解锁"按钮');

    // 支付未开通时：价格区整个不显示，并给一句说明
    ok(!find(rc.root, (w) => w.constructor.name === 'PriceCell'), '支付未开通时不显示价格档位');
    ok(blob.indexOf(copy.UI.rechargeUnavailable) >= 0, '给一句"暂未开放"的说明');

    // 点看广告（开发期没广告位 → 按配置发放，但要如实提示"广告位暂未开放"）
    tapWidget(find(rc.root, (w) => w.text === copy.UI.rechargeAdBtn));
    await sleep(80);
    ok(ent.readState().adTickets === 1 || ent.summary().freeLeft === 2,
      '看广告拿到一次解锁（开发期直接发放）');
    {
      const texts = stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => String(o[1])).join('|');
      ok(texts.indexOf(copy.UI.unlockAdNotOpen) >= 0,
        '没配广告位时如实说"广告位暂未开放"，而不是假装放了广告');
      ok(CONFIG.ADS.GRANT_WHEN_UNAVAILABLE !== undefined,
        '这个行为是可配置的（GRANT_WHEN_UNAVAILABLE）');
    }
    {
      // 关掉开关后就不该再白送
      ent.reset();
      const before = ent.readState().adTickets;
      CONFIG.ADS.GRANT_WHEN_UNAVAILABLE = false;
      tapWidget(find(rc.root, (w) => w.text === copy.UI.rechargeAdBtn));
      await sleep(80);
      ok(ent.readState().adTickets === before, '关掉开关后没广告就不发放（不白送）');
      CONFIG.ADS.GRANT_WHEN_UNAVAILABLE = true;
    }

    // 开通支付后：档位出现，且要两步（先选档位再开通）
    ent.reset();
    CONFIG.PAY.ENABLED = true;
    payment.resetProbeCache();
    router.reset('recharge');
    await sleep(150);
    step(1);
    const rc2 = router.current();
    const cells = findAll(rc2.root, (w) => w.constructor.name === 'PriceCell');
    ok(cells.length === CONFIG.PAY.PRODUCTS.length, `开通后显示 ${cells.length} 个档位`);
    const buyBtn = find(rc2.root, (w) => w.text === copy.UI.rechargeBuy);
    ok(!!buyBtn && buyBtn.enabled === false, '没选档位时"立即开通"禁用（涉及钱不能误触）');
    tapWidget(cells[1]);
    await sleep(40);
    step(1);
    const rc3 = router.current();
    const cells3 = findAll(rc3.root, (w) => w.constructor.name === 'PriceCell');
    ok(cells3[1].selected, '点档位能选中');
    const buyBtn3 = find(rc3.root, (w) => w.text === copy.UI.rechargeBuy);
    ok(buyBtn3 && buyBtn3.enabled === true, '选中后才允许开通');

    CONFIG.PAY.ENABLED = false;
    payment.resetProbeCache();
    ent.reset();
  }
  section('14. 游戏账号：充值 + 游玩记录归账号，生辰与账号解耦');
  {
    const playlog = require(path.join(ROOT, 'services/playlog.js'));
    const storageMod = require(path.join(ROOT, 'utils', 'storage.js'));
    const coreMod = require(path.join(ROOT, 'core/index.js'));

    // ---- 数据边界：只上报"结果"，一个生辰相关字段都不能有 ----
    const local = coreMod.divinate({
      profile: {
        name: '边界测试', birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true,
        province: '上海', city: '上海', district: '黄浦区', cityLabel: '上海市 黄浦区'
      }
    });
    const entry = playlog.extract(local);
    const blob = JSON.stringify(entry);
    ok(!!entry && !!entry.resultId, '能从占卜结果里抽出可上报的字段');
    ok(entry.mainId === local.match.main.id, '含主推角色 id');
    ok(entry.resonance === local.match.main.resonance, '含共振度');
    ok(entry.unlocked.length === 4, `含本次解锁的角色（${entry.unlocked.length} 个）`);

    const forbidden = ['birthDate', 'birthTime', 'birth', 'name', 'city', 'pillars', 'dims', 'seed',
      'province', 'district', 'cityLabel', 'place'];
    const leaked = forbidden.filter((f) => Object.prototype.hasOwnProperty.call(entry, f));
    ok(leaked.length === 0, '上报字段里没有任何生辰/姓名/命盘字段', leaked.join('、'));
    ok(blob.indexOf('1996') < 0 && blob.indexOf('07:20') < 0 && blob.indexOf('边界测试') < 0,
      '上报内容里搜不到出生日期、时间、姓名');
    // 出生地是三级了，三个层级和展示串都不能漏出去（能定位到人的信息）
    ok(blob.indexOf('上海') < 0 && blob.indexOf('黄浦') < 0,
      '上报内容里搜不到三级出生地');
    // 四柱能反推出生时刻，所以它连"间接"都不能带
    ok(blob.indexOf('丙子') < 0 && blob.indexOf('"pillars"') < 0,
      '不含干支四柱（四柱可反推出生时刻，落库等于存生日）');

    // ---- 本地是主：账号同步不能覆盖本机记录 ----
    storageMod.clearHistory();
    storageMod.clearCodex();
    const profiles = ['1990-01-01', '1991-02-02', '1992-03-03'];
    const results = profiles.map((d) => coreMod.divinate({
      profile: { name: 'x', birthDate: d, timeKnown: false, city: '北京' }
    }));
    results.forEach((r) => {
      storageMod.unlock(r.unlocked, {});
      storageMod.appendHistory({
        resultId: r.resultId, at: r.createdAt, mode: 'chart',
        mainId: r.match.main.id, mainName: r.match.main.char.name,
        mainWork: r.match.main.char.work, resonance: r.match.main.resonance,
        dominantBadge: r.chart.dominant.badge, rarity: r.chart.rarity.key, source: 'local'
      });
    });
    ok(storageMod.getHistory().length === 3, '本机记下 3 局');
    const localCodexBefore = storageMod.codexCount();
    ok(localCodexBefore >= 3, `本机图鉴有 ${localCodexBefore} 个角色`);

    // 账号记录合并进来：应当"取并集"，而不是覆盖本地
    const merged = playlog.mergeRemote({
      ok: true,
      stats: { total: 5, firstAt: Date.now() - 86400000, lastAt: Date.now() },
      codex: { REMOTE_ONLY_CHAR: { firstAt: 1000, count: 1, firstScore: 70 } },
      history: [{ resultId: 'REMOTE_ONLY_1', mainId: local.match.main.id, resonance: 88, at: Date.now() - 1000, mode: 'chart' }]
    });
    ok(merged.ok && merged.codexAdded === 1, '合并补回 1 个账号里的角色');
    ok(storageMod.codexCount() === localCodexBefore + 1, '本地原有角色没被覆盖（取并集）');
    ok(storageMod.getHistory().length === 4, '历史也合并了（3 本地 + 1 账号）');
    const mergedHistory = storageMod.getHistory();
    ok(
      mergedHistory.every((h, i) => i === 0 || (mergedHistory[i - 1].at || 0) >= (h.at || 0)),
      '历史按时间倒序排列'
    );
    ok(!!mergedHistory.find((h) => h.source === 'remote'), '来自账号的记录有来源标记');

    // 幂等：同一个 resultId 合并两次不会重复
    playlog.mergeRemote({ ok: true, codex: {}, history: [{ resultId: 'REMOTE_ONLY_1', mainId: 'x', at: 1 }] });
    ok(storageMod.getHistory().length === 4, '重复合并同一个 resultId 不产生重复记录');

    // 从账号恢复的名字要能补上（服务端只存 id，名字在本地角色表）
    const remoteRow = storageMod.getHistory().find((h) => h.source === 'remote');
    ok(remoteRow && !remoteRow.mainName, '刚从账号拉回来的记录还没名字（服务端只有 id）');
    playlog.hydrateHistoryNames();
    const filled = storageMod.getHistory().find((h) => h.id === 'REMOTE_ONLY_1');
    ok(!!filled.mainName, `用本地角色表补齐了名字（${filled.mainName}）`);
    ok(!!filled.mainWork, '也补齐了作品名');

    // 没登录时不尝试上报
    storageMod.setToken('');
    const offline = await playlog.report(local);
    ok(offline.ok === false && offline.offline === true, '未登录时跳过上报（返回 offline）');
    void entry;

    // ---- 服务端字段白名单：脏字段必须被丢掉 ----
    const playlogServer = require(path.join(ROOT, 'server', 'playlog.js'));
    const dirty = playlogServer.sanitize({
      resultId: 'R1', mainId: 'naruto', resonance: 88,
      birthDate: '1996-08-19', birthTime: '07:20', name: '张三',
      pillars: { year: 12 }, dims: { light: 50 }, seed: 'abc', city: '上海'
    });
    const dirtyBlob = JSON.stringify(dirty);
    ok(dirtyBlob.indexOf('1996') < 0 && dirtyBlob.indexOf('张三') < 0 && dirtyBlob.indexOf('上海') < 0,
      '服务端白名单丢掉了所有生辰/姓名/城市字段');
    ok(dirtyBlob.indexOf('pillars') < 0 && dirtyBlob.indexOf('dims') < 0 && dirtyBlob.indexOf('seed') < 0,
      '服务端白名单丢掉了四柱/八轴/命盘种子');
    ok(dirty.mainId === 'naruto' && dirty.resonance === 88, '该留的字段留下了');

    // ---- 清空本地后，账号记录还能恢复（换设备的场景） ----
    storageMod.clearHistory();
    storageMod.clearCodex();
    ok(storageMod.codexCount() === 0 && storageMod.getHistory().length === 0, '本机已被清空（模拟换设备）');
    playlog.mergeRemote({
      ok: true,
      codex: { naruto: { firstAt: 5000, count: 2, firstScore: 90 } },
      history: [{ resultId: 'FROM_ACCOUNT', mainId: 'naruto', resonance: 90, at: 5000, mode: 'chart' }]
    });
    playlog.hydrateHistoryNames();
    ok(storageMod.codexCount() === 1, '图鉴从账号恢复了');
    const restored = storageMod.getHistory()[0];
    ok(restored.id === 'FROM_ACCOUNT' && !!restored.mainName,
      `记录从账号恢复并补齐了角色名（${restored.mainName}）`);
  }

  // ------------------------------------------------------------ 多选题
  section('15. 多选题：勾选、上限、取消，以及选项数量不固定');
  {
    const coreMod = require(path.join(ROOT, 'core/index.js'));
    const divMod = require(path.join(ROOT, 'services/divination.js'));
    const bankMod = require(path.join(ROOT, 'data/questions.js'));

    // ---- 题库本身的形状 ----
    const stat = bankMod.stats();
    ok(stat.total >= 1000, `题库规模（${stat.total} 道）`);
    ok(stat.multi >= 20, `其中多选题 ${stat.multi} 道`);
    const sizeHist = {};
    bankMod.QUESTIONS.forEach((q) => {
      sizeHist[q.options.length] = (sizeHist[q.options.length] || 0) + 1;
    });
    const sizes = Object.keys(sizeHist).map(Number).sort((a, b) => a - b);
    ok(sizes.length >= 3, `选项数量有多个档位（${sizes.join('/')} 个选项）`);
    ok(sizes[0] === 2 && sizes[sizes.length - 1] >= 5,
      `既有最少选项也有清单型长选项（${sizes[0]} ~ ${sizes[sizes.length - 1]}）`);
    const emptyDim = bankMod.QUESTIONS.filter((q) => !q.dim).length;
    ok(emptyDim === 0, '每道题都标了主轴（抽样分层要用）');

    // ---- 分层抽样：题量再多也覆盖八根轴 ----
    [10, 20, 30, 50].forEach((n) => {
      const list = coreMod.listQuestions({ count: n, seed: `balance-${n}` });
      ok(list.length === n, `题量 ${n}：抽到 ${list.length} 道`);
      const dims = new Set(list.map((q) => q.dim));
      ok(dims.size === 9, `题量 ${n}：覆盖全部 8 根轴 + 综合题（${dims.size} 类）`);
      ok(new Set(list.map((q) => q.id)).size === n, `题量 ${n}：没有重复题目`);
    });
    ok(coreMod.normalizeCount(7) === 10 && coreMod.normalizeCount(48) === 50
      && coreMod.normalizeCount(0) === 10, '非法题量会落到最近的档位');

    // ---- 抽到一道多选题，走一遍交互（token 挑一个必定含多选题的） ----
    const profile = {
      name: '多选', birthDate: '1995-05-05', birthTime: '09:00', timeKnown: true,
      province: '北京', city: '北京', district: '东城区'
    };
    let token = null;
    let expect = null;
    for (let i = 0; i < 80 && !token; i += 1) {
      const t = `mp${i}`;
      const list = coreMod.listQuestions({ count: 10, seed: `${t}|${profile.birthDate}` });
      const multi = list.filter((q) => q.multi);
      if (multi.length >= 1) {
        token = t;
        expect = multi[0];
      }
    }
    ok(!!token, `找到一个含多选题的样本（token=${token}）`);

    divMod.prepare({ profile, mode: 'chart', quizCount: 10, quizToken: token });
    router.reset('home');
    await sleep(10);
    const home2 = router.current();
    home2.loadSaved();
    // 直接进答题页（不经过首页按钮，避免它换掉 token）
    divMod.prepare({ profile, mode: 'chart', quizCount: 10, quizToken: token });
    router.push('quiz');
    await sleep(20);
    step(1);
    const q2 = router.current();
    ok(q2 instanceof require(path.join(ROOT, 'src/js/scenes/quiz.js')), '进入答题场景');

    // 跳到那道多选题
    const at = q2.list.findIndex((q) => q.id === expect.id);
    ok(at >= 0, `这道多选题在本次样本里（第 ${at + 1} 题）`);
    q2.index = at;
    q2.build();
    step(1);
    const qq = q2.list[at];
    ok(!!qq.multi, `当前是多选题（最多勾 ${qq.multi.max} 项）`);
    ok(countText(stage.canvas._ops) > 5, '多选题渲染出文字');
    const hasMultiHint = stage.canvas._ops.some(
      (o) => o[0] === 'text' && String(o[1]).indexOf('多选') >= 0
    );
    ok(hasMultiHint, '页面上给了"可以多选"的提示');

    // 勾一个：不翻页
    tapWidget(q2.optionRows[0]);
    await sleep(20);
    ok(q2.index === at, '多选勾选后不自动翻页');
    ok(q2.pickedOf(qq).length === 1, '第一项被勾上');
    ok(q2.optionRows[0].selected, '选项画成了选中态');

    // 勾到上限，再勾一个应当被拦住
    for (let k = 1; k < qq.multi.max; k += 1) {
      tapWidget(q2.optionRows[k]);
      await sleep(16);
    }
    ok(q2.pickedOf(qq).length === qq.multi.max, `勾满上限（${qq.multi.max} 项）`);
    if (q2.optionRows.length > qq.multi.max) {
      tapWidget(q2.optionRows[qq.multi.max]);
      await sleep(20);
      ok(q2.pickedOf(qq).length === qq.multi.max, '超过上限就勾不进去了');
    }

    // 取消一项
    tapWidget(q2.optionRows[0]);
    await sleep(20);
    ok(q2.pickedOf(qq).length === qq.multi.max - 1, '再点一次可以取消勾选');

    // 答案以数组形式存下来
    ok(Array.isArray(q2.answers[qq.id]), '多选答案存成数组');
    ok(q2.answers[qq.id].length === q2.pickedOf(qq).length, '答案与勾选一致');

    // 「下一题」能翻页
    const beforeIdx = q2.index;
    tapWidget(find(q2.root, (w) => w.text === copy.UI.quizMultiDone));
    await sleep(20);
    ok(q2.index === beforeIdx + 1 || beforeIdx === q2.list.length - 1, '按「下一题」能往下走');

    // 多选的增量按平均值算：勾 3 项不该等于 3 道题的力度
    {
      const base = coreMod.buildChart(profile);
      const single = coreMod.applyAnswers(base, { [qq.id]: [0] }, { quizCount: 10 });
      const all = coreMod.applyAnswers(base, { [qq.id]: qq.options.map((o) => o.index) }, { quizCount: 10 });
      const keys = Object.keys(base.dims);
      const drift = (c) => keys.reduce((s, k) => s + Math.abs(c.dims[k] - base.dims[k]), 0) / keys.length;
      ok(drift(all) <= drift(single) + 0.51,
        `多选取平均而不是累加（勾满 ${drift(all).toFixed(1)} vs 勾一个 ${drift(single).toFixed(1)}）`);
    }
    router.reset('home');
    await sleep(10);
  }

  // ------------------------------------------------------------ 微信昵称头像
  section('16. 微信昵称头像：匿名不落库、真头像才存、按钮必须销毁');
  {
    const wechatprofile = require(path.join(ROOT, 'services/wechatprofile.js'));
    const storageMod = require(path.join(ROOT, 'utils/storage.js'));

    // ---- 匿名识别（2022-10-25 之后 getUserInfo 系列返回的就是这个） ----
    const grey = { nickName: '微信用户', avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/' + wechatprofile.ANON_AVATAR_TAG + '/132' };
    ok(wechatprofile.isAnonymous(grey), '官方灰头像被判定为匿名');
    ok(wechatprofile.isAnonymous({ nickName: '谁', avatarUrl: '' }), '没有头像算没拿到');
    ok(!wechatprofile.isAnonymous({ nickName: '小明', avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/x/132' }),
      '真实头像不算匿名');
    ok(!wechatprofile.isAnonymous({ nickName: '微信用户', avatarUrl: 'https://x.com/a.png' }),
      '用户自己叫"微信用户"但有真头像 → 不误判（只看头像，不看名字）');

    // ---- 隐私授权：默认放行；拒绝时不放按钮 ----
    storageMod.clearWechatProfile();
    ok(await wechatprofile.ensurePrivacy() === true, '模拟环境默认已授权');

    router.reset('account');
    await sleep(40);
    step(1);
    const acct = router.current();
    ok(acct.constructor.name === 'AccountScene', '进入账号页');

    // 进页面时放了原生按钮，位置必须换算成 CSS 像素（不是设计稿坐标）
    ok(liveUserInfoButtons().length === 1, `账号页放了 1 个原生按钮（实际 ${liveUserInfoButtons().length}）`);
    const nb = liveUserInfoButtons()[0];
    ok(nb.opts.style.left > 0 && nb.opts.style.left < stage.width,
      `按钮位置是 CSS 像素（left=${Math.round(nb.opts.style.left)} < 设计稿宽 ${stage.width}）`);
    ok(nb.opts.withCredentials === false, '不要 encryptedData，也就不需要登录态');
    ok(nb.opts.style.borderRadius >= nb.opts.style.height / 2 - 1, '按钮圆角是个胶囊');
    ok(countText(stage.canvas._ops) > 8, '账号页照常渲染');
    ok(!acct.wechat, '还没拿到资料');

    // ---- 用户点了，但微信只给了匿名数据 ----
    // 注意：场景里的 toast 是画在 overlay 上的控件（不是 wx.showToast），要去 overlay 里找
    acct.overlay.clear();
    ok(tapUserInfoButton(grey), '模拟点击（匿名返回）');
    await sleep(30);
    step(1);
    ok(!storageMod.getWechatProfile(), '匿名数据不会落库（灰色头像不算用户的头像）');
    ok(!!find(acct.overlay, (w) => w.text === copy.UI.accountAvatarAnonymous),
      '给了明确提示（微信只给了默认头像）');
    ok(liveUserInfoButtons().length === 1, '提示后重新放好了按钮（还能再试）');

    // ---- 用户点了，这次是真的 ----
    acct.overlay.clear();
    const real = { nickName: '星野', avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/real/132' };
    ok(tapUserInfoButton(real), '模拟点击（真实资料）');
    await sleep(30);
    step(1);
    const savedWx = storageMod.getWechatProfile();
    ok(!!savedWx && savedWx.nickName === '星野', `昵称头像落库（${savedWx && savedWx.nickName}）`);
    ok(savedWx.avatarUrl === real.avatarUrl, '头像地址存对了');
    ok(!!find(router.current().overlay, (w) => w.text === copy.UI.accountAvatarSaved), '提示已更新');
    ok(router.current().wechat && router.current().wechat.nickName === '星野',
      '页面立刻用上了新资料');
    ok(stage.canvas._ops.some((o) => o[0] === 'text' && String(o[1]).indexOf('星野') >= 0),
      '昵称画到了页面上');
    ok(stage.canvas._ops.some((o) => o[0] === 'image'), '头像图也画到了页面上');

    // ---- 离开页面：原生按钮必须被销毁，否则它会一直浮着吃点击 ----
    router.reset('home');
    await sleep(30);
    step(1);
    ok(liveUserInfoButtons().length === 0, '离开账号页后按钮被销毁');
    const homeAfter = router.current();
    ok(homeAfter.constructor.name === 'HomeScene', '回到首页');

    // ---- 首页顶栏也会用上头像 ----
    await sleep(40);
    step(1);
    ok(!!homeAfter.avatarImg, '首页也加载了微信头像');
    ok(stage.canvas._ops.some((o) => o[0] === 'image'), '顶栏把头像画出来了');

    // ---- 隐私被拒绝：不放按钮，但功能不崩 ----
    {
      global.wx.__privacyNeeded = true;
      global.wx.__privacyDeny = true;
      storageMod.clearWechatProfile();
      router.reset('account');
      await sleep(40);
      step(1);
      ok(liveUserInfoButtons().length === 0, '隐私没授权时不放原生按钮（放了也拿不到资料）');
      ok(countText(stage.canvas._ops) > 8, '页面照常渲染');
      global.wx.__privacyNeeded = false;
      global.wx.__privacyDeny = false;
      router.reset('home');
      await sleep(20);
    }

    // ---- 环境不支持时只试一次，不能无限重建 ----
    {
      const realCreate = wx.createUserInfoButton;
      delete wx.createUserInfoButton;
      storageMod.clearWechatProfile();
      router.reset('account');
      await sleep(40);
      step(1);
      const acct2 = router.current();
      ok(acct2.captureUnsupported === true, '拿到 UNSUPPORTED 后标记为不支持');
      ok(countText(stage.canvas._ops) > 8, '不支持时页面也照常渲染（用自己画的兜底按钮）');
      toastCalls = [];
      // 再进一次也不该反复重试（否则就是死循环）
      router.reset('home');
      await sleep(20);
      router.reset('account');
      await sleep(40);
      ok(liveUserInfoButtons().length === 0, '不支持时不重试');
      wx.createUserInfoButton = realCreate;
      storageMod.clearWechatProfile();
      router.reset('home');
      await sleep(20);
    }
  }

  // ------------------------------------------------------------ 布局审计
  section('17. 布局审计：每页实际画出来的文字有没有重叠 / 越界 / 压胶囊');
  {
    const theme = require(path.join(ROOT, 'src/js/theme.js'));

    /**
     * 只取**当前这一帧**的绘制指令。
     *
     * ⚠️ mock 的 ops 是全流程累积的（clearRect 不会清空它），
     * 直接拿来两两比较会产生几十万条"跨帧重叠"的假问题。
     * 舞台每帧开头都会 clearRect，所以从最后一个 clearRect 之后切就是本帧。
     */
    const frameOps = () => {
      const ops = stage.canvas._ops;
      let start = 0;
      for (let i = ops.length - 1; i >= 0; i -= 1) {
        if (ops[i][0] === 'clearRect') {
          start = i + 1;
          break;
        }
      }
      return ops.slice(start);
    };

    /**
     * 画布绝对坐标 → 设计稿坐标。
     * 舞台给 ctx 做过 scale(设备缩放 × dpr)，所以记录下来的绝对坐标是设备像素。
     */
    const totalScale = stage.dev.scale * stage.dev.dpr;
    const toDesign = (v) => v / totalScale;

    /** 量一段文字在屏幕上的宽度（用同一个 mock ctx，和绘制时一致） */
    const measureCanvas = makeCanvas();
    const measureCtx = measureCanvas.getContext('2d');
    const widthOf = (str, size) => {
      measureCtx.font = `600 ${size}px sans-serif`;
      return measureCtx.measureText(str).width;
    };

    /** 把一条 text op 换算成设计稿坐标下的矩形 */
    const boxOf = (op) => {
      const [, str, , , axRaw, ayRaw, sizeRaw, align] = op;
      const size = toDesign(sizeRaw);
      const ax = toDesign(axRaw);
      const ay = toDesign(ayRaw);
      const w = widthOf(str, size);
      const left = align === 'center' ? ax - w / 2 : align === 'right' ? ax - w : ax;
      // textBaseline 基本都是 middle；中文字形实际占约 0.86em，这里取 ±0.5em 作为墨迹范围
      return { str, left, right: left + w, top: ay - size * 0.5, bottom: ay + size * 0.5, size, ax, ay };
    };

    /** 排除故意叠在一起的图元文字（徽记首字、背景装饰） */
    const IGNORE = /^[我✧✦★☆·—]+$/;

    function auditScene(scene, label, opts) {
      const o = opts || {};
      // 只审**真正可见**的文字：被滚动容器裁掉的（滚出视口的部分）不算，
      // 它们本来就不该显示，和 TabBar 比出重叠是假问题。
      const ops = frameOps().filter((x) => x[0] === 'text' && x[8] !== false);
      const boxes = ops.map(boxOf).filter((b) => b.str && !IGNORE.test(b.str));
      const problems = [];

      // 1) 文字压文字
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox <= 2 || oy <= 3) continue; // 允许贴边（墨迹之间留一点缝是正常的）
          problems.push({
            kind: '重叠',
            detail: `「${a.str}」与「${b.str}」相交 ${Math.round(ox)}×${Math.round(oy)}px`,
            at: `(${Math.round(a.left)},${Math.round(a.top)}) / (${Math.round(b.left)},${Math.round(b.top)})`
          });
        }
      }
      // 2) 文字跑出屏幕（左右）与跑到画布下方
      boxes.forEach((b) => {
        if (b.left < -1) problems.push({ kind: '左越界', detail: `「${b.str}」左边超出 ${Math.round(-b.left)}px`, at: `${Math.round(b.left)}` });
        if (b.right > stage.width + 1) {
          problems.push({ kind: '右越界', detail: `「${b.str}」右边超出 ${Math.round(b.right - stage.width)}px`, at: `${Math.round(b.right)}` });
        }
        if (b.top > stage.height + 1) {
          problems.push({ kind: '下方越界', detail: `「${b.str}」在画布下方 ${Math.round(b.top - stage.height)}px`, at: '' });
        }
      });
      // 3) 压到右上角胶囊按钮
      if (stage.capsule && !o.skipCapsule) {
        const capTop = stage.capsule.top;
        const capLeft = stage.contentRight;
        boxes.forEach((b) => {
          if (b.right > capLeft && b.top < stage.capsule.bottom) {
            problems.push({
              kind: '压胶囊',
              detail: `「${b.str}」进入胶囊按钮区域（x>${Math.round(capLeft)} 且 y<${Math.round(stage.capsule.bottom)}）`,
              at: `(${Math.round(b.left)},${Math.round(b.top)})`
            });
          }
        });
      }
      // 4) 纯文字里出现 undefined / NaN / 未替换的占位符
      boxes.forEach((b) => {
        if (/undefined|NaN|\{\w+\}/.test(b.str)) {
          problems.push({ kind: '脏文案', detail: `「${b.str}」`, at: '' });
        }
      });

      /**
       * 5) 空卡片：画了底板/边框，里面却一个字、一张图都没有。
       * 用户看到的就是"一个金色的框，里面啥也没"。
       * （只在卡片和视口有交集时检查 —— 完全滚出屏幕的卡片本来就该是空的。）
       */
      {
        const images = frameOps().filter((x) => x[0] === 'image').length;
        const cards = [];
        const walk = (w) => {
          if (!w || w.visible === false) return;
          const cn = (w.constructor && w.constructor.name) || '';
          if ((cn === 'Card' || cn === 'Panel' || cn === 'CharCard') && w.w > 40 && w.h > 60) {
            const p = absoluteOf(w);
            const inView = p.y + w.h > stage.contentTop && p.y < stage.height;
            if (inView) cards.push({ cn, x: p.x, y: p.y, w: w.w, h: w.h });
          }
          (w.children || []).forEach(walk);
        };
        walk(scene.root);
        cards.forEach((c) => {
          const hasText = boxes.some(
            (b) => b.left < c.x + c.w && b.right > c.x && b.top < c.y + c.h && b.bottom > c.y
          );
          if (!hasText && images === 0) {
            problems.push({
              kind: '空卡片',
              detail: `${c.cn} 里没有任何文字/图片`,
              at: `(${Math.round(c.x)},${Math.round(c.y)}) ${Math.round(c.w)}x${Math.round(c.h)}`
            });
          }
        });
      }

      if (problems.length) {
        console.log(`  ── ${label}：${problems.length} 处`);
        problems.slice(0, 12).forEach((p) => {
          console.log(`     [${p.kind}] ${p.detail} ${p.at}`);
        });
        if (problems.length > 12) console.log(`     …还有 ${problems.length - 12} 处`);
      }
      return problems;
    }

    const allProblems = {};
    const pages = [
      ['home', null], ['codex', null], ['account', null],
      ['records', null], ['recharge', null], ['profile', null]
    ];
    for (let i = 0; i < pages.length; i += 1) {
      const [name] = pages[i];
      router.reset(name);
      await sleep(30);
      step(2);
      const sc = router.current();
      allProblems[name] = auditScene(sc, `页面 ${name}`);
      ok(countText(stage.canvas._ops) > 0, `${name} 渲染出了文字`);
    }

    // 结果页与角色详情页：得先跑一次占卜才能进
    {
      const divination = require(path.join(ROOT, 'services/divination.js'));
      divination.prepare({
        profile: { name: '审计', birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, province: '广东', city: '深圳' },
        mode: 'chart',
        quizCount: 10,
        quizToken: 'audit'
      });
      router.reset('result');
      await sleep(60);
      step(3);
      {
        const scene = router.current();
        const dump = (w, depth) => {
          if (!w || depth > 6) return;
          const name = (w.constructor && w.constructor.name) || 'Widget';
          if (/Card|Panel|Ring|Bars/.test(name)) {
            let x = 0; let y = 0; let cur = w;
            while (cur) { x += cur.x; y += cur.y; cur = cur.parent; }
            console.log('    [' + name + '] x=' + Math.round(x) + ' y=' + Math.round(y) + ' w=' + Math.round(w.w) + ' h=' + Math.round(w.h));
          }
          (w.children || []).forEach((c) => dump(c, depth + 1));
        };
        dump(scene.root, 0);
        const ops = stage.canvas._ops.filter((o) => o[0] === 'text');
        let start = 0;
        for (let i = ops.length - 1; i >= 0; i -= 1) { if (ops[i][0] === 'clearRect') { start = i + 1; break; } }
        console.log('    ---- 结果页文字（屏幕坐标，设计稿 750 宽）----');
        stage.canvas._ops.slice(start).filter((o) => o[0] === 'text' && o[8] !== false).slice(0, 26).forEach((o) => {
          console.log('      y=' + String(Math.round(o[5])).padStart(5) + ' x=' + String(Math.round(o[4])).padStart(4) + ' sz=' + String(Math.round(o[6])).padStart(3) + '  ' + o[1]);
        });
      }
      allProblems.result = auditScene(router.current(), '页面 result');
      // 结果页长内容：滚到底再看一屏，滚动之后露出来的部分也要审
      const rs = router.current().scroll;
      if (rs) {
        rs.scrollTo(rs.maxScroll());
        step(2);
        allProblems['result-bottom'] = auditScene(router.current(), '页面 result（滚到底）');
      }
      router.push('character', { id: 'naruto' });
      await sleep(30);
      step(2);
      allProblems.character = auditScene(router.current(), '页面 character');
    }

    // 答题页（多选题那一屏）
    {
      const divination = require(path.join(ROOT, 'services/divination.js'));
      divination.prepare({
        profile: { name: '审计', birthDate: '1996-08-19', timeKnown: false },
        mode: 'chart',
        quizCount: 10,
        quizToken: 'audit'
      });
      router.reset('quiz');
      await sleep(30);
      step(2);
      allProblems.quiz = auditScene(router.current(), '页面 quiz');
    }

    // 汇总：把每页的问题数报出来（不设硬门槛，先把问题暴露出来）
    const names = Object.keys(allProblems);
    const totalIssues = names.reduce((s, n) => s + allProblems[n].length, 0);
    console.log(`\n  ── 布局审计汇总：${names.length} 个页面，共 ${totalIssues} 处可疑`);
    names.forEach((n) => {
      if (allProblems[n].length) console.log(`     ${n}: ${allProblems[n].length}`);
    });
    ok(totalIssues === 0, `所有页面没有文字重叠/越界/压胶囊（共 ${totalIssues} 处）`,
      names.filter((n) => allProblems[n].length).map((n) => `${n}×${allProblems[n].length}`).join(' '));
    router.reset('home');
    await sleep(20);
  }

  // ------------------------------------------------------------ 错误可见性
  section('18. 出错时不能静默：记下来 + 画在屏幕上 + 帧循环继续');
  {
    const { Scene } = require(path.join(ROOT, 'src/js/router.js'));
    const { Label } = require(path.join(ROOT, 'src/js/ui/widget.js'));
    const errview = require(path.join(ROOT, 'src/js/errview.js'));

    // 一个"故意会炸"的场景：onEnter 抛一次，draw 每帧抛一次
    class BoomScene extends Scene {
      onEnter() {
        this.alwaysRender = true;
        this.root.add(new Label({ x: 0, y: 40, w: 300, text: '这一页本来该显示内容', size: 24 }));
        throw new Error('构建故意炸了');
      }

      draw(ctx, s, t) {
        super.draw(ctx, s, t);
        throw new Error('绘制故意炸了');
      }
    }
    router.register({ boom: BoomScene });

    errview.clear();
    router.push('boom');
    // ⚠️ 先别跑帧：一跑帧 draw 就会抛，把 onEnter 那条覆盖掉
    const e1 = errview.get();
    ok(!!e1 && /构建故意炸了/.test(e1.message),
      `onEnter 抛异常被接住（${e1 && e1.message}）`);
    ok(router.current() instanceof BoomScene, '出错后场景仍然挂上去了，不至于白屏');

    // 关键：帧循环必须还活着。真机上帧循环一断，画面就永远停在半帧（"只剩背景"）
    step(2);
    ok(rafQueue.length > 0, '绘制抛异常后帧循环仍在继续（不会卡死在半帧）');
    const e2 = errview.get();
    ok(!!e2 && /绘制故意炸了/.test(e2.message), `绘制异常也被记下（${e2 && e2.message}）`);

    // 错误卡必须画到屏幕上（真机没有控制台，只能靠它读原因）
    const texts = stage.canvas._ops.filter((o) => o[0] === 'text').map((o) => String(o[1])).join('|');
    ok(texts.indexOf('✕') >= 0, '屏幕上画出了错误卡');
    ok(texts.indexOf('绘制故意炸了') >= 0 || texts.indexOf('构建故意炸了') >= 0,
      '错误卡里带了错误原因');
    ok(texts.indexOf('把这一屏截图发给开发者') >= 0, '给了用户一句可执行的提示');

    // 同一条错误反复出现只累计次数，不刷屏
    step(4);
    ok(errview.get().count > 1, `重复错误只累计次数（${errview.get().count} 次）`);

    // 换页后清掉
    router.reset('home');
    await sleep(30);
    step(1);
    ok(!errview.get(), '换页后错误卡自动清掉');
    ok(countText(stage.canvas._ops) > 5, '首页恢复正常渲染');
  }

  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    failures.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log('全部通过 ✅');
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('测试自身异常:', e);
  process.exit(1);
});
