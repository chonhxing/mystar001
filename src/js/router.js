const { Widget, setStage, getStage } = require('./ui/widget.js');
const { Toast, Modal } = require('./ui/interactive.js');
const { COLOR, EASE } = require('./theme.js');
const errview = require('./errview.js');

/**
 * 场景基类与场景栈。
 *
 * 小游戏没有页面栈、没有 tabBar、没有导航栏 —— 这些都是小程序给的，
 * 这里用最少的代码把它们补回来：一个场景 = 一个根控件树，
 * 栈顶场景接管输入，转场用一层淡入遮罩。
 */

class Scene {
  constructor(stage, params) {
    this.stage = stage;
    this.params = params || {};
    this.root = new Widget({ x: 0, y: 0, w: stage.width, h: stage.height });
    this.overlay = new Widget({ x: 0, y: 0, w: stage.width, h: stage.height });
    this.alwaysRender = false;
    this.transition = 1; // 1 = 全黑，0 = 完全显示
    this.paused = false;
    /**
     * 入场动画进度：内容整体从下往上滑 20px 落位（0 → 1，约 0.3s）。
     * 用缓出曲线 —— 匀速滑动看起来像"页面在漂"，缓出才像"落位"。
     * 浮层不参与（弹窗不该跟着页面一起动）。
     */
    this.enterT = params && params.noEnter ? 1 : 0;
    this.enterFrom = params && params.enterFrom !== undefined ? params.enterFrom : 20;
  }

  onEnter() {}
  onExit() {}
  onPause() {}
  onResume() {}

  /**
   * 把所有动画跳到终点（入场位移、卡片缩放、数字滚动…）。
   * 只给布局审计用 —— 见 game-test 的 §17。浮层也要扫，弹窗有滑入动画。
   */
  settle() {
    this.enterT = 1;
    this.root.settle();
    this.overlay.settle();
    return this;
  }

  update(dt, t) {
    // ⚠️ 子控件的"有变化"必须往上报。以前这里丢掉了 root.update 的返回值，
    //    结果按住按钮的缩放、数字滚动这些动画只有 alwaysRender 的页面才会动，
    //    别的页面会卡在第一帧（而且不报错，极难查）。
    let changed = this.root.update(dt, t);
    if (this.enterT < 1) {
      this.enterT = Math.min(1, this.enterT + dt / 300);
      changed = true;
    }
    // 浮层里的临时控件（提示条）到点了自己清理
    this.overlay.children.slice().forEach((c) => {
      if (c.dead) this.overlay.clearChild(c);
    });
    // ⚠️ 浮层必须保持全屏尺寸，绝不能 sizeToChildren()。
    // 它一旦被缩到提示条的高度，后续所有点击都会从浮层穿透下去，
    // 弹窗按钮就点不动了 —— 这个坑真实踩过。
    if (this.overlay.update(dt, t)) changed = true;
    if (this.transition > 0) {
      this.transition = Math.max(0, this.transition - dt / 260);
      changed = true;
    }
    return changed;
  }

  draw(ctx, stage, t) {
    const p = EASE.outCubic(this.enterT);
    ctx.save();
    // 淡入只做很浅的一段：场景转场那层背板才是真正的"遮黑→显出"，
    // 这里再来一次大范围透明度会露馅（canvas 是 clearRect 过的，太透明会透出网页底色）
    if (this.enterT < 1) {
      ctx.globalAlpha *= 0.86 + 0.14 * p;
      ctx.translate(0, (1 - p) * this.enterFrom);
    }
    this.root.draw(ctx, stage, t);
    ctx.restore();
    this.overlay.draw(ctx, stage, t);
    if (this.transition > 0) {
      ctx.save();
      ctx.globalAlpha = this.transition;
      ctx.fillStyle = COLOR.bg;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.restore();
    }
  }

  /**
   * 命中测试跑两轮：
   *   1. 严格模式 —— 只认控件的真实范围。保证"看得见的按钮"永远能点到。
   *   2. 宽松模式 —— 允许滚动容器在命中扩展区（hitPadding）内被命中。
   *      用户的手指经常落在滚动容器上方那条空白里，没有这一轮那些手势就全丢了，
   *      表现就是"页面划不动"。但这一轮必须放在后面，
   *      否则滚动容器会把上方 Chip / 返回按钮的点击抢走。
   */
  hitTest(x, y) {
    const inOverlay = this.overlay.hitTest(x - this.overlay.x, y - this.overlay.y, false);
    if (inOverlay) return inOverlay;
    const lx = x - this.root.x;
    const ly = y - this.root.y;
    const strict = this.root.hitTest(lx, ly, false);
    if (strict) return strict;
    return this.root.hitTest(lx, ly, true);
  }

