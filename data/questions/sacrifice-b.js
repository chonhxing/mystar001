/**
 * 「燃尽与庇护」轴 · 第二批。
 * 场景偏"活下去"：留后路、护住别人、以及燃尽之后的代价。
 */

module.exports = [
  ['你有没有为了一件事连续熬过很多天', [
    ['有，而且不止一次', { sacrifice: 12, obsession: 10 }],
    ['有，但事后病了一场', { sacrifice: 6, light: 4 }],
    ['没有，我知道自己的极限', { sacrifice: -11, order: 10 }]
  ]],

  ['你在一件事上被人说"你别管了，先顾自己"', [
    ['会继续管', { sacrifice: 12, light: 8 }],
    ['会听他的', { sacrifice: -9, order: 8 }],
    ['会嘴上答应，照旧', { sacrifice: 7, obsession: 7 }]
  ]],

  ['你的朋友在深夜出事，你明天有很重要的安排', [
    ['马上去，安排可以再谈', { sacrifice: 13, bond: 11, light: 8 }],
    ['先安排，再去找他', { sacrifice: -6, order: 11 }],
    ['会先打电话确认严重程度', { sacrifice: -2, order: 9, light: 5 }]
  ]],

  ['你在一件事上被人说"你太不爱惜身体了"', [
    ['身体能扛就扛', { sacrifice: 11, obsession: 8 }],
    ['会去做个检查', { sacrifice: -9, order: 10 }],
    ['会调整作息', { sacrifice: -4, order: 8, light: 4 }]
  ]],

  ['你有没有一次是"替所有人扛了"', [
    ['有，而且没人知道', { sacrifice: 14, light: 9, obsession: 8 }],
    ['有，大家都知道', { sacrifice: 10, light: 8, bond: 6 }],
    ['没有，我不干这种事', { sacrifice: -10, order: 8 }]
  ]],

  ['你在一件事上被人说"你太惯着大家了"', [
    ['惯就惯吧', { sacrifice: 9, light: 8 }],
    ['会开始立规矩', { sacrifice: -6, order: 11 }],
    ['会看情况', { sacrifice: -2, order: 7 }]
  ]],

  ['你在一个需要"选一个救"的场合', [
    ['两个都救，哪怕自己搭进去', { sacrifice: 14, light: 10, obsession: 8 }],
    ['选一个最有机会的', { sacrifice: -7, order: 11 }],
    ['会先救最弱的', { sacrifice: 4, light: 9, mercy: 8 }]
  ]],

  ['你在一件事上被人说"你从来不说累"', [
    ['说了也没用', { sacrifice: 10, bond: -6, light: -3 }],
    ['确实是，我不太说', { sacrifice: 7, light: 5 }],
    ['会说，只是不在人前', { sacrifice: 6, obsession: 6, light: 4 }]
  ]],

  ['你的家人希望你活得轻松一点', [
    ['会让他们放心', { sacrifice: -3, light: 8, bond: 8 }],
    ['做不到，我不习惯轻松', { sacrifice: 11, obsession: 9 }],
    ['会试着轻松一点', { sacrifice: -7, light: 7, order: 6 }]
  ]],

  ['你在一件事上被人说"你太拼了，不值得"', [
    ['值不值得我说了算', { sacrifice: 11, obsession: 10 }],
    ['会停下来重新想', { sacrifice: -7, light: 5, order: 7 }],
    ['会继续，但慢一点', { sacrifice: 3, order: 7 }]
  ]],

  ['你有没有一次"为了保住别人而放弃了什么"', [
    ['有，而且我不后悔', { sacrifice: 13, light: 10 }],
    ['有，但那之后我变了', { sacrifice: 7, obsession: 8, light: 3 }],
    ['没有，我做不到', { sacrifice: -8, order: 7 }]
  ]],

  ['你在一件事上被人说"你先想想你自己"', [
    ['会想，但想的是别人', { sacrifice: 11, light: 8 }],
    ['会真的想一想自己', { sacrifice: -8, order: 8, light: 5 }],
    ['会假装想了', { sacrifice: 5, light: 3 }]
  ]],

  ['你在一个需要"长期照顾一个人"的处境里', [
    ['会一直照顾下去', { sacrifice: 13, bond: 10, obsession: 8 }],
    ['会安排专业的照护', { sacrifice: -7, order: 11 }],
    ['会照顾，但会找人轮换', { order: 9, bond: 7 }]
  ]],

  ['你在一件事上被人说"你太能撑了"', [
    ['撑是我的本事', { sacrifice: 11, obsession: 9 }],
    ['撑不住的时候会垮得很彻底', { sacrifice: 7, light: 4 }],
    ['会学着不撑', { sacrifice: -8, order: 8, light: 5 }]
  ]],

  ['你有没有一个"不能倒"的理由', [
    ['有，有人需要我', { sacrifice: 12, bond: 11, light: 8 }],
    ['没有，我倒不倒无所谓', { sacrifice: 4, light: -6 }],
    ['有，但不能细想', { sacrifice: 9, obsession: 7 }]
  ]],

  ['你在一件事上被人说"你把自己放得太低了"', [
    ['习惯了', { sacrifice: 11, light: 5 }],
    ['会想想是不是真的', { sacrifice: -5, light: 6 }],
    ['不认，我只是不爱争', { sacrifice: 2, order: 6 }]
  ]],

  ['你在一个需要"放弃一次机会去帮人"的场合', [
    ['放弃，机会还会有', { sacrifice: 11, light: 9 }],
    ['不放弃，机会难得', { sacrifice: -9, obsession: 9 }],
    ['会想办法两边都顾', { sacrifice: 5, obsession: 7, order: 6 }]
  ]],

  ['你在一件事上被人说"你总在救别人"', [
    ['救人是本能', { sacrifice: 12, light: 10 }],
    ['我也救过自己', { sacrifice: -4, order: 7 }],
    ['救得多了会累', { sacrifice: 5, light: 5 }]
  ]],

  ['你有没有一次"明知道会伤到自己还是做了"', [
    ['有', { sacrifice: 13, obsession: 10, passion: 8 }],
    ['没有，我会绕开', { sacrifice: -11, order: 10 }],
    ['有，但只对一个人', { sacrifice: 10, bond: 10 }]
  ]],

  ['你在一件事上被人说"你不该这么累"', [
    ['累习惯了', { sacrifice: 10, obsession: 8 }],
    ['会调整', { sacrifice: -7, order: 9 }],
    ['会想他为什么关心这个', { light: 5 }]
  ]],

  ['你在一个需要"把机会让出去"的场合', [
    ['让，他有更需要', { sacrifice: 11, light: 9, mercy: 7 }],
    ['不让，我也需要', { sacrifice: -8, obsession: 9 }],
    ['会让，但不能总是我让', { order: 9, light: 5 }]
  ]],

  ['你在一件事上被人说"你太能忍了"', [
    ['忍是成本最低的', { sacrifice: 9, order: 9 }],
    ['会不忍', { sacrifice: -6, passion: 8 }],
    ['忍是为了以后', { sacrifice: 6, obsession: 8 }]
  ]],

  ['你有没有一个"愿意陪到最后"的人', [
    ['有', { sacrifice: 13, bond: 12, light: 8 }],
    ['有，但不确定做得到', { sacrifice: 6, light: 4 }],
    ['没有', { sacrifice: -9, bond: -8 }]
  ]],

  ['你在一个需要"用自己的时间换别人时间"的场合', [
    ['换，我的时间没那么贵', { sacrifice: 11, light: 8 }],
    ['不换，时间就是命', { sacrifice: -9, order: 9 }],
    ['会看那个人是谁', { sacrifice: 3, bond: 8, light: 5 }]
  ]],

  ['你在一件事上被人说"你太不争了"', [
    ['不争是我的选择', { sacrifice: 6, light: 6, order: 5 }],
    ['会开始争', { sacrifice: -7, obsession: 8, passion: 7 }],
    ['不争是因为没必要', { sacrifice: -2, order: 8 }]
  ]],

  ['你在一个需要"先活下来"的时刻', [
    ['先活下来，别的以后再说', { sacrifice: -11, order: 11 }],
    ['有些东西比活着重要', { sacrifice: 13, obsession: 11, fate: 7 }],
    ['看还有没有别的路', { sacrifice: -4, order: 9 }]
  ]],

  ['你在一件事上被人说"你把自己搭进去了"', [
    ['搭得值', { sacrifice: 12, obsession: 10 }],
    ['会想想值不值', { sacrifice: -6, light: 5, order: 7 }],
    ['搭了就搭了', { sacrifice: 9, obsession: 6 }]
  ]],

  ['你有没有一次是"为了一个承诺赔上很多"', [
    ['有，而且我会再赔一次', { sacrifice: 13, order: 9, obsession: 10 }],
    ['有，但不会再有第二次', { sacrifice: 4, order: 8, obsession: -5 }],
    ['没有，我答应的事都留有余地', { sacrifice: -9, order: 10 }]
  ]],

  ['你在一件事上被人说"你这样会没人替你难过"', [
    ['不需要有人替我难过', { sacrifice: 10, bond: -7, obsession: 8 }],
    ['会想找人说说', { sacrifice: -6, bond: 9, light: 5 }],
    ['会觉得有点凉', { sacrifice: 3, light: 4 }]
  ]],

  ['你在一个需要"护住一个人"的时刻', [
    ['会挡在他前面', { sacrifice: 13, light: 10, bond: 9 }],
    ['会拉着他一起跑', { sacrifice: 2, bond: 10, order: 7 }],
    ['会先看清对方是谁', { sacrifice: -6, order: 10 }]
  ]],

  ['你在一件事上被人说"你太拼了，歇一歇吧"', [
    ['做完就歇', { sacrifice: 10, obsession: 9 }],
    ['现在就能歇', { sacrifice: -8, order: 8, light: 5 }],
    ['会歇，但心里不踏实', { sacrifice: 5, obsession: 8 }]
  ]],

  ['你有没有一件事是"做了会伤自己但不做会伤别人"', [
    ['选伤自己', { sacrifice: 14, light: 10 }],
    ['选伤别人', { sacrifice: -10, light: -8 }],
    ['会想第三种办法', { order: 10, light: 5 }]
  ]],

  ['你在一件事上被人说"你总把自己排最后"', [
    ['认，习惯了', { sacrifice: 12, light: 7 }],
    ['不认，我也重要', { sacrifice: -7, order: 8, light: 5 }],
    ['认，但在改', { sacrifice: 3, light: 7 }]
  ]],

  ['你在一个需要"放弃休息"的场合', [
    ['放弃，事做完再睡', { sacrifice: 11, obsession: 10 }],
    ['不放弃，睡够再说', { sacrifice: -11, order: 10 }],
    ['会少睡一点', { sacrifice: 2, order: 7 }]
  ]],

  ['你在一件事上被人说"你太不把自己当回事"', [
    ['不太当回事', { sacrifice: 11, light: 4 }],
    ['会开始当回事', { sacrifice: -8, order: 9, light: 5 }],
    ['不认，我只是不爱说', { sacrifice: 3, light: 4 }]
  ]],

  ['你有没有一个"只要他一句话我就会去"的人', [
    ['有', { sacrifice: 13, bond: 12, light: 6 }],
    ['没有，我不会那么冲动', { sacrifice: -10, order: 9 }],
    ['有，但他不会开这个口', { sacrifice: 10, bond: 10, light: 5 }]
  ]],

  ['你在一件事上被人说"你在硬撑"', [
    ['是硬撑，但撑得住', { sacrifice: 11, obsession: 10 }],
    ['不撑了', { sacrifice: -8, light: 6 }],
    ['撑不住会说', { sacrifice: -2, light: 6 }]
  ]],

  ['你在一个需要"承担后果"的场合', [
    ['承担，这是我做的', { sacrifice: 9, order: 11, light: 7 }],
    ['会想办法分摊', { sacrifice: -6, bond: 8, order: 7 }],
    ['会先解释清楚', { sacrifice: -7, order: 9 }]
  ]],

  ['你在一件事上被人说"你过得太紧了"', [
    ['紧一点好', { sacrifice: 8, obsession: 8 }],
    ['会放松', { sacrifice: -7, light: 7 }],
    ['不知道该怎么松', { sacrifice: 5, obsession: 6, light: 3 }]
  ]],

  ['你有没有一次"把最好的让给了别人"', [
    ['有，而且没告诉他', { sacrifice: 13, light: 11 }],
    ['有，他知道了', { sacrifice: 10, light: 8, bond: 7 }],
    ['没有，我也会给自己留好的', { sacrifice: -9, order: 9 }]
  ]],

  ['你在一件事上被人说"你太不容易了"', [
    ['没什么不容易的', { sacrifice: 9, light: 5 }],
    ['会说谢谢他这么说', { sacrifice: -2, light: 7 }],
    ['会有点想哭', { sacrifice: 8, light: 5 }]
  ]],

  ['你在一个需要"说一句重话"的场合，但那会伤到对方', [
    ['会说，伤比骗好', { sacrifice: -3, order: 10, light: 6 }],
    ['会忍住不说', { sacrifice: 8, light: 7, mercy: 6 }],
    ['会换个方式说', { sacrifice: 2, light: 8, order: 6 }]
  ]],

  ['你在一件事上被人说"你从来不肯为自己开口"', [
    ['开不出口', { sacrifice: 11, light: 4 }],
    ['会学着开一次', { sacrifice: -6, light: 7 }],
    ['不觉得需要开', { sacrifice: -2, order: 6 }]
  ]],

  ['你有没有一个"不能让他出事"的人', [
    ['有', { sacrifice: 13, bond: 12, light: 8 }],
    ['没有，谁出事都跟我没关系', { sacrifice: -10, light: -5 }],
    ['有过，后来散了', { sacrifice: 4, light: 4 }]
  ]],

  ['你在一件事上被人说"你太累了，我看着都累"', [
    ['会笑一下，说还行', { sacrifice: 8, light: 6 }],
    ['会承认累', { sacrifice: -3, light: 7, bond: 5 }],
    ['会继续做', { sacrifice: 10, obsession: 9 }]
  ]],

  ['你在一个需要"把话咽下去"的场合，因为说了会有人受伤', [
    ['咽下去', { sacrifice: 9, light: 8, order: 5 }],
    ['还是会说', { sacrifice: -6, passion: 8, light: -3 }],
    ['会写下来，但不发出去', { sacrifice: 7, obsession: 7, light: 4 }]
  ]],

  ['你在一件事上被人说"你太会照顾人了"', [
    ['习惯了', { sacrifice: 10, light: 8, mercy: 7 }],
    ['会想让人照顾一下自己', { sacrifice: -4, light: 6, bond: 7 }],
    ['不觉得这是好事', { sacrifice: 3, light: 4 }]
  ]],

  ['你有没有一次是"用自己的机会换别人的"', [
    ['有', { sacrifice: 12, light: 10 }],
    ['没有', { sacrifice: -8, order: 8 }],
    ['有，但当时很不情愿', { sacrifice: 5, light: 4, obsession: 5 }]
  ]],

  ['你在一件事上被人说"你太不心疼自己了"', [
    ['认', { sacrifice: 12, light: 4 }],
    ['不认，我很清楚自己在做什么', { sacrifice: 4, order: 8 }],
    ['会开始心疼一下', { sacrifice: -7, light: 7 }]
  ]],

  ['你在一个需要"坚持到底"的场合，但你已经没力气了', [
    ['撑到最后', { sacrifice: 13, obsession: 12 }],
    ['会喊人来接', { sacrifice: -7, bond: 10, light: 6 }],
    ['会停在能停的地方', { sacrifice: -8, order: 10 }]
  ]]
];
