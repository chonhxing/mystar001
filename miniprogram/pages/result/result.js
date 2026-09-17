const { CONFIG } = require('../../config/index.js');
const core = require('../../core/index.js');
const { RARITY } = require('../../data/characters.js');
const storage = require('../../utils/storage.js');
const fmt = require('../../utils/format.js');
const divination = require('../../services/divination.js');

Page({
  data: {
    casting: true,
    castingText: '正在解开你的图谱',
    empty: false,
    emptyText: '',
    ready: false,
    source: '',
    aiPending: false,
    notice: '',
    aiLabel: true,
    quota: null,
    codex: null,
    title: '',
    subtitle: '',
    oneLine: '',
    main: null,
    sharedFates: [],
    fates: [],
    rows: [],
    axes: [],
    copy: null,
    side: [],
    anti: null,
    fortune: null,
    tone: 'default'
  },

  onLoad() {
    const pending =
      divination.takePending() ||
      (storage.getProfile() ? { profile: storage.getProfile(), mode: 'chart' } : null);

    if (!pending) {
      this.setData({ casting: false, empty: true });
      return;
    }

    this.input = pending;
    this.startedAt = Date.now();
    // 仪式感：先放一段动画，再揭开结果（AI 是否回来了不影响揭幕时间）
    this.castTimer = setTimeout(() => this.reveal(), CONFIG.CASTING_MS);
    this.load();
  },

  onUnload() {
    if (this.castTimer) clearTimeout(this.castTimer);
  },

  load() {
    divination
      .run(this.input, {
        onLocal: (localResult) => {
          // 图谱先拿到手，AI 文案晚一步到也不影响揭幕
          this.localResult = localResult;
        }
      })
      .then((outcome) => {
        if (outcome.error) {
          this.setData({ casting: false, empty: true, emptyText: outcome.message || '这份生辰读不出来' });
          return;
        }
        this.outcome = outcome;
        if (this.revealed) this.render(outcome);
      })
      .catch(() => {
        // divination.run 内部已经兜过底，走到这里基本只剩"本地图谱也失败"
        this.setData({ casting: false, empty: true, emptyText: '图谱生成失败，回去改一下生辰试试' });
      });
  },

  reveal() {
    this.revealed = true;
    this.setData({ casting: false });

    if (this.outcome) {
      this.render(this.outcome);
      return;
    }
    if (this.localResult) {
      // AI 还在写，先把图谱和模板文案亮出来
      this.render({ result: this.localResult, source: 'local', notice: '', aiPending: true });
      return;
    }
    this.setData({ empty: true, emptyText: '图谱还没算完，稍后再试' });
  },

  /** 把结果摊平成 WXML 直接能用的视图模型（WXML 里不做任何计算） */
  render(outcome) {
    const r = outcome.result;
    const chart = r.chart;
    const main = r.match.main;
    const isDraw = chart.mode === 'draw';

    const rows = [];
    if (isDraw) {
      rows.push({ k: '签源', v: chart.draw ? chart.draw.veins : '随机匹配', note: '此签不依生辰' });
    } else {
      if (chart.signs.sun) {
        rows.push({ k: '太阳', v: chart.signs.sun.name, note: chart.signs.sun.tagline });
      }
      if (chart.signs.moon) {
        rows.push({ k: '月亮', v: chart.signs.moon.name, note: chart.signs.moon.tagline });
      }
      rows.push({
        k: '上升',
        v: chart.signs.risingKnown && chart.signs.rising ? chart.signs.rising.name : '留白',
        note: chart.signs.risingKnown && chart.signs.rising ? chart.signs.rising.tagline : '没有出生时辰，这一格不算'
      });
      chart.pillarsList.forEach((p) => {
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
    rows.push({
      k: '命格',
      v: chart.rarity.label,
      note: `偏科度 ${chart.extremity}/100 · 越偏越稀有`
    });
    rows.push({ k: '最突出的轴', v: chart.dominant.name, note: chart.dominant.badge });

    const sharedFates = (main.sharedFates || []).map((f) => f.name);
    const view = {
      source: outcome.source,
      aiPending: !!outcome.aiPending,
      notice: outcome.notice || '',
      aiLabel: !outcome.result.meta || outcome.result.meta.showAiLabel !== false,
      quota: outcome.quota || (r.meta && r.meta.quota) || null,
      codex: r.codex || null,
      title: r.copy.title,
      subtitle: r.copy.subtitle,
      oneLine: r.copy.oneLine,
      main: { char: main.char, rarity: main.rarity, resonance: main.resonance },
      sharedFates,
      fates: chart.fates.map((f) => ({ id: f.id, name: f.name, summary: f.summary })),
      rows,
      axes: chart.axes,
      copy: r.copy,
      side: r.match.side.map((s) => ({ id: s.id, char: s.char, rarity: s.rarity, resonance: s.resonance })),
      anti: {
        char: r.match.anti.char,
        rarity: r.match.anti.rarity,
        resonance: r.match.anti.resonance,
        opposing: r.match.anti.opposing
      },
      ready: true,
      tone: main.char.rarity === 'legend' ? 'legend' : 'default'
    };

    // 反向角色的对立轴，用一句人话总结
    const opp = (r.match.anti.opposing || [])[0];
    if (opp) {
      const axis = chart.axes.find((a) => a.key === opp.key);
      if (axis) {
        view.antiAxis = {
          name: axis.name,
          userSide: opp.userValue >= 50 ? axis.pos : axis.neg,
          charSide: opp.targetValue >= 50 ? axis.pos : axis.neg
        };
      }
    }

    if (r.fortune) {
      view.fortune = {
        date: r.fortune.date,
        levelName: r.fortune.levelName,
        starText: r.fortune.starText,
        levelDesc: r.fortune.levelDesc,
        good: r.fortune.good,
        bad: r.fortune.bad,
        luckyColor: r.fortune.luckyColor,
        luckyNumber: r.fortune.luckyNumber,
        luckyItem: r.fortune.luckyItem
      };
    }

    this.setData(view);
  },

  onCharTap(e) {
    const id = e.detail.id;
    const locked = e.detail.locked;
    if (locked) return;
    wx.navigateTo({ url: `/pages/character/character?id=${id}` });
  },

  onAgain() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onCodex() {
    wx.switchTab({ url: '/pages/codex/codex' });
  },

  onShareAppMessage() {
    const main = this.data.main;
    const title = main
      ? `我的命途是「${main.char.name}」，共振 ${main.resonance}%，你的是谁？`
      : '我推的星运 · 看看你的命途像哪个角色';
    // 分享只带入口，不带图谱数据：图谱种子含生辰，不该出现在别人的手机上
    return { title, path: '/pages/index/index' };
  }
});
