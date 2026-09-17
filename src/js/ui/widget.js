const draw = require('../draw.js');
const text = require('../text.js');
const { COLOR, CARD, FONT, font, RADIUS } = require('../theme.js');
const icons = require('./icon.js');

/**
 * UI 基类与展示型控件。
 *
 * 坐标约定：每个控件的 x/y 都是**相对父控件**的，和 DOM 一样。
 * 命中测试时把坐标逐层换算下去，所以滚动容器只要挪动自己的偏移量，
 * 里面的子控件不用做任何特殊处理。
 */

let stageRef = null;
function setStage(s) {
  stageRef = s;
}
function getStage() {
  return stageRef;
}

class Widget {
  constructor(opts) {
    const o = opts || {};
    this.x = o.x || 0;
    this.y = o.y || 0;
    this.w = o.w || 0;
    this.h = o.h || 0;
    this.visible = o.visible !== false;
    this.alpha = o.alpha === undefined ? 1 : o.alpha;
    /** 是否可以被点到（纯装饰控件保持 false，事件会穿透到下层） */
    this.tapEnabled = !!o.tapEnabled;
    this.scrollable = false;
    this.clip = !!o.clip;
    this.name = o.name || '';
    this.children = [];
    this.parent = null;
    this.scrollX = 0;
    this.scrollY = 0;
    /**
     * 按压反馈：按住时整体缩到 pressScale（默认关，1 = 不缩放）。
     * 子类只要在 onPressStart/onPressEnd 里翻 this.pressed，基类负责缓动和变换 ——
     * 以前每个控件各写一份"按下去变 0.98"，手感还都不一样。
     */
    this.pressScale = o.pressScale === undefined ? 1 : o.pressScale;
    this.pressed = false;
    this.pressT = 0;
  }

  /**
   * 按压动画。返回是否有变化（有变化才会触发重绘）。
   * 子类覆写 update 时**不要忘**掉这条：不复用的话按住时不会重绘，缩放会卡住。
   */
  updatePress(dt) {
    if (this.pressScale === 1) return false;
    const target = this.pressed ? 1 : 0;
    if (Math.abs(this.pressT - target) < 0.004) {
      if (this.pressT !== target) {
        this.pressT = target;
        return true;
      }
      return false;
    }
    this.pressT += (target - this.pressT) * Math.min(1, dt / 110);
    return true;
  }

  add(...kids) {
    kids.forEach((k) => {
      if (!k) return;
      k.parent = this;
      this.children.push(k);
    });
    this.dirty();
    return this;
  }

  addTo(parent) {
    if (parent) parent.add(this);
    return this;
  }

  clear() {
    this.children.forEach((c) => {
      c.parent = null;
    });
    this.children = [];
    this.dirty();
    return this;
  }

  set(patch) {
    Object.keys(patch || {}).forEach((k) => {
      this[k] = patch[k];
    });
    this.dirty();
    return this;
  }

  /** 改动后请求重绘（脏标记渲染，不重绘静止页面） */
  dirty() {
    if (stageRef) stageRef.requestRender();
  }

  /** 把自身高度调成"包住子控件" */
  sizeToChildren(bottomPad) {
    let max = 0;
    this.children.forEach((c) => {
      if (c.visible === false) return;
      max = Math.max(max, c.y + c.h);
    });
    this.h = max + (bottomPad || 0);
    return this;
  }

  contains(x, y) {
    // w/h 为 0 视为"未定尺寸的容器"，不裁剪命中区域
    if (!this.w || !this.h) return true;
    return x >= 0 && y >= 0 && x <= this.w && y <= this.h;
  }

