const draw = require('../draw.js');
const text = require('../text.js');
const { Widget, Card, Label, setStage, getStage } = require('./widget.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');

/**
 * 交互型控件：按钮、滚动容器、滚轮选择器、轻提示、确认弹窗、文本输入。
 * 这些是「Canvas 里没有 DOM」的代价所在 —— WXML 里一行 <picker> 的东西，
 * 在这里都得自己画出来并且自己处理手势。
 */

// ============================================================ 按钮

class Button extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.text = String(o.text || '');
    this.variant = o.variant || 'primary'; // primary | ghost | plain | danger
    this.size = o.size || FONT.h3;
    this.small = !!o.small;
    this.h = this.h || (this.small ? 68 : 96);
    this.radius = o.radius || this.h / 2;
    this.tapEnabled = true;
    this.handler = o.onTap || null;
    this.enabled = o.enabled !== false;
    this.pressed = false;
    this.pressT = 0; // 0~1 按压动画进度
  }

  setEnabled(v) {
    this.enabled = !!v;
    this.dirty();
    return this;
  }

  setText(t) {
    this.text = String(t || '');
    this.dirty();
    return this;
  }

  onPressStart() {
    if (!this.enabled) return;
    this.pressed = true;
    this.dirty();
  }

  onPressEnd() {
    this.pressed = false;
    this.dirty();
  }

  onTap() {
    if (!this.enabled) return;
    if (typeof wx !== 'undefined' && wx.vibrateShort) {
      try {
        wx.vibrateShort({ type: 'light' });
      } catch (e) {
        /* 忽略 */
      }
    }
    if (this.handler) this.handler(this);
  }

  update(dt) {
    const target = this.pressed && this.enabled ? 1 : 0;
    if (Math.abs(this.pressT - target) > 0.001) {
      this.pressT += (target - this.pressT) * Math.min(1, dt / 90);
      this.pressed = this.pressT > 0.01 && this.pressed;
      return true;
    }
    return false;
  }

  drawSelf(ctx) {
    const s = 1 - this.pressT * 0.03;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(s, s);
    ctx.translate(-this.w / 2, -this.h / 2);
    if (!this.enabled) ctx.globalAlpha *= 0.42;

    if (this.variant === 'primary') {
      const g = ctx.createLinearGradient(0, 0, this.w, this.h);
      g.addColorStop(0, '#FFE9AE');
      g.addColorStop(0.45, COLOR.gold);
      g.addColorStop(1, '#C79A38');
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, g);
      if (this.pressT > 0.02) {
        draw.glow(ctx, this.w / 2, this.h / 2, this.w * 0.6, COLOR.gold, this.pressT * 0.25);
      }
    } else if (this.variant === 'danger') {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(232,106,106,0.16)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(232,106,106,0.45)', 1);
    } else if (this.variant === 'ghost') {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(232,200,122,0.08)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, COLOR.line, 1);
    } else {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, 'rgba(255,255,255,0.05)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, COLOR.lineSoft, 1);
    }

    const color =
      this.variant === 'primary'
        ? '#2A1E05'
        : this.variant === 'danger'
        ? COLOR.red
        : this.variant === 'ghost'
        ? COLOR.gold
        : COLOR.ink2;
    ctx.font = font(this.size, '600');
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.w / 2, this.h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ============================================================ 滚动容器

