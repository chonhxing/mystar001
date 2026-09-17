const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Panel, Hotspot } = require('../ui/widget.js');
const { ScrollView } = require('../ui/interactive.js');
const { Starfield, TabBar, CharCard } = require('../ui/game.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
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

/** 筛选小胶囊 */
class Chip extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.label = opts.label || '';
    this.on = !!opts.on;
    this.h = 56;
    this.w = Math.round(text.measure(this.label, font(FONT.small))) + 44;
    this.handler = opts.onTap || null;
  }

  onTap() {
    if (this.handler) this.handler();
  }

  drawSelf(ctx) {
    if (this.on) {
      const g = ctx.createLinearGradient(0, 0, this.w, this.h);
      g.addColorStop(0, COLOR.goldLight);
      g.addColorStop(1, COLOR.gold);
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, g);
    } else {
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, 'rgba(255,255,255,0.045)');
      draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, this.h / 2, COLOR.lineSoft, 1);
    }
    ctx.font = font(FONT.small, this.on ? '600' : '');
    ctx.fillStyle = this.on ? '#2A1E05' : COLOR.ink2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.w / 2, this.h / 2 + 1);
    ctx.textAlign = 'left';
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
    const top = this.stage.contentTop + 16;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 13, ring: false }));

    // ---- 头部 ----
    this.root.add(new Label({ x: pad, y: top, w: contentW * 0.7, text: copy.SCENE.codex.title, size: FONT.h1, weight: '700', color: COLOR.ink }));
    this.root.add(new Label({
      x: 0, y: top + 8, w: W - pad, align: 'right', size: 44, weight: '700', color: COLOR.gold,
      text: `${this.unlockedCount}`
    }));
    this.root.add(new Label({
      x: 0, y: top + 22, w: W - pad - 52, align: 'right', size: FONT.tiny, color: COLOR.ink4,
      text: `/ ${CHARACTERS.length}`
    }));

    // 进度条
    const barY = top + 76;
    this.root.add(new Panel({
      x: pad, y: barY, w: contentW, h: 8, radius: 4, fill: 'rgba(255,255,255,0.08)'
    }));
    const pct = this.unlockedCount / CHARACTERS.length;
    const fill = new Panel({
      x: pad, y: barY, w: Math.max(8, contentW * pct), h: 8, radius: 4, fill: null
    });
    fill.drawSelf = (ctx) => {
      const g = ctx.createLinearGradient(0, 0, contentW, 0);
      g.addColorStop(0, COLOR.violet);
      g.addColorStop(1, COLOR.gold);
      draw.fillRoundRect(ctx, 0, 0, Math.max(8, contentW * pct), 8, 4, g);
    };
    this.root.add(fill);

    // ---- 筛选 ----
    let fy = barY + 28;
    let fx = pad;
    RARITY_FILTERS.forEach((f) => {
      const chip = new Chip({
        x: fx, y: fy, label: f.name, on: this.rarityKey === f.key,
        onTap: () => {
          this.rarityKey = f.key;
          this.build();
        }
      });
      if (fx + chip.w > W - pad) {
        fx = pad;
        fy += 68;
        chip.x = fx;
        chip.y = fy;
      }
      this.root.add(chip);
      fx += chip.w + 12;
    });
    fy += 68;
    fx = pad;
    STATUS_FILTERS.forEach((f) => {
      const chip = new Chip({
        x: fx, y: fy, label: f.name, on: this.statusKey === f.key,
        onTap: () => {
          this.statusKey = f.key;
          this.build();
        }
      });
      this.root.add(chip);
      fx += chip.w + 12;
    });

    // ---- 网格 ----
    const gridTop = fy + 80;
    const tabH = 108;
    const scroll = new ScrollView({ x: 0, y: gridTop, w: W, h: this.stage.height - gridTop - tabH });
    this.scroll = scroll;
    this.root.add(scroll);

    const cols = 2;
    const gap = 20;
    const cellW = (contentW - gap) / 2;
    // 卡面不再是 3:4 的立绘位，而是扁徽记区（w*0.42）+ 文字区
    const cellH = Math.round(cellW * 0.42) + 116;
    const list = this.filtered();

    if (!list.length) {
      scroll.add(new Paragraph({
        x: pad, y: 80, w: contentW, align: 'center', text: copy.UI.codexEmpty, size: FONT.body, color: COLOR.ink4
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
