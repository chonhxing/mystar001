const { CHARACTER_MAP, RARITY } = require('../../data/characters.js');
const { FATE_MAP } = require('../../data/fates.js');
const chartCore = require('../../core/chart.js');
const matcher = require('../../core/matcher.js');
const storage = require('../../utils/storage.js');
const fmt = require('../../utils/format.js');

Page({
  data: {
    ready: false,
    char: null,
    rarity: null,
    stars: '',
    fates: [],
    axes: [],
    dominant: null,
    resonance: null,
    sharedFates: [],
    unlocked: false,
    axisNote: '这一格是 TA 的图谱：0 = 完全靠后一极，100 = 完全靠前一极'
  },

  onLoad(query) {
    const char = CHARACTER_MAP[query.id];
    if (!char) {
      fmt.toast('找不到这个角色');
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    // 复用 core 的轴计算：拿角色自己的八维生成同一套条形图数据
    const shaped = chartCore.finalize({ dims: char.dims });
    const fates = (char.fates || [])
      .map((id) => FATE_MAP[id])
      .filter(Boolean)
      .map((f) => ({ id: f.id, name: f.name, summary: f.summary, shadow: f.shadow }));
    const rarity = RARITY[char.rarity] || RARITY.common;

    const patch = {
      ready: true,
      char,
      rarity,
      stars: '★'.repeat(rarity.stars) + '☆'.repeat(5 - rarity.stars),
      fates,
      axes: shaped.axes,
      dominant: shaped.dominant,
      unlocked: !!storage.getCodex()[char.id]
    };

    // 有图谱的话，顺手算出"你与 TA 的共振"
    const profile = storage.getProfile();
    if (profile) {
      try {
        const chart = chartCore.buildChart(profile);
        if (chart) {
          patch.resonance = matcher.resonanceOf(chart, char);
          patch.sharedFates = chart.fates
            .filter((f) => char.fates.indexOf(f.id) >= 0)
            .map((f) => ({ id: f.id, name: f.name }));
        }
      } catch (e) {
        patch.resonance = null;
      }
    }

    this.setData(patch);
    wx.setNavigationBarTitle({ title: char.name });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    const c = this.data.char;
    return {
      title: c ? `${c.name} · ${c.motif}` : '我推的星运',
      path: '/pages/index/index'
    };
  }
});
