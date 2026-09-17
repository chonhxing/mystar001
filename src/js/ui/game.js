const draw = require('../draw.js');
const text = require('../text.js');
const { Widget, Label, Tag, setStage, getStage } = require('./widget.js');
const { COLOR, RARITY_STYLE, FONT, font, RADIUS } = require('../theme.js');
const copy = require('../../../config/copy.js');
const { FATE_MAP } = require('../../../data/fates.js');

/**
 * 游戏专用控件：角色卡、八轴条、共振环、顶栏、底部导航、星空底。
 * 这些对应小程序版里的 char-card / dim-bar / star-bg 组件，视觉语言保持一致。
 */

// ============================================================ 星空背景

class Starfield extends Widget {
  constructor(opts) {
    super(opts);
    this.tone = (opts && opts.tone) || 'default';
    this.seed = (opts && opts.seed) || 0;
    this.withRing = !opts || opts.ring !== false;
  }

  update() {
    return true; // 星点和刻度环一直在动
  }

  drawSelf(ctx, stage, t) {
    // 底色
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, COLOR.bg);
    g.addColorStop(0.45, '#100D26');
    g.addColorStop(1, COLOR.bgDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // 星云
    const warm = this.tone === 'legend';
    draw.radialGlow(ctx, this.w * 0.2, this.h * 0.08, this.w * 0.85, warm ? 'rgba(232,200,122,0.26)' : 'rgba(139,108,240,0.26)', 1);
    draw.radialGlow(ctx, this.w * 0.88, this.h * 0.22, this.w * 0.7, 'rgba(99,215,232,0.14)', 1);
    draw.radialGlow(ctx, this.w * 0.5, this.h * 1.02, this.w * 0.9, 'rgba(232,200,122,0.12)', 1);

    draw.starfield(ctx, this.w, this.h, t, this.seed);
    if (this.withRing) draw.zodiacRing(ctx, this.w / 2, -40, this.w * 0.62, t);
  }
}

// ============================================================ 顶栏

class TopBar extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.title = String(o.title || '');
    this.onBack = o.onBack || null;
    this.tapEnabled = false;
    this.backW = 96;
    this.backH = 72;
  }

  hitTest(x, y, loose) {
    if (!this.visible) return null;
    // 只有返回按钮可点（不受宽松模式影响：返回按钮必须精确点到）
    if (this.onBack && x >= 0 && x <= this.backW && y >= 0 && y <= this.backH) return this;
    return null;
  }

  onTap() {
    if (this.onBack) this.onBack();
  }

  drawSelf(ctx) {
    const y = this.h / 2;
    if (this.onBack) {
      ctx.save();
      ctx.strokeStyle = COLOR.ink2;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(34, y - 14);
      ctx.lineTo(20, y);
      ctx.lineTo(34, y + 14);
      ctx.stroke();
      ctx.restore();
    }
    if (this.title) {
      ctx.font = font(FONT.h3, '600');
      ctx.fillStyle = COLOR.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.singleLine(this.title, this.w - 200, font(FONT.h3, '600')), this.w / 2, y);
      ctx.textAlign = 'left';
    }
  }
}

// ============================================================ 底部导航

/**
 * 三个主页共用的底部导航。
 *
 * ⚠️ 这里踩过一个坑：TabBar 的 tabs 必须显式传进来，场景里忘了传的话
 * `this.tabs` 就是空数组 —— 既不显示、也不响应点击（onTap 里
 * `idx < this.tabs.length` 永远为 false），而且**不报任何错**，
 * 表现就是"底部导航莫名其妙没了"。所以统一定义在这里，场景只管 active。
 */
const MAIN_TABS = [
  { key: 'home', label: copy.SCENE.home.tab },
  { key: 'codex', label: copy.SCENE.codex.tab },
  { key: 'account', label: copy.SCENE.account.tab }
];

