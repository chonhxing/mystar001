const draw = require('../draw.js');
const text = require('../text.js');
const icons = require('./icon.js');
const { Widget, Label, Tag, Paragraph, IconText, setStage, getStage } = require('./widget.js');
const { COLOR, RARITY_STYLE, FONT, font, RADIUS, CARD, EASE, pad2 } = require('../theme.js');
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
    this.withConstellation = !opts || opts.constellation !== false;
    this.withMeteor = !opts || opts.meteor !== false;
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
    /**
     * 星座连线 + 流星：底色从"撒了一把白点"变成"真的在天上"。
     * 两条都压得很淡（10%~12%）—— 它们是氛围，不该和内容抢注意力。
     */
    if (this.withConstellation) {
      draw.constellation(ctx, this.w * 0.04, this.h * 0.06, this.w * 0.52, this.h * 0.20, this.seed + 3, 0.12, 5);
      draw.constellation(ctx, this.w * 0.46, this.h * 0.52, this.w * 0.48, this.h * 0.26, this.seed + 11, 0.09, 6);
    }
    if (this.withMeteor) {
      // 三颗，周期各不相同 —— 同一时刻可能一颗都没有，那才是真的夜空
      draw.meteor(ctx, this.w, this.h, t, this.seed);
      draw.meteor(ctx, this.w, this.h, t, this.seed + 5);
      draw.meteor(ctx, this.w, this.h, t, this.seed + 13);
    }
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

// ============================================================ 结果数字环

