/**
 * 命途标签（Fate）——比八个维度更有"故事感"的一层。
 *
 * 命盘和角色都各自算一次「最贴近哪条命途」：
 *  - 你的命途 → 结果页「你是【孤高的剑】」这类定性文案
 *  - 角色的命途 → 图鉴里给角色打的标签
 *  - 交集      → 共振解读（"你们共享三条命途坐标"）
 *
 * dims 同样是八维向量，用来和命盘做余弦相似度。
 * shadow 是这条命途的阴暗面，用于「你没带入的命运」段落——让文案有反打的力量。
 */

const FATES = [
  {
    id: 'the_chosen',
    name: '被选中的人',
    summary: '命运用一条看不见的线，把你牵到了台前',
    shadow: '被选中的人，没有退场的权利',
    dims: { light: 85, order: 60, bond: 70, passion: 65, fate: 95, mercy: 70, obsession: 75, sacrifice: 80 }
  },
  {
    id: 'fate_breaker',
    name: '逆命者',
    summary: '你不接受写好的剧本，哪怕代价是把剧本烧了',
    shadow: '和命运对赌的人，往往先烧掉的是自己',
    dims: { light: 60, order: 25, bond: 55, passion: 90, fate: 20, mercy: 55, obsession: 80, sacrifice: 70 }
  },
  {
    id: 'loner',
    name: '独行',
    summary: '你的路最后只剩自己那一串脚印',
    shadow: '独行久了，会忘记怎么伸手',
    dims: { light: 45, order: 55, bond: 10, passion: 50, fate: 45, mercy: 45, obsession: 80, sacrifice: 60 }
  },
  {
    id: 'undying_bond',
    name: '不灭的羁绊',
    summary: '你为同伴而战，也为同伴而活',
    shadow: '羁绊是铠甲，也是别人最容易捏住的地方',
    dims: { light: 80, order: 55, bond: 95, passion: 75, fate: 40, mercy: 85, obsession: 65, sacrifice: 85 }
  },
  {
    id: 'shadow_heir',
    name: '影之继承',
    summary: '你背着不该你背的东西往前走',
    shadow: '背黑暗走太久，会分不清是自己在走还是黑暗在走',
    dims: { light: 20, order: 55, bond: 40, passion: 70, fate: 75, mercy: 30, obsession: 90, sacrifice: 80 }
  },
  {
    id: 'light_watch',
    name: '光之守望',
    summary: '你站在别人前面，替他们挡住看不见的东西',
    shadow: '一直当光的人，没人问过你怕不怕黑',
    dims: { light: 92, order: 70, bond: 75, passion: 60, fate: 65, mercy: 85, obsession: 70, sacrifice: 85 }
  },
  {
    id: 'obsession_prisoner',
    name: '执念的囚徒',
    summary: '一个目标把你整个人钉在了原地',
    shadow: '追到最后，可能已经忘了当初为什么追',
    dims: { light: 35, order: 50, bond: 45, passion: 70, fate: 55, mercy: 35, obsession: 96, sacrifice: 75 }
  },
  {
    id: 'gentle_armor',
    name: '温柔的铠甲',
    summary: '你用柔软去对抗世界的硬，而且真的有效',
    shadow: '过分体谅别人，会把自己一点点耗空',
    dims: { light: 85, order: 55, bond: 85, passion: 45, fate: 40, mercy: 95, obsession: 60, sacrifice: 80 }
  },
  {
    id: 'chessmaster',
    name: '冷酷的棋手',
    summary: '你把所有人都算进了棋局，包括你自己',
    shadow: '算得越准，越没有人敢站在你身边',
    dims: { light: 35, order: 65, bond: 30, passion: 45, fate: 70, mercy: 20, obsession: 88, sacrifice: 60 }
  },
  {
    id: 'blaze',
    name: '烈火之心',
    summary: '你烧得很旺，也烧得很快',
    shadow: '火不会只烧向敌人',
    dims: { light: 78, order: 30, bond: 75, passion: 95, fate: 35, mercy: 60, obsession: 70, sacrifice: 65 }
  },
  {
    id: 'homecoming',
    name: '归乡者',
    summary: '你走再远，最后都在找回去的那条路',
    shadow: '想回去的地方，可能已经不在了',
    dims: { light: 80, order: 70, bond: 85, passion: 50, fate: 35, mercy: 85, obsession: 60, sacrifice: 65 }
  },
  {
    id: 'guilt_bearer',
    name: '赎罪者',
    summary: '你替某件事活着，那件事比你自己重要',
    shadow: '赎不完的罪，会把余生填满',
    dims: { light: 65, order: 60, bond: 65, passion: 55, fate: 55, mercy: 70, obsession: 88, sacrifice: 90 }
  },
  {
    id: 'rule_breaker',
    name: '破戒者',
    summary: '规则在你眼里，是可以被推翻的建议',
    shadow: '推倒的东西，总得有人重新堆起来',
    dims: { light: 50, order: 10, bond: 50, passion: 80, fate: 40, mercy: 45, obsession: 70, sacrifice: 55 }
  },
  {
    id: 'order_keeper',
    name: '秩序的守夜人',
    summary: '你在别人睡着的时候，守着那盏灯',
    shadow: '守夜的人，往往最后一个被记住',
    dims: { light: 72, order: 95, bond: 55, passion: 45, fate: 55, mercy: 60, obsession: 85, sacrifice: 80 }
  },
  {
    id: 'sacrifice_end',
    name: '燃尽者',
    summary: '你早就打算用自己换一个结果',
    shadow: '燃尽之后，没有第二次引燃',
    dims: { light: 70, order: 60, bond: 65, passion: 65, fate: 80, mercy: 65, obsession: 78, sacrifice: 97 }
  },
  {
    id: 'wanderer',
    name: '游荡的自由',
    summary: '你不属于任何一个地方，也因此哪里都能去',
    shadow: '自由到最后，是一种没有人等你的孤独',
    dims: { light: 72, order: 20, bond: 40, passion: 75, fate: 25, mercy: 55, obsession: 25, sacrifice: 40 }
  }
];

const FATE_MAP = {};
FATES.forEach((f) => {
  FATE_MAP[f.id] = f;
});

function getFates(ids) {
  return (ids || []).map((id) => FATE_MAP[id]).filter(Boolean);
}

module.exports = { FATES, FATE_MAP, getFates };