class TabBar extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.tabs = o.tabs && o.tabs.length ? o.tabs : MAIN_TABS;
    this.active = o.active || 0;
    this.onSelect = o.onSelect || null;
    this.tapEnabled = false;
    this.barH = 108;
  }

  hitTest(x, y, loose) {
    if (!this.visible) return null;
    if (y < this.h - this.barH) return null;
    return this;
  }

  onTap(x) {
    const idx = Math.floor((x / this.w) * this.tabs.length);
    if (idx < 0 || idx >= this.tabs.length || idx === this.active) return;
    if (this.onSelect) {
      this.onSelect(idx, this.tabs[idx]);
      return;
    }
    // 没传 onSelect 时的默认行为：按 key 切场景（三处主页行为一致）
    // 控件拿不到 stage 实例，所以走 widget.js 的模块级引用
    const tab = this.tabs[idx];
    const st = getStage();
    if (tab && tab.key && st && st.router) st.router.reset(tab.key);
  }

  drawSelf(ctx) {
    const top = this.h - this.barH;
    ctx.save();
    ctx.fillStyle = 'rgba(11,10,31,0.94)';
    ctx.fillRect(0, top, this.w, this.barH);
    draw.hairline(ctx, 0, top, this.w, 'rgba(232,200,122,0.16)');

    const step = this.w / this.tabs.length;
    this.tabs.forEach((tab, i) => {
      const cx = step * i + step / 2;
      const on = i === this.active;
      ctx.font = font(FONT.body, on ? '600' : '');
      ctx.fillStyle = on ? COLOR.gold : COLOR.ink3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tab.label, cx, top + this.barH / 2);
      if (on) {
        draw.fillRoundRect(ctx, cx - 18, top + this.barH / 2 + 26, 36, 4, 2, COLOR.gold);
      }
    });
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ============================================================ 共振环

class ResonanceRing extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.value = o.value || 0; // 0~100
    this.label = o.label === undefined ? '共振' : o.label;
    this.animateFrom = o.animate === false ? this.value : 0;
    this.current = this.animateFrom;
    this.color = o.color || COLOR.gold;
  }

  update(dt) {
    if (Math.abs(this.current - this.value) < 0.4) {
      if (this.current !== this.value) {
        this.current = this.value;
        return true;
      }
      return false;
    }
    this.current += (this.value - this.current) * Math.min(1, dt / 420);
    return true;
  }

  drawSelf(ctx) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const r = Math.min(this.w, this.h) / 2 - 8;
    draw.glow(ctx, cx, cy, r * 1.5, this.color, 0.12);
    draw.ring(ctx, cx, cy, r, this.current / 100, { lineWidth: 8, color: this.color });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(FONT.h1, '700');
    ctx.fillStyle = this.color;
    ctx.fillText(`${Math.round(this.current)}`, cx, cy - 6);
    ctx.font = font(FONT.tiny);
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText('%', cx + 34, cy + 4);
    if (this.label) {
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink3;
      ctx.fillText(this.label, cx, cy + 32);
    }
    ctx.textAlign = 'left';
  }
}

// ============================================================ 八轴条

class DimBars extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.axes = o.axes || [];
    this.rowH = o.rowH || 78;
    this.h = this.h || this.axes.length * this.rowH;
    this.showPoles = o.showPoles !== false;
  }

  drawSelf(ctx) {
    const labelFont = font(FONT.small);
    this.axes.forEach((a, i) => {
      const y = i * this.rowH;
      const active = a.value >= 50;
      const color = active ? COLOR.gold : COLOR.violet;

      ctx.font = labelFont;
      ctx.fillStyle = COLOR.ink2;
      ctx.textBaseline = 'middle';
      ctx.fillText(a.name, 0, y + 14);

      // 极性徽章
      const badge = a.badge || (active ? a.pos : a.neg);
      if (badge) {
        ctx.font = font(FONT.micro);
        ctx.fillStyle = active ? COLOR.gold : COLOR.violetLight;
        ctx.textAlign = 'right';
        ctx.fillText(badge, this.w, y + 14);
        ctx.textAlign = 'left';
      }

      // 轨道
      const trackY = y + 38;
      const trackH = 12;
      draw.fillRoundRect(ctx, 0, trackY, this.w, trackH, trackH / 2, 'rgba(255,255,255,0.08)');
      const fillW = Math.max(6, (this.w * Math.max(0, Math.min(100, a.value))) / 100);
      draw.fillRoundRect(ctx, 0, trackY, fillW, trackH, trackH / 2, color);
      draw.glow(ctx, fillW, trackY + trackH / 2, trackH * 1.6, color, 0.18);

      // 中位线
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(this.w / 2, trackY, 1, trackH);

      // 数值
      ctx.font = font(FONT.small, '600');
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(String(a.value), this.w, y + 14);
      ctx.textAlign = 'left';

      if (this.showPoles) {
        ctx.font = font(FONT.micro);
        ctx.fillStyle = COLOR.ink4;
        ctx.fillText(a.pos, 0, trackY + trackH + 14);
        ctx.textAlign = 'right';
        ctx.fillText(a.neg, this.w, trackY + trackH + 14);
        ctx.textAlign = 'left';
      }
    });
  }
}

