const device = require('./device.js');
const errview = require('./errview.js');

/**
 * 舞台：画布 + 主循环 + 重绘调度。
 *
 * 一个刻意的性能决策：**默认不是每帧重绘**。
 * 这个产品大部分时间是静止的文字阅读页，60fps 全量重绘会让低端机发烫、掉电。
 * 所以采用「脏标记」：场景改动后调 stage.requestRender()，只有标了脏才真正 draw；
 * 需要连续动画的场景（占卜仪式、转场）把 scene.alwaysRender 设成 true。
 */

function create() {
  const canvas = wx.createCanvas(); // 首次调用 = 上屏画布
  let dev = device.create(canvas);

  let scene = null;
  let sceneNext = null;
  let dirty = true;
  let running = false;
  let lastTime = 0;
  let elapsed = 0;
  let frameCount = 0;
  let fps = 0;
  let fpsAt = 0;

  const stage = {
    canvas,
    dev,
    ctx: dev.ctx,
    width: dev.width,
    height: dev.height,
    safeTop: dev.safeTop,
    safeBottom: dev.safeBottom,
    // 内容上边界（已避开右上角胶囊按钮）与胶囊矩形
    contentTop: dev.contentTop,
    contentRight: dev.contentRight,
    capsule: dev.capsule,

    get scene() {
      return scene;
    },
    get elapsed() {
      return elapsed;
    },
    get fps() {
      return fps;
    },

    /** 切场景（下一帧生效，避免在 update 中途换掉自己） */
    setScene(next) {
      sceneNext = next;
      dirty = true;
    },

    requestRender() {
      dirty = true;
    },

    /** 场景内部改了数据后，除了标脏还要让输入重新命中测试 */
    markDirty() {
      dirty = true;
    },

    start() {
      if (running) return;
      running = true;
      lastTime = Date.now();
      if (wx.setPreferredFramesPerSecond) {
        // 静止页面用 60 足够；真要压功耗可以调到 30
        try {
          wx.setPreferredFramesPerSecond(60);
        } catch (e) {
          /* 老版本不支持，忽略 */
        }
      }
      requestAnimationFrame(frame);
    },

    stop() {
      running = false;
    },

    onHide() {
      running = false;
    },

    onShow() {
      if (!running) {
        running = true;
        lastTime = Date.now();
        dirty = true;
        requestAnimationFrame(frame);
      }
    },

    /**
     * 重新测量屏幕并重排。
     *
     * 存在的理由：启动那一瞬间运行时的桥可能还没就绪（开发者工具里就是这样，
     * 控制台会打 `jsbridge not ready`），这时系统信息取不到，我们只能用兜底尺寸。
     * 以前这意味着**整场都用错尺寸**，而且完全静默 —— 画面看着能用，其实底部被裁掉了、
     * 胶囊按钮的位置也算错了。现在 device 会标记"这次是兜底值"（`dev.measured === false`），
     * boot 看到就会过一会儿再量一次；真变了就重建当前场景，让布局用上正确尺寸。
     *
     * @returns {boolean} 尺寸是否真的变了（变了才需要重建场景）
     */
    reapply() {
      const pick = (d) => `${d.cssWidth}x${d.cssHeight}@${d.dpr}/${Math.round(d.safeTop)}/${Math.round(d.contentTop)}`;
      const before = pick(dev);
      const next = device.create(canvas);
      const after = pick(next);

      dev = next;
      stage.dev = next;
      stage.ctx = next.ctx;
      stage.width = next.width;
      stage.height = next.height;
      stage.safeTop = next.safeTop;
      stage.safeBottom = next.safeBottom;
      stage.contentTop = next.contentTop;
      stage.contentRight = next.contentRight;
      stage.capsule = next.capsule;
      dirty = true;
      return before !== after;
    }
  };

  function frame() {
    if (!running) return;
    const now = Date.now();
    const dt = Math.min(64, Math.max(0, now - lastTime));
    lastTime = now;
    elapsed += dt;
    frameCount += 1;

    if (now - fpsAt > 1000) {
      fps = Math.round((frameCount * 1000) / (now - fpsAt));
      frameCount = 0;
      fpsAt = now;
    }

    if (sceneNext) {
      // 场景的生命周期（onEnter/onExit）由 router 负责，这里只换绘制指针
      scene = sceneNext;
      sceneNext = null;
      dirty = true;
    }

    if (scene) {
      /**
       * ⚠️ update / draw 都必须包起来。
       *
       * Canvas 自绘只要某一帧抛一次异常，异常会从 scene.draw 冒出去打断帧循环
       * （requestAnimationFrame 在 frame() 最后一行，执行不到），
       * 画面就永远停在那一帧 —— 真机上的表现是"只有背景，什么都没有"，
       * 而且没有控制台，完全没法查。所以这里：捕获、记下来、画到屏幕上、继续跑。
       */
      if (scene.update) {
        try {
          const changed = scene.update(dt, elapsed);
          if (changed) dirty = true;
        } catch (err) {
          errview.record('update:' + sceneName(scene), err);
        }
      }
      if (dirty || scene.alwaysRender) {
        const ctx = dev.ctx;
        ctx.save();
        ctx.clearRect(0, 0, stage.width, stage.height);
        try {
          if (scene.draw) scene.draw(ctx, stage, elapsed);
        } catch (err) {
          errview.record('draw:' + sceneName(scene), err);
        }
        ctx.restore();
        dirty = false;
      }
      // 出错就把错误卡画在最上层（哪怕场景只画了一半）
      if (errview.get()) {
        try {
          errview.drawCard(dev.ctx, stage);
        } catch (e) {
          /* 画错误卡本身失败就只能放弃 */
        }
      }
    }

    requestAnimationFrame(frame);
  }

  /** 场景名（报错时用来定位是哪一页） */
  function sceneName(s) {
    return (s && s.constructor && s.constructor.name) || 'Scene';
  }

  fpsAt = Date.now();
  return stage;
}

module.exports = { create };