  /**
   * 把场景坐标换算成本控件坐标系内的点。
   * 事件分发必须用这个 —— 否则分段选择器、滚轮、底部弹窗这些
   * 需要判断"点在自己哪个位置"的控件全都算错。
   */
  localPoint(x, y) {
    const chain = [];
    let cur = this;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent;
    }
    let px = x;
    let py = y;
    for (let i = 0; i < chain.length; i += 1) {
      const w = chain[i];
      px -= w.x;
      py -= w.y;
      // 进入滚动容器内容空间时要补上滚动偏移
      if (w.scrollable && (w.scrollX || w.scrollY)) {
        px += w.scrollX;
        py += w.scrollY;
      }
    }
    return { x: px, y: py };
  }

  /**
   * @param {number} x,y 本控件坐标系内的点
   * @param {boolean} loose 宽松模式：允许滚动容器在"命中扩展区"内被命中。
   *   场景的命中测试会跑两轮 —— 先用严格模式（只认真实范围），
   *   什么都没命中才用宽松模式兜底。这样滚动容器的边缘扩展区
   *   既能接住"从空白处开始的滑动"，又不会抢走它上方按钮的点击。
   */
  hitTest(x, y, loose) {
    if (!this.visible) return null;
    if (!this.contains(x, y)) return null;
    for (let i = this.children.length - 1; i >= 0; i -= 1) {
      const c = this.children[i];
      const hit = c.hitTest(x - c.x, y - c.y, loose);
      if (hit) return hit;
    }
    // 可滚动的控件也必须是可命中的：输入层靠"命中的控件"往上找拖动目标，
    // 一个 scrollable 却不可命中的控件会永远收不到拖动事件（轮盘划不动的根因）。
    // 这里兜一道，避免以后新增滚动控件时又忘设 tapEnabled。
    return this.tapEnabled || this.scrollable ? this : null;
  }

  /**
   * 找"包含这个点的最深层可滚动控件"。
   *
   * 为什么需要它：`findScrollable(按下的控件)` 只沿 parent 链向上找，
   * 一旦按下的地方**没有任何控件**（容器边缘的空白、胶囊下方、TabBar 上沿），
   * hitTest 直接返回 null，就彻底找不到滚动容器 —— 表现就是"页面划不动"。
   * 所以要用坐标再兜一次。ScrollView 会覆写这个方法，带上自己的命中扩展区。
   */
  findScrollableAt(x, y) {
    if (!this.visible) return null;
    for (let i = this.children.length - 1; i >= 0; i -= 1) {
      const c = this.children[i];
      if (c.visible === false) continue;
      const hit = c.findScrollableAt(x - c.x, y - c.y);
      if (hit) return hit;
    }
    return this.scrollable && this.contains(x, y) ? this : null;
  }

  /** 子类覆写。基类必须有这个空实现 —— 纯容器控件（new Widget()）不会画东西但会走到这里 */
  drawSelf() {}

  /**
   * 把所有动画跳到**终点**，并向下递归。
   *
   * 给布局审计用：动画中途的坐标（内容上移 20px、卡片缩放 0.9、数字还在滚）
   * 不代表用户最终看到的画面，拿它去量重叠会凭空生成一堆假问题。
   * 有自入场动画的控件覆写这个方法。
   */
  settle() {
    this.children.forEach((c) => {
      if (c.settle) c.settle();
    });
    return this;
  }

  draw(ctx, stage, t) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.alpha !== 1) ctx.globalAlpha *= this.alpha;
    // 按压：以自身中心为轴缩到 pressScale
    if (this.pressScale !== 1 && this.pressT > 0.004) {
      const k = 1 - this.pressT * (1 - this.pressScale);
      ctx.translate(this.w / 2, this.h / 2);
      ctx.scale(k, k);
      ctx.translate(-this.w / 2, -this.h / 2);
    }
    this.drawSelf(ctx, stage, t);
    this.drawChildren(ctx, stage, t);
    ctx.restore();
  }

  drawChildren(ctx, stage, t) {
    this.children.forEach((c) => c.draw(ctx, stage, t));
  }

  /** @returns {boolean} 是否有变化（有变化才触发重绘） */
  update(dt, t) {
    let changed = this.updatePress(dt);
    this.children.forEach((c) => {
      if (c.update && c.update(dt, t)) changed = true;
    });
    return changed;
  }

  onTap() {}
  onPressStart() {
    if (this.pressScale !== 1) {
      this.pressed = true;
      this.dirty();
    }
  }
  onPressEnd() {
    if (this.pressScale !== 1) {
      this.pressed = false;
      this.dirty();
    }
  }
  onLongPress() {}
  onDrag() {}
}

