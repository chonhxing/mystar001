/**
 * 「执念与随性」轴 · 第一批。
 *
 * 执念 = 不放手、追到底、记住、非做不可
 * 随性 = 放下、随风、不抓着、走到哪算哪
 */

module.exports = [
  ['有一件事你明明已经放弃了，但还会偶尔想起', [
    ['会，而且一想就难受', { obsession: 13, light: -4 }],
    ['会想起来，但已经没什么感觉了', { obsession: -8, light: 5 }],
    ['几乎不会想起来', { obsession: -12, order: 5 }]
  ]],

  ['有人欠你一句道歉，你已经等了很久', [
    ['会一直等，我需要那句话', { obsession: 13, order: 6 }],
    ['不等了，我自己翻篇', { obsession: -12, light: 6 }],
    ['不等了，但我记着这件事', { obsession: 5, light: -3 }]
  ]],

  ['你在做一件事的时候被人打断，你会', [
    ['很难再回到状态', { obsession: 8, order: -5 }],
    ['能立刻再接上', { obsession: -6, order: 8 }],
    ['换个时间再做', { obsession: -3, light: 4 }]
  ]],

  ['你有一个坚持了很多年的习惯，哪怕是没用的', [
    ['有，改不掉', { obsession: 12, order: 7 }],
    ['没有，我什么都能改', { obsession: -11, order: -4 }],
    ['有，但我也说不清为什么', { obsession: 8, light: 4 }]
  ]],

  ['你被人抢了一件对你很重要的东西', [
    ['会一直想办法要回来', { obsession: 14, passion: 8 }],
    ['会难受一阵，然后就算了', { obsession: -9, light: 5 }],
    ['会换一个更好的', { obsession: -4, order: 7 }]
  ]],

  ['你更愿意做哪一种人', [
    ['记得住所有事的人', { obsession: 12, order: 6 }],
    ['什么都不放在心上的人', { obsession: -12, light: 5 }],
    ['记得住好事，忘掉坏事的人', { obsession: -2, light: 8 }]
  ]],

  ['你在一段关系结束后还会看对方的动态吗', [
    ['会，看了很久', { obsession: 13, light: -4 }],
    ['不会，删得干干净净', { obsession: -11, order: 7 }],
    ['偶尔看到，不刻意', { obsession: -2, light: 4 }]
  ]],

  ['你在一件事上被人说"你太执着了"', [
    ['认，我就是放不下', { obsession: 13, light: 3 }],
    ['不认，这叫坚持', { obsession: 9, order: 8 }],
    ['会想想是不是该放', { obsession: -5, light: 6 }]
  ]],

  ['你有没有一件"这辈子一定要做到"的事', [
    ['有，而且一直在做', { obsession: 14, fate: 9 }],
    ['有，但已经很久没碰了', { obsession: 6, light: -3 }],
    ['没有，走一步看一步', { obsession: -12, fate: -6 }]
  ]],

  ['你在一件事上被人反复拒绝', [
    ['会再试，一直试到我确定不行', { obsession: 13, passion: 8 }],
    ['试三次就不试了', { obsession: -6, order: 8 }],
    ['换个方向', { obsession: -8, order: 6, light: 4 }]
  ]],

  ['你有没有一个"如果当时"的瞬间', [
    ['有，而且经常想', { obsession: 13, light: -5 }],
    ['有，但很少想了', { obsession: 2, light: 4 }],
    ['没有，做过的事不回头', { obsession: -11, order: 7 }]
  ]],

  ['你在一件事上被人误解，而你已经解释过很多次', [
    ['会一直解释到他懂', { obsession: 12, order: 6 }],
    ['不解释了，随他去', { obsession: -10, light: 6 }],
    ['解释最后一次', { obsession: 4, order: 7 }]
  ]],

  ['你的房间里有没有一样早就该扔但你留着的东西', [
    ['有，不止一样', { obsession: 11, light: 4 }],
    ['没有，我不留没用的东西', { obsession: -10, order: 9 }],
    ['有，但我也不知道为什么留着', { obsession: 8, light: 5 }]
  ]],

  ['你在一件事上被人踩了一脚，过了很久你还记得吗', [
    ['记得，连当时穿什么都记得', { obsession: 14, light: -5 }],
    ['早忘了', { obsession: -12, light: 7 }],
    ['记得事，忘了人', { obsession: 4, light: 4 }]
  ]],

  ['你在一个需要"放手"的时刻', [
    ['放不了，我知道', { obsession: 12, sacrifice: 6 }],
    ['能放，抓着也没用', { obsession: -12, order: 8 }],
    ['会放，但会留一点', { obsession: 2, light: 4 }]
  ]],

  ['你在一件事上被人说"都过去了"', [
    ['过去是过去了，但它还在', { obsession: 12, light: -3 }],
    ['对，过去了', { obsession: -11, light: 6 }],
    ['看是什么事', { light: 4 }]
  ]],

  ['你会不会为了一个目标放弃很多东西', [
    ['会，而且已经放弃了', { obsession: 13, sacrifice: 10 }],
    ['不会，我不想为了一个东西丢掉别的', { obsession: -11, order: 8 }],
    ['会，但会算代价', { obsession: 4, order: 8 }]
  ]],

  ['你在一件事上被人超越了，而那是你曾经最擅长的', [
    ['会想练回来', { obsession: 12, passion: 8 }],
    ['会承认时代变了', { obsession: -8, order: 8 }],
    ['会有点难过，但也就这样', { light: 4 }]
  ]],

  ['你有没有一个"再也不去"的地方', [
    ['有，而且记得很清楚', { obsession: 12, light: -4 }],
    ['没有，地方就是地方', { obsession: -9, light: 4 }],
    ['有，但已经不介意了', { obsession: 2, light: 5 }]
  ]],

  ['你在做一件很久没进展的事时会', [
    ['继续做，停不下来', { obsession: 13, sacrifice: 7 }],
    ['停下来，换一件', { obsession: -9, order: 6 }],
    ['停下来歇一阵，再回来', { obsession: -3, light: 5 }]
  ]],

  ['你在一段关系里被人伤过，你还会再联系吗', [
    ['不会，我不想再经历一次', { obsession: 8, light: -5, bond: -6 }],
    ['会，如果他先开口', { obsession: 6, bond: 6 }],
    ['早就不想了', { obsession: -10, light: 5 }]
  ]],

  ['你更愿意记得还是忘掉', [
    ['记得，哪怕难受', { obsession: 13, light: 4 }],
    ['忘掉，轻松一点', { obsession: -12, light: 5 }],
    ['记得该记的', { obsession: 2, order: 8 }]
  ]],

  ['你在一个人面前说过一句很重的话，现在还能收回来吗', [
    ['会一直想这件事', { obsession: 12, light: -4 }],
    ['说出去的话收不回来，往前走吧', { obsession: -8, order: 7 }],
    ['会找机会补一句', { obsession: 5, light: 7 }]
  ]],

  ['你有没有一个"绝不原谅"的名单', [
    ['有，而且很短', { obsession: 12, mercy: -8 }],
    ['没有，我都原谅了', { obsession: -11, light: 9, mercy: 8 }],
    ['有，但我不常想起', { obsession: 5, light: 3 }]
  ]],

  ['你在一件事上被人说"你放不下"', [
    ['认，我确实放不下', { obsession: 13, light: 3 }],
    ['不认，我只是还没处理完', { obsession: 6, order: 8 }],
    ['会试着放', { obsession: -6, light: 6 }]
  ]],

  ['你会不会反复回想自己说过的一句话', [
    ['经常，尤其是说错的', { obsession: 12, light: -4 }],
    ['很少，说完就完了', { obsession: -11, passion: 5 }],
    ['只会想特别重要的那几句', { obsession: 3, order: 6 }]
  ]],

  ['你在一个需要"从零开始"的时刻', [
    ['会舍不得之前的积累', { obsession: 10, order: 5 }],
    ['不会，清零反而轻松', { obsession: -11, light: 6 }],
    ['会难受一阵', { obsession: 4, light: 4 }]
  ]],

  ['你在一件事上被人骗了钱，数目不小', [
    ['会一直追，哪怕成本更高', { obsession: 13, order: 7 }],
    ['会报警，然后交给流程', { obsession: -3, order: 12 }],
    ['会认了，钱没了还能赚', { obsession: -9, light: 6 }]
  ]],

  ['你有没有一件事，别人都觉得你该放下了', [
    ['有，但那是我的事', { obsession: 13, bond: -5 }],
    ['没有，我什么都放得下', { obsession: -12, light: 4 }],
    ['有，我也在试着放', { obsession: 5, light: 5 }]
  ]],

  ['你在深夜会不会突然想起一件很久以前的小事', [
    ['会，而且细节都记得', { obsession: 11, light: 4 }],
    ['很少，我记性不好', { obsession: -9, order: -4 }],
    ['会，但不会因此难受', { obsession: 2, light: 5 }]
  ]],

  ['你在一件事上被人说"你太较真了"', [
    ['认，较真有什么错', { obsession: 11, order: 10 }],
    ['不认，我只是不想糊弄', { obsession: 9, order: 9 }],
    ['会放松一点', { obsession: -6, light: 6 }]
  ]],

  ['你更愿意做哪一个', [
    ['一个一直在追的人', { obsession: 13, passion: 8 }],
    ['一个随时可以走的人', { obsession: -13, passion: -4 }],
    ['一个知道什么时候该停的人', { obsession: -4, order: 10 }]
  ]],

  ['你有没有一个"以后一定要去"的地方', [
    ['有，而且想过很多次要怎么去', { obsession: 11, fate: 6 }],
    ['有，但只是随便想想', { obsession: 2, light: 4 }],
    ['没有，去哪都行', { obsession: -11, fate: -5 }]
  ]],

  ['你在一件事上被人说你"想不开"', [
    ['是，我就是想不开', { obsession: 13, light: -3 }],
    ['不是，我只是不想装', { obsession: 9, light: 4 }],
    ['会想办法让自己想开', { obsession: -5, light: 7 }]
  ]],

  ['你在一个需要"重来一次"的机会面前', [
    ['会抓住，哪怕代价很大', { obsession: 12, passion: 9 }],
    ['不会，过去的就是过去了', { obsession: -11, order: 8 }],
    ['会犹豫很久', { obsession: 5, order: 5 }]
  ]],

  ['你有没有一个一直没删的备忘录', [
    ['有，里面是很久以前写的东西', { obsession: 11, light: 4 }],
    ['没有，我随手就删', { obsession: -11, order: 5 }],
    ['有，但早就不看了', { obsession: 3, light: 3 }]
  ]],

  ['你在一件事上被人说"你不累吗"', [
    ['累，但停不下来', { obsession: 13, sacrifice: 9 }],
    ['不累，我习惯了', { obsession: 9, order: 7 }],
    ['累，所以我在学着放', { obsession: -6, light: 6 }]
  ]],

  ['你在一段感情里被分手，你会', [
    ['会想很久为什么', { obsession: 13, light: -4 }],
    ['会难过，然后往前走', { obsession: -5, light: 6 }],
    ['会试着挽回', { obsession: 10, passion: 8 }]
  ]],

  ['你在做一件明知没有结果的事时会', [
    ['继续，我不需要结果', { obsession: 13, sacrifice: 8 }],
    ['停，没结果就不做', { obsession: -10, order: 10 }],
    ['做一半，看情况', { order: 5 }]
  ]],

  ['你有没有一件"只跟自己有关"的坚持', [
    ['有，而且谁都不知道', { obsession: 11, light: 5 }],
    ['没有，我的坚持都跟别人有关', { obsession: -4, bond: 8 }],
    ['有，但不太算坚持', { obsession: 3, light: 3 }]
  ]],

  ['你在一件事上被人说"你太在意了"', [
    ['是，我在意', { obsession: 12, light: 4 }],
    ['不是，只是顺手做了', { obsession: -6, light: 4 }],
    ['会想问清楚他为什么这么说', { obsession: 5, order: 6 }]
  ]],

  ['你更愿意哪一种结束方式', [
    ['把话说完再结束', { obsession: 6, order: 10 }],
    ['悄无声息地结束', { obsession: -8, light: 3 }],
    ['结束之后再回头看一眼', { obsession: 9, light: 5 }]
  ]],

  ['你在一个人生的阶段结束时会', [
    ['会怀念很久', { obsession: 11, light: 6 }],
    ['会很快投入下一个', { obsession: -10, passion: 7 }],
    ['会做个仪式感的收尾', { obsession: 5, order: 9 }]
  ]],

  ['你在一件事上被人伤过，但你还做同样的事', [
    ['会做，但会小心', { obsession: 4, order: 8 }],
    ['会做，而且不留退路', { obsession: 13, sacrifice: 10 }],
    ['不做了，一次就够', { obsession: -6, light: -4 }]
  ]],

  ['你有没有一个"从来没跟人说过"的遗憾', [
    ['有，而且很具体', { obsession: 12, light: -4 }],
    ['没有，我的事都说得出', { obsession: -8, light: 5 }],
    ['有，但已经很淡了', { obsession: 2, light: 4 }]
  ]],

  ['你在一个需要"彻底断掉"的时刻', [
    ['会断得干净', { obsession: -6, order: 11 }],
    ['会断，但留个口子', { obsession: 8, light: 4 }],
    ['断不掉', { obsession: 13, light: -4 }]
  ]],

  ['你在一件事上被人说"你太念旧了"', [
    ['认，旧的东西有旧的好', { obsession: 11, light: 6 }],
    ['不认，我只是不爱扔', { obsession: 5, order: 5 }],
    ['认，而且想改', { obsession: 2, light: 5 }]
  ]],

  ['你在深夜会不会翻自己以前的照片', [
    ['会，一翻就是一小时', { obsession: 12, light: 5 }],
    ['不会，过去的没什么好看的', { obsession: -10, light: 3 }],
    ['偶尔翻一次', { obsession: 3, light: 4 }]
  ]],

  ['你有没有一个"永远不想再提"的人', [
    ['有，谁提我跟谁急', { obsession: 12, light: -5, mercy: -6 }],
    ['没有，都能聊', { obsession: -10, light: 7 }],
    ['有，但我会假装没事', { obsession: 7, light: -3 }]
  ]],

  ['你在一个需要"松手"的场合', [
    ['手会一直握着', { obsession: 12, sacrifice: 6 }],
    ['该松就松', { obsession: -12, order: 8 }],
    ['会松一半', { obsession: 2, light: 4 }]
  ]],

  ['你在一件事上被人说"你太慢了"', [
    ['因为我还在磨那件事', { obsession: 11, order: 8 }],
    ['因为我不着急', { obsession: -7, light: 5 }],
    ['因为我方向还没想清楚', { obsession: -4, order: 9 }]
  ]],

  ['你有没有一个"不想承认但确实还在意"的人', [
    ['有，而且很在意', { obsession: 12, light: -4 }],
    ['没有，我早就过去了', { obsession: -10, light: 6 }],
    ['有，但只是偶尔', { obsession: 5, light: 4 }]
  ]],

  ['你在一件事上被人拿走了一个机会', [
    ['会一直想着那个机会', { obsession: 12, light: -4 }],
    ['会想还有别的机会', { obsession: -8, light: 6 }],
    ['会去问清楚为什么不是我', { obsession: 6, order: 8 }]
  ]],

  ['你更愿意相信哪一种说法', [
    ['念念不忘，必有回响', { obsession: 14, fate: 9 }],
    ['放下才是真的开始', { obsession: -13, light: 7 }],
    ['想就想，不想就不想', { obsession: -4, light: 4 }]
  ]],

  ['你在一件事上被人说"你想得太多了"', [
    ['是，我控制不住', { obsession: 12, light: -3 }],
    ['不是，我只是想得细', { obsession: 5, order: 9 }],
    ['是，我在改', { obsession: 3, light: 6 }]
  ]],

  ['你在一个需要"重新相信"的时刻', [
    ['会很难，但我愿意', { obsession: 4, light: 8, fate: 5 }],
    ['会很难，我不想', { obsession: 6, light: -5 }],
    ['不难，我本来就没不信过', { obsession: -6, light: 8 }]
  ]],

  ['你有没有一件事，只要想起来就会停下来', [
    ['有，会停顿几秒', { obsession: 11, light: 4 }],
    ['没有', { obsession: -9, light: 3 }],
    ['有，但已经很轻了', { obsession: 3, light: 5 }]
  ]]
];