class ScrollView extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.clip = true;
    this.scrollable = true;
    this.scrollY = 0;
    this.velocity = 0;
    this.dragging = false;
    this.content = new Widget({ x: 0, y: 0, w: this.w });
    this.content.parent = this;
    this.children.push(this.content);
    this.contentH = o.contentH || 0;
    this.showBar = o.showBar !== false;
    this.barT = 0;
    /**
     * 命中区域向外扩展的量（设计稿 px）。
     * 用户的手指经常落在滚动容器可视范围之外一点点（上方的空白、底部导航上沿），
     * 按可视范围判定命中会让这些手势全部丢失 —— 表现就是"页面划不动"。
     */
    this.hitPadding = o.hitPadding === undefined ? 160 : o.hitPadding;
  }

  add(...kids) {
    this.content.add(...kids);
    return this;
  }

  clear() {
    this.content.clear();
    return this;
  }

  setContentHeight(h) {
    this.contentH = h;
    this.content.h = h;
    this.clamp();
    this.dirty();
    return this;
  }

  maxScroll() {
    return Math.max(0, this.contentH - this.h);
  }

  clamp() {
    const max = this.maxScroll();
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > max) this.scrollY = max;
  }

  scrollTo(y, animate) {
    this.scrollY = animate ? y : y;
    this.clamp();
    this.velocity = 0;
    this.dirty();
  }

  onDragStart() {
    this.dragging = true;
    this.velocity = 0;
    this.barT = 1;
  }

  /** 滚动容器不参与点击，只参与拖动 */
  onTap() {}

  /** 向上找外层的滚动容器（嵌套滚动时用） */
  parentScrollable() {
    let cur = this.parent;
    while (cur) {
      if (cur.scrollable && cur.visible !== false) return cur;
      cur = cur.parent;
    }
    return null;
  }

  onDrag(x, y, extra) {
    const dy = (extra && extra.dy) || 0;
    const max = this.maxScroll();
    let d = -dy;
    // 已经到边界还继续滑：把位移交给外层滚动容器。
    // 不做这个"传递"，嵌套滚动里内层到底后就整片卡死，用户会觉得页面划不动。
    if ((this.scrollY <= 0 && d < 0) || (this.scrollY >= max && d > 0)) {
      const outer = this.parentScrollable();
      if (outer) {
        outer.onDrag(x, y, extra);
        // 外层动了就不再做阻尼，否则手感是"先卡一下再动"
        this.velocity = 0;
        return;
      }
      d *= 0.35; // 没有外层才阻尼，给一点"拉不动"的手感
    }
    this.scrollY += d;
    this.velocity = d;
    this.barT = 1;
    this.dirty();
  }

  onDragEnd() {
    this.dragging = false;
    this.clamp();
  }

  update(dt) {
    let changed = false;
    if (!this.dragging && Math.abs(this.velocity) > 0.05) {
      this.scrollY += this.velocity * Math.min(1.4, dt / 16);
      this.velocity *= 0.93;
      const before = this.scrollY;
      this.clamp();
      if (before !== this.scrollY) this.velocity = 0;
      changed = true;
    }
    if (this.barT > 0) {
      this.barT = Math.max(0, this.barT - dt / 900);
      changed = true;
    }
    return changed;
  }

  /**
   * 命中区域比可视区域**向外扩展** hitPadding。
   *
   * 这是"页面划不动"的主要修复：滚动容器通常从内容顶部开始，
   * 而用户的手指经常落在它上方的空白里（胶囊下方那条）。
   * 只按可视范围判定命中，那些手势就全部丢失。
   * 扩展命中不会抢点击 —— 同层里后添加的控件（TabBar 等）会先被检查。
   */
  containsPadded(x, y) {
    const p = this.hitPadding;
    return x >= -p && y >= -p && x <= this.w + p && y <= this.h + p;
  }

  hitTest(x, y, loose) {
    if (!this.visible) return null;
    // 严格模式只认真实范围；宽松模式才允许命中扩展区
    if (loose ? !this.containsPadded(x, y) : !this.contains(x, y)) return null;
    const hit = this.content.hitTest(x, y + this.scrollY, loose);
    if (hit) return hit;
    return this;
  }

  /** 坐标查找：优先返回更内层的滚动容器（嵌套滚动时手指落在内层就该滚内层） */
  findScrollableAt(x, y) {
    if (!this.visible) return null;
    if (!this.containsPadded(x, y)) return null;
    const inner = this.content.findScrollableAt(x, y + this.scrollY);
    if (inner) return inner;
    return this;
  }

  drawChildren(ctx, stage, t) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    this.content.drawSelf(ctx, stage, t);
    // 视口裁剪：图鉴有 60 张卡，屏幕外的直接不画（canvas 的 clip 仍然会执行绘制指令）
    const top = this.scrollY - 320;
    const bottom = this.scrollY + this.h + 320;
    this.content.children.forEach((c) => {
      if (c.visible === false) return;
      if (c.y + c.h < top || c.y > bottom) return;
      c.draw(ctx, stage, t);
    });
    ctx.restore();

    if (this.showBar && this.maxScroll() > 0) {
      const trackH = this.h - 16;
      const barH = Math.max(48, (this.h / this.contentH) * trackH);
      const y = 8 + (this.scrollY / this.maxScroll()) * (trackH - barH);
      ctx.save();
      ctx.globalAlpha = 0.15 + this.barT * 0.45;
      draw.fillRoundRect(ctx, this.w - 8, y, 4, barH, 2, COLOR.ink3);
      ctx.restore();
    }
  }
}

