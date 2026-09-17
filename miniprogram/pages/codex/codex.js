const { CHARACTERS, RARITY } = require('../../data/characters.js');
const storage = require('../../utils/storage.js');
const fmt = require('../../utils/format.js');

const RARITY_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'legend', name: '传说' },
  { key: 'epic', name: '史诗' },
  { key: 'rare', name: '稀有' },
  { key: 'common', name: '寻常' }
];

const STATUS_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'unlocked', name: '已解锁' },
  { key: 'locked', name: '未解锁' }
];

Page({
  data: {
    rarityFilters: RARITY_FILTERS,
    statusFilters: STATUS_FILTERS,
    rarityKey: 'all',
    statusKey: 'all',
    list: [],
    unlockedCount: 0,
    total: CHARACTERS.length,
    percent: 0,
    newestId: ''
  },

  onLoad() {
    this.build();
  },

  onShow() {
    this.build();
  },

  build() {
    const codex = storage.getCodex();
    const unlockedCount = Object.keys(codex).length;
    const all = CHARACTERS.map((c) => ({
      id: c.id,
      char: c,
      rarity: RARITY[c.rarity],
      unlocked: !!codex[c.id],
      score: codex[c.id] ? codex[c.id].firstScore : 0,
      firstAt: codex[c.id] ? codex[c.id].firstAt : 0,
      count: codex[c.id] ? codex[c.id].count : 0
    }));

    this.all = all;
    this.setData({
      unlockedCount,
      total: all.length,
      percent: Math.round((unlockedCount / all.length) * 100)
    });
    this.applyFilter();
  },

  applyFilter() {
    const { rarityKey, statusKey } = this.data;
    const list = this.all
      .filter((r) => {
        if (rarityKey !== 'all' && r.char.rarity !== rarityKey) return false;
        if (statusKey === 'unlocked' && !r.unlocked) return false;
        if (statusKey === 'locked' && r.unlocked) return false;
        return true;
      })
      // 已解锁的排前面，同状态内按稀有度 + 名字
      .sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        const ra = (RARITY[a.char.rarity] || {}).stars || 1;
        const rb = (RARITY[b.char.rarity] || {}).stars || 1;
        return rb - ra;
      })
      .map((r) => ({
        id: r.id,
        char: r.char,
        rarity: r.rarity,
        unlocked: r.unlocked,
        score: r.score,
        countText: r.count > 1 ? `遇见 ${r.count} 次` : ''
      }));
    this.setData({ list });
  },

  onRarityTap(e) {
    this.setData({ rarityKey: e.currentTarget.dataset.key }, () => this.applyFilter());
  },

  onStatusTap(e) {
    this.setData({ statusKey: e.currentTarget.dataset.key }, () => this.applyFilter());
  },

  onCardTap(e) {
    const { id, locked } = e.detail;
    if (locked) {
      fmt.toast('还没在匹配中遇见 TA');
      return;
    }
    wx.navigateTo({ url: `/pages/character/character?id=${id}` });
  },

  onDraw() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    return {
      title: `我已经遇见了 ${this.data.unlockedCount} 条命途，你的是哪一条？`,
      path: '/pages/index/index'
    };
  }
});
