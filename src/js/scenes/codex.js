const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Panel, Hotspot } = require('../ui/widget.js');
const { ScrollView } = require('../ui/interactive.js');
const { Starfield, TabBar, CharCard } = require('../ui/game.js');
const { COLOR, CARD, FONT, font, RADIUS, TXT } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { CHARACTERS, RARITY } = require('../../../data/characters.js');
const storage = require('../../../utils/storage.js');
const fmt = require('../../../utils/format.js');
const analytics = require('../../../services/analytics.js');

const RARITY_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'legend', name: '传说' },
  { key: 'epic', name: '史诗' },
  { key: 'rare', name: '稀有' },
  { key: 'common', name: '寻常' }
];

const STATUS_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'unlocked', name: '已遇见' },
  { key: 'locked', name: '未遇见' }
];

/**
 * 筛选小胶囊：文字 + 数量角标。
 *
 * 未选中也要看得见 —— 以前描边是 8% 白，在深底上几乎消失，
 * 用户根本不知道那里有一排可点的筛选项（"筛选器对比度不足"）。
 */
class Chip extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    const o = opts || {};
    this.label = o.label || '';
    this.count = o.count;
    this.on = !!o.on;
    this.h = 60;
    this.pressScale = 0.97;
    this.pad = 26;
    this.gap = 10;
    this.handler = o.onTap || null;
    this.lineHeight = this.h;
    this.layout();
  }

  layout() {
    this.labelFont = font(FONT.small, this.on ? '600' : '');
    this.countFont = font(FONT.tiny, '600');
    this.labelW = Math.round(text.measure(this.label, this.labelFont));
    this.countW = this.count === undefined || this.count === null
      ? 0
      : Math.round(text.measure(String(this.count), this.countFont));
    this.w = this.labelW + this.pad * 2 + (this.countW ? this.gap + this.countW : 0);
  }

  onTap() {
    if (this.handler) this.handler();
  }

  drawSelf(ctx) {
    if (this.on) {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, 'rgba(232,200,122,0.10)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, COLOR.gold, 1.6);
      if (this.pressT > 0.02) draw.glow(ctx, this.w / 2, this.h / 2, this.w * 0.5, COLOR.gold, 0.1);
    } else {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, 'rgba(255,255,255,0.04)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, 'rgba(255,255,255,0.15)', 1);
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = this.labelFont;
    ctx.fillStyle = this.on ? COLOR.gold : COLOR.ink2;
    ctx.fillText(this.label, this.pad, this.h / 2 + 1);
    if (this.countW) {
      ctx.font = this.countFont;
      ctx.fillStyle = this.on ? 'rgba(232,200,122,0.75)' : COLOR.ink4;
      ctx.fillText(String(this.count), this.pad + this.labelW + this.gap, this.h / 2 + 1);
    }
  }
}

class CodexScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.rarityKey = 'all';
    this.statusKey = 'all';
  }

  onEnter() {
    this.alwaysRender = true;
    this.reload();
    analytics.report(analytics.REPORTABLE.CODEX_VIEW, { unlocked: this.unlockedCount });
    this.build();
  }

  onResume() {
    this.reload();
    this.build();
  }

  reload() {
    const codex = storage.getCodex();
    this.codex = codex;
    this.unlockedCount = Object.keys(codex).length;
    this.all = CHARACTERS.map((c) => ({
      char: c,
      rarity: RARITY[c.rarity],
      unlocked: !!codex[c.id],
      score: codex[c.id] ? codex[c.id].firstScore || 0 : 0,
      count: codex[c.id] ? codex[c.id].count : 0
    }));
    // 筛选胶囊上的数量角标：让用户点之前就知道"这个筛选里有多少个"
    this.rarityCount = {};
    this.all.forEach((r) => {
      const k = r.char.rarity;
      this.rarityCount[k] = (this.rarityCount[k] || 0) + 1;
    });
  }

  countOf(filterKey, isStatus) {
    if (filterKey === 'all') return CHARACTERS.length;
    if (isStatus) {
      return filterKey === 'unlocked' ? this.unlockedCount : CHARACTERS.length - this.unlockedCount;
    }
    return this.rarityCount[filterKey] || 0;
  }

  filtered() {
    const { rarityKey, statusKey } = this;
    return this.all
      .filter((r) => {
        if (rarityKey !== 'all' && r.char.rarity !== rarityKey) return false;
        if (statusKey === 'unlocked' && !r.unlocked) return false;
        if (statusKey === 'locked' && r.unlocked) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        const ra = (a.rarity && a.rarity.stars) || 1;
        const rb = (b.rarity && b.rarity.stars) || 1;
        return rb - ra;
      });
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    // 头部整体下移 20：标题和计数器要**同一行**，而计数器是右对齐的，
    // 贴在 contentTop 上会钻进右上角胶囊按钮的区域（布局审计会报"压胶囊"）
    const top = this.stage.contentTop + 36;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 13, ring: false }));

    // ---- 头部：标题 + 计数器同一行（40 / 60，数字金色、总数灰） ----
    this.root.add(new Label({ x: pad, y: top, w: contentW * 0.6, text: copy.SCENE.codex.title, size: FONT.h1, weight: '700', color: TXT.title }));
    {
      const numFont = font(FONT.h2, '700');
      const restFont = font(FONT.tiny);
      const numStr = String(this.unlockedCount);
      const restStr = `/ ${CHARACTERS.length}`;
      const nw = text.measure(numStr, numFont);
      const rw = text.measure(restStr, restFont);
      const left = W - pad - (nw + 8 + rw);
      const lbl = new Widget({ x: left, y: top, w: nw + 8 + rw, h: 52 });
      lbl.drawSelf = (ctx) => {
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = numFont;
        ctx.fillStyle = COLOR.gold;
        ctx.fillText(numStr, 0, lbl.h / 2);
        ctx.font = restFont;
        ctx.fillStyle = COLOR.ink4;
        ctx.fillText(restStr, nw + 8, lbl.h / 2 + 6);
      };
      this.root.add(lbl);
    }

    // 进度条（细一点、带流光）
    const barY = top + 52;
    const bar = new Widget({ x: pad, y: barY, w: contentW, h: 10 });
    const pct = this.unlockedCount / CHARACTERS.length;
    bar.drawSelf = (ctx, stage, t) => {
      draw.flowBar(ctx, 0, 3, contentW, 6, pct, t);
    };
    bar.update = () => true; // 流光一直在跑
    this.root.add(bar);

    // ---- 筛选 ----
    let fy = barY + 40;
    let fx = pad;
    RARITY_FILTERS.forEach((f) => {
      const chip = new Chip({
        x: fx, y: fy, label: f.name, count: this.countOf(f.key, false), on: this.rarityKey === f.key,
        onTap: () => {
          this.rarityKey = f.key;
          this.build();
        }
      });
      if (fx + chip.w > W - pad) {
        fx = pad;
        fy += 72;
        chip.x = fx;
        chip.y = fy;
      }
      this.root.add(chip);
      fx += chip.w + 14;
    });
    fy += 76;
    fx = pad;
    STATUS_FILTERS.forEach((f) => {
      const chip = new Chip({
        x: fx, y: fy, label: f.name, count: this.countOf(f.key, true), on: this.statusKey === f.key,
        onTap: () => {
          this.statusKey = f.key;
          this.build();
        }
      });
      this.root.add(chip);
      fx += chip.w + 14;
    });

    // ---- 网格 ----
    const gridTop = fy + 84;
    const tabH = 108;
    const scroll = new ScrollView({ x: 0, y: gridTop, w: W, h: this.stage.height - gridTop - tabH });
    this.scroll = scroll;
    this.root.add(scroll);

    const cols = 2;
    const gap = CARD.gap; // 列间距 = 行间距 = 24（统一网格节奏）
    const cellW = (contentW - gap) / 2;
    const cellH = CharCard.heightFor('md', cellW);
    const list = this.filtered();

    if (!list.length) {
      scroll.add(new Paragraph({
        x: pad, y: 80, w: contentW, align: 'center', text: copy.UI.codexEmpty, size: FONT.body, color: COLOR.ink2
      }));
    }

    list.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const card = new CharCard({
        x: pad + col * (cellW + gap),
        y: row * (cellH + gap),
        w: cellW,
        h: cellH,
        char: item.char,
        rarity: item.rarity,
        resonance: item.score,
        size: 'md',
        // 库里的固定编号：图鉴翻起来有"收集册"的感觉
        index: CHARACTERS.indexOf(item.char) + 1,
        locked: !item.unlocked,
        showFates: false,
        onTap: () => this.open(item)
      });
      scroll.add(card);
    });

    const rows = Math.ceil(list.length / cols);
    scroll.setContentHeight(rows * (cellH + gap) + 180);

    // ---- 底部导航 ----
    this.root.add(new TabBar({
      x: 0, y: 0, w: W, h: this.stage.height, active: 1,
    }));
  }

  open(item) {
    if (item.unlocked) {
      analytics.report(analytics.REPORTABLE.CHARACTER_VIEW, { id: item.char.id });
    }
    if (!item.unlocked) {
      this.toast(copy.UI.codexLockedTip);
      return;
    }
    this.stage.router.push('character', { id: item.char.id });
  }
}

module.exports = CodexScene;