// ============================================================ 滚轮选择器

const ITEM_H = 88;

class Wheel extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.items = o.items || [];
    this.index = o.index || 0;
    this.itemH = o.itemH || ITEM_H;
    this.scrollable = true;
    /**
     * ⚠️ 必须可命中，否则滚轮划不动。
     *
     * 基类 hitTest 的最后一行是 `return this.tapEnabled ? this : null`，
     * 所以一个 tapEnabled=false 的控件**永远不会成为事件目标**，
     * 命中的会是它外层的容器（这里是 PickerSheet）。
     * 输入层是靠"命中的控件"往上找滚动容器的，找不到 Wheel 就找不到滚动目标，
     * 表现就是"轮盘划不动"（而 ScrollView 因为覆写了 hitTest 直接返回自己，所以不受影响）。
     */
    this.tapEnabled = true;
    this.offset = this.index * this.itemH;
    this.velocity = 0;
    this.dragging = false;
    this.onChange = o.onChange || null;
    this.labelSize = o.labelSize || FONT.h3;
    this.width = o.w || 200;
  }

  setItems(items, index) {
    this.items = items || [];
    this.index = index || 0;
    this.offset = this.index * this.itemH;
    this.dirty();
    return this;
  }

  setIndex(i, silent) {
    const max = Math.max(0, this.items.length - 1);
    this.index = Math.max(0, Math.min(max, Math.round(i)));
    if (!silent && this.onChange) this.onChange(this.index, this.items[this.index]);
    this.dirty();
    return this;
  }

  onDragStart() {
    this.dragging = true;
    this.velocity = 0;
  }

  onDrag(x, y, extra) {
    const dy = (extra && extra.dy) || 0;
    /**
     * ⚠️ 方向必须和滚动容器一致（ScrollView 是 `scrollY -= dy`）。
     *
     * `offset` 的语义是"列表往上走了多少"，和 scrollY 一样：
     * 手指往下拖（dy>0）→ 内容跟着往下走 → offset 变小。
     * 这里以前写成 `+= dy`，结果手指往下的内容反而往上跑 —— 方向是反的。
     */
    this.offset -= dy;
    this.velocity = -dy;
    this.dirty();
  }

  onDragEnd() {
    this.dragging = false;
    // 吸附到最近一项；超过半格就算翻过去
    const raw = this.offset / this.itemH;
    this.setIndex(Math.round(raw));
  }

  update(dt) {
    const target = this.index * this.itemH;
    if (this.dragging) return false;
    if (Math.abs(this.offset - target) > 0.5) {
      this.offset += (target - this.offset) * Math.min(1, dt / 110);
      return true;
    }
    if (this.offset !== target) {
      this.offset = target;
      return true;
    }
    return false;
  }

  drawSelf(ctx) {
    const half = this.h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    ctx.clip();
    const first = Math.max(0, Math.floor((this.offset - half) / this.itemH) - 1);
    const last = Math.min(this.items.length - 1, Math.ceil((this.offset + half) / this.itemH) + 1);
    for (let i = first; i <= last; i += 1) {
      const y = i * this.itemH - this.offset + half;
      const dist = Math.abs(y - half) / half;
      if (dist > 1.05) continue;
      const alpha = Math.max(0.15, 1 - dist * dist);
      const scale = 1 - dist * 0.18;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(this.w / 2, y);
      ctx.scale(scale, scale);
      ctx.font = font(i === this.index ? this.labelSize + 4 : this.labelSize, i === this.index ? '600' : '');
      ctx.fillStyle = i === this.index ? COLOR.gold : COLOR.ink2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const item = this.items[i];
      ctx.fillText(item ? item.label || item : '', 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

/** 多列滚轮（日期 = 年月日三列） */
class WheelGroup extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.wheels = [];
    this.onChange = o.onChange || null;
    this.highlight = o.highlight !== false;
    this.itemH = o.itemH || ITEM_H;
  }

  addWheel(wheel) {
    wheel.x = this.wheels.length * wheel.w;
    wheel.h = wheel.h || this.h;
    wheel.itemH = this.itemH;
    // 把"是哪个轮子动了"一起报上去 —— 联动列（省→市→区）要知道该重建哪几列
    wheel.onChange = () => this.emit(wheel);
    this.wheels.push(wheel);
    this.add(wheel);
    return wheel;
  }

  emit(wheel) {
    if (this.onChange) this.onChange(this.values(), wheel);
  }

  values() {
    return this.wheels.map((w) => {
      const item = w.items[w.index];
      return item && item.value !== undefined ? item.value : item;
    });
  }

  drawSelf(ctx) {
    if (this.highlight) {
      const y = this.h / 2 - this.itemH / 2;
      draw.fillRoundRect(ctx, 8, y, this.w - 16, this.itemH, RADIUS.md, 'rgba(232,200,122,0.10)');
      draw.strokeRoundRect(ctx, 8, y, this.w - 16, this.itemH, RADIUS.md, 'rgba(232,200,122,0.28)', 1);
    }
  }
}

// ============================================================ 浮层：提示 / 弹窗

const TAU = Math.PI * 2;

class Toast extends Widget {
  constructor(opts) {
    super(opts);
    this.text = String((opts && opts.text) || '');
    this.ttl = (opts && opts.duration) || 1800;
    this.elapsed = 0;
    this.tapEnabled = false;
  }

  update(dt) {
    this.elapsed += dt;
    return true; // 需要重绘（淡出）
  }

  get dead() {
    return this.elapsed >= this.ttl;
  }

  drawSelf(ctx) {
    const a = this.elapsed > this.ttl - 300 ? (this.ttl - this.elapsed) / 300 : 1;
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, a));
    const w = Math.min(this.w, text.measure(this.text, font(FONT.small)) + 64);
    draw.fillRoundRect(ctx, (this.w - w) / 2, 0, w, 76, 20, 'rgba(8,7,26,0.92)');
    draw.strokeRoundRect(ctx, (this.w - w) / 2, 0, w, 76, 20, COLOR.lineSoft, 1);
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.w / 2, 38);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

