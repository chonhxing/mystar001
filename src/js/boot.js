const stageModule = require('./stage.js');
const inputModule = require('./input.js');
const assets = require('./assets.js');
const { Router } = require('./router.js');
const { setStage } = require('./ui/widget.js');
const { COLOR } = require('./theme.js');
const copy = require('../../config/copy.js');
const { CONFIG } = require('../../config/index.js');
const analytics = require('../../services/analytics.js');
const update = require('../../services/update.js');
const api = require('../../services/api.js');
const share = require('../../services/share.js');

/**
 * 启动流程。
 *
 * 顺序很重要（踩过的坑）：
 *   1. 先建舞台 —— wx.createCanvas() 的**第一次**调用返回的是上屏画布，
 *      后面所有调用都是离屏画布。占位立绘是画在离屏画布上的，
 *      所以必须先让舞台拿到上屏画布，否则整个画面会一片黑。
 *   2. 再注册场景、绑定输入、进入首页。
 *   3. 最后启动主循环。
 */

let stage = null;
let router = null;
let input = null;
let started = false;

function start() {
  if (started) return;
  started = true;
  const bootAt = Date.now();

  stage = stageModule.create();

  // 离屏画布工厂：占位立绘、文字测量都用它
  assets.setCanvasFactory(() => wx.createCanvas());
  setStage(stage);

  router = new Router(stage);
  stage.router = router;

  router.register({
    home: require('./scenes/home.js'),
    quiz: require('./scenes/quiz.js'),
    casting: require('./scenes/casting.js'),
    result: require('./scenes/result.js'),
    codex: require('./scenes/codex.js'),
    character: require('./scenes/character.js'),
    profile: require('./scenes/profile.js'),
    account: require('./scenes/account.js'),
    records: require('./scenes/records.js'),
    recharge: require('./scenes/recharge.js')
  });

  // 目标场景的优先级：
  //   1. 启动参数指名（分享/二维码直达）
  //   2. config.START_SCENE（开发期用来直奔某个页面，上线前必须是 'home'）
  //   3. 兜底首页
  const launch = readLaunch();
  const configured = CONFIG.START_SCENE;
  const first =
    launch.scene || (configured && router.registry[configured] ? configured : 'home');
  router.push(first, launch.params || {});

  input = inputModule.create(stage);
  input.bind();
  // 真机排查用：打开后每一次手势识别的决策都会进日志
  if (CONFIG.DEBUG && CONFIG.DEBUG.TRACE_INPUT) {
    input.setTrace((msg) => analytics.info('gesture', msg));
  }

  share.setup(() => ({ title: `${copy.BRAND.NAME} · ${copy.BRAND.SLOGAN}` }));

  bindLifecycle();
  setupDebugPanel();
  stage.start();
  healDeviceInfo();
  restoreEntitlement();

  const bootMs = Date.now() - bootAt;
  // 启动耗时关系到留存：官方数据是"4 秒内看到首屏可以减少约 30~40% 流失"。
  // 我们在本机算命盘、启动不联网，所以这个数应该很小；大了就说明有问题。
  analytics.info('boot', `${bootMs}ms scene=${first || 'home'}`);
  console.log(
    `[game] ${copy.BRAND.NAME} v${copy.BRAND.VERSION} 启动完成 ${bootMs}ms · ` +
      `${stage.width}x${Math.round(stage.height)} 设计稿坐标 · dpr=${stage.dev.dpr} · ` +
      `屏幕 ${Math.round(stage.dev.cssWidth)}x${Math.round(stage.dev.cssHeight)}(${stage.dev.source}) · ` +
      `首场景=${first || 'home'}`
  );
  if (!stage.dev.measured) {
    // 这条日志很重要：出现它就说明启动瞬间桥没就绪、本次用的是兜底尺寸，
    // 也正是控制台里那句 `jsbridge not ready` 的后果。补测成功后会自动纠正。
    console.warn('[game] 启动时没拿到真实屏幕尺寸，正在补测（见控制台的 jsbridge not ready）');
  }
}

/**
 * 补测屏幕尺寸。
 *
 * 启动那一瞬间 runtimes 的桥可能还没就绪（开发者工具里几乎必然如此），
 * 这时 `wx.getWindowInfo()` / `getSystemInfoSync()` 都会抛，
 * device.js 只好用 375×812 兜底 —— 而这是**静默的**：画面看着能用，
 * 底部其实被裁掉了一截，胶囊按钮的位置也算错了。
 *
 * 所以：只要这次是兜底值，就隔一会儿再量一次（最多试几次），量到了就重排。
 * 只会在启动早期发生，用户还没来得及操作，重建场景不会丢状态。
 */
function healDeviceInfo() {
  if (stage.dev.measured) return;
  let tries = 0;
  const retry = () => {
    tries += 1;
    const changed = stage.reapply();
    if (stage.dev.measured) {
      analytics.info('device', `${stage.dev.source} ${Math.round(stage.dev.cssWidth)}x${Math.round(stage.dev.cssHeight)}`);
      // 尺寸真的变了：当前场景是按旧尺寸排的，从零重建一次让它重排
      if (changed && router && router.current()) router.rebuild();
      else stage.requestRender();
      return;
    }
    if (tries < 6) setTimeout(retry, 40 * tries);
    else analytics.error('device', '始终没拿到真实屏幕尺寸，本次使用兜底尺寸');
  };
  setTimeout(retry, 0);
}

