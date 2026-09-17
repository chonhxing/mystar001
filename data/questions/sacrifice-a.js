/**
 * 「燃尽与庇护」轴 · 第一批。
 *
 * 燃尽 = 把自己当作代价付出去、不留后路、拼上全部
 * 庇护 = 要活下来、护住别人、留退路、先算代价
 */

module.exports = [
  ['一件事需要有人牺牲一点利益才能成，你会', [
    ['我来，反正我没什么可失去的', { sacrifice: 13, light: 7 }],
    ['先看看有没有别的办法', { sacrifice: -8, order: 10 }],
    ['大家一人出一点', { sacrifice: -4, bond: 8, order: 6 }]
  ]],

  ['你的团队需要加班赶一个节点', [
    ['我留下来，你们先走', { sacrifice: 12, light: 8, bond: 7 }],
    ['一起留，一起走', { sacrifice: 4, bond: 9, order: 6 }],
    ['按排班来，不该我留我不留', { sacrifice: -10, order: 10 }]
  ]],

  ['你的朋友遇到了很大的麻烦，需要你搭上很多时间', [
    ['搭上，我的时间就是用来做这个的', { sacrifice: 12, light: 9, bond: 8 }],
    ['搭一部分，剩下的他自己来', { sacrifice: 2, order: 8, light: 4 }],
    ['先问清楚要多久', { sacrifice: -7, order: 9 }]
  ]],

  ['你有没有过"拼上一切"的时刻', [
    ['有，而且不止一次', { sacrifice: 13, passion: 9 }],
    ['有，但事后有点后怕', { sacrifice: 5, light: 5 }],
    ['没有，我一直留着后手', { sacrifice: -12, order: 10 }]
  ]],

  ['你在一件危险的事面前', [
    ['会第一个上', { sacrifice: 13, passion: 11, light: 6 }],
    ['会先评估危险', { sacrifice: -9, order: 11 }],
    ['会看有没有人比我更合适', { sacrifice: -4, order: 7, light: 5 }]
  ]],

  ['你的家人需要你放弃现在的生活去照顾', [
    ['会放弃，没什么好想的', { sacrifice: 13, bond: 11, light: 7 }],
    ['会去，但会安排好后路', { sacrifice: 3, order: 10, bond: 8 }],
    ['会找别的办法，比如请人', { sacrifice: -7, order: 9 }]
  ]],

  ['你在一件事上被人当成最后的依靠', [
    ['会撑住，不管多难', { sacrifice: 12, obsession: 8, light: 7 }],
    ['会撑住，但会告诉他我也有限', { sacrifice: 2, light: 7, order: 6 }],
    ['会怕，会想退', { sacrifice: -9, light: -4 }]
  ]],

  ['你在一场需要有人垫底的比赛里', [
    ['我垫，你们往上走', { sacrifice: 13, light: 8, bond: 7 }],
    ['一起想办法，不垫任何人', { sacrifice: -8, bond: 9, order: 6 }],
    ['看谁最合适垫', { sacrifice: -4, order: 9 }]
  ]],

  ['你有一个机会，但需要另一个人的机会作为代价', [
    ['不要，我拿不下这个心', { sacrifice: -5, light: 10, mercy: 9 }],
    ['要，机会本来就该抢', { sacrifice: 6, obsession: 10, light: -8 }],
    ['先看看有没有两全的办法', { sacrifice: -6, order: 10, light: 6 }]
  ]],

  ['你在一件事上已经透支了身体', [
    ['还能撑，先做完', { sacrifice: 13, obsession: 11 }],
    ['会立刻停下来', { sacrifice: -12, order: 9 }],
    ['会减量，但不完全停', { sacrifice: 2, order: 8 }]
  ]],

  ['你的朋友做了一件很冒险的事，你想拦他', [
    ['会陪他一起，这样至少有人兜着', { sacrifice: 12, bond: 10, light: 7 }],
    ['会拦到底', { sacrifice: 3, order: 10, light: 6 }],
    ['会劝一句，然后尊重他', { sacrifice: -5, light: 6 }]
  ]],

  ['你有没有想过自己会怎么结束', [
    ['想过，最好是燃到最后一刻', { sacrifice: 13, passion: 9, fate: 7 }],
    ['想过，最好是安安静静地走', { sacrifice: -9, light: 5 }],
    ['没想过，太远了', { sacrifice: -4, light: 3 }]
  ]],

  ['你在一件事上被人说"你太不爱惜自己了"', [
    ['认，我不太在意这个', { sacrifice: 12, light: 5 }],
    ['不认，我只是分得清轻重', { sacrifice: 4, order: 8 }],
    ['会想一想', { sacrifice: -5, light: 6 }]
  ]],

  ['你在一场灾难面前', [
    ['会冲进去', { sacrifice: 14, passion: 12, light: 8 }],
    ['会先确保自己的安全', { sacrifice: -10, order: 11 }],
    ['会去帮忙，但按指挥来', { sacrifice: 3, order: 10, light: 6 }]
  ]],

  ['你在一件事上需要"垫上自己的名声"', [
    ['垫，名声没那么重要', { sacrifice: 12, light: 7, order: -4 }],
    ['不垫，名声是我攒的', { sacrifice: -9, order: 9 }],
    ['会用别的方式换', { sacrifice: -2, order: 8 }]
  ]],

  ['你在一个需要有人承担责任的场合', [
    ['我来担', { sacrifice: 12, order: 9, light: 8 }],
    ['谁做的谁担', { sacrifice: -8, order: 11 }],
    ['一起担', { sacrifice: 2, bond: 9, order: 6 }]
  ]],

  ['你有没有一个"愿意为它去死"的东西', [
    ['有', { sacrifice: 14, obsession: 12, fate: 8 }],
    ['没有，活着最重要', { sacrifice: -13, order: 8 }],
    ['以前有，现在不确定', { sacrifice: 3, light: 4 }]
  ]],

  ['你在一件事上被人说"你太拼了，会没命的"', [
    ['那也没关系', { sacrifice: 13, obsession: 11 }],
    ['会停下来想一想', { sacrifice: -8, light: 6, order: 7 }],
    ['会嘴上答应，继续做', { sacrifice: 8, obsession: 9, light: -3 }]
  ]],

  ['你的一个朋友总把麻烦丢给你', [
    ['接，他大概也没别人了', { sacrifice: 11, light: 7, bond: 6 }],
    ['会拒绝，我的精力也有限', { sacrifice: -11, order: 9 }],
    ['会接，但会跟他说清楚', { sacrifice: 2, order: 8, light: 5 }]
  ]],

  ['你在一件事上被人救过一次', [
    ['会一直想着要还', { sacrifice: 10, obsession: 10, light: 6 }],
    ['会谢过就好', { sacrifice: -5, light: 5 }],
    ['会把这份心传下去', { sacrifice: 8, light: 10, bond: 7 }]
  ]],

  ['你在一个需要"断后"的时刻', [
    ['我来断后，你们走', { sacrifice: 14, light: 8, bond: 7 }],
    ['一起走，不留下任何人', { sacrifice: -6, bond: 11, light: 7 }],
    ['看谁跑得最慢', { sacrifice: -3, order: 8 }]
  ]],

  ['你在一件事上被人说"你太惯着他了"', [
    ['认，我乐意', { sacrifice: 10, light: 7, mercy: 6 }],
    ['不认，我只是在帮他', { sacrifice: 4, light: 5 }],
    ['会想一想是不是过了', { sacrifice: -4, order: 7 }]
  ]],

  ['你在一个需要"先救谁"的时刻', [
    ['先救离我最近的', { sacrifice: 3, passion: 9 }],
    ['先救最需要救的', { sacrifice: -2, order: 9 }],
    ['先救我最在乎的', { sacrifice: 5, bond: 10, light: -4 }]
  ]],

  ['你在一件事上长期付出，但从没人要求你这么做', [
    ['继续，我愿意', { sacrifice: 12, light: 9, obsession: 7 }],
    ['会停下来问自己为什么', { sacrifice: -7, light: 5, order: 7 }],
    ['会继续，但会让人觉得我知道', { sacrifice: 3, obsession: 6, light: -3 }]
  ]],

  ['你有没有一次是"用自己换别人"的', [
    ['有，而且不后悔', { sacrifice: 13, light: 9 }],
    ['有，但后悔过', { sacrifice: 5, light: 4, obsession: 6 }],
    ['没有', { sacrifice: -8, light: 3 }]
  ]],

  ['你在一件事上被人说"你太不值了"', [
    ['值不值我自己知道', { sacrifice: 11, obsession: 8, light: 5 }],
    ['会想他是不是说得对', { sacrifice: -6, light: 6 }],
    ['会有点动摇', { sacrifice: 2, light: 3 }]
  ]],

  ['你在一个需要"交出自己"的场合', [
    ['会交出去', { sacrifice: 13, fate: 8, obsession: 8 }],
    ['会留一部分给自己', { sacrifice: -9, order: 10 }],
    ['会看对方配不配', { sacrifice: 2, order: 8, light: 4 }]
  ]],

  ['你在一件事上被人说"你太容易心软了"', [
    ['认，我见不得别人难', { sacrifice: 11, light: 8, mercy: 8 }],
    ['不认，我只是有分寸', { order: 8 }],
    ['会试着硬一点', { sacrifice: -5, light: 4, mercy: -5 }]
  ]],

  ['你在一个需要"背下来"的时刻', [
    ['背，别人背不动', { sacrifice: 13, light: 8, order: 7 }],
    ['不背，大家一起想办法', { sacrifice: -7, bond: 9, order: 6 }],
    ['背一半', { sacrifice: 2, light: 5 }]
  ]],

  ['你在一件事上被人说"你把他惯坏了"', [
    ['也许吧，但我不后悔', { sacrifice: 9, light: 6, obsession: 6 }],
    ['会反省', { sacrifice: -5, order: 8, light: 5 }],
    ['不认，是他自己的问题', { sacrifice: -8, light: -3 }]
  ]],

  ['你有没有一次"明知道会输还是上了"', [
    ['有，输得很惨也不后悔', { sacrifice: 13, obsession: 12, passion: 9 }],
    ['没有，我不打没把握的仗', { sacrifice: -11, order: 11 }],
    ['有，但下一次不会了', { sacrifice: 4, order: 7 }]
  ]],

  ['你在一件事上需要"放弃自己的部分"', [
    ['放弃，事更重要', { sacrifice: 11, order: 8, light: 6 }],
    ['不放弃，那也是我', { sacrifice: -9, obsession: 10 }],
    ['会先弄清楚要放弃多少', { sacrifice: -2, order: 9 }]
  ]],

  ['你在一件事上被人说"你太撑了"', [
    ['撑得住', { sacrifice: 12, obsession: 10 }],
    ['撑不住了，我会说', { sacrifice: -6, light: 7 }],
    ['会撑，但不让人看出来', { sacrifice: 8, light: 4, obsession: 7 }]
  ]],

  ['你在一个需要"牺牲一个人的利益"的场合', [
    ['牺牲我的', { sacrifice: 13, light: 9 }],
    ['会找那个人商量', { sacrifice: -3, light: 8, order: 8 }],
    ['会按最合理的方案来', { sacrifice: -7, order: 11 }]
  ]],

  ['你在一件事上被人说你"不懂得拒绝"', [
    ['认，拒绝比答应难', { sacrifice: 10, light: 7 }],
    ['不认，我也拒绝过', { sacrifice: -2, order: 8 }],
    ['认，而且想改', { sacrifice: 2, light: 6, order: 6 }]
  ]],

  ['你有没有一个"只要他需要我就在"的人', [
    ['有', { sacrifice: 13, bond: 12, light: 7 }],
    ['没有，我对谁都一样', { sacrifice: -4, light: 5 }],
    ['有，但我不敢让他知道', { sacrifice: 9, obsession: 7, light: 4 }]
  ]],

  ['你在一个需要"顶上去"的时刻', [
    ['会立刻顶上去', { sacrifice: 13, passion: 10, light: 7 }],
    ['会先看有没有更好的人选', { sacrifice: -4, order: 10 }],
    ['会顶，但会留一点力气', { sacrifice: -2, order: 8 }]
  ]],

  ['你在一件事上被人说"你太善良了"（带点讽刺）', [
    ['那我还是这样', { sacrifice: 9, light: 11, obsession: 5 }],
    ['会想一想他说得对不对', { sacrifice: -4, light: 6 }],
    ['会收一点', { sacrifice: -6, light: 3, mercy: -4 }]
  ]],

  ['你在一个需要"把最后一点给他"的场合', [
    ['会给', { sacrifice: 14, light: 10 }],
    ['会留一点给自己', { sacrifice: -7, order: 9 }],
    ['会看他是谁', { sacrifice: 2, light: 6, bond: 6 }]
  ]],

  ['你在一件事上被人说"你不心疼自己"', [
    ['不太心疼', { sacrifice: 11, light: 4 }],
    ['心疼，所以我会算', { sacrifice: -8, order: 10 }],
    ['以前不心疼，现在在学着心疼', { light: 6 }]
  ]],

  ['你在一个需要"有人留下来"的场合', [
    ['我留', { sacrifice: 14, light: 8, fate: 6 }],
    ['大家定个规矩来选', { sacrifice: -6, order: 11 }],
    ['谁最合适谁留', { sacrifice: -3, order: 10, light: 4 }]
  ]],

  ['你在一件事上被人说"你迟早会累垮"', [
    ['那也是我自己的选择', { sacrifice: 12, obsession: 9 }],
    ['会提前安排休息', { sacrifice: -8, order: 10 }],
    ['会调整节奏', { sacrifice: -3, order: 8, light: 4 }]
  ]],

  ['你有没有一次是"为了别人放弃自己的机会"', [
    ['有，而且我觉得值', { sacrifice: 13, light: 10 }],
    ['有，但心里一直有点别扭', { sacrifice: 6, obsession: 8, light: 3 }],
    ['没有，我做不到', { sacrifice: -7, obsession: 6, light: -3 }]
  ]],

  ['你在一件事上需要"赌上健康"', [
    ['赌，身体还能再养', { sacrifice: 13, obsession: 10 }],
    ['不赌，健康没了就没了', { sacrifice: -12, order: 10 }],
    ['只赌一段时间，会给自己定期限', { sacrifice: 2, order: 9 }]
  ]],

  ['你在一件事上被人说"你对别人比对自己好"', [
    ['认，习惯了', { sacrifice: 12, light: 9, mercy: 7 }],
    ['不认，我对自己也不差', { sacrifice: -4, light: 4 }],
    ['认，但我在改', { sacrifice: 2, light: 7 }]
  ]],

  ['你在一个需要"替人挨一下"的场合', [
    ['会替他挨', { sacrifice: 13, light: 9, bond: 8 }],
    ['不会，那是他的事', { sacrifice: -10, order: 8 }],
    ['会先问清楚为什么要挨', { sacrifice: -5, order: 10 }]
  ]],

  ['你在一件事上被人说"你活得太累了"', [
    ['累，但这就是我', { sacrifice: 10, obsession: 8 }],
    ['会想改', { sacrifice: -6, light: 6 }],
    ['会不接这个话', { order: 5 }]
  ]],

  ['你在一个需要"用掉自己的积蓄"的时刻', [
    ['用，钱是该用的时候用', { sacrifice: 11, light: 8, order: -6 }],
    ['会先算清楚还剩多少', { sacrifice: -9, order: 11 }],
    ['会分几次用', { sacrifice: -2, order: 8 }]
  ]],

  ['你有没有一件事是"就算没人知道我也会做"的', [
    ['有', { sacrifice: 12, light: 10, obsession: 8 }],
    ['没有，没人知道我大概就不做了', { sacrifice: -10, light: -3 }],
    ['有过，后来不做了', { sacrifice: -2, light: 3 }]
  ]],

  ['你在一件事上被人说"你太容易心软"', [
    ['认，见不得人难受', { sacrifice: 10, light: 9, mercy: 8 }],
    ['不认，我也硬过', { sacrifice: -3, order: 7 }],
    ['认，而且不想改', { sacrifice: 8, light: 8, obsession: 5 }]
  ]],

  ['你在一个需要"扛下来"的时刻', [
    ['扛，不用别人分担', { sacrifice: 13, bond: -6, obsession: 9 }],
    ['会开口求助', { sacrifice: -8, bond: 10, light: 6 }],
    ['会先扛一段，撑不住再说', { sacrifice: 6, obsession: 7 }]
  ]],

  ['你在一件事上被人说"你不该这样"', [
    ['会想他为什么这么说', { sacrifice: -3, light: 6, order: 6 }],
    ['不改，我知道我在做什么', { sacrifice: 9, obsession: 10 }],
    ['会改一点', { sacrifice: -4, light: 5 }]
  ]],

  ['你有没有一个"随时可以为他挡一次"的人', [
    ['有，而且不止一个', { sacrifice: 13, light: 10, bond: 10 }],
    ['没有，我不会为谁做到那个程度', { sacrifice: -11, order: 7 }],
    ['有一个', { sacrifice: 11, bond: 10 }]
  ]],

  ['你在一件事上被人说"你太不爱争了"', [
    ['不争有不争的好', { sacrifice: -3, light: 6, order: 5 }],
    ['该争的时候我会争', { sacrifice: -6, order: 10 }],
    ['是，我总把机会让出去', { sacrifice: 10, light: 8 }]
  ]],

  ['你在一个需要"最后一个人走"的场合', [
    ['我最后走', { sacrifice: 13, order: 9, light: 7 }],
    ['一起走', { sacrifice: -5, bond: 9 }],
    ['按顺序走', { sacrifice: -4, order: 10 }]
  ]],

  ['你在一件事上被人说"你不为自己想"', [
    ['不太想', { sacrifice: 11, light: 5 }],
    ['想，我只是排在后面', { sacrifice: 8, light: 7, order: 5 }],
    ['会开始为自己想', { sacrifice: -8, order: 8, light: 4 }]
  ]],

  ['你在一件事上需要"把自己搭进去"', [
    ['搭，这是我的选择', { sacrifice: 14, obsession: 10, fate: 6 }],
    ['不搭，我要留着自己', { sacrifice: -13, order: 9 }],
    ['搭一部分', { sacrifice: 2, order: 7 }]
  ]],

  ['你在一个人面前会不自觉地想护着他', [
    ['会，而且很明显', { sacrifice: 11, light: 9, bond: 9 }],
    ['不会，我不太会照顾人', { sacrifice: -6, light: 3 }],
    ['会，但不会让他知道', { sacrifice: 8, light: 7, obsession: 5 }]
  ]]
];