// ============================================================ 角色卡

class CharCard extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.char = o.char;
    this.rarity = o.rarity || RARITY_STYLE[(o.char && o.char.rarity) || 'common'];
    this.rarityKey = (o.char && o.char.rarity) || 'common';
    this.resonance = o.resonance || 0;
    this.size = o.size || 'md'; // lg | md | sm
    this.locked = !!o.locked;
    this.showFates = o.showFates !== false;
    this.showResonance = o.showResonance !== false;
    this.showMotif = o.showMotif !== false;
    this.tapEnabled = !!o.onTap;
    this.handler = o.onTap || null;
    this.pressed = false;
    // 角色在库里的编号（图鉴给"收集感"用）
    this.index = o.index || 0;

    if (!this.w || !this.h) {
      if (this.size === 'lg') {
        this.w = this.w || 632;
        this.h = this.h || 520;
      } else if (this.size === 'sm') {
        this.w = this.w || 686;
        this.h = this.h || 152;
      } else {
        this.w = this.w || 320;
        this.h = this.h || 300;
      }
    }
  }

  onPressStart() {
    this.pressed = true;
    this.dirty();
  }

  onPressEnd() {
    this.pressed = false;
    this.dirty();
  }

  onTap() {
    if (this.handler) this.handler(this);
  }

  /** 徽记区的尺寸。不再是 3:4 的立绘位，而是一块扁的徽记区 */
  emblemRect() {
    if (this.size === 'sm') return { x: 0, y: 0, w: 116, h: 116 };
    return { x: 0, y: 0, w: this.w, h: Math.round(this.w * 0.42) };
  }

  /** id 派生的稳定种子：同一个角色每次都是同一个徽记 */
  seedOf(c) {
    let h = 0;
    const str = String((c && c.id) || 'x');
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h;
  }

  /** 主角卡头字：中文名取第一个字，外文名取首字母 */
  glyphOf(c) {
    const n = (c && c.name) || '?';
    return n.slice(0, 1);
  }

  drawSelf(ctx) {
    const c = this.char || { name: '?', work: '', id: 'x', fates: [] };
    const style = RARITY_STYLE[this.rarityKey] || RARITY_STYLE.common;
    const seed = this.seedOf(c);
    const glyph = this.locked ? '?' : this.glyphOf(c);

    ctx.save();
    if (this.pressed) {
      ctx.translate(this.w / 2, this.h / 2);
      ctx.scale(0.98, 0.98);
      ctx.translate(-this.w / 2, -this.h / 2);
    }

    // ---------------- 小卡：左徽记 + 右文字 ----------------
    if (this.size === 'sm') {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, COLOR.panel);
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, style.color, 0.5);

      const er = this.emblemRect();
      const cx = er.w / 2 + 8;
      const cy = this.h / 2;
      if (this.locked) {
        draw.fillRoundRect(ctx, 8, 8, er.w, er.h, RADIUS.md, 'rgba(255,255,255,0.04)');
        ctx.font = font(52, '700');
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy);
      } else {
        draw.emblem(ctx, cx, cy, er.w / 2 - 2, seed, style.color);
        ctx.font = font(40, '700');
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, cx, cy + 1);
      }

      const tx = er.w + 24;
      const tw = this.w - tx - 28;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = font(FONT.h3, '600');
      ctx.fillStyle = this.locked ? COLOR.ink3 : COLOR.ink;
      ctx.fillText(text.singleLine(this.locked ? '未遇见' : c.name, tw - 90, font(FONT.h3, '600')), tx, 46);

      if (this.showResonance && this.resonance > 0 && !this.locked) {
        ctx.font = font(FONT.h3, '700');
        ctx.fillStyle = COLOR.gold;
        ctx.textAlign = 'right';
        ctx.fillText(`${this.resonance}%`, this.w - 26, 46);
        ctx.textAlign = 'left';
      }

      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(
        text.singleLine(this.locked ? '在匹配中遇见 TA' : `《${c.work}》· ${c.medium || ''}`, tw, font(FONT.tiny)),
        tx,
        84
      );
      if (this.showFates && !this.locked) {
        ctx.font = font(FONT.micro);
        ctx.fillStyle = style.color;
        const fateNames = (c.fates || []).map((f) => (FATE_MAP[f] || {}).name).filter(Boolean);
        ctx.fillText(text.singleLine(fateNames.slice(0, 3).join(' · '), tw, font(FONT.micro)), tx, 120);
      }
      ctx.restore();
      return;
    }

    // ---------------- 大卡 / 中卡：上徽记 + 下文字 ----------------
    const er = this.emblemRect();
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.lg, COLOR.panel);
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.lg, style.color, 0.6);

    // 徽记区
    const cx = this.w / 2;
    const cy = er.h / 2;
    const ringR = Math.min(er.h * 0.42, this.w * 0.24);
    if (this.locked) {
      draw.emblem(ctx, cx, cy, ringR, seed, 'rgba(255,255,255,0.14)');
      ctx.font = font(ringR, '700');
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy + 2);
    } else {
      draw.emblem(ctx, cx, cy, ringR, seed, style.color);
      ctx.font = font(ringR * 1.05, '700');
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy + 3);
    }

    // 稀有度星星：右上角
    if (!this.locked) {
      const stars = (this.rarity && this.rarity.stars) || 1;
      for (let i = 0; i < 5; i += 1) {
        draw.star(ctx, this.w - 24 - i * 24, 26, 8, i < stars ? COLOR.gold : 'rgba(255,255,255,0.14)', i < stars);
      }
    }
    // 编号：左上角，给收集感
    if (this.index) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`No.${String(this.index).padStart(2, '0')}`, 22, 26);
    }

    // 文字区
    const by = er.h + 10;
    const tw = this.w - 44;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(this.size === 'lg' ? FONT.h1 : FONT.body, '600');
    ctx.fillStyle = this.locked ? COLOR.ink3 : COLOR.ink;
    ctx.fillText(
      text.singleLine(this.locked ? '未遇见' : c.name, tw, font(FONT.h1, '600')),
      22,
      by + 34
    );

    ctx.font = font(FONT.tiny);
    ctx.fillStyle = COLOR.ink4;
    ctx.fillText(this.locked ? '在匹配中遇见 TA' : `《${c.work}》· ${c.medium || ''}`, 22, by + 72);

    if (this.size === 'lg' && !this.locked && this.showMotif && c.motif) {
      const tLayout = text.layoutParagraph({
        text: c.motif,
        font: font(FONT.small),
        size: FONT.small,
        lineHeight: 40,
        maxWidth: tw,
        maxLines: 2
      });
      text.drawParagraph(ctx, tLayout, 22, by + 100, COLOR.ink3);
    }

    if (this.showResonance && this.resonance > 0 && !this.locked) {
      const barY = this.h - 40;
      draw.fillRoundRect(ctx, 22, barY, tw, 8, 4, 'rgba(255,255,255,0.10)');
      const w = (tw * Math.min(100, this.resonance)) / 100;
      const g = ctx.createLinearGradient(22, 0, this.w - 22, 0);
      g.addColorStop(0, COLOR.violet);
      g.addColorStop(1, COLOR.gold);
      draw.fillRoundRect(ctx, 22, barY, w, 8, 4, g);
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.gold;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`共振 ${this.resonance}%`, this.w - 22, barY - 18);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