class Modal extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.title = String(o.title || '');
    this.body = String(o.body || '');
    this.confirmText = o.confirmText || '确定';
    this.cancelText = o.cancelText || '取消';
    this._resolve = null;
    this.tapEnabled = true;
    this.pressed = 0;
    this.buttons = o.buttons || null;
    this.cardX = 0;
    this.cardY = 0;
    this.cardW = 0;
    this.cardH = 0;
  }

  ask() {
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  hitTest(x, y, loose) {
    return this.visible ? this : null;
  }

  /** 只有按钮区域响应点击，其它地方吞掉事件 */
  onTap(x, y) {
    if (!this._resolve) return;
    const inCard = x >= this.cardX && x <= this.cardX + this.cardW && y >= this.cardY && y <= this.cardY + this.cardH;
    if (!inCard) {
      // 点击遮罩 = 取消
      this._resolve(false);
      this._resolve = null;
      return;
    }
    const btnY = this.cardY + this.cardH - 108;
    if (y >= btnY) {
      const half = this.cardW / 2;
      const isConfirm = x >= this.cardX + half;
      this._resolve(isConfirm);
      this._resolve = null;
    }
  }

  /** 弹窗自己画按钮，直接算两个矩形 */
  drawSelf(ctx, stage) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,18,0.72)';
    ctx.fillRect(0, 0, this.w, this.h);

    const cw = Math.min(600, this.w - 80);
    const pad = 36;
    const tLayout = text.layoutParagraph({
      text: this.body,
      font: font(FONT.body),
      size: FONT.body,
      lineHeight: Math.round(FONT.body * 1.7),
      maxWidth: cw - pad * 2
    });
    const ch = 96 + tLayout.height + 44 + 108;
    const cx = (this.w - cw) / 2;
    const cy = (this.h - ch) / 2;
    this.cardX = cx;
    this.cardY = cy;
    this.cardW = cw;
    this.cardH = ch;

    draw.fillRoundRect(ctx, cx, cy, cw, ch, RADIUS.xl, '#15122E');
    draw.strokeRoundRect(ctx, cx, cy, cw, ch, RADIUS.xl, COLOR.line, 1);

    if (this.title) {
      ctx.font = font(FONT.h2, '600');
      ctx.fillStyle = COLOR.gold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.title, this.w / 2, cy + 62);
      ctx.textAlign = 'left';
    }

    tLayout.width = cw - pad * 2;
    tLayout.size = FONT.body;
    text.drawParagraph(ctx, tLayout, cx + pad, cy + 96, COLOR.ink2);

    const btnY = cy + ch - 108;
    draw.hairline(ctx, cx, btnY - 1, cx + cw, 'rgba(255,255,255,0.12)');
    ctx.font = font(FONT.h3, '600');
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ink2;
    ctx.fillText(this.cancelText, cx + cw / 4, btnY + 54);
    ctx.fillStyle = COLOR.gold;
    ctx.fillText(this.confirmText, cx + (cw * 3) / 4, btnY + 54);
    ctx.textAlign = 'left';

    ctx.beginPath();
    ctx.moveTo(cx + cw / 2, btnY);
    ctx.lineTo(cx + cw / 2, cy + ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------- 列定义的小工具

/** 一列的候选项。给函数就按"已选值"算，给数组就用数组本身 */
function resolveItems(spec, values) {
  if (!spec) return [];
  if (typeof spec.items === 'function') return spec.items(values) || [];
  return spec.items || [];
}

function resolveIndex(spec, values, items) {
  const n = items.length;
  if (!n) return 0;
  const raw = spec && typeof spec.index === 'function' ? spec.index(values) : (spec && spec.index) || 0;
  return Math.max(0, Math.min(n - 1, raw));
}

function itemValue(item) {
  return item && item.value !== undefined ? item.value : item;
}

// ============================================================ 底部选择器

/**
 * 底部弹出的滚轮选择器（日期 / 时间 / 地区）。
 * 小游戏里没有 WXML 的 <picker>，所以从背板到滚轮到确认按钮全得自己画。
 *
 * 支持**联动列**：某列变了就把它后面的列重建（第三级地区选择靠它，见 link()）。
 * 也支持一个额外的动作按钮（`extra`）—— 比如选出生时辰时的「不知道」。
 */
class PickerSheet extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.stage = o.stage;
    // 兜底：没给尺寸时必须撑满屏幕。w/h 为 0 会被基类当成"未定尺寸容器"，
    // 结果是它盖在屏幕上吞掉所有点击，而且点不中确定按钮。
    if (!this.w && o.stage) this.w = o.stage.width;
    if (!this.h && o.stage) this.h = o.stage.height;
    this.sheetTitle = String(o.title || '');
    this.tapEnabled = true;
    this.rows = 4;
    this.headerH = 96;
    this.footerH = (o.safeBottom || 0) + 24;
    this.sheetBodyH = this.rows * ITEM_H;
    // 额外动作按钮（可选）：一列滚轮之外的另一种答案
    this.extra = o.extra || null;
    this.extraH = this.extra ? 92 : 0;
    this.sheetH = this.headerH + this.sheetBodyH + this.extraH + this.footerH + 24;
    this.sheetTop = this.h - this.sheetH;
    this.specs = [];
    this.group = new WheelGroup({
      x: 32,
      y: this.sheetTop + this.headerH + 12,
      w: this.w - 64,
      h: this.sheetBodyH,
      onChange: null
    });
    this.add(this.group);
  }

  addColumn(items, index) {
    const colW = (this.w - 64) / (this.group.wheels.length + 1);
    this.group.wheels.forEach((w) => {
      w.w = colW;
    });
    const wheel = new Wheel({ w: colW, items: items, index: index || 0, x: this.group.wheels.length * colW });
    wheel.h = this.sheetBodyH;
    this.group.addWheel(wheel);
  }

  /**
   * 按列定义建列，并接上联动。
   *
   * 每列写成 `{ items: 数组或(values)=>数组, index: 数字或(values)=>数字 }`。
   * 静态列（items 是数组）永远不会被动过 —— 日期选择器的年/月/日就是静态列，
   * 所以不会出现"选了年，月日被重置回 1"。
   */
  link(specs) {
    this.specs = specs || [];
    this.specs.forEach((spec) => {
      // 静态列（日期/时间）在这里就拿到完整候选项和初始下标；
      // 联动列的候选项此时还没有上游可依，先按空值解析一个占位，
      // 紧接着的 syncFrom 会用真实的上游值重建它们。
      const items = resolveItems(spec, []);
      this.addColumn(items, resolveIndex(spec, [], items));
    });
    this.relayout();
    this.group.onChange = (values, wheel) => {
      this.syncFrom(this.group.wheels.indexOf(wheel), values, false);
    };
    this.syncFrom(0, this.group.values(), true);
    return this;
  }

  /**
   * 重建第 changeIdx 列之后的所有联动列。
   * `initial` 为真时用的是列定义里给的初始下标（打开时还原用户已选的选项），
   * 否则一律归零（换了省，市当然要从第一个开始）。
   */
  syncFrom(changeIdx, valuesIn, initial) {
    const values = (valuesIn || []).slice();
    for (let j = changeIdx + 1; j < this.specs.length; j += 1) {
      const spec = this.specs[j];
      if (typeof spec.items !== 'function') continue; // 静态列不动
      const items = resolveItems(spec, values);
      const wheel = this.group.wheels[j];
      if (!wheel) continue;
      const idx = initial ? resolveIndex(spec, values, items) : 0;
      wheel.setItems(items, idx);
      values[j] = items.length ? itemValue(items[idx]) : undefined;
    }
    return this;
  }

  /** 修正列宽与字号：列数确定后统一按等分重排，三列时字号要收一档 */
  relayout() {
    const n = this.group.wheels.length || 1;
    const colW = (this.w - 64) / n;
    this.group.wheels.forEach((w, i) => {
      w.w = colW;
      w.x = i * colW;
      w.labelSize = n >= 3 ? FONT.body : FONT.h3;
    });
    this.group.w = this.w - 64;
    return this;
  }

  values() {
    return this.group.values();
  }

  /** 额外动作按钮的矩形（本地坐标） */
  extraRect() {
    if (!this.extra) return null;
    return {
      x: 32,
      y: this.sheetTop + this.headerH + this.sheetBodyH + 12,
      w: this.w - 64,
      h: 68
    };
  }

  onTap(x, y) {
    if (!this._resolve) return;
    if (y < this.sheetTop) {
      this._resolve(null);
      this._resolve = null;
      return;
    }
    const box = this.extraRect();
    if (box && y >= box.y && y <= box.y + box.h && x >= box.x && x <= box.x + box.w) {
      const r = this._resolve;
      this._resolve = null;
      r(this.extra.value);
      return;
    }
    const inHeader = y >= this.sheetTop && y <= this.sheetTop + this.headerH;
    if (inHeader) {
      if (x < 160) {
        this._resolve(null);
        this._resolve = null;
      } else if (x > this.w - 160) {
        this._resolve(this.values());
        this._resolve = null;
      }
    }
  }

  ask() {
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  drawSelf(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,18,0.66)';
    ctx.fillRect(0, 0, this.w, this.sheetTop);

    draw.fillRoundRect(ctx, 0, this.sheetTop, this.w, this.sheetH, RADIUS.xl, '#15122E');
    draw.hairline(ctx, 24, this.sheetTop + this.headerH, this.w - 24, 'rgba(255,255,255,0.12)');

    ctx.font = font(FONT.body);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText('取消', 32, this.sheetTop + this.headerH / 2);
    ctx.fillStyle = COLOR.gold;
    ctx.font = font(FONT.body, '600');
    ctx.textAlign = 'right';
    ctx.fillText('确定', this.w - 32, this.sheetTop + this.headerH / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(this.sheetTitle, this.w / 2, this.sheetTop + this.headerH / 2);
    ctx.textAlign = 'left';

    const box = this.extraRect();
    if (box) {
      draw.fillRoundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2, 'rgba(255,255,255,0.05)');
      draw.strokeRoundRect(ctx, box.x, box.y, box.w, box.h, box.h / 2, COLOR.lineSoft, 1);
      ctx.font = font(FONT.body, '600');
      ctx.fillStyle = COLOR.ink2;
      ctx.textAlign = 'center';
      ctx.fillText(this.extra.text, box.x + box.w / 2, box.y + box.h / 2 + 1);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

/** 便捷入口：弹一个选择器，返回选中的值数组或 null */
function showPicker(scene, opts) {
  const sheet = new PickerSheet(Object.assign({
    x: 0, y: 0, w: scene.stage.width, h: scene.stage.height, stage: scene.stage
  }, opts));
  sheet.link(opts.columns || []);
  scene.overlay.add(sheet);
  return sheet.ask().then((v) => {
    scene.overlay.clearChild(sheet);
    return v;
  });
}

// ============================================================ 文本输入

/**
 * 拉起原生键盘输入一行文字。
 * 小游戏没有输入框控件，只能用 wx.showKeyboard + 全局键盘事件自己接。
 */
function prompt(o) {
  const opt = o || {};
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.showKeyboard) {
      resolve(null);
      return;
    }
    let value = opt.value || '';
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      if (wx.offKeyboardInput) wx.offKeyboardInput(onInput);
      if (wx.offKeyboardConfirm) wx.offKeyboardConfirm(onConfirm);
      if (wx.offKeyboardComplete) wx.offKeyboardComplete(onComplete);
      if (wx.hideKeyboard) wx.hideKeyboard({});
      resolve(ok ? value : null);
    };

    const onInput = (res) => {
      value = res.value;
      if (opt.onInput) opt.onInput(value);
    };
    const onConfirm = (res) => {
      value = res.value;
      finish(true);
    };
    const onComplete = () => finish(false);

    wx.onKeyboardInput(onInput);
    wx.onKeyboardConfirm(onConfirm);
    wx.onKeyboardComplete(onComplete);
    wx.showKeyboard({
      defaultValue: opt.value || '',
      maxLength: opt.maxLength || 12,
      multiple: false,
      confirmHold: false,
      confirmType: 'done',
      fail: () => finish(false)
    });
  });
}

module.exports = { Button, ScrollView, Wheel, WheelGroup, Toast, Modal, PickerSheet, showPicker, prompt, ITEM_H };