/** 单行文本 */
class Label extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.text = o.text === undefined ? '' : String(o.text);
    this.size = o.size || FONT.body;
    this.weight = o.weight || '';
    this.color = o.color || COLOR.ink;
    this.align = o.align || 'left';
    this.maxWidth = o.maxWidth || 0;
    this.lineHeight = o.lineHeight || Math.round(this.size * 1.3);
    if (!this.h) this.h = this.lineHeight;
  }

  setText(t) {
    this.text = t === undefined || t === null ? '' : String(t);
    this.dirty();
    return this;
  }

  drawSelf(ctx) {
    const f = font(this.size, this.weight);
    ctx.font = f;
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';
    let s = this.text;
    if (this.maxWidth) s = text.singleLine(s, this.maxWidth, f);
    let ax = 0;
    ctx.textAlign = 'left';
    if (this.align === 'center') {
      ax = this.w ? this.w / 2 : 0;
      ctx.textAlign = 'center';
    } else if (this.align === 'right') {
      ax = this.w;
      ctx.textAlign = 'right';
    }
    ctx.fillText(s, ax, this.h / 2);
    ctx.textAlign = 'left';
  }
}

/** 多行文本（自动折行、可用 maxLines 截断加省略号） */
class Paragraph extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.content = o.text === undefined ? '' : String(o.text);
    this.size = o.size || FONT.body;
    this.weight = o.weight || '';
    this.color = o.color || COLOR.ink;
    this.align = o.align || 'left';
    this.lineHeight = o.lineHeight || Math.round(this.size * 1.85);
    this.maxLines = o.maxLines || 0;
    this.layout = null;
    this.reflow();
  }

  setText(t) {
    this.content = t === undefined || t === null ? '' : String(t);
    this.reflow();
    this.dirty();
    return this;
  }

  /** 宽度变了（比如横竖屏切换）要重排 */
  reflow() {
    this.layout = text.layoutParagraph({
      text: this.content,
      font: font(this.size, this.weight),
      size: this.size,
      lineHeight: this.lineHeight,
      maxWidth: this.w,
      maxLines: this.maxLines,
      align: this.align,
      ellipsis: true
    });
    this.h = this.layout.height;
    return this;
  }

  drawSelf(ctx) {
    this.layout.width = this.w;
    this.layout.size = this.size;
    text.drawParagraph(ctx, this.layout, 0, 0, this.color);
  }
}

/** 小标签（命途名之类） */
class Tag extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.text = o.text === undefined ? '' : String(o.text);
    this.size = o.size || FONT.tiny;
    this.color = o.color || COLOR.ink2;
    this.bg = o.bg || 'rgba(255,255,255,0.06)';
    this.border = o.border || 'rgba(255,255,255,0.08)';
    const f = font(this.size);
    this.w = this.w || Math.round(text.measure(this.text, f)) + 30;
    this.h = this.h || 44;
  }

  drawSelf(ctx) {
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, this.bg);
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, this.border, 1);
    ctx.font = font(this.size);
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.w / 2, this.h / 2 + 1);
    ctx.textAlign = 'left';
  }
}

/** 细进度条（默认带 0.3s 的填充动画） */
class ProgressBar extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.value = o.value || 0; // 0~1
    this.h = this.h || 8;
    this.from = o.from || COLOR.violet;
    this.to = o.to || COLOR.gold;
    this.animate = o.animate !== false;
    /** 当前画出来的值：跟着 value 缓动，答题时那一条会"长"过去而不是瞬移 */
    this.display = this.animate ? 0 : this.value;
    this.flow = o.flow !== false;
  }

  setValue(v) {
    this.value = Math.max(0, Math.min(1, v));
    this.dirty();
    return this;
  }

  settle() {
    this.display = this.value;
    return super.settle();
  }

  update(dt) {
    let changed = this.updatePress(dt);
    if (this.flow) changed = true; // 流光一直在跑
    if (!this.animate) return changed;
    if (Math.abs(this.display - this.value) < 0.002) {
      if (this.display !== this.value) {
        this.display = this.value;
        changed = true;
      }
      return changed;
    }
    // 0.3s 走完（按剩余距离的比例逼近，快慢不同也不会"越远越慢得离谱"）
    this.display += (this.value - this.display) * Math.min(1, dt / 130);
    return true;
  }

  drawSelf(ctx, stage, t) {
    const v = this.animate ? this.display : this.value;
    draw.flowBar(ctx, 0, 0, this.w, this.h, v, t, {
      from: this.from,
      to: this.to,
      flow: this.flow
    });
  }
}