  toast(msg) {
    const t = new Toast({ x: 0, y: this.stage.safeTop + 40, w: this.stage.width, text: msg });
    this.overlay.add(t);
    return t;
  }

  confirm(opts) {
    const m = new Modal({
      x: 0,
      y: 0,
      w: this.stage.width,
      h: this.stage.height,
      title: opts.title,
      body: opts.body,
      confirmText: opts.confirmText,
      cancelText: opts.cancelText
    });
    this.overlay.add(m);
    const p = m.ask();
    return p.then((v) => {
      this.overlay.clearChild(m);
      return v;
    });
  }
}

// Widget 缺一个"移除单个子控件"的方法，浮层用得到，补上
Widget.prototype.clearChild = function clearChild(child) {
  const i = this.children.indexOf(child);
  if (i >= 0) {
    this.children.splice(i, 1);
    child.parent = null;
    this.dirty();
  }
  return this;
};

class Router {
  constructor(stage) {
    this.stage = stage;
    this.stack = [];
    this.registry = {};
  }

  register(map) {
    this.registry = Object.assign(this.registry, map);
    return this;
  }

  current() {
    return this.stack[this.stack.length - 1] || null;
  }

  /** 进入新场景（压栈） */
  push(name, params) {
    const factory = this.registry[name];
    if (!factory) throw new Error(`场景未注册: ${name}`);
    // 换页先清掉上一次的错误卡：错误属于出问题的那一页，不该跟着用户跑
    errview.clear();
    const cur = this.current();
    if (cur && cur.onPause) cur.onPause();
    const scene = new factory(this.stage, params || {});
    this.stack.push(scene);
    // 生命周期由路由独占：push 返回时场景必须已经建好，
    // 否则调用方拿到的是一个空壳（这个坑真实踩过）。
    // ⚠️ 但 onEnter 里可能抛（构建界面时任何一个取值出错都会）。
    //    不接住的话异常会一路冒到 boot，真机上就直接白屏/只剩背景，
    //    而且没有控制台。所以接住并交给 errview 画到屏幕上。
    if (scene.onEnter) {
      try {
        scene.onEnter();
      } catch (err) {
        errview.record('onEnter:' + name, err);
      }
    }
    this.applyCurrent();
    return scene;
  }

  /** 返回上一层 */
  pop(backParams) {
    if (this.stack.length <= 1) return null;
    errview.clear();
    const gone = this.stack.pop();
    if (gone.onExit) gone.onExit();
    const cur = this.current();
    if (cur) {
      if (backParams) cur.params = Object.assign({}, cur.params, backParams);
      if (cur.onResume) cur.onResume();
    }
    this.applyCurrent();
    return cur;
  }

  /** 替换栈顶（答题 → 结果页这种） */
  replace(name, params) {
    const gone = this.stack.pop();
    if (gone && gone.onExit) gone.onExit();
    return this.push(name, params);
  }

  /** 回到第一个场景（首页 tab） */
  reset(name, params) {
    errview.clear();
    while (this.stack.length > 1) {
      const gone = this.stack.pop();
      if (gone.onExit) gone.onExit();
    }
    if (this.stack.length === 1 && this.stack[0].constructor === this.registry[name]) {
      const cur = this.current();
      if (cur.onResume) cur.onResume();
      this.applyCurrent();
      return cur;
    }
    const gone = this.stack.pop();
    if (gone && gone.onExit) gone.onExit();
    return this.push(name, params);
  }

  /**
   * 用同样的参数**从零重建**当前场景。
   *
   * 屏幕尺寸变了必须用它：场景的布局是在 onEnter 里按当时的尺寸算好的，
   * 走 onResume 不一定重排（很多场景的 onResume 只刷新数据、不重建控件树）。
   * 目前只有"启动时屏幕没量到、补测后尺寸真的变了"这一处用到。
   */
  rebuild() {
    const cur = this.current();
    if (!cur) return null;
    const name = Object.keys(this.registry).find((k) => this.registry[k] === cur.constructor);
    if (!name) return null;
    return this.replace(name, cur.params || {});
  }

  applyCurrent() {
    const scene = this.current();
    this.stage.setScene(scene);
    setStage(this.stage);
    return scene;
  }

  depth() {
    return this.stack.length;
  }
}

module.exports = { Scene, Router };