/** 读取启动参数：分享链接、二维码、场景值都能带 */
function readLaunch() {
  try {
    // 优先用 getEnterOptionsSync：它同时覆盖**冷启动和热启动**（基础库 2.13.2+），
    // 而 getLaunchOptionsSync 只给冷启动时的参数。
    let opt = null;
    if (typeof wx.getEnterOptionsSync === 'function') opt = wx.getEnterOptionsSync();
    else if (typeof wx.getLaunchOptionsSync === 'function') opt = wx.getLaunchOptionsSync();
    if (!opt) return {};

    const q = opt.query || {};
    const s = q.scene || '';
    // 启动参数可以直达某个场景：?scene=codex&id=naruto
    if (s && router && router.registry[s]) return { scene: s, params: { id: q.id } };
    return {};
  } catch (e) {
    return {};
  }
}

/**
 * 真机调试面板。
 *
 * 小游戏在真机上没有控制台，遇到"打开是白屏 / 只剩背景"这类问题，
 * 没有它就只能靠猜。`wx.setEnableDebug` 在手机上会显示一个调试按钮，
 * 能看到 console 与报错 —— **预览（开发版）和体验版有效，正式版不生效**。
 *
 * 这里只在非正式版打开：envVersion 拿不到时保守地不开（避免正式版误开）。
 */
function setupDebugPanel() {
  if (!CONFIG.DEBUG || CONFIG.DEBUG.VCONSOLE === false) return;
  try {
    if (typeof wx.setEnableDebug !== 'function') return;
    let env = 'release';
    if (typeof wx.getAccountInfoSync === 'function') {
      const acc = wx.getAccountInfoSync();
      env = (acc && acc.miniProgram && acc.miniProgram.envVersion) || 'release';
    }
    if (env === 'release') return;
    wx.setEnableDebug({ enableDebug: true });
  } catch (e) {
    /* 拿不到环境信息就算了，不能因为调试面板影响启动 */
  }
}

/**
 * 启动时把付费权益从服务端找回来。
 *
 * 付费权益以服务端为准（我们自己的本地只是缓存）：用户换设备 / 重装微信之后，
 * 如果不主动拉一次，主界面就会显示"免费次数还剩 2 次"，
 * 而他其实是刚买过 30 天畅玩卡的人。异步、不阻塞首屏；拿到变化才刷新当前页。
 *
 * `payment.syncFromServer()` 内部已判断 `PAY.ENABLED`，没开付费时不发请求。
 */
function restoreEntitlement() {
  if (!CONFIG.PAY || !CONFIG.PAY.ENABLED) return;
  // eslint-disable-next-line global-require
  const payment = require('../../services/payment.js');
  payment
    .syncFromServer()
    .then((r) => {
      if (r && r.ok && r.changed && router && router.current() && router.current().onResume) {
        router.current().onResume();
      }
    })
    .catch(() => {
      /* 拉不到就继续用本地缓存，不能因为这次失败影响游玩 */
    });
}

function bindLifecycle() {
  // 前后台切换：后台超过 5s 未完成的网络请求会被系统打断（官方文档明确写了），
  // services/api.js 已经把这种情况当普通失败处理并降级到本机解读。
  if (wx.onHide) {
    wx.onHide(() => {
      stage.onHide();
      analytics.info('lifecycle', 'hide');
    });
  }
  if (wx.onShow) {
    // onShow 会带上 scene 与 query：从分享卡片/二维码再次进入时用它切场景。
    // 只在"带了合法 scene 参数"时才切，避免用户从后台回来被莫名跳走。
    wx.onShow((res) => {
      stage.onShow();
      analytics.info('lifecycle', `show scene=${(res && res.scene) || '-'}`);
      const q = (res && res.query) || {};
      if (q.scene && router.registry[q.scene] && router.current() && router.current().constructor.name !== 'SmokeScene') {
        router.reset(q.scene, { id: q.id });
      }
    });
  }

  // 内存告警：清掉占位立绘缓存（它最占内存，而且随时能重建）
  if (wx.onMemoryWarning) {
    wx.onMemoryWarning((res) => {
      // level 只有 Android 有：5=中等 10=偏低 15=严重。越严重越要狠清。
      const level = (res && res.level) || 0;
      assets.clearCache && assets.clearCache();
      analytics.info('memory', `warning level=${level}`);
      if (level >= 10) {
        // 中等以上告警：清完缓存后主动催一次 GC。
        // 官方提供了 wx.triggerGC（加快触发 JavaScriptCore 垃圾回收），
        // 否则等自动回收可能已经来不及了。
        if (typeof wx.triggerGC === 'function') {
          try {
            wx.triggerGC();
          } catch (e) {
            /* 忽略 */
          }
        }
      }
    });
  }

  // 未捕获异常别静默吞掉：记进环形日志（会进 LogManager），开发时控制台也能看到
  if (wx.onError) {
    wx.onError((e) => analytics.error('onError', e && e.message ? e : String(e)));
  }
  if (wx.onUnhandledRejection) {
    wx.onUnhandledRejection((res) => analytics.error('unhandledRejection', (res && res.reason) || 'unknown'));
  }

  // 接入 LogManager（可选）：日志会出现在 MP 后台的"玩家反馈"里
  analytics.setupLogManager();

  // 弱网监听：弱网时跳过 AI 直接本机出结果（api.js 里用）
  api.watchNetwork();

  // 版本更新：小游戏的"启动时更新"只是异步下载，**下次冷启动才生效**，
  // 而且发布后最差要 24 小时才全量下发。所以主动检测，下载好了就用原生弹窗问用户重启。
  // 官方原话：「如果对于版本依赖高的游戏，建议始终开启检测更新API」。
  update.setup();

  // 记一下运行环境，线上定位问题（机型/基础库）非常有用的最小信息
  analytics.info('env', `sdk=${update.sdkVersion() || 'unknown'}`);
}

module.exports = {
  start,
  getStage: () => stage,
  getRouter: () => router,
  // 测试用：把输入层暴露出来，可以合成触摸事件
  getInput: () => input
};
