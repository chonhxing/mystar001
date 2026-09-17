/**
 * 十二星座（西方星象）。
 * dims 是这套体系里"主星"级的权重来源，会在 core/chart.js 里占最大配比。
 */

const ZODIAC = [
  {
    key: 'aries', name: '白羊座', en: 'Aries', from: [3, 21], to: [4, 19],
    element: '火', ruler: '火星', glyph: '♈',
    tagline: '先冲出去，再想为什么要冲',
    dims: { light: 70, order: 35, bond: 60, passion: 92, fate: 45, mercy: 55, obsession: 70, sacrifice: 60 }
  },
  {
    key: 'taurus', name: '金牛座', en: 'Taurus', from: [4, 20], to: [5, 20],
    element: '土', ruler: '金星', glyph: '♉',
    tagline: '我抓着的东西，不会松手',
    dims: { light: 65, order: 80, bond: 70, passion: 35, fate: 40, mercy: 70, obsession: 75, sacrifice: 45 }
  },
  {
    key: 'gemini', name: '双子座', en: 'Gemini', from: [5, 21], to: [6, 21],
    element: '风', ruler: '水星', glyph: '♊',
    tagline: '我知道很多事，但不打算全都当真',
    dims: { light: 66, order: 32, bond: 65, passion: 55, fate: 28, mercy: 60, obsession: 32, sacrifice: 40 }
  },
  {
    key: 'cancer', name: '巨蟹座', en: 'Cancer', from: [6, 22], to: [7, 22],
    element: '水', ruler: '月亮', glyph: '♋',
    tagline: '我把所有人都记在心里，包括伤过我的',
    dims: { light: 75, order: 65, bond: 92, passion: 45, fate: 45, mercy: 92, obsession: 65, sacrifice: 75 }
  },
  {
    key: 'leo', name: '狮子座', en: 'Leo', from: [7, 23], to: [8, 22],
    element: '火', ruler: '太阳', glyph: '♌',
    tagline: '我要站在有光的地方',
    dims: { light: 88, order: 65, bond: 75, passion: 85, fate: 75, mercy: 65, obsession: 70, sacrifice: 70 }
  },
  {
    key: 'virgo', name: '处女座', en: 'Virgo', from: [8, 23], to: [9, 22],
    element: '土', ruler: '水星', glyph: '♍',
    tagline: '不做到对，我睡不着',
    dims: { light: 70, order: 92, bond: 55, passion: 35, fate: 40, mercy: 65, obsession: 80, sacrifice: 65 }
  },
  {
    key: 'libra', name: '天秤座', en: 'Libra', from: [9, 23], to: [10, 23],
    element: '风', ruler: '金星', glyph: '♎',
    tagline: '我总得先把天平摆平',
    dims: { light: 76, order: 80, bond: 85, passion: 40, fate: 45, mercy: 88, obsession: 55, sacrifice: 60 }
  },
  {
    key: 'scorpio', name: '天蝎座', en: 'Scorpio', from: [10, 24], to: [11, 22],
    element: '水', ruler: '冥王星', glyph: '♏',
    tagline: '我会记住，然后等到那一天',
    dims: { light: 30, order: 42, bond: 60, passion: 72, fate: 80, mercy: 26, obsession: 96, sacrifice: 86 }
  },
  {
    key: 'sagittarius', name: '射手座', en: 'Sagittarius', from: [11, 23], to: [12, 21],
    element: '火', ruler: '木星', glyph: '♐',
    tagline: '远方在叫我，我没办法不去',
    dims: { light: 80, order: 24, bond: 55, passion: 78, fate: 40, mercy: 60, obsession: 28, sacrifice: 40 }
  },
  {
    key: 'capricorn', name: '摩羯座', en: 'Capricorn', from: [12, 22], to: [1, 19],
    element: '土', ruler: '土星', glyph: '♑',
    tagline: '我自己扛，反正也只有我扛得住',
    dims: { light: 46, order: 92, bond: 36, passion: 45, fate: 84, mercy: 34, obsession: 92, sacrifice: 75 }
  },
  {
    key: 'aquarius', name: '水瓶座', en: 'Aquarius', from: [1, 20], to: [2, 18],
    element: '风', ruler: '天王星', glyph: '♒',
    tagline: '我看着这个世界，但不完全属于它',
    dims: { light: 60, order: 28, bond: 34, passion: 50, fate: 74, mercy: 60, obsession: 45, sacrifice: 55 }
  },
  {
    key: 'pisces', name: '双鱼座', en: 'Pisces', from: [2, 19], to: [3, 20],
    element: '水', ruler: '海王星', glyph: '♓',
    tagline: '我替所有人难过，包括敌人',
    dims: { light: 78, order: 30, bond: 80, passion: 45, fate: 65, mercy: 95, obsession: 50, sacrifice: 90 }
  }
];

/** 星座 ↔ 关键字查表 */
const ZODIAC_MAP = {};
ZODIAC.forEach((z) => {
  ZODIAC_MAP[z.key] = z;
});

const ELEMENTS = {
  火: { name: '火', trait: '行动与燃烧', color: '#F0764B' },
  土: { name: '土', trait: '建造与坚守', color: '#C79A55' },
  风: { name: '风', trait: '思辨与流动', color: '#8FD0E8' },
  水: { name: '水', trait: '感受与包容', color: '#7B8BE8' }
};

module.exports = { ZODIAC, ZODIAC_MAP, ELEMENTS };