class ResonanceRing extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.value = o.value || 0; // 0~100
    this.label = o.label === undefined ? '共振' : o.label;
    this.animateFrom = o.animate === false ? this.value : 0;
    this.current = this.animateFrom;
    this.color = o.color || COLOR.gold;
    this.duration = o.duration === undefined ? 900 : o.duration;
    this.elapsed = this.animateFrom === this.value ? this.duration : 0;
  }

  update(dt) {
    if (this.elapsed >= this.duration) return this.updatePress(dt) || false;
    this.elapsed += dt;
    const p = Math.min(1, this.elapsed / this.duration);
    this.current = this.value * EASE.outCubic(p);
    if (p >= 1) this.current = this.value;
    return true;
  }

  settle() {
    this.elapsed = this.duration;
    this.current = this.value;
    return super.settle();
  }

  drawSelf(ctx) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const r = Math.min(this.w, this.h) / 2 - 8;
    const p = Math.max(0, Math.min(1, this.current / 100));
    draw.glow(ctx, cx, cy, r * 1.5, this.color, 0.12);
    // 底环 + 紫色→金色的进度环：整页的视觉锚点
    ctx.save();
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
    if (p > 0) {
      const g = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
      g.addColorStop(0, COLOR.violet);
      g.addColorStop(1, this.color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = g;
      ctx.stroke();
    }
    ctx.restore();

    ctx.textBaseline = 'middle';
    // 数字和 % 拼成一组整体居中：写死坐标的话，100 这种三位数会把 % 顶到数字上
    const numStr = String(Math.round(this.current));
    const nf = font(FONT.h1, '700');
    const pf = font(FONT.tiny);
    const nw = text.measure(numStr, nf);
    const pw = text.measure('%', pf);
    const gap = 6;
    const total = nw + gap + pw;
    const left = cx - total / 2;
    ctx.textAlign = 'left';
    ctx.font = nf;
    ctx.fillStyle = this.color;
    ctx.fillText(numStr, left, cy - 6);
    ctx.font = pf;
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText('%', left + nw + gap, cy + 10);
    if (this.label) {
      ctx.font = pf;
      ctx.fillStyle = COLOR.ink3;
      ctx.textAlign = 'center';
      ctx.fillText(this.label, cx, cy + 40);
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

/** 三档卡片的默认高度。图鉴的网格也要用，所以放成静态方法，别在两处各算一遍 */
const CARD_H = { lg: 520, md: 300, sm: 172 };

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
    // 按压反馈交给基类（0.97 + 缓动），不再是一按就"啪"地跳一下
    this.pressScale = this.tapEnabled ? 0.97 : 1;
    // 角色在库里的编号（图鉴给"收集感"用）
    this.index = o.index || 0;
    /** 入场：缩放 + 光晕扩散（0 → 1 落位）。图鉴一次刷出几十张时是"整片亮起来" */
    this.entryT = o.animate === false ? 1 : 0;
    this.entryMs = o.entryMs || 460;

    if (!this.w || !this.h) {
      this.w = this.w || (this.size === 'lg' ? 632 : this.size === 'sm' ? 686 : 320);
      this.h = this.h || CARD_H[this.size] || 300;
    }
  }

  /** 某档卡片在给定宽度下的标准高度（图鉴网格排版用） */
  static heightFor(size, w) {
    if (size === 'sm') return CARD_H.sm;
    if (size === 'lg') return CARD_H.lg;
    return Math.round(w * 0.42) + 136;
  }

  update(dt) {
    let changed = this.updatePress(dt);
    if (this.entryT < 1) {
      this.entryT = Math.min(1, this.entryT + dt / this.entryMs);
      changed = true;
    }
    return changed;
  }

  settle() {
    this.entryT = 1;
    this.pressT = 0;
    return super.settle();
  }

  onPressStart() {
    if (this.pressScale === 1) return;
    this.pressed = true;
    this.dirty();
  }

  onPressEnd() {
    if (this.pressScale === 1) return;
    this.pressed = false;
    this.dirty();
  }

  onTap() {
    if (this.handler) this.handler(this);
  }

  /** 徽记区的尺寸。不再是 3:4 的立绘位，而是一块扁的徽记区 */
  emblemRect() {
    if (this.size === 'sm') return { x: 0, y: 0, w: 124, h: 124 };
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

  /** 稀有度光效强度：传说最亮，寻常几乎不发光（不然"稀有"就不稀有了） */
  edgeStrength() {
    if (this.locked) return 0.22;
    const k = this.rarityKey;
    if (k === 'legend') return 1;
    if (k === 'epic') return 0.75;
    if (k === 'rare') return 0.5;
    return 0.3;
  }

  drawSelf(ctx) {
    const c = this.char || { name: '?', work: '', id: 'x', fates: [] };
    const style = RARITY_STYLE[this.rarityKey] || RARITY_STYLE.common;
    const seed = this.seedOf(c);
    const r = this.size === 'lg' ? CARD.radius : RADIUS.md;

    ctx.save();
    // 入场：从 0.9 弹出到 1（outBack 会略微过冲一点，有"落定"的手感）
    if (this.entryT < 1) {
      const p = EASE.outBack(this.entryT);
      const k = 0.9 + 0.1 * p;
      ctx.translate(this.w / 2, this.h / 2);
      ctx.scale(k, k);
      ctx.translate(-this.w / 2, -this.h / 2);
      draw.radialGlow(ctx, this.w / 2, this.h / 2, this.w * 0.5 * (1.4 - 0.4 * p), style.color, (1 - this.entryT) * 0.28);
    }
    // 未遇见：整张卡退到半透明，制造"还想去抽"的欲望
    if (this.locked) ctx.globalAlpha *= 0.5;

    // ---------------- 小卡：左徽记 + 右文字 ----------------
    if (this.size === 'sm') {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, r, CARD.fill);
      const er = this.emblemRect();
      const cx = er.w / 2 + 10;
      const cy = this.h / 2;
      if (this.locked) {
        draw.starPlaceholder(ctx, cx, cy, er.w * 0.32, 'rgba(255,255,255,0.30)');
      } else {
        draw.emblem(ctx, cx, cy, er.w / 2 - 2, seed, style.color);
        ctx.font = font(40, '700');
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.glyphOf(c), cx, cy + 1);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const tx = er.w + 26;
      const tw = this.w - tx - 32;
      // 名字和共振度同排：左边是谁、右边多合，一眼看完
      const showNum = this.showResonance && this.resonance > 0 && !this.locked;
      const numW = showNum ? 96 : 0;
      ctx.font = font(FONT.cardTitle, '600');
      ctx.fillStyle = this.locked ? COLOR.ink3 : COLOR.ink;
      ctx.fillText(
        text.singleLine(this.locked ? '未遇见' : c.name, tw - numW, font(FONT.cardTitle, '600')),
        tx,
        52
      );
      if (showNum) {
        ctx.font = font(FONT.h3, '700');
        ctx.fillStyle = COLOR.gold;
        ctx.textAlign = 'right';
        ctx.fillText(`${this.resonance}%`, this.w - 32, 52);
        ctx.textAlign = 'left';
      }

      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink3;
      ctx.fillText(
        text.singleLine(this.locked ? '在匹配中遇见 TA' : `《${c.work}》· ${c.medium || ''}`, tw, font(FONT.tiny)),
        tx,
        94
      );
      if (this.showFates && !this.locked) {
        ctx.font = font(FONT.micro);
        ctx.fillStyle = style.color;
        const fateNames = (c.fates || []).map((f) => (FATE_MAP[f] || {}).name).filter(Boolean);
        ctx.fillText(text.singleLine(fateNames.slice(0, 3).join(' · '), tw, font(FONT.micro)), tx, 132);
      }
      draw.rarityEdge(ctx, 0, 0, this.w, this.h, r, style.color, this.edgeStrength());
      ctx.restore();
      return;
    }

    // ---------------- 大卡 / 中卡：上徽记 + 下文字 ----------------
    const er = this.emblemRect();
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, r, CARD.fill);

    const cx = this.w / 2;
    const cy = er.h / 2;
    const ringR = Math.min(er.h * 0.42, this.w * 0.24);
    if (this.locked) {
      // 未遇见：✦ 占位而不是问号 —— "还没抽到"比"你答错了"友好
      draw.starPlaceholder(ctx, cx, cy, ringR * 0.68, 'rgba(255,255,255,0.32)');
    } else {
      draw.emblem(ctx, cx, cy, ringR, seed, style.color);
      ctx.font = font(ringR * 1.05, '700');
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.glyphOf(c), cx, cy + 3);
    }
    ctx.textAlign = 'left';

    // 星级：右上角，实心金 + 空心灰
    if (!this.locked) {
      const stars = (this.rarity && this.rarity.stars) || 1;
      draw.starsRow(ctx, this.w - 22 - stars * 22, 22, 8, stars, 5, 22);
    }
    // 编号：左上角，压小压淡（它是收集册的页码，不是主角：固定 40% 不透明）
    if (this.index) {
      const keep = ctx.globalAlpha;
      ctx.globalAlpha = keep * (this.locked ? 0.8 : 0.4);
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`No.${pad2(this.index)}`, 20, 22);
      ctx.globalAlpha = keep;
    }

    // 文字区
    const by = er.h + 12;
    const tw = this.w - 44;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const big = this.size === 'lg';
    const nameSize = big ? FONT.h1 : FONT.h2;
    const showNum = this.showResonance && this.resonance > 0 && !this.locked;
    // 共振数字的排版先算出来：名字和作品行都要让开这一列，
    // 否则长名字/长作品会拱到大数字底下（布局审计会报重叠）
    const numStr = showNum ? String(this.resonance) : '';
    const nf = big ? font(FONT.big, '700') : font(FONT.h3, '700');
    const pf = font(FONT.tiny);
    const nw = showNum ? text.measure(numStr, nf) : 0;
    const pw = showNum ? text.measure(big ? '%' : '', pf) : 0;
    const numW = showNum ? nw + pw + 40 : 0;

    ctx.font = font(nameSize, '600');
    ctx.fillStyle = this.locked ? COLOR.ink3 : COLOR.ink;
    ctx.fillText(
      text.singleLine(this.locked ? '未遇见' : c.name, tw - numW, font(nameSize, '600')),
      22,
      by + 26
    );

    if (showNum) {
      const left = this.w - 22 - (nw + (big ? 6 + pw : 0));
      ctx.font = nf;
      ctx.fillStyle = COLOR.gold;
      ctx.fillText(big ? numStr : `${numStr}%`, left, by + (big ? 24 : 26));
      if (big) {
        ctx.font = pf;
        ctx.fillStyle = COLOR.ink3;
        ctx.fillText('%', left + nw + 6, by + 38);
      }
    }

    ctx.font = font(FONT.tiny);
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText(
      text.singleLine(this.locked ? '在匹配中遇见 TA' : `《${c.work}》· ${c.medium || ''}`, tw - numW, font(FONT.tiny)),
      22,
      by + (big ? 84 : 66)
    );

    if (big && !this.locked && this.showMotif && c.motif) {
      const tLayout = text.layoutParagraph({
        text: c.motif,
        font: font(FONT.small),
        size: FONT.small,
        lineHeight: 40,
        maxWidth: tw,
        maxLines: 2
      });
      text.drawParagraph(ctx, tLayout, 22, by + 116, COLOR.ink3);
    }

    // 底部只留一条 2px 的细进度条（带流光）—— 数字已经搬到名字那排了
    if (showNum) {
      draw.flowBar(ctx, 22, this.h - 26, tw, 4, this.resonance / 100, this.entryT * 1200, {
        from: COLOR.violet,
        to: COLOR.gold
      });
    }

    draw.rarityEdge(ctx, 0, 0, this.w, this.h, r, style.color, this.edgeStrength());
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
    /** 印章感：金色描边 + 微光（稀有命途、共振度这些"值得显摆"的标签） */
    this.seal = o.seal !== false;
  }

  drawSelf(ctx) {
    let x = 0;
    const y = 0;
    this.tags.forEach((t) => {
      const label = t.name || String(t);
      const w = Math.round(text.measure(label, font(FONT.tiny))) + 34;
      if (x + w > this.w && x > 0) return;
      const special = t.special;
      if (special && this.seal) {
        // 印章感：淡金底 + 亮金边 + 一圈外发光
        draw.fillRoundRect(ctx, x, y, w, 46, 23, 'rgba(232,200,122,0.10)');
        ctx.save();
        ctx.shadowColor = 'rgba(232,200,122,0.55)';
        ctx.shadowBlur = 10;
        draw.strokeRoundRect(ctx, x, y, w, 46, 23, 'rgba(232,200,122,0.62)', 1.3);
        ctx.restore();
      } else {
        draw.fillRoundRect(ctx, x, y, w, 46, 23, 'rgba(255,255,255,0.06)');
        draw.strokeRoundRect(ctx, x, y, w, 46, 23, 'rgba(255,255,255,0.08)', 1);
      }
      ctx.font = font(FONT.tiny, special ? '600' : '');
      ctx.fillStyle = special ? COLOR.gold : COLOR.violetLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + 24);
      ctx.textAlign = 'left';
      x += w + this.gap;
    });
  }

  static measure(tags, gap) {
    let w = 0;
    const g = gap === undefined ? 12 : gap;
    (tags || []).forEach((t) => {
      w += Math.round(text.measure(t.name || String(t), font(FONT.tiny))) + 34 + g;
    });
    return Math.max(0, w - g);
  }
}

