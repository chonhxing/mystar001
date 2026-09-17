/**
 * 触摸输入。
 *
 * 小游戏只给原始的 onTouchStart/Move/End/Cancel，点击、滑动、长按都要自己识别。
 * 这里做三件事：
 *   1. 坐标换算：触摸坐标是 CSS 像素，换算到 750 宽的设计稿坐标
 *   2. 手势识别：点击（位移小 + 时间短）、拖动（交给可滚动控件）、长按
 *   3. 事件分发：命中测试找到最上层控件，把事件交给它
 */

const TAP_MOVE_TOLERANCE = 14; // 设计稿 px
const TAP_MAX_MS = 420;
const LONG_PRESS_MS = 520;

/**
 * 调试追踪。真机上没法看中间状态，"滑动没反应"这类问题只能靠它定位：
 * 打开后每一步手势识别的决策都会打到日志（会进 LogManager 和环形日志）。
 * 用法：在 boot 里 `input.setTrace(analytics.info)`。
 */
let traceFn = null;

function trace(...parts) {
  if (!traceFn) return;
  try {
    traceFn(parts.join(' '));
  } catch (e) {
    /* 追踪本身绝不能影响手势 */
  }
}

function create(stage) {
  let target = null; // 当前按下的控件
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startAt = 0;
  let moved = false;
  let longPressTimer = null;
  let longPressFired = false;
  let capturedBy = null; // 拖动被谁接管（滚动容器）

  function toDesign(touch) {
    return {
      x: touch.clientX / stage.dev.scale,
      y: touch.clientY / stage.dev.scale
    };
  }

  /** 事件派发：统一把场景坐标换算成控件本地坐标 */
  function fire(widget, method, sx, sy, extra) {
    if (!widget || !widget[method]) return;
    const lp = widget.localPoint ? widget.localPoint(sx, sy) : { x: sx, y: sy };
    widget[method](lp.x, lp.y, extra);
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onStart(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const p = toDesign(touch);
    startX = p.x;
    startY = p.y;
    lastX = p.x;
    lastY = p.y;
    startAt = Date.now();
    moved = false;
    longPressFired = false;
    capturedBy = null;

    const scene = stage.scene;
    target = scene && scene.hitTest ? scene.hitTest(p.x, p.y) : null;
    trace(
      `start (${Math.round(p.x)},${Math.round(p.y)})`,
      `scene=${scene ? scene.constructor.name : 'null'}`,
      `target=${target ? target.constructor.name : 'null'}`,
      `scrollable=${!!(target && target.scrollable)}`
    );
    fire(target, 'onPressStart', p.x, p.y);

    clearLongPress();
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      fire(target, 'onLongPress', p.x, p.y);
    }, LONG_PRESS_MS);
  }

  function onMove(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const p = toDesign(touch);
    const scene = stage.scene;
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    lastX = p.x;
    lastY = p.y;

    if (!moved) {
      const total = Math.abs(p.x - startX) + Math.abs(p.y - startY);
      if (total > TAP_MOVE_TOLERANCE) {
        moved = true;
        clearLongPress();
        // 拖动交给可滚动控件接管。两级查找：
        //   1) 从按下的控件沿 parent 链向上找（最精确）
        //   2) 找不到就用坐标找 —— 按在空白/容器边缘/TabBar 上时，第 1 步会失败，
        //      这一级兜底才是"页面划不动"的关键修复
        capturedBy = findScrollable(target) || findScrollableByPoint(scene, p.x, p.y);
        trace(
          `drag-start 位移=${Math.round(total)}`,
          `captured=${capturedBy ? capturedBy.constructor.name : 'null'}`,
          capturedBy ? `maxScroll=${Math.round(capturedBy.maxScroll ? capturedBy.maxScroll() : -1)}` : ''
        );
        fire(capturedBy, 'onDragStart', p.x, p.y);
      }
    }

    if (moved && capturedBy) {
      fire(capturedBy, 'onDrag', p.x, p.y, { dx, dy });
    } else if (moved) {
      fire(target, 'onDrag', p.x, p.y, { dx, dy });
    }
  }

  function onEnd(e) {
    trace(`end moved=${moved} captured=${capturedBy ? capturedBy.constructor.name : 'null'}`);
    clearLongPress();
    const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    const p = touch ? toDesign(touch) : { x: lastX, y: lastY };
    const dt = Date.now() - startAt;

    // ⚠️ 按下的控件无论是否被拖动接管，都要收到 onPressEnd。
    //    否则"按下按钮后拖动页面"会让按钮一直卡在按压高亮状态。
    fire(target, 'onPressEnd', p.x, p.y);
    if (capturedBy) {
      fire(capturedBy, 'onDragEnd', p.x, p.y);
      capturedBy = null;
    } else if (target && !moved && !longPressFired && dt < TAP_MAX_MS) {
      fire(target, 'onTap', p.x, p.y);
    }
    target = null;
    moved = false;
  }

  function onCancel() {
    clearLongPress();
    fire(capturedBy, 'onDragEnd', lastX, lastY);
    fire(target, 'onPressEnd', lastX, lastY);
    target = null;
    capturedBy = null;
    moved = false;
  }

  /**
   * 用坐标找滚动容器（按在空白处、或命中的控件不可滚时的兜底）。
   * ⚠️ 必须**先查浮层**：底部选择器/弹窗挂在 overlay 上，只查主内容会漏掉它们，
   *    轮盘那类"浮层里的滚动控件"就会划不动。
   */
  function findScrollableByPoint(scene, x, y) {
    if (!scene) return null;
    if (scene.overlay && scene.overlay.findScrollableAt) {
      const inOverlay = scene.overlay.findScrollableAt(x - scene.overlay.x, y - scene.overlay.y);
      if (inOverlay) return inOverlay;
    }
    if (scene.root && scene.root.findScrollableAt) {
      return scene.root.findScrollableAt(x - scene.root.x, y - scene.root.y);
    }
    return null;
  }

  /** 从控件向上找可滚动的祖先 */
  function findScrollable(widget) {
    let cur = widget;
    while (cur) {
      if (cur.scrollable && cur.visible !== false) return cur;
      cur = cur.parent;
    }
    return null;
  }

  function bind() {
    wx.onTouchStart(onStart);
    wx.onTouchMove(onMove);
    wx.onTouchEnd(onEnd);
    wx.onTouchCancel(onCancel);
    // PC 端：鼠标事件在 Windows/Mac 上会转成触摸，但滚轮不会，单独接一下
    if (wx.onWheel) {
      wx.onWheel((e) => {
        const scene = stage.scene;
        if (!scene || !scene.hitTest) return;
        const x = (e.clientX || 0) / stage.dev.scale;
        const y = (e.clientY || 0) / stage.dev.scale;
        const w = findScrollable(scene.hitTest(x, y)) || findScrollableByPoint(scene, x, y);
        if (w) fire(w, 'onDrag', x, y, { dx: 0, dy: (e.deltaY || 0) * 0.6 });
      });
    }
  }

  return {
    bind,
    toDesign,
    setTrace(fn) {
      traceFn = fn;
    },
    _onStart: onStart,
    _onMove: onMove,
    _onEnd: onEnd,
    _onCancel: onCancel
  };
}

module.exports = { create };
