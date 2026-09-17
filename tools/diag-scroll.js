/* eslint-disable no-console */
/**
 * 滚动诊断：找出"页面划不动"的真实原因。
 *   node tools/diag-scroll.js
 *
 * 无头测试里滚动是通过的，所以问题一定在"真机特有的差异"上。
 * 这个脚本把机型尺寸、安全区、胶囊位置参数化，逐个配置跑真实的滑动序列，
 * 并把输入层的状态机逐帧打出来 —— 不猜，用数据定位。
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------- 桩

function makeCtx() {
  const o = {
    font: '16px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    globalAlpha: 1, textAlign: 'left', textBaseline: 'top', lineCap: 'butt',
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    rect() {}, arc() {}, fill() {}, stroke() {}, clip() {}, fillRect() {}, clearRect() {},
    strokeRect() {}, setLineDash() {}, fillText() {}, drawImage() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText(t) {
      const s = parseFloat(o.font) || 16;
      let w = 0;
      for (const ch of String(t)) w += ch.charCodeAt(0) > 0x2e80 ? s : s * 0.55;
      return { width: w };
    }
  };
  return o;
}
const makeCanvas = () => {
  const c = { width: 0, height: 0, getContext() { if (!c._c) c._c = makeCtx(); return c._c; }, toTempFilePathSync: () => '' };
  return c;
};

const store = new Map();
const rafQueue = [];
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.cancelAnimationFrame = () => {};
function step(n) {
  for (let i = 0; i < (n || 1); i += 1) rafQueue.splice(0).forEach((cb) => cb(Date.now()));
}

/** 可配置的机型 */
function installWx(machine) {
  const calls = { touchStart: null, touchMove: null, touchEnd: null };
  global.wx = {
    createCanvas: makeCanvas,
    createImage: () => ({}),
    getWindowInfo: () => ({
      windowWidth: machine.w,
      windowHeight: machine.h,
      pixelRatio: machine.dpr || 2,
      statusBarHeight: machine.statusBar || 20,
      safeArea: machine.safeArea
    }),
    getSystemInfoSync: () => global.wx.getWindowInfo(),
    getMenuButtonBoundingClientRect: () => machine.capsule || { width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 },
    setPreferredFramesPerSecond() {},
    onTouchStart: (f) => { calls.touchStart = f; },
    onTouchMove: (f) => { calls.touchMove = f; },
    onTouchEnd: (f) => { calls.touchEnd = f; },
    onTouchCancel: () => {},
    onWheel: () => {},
    onShow() {}, onHide() {}, onMemoryWarning() {}, onError() {}, onUnhandledRejection() {},
    onShareAppMessage() {}, showShareMenu() {}, shareAppMessage() {},
    getLaunchOptionsSync: () => ({ query: {} }),
    getEnterOptionsSync: () => ({ scene: 1001, query: {} }),
    getAppBaseInfo: () => ({ SDKVersion: '3.17.3' }),
    getUpdateManager: () => ({ onCheckForUpdate() {}, onUpdateReady() {}, onUpdateFailed() {}, applyUpdate() {} }),
    getLogManager: () => ({ log() {} }),
    reportEvent() {},
    onNetworkWeakChange() {},
    setKeepScreenOn() {},
    onKeyboardInput() {}, onKeyboardConfirm() {}, onKeyboardComplete() {},
    offKeyboardInput() {}, offKeyboardConfirm() {}, offKeyboardComplete() {},
    showKeyboard() {}, hideKeyboard() {},
    getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
    setStorageSync: (k, v) => store.set(k, v),
    removeStorageSync: (k) => store.delete(k),
    showToast() {}, showModal() {}, showLoading() {}, hideLoading() {}, vibrateShort() {},
    request(o) { setTimeout(() => { if (o.fail) o.fail({ errMsg: 'request:fail' }); }, 1); },
    login(o) { if (o && o.success) o.success({ code: 'x' }); }
  };
  return calls;
}

/** 合成触摸：传设计稿坐标 */
let scale = 0.5;
function touch(calls, type, dx, dy) {
  const x = dx * scale;
  const y = dy * scale;
  const ev = { touches: [{ clientX: x, clientY: y, identifier: 0 }], changedTouches: [{ clientX: x, clientY: y, identifier: 0 }] };
  if (type === 'start') calls.touchStart(ev);
  else if (type === 'move') calls.touchMove(ev);
  else calls.touchEnd({ touches: [], changedTouches: [{ clientX: x, clientY: y, identifier: 0 }] });
}

/** 模拟一次滑动：从 (x, y0) 到 (x, y1)，分成 n 段 */
function swipe(calls, x, y0, y1, n) {
  touch(calls, 'start', x, y0);
  const seg = n || 8;
  for (let i = 1; i <= seg; i += 1) touch(calls, 'move', x, y0 + ((y1 - y0) * i) / seg);
  touch(calls, 'end', x, y1);
}

