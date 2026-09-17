/**
 * 干支（东方生辰）——天干地支 → 八维向量的映射表。
 *
 * 只做"命理意象 → 性格坐标"的映射，不做吉凶判断，也不需要农历：
 * 干支历本身按节气走，不按阴历月，所以我们不需要一张农历转换表。
 */

/** 十天干：五行 + 阴阳 */
const STEMS = [
  { name: '甲', element: '木', yinyang: '阳', note: '参天之木' },
  { name: '乙', element: '木', yinyang: '阴', note: '藤蔓之木' },
  { name: '丙', element: '火', yinyang: '阳', note: '太阳之火' },
  { name: '丁', element: '火', yinyang: '阴', note: '灯烛之火' },
  { name: '戊', element: '土', yinyang: '阳', note: '城墙之土' },
  { name: '己', element: '土', yinyang: '阴', note: '田园之土' },
  { name: '庚', element: '金', yinyang: '阳', note: '刀剑之金' },
  { name: '辛', element: '金', yinyang: '阴', note: '珠玉之金' },
  { name: '壬', element: '水', yinyang: '阳', note: '江河之水' },
  { name: '癸', element: '水', yinyang: '阴', note: '雨露之水' }
];

/** 十二地支：五行 + 生肖 */
const BRANCHES = [
  { name: '子', element: '水', zodiac: '鼠', hourRange: '23:00-00:59' },
  { name: '丑', element: '土', zodiac: '牛', hourRange: '01:00-02:59' },
  { name: '寅', element: '木', zodiac: '虎', hourRange: '03:00-04:59' },
  { name: '卯', element: '木', zodiac: '兔', hourRange: '05:00-06:59' },
  { name: '辰', element: '土', zodiac: '龙', hourRange: '07:00-08:59' },
  { name: '巳', element: '火', zodiac: '蛇', hourRange: '09:00-10:59' },
  { name: '午', element: '火', zodiac: '马', hourRange: '11:00-12:59' },
  { name: '未', element: '土', zodiac: '羊', hourRange: '13:00-14:59' },
  { name: '申', element: '金', zodiac: '猴', hourRange: '15:00-16:59' },
  { name: '酉', element: '金', zodiac: '鸡', hourRange: '17:00-18:59' },
  { name: '戌', element: '土', zodiac: '狗', hourRange: '19:00-20:59' },
  { name: '亥', element: '水', zodiac: '猪', hourRange: '21:00-22:59' }
];

/** 五行 → 八维基底。这套映射决定"木命的人"大致是什么气质。 */
const ELEMENT_DIMS = {
  木: { light: 78, order: 60, bond: 70, passion: 60, fate: 50, mercy: 75, obsession: 70, sacrifice: 65 },
  火: { light: 85, order: 50, bond: 65, passion: 92, fate: 60, mercy: 55, obsession: 65, sacrifice: 70 },
  土: { light: 62, order: 88, bond: 70, passion: 35, fate: 55, mercy: 70, obsession: 75, sacrifice: 60 },
  金: { light: 50, order: 80, bond: 50, passion: 58, fate: 60, mercy: 30, obsession: 88, sacrifice: 62 },
  水: { light: 46, order: 42, bond: 58, passion: 45, fate: 80, mercy: 72, obsession: 58, sacrifice: 78 }
};

/** 阴阳修正：阳偏外放，阴偏内敛 */
const YINYANG_TWEAK = {
  阳: { light: 6, passion: 8, fate: 6, order: -4, bond: 4 },
  阴: { light: -4, passion: -8, fate: -4, order: 4, mercy: 6, obsession: 4 }
};

/** 地支个性修正，避免同五行完全一样 */
const BRANCH_TWEAK = [
  { fate: 6 },                    // 子
  { order: 6, obsession: 6 },     // 丑
  { passion: 8, fate: 4 },        // 寅
  { mercy: 6, bond: 4 },          // 卯
  { fate: 8, light: 4 },          // 辰
  { obsession: 8, mercy: -4 },    // 巳
  { passion: 8, light: 4 },       // 午
  { mercy: 6, bond: 6 },          // 未
  { obsession: 6, order: 4 },     // 申
  { order: 8, mercy: -4 },        // 酉
  { order: 6, sacrifice: 6 },     // 戌
  { mercy: 6, obsession: 6 }      // 亥
];

/** 六十甲子名（程序生成，避免手抄出错）：甲子、乙丑……癸亥 */
const SEXAGENARY = [];
for (let i = 0; i < 60; i += 1) {
  SEXAGENARY.push(STEMS[i % 10].name + BRANCHES[i % 12].name);
}

/** 日主十神式的"气质短句"，用于结果页一句话解读 */
const STEM_TAGLINE = {
  甲: '像一棵往上长、不肯弯腰的树',
  乙: '像藤蔓，绕着支点也能长到最高处',
  丙: '像正午的太阳，照得所有人都看见',
  丁: '像一盏灯，只照亮身边一圈人',
  戊: '像城墙，别人靠着你才站得稳',
  己: '像田地，谁都能在你身上种点什么',
  庚: '像刀，锋利而且不会拐弯',
  辛: '像玉，好看，但硬',
  壬: '像大江，方向定了就不回头',
  癸: '像雨，落在哪里都无声'
};

module.exports = {
  STEMS,
  BRANCHES,
  ELEMENT_DIMS,
  YINYANG_TWEAK,
  BRANCH_TWEAK,
  SEXAGENARY,
  STEM_TAGLINE
};