// ============================================================ 命途标签行

class FateTags extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.tags = o.tags || [];
    this.gap = o.gap || 12;
    this.tapEnabled = false;
  }

  drawSelf(ctx) {
    let x = 0;
    const y = 0;
    this.tags.forEach((t) => {
      const label = t.name || String(t);
      const w = Math.round(text.measure(label, font(FONT.tiny))) + 32;
      if (x + w > this.w && x > 0) return;
      const special = t.special;
      draw.fillRoundRect(ctx, x, y, w, 44, 22, special ? 'rgba(232,200,122,0.12)' : 'rgba(255,255,255,0.06)');
      draw.strokeRoundRect(ctx, x, y, w, 44, 22, special ? 'rgba(232,200,122,0.32)' : 'rgba(255,255,255,0.08)', 1);
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = special ? COLOR.gold : COLOR.violetLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + 23);
      ctx.textAlign = 'left';
      x += w + this.gap;
    });
  }

  static measure(tags, gap) {
    let w = 0;
    const g = gap === undefined ? 12 : gap;
    (tags || []).forEach((t) => {
      w += Math.round(text.measure(t.name || String(t), font(FONT.tiny))) + 32 + g;
    });
    return Math.max(0, w - g);
  }
}

module.exports = { Starfield, TopBar, TabBar, MAIN_TABS, ResonanceRing, DimBars, CharCard, FateTags };