// ---------------------------------------------------------------- 机型表

const MACHINES = [
  {
    name: 'iPhone SE (无刘海) 375x667',
    w: 375, h: 667, dpr: 2,
    safeArea: { top: 20, bottom: 667, left: 0, right: 375, width: 375, height: 647 },
    capsule: { width: 87, height: 32, top: 26, bottom: 58, left: 278, right: 365 }
  },
  {
    name: 'iPhone 14 (刘海) 390x844',
    w: 390, h: 844, dpr: 3,
    safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 },
    capsule: { width: 87, height: 32, top: 53, bottom: 85, left: 293, right: 380 }
  },
  {
    name: 'iPhone 14 Pro (灵动岛) 393x852',
    w: 393, h: 852, dpr: 3,
    safeArea: { top: 59, bottom: 818, left: 0, right: 393, width: 393, height: 759 },
    capsule: { width: 87, height: 32, top: 65, bottom: 97, left: 296, right: 383 }
  },
  {
    name: 'Android 大屏 412x915',
    w: 412, h: 915, dpr: 2.6,
    safeArea: { top: 24, bottom: 915, left: 0, right: 412, width: 412, height: 891 },
    capsule: { width: 87, height: 32, top: 30, bottom: 62, left: 305, right: 392 }
  }
];

// ---------------------------------------------------------------- 主流程

function runOne(machine, sceneName) {
  // 清 require 缓存，让每个机型重新初始化
  Object.keys(require.cache).forEach((k) => {
    if (k.indexOf(ROOT) >= 0 && k.indexOf('tools') < 0) delete require.cache[k];
  });
  store.clear();
  store.set('profile', JSON.stringify({ name: '诊断', birthDate: '1995-05-05', timeKnown: false, city: '北京' }));

  const calls = installWx(machine);
  scale = machine.w / 750;
  process.env.SCALE = String(scale);

  const boot = require(path.join(ROOT, 'src/js/boot.js'));
  boot.start();
  const stage = boot.getStage();
  const router = boot.getRouter();
  const input = boot.getInput();
  step(1);

  const logs = [];
  input.setTrace((msg) => logs.push(msg));

  const out = {
    machine: machine.name,
    scene: sceneName,
    canvasScale: Number(stage.dev.scale.toFixed(4)),
    contentTop: Math.round(stage.contentTop),
    scroll: null,
    before: 0,
    after: 0,
    logs: []
  };

  if (sceneName === 'result') {
    // 结果页需要一份完整结果：直接本机算一份，不走网络
    const core = require(path.join(ROOT, 'core/index.js'));
    const local = core.divinate({
      profile: { name: '诊断', birthDate: '1995-05-05', timeKnown: false, city: '北京' }
    });
    router.push('result', { outcome: { result: local, source: 'local', notice: '' } });
  } else {
    router.reset(sceneName);
  }
  step(1);
  const scene = router.current();
  const sc = scene.scroll;

  if (!sc) {
    out.error = `这个场景没有 scroll 容器（当前场景 ${scene.constructor.name}）`;
    return out;
  }

  // 打印布局关键值
  out.scroll = {
    y: Math.round(sc.y),
    h: Math.round(sc.h),
    contentH: Math.round(sc.contentH),
    maxScroll: Math.round(sc.maxScroll()),
    visibleInView: sc.y >= 0 && sc.y + sc.h <= stage.height + 1
  };

  // ---- 滑动 1：从屏幕中间往上滑（用户最常见的动作） ----
  out.before = Math.round(sc.scrollY);
  const middleY = Math.round(sc.y + sc.h * 0.5);
  swipe(calls, 375, middleY, middleY - 300, 8);
  step(1);
  out.after = Math.round(sc.scrollY);
  out.middleSwipe = { from: middleY, to: middleY - 300, moved: out.after - out.before };

  // ---- 滑动 2：从"滚动容器上方"开始往下滑 ----
  // 这是最常见的手势之一（想把页面拖回顶部），手指往往落在屏幕最上面。
  // 如果 ScrollView 的命中区域从 contentTop 才开始，这里会完全没反应。
  sc.scrollTo(Math.min(sc.maxScroll(), 400));
  step(1);
  const aboveY = Math.max(4, Math.round(sc.y) - 30);
  const beforeEdge = Math.round(sc.scrollY);
  swipe(calls, 375, aboveY, aboveY + 260, 6);
  step(1);
  out.edgeSwipe = {
    from: aboveY,
    scrollTop: Math.round(sc.y),
    before: beforeEdge,
    moved: beforeEdge - Math.round(sc.scrollY)
  };

  // ---- 滑动 3：从屏幕最底部（TabBar 区域）往上滑 ----
  sc.scrollTo(0);
  step(1);
  const bottomY = Math.round(machine.h / (machine.w / 750)) - 40;
  const beforeBottom = Math.round(sc.scrollY);
  swipe(calls, 375, bottomY, bottomY - 260, 6);
  step(1);
  out.bottomSwipe = { from: bottomY, moved: Math.round(sc.scrollY) - beforeBottom };

  // ---- 滑动 4：从屏幕中间往下拖（回顶部） ----
  sc.scrollTo(Math.min(sc.maxScroll(), 500));
  step(1);
  const midDown = Math.round(sc.y + sc.h * 0.4);
  const beforeDown = Math.round(sc.scrollY);
  swipe(calls, 375, midDown, midDown + 280, 6);
  step(1);
  out.downSwipe = { before: beforeDown, after: Math.round(sc.scrollY), moved: beforeDown - Math.round(sc.scrollY) };

  // ---- 嵌套滚动：内层到底后，位移应当交给外层 ----
  //
  // 注意：这里的验证方式很关键。如果先把外层滚到底，再想验证"传递"，
  // 外层根本没有可滚空间，测出来永远是 0 —— 那是假失败。
  // 所以先把外层放到还有余量的位置，再直接给内层一个位移。
  const inner = findInnerScroll(sc.content);
  if (inner) {
    sc.scrollTo(Math.max(0, sc.maxScroll() - 600));
    inner.scrollTo(inner.maxScroll());
    step(1);
    const passBefore = Math.round(sc.scrollY);
    const spaceLeft = Math.round(sc.maxScroll()) - passBefore;
    logs.length = 0;
    // 内层已经到底，这个位移应当被转发给外层
    inner.onDrag(0, 0, { dx: 0, dy: -100 });
    step(1);
    out.nested = {
      passBefore,
      passAfter: Math.round(sc.scrollY),
      passedToOuter: Math.round(sc.scrollY) - passBefore,
      outerSpaceLeft: spaceLeft,
      innerMax: Math.round(inner.maxScroll()),
      innerAfter: Math.round(inner.scrollY),
      parentIsOuter: inner.parentScrollable() === sc
    };
  }

  out.logs = logs.slice(0, 14);
  return out;
}

