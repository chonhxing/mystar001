const art = require('../../utils/art.js');
const { FATE_MAP } = require('../../data/fates.js');
const { CONFIG } = require('../../config/index.js');

/**
 * 角色卡。
 * 三种尺寸：lg（结果页主推）/ md（图鉴网格）/ sm（副推、历史）
 * 美术没到位时自动走占位渲染，见 utils/art.js。
 */
Component({
  properties: {
    char: { type: Object, value: null },
    rarity: { type: Object, value: null },
    resonance: { type: Number, value: 0 },
    size: { type: String, value: 'md' },
    locked: { type: Boolean, value: false },
    showFates: { type: Boolean, value: true },
    showResonance: { type: Boolean, value: true }
  },

  data: {
    view: null
  },

  observers: {
    'char, rarity, resonance, size, locked': function observe() {
      this.build();
    }
  },

  lifetimes: {
    attached() {
      this.build();
    }
  },

  methods: {
    build() {
      const c = this.data.char;
      if (!c) {
        this.setData({ view: null });
        return;
      }
      const resolved = art.resolveArt(c);
      const rarity = this.data.rarity || {};
      const stars = '★'.repeat(rarity.stars || 1) + '☆'.repeat(5 - (rarity.stars || 1));
      const fates = (c.fates || [])
        .map((id) => FATE_MAP[id])
        .filter(Boolean)
        .slice(0, 3)
        .map((f) => ({ id: f.id, name: f.name }));

      this.setData({
        view: {
          art: resolved,
          rarityClass: `rarity-${c.rarity || 'common'}`,
          rarityLabel: rarity.label || '',
          stars,
          fates,
          motif: c.motif || '',
          signature: c.signature || '',
          resonance: this.data.resonance,
          // 共振度也画成一小段进度条，比纯数字更有存在感
          resonanceStyle: `width:${Math.max(0, Math.min(100, this.data.resonance || 0))}%`,
          artMode: CONFIG.ENABLE_ART ? 'image' : 'placeholder'
        }
      });
    },

    onTap() {
      const c = this.data.char;
      if (!c) return;
      this.triggerEvent('tapcard', { id: c.id, locked: this.data.locked });
    }
  }
});