// ============================================================ 今日提示卡

/**
 * 今日提示卡。首页和结果页共用同一个组件、两种密度。
 *
 * 以前两个页面各写一份（首页 6 行 Label、结果页 4 行 KVRow），
 * 于是同一个"宜"在两页的字号和颜色都不一样 —— 用户看到的"层级不清"就是这么来的。
 * 现在只有一处定义：图标 + 左对齐 + 行间细分割线 + 星级 + 印章。
 */
class TodayCard extends Widget {
  /**
   * @param {object} o
   *   fortune  core/fortune.js 的日运结果
   *   chart    命盘（取"最突出的一轴"）
   *   full     true = 结果页密度（两条宜、两条忌、幸运三件套齐全）
   */
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.f = o.fortune || null;
    this.chart = o.chart || null;
    this.full = !!o.full;
    this.radius = o.radius || CARD.radius;
    this.pad = CARD.pad;
    this.rows = [];
    this.h = this.measureLayout();
  }

  /** 行式布局：一次算清，drawSelf 只按算好的 y 画（两处各算一遍必然对不齐） */
  measureLayout() {
    const innerW = this.w - this.pad * 2;
    this.innerW = innerW;
    let y = this.pad;

    this.headY = y + 30; // 日期 / 星级 / 印章 的行中心
    y += 76;

    const f = this.f || { good: [], bad: [], levelDesc: '' };
    const descPara = new Paragraph({
      x: 0, y: 0, w: innerW, text: f.levelDesc || '', size: FONT.body, color: COLOR.ink2, lineHeight: 46
    });
    this.descY = y;
    y += descPara.h + 22;
    this.descH = descPara.h;

    this.line1Y = y;
    y += 24;

    // 宜 / 忌：图标 + 文案，**一律左对齐**。
    // 以前是"宜在左、内容右对齐"，视线要来回跳（用户点名过）
    const good = this.full ? (f.good || []).slice(0, 2) : (f.good || []).slice(0, 1);
    const bad = this.full ? (f.bad || []).slice(0, 2) : (f.bad || []).slice(0, 1);
    this.rows = [];
    good.forEach((v) => {
      this.rows.push({ icon: 'check', iconColor: COLOR.gold, text: `${copy.UI.todayGood} ${v}`, color: COLOR.ink });
    });
    bad.forEach((v) => {
      this.rows.push({ icon: 'cross', iconColor: COLOR.violetLight, text: `${copy.UI.todayBad} ${v}`, color: COLOR.ink2 });
    });
    if (this.full) {
      this.rows.push({
        icon: 'diamond',
        iconColor: COLOR.cyan,
        text: `${copy.UI.todayLucky} ${f.luckyColor ? f.luckyColor.name : ''} · ${copy.UI.todayNumber} ${f.luckyNumber} · ${copy.UI.todayItem} ${f.luckyItem}`,
        color: COLOR.ink3,
        size: FONT.tiny
      });
    }
    this.rowH = 50;
    this.rowGap = 6;
    y += this.rows.length * (this.rowH + this.rowGap) - this.rowGap;
    y += 22;

    // 最突出的一轴：金色小竖条 + 文案
    const axisName = this.chart && this.chart.dominant ? this.chart.dominant.name : '';
    this.axisRow = axisName ? copy.UI.todayAxis.replace('{name}', axisName) : '';
    if (this.axisRow) {
      this.axisY = y + 14;
      y += 46;
    }
    return y + this.pad - 8;
  }

  drawSelf(ctx) {
    const f = this.f;
    if (!f) return;
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.radius, CARD.fill);
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.radius, COLOR.line, 1);

    const pad = this.pad;
    const innerW = this.innerW;
    ctx.textBaseline = 'middle';

    // ---- 头行：日历图标 + 日期 …… 星级 + 印章 ----
    icons.drawIcon(ctx, 'calendar', pad + 18, this.headY, 36, COLOR.ink2, 0.8);
    ctx.textAlign = 'left';
    ctx.font = font(FONT.small, '600');
    ctx.fillStyle = COLOR.ink2;
    ctx.fillText(f.date, pad + 48, this.headY);

    // 印章：圆形 + 吉字，比如"大吉""小吉""平"
    const sealR = 30;
    const sealCx = this.w - pad - sealR - 2;
    draw.seal(ctx, sealCx, this.headY, sealR, f.levelName || '', COLOR.gold);
    // 星级：实心金 + 空心灰，紧挨印章左侧
    const starSize = 9;
    const starGap = 22;
    const starRight = sealCx - sealR - 18;
    const starLeft = starRight - ((5 - 1) * starGap + starSize * 2) + starSize;
    draw.starsRow(ctx, starLeft, this.headY, starSize, f.stars || 0, 5, starGap);

    // ---- 一句话 ----
    const descPara = new Paragraph({
      x: 0, y: 0, w: innerW, text: f.levelDesc || '', size: FONT.body, color: COLOR.ink2, lineHeight: 46
    });
    ctx.save();
    ctx.translate(pad, this.descY);
    descPara.drawSelf(ctx);
    ctx.restore();

    // ---- 宜 / 忌 ----
    draw.hairline(ctx, pad, this.line1Y, this.w - pad, 'rgba(255,255,255,0.06)');
    let ry = this.line1Y + 24;
    this.rows.forEach((r) => {
      ctx.save();
      ctx.translate(pad, ry);
      const isLucky = r.icon === 'diamond';
      const item = new IconText({
        x: 0, y: 0, w: innerW, h: this.rowH,
        icon: r.icon, iconColor: r.iconColor, iconAlpha: isLucky ? 0.6 : 0.9,
        text: r.text, size: r.size || FONT.body, color: r.color,
        maxWidth: innerW - 56 - 16
      });
      item.drawSelf(ctx);
      ctx.restore();
      ry += this.rowH + this.rowGap;
    });

    // ---- 最突出的一轴：金色小竖条 ----
    if (this.axisRow) {
      draw.fillRoundRect(ctx, pad, this.axisY - 11, 5, 22, 2.5, COLOR.gold);
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink2;
      ctx.textAlign = 'left';
      ctx.fillText(text.singleLine(this.axisRow, innerW - 20, font(FONT.tiny)), pad + 18, this.axisY);
    }
  }
}

module.exports = {
  Starfield,
  TopBar,
  TabBar,
  MAIN_TABS,
  ResonanceRing,
  DimBars,
  CharCard,
  FateTags,
  TodayCard
};
