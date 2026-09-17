/**
 * 生命灵数（Numerology）——整个体系里最容易"空口无凭"的一块，
 * 所以它只占命盘的一小部分权重，主要用来产出好看的名称和短句。
 * 11 / 22 / 33 作为大师数保留，不继续约简。
 */

const LIFE_NUMBERS = {
  1: {
    name: '开创者', en: 'The Pioneer',
    tagline: '你习惯站到第一个位置上，哪怕前面没有路',
    dims: { light: 75, order: 60, bond: 40, passion: 75, fate: 60, mercy: 45, obsession: 80, sacrifice: 50 }
  },
  2: {
    name: '协调者', en: 'The Diplomat',
    tagline: '你听得见别人没说出口的那半句话',
    dims: { light: 80, order: 65, bond: 90, passion: 40, fate: 40, mercy: 92, obsession: 50, sacrifice: 65 }
  },
  3: {
    name: '表达者', en: 'The Storyteller',
    tagline: '你把难过讲成笑话，别人就愿意听下去',
    dims: { light: 85, order: 40, bond: 75, passion: 70, fate: 45, mercy: 70, obsession: 40, sacrifice: 40 }
  },
  4: {
    name: '建造者', en: 'The Builder',
    tagline: '你不信灵感，你信一遍又一遍地做',
    dims: { light: 65, order: 95, bond: 65, passion: 35, fate: 50, mercy: 60, obsession: 85, sacrifice: 60 }
  },
  5: {
    name: '自由者', en: 'The Drifter',
    tagline: '你受不了被安排，也受不了太久不动',
    dims: { light: 78, order: 25, bond: 55, passion: 80, fate: 40, mercy: 60, obsession: 35, sacrifice: 40 }
  },
  6: {
    name: '守护者', en: 'The Guardian',
    tagline: '你总是不自觉地站到最脆弱的那个人前面',
    dims: { light: 88, order: 75, bond: 92, passion: 50, fate: 45, mercy: 92, obsession: 70, sacrifice: 80 }
  },
  7: {
    name: '求索者', en: 'The Seeker',
    tagline: '你宁可一个人待着，也不想过得不明不白',
    dims: { light: 54, order: 66, bond: 32, passion: 40, fate: 74, mercy: 46, obsession: 84, sacrifice: 58 }
  },
  8: {
    name: '掌权者', en: 'The Sovereign',
    tagline: '你要的不只是赢，是让结果按你说的走',
    dims: { light: 46, order: 85, bond: 42, passion: 65, fate: 82, mercy: 30, obsession: 92, sacrifice: 55 }
  },
  9: {
    name: '殉道者', en: 'The Martyr',
    tagline: '你能为了一件事把自己整个交出去',
    dims: { light: 92, order: 55, bond: 80, passion: 55, fate: 80, mercy: 95, obsession: 50, sacrifice: 95 }
  },
  11: {
    name: '灵视者', en: 'The Visionary',
    tagline: '你总是先感觉到，再想明白为什么',
    dims: { light: 90, order: 45, bond: 70, passion: 50, fate: 92, mercy: 90, obsession: 65, sacrifice: 85 }
  },
  22: {
    name: '筑梦者', en: 'The Architect',
    tagline: '你想做的事大得不像一个人能做的',
    dims: { light: 80, order: 90, bond: 75, passion: 55, fate: 75, mercy: 70, obsession: 88, sacrifice: 75 }
  },
  33: {
    name: '奉献者', en: 'The Healer',
    tagline: '你天生想修补别人，代价常常是自己',
    dims: { light: 95, order: 65, bond: 90, passion: 60, fate: 85, mercy: 98, obsession: 60, sacrifice: 98 }
  }
};

/** 姓名数理的简化算法说明（放在这里，UI 上也可以直接展示给用户看） */
const NAME_NOTE = '姓名数理由用字编码折算，属趣味算法，非传统五格剖象';

module.exports = { LIFE_NUMBERS, NAME_NOTE };
