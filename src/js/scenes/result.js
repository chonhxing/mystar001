const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine, Hotspot } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar, CharCard, DimBars, FateTags } = require('../ui/game.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { RARITY } = require('../../../data/characters.js');
const share = require('../../../services/share.js');
const reward = require('../../../services/reward.js');
const analytics = require('../../../services/analytics.js');

/** 一行"键 → 值"，下面可以带一句注解 */
class KVRow extends Widget {
  constructor(opts) {
    super(opts);
    this.k = opts.k;
    this.v = opts.v;
    this.note = opts.note || '';
    this.h = this.note ? 84 : 62;
    this.vColor = opts.vColor || COLOR.ink;
  }

  drawSelf(ctx) {
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink4;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.k, 0, 26);
    ctx.font = font(FONT.body);
    ctx.fillStyle = this.vColor;
    ctx.textAlign = 'right';
    ctx.fillText(text.singleLine(this.v, this.w - 140, font(FONT.body)), this.w, 26);
    ctx.textAlign = 'left';
    if (this.note) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'right';
      ctx.fillText(text.singleLine(this.note, this.w - 140, font(FONT.micro)), this.w, 58);
      ctx.textAlign = 'left';
    }
  }
}

class ResultScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.outcome = params.outcome || null;
    this.pending = params.pending || null;
    this.result = this.outcome ? this.outcome.result : null;
    this.error = params.error || null;
  }

  onEnter() {
    this.alwaysRender = true;
    if (this.error || !this.result) {
      this.buildError();
      return;
    }
    this.reportView();
    this.build();

    // AI 文案晚到：原地替换文案部分，不打断用户阅读
    if (this.pending) {
      this.pending.then((full) => {
        if (!full || !full.result) return;
        this.outcome = full;
        this.result = full.result;
        this.build();
        this.preserveScroll();
        if (full.source === 'ai' || full.source === 'cache') {
          this.toast('深度解读已补上');
        }
      });
    }
  }

  onResume() {
    if (this.params && this.params.refresh) {
      this.params.refresh = false;
      this.build();
    }
  }

  /** 埋点：只报匿名的"结果特征"，不报任何个人信息 */
  reportView() {
    const r = this.result;
    if (!r || !r.match) return;
    const report = (outcome) => {
      analytics.report(analytics.REPORTABLE.RESULT_VIEW, {
        rarity: r.chart.rarity.key,
        main: r.match.main.char.id,
        resonance: r.match.main.resonance,
        source: (outcome && outcome.source) || 'local'
      });
      if (r.codex && r.codex.added) {
        analytics.report(analytics.REPORTABLE.CODEX_UNLOCK, { added: r.codex.added, total: r.codex.total });
      }
      // 降级要单独埋：这个数字高了说明后端或 AI 不稳
      if (outcome && outcome.notice) {
        analytics.report(analytics.REPORTABLE.LOCAL_FALLBACK, { reason: outcome.reason || 'unknown' });
      }
    };
    report(this.outcome);
    // AI 文案晚到时再补一次（那时才知道最终 source）
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p.then((full) => {
        if (full) report(full);
      });
    }
  }

  preserveScroll() {
    if (this.scroll && this.savedScroll) this.scroll.scrollTo(this.savedScroll);
  }

  // ============================================================ 主构建

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const r = this.result;
    const chart = r.chart;
    const main = r.match.main;
    const c = r.copy;
    const isDraw = chart.mode === 'draw';

    this.root.clear();
    this.root.add(new Starfield({
      x: 0, y: 0, w: W, h: this.stage.height,
      tone: main.char.rarity === 'legend' ? 'legend' : 'default',
      seed: 5
    }));

    this.root.add(new TopBar({
      x: pad, y: this.stage.contentTop + 10, w: contentW, h: 72, title: copy.SCENE.result.title,
      onBack: () => this.stage.router.reset('home')
    }));

    const scroll = new ScrollView({
      x: 0, y: this.stage.contentTop + 92, w: W, h: this.stage.height - this.stage.contentTop - 92
    });
    this.scroll = scroll;
    this.root.add(scroll);

    let y = 8;

    // ---- 标题 + 标签 ----
    scroll.add(new Label({
      x: pad, y, w: contentW, text: c.title, size: FONT.h1, weight: '700', color: COLOR.gold
    }));
    y += 72;
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, text: c.subtitle, size: FONT.small, color: COLOR.ink2, lineHeight: 40
    }));
    y += 56;

    const tags = [{ name: copy.UI.resultResonanceTag.replace('{n}', String(main.resonance)), special: true }, { name: main.rarity.label }];
    if (this.outcome && this.outcome.source === 'ai') tags.push({ name: 'AI 深化解读', special: false });
    if (this.outcome && this.outcome.source === 'cache') tags.push({ name: 'AI 解读 · 同盘同解', special: false });
    const tagRow = new FateTags({ x: pad, y, w: contentW, tags });
    scroll.add(tagRow);
    y += 68;

    // ---- 主推角色 ----
    const mainCard = new CharCard({
      x: pad, y, w: contentW, char: main.char, rarity: main.rarity, resonance: main.resonance,
      size: 'lg',
      onTap: () => this.stage.router.push('character', { id: main.char.id })
    });
    scroll.add(mainCard);
    y += mainCard.h + 24;

    if (main.sharedFates.length) {
      scroll.add(new Label({ x: pad, y, w: contentW, text: copy.UI.resultShared, size: FONT.micro, color: COLOR.ink4 }));
      y += 34;
      const shared = new FateTags({
        x: pad, y, w: contentW,
        tags: main.sharedFates.map((f) => ({ name: f.name, special: true }))
      });
      scroll.add(shared);
      y += 64;
    }

    // ---- 图谱解读 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultEssenceTitle);
    const essenceCard = new Card({ x: pad, y, w: contentW, glow: true });
    const essencePara = new Paragraph({ x: 0, y: 0, w: contentW - 56, text: c.essence, size: FONT.body, lineHeight: 52, color: COLOR.ink });
    essenceCard.add(essencePara);
    essenceCard.fitHeight(0);
    scroll.add(essenceCard);
    y += essenceCard.h + 28;

    // ---- 你携带的命途 ----
    const fateCard = new Card({ x: pad, y, w: contentW });
    let fy = 0;
    chart.fates.forEach((f) => {
      fateCard.add(new Label({ x: 0, y: fy, w: contentW - 56, text: f.name, size: FONT.h3, weight: '600', color: COLOR.gold }));
      const p = new Paragraph({ x: 0, y: fy + 44, w: contentW - 56, text: f.summary, size: FONT.small, color: COLOR.ink2, lineHeight: 42 });
      fateCard.add(p);
      fy += 44 + p.h + 26;
    });
    fateCard.content.h = fy;
    fateCard.fitHeight(0);
    scroll.add(fateCard);
    y += fateCard.h + 28;

    // ---- 命途图谱全相 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultChartTitle);
    const chartCard = new Card({ x: pad, y, w: contentW });
    const rows = this.chartRows(chart, isDraw);
    let ry = 0;
    rows.forEach((row, i) => {
      const kv = new KVRow({ x: 0, y: ry, w: contentW - 56, k: row.k, v: row.v, note: row.note });
      chartCard.add(kv);
      ry += kv.h;
      if (i < rows.length - 1) {
        const line = new HLine({ x: 0, y: ry - 1, w: contentW - 56 });
        chartCard.add(line);
      }
    });
    chartCard.content.h = ry;
    chartCard.fitHeight(0);
    scroll.add(chartCard);
    y += chartCard.h + 28;

    // ---- 八轴 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultAxesTitle);
    const axisCard = new Card({ x: pad, y, w: contentW });
    const bars = new DimBars({ x: 0, y: 0, w: contentW - 56, axes: chart.axes });
    axisCard.add(bars);
    axisCard.content.h = bars.h;
    axisCard.fitHeight(0);
    scroll.add(axisCard);
    y += axisCard.h + 28;

    // ---- 为什么是 TA ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultResonanceTitle);
    const resCard = new Card({ x: pad, y, w: contentW });
    const resPara = new Paragraph({ x: 0, y: 0, w: contentW - 56, text: c.resonance, size: FONT.body, lineHeight: 52, color: COLOR.ink });
    resCard.add(resPara);
    resCard.fitHeight(0);
    scroll.add(resCard);
    y += resCard.h + 28;

    // ---- 副推 ----
    if (r.match.side.length) {
      y = this.section(scroll, pad, contentW, y, copy.UI.resultSideTitle);
      r.match.side.forEach((s) => {
        const card = new CharCard({
          x: pad, y, w: contentW, char: s.char, rarity: s.rarity, resonance: s.resonance, size: 'sm',
          onTap: () => this.stage.router.push('character', { id: s.char.id })
        });
        scroll.add(card);
        y += card.h + 20;
      });
      y += 12;
    }

    // ---- 差异 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultDiffTitle);
    const diffCard = new Card({ x: pad, y, w: contentW });
    const diffPara = new Paragraph({ x: 0, y: 0, w: contentW - 56, text: c.difference, size: FONT.body, lineHeight: 52, color: COLOR.ink });
    diffCard.add(diffPara);
    diffCard.fitHeight(0);
    scroll.add(diffCard);
    y += diffCard.h + 28;

    // ---- 你带不动的命途 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultAntiTitle);
    const anti = r.match.anti;
    const antiCard = new CharCard({
      x: pad, y, w: contentW, char: anti.char, rarity: anti.rarity, resonance: anti.resonance, size: 'sm',
      onTap: () => this.stage.router.push('character', { id: anti.char.id })
    });
    scroll.add(antiCard);
    y += antiCard.h + 20;

    const antiTextCard = new Card({ x: pad, y, w: contentW });
    const antiPara = new Paragraph({ x: 0, y: 0, w: contentW - 56, text: c.anti, size: FONT.body, lineHeight: 52, color: COLOR.ink });
    antiTextCard.add(antiPara);
    const opp = (anti.opposing || [])[0];
    if (opp) {
      const axis = chart.axes.find((a) => a.key === opp.key);
      if (axis) {
        const line = `${copy.UI.resultAntiTitle} · 「${axis.name}」：你偏${opp.userValue >= 50 ? axis.pos : axis.neg}，TA 偏${opp.targetValue >= 50 ? axis.pos : axis.neg}`;
        const note = new Paragraph({ x: 0, y: antiPara.h + 20, w: contentW - 56, text: line, size: FONT.tiny, color: COLOR.violetLight, lineHeight: 40 });
        antiTextCard.add(note);
        antiTextCard.content.h = antiPara.h + 20 + note.h;
      }
    }
    antiTextCard.fitHeight(0);
    scroll.add(antiTextCard);
    y += antiTextCard.h + 28;

    // ---- 一句提点 ----
    const counselPanel = new Panel({
      x: pad, y, w: contentW, h: 0, radius: RADIUS.lg,
      fill: 'rgba(232,200,122,0.09)', stroke: 'rgba(232,200,122,0.28)'
    });
    const counselLabel = new Label({ x: 32, y: 30, w: contentW - 64, text: copy.UI.resultCounselTitle, size: FONT.tiny, color: COLOR.gold });
    const counselPara = new Paragraph({ x: 32, y: 72, w: contentW - 64, text: c.counsel, size: FONT.h3, lineHeight: 56, color: '#F3EEDC' });
    counselPanel.h = 72 + counselPara.h + 36;
    scroll.add(counselPanel);
    scroll.add(counselLabel);
    scroll.add(counselPara);
    y += counselPanel.h + 28;

    // ---- 今日提示 ----
    if (r.fortune) {
      const f = r.fortune;
      y = this.section(scroll, pad, contentW, y, copy.UI.resultTodayTitle);
      const fc = new Card({ x: pad, y, w: contentW });
      let ffy = 0;
      const lines = [
        { k: copy.UI.todayGood, v: f.good[0] },
        { k: copy.UI.todayGood, v: f.good[1] },
        { k: copy.UI.todayBad, v: f.bad[0] },
        { k: copy.UI.todayBad, v: f.bad[1] }
      ];
      fc.add(new Label({ x: 0, y: ffy, w: contentW - 56, text: f.date, size: FONT.small, color: COLOR.ink3 }));
      fc.add(new Label({ x: 0, y: ffy, w: contentW - 56, text: `${f.starText} ${f.levelName}`, size: FONT.small, color: COLOR.gold, align: 'right' }));
      ffy += 62;
      lines.forEach((l) => {
        fc.add(new KVRow({ x: 0, y: ffy, w: contentW - 56, k: l.k, v: l.v }));
        ffy += 62;
      });
      fc.add(new KVRow({
        x: 0, y: ffy, w: contentW - 56, k: copy.UI.todayLucky,
        v: `${f.luckyColor.name} · ${f.luckyNumber} · ${f.luckyItem}`
      }));
      ffy += 62;
      fc.content.h = ffy;
      fc.fitHeight(0);
      scroll.add(fc);
      y += fc.h + 28;
    }

    // ---- 提示 ----
    if (this.outcome && this.outcome.notice) {
      const notice = new Panel({
        x: pad, y, w: contentW, h: 96, radius: RADIUS.md,
        fill: 'rgba(255,255,255,0.045)', stroke: COLOR.lineSoft
      });
      scroll.add(notice);
      scroll.add(new Paragraph({
        x: pad + 24, y: y + 24, w: contentW - 48, text: this.outcome.notice, size: FONT.tiny, color: COLOR.ink2, lineHeight: 44
      }));
      y += 116;
    }
    if (r.codex && r.codex.added) {
      const q = new Panel({
        x: pad, y, w: contentW, h: 96, radius: RADIUS.md,
        fill: 'rgba(139,108,240,0.12)', stroke: 'rgba(139,108,240,0.26)'
      });
      scroll.add(q);
      scroll.add(new Paragraph({
        x: pad + 24, y: y + 24, w: contentW - 48,
        text: copy.UI.resultUnlock.replace('{n}', String(r.codex.added)).replace('{total}', String(r.codex.total)),
        size: FONT.tiny, color: COLOR.violetLight, lineHeight: 44
      }));
      y += 116;
    }

    // ---- 操作 ----
    const half = (contentW - 24) / 2;
    scroll.add(new Button({
      x: pad, y, w: contentW, text: copy.UI.resultAgain,
      onTap: () => this.stage.router.reset('home')
    }));
    y += 116;

    scroll.add(new Button({
      x: pad, y, w: half, variant: 'ghost', text: copy.UI.resultShare,
      onTap: () => this.share()
    }));
    scroll.add(new Button({
      x: pad + half + 24, y, w: half, variant: 'plain', text: '看一次广告 · 换个角色',
      onTap: () => this.watchForAnother()
    }));
    y += 116;

    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true, text: copy.UI.resultCodex,
      onTap: () => this.stage.router.reset('codex')
    }));
    y += 100;

    // ---- 合规 ----
    const isAi = this.outcome && (this.outcome.source === 'ai' || this.outcome.source === 'cache');
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
      text: isAi ? copy.UI.resultAiLabel : copy.UI.resultAiLabelLocal, lineHeight: 34
    }));
    y += 52;
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
      text: `${copy.LEGAL.footer}\n${copy.LEGAL.copyright}`, lineHeight: 34
    }));
    y += 180;

    scroll.setContentHeight(y);
  }

  /** 小节标题：返回下一个可用的 y */
  section(scroll, pad, contentW, y, title) {
    const t = new SectionTitle({ x: pad, y, w: contentW, text: title });
    scroll.add(t);
    return y + 68;
  }

  chartRows(chart, isDraw) {
    const rows = [];
    if (isDraw) {
      rows.push({ k: '结果来源', v: chart.draw ? chart.draw.veins : '随机匹配', note: '此结果不依生辰' });
    } else {
      if (chart.signs.sun) rows.push({ k: '太阳', v: chart.signs.sun.name, note: chart.signs.sun.tagline });
      if (chart.signs.moon) rows.push({ k: '月亮', v: chart.signs.moon.name, note: chart.signs.moon.tagline });
      rows.push({
        k: '上升',
        v: chart.signs.risingKnown && chart.signs.rising ? chart.signs.rising.name : '留白',
        note: chart.signs.risingKnown && chart.signs.rising ? chart.signs.rising.tagline : '没有出生时辰，这一格不算'
      });
      (chart.pillarsList || []).forEach((p) => {
        rows.push({
          k: p.label,
          v: p.known ? p.pillar.name : '—',
          note: p.known ? `${p.pillar.element}${p.pillar.yinyang} · ${p.meaning}` : '没有出生时辰'
        });
      });
      if (chart.lifeNumber) {
        rows.push({
          k: '生命灵数',
          v: `${chart.lifeNumber.number} ${chart.lifeNumber.name}`,
          note: chart.lifeNumber.tagline
        });
      }
    }
    rows.push({ k: '本命元素', v: chart.element.name, note: chart.element.trait });
    rows.push({ k: '命格', v: chart.rarity.label, note: `偏科度 ${chart.extremity}/100` });
    rows.push({ k: '最突出的轴', v: chart.dominant.name, note: chart.dominant.badge });
    return rows;
  }

  // ============================================================ 异常态

  buildError() {
    const W = this.stage.width;
    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 9, ring: false }));
    this.root.add(new Paragraph({
      x: 60, y: this.stage.height * 0.38, w: W - 120, align: 'center',
      text: this.error || '这份资料读不出来', size: FONT.h3, color: COLOR.ink2, lineHeight: 60
    }));
    this.root.add(new Button({
      x: 120, y: this.stage.height * 0.52, w: W - 240, text: '回去重新填写',
      onTap: () => this.stage.router.reset('home')
    }));
  }

  // ============================================================ 操作

  share() {
    const main = this.result.match.main;
    analytics.report(analytics.REPORTABLE.SHARE_CLICK, { main: main.char.id });
    share.shareResult({
      title: `我的命途是「${main.char.name}」，共振 ${main.resonance}%，你的是谁？`,
      canvas: this.stage.canvas
    });
  }

  watchForAnother() {
    reward
      .showRewarded('divinate_again')
      .then((ok) => {
        if (ok) {
          this.toast('好，再来一次');
          this.stage.router.reset('home');
        } else {
          this.toast(reward.isAvailable() ? '看完广告才能继续' : '暂时没有可用的奖励');
        }
      });
  }

  onExit() {
    if (this.scroll) this.savedScroll = this.scroll.scrollY;
  }
}

module.exports = ResultScene;
