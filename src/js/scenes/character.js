const { Scene } = require('../router.js');
const { Label, Paragraph, Card, Panel, SectionTitle } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar, CharCard, DimBars, FateTags, ResonanceRing } = require('../ui/game.js');
const { COLOR, FONT, RADIUS } = require('../theme.js');
const draw = require('../draw.js');
const copy = require('../../../config/copy.js');
const { CHARACTER_MAP, RARITY } = require('../../../data/characters.js');
const { FATE_MAP } = require('../../../data/fates.js');
const chartCore = require('../../../core/chart.js');
const matcher = require('../../../core/matcher.js');
const storage = require('../../../utils/storage.js');
const share = require('../../../services/share.js');

class CharacterScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.id = params.id;
  }

  onEnter() {
    this.alwaysRender = true;
    const char = CHARACTER_MAP[this.id];
    if (!char) {
      this.buildError();
      return;
    }
    this.char = char;
    this.rarity = RARITY[char.rarity] || RARITY.common;
    this.fates = (char.fates || [])
      .map((id) => FATE_MAP[id])
      .filter(Boolean)
      .map((f) => ({ id: f.id, name: f.name, summary: f.summary, shadow: f.shadow }));
    this.shaped = chartCore.finalize({ dims: char.dims });
    this.unlocked = !!storage.getCodex()[char.id];

    // 有资料就顺手算"你与 TA 的共振"
    this.resonance = 0;
    this.sharedFates = [];
    const profile = storage.getProfile();
    if (profile) {
      try {
        const chart = chartCore.buildChart(profile);
        if (chart) {
          this.resonance = matcher.resonanceOf(chart, char);
          this.sharedFates = chart.fates
            .filter((f) => (char.fates || []).indexOf(f.id) >= 0)
            .map((f) => ({ id: f.id, name: f.name, special: true }));
        }
      } catch (e) {
        this.resonance = 0;
      }
    }
    this.build();
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const top = this.stage.contentTop + 92;

    this.root.clear();
    this.root.add(new Starfield({
      x: 0, y: 0, w: W, h: this.stage.height,
      tone: this.char.rarity === 'legend' ? 'legend' : 'default', seed: 17
    }));
    this.root.add(new TopBar({
      x: pad, y: this.stage.contentTop + 10, w: contentW, h: 72, title: this.char.name,
      onBack: () => this.stage.router.pop()
    }));

    const scroll = new ScrollView({ x: 0, y: top, w: W, h: this.stage.height - top });
    this.scroll = scroll;
    this.root.add(scroll);

    let y = 8;
    const card = new CharCard({
      x: pad, y, w: contentW, char: this.char, rarity: this.rarity, size: 'lg',
      showFates: false, showResonance: false
    });
    scroll.add(card);
    y += card.h + 24;

    if (!this.unlocked) {
      scroll.add(new Paragraph({
        x: pad, y, w: contentW, align: 'center', text: copy.UI.charLocked, size: FONT.small, color: COLOR.ink4
      }));
      y += 56;
    }

    // 共振环 + 共享命途
    if (this.resonance) {
      const ringW = 200;
      const ring = new ResonanceRing({ x: (W - ringW) / 2, y, w: ringW, h: ringW, value: this.resonance });
      scroll.add(ring);
      y += ringW - 10;
      if (this.sharedFates.length) {
        scroll.add(new Label({ x: pad, y, w: contentW, text: copy.UI.resultShared, size: FONT.micro, color: COLOR.ink4, align: 'center' }));
        y += 36;
        const tags = new FateTags({ x: pad, y, w: contentW, tags: this.sharedFates });
        scroll.add(tags);
        y += 66;
      }
    }

    // 意象与定位
    const infoCard = new Card({ x: pad, y, w: contentW, glow: true });
    let iy = 0;
    const motif = new Paragraph({ x: 0, y: iy, w: contentW - 56, text: this.char.motif, size: FONT.h3, lineHeight: 54, color: COLOR.ink });
    infoCard.add(motif);
    iy += motif.h + 20;
    const sig = new Paragraph({ x: 0, y: iy, w: contentW - 56, text: this.char.signature, size: FONT.body, lineHeight: 50, color: COLOR.ink2 });
    infoCard.add(sig);
    iy += sig.h;
    infoCard.content.h = iy;
    infoCard.fitHeight(0);
    scroll.add(infoCard);
    y += infoCard.h + 28;

    // TA 的命途
    const st = new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.charFatesTitle });
    scroll.add(st);
    y += 68;

    const fateCard = new Card({ x: pad, y, w: contentW });
    let fy = 0;
    this.fates.forEach((f, i) => {
      fateCard.add(new Label({ x: 0, y: fy, w: contentW - 56, text: f.name, size: FONT.h3, weight: '600', color: COLOR.gold }));
      const p = new Paragraph({ x: 0, y: fy + 46, w: contentW - 56, text: f.summary, size: FONT.small, color: COLOR.ink, lineHeight: 44 });
      fateCard.add(p);
      const s = new Paragraph({ x: 0, y: fy + 46 + p.h + 10, w: contentW - 56, text: `阴影面：${f.shadow}`, size: FONT.micro, color: COLOR.ink4, lineHeight: 40 });
      fateCard.add(s);
      fy += 46 + p.h + 10 + s.h + (i < this.fates.length - 1 ? 34 : 0);
    });
    fateCard.content.h = fy;
    fateCard.fitHeight(0);
    scroll.add(fateCard);
    y += fateCard.h + 28;

    // 八轴
    const st2 = new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.charAxesTitle });
    scroll.add(st2);
    y += 68;
    const axisCard = new Card({ x: pad, y, w: contentW });
    const bars = new DimBars({ x: 0, y: 0, w: contentW - 56, axes: this.shaped.axes });
    axisCard.add(bars);
    const note = new Paragraph({
      x: 0, y: bars.h + 20, w: contentW - 56, text: copy.UI.charAxisNote, size: FONT.micro, color: COLOR.ink4, lineHeight: 36
    });
    axisCard.add(note);
    axisCard.content.h = bars.h + 20 + note.h;
    axisCard.fitHeight(0);
    scroll.add(axisCard);
    y += axisCard.h + 32;

    // 操作
    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'ghost', text: copy.UI.charShare,
      onTap: () => share.shareResult({
        title: `${this.char.name} · ${this.char.motif}`,
        canvas: this.stage.canvas
      })
    }));
    y += 116;
    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true, text: copy.UI.charBack,
      onTap: () => this.stage.router.pop()
    }));
    y += 110;

    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
      text: copy.LEGAL.copyright, lineHeight: 34
    }));
    y += 120;
    scroll.setContentHeight(y);
  }

  buildError() {
    const W = this.stage.width;
    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 19, ring: false }));
    this.root.add(new Paragraph({
      x: 60, y: this.stage.height * 0.4, w: W - 120, align: 'center',
      text: '找不到这个角色', size: FONT.h3, color: COLOR.ink2
    }));
    this.root.add(new Button({
      x: 120, y: this.stage.height * 0.52, w: W - 240, text: '回到图鉴',
      onTap: () => this.stage.router.pop()
    }));
  }
}

module.exports = CharacterScene;