/**
 * 面板：深色半透明卡片 + 描边，可选标题与发光。子控件加到 card.content 里。
 *
 * ⚠️ 内边距统一走 CARD.pad（32）。**子控件的宽度必须用 contentW - CARD.pad * 2** ——
 *    写成别的数（比如以前遗留的 - 56）会溢出一截，布局审计会报"压边/重叠"。
 */
class Card extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.pad = o.pad === undefined ? CARD.pad : o.pad;
    this.radius = o.radius || CARD.radius;
    this.glow = !!o.glow;
    this.fill = o.fill || CARD.fill;
    this.stroke = o.stroke || (o.glow ? COLOR.line : CARD.stroke);
    this.content = new Widget({ x: this.pad, y: this.pad, w: this.w - this.pad * 2, h: this.h - this.pad * 2 });
    this.content.parent = this;
    this.children.push(this.content);
  }

  setW(w) {
    this.w = w;
    this.content.w = w - this.pad * 2;
    return this;
  }

  /** 高度按内容自适应 */
  fitHeight(bottomPad) {
    this.content.sizeToChildren(0);
    this.h = this.content.h + this.pad * 2 + (bottomPad || 0);
    this.content.h = this.content.h;
    return this;
  }

  add(...kids) {
    this.content.add(...kids);
    return this;
  }

  clear() {
    this.content.clear();
    return this;
  }

  drawSelf(ctx) {
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.fill);
    if (this.glow) {
      const g = ctx.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, 'rgba(232,200,122,0.10)');
      g.addColorStop(0.45, 'rgba(232,200,122,0.01)');
      draw.roundRectPath(ctx, 0, 0, this.w, this.h, this.radius);
      ctx.fillStyle = g;
      ctx.fill();
    }
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.stroke, 1);
  }
}

/**
 * 小节标题：金色竖条 + 文字。
 *
 * 文字刻意用**白色**而不是金色 —— 金色只留给主按钮/选中态/关键数字，
 * 满屏金字会让金色贬值（"哪儿都是金，就等于哪儿都不金"）。
 */
class SectionTitle extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.text = String(o.text || '');
    this.size = o.size || FONT.h3;
    this.color = o.color || COLOR.ink;
    this.h = this.h || 44;
  }

  drawSelf(ctx) {
    draw.fillRoundRect(ctx, 0, 8, 6, 30, 3, COLOR.gold);
    ctx.font = font(this.size, '600');
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, 22, this.h / 2);
  }
}

/** 纯色面板（只用它当背景，不含内容布局） */
class Panel extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.fill = o.fill || 'rgba(255,255,255,0.045)';
    this.stroke = o.stroke || null;
    this.radius = o.radius || RADIUS.md;
  }

  drawSelf(ctx) {
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.fill);
    if (this.stroke) draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, this.stroke, 1);
  }
}

/** 透明热区：不画东西，只吃点击（比如"点这里跳过"） */
class Hotspot extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.handler = (opts && opts.onTap) || null;
    this.pressed = false;
  }

  onPressStart() {
    this.pressed = true;
  }

  onPressEnd() {
    this.pressed = false;
  }

  onTap(x, y) {
    if (this.handler) this.handler(x, y);
  }
}

/** 发光分隔线 */
class HLine extends Widget {
  constructor(opts) {
    super(opts);
    this.h = 1;
    this.color = (opts && opts.color) || 'rgba(255,255,255,0.14)';
  }

  drawSelf(ctx) {
    draw.hairline(ctx, 0, 0, this.w, this.color);
  }
}

/**
 * 滚动数字。
 *
 * "数字从 0 滚上去"是运气类产品的灵魂动作 —— 共振度、收集进度、统计数字
 * 用它出现，比直接印一个静态数字有仪式感得多。
 * 用 outCubic 缓动、默认 900ms：够长看得清，又不至于让用户等。
 */