/** 在内容树里找一个内嵌的 ScrollView（自检场景里有） */
function findInnerScroll(widget) {
  if (!widget || !widget.children) return null;
  for (const c of widget.children) {
    if (c.scrollable) return c;
    const deep = findInnerScroll(c);
    if (deep) return deep;
  }
  return null;
}

console.log('=== 滚动诊断 ===');
console.log('');
const problems = [];

MACHINES.forEach((m) => {
  ['home', 'codex', 'result', 'account'].forEach((sceneName) => {
    const r = runOne(m, sceneName);
    if (r.error) {
      console.log(`! ${r.machine} · ${r.scene}: ${r.error}`);
      console.log('');
      return;
    }
    const checks = [];
    const canScroll = r.scroll.maxScroll > 20;
    if (canScroll) {
      checks.push(['中间上滑', r.middleSwipe.moved > 50, `${r.middleSwipe.moved}`]);
      checks.push([
        '从顶部空白下滑',
        r.edgeSwipe.moved > 50,
        `起点y=${r.edgeSwipe.from} (容器y=${r.edgeSwipe.scrollTop}) 位移=${r.edgeSwipe.moved}`
      ]);
      checks.push(['从底部上滑', r.bottomSwipe.moved > 50, `起点y=${r.bottomSwipe.from} 位移=${r.bottomSwipe.moved}`]);
    }
    if (canScroll && r.scroll.maxScroll > 200) {
      checks.push(['中间下拖', r.downSwipe.moved > 50, `${r.downSwipe.before}→${r.downSwipe.after} 位移=${r.downSwipe.moved}`]);
    }
    if (r.nested) {
      checks.push([
        '嵌套到边界后传给外层',
        r.nested.passedToOuter > 50,
        `给内层 -100 位移，外层实际滚动 ${r.nested.passedToOuter}` +
          `（外层剩余空间 ${r.nested.outerSpaceLeft}，内层 ${r.nested.innerAfter}/${r.nested.innerMax}，` +
          `能找到外层=${r.nested.parentIsOuter}）`
      ]);
    }

    const bad = checks.filter((c) => !c[1]);
    console.log(`${bad.length ? 'X' : 'V'} ${r.machine} · ${r.scene} (maxScroll=${r.scroll.maxScroll})`);
    checks.forEach(([name, pass, detail]) => {
      console.log(`     ${pass ? 'OK ' : 'BAD'} ${name}: ${detail}`);
    });
    if (bad.length) {
      problems.push(`${r.machine} · ${r.scene} -> ${bad.map((b) => b[0]).join(' / ')}`);
      console.log('     追踪:');
      r.logs.slice(0, 8).forEach((l) => console.log(`       ${l}`));
    }
    console.log('');
  });
});

console.log('========================================');
if (problems.length) {
  console.log(`发现 ${problems.length} 类划不动的情况：`);
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exit(1);
}
console.log('所有机型 x 所有场景 x 各种起点都能正常滚动');
