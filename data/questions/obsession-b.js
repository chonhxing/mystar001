/**
 * 「执念与随性」轴 · 第二批。
 * 场景偏"放手的能力"：结束、告别、放弃、以及什么时候该停。
 */

module.exports = [
  ['你在一件已经失败的事上又看到一线希望', [
    ['会立刻扑上去', { obsession: 13, passion: 8 }],
    ['会先看清楚那是不是幻觉', { obsession: -5, order: 10 }],
    ['算了，我不想再来一次', { obsession: -10, light: 4 }]
  ]],

  ['你的一位朋友做了件让你很介意的小事', [
    ['会记很久', { obsession: 11, light: -4 }],
    ['当场就过去了', { obsession: -10, light: 6 }],
    ['会想他是不是有意的', { obsession: 7, order: 5 }]
  ]],

  ['你在一个需要"翻篇"的场合', [
    ['翻不了，我会一直翻回来', { obsession: 12, light: -3 }],
    ['能翻，而且翻得很快', { obsession: -12, light: 5 }],
    ['能翻，但需要点时间', { obsession: -2, light: 5 }]
  ]],

  ['你有没有一件事，只要别人一提你就会变脸', [
    ['有', { obsession: 13, light: -5, mercy: -5 }],
    ['没有，什么都能聊', { obsession: -11, light: 7 }],
    ['有，但我会忍住', { obsession: 8, order: 6 }]
  ]],

  ['你在一件事上被人说"你还没走出来"', [
    ['认，可能真没有', { obsession: 12, light: -3 }],
    ['不认，我早走出来了', { obsession: -6, light: 6 }],
    ['不知道', { obsession: 3, light: 3 }]
  ]],

  ['你在一件事上被人反复提起，你每次都要重新经历一遍', [
    ['会很难受，但会配合地聊', { obsession: 9, light: 5, mercy: 6 }],
    ['会直接说：这事我不想聊', { obsession: 5, order: 9, light: 4 }],
    ['真的已经不在意了', { obsession: -8, light: 6 }]
  ]],

  ['你更愿意做哪一种人', [
    ['一个守着一样东西的人', { obsession: 13, order: 7 }],
    ['一个什么都能放手的人', { obsession: -13, light: 4 }],
    ['一个知道什么值得守的人', { obsession: 3, order: 10 }]
  ]],

  ['你在一个需要"选一个"的场合', [
    ['会反复比较，怕选错', { obsession: 10, order: 8 }],
    ['随便选一个', { obsession: -9, passion: 6 }],
    ['看哪个更想要', { obsession: 3, light: 5 }]
  ]],

  ['你有没有一个"再也不会做"的事', [
    ['有，一次就够', { obsession: 10, light: -4 }],
    ['没有，什么都可以再来', { obsession: -11, light: 5 }],
    ['有，但我不确定真的不会', { obsession: 5, light: 3 }]
  ]],

  ['你在一件事上被人伤害之后还继续做同样的事', [
    ['会继续，因为那件事本身没错', { obsession: 11, order: 8 }],
    ['不会了，换个方向', { obsession: -8, order: 6 }],
    ['会继续，但心里有点怕', { obsession: 6, light: 5 }]
  ]],

  ['你在一个需要"停"的时刻', [
    ['停不下来', { obsession: 13, sacrifice: 8 }],
    ['会立刻停', { obsession: -11, order: 10 }],
    ['会先看看还有多远', { obsession: 4, order: 7 }]
  ]],

  ['你在一件事上被人说"你太重感情了"', [
    ['认，改不了', { obsession: 11, light: 6, bond: 6 }],
    ['不认，我只是记性好', { obsession: 5, order: 5 }],
    ['会觉得这不算缺点', { obsession: 7, light: 6 }]
  ]],

  ['你有没有一个"一直没做完"的东西', [
    ['有，可能这辈子都不会做完', { obsession: 12, light: 5 }],
    ['没有，我做事有始有终', { obsession: 4, order: 10 }],
    ['有，已经不打算做了', { obsession: 2, light: 4 }]
  ]],

  ['你在一件事上被人否定之后', [
    ['会想很久他说的话', { obsession: 11, light: -4 }],
    ['会当场就不服', { obsession: 8, passion: 9 }],
    ['会听进去，然后改', { obsession: -5, order: 9, light: 5 }]
  ]],

  ['你在一个人离开之后', [
    ['会一直保留他留下的习惯', { obsession: 11, light: 6, bond: 6 }],
    ['会尽快恢复正常', { obsession: -9, order: 7 }],
    ['会有一段时间不适应', { obsession: 3, light: 4 }]
  ]],

  ['你有没有一个"永远达不到"的标准', [
    ['有，我知道达不到，但还是要', { obsession: 13, order: 8 }],
    ['没有，我的标准都很实际', { obsession: -9, order: 9 }],
    ['有，但已经放松了一点', { obsession: 4, light: 5 }]
  ]],

  ['你在一件事上被人说"你太拼了"', [
    ['不拼就没有', { obsession: 12, sacrifice: 10 }],
    ['会放慢一点', { obsession: -6, light: 6 }],
    ['会说不拼对不起自己', { obsession: 10, light: 4 }]
  ]],

  ['你在一段关系里付出很多，对方却觉得理所当然', [
    ['会继续，我认了', { obsession: 10, sacrifice: 9, light: 5 }],
    ['会停止付出', { obsession: -5, light: -4, bond: -7 }],
    ['会说清楚我的感受', { obsession: 3, light: 7, order: 7 }]
  ]],

  ['你在一个需要"原谅自己"的时刻', [
    ['做不到', { obsession: 13, light: -5 }],
    ['能做到', { obsession: -10, light: 8 }],
    ['在做，但很慢', { obsession: 6, light: 5 }]
  ]],

  ['你有没有一个"早就该删但没删"的联系人', [
    ['有', { obsession: 11, light: 4 }],
    ['没有，我删得很干净', { obsession: -10, order: 7 }],
    ['有，但我从不点开', { obsession: 5, light: 3 }]
  ]],

  ['你在一个需要"承认失败"的时刻', [
    ['会承认，但心里不服', { obsession: 9 }],
    ['会承认，并且真的放下', { obsession: -10, light: 7 }],
    ['不会承认', { obsession: 11, light: -4 }]
  ]],

  ['你在一件事上被人说"你太固执了"', [
    ['认，改不了', { obsession: 12, order: 7 }],
    ['不认，我只是有原则', { obsession: 7, order: 10 }],
    ['会想想是不是该让一步', { obsession: -6, light: 6 }]
  ]],

  ['你在一个人生的交叉口', [
    ['会一直回头看那条没走的路', { obsession: 12, light: -4 }],
    ['只往前看', { obsession: -10, order: 8 }],
    ['偶尔回头，但不后悔', { obsession: 2, light: 5 }]
  ]],

  ['你有没有一个"一直想联系但一直没联系"的人', [
    ['有，而且想了很多次', { obsession: 12, light: 4, bond: 6 }],
    ['没有', { obsession: -9, bond: -5 }],
    ['有，但已经不想联系了', { obsession: 3, light: 4 }]
  ]],

  ['你在一件事上被人说你"过不去"', [
    ['是，我就是过不去', { obsession: 13, light: -4 }],
    ['不，我早过去了', { obsession: -8, light: 7 }],
    ['我不知道算不算过去了', { obsession: 4, light: 4 }]
  ]],

  ['你在一个需要"忘掉"的场合', [
    ['忘不掉', { obsession: 12, light: -3 }],
    ['能忘，记性一般', { obsession: -10, order: -4 }],
    ['会选择性记住好的部分', { obsession: 3, light: 7 }]
  ]],

  ['你在一件事上被人拿走了一个属于你的东西', [
    ['会一直记着这件事', { obsession: 12, light: -4, order: 6 }],
    ['会算了', { obsession: -10, light: 5 }],
    ['会找机会拿回来', { obsession: 10, passion: 8 }]
  ]],

  ['你有没有一个"不想让任何人知道"的执念', [
    ['有', { obsession: 13, light: 4, bond: -4 }],
    ['没有，我的事都很明白', { obsession: -8, light: 6 }],
    ['有，但不太算执念', { obsession: 5, light: 3 }]
  ]],

  ['你在一个需要"从头再来"的时刻', [
    ['不愿意，之前的都白费了', { obsession: 11, order: 6 }],
    ['愿意，反正也没什么损失', { obsession: -10, light: 5 }],
    ['愿意，但会带着之前的经验', { obsession: 2, order: 8 }]
  ]],

  ['你在一件事上被人说"你太不容易满足了"', [
    ['是，永远觉得不够', { obsession: 12, order: 7 }],
    ['不是，我很容易满足', { obsession: -10, light: 6 }],
    ['看是什么事', { light: 4 }]
  ]],

  ['你更愿意承受哪一种', [
    ['追不到', { obsession: 12, sacrifice: 7 }],
    ['没追过', { obsession: -6, light: 5 }],
    ['追到了发现不是想要的', { obsession: 5, light: 3 }]
  ]],

  ['你在一件事上被人说"你变了"', [
    ['认，我在往前走', { obsession: -7, light: 6 }],
    ['不认，我没变', { obsession: 10, order: 7 }],
    ['会想他说的是哪个变', { obsession: 4, light: 5 }]
  ]],

  ['你有没有一个"想起来还会脸红"的瞬间', [
    ['有，而且很清晰', { obsession: 11, light: -3 }],
    ['有，但已经能笑着说了', { obsession: 2, light: 6 }],
    ['很少有这种时候', { obsession: -7, light: 4 }]
  ]],

  ['你在一个需要"把东西还回去"的场合', [
    ['会留一样东西不还', { obsession: 10, light: 3 }],
    ['会全部还清', { obsession: -8, order: 11 }],
    ['会还，但会说明理由', { obsession: 2, order: 8 }]
  ]],

  ['你在一件事上被人说你"太用力了"', [
    ['认，我确实用力', { obsession: 11, sacrifice: 8 }],
    ['不认，我只是认真', { obsession: 7, order: 8 }],
    ['会调整一下', { obsession: -5, light: 6 }]
  ]],

  ['你有没有一个"一直没敢打开"的东西', [
    ['有，可能是消息、照片或者文件', { obsession: 12, light: -4 }],
    ['没有，我什么都敢看', { obsession: -8, passion: 6 }],
    ['有，但已经快忘了', { obsession: 3, light: 4 }]
  ]],

  ['你在一个需要"承认自己错了"的场合', [
    ['会承认，然后一直记着', { obsession: 10, light: 6, order: 8 }],
    ['会承认，然后翻篇', { obsession: -8, light: 7 }],
    ['会不承认', { obsession: 9, light: -6 }]
  ]],

  ['你在一件事上被人说了很难听的话，你还会再理他吗', [
    ['会，我不想把关系断了', { obsession: 8, light: 6, bond: 7 }],
    ['不会', { obsession: -6, light: 3, bond: -8 }],
    ['看他还说不说', { obsession: 3, order: 7 }]
  ]],

  ['你有没有一件事是"说了也没人懂"的', [
    ['有，所以我很少说', { obsession: 10, bond: -6, light: 3 }],
    ['没有，我都说得清', { obsession: -7, light: 5 }],
    ['有，但我在试着说', { obsession: 5, bond: 6, light: 5 }]
  ]],

  ['你在一个需要"就这样吧"的时刻', [
    ['说不出口', { obsession: 12, light: -3 }],
    ['能说，而且说完真的就放下了', { obsession: -12, light: 7 }],
    ['会说，但心里没放下', { obsession: 7, light: -3 }]
  ]],

  ['你在一件事上被人说"你太记仇了"', [
    ['认，我记得很清楚', { obsession: 12, mercy: -7 }],
    ['不认，我早忘了', { obsession: -9, light: 7 }],
    ['会说：我记的是事不是仇', { obsession: 6, order: 7 }]
  ]],

  ['你有没有一个"再也不想见到"的人', [
    ['有', { obsession: 11, light: -4, mercy: -6 }],
    ['没有，谁都能见', { obsession: -9, light: 7 }],
    ['有，但见到了也不会怎样', { obsession: 3, light: 5 }]
  ]],

  ['你在一个需要"重新认识一个人"的时刻', [
    ['很难，我记着以前的印象', { obsession: 9, order: 6 }],
    ['能，人都会变', { obsession: -8, light: 7 }],
    ['看情况', { light: 4 }]
  ]],

  ['你在一件事上被人说你"想得太细了"', [
    ['是，细是我的习惯', { obsession: 9, order: 10 }],
    ['不是，我只是不想出错', { obsession: 5, order: 9 }],
    ['是，我在放松一点', { obsession: -3, light: 6 }]
  ]],

  ['你有没有一个"不打算再提"的计划', [
    ['有，收起来了', { obsession: 8, light: 4 }],
    ['没有，我从来不收计划', { obsession: 4, order: 7 }],
    ['有，但我知道有一天会重新拿出来', { obsession: 10, light: 5 }]
  ]],

  ['你在一个需要"接受"的时刻', [
    ['会挣扎很久才接受', { obsession: 10, light: 4 }],
    ['会很快接受', { obsession: -9, order: 8 }],
    ['会接受但不会认同', { obsession: 5, order: 7, light: -3 }]
  ]],

  ['你在一件事上被人说"你不肯放过自己"', [
    ['认，我就是不肯', { obsession: 13, light: -4 }],
    ['不认，我早放过了', { obsession: -6, light: 6 }],
    ['会想一想', { obsession: 4, light: 5 }]
  ]],

  ['你有没有一个"一直放在心里"的约定', [
    ['有，哪怕对方忘了', { obsession: 13, light: 6, bond: 7 }],
    ['没有，约定就是约定，过了就过了', { obsession: -9, order: 7 }],
    ['有，但不确定还算不算', { obsession: 6, light: 4 }]
  ]],

  ['你在一个需要"说再见"的场合', [
    ['会说得很慢', { obsession: 10, light: 6, bond: 6 }],
    ['说完就走，不回头', { obsession: -8, order: 8 }],
    ['会找借口晚一点说', { obsession: 7, light: -3 }]
  ]],

  ['你在一件事上被人说你"太较劲了"', [
    ['认，我是在跟自己较劲', { obsession: 12, order: 7 }],
    ['不认，我只是想把事做对', { obsession: 6, order: 10 }],
    ['会停下来想一想', { obsession: -4, light: 6 }]
  ]],

  ['你有没有一个"只在自己心里成立"的目标', [
    ['有，没跟任何人说过', { obsession: 11, light: 5 }],
    ['没有，我的目标都说得出', { obsession: -7, bond: 5 }],
    ['有，说过一次没被当真', { obsession: 8, light: 4 }]
  ]],

  ['你在一个需要"放下身段"的时刻', [
    ['放得下，尊严没那么贵', { obsession: -8, order: 8, light: 5 }],
    ['放不下', { obsession: 11, order: 7 }],
    ['放得下，但会记着这一刻', { obsession: 6, light: 4 }]
  ]],

  ['你在一件事上被人说"你没什么放不下的"', [
    ['认，我确实什么都能放', { obsession: -12, light: 5 }],
    ['不认，我只是不说', { obsession: 10, light: 4 }],
    ['不知道', { obsession: 2, light: 3 }]
  ]],

  ['你更愿意做哪一种选择', [
    ['守着一个可能永远没有结果的事', { obsession: 13, sacrifice: 8 }],
    ['换一件马上能有结果的事', { obsession: -9, order: 8 }],
    ['两件都做', { obsession: 6, sacrifice: 9 }]
  ]],

  ['你在一个需要"承认自己在意"的时刻', [
    ['会承认', { obsession: 9, light: 7 }],
    ['不会承认', { obsession: 11, light: -4 }],
    ['会绕过去', { obsession: 4, light: 2 }]
  ]],

  ['你有没有一个"每次听都会停下来"的歌', [
    ['有，而且不敢多听', { obsession: 12, light: 5 }],
    ['没有，音乐就是音乐', { obsession: -8, light: 3 }],
    ['有，但已经能正常听了', { obsession: 3, light: 5 }]
  ]],

  ['你在一件事上被人说你"太认真了"，而那是件小事', [
    ['认，我连小事也认真', { obsession: 10, order: 10 }],
    ['不认，小事不值得认真', { obsession: -6, order: -5 }],
    ['会想自己是不是该松一点', { obsession: -2, light: 6 }]
  ]],

  ['你在一个需要"把话咽回去"的场合', [
    ['咽不回去，会说出来', { obsession: 8, passion: 9, light: -3 }],
    ['能咽回去', { obsession: 6, order: 9 }],
    ['会咽，然后记很久', { obsession: 11, light: -3 }]
  ]]
];