class NumberTicker extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.value = Number(o.value) || 0;
    this.size = o.size || FONT.h1;
    this.weight = o.weight || '700';
    this.color = o.color || COLOR.gold;
    this.align = o.align || 'left';
    this.suffix = o.suffix === undefined ? '' : String(o.suffix);
    this.duration = o.duration === undefined ? 900 : o.duration;
    this.decimals = o.decimals || 0;
    this.animate = o.animate !== false;
    this.elapsed = 0;
    this.current = this.animate ? 0 : this.value;
    this.lineHeight = this.lineHeight || Math.round(this.size * 1.2);
    if (!this.h) this.h = this.lineHeight;
  }

  /** 重设目标值：从当前显示值继续滚（不是从 0 重来） */
  setValue(v) {
    this.value = Number(v) || 0;
    this.elapsed = 0;
    this.dirty();
    return this;
  }

  /** 文字内容（测试和布局审计都靠它，别在 drawSelf 里另算一遍） */
  label() {
    const v = this.decimals
      ? this.current.toFixed(this.decimals)
      : String(Math.round(this.current));
    return `${v}${this.suffix}`;
  }

  settle() {
    this.current = this.value;
    this.elapsed = this.duration;
    return super.settle();
  }

  update(dt) {
    if (!this.animate) return this.updatePress(dt);
    if (this.elapsed >= this.duration) return this.updatePress(dt);
    this.elapsed += dt;
    const p = Math.min(1, this.elapsed / this.duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const next = this.value * eased;
    const changed = Math.abs(next - this.current) > 0.001 || p >= 1;
    this.current = p >= 1 ? this.value : next;
    return changed || this.updatePress(dt);
  }

  drawSelf(ctx) {
    ctx.font = font(this.size, this.weight);
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';
    let ax = 0;
    ctx.textAlign = 'left';
    if (this.align === 'center') {
      ax = this.w ? this.w / 2 : 0;
      ctx.textAlign = 'center';
    } else if (this.align === 'right') {
      ax = this.w;
      ctx.textAlign = 'right';
    }
    ctx.fillText(this.label(), ax, this.h / 2);
    ctx.textAlign = 'left';
  }
}

/**
 * 图标 + 文字。
 *
 * 列表前置图标、宜/忌行、"今日免费次数"这类状态行都用它 ——
 * 图标在左、文字在右、整体可选中对齐方式，避免每个页面自己摆一遍坐标。
 */
class IconText extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.icon = o.icon || '';
    this.text = o.text === undefined ? '' : String(o.text);
    this.size = o.size || FONT.body;
    this.weight = o.weight || '';
    this.color = o.color || COLOR.ink2;
    this.iconColor = o.iconColor || this.color;
    this.iconAlpha = o.iconAlpha === undefined ? 0.75 : o.iconAlpha;
    this.iconSize = o.iconSize || (this.size + 8);
    this.gap = o.gap === undefined ? 16 : o.gap;
    this.align = o.align || 'left';
    this.maxWidth = o.maxWidth || 0;
    this.lineHeight = this.lineHeight || Math.round(this.size * 1.3);
    if (!this.h) this.h = Math.max(this.lineHeight, this.iconSize);
  }

  setText(t) {
    this.text = t === undefined || t === null ? '' : String(t);
    this.dirty();
    return this;
  }

  setColor(c) {
    this.color = c;
    this.iconColor = c;
    this.dirty();
    return this;
  }

  drawSelf(ctx) {
    const f = font(this.size, this.weight);
    const s = this.maxWidth ? text.singleLine(this.text, this.maxWidth, f) : this.text;
    const w = this.maxWidth ? Math.min(text.measure(s, f), this.maxWidth) : text.measure(s, f);
    const cy = this.h / 2;
    let x = 0;
    let tx = this.icon ? this.iconSize + this.gap : 0;
    if (this.align === 'center') x = (this.w - (tx + w)) / 2;
    else if (this.align === 'right') x = this.w - (tx + w);

    if (this.icon) {
      icons.drawIcon(ctx, this.icon, x + this.iconSize / 2, cy, this.iconSize, this.iconColor, this.iconAlpha);
    }
    ctx.font = f;
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(s, x + tx, cy);
  }
}

module.exports = {
  Widget,
  Panel,
  Hotspot,
  Label,
  Paragraph,
  Tag,
  ProgressBar,
  Card,
  SectionTitle,
  HLine,
  NumberTicker,
  IconText,
  setStage,
  getStage
};
