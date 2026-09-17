/**
 * 核心题。
 *
 * 最早手写的 9 道题，一题一根轴（外加一道四选项的收尾题）。
 * 它们的 id 是显式写死的 —— tools/live-test.js 和历史的答题记录都按 id 索引，
 * **改题干可以，改 id 不行**。
 *
 * 格式说明见 data/questions/index.js 顶部。
 */

module.exports = [
  ['如果能改写过去的一件事，你会动哪里？', [
    ['不动。那些伤口现在是我的一部分', { light: 10, mercy: 6, sacrifice: 4 }],
    ['救回那个人。别的代价我认', { obsession: 14, bond: 10, light: -8 }, 'obsession_prisoner'],
    ['只改自己犯下的那个错', { order: 10, mercy: 8, sacrifice: 6 }, 'guilt_bearer']
  ], { id: 'q_rewrite', dim: 'light', hint: '不用想太久，第一反应最准' }],

  ['一个人走夜路的时候，你耳机里放什么？', [
    ['很吵的歌，这样就不用听自己的脑子', { passion: 10, light: 6, obsession: -6 }],
    ['什么都不放，脚步声就够了', { bond: -12, obsession: 8, order: 6 }, 'loner'],
    ['有人说话的声音，播客或者老剧', { bond: 10, mercy: 6 }]
  ], { id: 'q_night_walk', dim: 'bond' }],

  ['规则明显不公的时候，你——', [
    ['在规则里找漏洞，把该拿的拿回来', { order: 8, obsession: 8, light: 4 }],
    ['直接把规则砸了，让所有人看见它碎了', { order: -16, passion: 12, light: 4 }, 'rule_breaker'],
    ['先护住被规则压着的那几个人', { mercy: 14, bond: 10, order: 4 }, 'gentle_armor']
  ], { id: 'q_unfair_rule', dim: 'order' }],

  ['朋友半夜打来电话说「我出事了」，你的第一反应是——', [
    ['报地址，我已经在路上了', { passion: 12, bond: 12, sacrifice: 8 }, 'undying_bond'],
    ['先问他现在安全吗、身边有没有人', { order: 10, mercy: 10 }],
    ['先听他说完，一个字都不打断', { mercy: 14, passion: -10 }]
  ], { id: 'q_emergency_call', dim: 'passion' }],

  ['你相信有些人生来就是被安排好的吗？', [
    ['信。有些相遇不可能是巧合', { fate: 16, mercy: 6 }, 'the_chosen'],
    ['不信。所谓命运只是事后讲的故事', { fate: -16, order: 6, obsession: 6 }, 'fate_breaker'],
    ['信有安排，但我可以不听', { fate: 4, obsession: 10, light: 6 }]
  ], { id: 'q_destiny', dim: 'fate' }],

  ['有人当着你的面伤害一个和你无关的人，你会——', [
    ['挡下来，哪怕我打不过', { mercy: 12, sacrifice: 14, light: 8 }, 'light_watch'],
    ['记住这张脸，等到他落单的那天', { obsession: 14, light: -10, mercy: -10 }, 'shadow_heir'],
    ['开口，用最难听的实话让他停手', { mercy: -12, passion: 10, order: 6 }]
  ], { id: 'q_bystander', dim: 'mercy' }],

  ['你手里有一件非做不可的事，代价是——', [
    ['什么代价都行，做完再说', { obsession: 16, sacrifice: 10 }, 'obsession_prisoner'],
    ['先算清楚值不值得，不值就走', { obsession: -14, order: 8, fate: -6 }],
    ['一边做一边改，走到哪算哪', { obsession: -8, order: -10, passion: 8 }, 'wanderer']
  ], { id: 'q_price', dim: 'obsession' }],

  ['如果最后一击需要有人留下来，你希望那个人是——', [
    ['我。这个结局我早就想过了', { sacrifice: 18, light: 6 }, 'sacrifice_end'],
    ['谁都别留，一起想办法活着出去', { sacrifice: -16, bond: 12, order: 6 }],
    ['由我来决定谁留下，这是我的责任', { order: 10, obsession: 10, sacrifice: 6 }, 'chessmaster']
  ], { id: 'q_last_hit', dim: 'sacrifice' }],

  ['你希望别人最后怎么记住你？', [
    ['一个能被依赖的人', { bond: 12, mercy: 10 }, 'undying_bond'],
    ['一个从没退过的人', { obsession: 12, passion: 10 }, 'blaze'],
    ['一个谁也没能真正认识的人', { bond: -14, light: -6, obsession: 6 }, 'loner'],
    ['不重要，记不记住都行', { obsession: -12, fate: -8, light: 4 }, 'wanderer']
  ], { id: 'q_remembered', dim: 'none' }]
];
