const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine, Hotspot, IconText } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar, CharCard, DimBars, FateTags, TodayCard } = require('../ui/game.js');
const { COLOR, CARD, FONT, font, RADIUS, TXT } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const icons = require('../ui/icon.js');
const copy = require('../../../config/copy.js');
const { RARITY } = require('../../../data/characters.js');
const share = require('../../../services/share.js');
const reward = require('../../../services/reward.js');
const analytics = require('../../../services/analytics.js');
const poster = require('../poster.js');

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
    ctx.fillStyle = COLOR.ink3;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.k, 0, 26);
    ctx.font = font(FONT.body, '600');
    ctx.fillStyle = this.vColor;
    ctx.textAlign = 'right';
    ctx.fillText(text.singleLine(this.v, this.w - 140, font(FONT.body, '600')), this.w, 26);
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

/**
 * 命运对照卡：左右两栏 + 中间一个金色的 VS。
 *
 * 原来这里是一行紫色小字（"你偏随性，TA 偏执念"），整页最该有画面感的地方
 * 长得像一句注释（用户原话："中间那个灰色空框像 bug"）。
 * 数据是现成的（opp 里有两边在同一个轴上的取值），只是从来没被画出来。
 */
class VersusRow extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.axisName = o.axisName || '';
    this.you = o.you || '';
    this.ta = o.ta || '';
    this.h = this.axisName ? 208 : 172;
  }

  drawSelf(ctx) {
    const colW = (this.w - 96) / 2;
    const boxH = 132;
    const cx = this.w / 2;

    const col = (x, label, value, color) => {
      draw.fillRoundRect(ctx, x, 0, colW, boxH, CARD.radius, 'rgba(255,255,255,0.04)');
      draw.strokeRoundRect(ctx, x, 0, colW, boxH, CARD.radius, 'rgba(255,255,255,0.08)', 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink3;
      ctx.fillText(label, x + colW / 2, 40);
      ctx.font = font(FONT.h3, '700');
      ctx.fillStyle = color;
      ctx.fillText(text.singleLine(value, colW - 24, font(FONT.h3, '700')), x + colW / 2, 88);
    };

    col(0, copy.UI.resultCompareYou, this.you, COLOR.ink);
    col(this.w - colW, copy.UI.resultCompareTa, this.ta, COLOR.gold);

    // 中间的 VS：金色 + 两侧一条极细的引线
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(FONT.h3, '700');
    ctx.fillStyle = COLOR.gold;
    ctx.fillText('VS', cx, boxH / 2);
    ctx.textAlign = 'left';
    draw.hairline(ctx, cx - 68, boxH / 2, cx - 26, 'rgba(232,200,122,0.35)');
    draw.hairline(ctx, cx + 26, boxH / 2, cx + 68, 'rgba(232,200,122,0.35)');

    if (this.axisName) {
      ctx.textAlign = 'center';
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink3;
      ctx.fillText(`「${this.axisName}」这一轴`, cx, boxH + 40);
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
    // 大标题用**白色**：金色让给下面的共振数字和稀有度标签，
    // 满页金字会让"金"贬值（"哪儿都是金就等于哪儿都不金"）
    scroll.add(new Label({
      x: pad, y, w: contentW, text: c.title, size: FONT.h1, weight: '700', color: TXT.title
    }));
    y += 74;
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, text: c.subtitle, size: FONT.small, color: TXT.sub, lineHeight: 40
    }));
    y += 60;

    const tags = [{ name: copy.UI.resultResonanceTag.replace('{n}', String(main.resonance)), special: true }, { name: main.rarity.label }];
    if (this.outcome && this.outcome.source === 'ai') tags.push({ name: 'AI 深化解读', special: false });
    if (this.outcome && this.outcome.source === 'cache') tags.push({ name: 'AI 解读 · 同盘同解', special: false });
    const tagRow = new FateTags({ x: pad, y, w: contentW, tags });
    scroll.add(tagRow);
    y += 72;

    // ---- 主推角色（入场缩放 + 光晕扩散，共振大数字在名字右侧） ----
    const mainCard = new CharCard({
      x: pad, y, w: contentW, char: main.char, rarity: main.rarity, resonance: main.resonance,
      size: 'lg',
      onTap: () => this.stage.router.push('character', { id: main.char.id })
    });
    scroll.add(mainCard);
    y += mainCard.h + CARD.gap;

    if (main.sharedFates.length) {
      scroll.add(new Label({ x: pad, y, w: contentW, text: copy.UI.resultShared, size: FONT.tiny, color: COLOR.ink3 }));
      y += 36;
      const shared = new FateTags({
        x: pad, y, w: contentW,
        tags: main.sharedFates.map((f) => ({ name: f.name, special: true }))
      });
      scroll.add(shared);
      y += 68;
    }

    // ---- 图谱解读（首字位置放一个金色引号） ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultEssenceTitle);
    const essenceCard = new Card({ x: pad, y, w: contentW, glow: true });
    const quote = new Widget({ x: 0, y: 0, w: 60, h: 40 });
    quote.drawSelf = (ctx) => draw.quoteMark(ctx, 0, 0, 46, COLOR.gold, 0.34);
    essenceCard.add(quote);
    const essencePara = new Paragraph({
      x: 0, y: 46, w: contentW - CARD.pad * 2, text: c.essence, size: FONT.body, lineHeight: 52, color: TXT.body
    });
    essenceCard.add(essencePara);
    essenceCard.content.h = 46 + essencePara.h;
    essenceCard.fitHeight(0);
    scroll.add(essenceCard);
    y += essenceCard.h + CARD.gap;

    // ---- 你携带的命途（金色小竖条 + 命途名 + 释义） ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultFateTitle);
    const fateCard = new Card({ x: pad, y, w: contentW });
    const innerW = contentW - CARD.pad * 2;
    let fy = 0;
    chart.fates.forEach((f) => {
      // 金色小竖条：命途名是这一节的"关键词"，和金条一起构成小标题
      fateCard.add(new Panel({ x: 0, y: fy + 8, w: 6, h: 30, radius: 3, fill: COLOR.gold }));
      fateCard.add(new Label({ x: 20, y: fy, w: innerW - 20, text: f.name, size: FONT.h3, weight: '600', color: COLOR.gold }));
      const p = new Paragraph({
        x: 20, y: fy + 48, w: innerW - 20, text: f.summary, size: FONT.small, color: TXT.sub, lineHeight: 46
      });
      fateCard.add(p);
      fy += 48 + p.h + 30;
    });
    fateCard.content.h = Math.max(0, fy - 30);
    fateCard.fitHeight(0);
    scroll.add(fateCard);
    y += fateCard.h + CARD.gap;

    // ---- 命途图谱全相 ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultChartTitle);
    const chartCard = new Card({ x: pad, y, w: contentW });
    const rows = this.chartRows(chart, isDraw);
    let ry = 0;
    rows.forEach((row, i) => {
      const kv = new KVRow({ x: 0, y: ry, w: contentW - CARD.pad * 2, k: row.k, v: row.v, note: row.note });
      chartCard.add(kv);
      ry += kv.h;
      if (i < rows.length - 1) {
        const line = new HLine({ x: 0, y: ry - 1, w: contentW - CARD.pad * 2 });
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
    const bars = new DimBars({ x: 0, y: 0, w: contentW - CARD.pad * 2, axes: chart.axes });
    axisCard.add(bars);
    axisCard.content.h = bars.h;
    axisCard.fitHeight(0);
    scroll.add(axisCard);
    y += axisCard.h + 28;

    // ---- 为什么是 TA ----
    y = this.section(scroll, pad, contentW, y, copy.UI.resultResonanceTitle);
    const resCard = new Card({ x: pad, y, w: contentW });
    const resPara = new Paragraph({ x: 0, y: 0, w: contentW - CARD.pad * 2, text: c.resonance, size: FONT.body, lineHeight: 52, color: COLOR.ink });
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
    const diffPara = new Paragraph({ x: 0, y: 0, w: contentW - CARD.pad * 2, text: c.difference, size: FONT.body, lineHeight: 52, color: COLOR.ink });
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
    y += antiCard.h + CARD.gap;

    const antiTextCard = new Card({ x: pad, y, w: contentW });
    const antiPara = new Paragraph({
      x: 0, y: 0, w: contentW - CARD.pad * 2, text: c.anti, size: FONT.body, lineHeight: 52, color: TXT.body
    });
    antiTextCard.add(antiPara);
    let antiH = antiPara.h;
    const opp = (anti.opposing || [])[0];
    if (opp) {
      const axis = chart.axes.find((a) => a.key === opp.key);
      if (axis) {
        // 把"你偏随性 / TA 偏执念"从一行注释改成一张左右对照卡：
        // 数据本来就在，只是以前没画出来
        const you = opp.userValue >= 50 ? axis.pos : axis.neg;
        const ta = opp.targetValue >= 50 ? axis.pos : axis.neg;
        const versus = new VersusRow({
          x: 0, y: antiPara.h + 28, w: contentW - CARD.pad * 2,
          axisName: axis.name, you, ta
        });
        antiTextCard.add(versus);
        antiH = versus.y + versus.h;
      }
    }
    antiTextCard.content.h = antiH;
    antiTextCard.fitHeight(0);
    scroll.add(antiTextCard);
    y += antiTextCard.h + CARD.gap;

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
    y += counselPanel.h + CARD.gap;

    // ---- 今日提示（和首页同一个组件，这里是完整密度） ----
    if (r.fortune) {
      y = this.section(scroll, pad, contentW, y, copy.UI.resultTodayTitle);
      const fc = new TodayCard({
        x: pad, y, w: contentW, fortune: r.fortune, chart, full: true
      });
      scroll.add(fc);
      y += fc.h + CARD.gap;
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
    // 主次分明：主按钮整行、两个次级并排、最后一行是"换一条路"的文字按钮
    const half = (contentW - CARD.gap) / 2;
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
      x: pad + half + CARD.gap, y, w: half, variant: 'ghost', text: copy.UI.resultSavePic,
      onTap: () => this.savePic()
    }));
    y += 116;

    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true, text: copy.UI.resultCodex,
      onTap: () => this.stage.router.reset('codex')
    }));
    y += 96;

    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'text', small: true, size: FONT.small,
      text: '看一次广告 · 换个角色',
      onTap: () => this.watchForAnother()
    }));
    y += 92;

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

  /**
   * 保存结果海报。
   *
   * 只把**本机算出来的**内容画进海报（角色、共振度、最突出的一轴），
   * 不放 AI 那段解读 —— 放了就得按《人工智能生成合成内容标识办法》在图片上也带标识。
   * 三种失败各有各的下一步，所以要分开提示：环境不支持 / 用户拒了相册权限 / 导出失败。
   */
  savePic() {
    const main = this.result.match.main;
    const chart = this.result.chart;
    analytics.report(analytics.REPORTABLE.SHARE_CLICK, { main: main.char.id, kind: 'poster' });
    this.toast('正在生成海报…');
    poster
      .saveResult({
        char: main.char,
        rarityKey: main.char.rarity,
        stars: (main.rarity && main.rarity.stars) || 0,
        resonance: main.resonance,
        axisName: chart && chart.dominant ? chart.dominant.name : '',
        seed: (() => {
          const str = String(main.char.id || 'x');
          let h = 0;
          for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 100000;
          return h;
        })()
      })
      .then((r) => {
        if (r.ok) {
          this.toast(copy.UI.resultSaveOk);
          return;
        }
        if (r.reason === 'DENIED') this.toast(copy.UI.resultSaveDenied);
        else if (r.reason === 'UNSUPPORTED') this.toast(copy.UI.resultSaveUnsupported);
        else this.toast(copy.UI.resultSaveFail);
      });
  }

  onExit() {
    if (this.scroll) this.savedScroll = this.scroll.scrollY;
  }
}

module.exports = ResultScene;
