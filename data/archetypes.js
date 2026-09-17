/**
 * 八条「命途坐标轴」——整个占卜系统的公共语言。
 *
 * 设计约定：
 *  - 所有维度都是 0~100 的单一数值，100 = 完全偏 pos 一极，0 = 完全偏 neg 一极，50 = 中间。
 *  - 星座 / 干支 / 灵数 / 角色 / 答题 全都映射到同一组 key 上，才能互相算距离。
 *  - weight 会进入距离计算：羁绊这类"人与人关系"的轴对结果影响更大（更贴题）。
 *  - posDesc / negDesc 是文案素材，结果页的"差异解读"靠它们自动生成，不用给每个角色手写。
 */

const DIMENSIONS = [
  {
    key: 'light',
    name: '光与影',
    pos: '光',
    neg: '影',
    posBadge: '持光者',
    negBadge: '夜行者',
    weight: 1.2,
    posDesc: '你倾向照亮别人，也相信自己值得被照亮',
    negDesc: '你习惯从阴影那一侧看世界，因为那里看得更清楚'
  },
  {
    key: 'order',
    name: '秩序与混沌',
    pos: '秩序',
    neg: '混沌',
    posBadge: '守序者',
    negBadge: '破局者',
    weight: 1.0,
    posDesc: '你相信规则是保护人的东西，慢一点也要站得正',
    negDesc: '你不信规则能救人，宁可亲手把它推翻重来'
  },
  {
    key: 'bond',
    name: '羁绊与孤高',
    pos: '羁绊',
    neg: '孤高',
    posBadge: '结绳者',
    negBadge: '独行者',
    weight: 1.3,
    posDesc: '你把自己系在别人身上，也因此活得最用力',
    negDesc: '你习惯一个人扛，把依赖当作危险'
  },
  {
    key: 'passion',
    name: '炽热与冷静',
    pos: '炽热',
    neg: '冷静',
    posBadge: '烈火',
    negBadge: '寒刃',
    weight: 1.0,
    posDesc: '你先行动再思考，烧起来的时候谁都拦不住',
    negDesc: '你先计算再行动，情绪永远排在判断后面'
  },
  {
    key: 'fate',
    name: '天命与自立',
    pos: '天命',
    neg: '自立',
    posBadge: '承命者',
    negBadge: '开路人',
    weight: 1.1,
    posDesc: '你隐约觉得自己的出现，是某种安排',
    negDesc: '你不等谁来选中你，路是自己踩出来的'
  },
  {
    key: 'mercy',
    name: '温柔与锋利',
    pos: '温柔',
    neg: '锋利',
    posBadge: '柔盾',
    negBadge: '利刃',
    weight: 0.9,
    posDesc: '你对别人的疼痛过分敏感，宁可自己多受一点',
    negDesc: '你说话像刀，因为柔软解决不了问题'
  },
  {
    key: 'obsession',
    name: '执念与随性',
    pos: '执念',
    neg: '随性',
    posBadge: '不放手',
    negBadge: '随风者',
    weight: 1.0,
    posDesc: '你认定的事会追到天涯，代价无所谓',
    negDesc: '你不抓着任何东西，风往哪吹就去哪'
  },
  {
    key: 'sacrifice',
    name: '燃尽与庇护',
    pos: '燃尽',
    neg: '庇护',
    posBadge: '燃尽者',
    negBadge: '庇护者',
    weight: 1.0,
    posDesc: '你随时准备把自己当作代价付出去',
    negDesc: '你选择活下来，因为活着才能护住后面的人'
  }
];

/** 有序 key 数组，做向量计算时统一用这个顺序 */
const DIM_KEYS = DIMENSIONS.map((d) => d.key);

/** 每根轴的中位值，缺省时用它补 */
const DIM_NEUTRAL = 50;

const DIM_MAP = {};
DIMENSIONS.forEach((d) => {
  DIM_MAP[d.key] = d;
});

/** 5 档描述，用于把 0~100 的分数讲成人话 */
const DIM_LEVELS = [
  { max: 20, text: '几乎没有' },
  { max: 40, text: '偏弱' },
  { max: 60, text: '平衡' },
  { max: 80, text: '明显' },
  { max: 100, text: '极强' }
];

function levelOf(value) {
  for (let i = 0; i < DIM_LEVELS.length; i += 1) {
    if (value <= DIM_LEVELS[i].max) return DIM_LEVELS[i].text;
  }
  return DIM_LEVELS[DIM_LEVELS.length - 1].text;
}

module.exports = { DIMENSIONS, DIM_KEYS, DIM_MAP, DIM_NEUTRAL, levelOf };
