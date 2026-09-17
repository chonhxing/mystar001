/**
 * 跨轴多选题 · 第一批（最多勾 3 项）。
 *
 * 多选题的选项是"可以同时成立"的清单，不是互斥的选项。
 * 勾几个都算，命中越多权重越高 —— 最终取所选各项增量的**平均**（见 core/quiz.js），
 * 所以增量可以按单选那样写，不会因为多勾几个就把图谱顶飞。
 *
 * 备注里的 `multi` 是勾选上限：`{ multi: 3 }` = 最多 3 项，
 * `{ multi: [2, 3] }` = 至少 2 项最多 3 项。选项数量本身也可以是 4~6 个。
 */

module.exports = [
  ['深夜让你睡不着的，通常是下面哪些事', [
    ['一件我还没做完的事', { obsession: 11, order: 6 }],
    ['一句我说错的话', { light: -3, obsession: 10 }],
    ['一个我没能留住的人', { obsession: 10, bond: 7 }],
    ['明天要做的事', { order: 9, passion: -6 }],
    ['其实也没什么，就是睡不着', { light: 4, passion: -3 }]
  ], { multi: 3 }],

  ['你身上有哪些是别人不太知道的', [
    ['我比看起来在意得多', { light: 6, obsession: 8, bond: 6 }],
    ['我其实很怕一个人', { bond: 9, light: 4 }],
    ['我有时候会想干脆全都不要了', { obsession: -7, light: -5 }],
    ['我一直在忍某件事', { sacrifice: 8, obsession: 6 }],
    ['我其实没那么多想法，就是随性', { obsession: -9, light: 5 }]
  ], { multi: 3 }],

  ['下面哪些会让你立刻想退出一个群', [
    ['有人一直在阴阳怪气', { light: -5, order: 5, bond: -5 }],
    ['刷屏的广告和砍价链接', { order: 8, light: -3 }],
    ['每天都在抱怨同一件事', { obsession: -4, light: -4 }],
    ['有人在带节奏骂一个具体的人', { light: 7, order: 5 }],
    ['只有几个人在说话，其他人都是背景', { bond: -6, light: 4 }]
  ], { multi: 3 }],

  ['你最受不了自己的哪几点', [
    ['想太多', { obsession: 9, light: -3 }],
    ['狠不下心', { mercy: 9, light: 6 }],
    ['拖到最后一刻', { order: -9, passion: 5 }],
    ['嘴硬心软', { mercy: 6, order: 5 }],
    ['什么都自己扛', { sacrifice: 9, bond: -7 }]
  ], { multi: 3 }],

  ['什么事情会让你觉得自己被理解了', [
    ['他没说什么，但记得我说过的小事', { bond: 9, light: 7 }],
    ['他直接说出了我没说出口的那句', { bond: 8, light: 8 }],
    ['他什么都没问，只是陪着', { bond: 10, light: 7 }],
    ['他跟我一起骂', { bond: 7, passion: 7 }],
    ['他给了我很具体的建议', { order: 8, light: 4 }]
  ], { multi: 3 }],

  ['下面哪些是你真正在意的东西', [
    ['有人记得我', { bond: 10, light: 6 }],
    ['把事情做对', { order: 11 }],
    ['守住我自己那点东西', { obsession: 9, order: 6 }],
    ['身边的人过得好', { light: 9, bond: 8, mercy: 7 }],
    ['活得久一点，看更多', { sacrifice: -8, fate: 5 }]
  ], { multi: 3 }],

  ['你会因为哪些事对一个人彻底失望', [
    ['他骗了我一次', { light: -6, order: 8, obsession: 6 }],
    ['他在我最难的时候消失了', { bond: -9, obsession: 8 }],
    ['他把我的事告诉了别人', { bond: -8, light: -6 }],
    ['他从来没把我当回事', { bond: -8, light: -4 }],
    ['他改不了，我也不想再等', { obsession: -7, order: 7 }]
  ], { multi: [2, 3] }],

  ['你身上有哪些是"越长大越明显"的', [
    ['越来越不想解释', { bond: -8, obsession: 5 }],
    ['越来越容易被小事打动', { light: 9, mercy: 7 }],
    ['越来越想把事做完', { obsession: 9, order: 7 }],
    ['越来越不想争', { obsession: -8, light: 6 }],
    ['越来越在意身体', { sacrifice: -9, order: 8 }]
  ], { multi: 3 }],

  ['下面哪些时刻你会突然想哭', [
    ['很累但还要继续的时候', { sacrifice: 9, obsession: 6 }],
    ['有人对我说"辛苦了"', { light: 8, bond: 8 }],
    ['一个人回到家，灯是黑的', { bond: 8, light: 5 }],
    ['看到很久以前的照片', { obsession: 8, light: 6 }],
    ['事情终于做成了的那一刻', { obsession: 7, passion: 8 }]
  ], { multi: 3 }],

  ['你觉得什么才算"过得好"', [
    ['每天有事做，不慌', { order: 10, obsession: -4 }],
    ['身边有人，不用装', { bond: 10, light: 8 }],
    ['还能做自己喜欢的事', { obsession: 8, light: 5 }],
    ['不用看谁的脸色', { bond: -8, order: -6 }],
    ['能帮到别人', { light: 10, mercy: 8 }]
  ], { multi: 3 }],

  ['哪些事你明明知道没用但还会做', [
    ['反复看一件已经过去的事', { obsession: 10, light: -4 }],
    ['对一个人好，哪怕没回应', { light: 9, sacrifice: 8 }],
    ['把话在心里演练很多遍', { obsession: 8, order: 6 }],
    ['留着一些用不上的东西', { obsession: 8, light: 4 }],
    ['在深夜做决定', { passion: 8, order: -6 }]
  ], { multi: 3 }],

  ['你希望别人怎么对你', [
    ['有话直说，别猜', { order: 10, mercy: -4 }],
    ['给我留点空间', { bond: -9, order: 6 }],
    ['在我需要的时候出现', { bond: 10, light: 7 }],
    ['别把我当小孩', { order: 8, passion: 4 }],
    ['记得我说过的话', { bond: 9, light: 6 }]
  ], { multi: 3 }],

  ['下面哪些会让你对一个人好感度暴涨', [
    ['他说话算话', { order: 11, light: 6 }],
    ['他对服务人员很客气', { light: 10, mercy: 8 }],
    ['他会自嘲', { light: 6, passion: 5 }],
    ['他做事有始有终', { order: 10, obsession: 7 }],
    ['他在别人说他坏话时不辩解', { light: 8, order: 5 }]
  ], { multi: 3 }],

  ['你身上有哪些是小时候就有的', [
    ['爱记仇', { obsession: 10, light: -5 }],
    ['爱照顾人', { light: 9, mercy: 8 }],
    ['怕一个人', { bond: 10, light: 5 }],
    ['不服输', { obsession: 10, passion: 7 }],
    ['想得比同龄人多', { order: 8, obsession: 6 }]
  ], { multi: 3 }],

  ['哪些事会让你觉得自己还活着', [
    ['跑完一段很长的路', { passion: 10, sacrifice: -6 }],
    ['把一件难事做成了', { obsession: 10, order: 7 }],
    ['和一个人聊到天亮', { bond: 10, passion: 7 }],
    ['一个人待了很久', { bond: -9, obsession: 5 }],
    ['帮了一个完全陌生的人', { light: 10, mercy: 8 }]
  ], { multi: 3 }],

  ['下面哪些是你在意的"边界"', [
    ['别人不动我的东西', { order: 10, obsession: 6 }],
    ['别人不替我做决定', { bond: -8, order: 8 }],
    ['别人不随便评价我的家人', { light: 6, order: 7 }],
    ['别人不拿我的短处开玩笑', { obsession: 7, mercy: -6 }],
    ['别人不在我忙的时候找我', { order: 8, bond: -5 }]
  ], { multi: 3 }],

  ['你愿意为哪些事花钱', [
    ['和重要的人吃一顿好的', { bond: 9, light: 7 }],
    ['一个能用很久的东西', { order: 9, obsession: 6 }],
    ['一次说走就走的旅行', { passion: 9, fate: 6 }],
    ['让别人过得舒服一点', { light: 10, mercy: 8 }],
    ['能省时间的东西', { order: 8, sacrifice: -5 }]
  ], { multi: 3 }],

  ['下面哪些是你做过的"没人知道的好事"', [
    ['悄悄帮人把事补上', { light: 10, bond: 6 }],
    ['匿名转了钱', { light: 9, obsession: -5 }],
    ['在别人被误解时替他说了一句', { light: 9, order: 6 }],
    ['把功劳让给了别人', { light: 10, sacrifice: 8 }],
    ['其实没做过', { light: -6, order: 4 }]
  ], { multi: 3 }],

  ['哪些会让你觉得"这个人可以深交"', [
    ['他记得我以前说过的话', { bond: 9, light: 7 }],
    ['他在我犯错时没落井下石', { light: 9, mercy: 7 }],
    ['他对自己的错很坦率', { order: 9, light: 6 }],
    ['他不占小便宜', { order: 10, light: 6 }],
    ['他说到做到', { order: 11, obsession: 6 }]
  ], { multi: 3 }],

  ['你身上有哪些"其实很矛盾"的地方', [
    ['想被看见又怕被看见', { bond: 6, obsession: 6 }],
    ['想留下又想走', { obsession: 6, fate: 5 }],
    ['想被人依赖又怕被依赖', { bond: 5, sacrifice: -5 }],
    ['想争又觉得没必要', { obsession: -5, order: 5 }],
    ['想被理解又懒得解释', { bond: -7, light: 4 }]
  ], { multi: 3 }],

  ['下面哪些是你"绝对不会做"的', [
    ['在别人的伤口上撒盐', { mercy: 6, light: 9 }],
    ['为了自己的好处踩别人', { light: 10, order: 9 }],
    ['答应的事不算数', { order: 11, light: 7 }],
    ['欺负比自己弱的人', { light: 10, mercy: 9 }],
    ['背后说朋友的坏话', { bond: 8, light: 8 }]
  ], { multi: 3 }],

  ['什么事会让你一整天都不对劲', [
    ['早上和人吵了一架', { passion: 8, bond: -6 }],
    ['收到一条冷冰冰的回复', { bond: 7, light: -4 }],
    ['计划被打乱了', { order: 10, passion: -5 }],
    ['发现自己做错了一件小事', { order: 8, obsession: 8 }],
    ['一整天没人联系我', { bond: 9, light: 4 }]
  ], { multi: 3 }],

  ['你希望自己的努力被怎么对待', [
    ['有人看见就够了', { light: 7, bond: 7 }],
    ['给相应的回报', { order: 9, light: 4 }],
    ['被记住', { obsession: 9, bond: 7 }],
    ['别被当成理所当然', { order: 8, light: 5 }],
    ['无所谓，我自己知道', { bond: -7, obsession: 6 }]
  ], { multi: 3 }],

  ['下面哪些是你会"偷偷做"的事', [
    ['偷偷比较自己和别人', { obsession: 8, light: -4 }],
    ['偷偷对一个人好', { light: 9, sacrifice: 7 }],
    ['偷偷练习一个技能', { obsession: 9, order: 6 }],
    ['偷偷难过', { bond: -7, light: 4 }],
    ['偷偷做计划', { order: 9, obsession: 6 }]
  ], { multi: 3 }],

  ['哪些时候你会特别想有人在', [
    ['生病的时候', { bond: 10, light: 6 }],
    ['做成一件大事的时候', { bond: 8, passion: 8 }],
    ['深夜想不通的时候', { bond: 10, light: 5 }],
    ['被人误解的时候', { bond: 9, light: 6 }],
    ['其实都不太需要', { bond: -10, obsession: 7 }]
  ], { multi: 3 }],

  ['你觉得一个人最难得的品质有哪些', [
    ['说话算话', { order: 11, light: 6 }],
    ['不占人便宜', { light: 9, order: 7 }],
    ['在别人难堪时给台阶', { mercy: 9, light: 8 }],
    ['做错事敢认', { order: 10, light: 7 }],
    ['不轻易放弃', { obsession: 10, order: 6 }]
  ], { multi: 3 }],

  ['下面哪些是你"一个人也能做"但更想有人一起的事', [
    ['吃饭', { bond: 8, light: 5 }],
    ['看电影', { bond: 7, light: 4 }],
    ['旅行', { bond: 9, passion: 5 }],
    ['把一件难事做完', { bond: 7, obsession: 7 }],
    ['其实都能一个人', { bond: -8, obsession: 6 }]
  ], { multi: 3 }],

  ['哪些话你听了很多次，但每次都还是会难受', [
    ['"你想太多了"', { obsession: 7, light: -4 }],
    ['"你怎么这么敏感"', { light: -5, obsession: 6 }],
    ['"这有什么好难的"', { order: 5, light: -5 }],
    ['"你变了"', { obsession: 6, light: -3 }],
    ['"随便你"', { bond: -7, light: -4 }]
  ], { multi: 3 }],

  ['你会为了哪些理由熬夜', [
    ['事情没做完', { obsession: 10, order: 6 }],
    ['有个人在等我回消息', { bond: 9, light: 5 }],
    ['剧太好看了', { passion: 8, order: -7 }],
    ['心里有事睡不着', { obsession: 9, light: -3 }],
    ['其实没什么理由', { passion: 5, order: -5 }]
  ], { multi: 3 }],

  ['下面哪些是你在意但要装作不在意的', [
    ['别人怎么看我', { obsession: 8, light: -3 }],
    ['有没有人记得我的生日', { bond: 9, obsession: 6 }],
    ['我在这个位置上到底行不行', { order: 8, obsession: 7 }],
    ['我是不是被落下了', { obsession: 8, bond: 5 }],
    ['其实都在意过，现在好多了', { light: 6, obsession: -5 }]
  ], { multi: 3 }],

  ['你觉得"长大"意味着什么', [
    ['学会自己扛', { bond: -8, sacrifice: 8 }],
    ['学会说不', { order: 9, mercy: -5 }],
    ['学会接受有些事改变不了', { obsession: -8, light: 5 }],
    ['学会照顾别人', { light: 9, mercy: 8 }],
    ['学会不那么在意别人怎么看', { bond: -6, light: 6 }]
  ], { multi: 3 }],

  ['哪些时候你会突然想联系一个很久没联系的人', [
    ['听到一首以前的歌', { obsession: 8, light: 6 }],
    ['路过一起去过的地方', { obsession: 9, light: 5 }],
    ['自己过得不好的时候', { bond: 9, light: 4 }],
    ['自己过得特别好的时候', { bond: 8, passion: 6 }],
    ['做梦梦到了', { obsession: 7, fate: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你做决定时会考虑很久的', [
    ['要不要换一份工作', { order: 9, fate: 6 }],
    ['要不要跟一个人说清楚', { bond: 8, order: 6 }],
    ['要不要放弃一件做了很久的事', { obsession: 10, order: 6 }],
    ['要不要花一笔钱', { order: 9, sacrifice: -5 }],
    ['要不要原谅一个人', { mercy: 8, obsession: 6 }]
  ], { multi: 3 }],

  ['你身上有哪些是"别人夸不出来"的优点', [
    ['我说到就一定做到', { order: 11, light: 6 }],
    ['我能一直做一件没人看的事', { obsession: 11, sacrifice: 6 }],
    ['我记性很好，尤其是别人的好', { light: 9, obsession: 7 }],
    ['我能忍住不说', { order: 9, light: 5 }],
    ['我敢承认自己错了', { light: 9, order: 8 }]
  ], { multi: 3 }],

  ['哪些场合你会感到不适', [
    ['被很多人盯着看', { bond: -7, passion: -5 }],
    ['必须说客套话', { order: 6, light: -5 }],
    ['别人在吵架', { passion: -6, light: 5 }],
    ['所有人都很热情，只有我冷着', { bond: -6, light: 4 }],
    ['我发现自己在装', { light: 5, order: -4 }]
  ], { multi: 3 }],

  ['你更愿意把时间花在哪些事上', [
    ['陪一个人', { bond: 10, light: 7 }],
    ['做一件能留下的事', { obsession: 10, order: 7 }],
    ['学一样新东西', { order: 8, passion: 7 }],
    ['什么都不做', { passion: -8, obsession: -6 }],
    ['帮别人解决一个问题', { light: 9, mercy: 8 }]
  ], { multi: 3 }],

  ['下面哪些是你"说不出口"的时刻', [
    ['想说抱歉', { light: 7, order: 6 }],
    ['想说谢谢', { light: 8, bond: 6 }],
    ['想说我很难受', { bond: 9, light: 4 }],
    ['想说别走', { bond: 10, light: 5 }],
    ['其实都说得出口', { light: 6, order: 5 }]
  ], { multi: 3 }],

  ['你觉得什么事最消耗你', [
    ['反复解释同一件事', { order: 9, obsession: 6 }],
    ['维持一段需要演的关系', { bond: -8, light: -5 }],
    ['做没有意义的形式', { order: -8, passion: 6 }],
    ['等一个不确定的结果', { obsession: 8, order: 6 }],
    ['照顾一个不肯好起来的人', { sacrifice: 8, light: 5 }]
  ], { multi: 3 }],

  ['哪些事你会"先做了再说"', [
    ['帮别人一把', { light: 9, passion: 7 }],
    ['把自己的想法说出来', { passion: 8, light: 4 }],
    ['买一个喜欢的东西', { passion: 8, order: -6 }],
    ['给一个人发消息', { passion: 7, bond: 7 }],
    ['其实我很少这样', { order: 8, passion: -6 }]
  ], { multi: 3 }],

  ['你希望别人记住你的哪一点', [
    ['他靠得住', { order: 11, light: 6 }],
    ['他心是热的', { light: 10, mercy: 7 }],
    ['他从没退过', { obsession: 11, passion: 6 }],
    ['他从没麻烦过谁', { bond: -9, order: 6 }],
    ['他活得挺自在', { obsession: -8, light: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你"忍过但没说过"的', [
    ['被人抢了功劳', { order: 7, obsession: 8 }],
    ['被人当众开玩笑', { light: -4, obsession: 8 }],
    ['被人使唤了很多次', { order: 7, light: 5 }],
    ['被人误解了很久', { obsession: 8, light: -4 }],
    ['没什么忍过的', { light: 5, order: 5 }]
  ], { multi: 3 }],

  ['哪些事能让你瞬间放松下来', [
    ['洗完澡躺在床上', { passion: -7, light: 5 }],
    ['有人跟我说"没事"', { light: 8, bond: 8 }],
    ['把事情列成清单', { order: 11 }],
    ['一个人走一段路', { bond: -7, passion: -4 }],
    ['把一件卡住的事解决了', { obsession: 9, order: 7 }]
  ], { multi: 3 }],

  ['你觉得自己最大的问题是', [
    ['太容易替别人想', { light: 8, mercy: 7 }],
    ['太不容易放下', { obsession: 9, light: -3 }],
    ['太想做得对', { order: 10, obsession: 5 }],
    ['太不想麻烦别人', { bond: -8, light: 5 }],
    ['太容易上头', { passion: 9, order: -6 }]
  ], { multi: 3 }],

  ['哪些事你"看一眼就知道结果"', [
    ['一段关系能不能长久', { bond: 7, fate: 6 }],
    ['一个人靠不靠得住', { light: 6, order: 8 }],
    ['这件事会不会做成', { order: 8, fate: 6 }],
    ['这个方案有没有坑', { order: 9, obsession: 6 }],
    ['其实经常看错', { light: 4, order: -6 }]
  ], { multi: 3 }],

  ['如果只能保留三样东西，你留哪些', [
    ['和某个人的联系', { bond: 11, light: 7 }],
    ['我做过的所有记录', { obsession: 10, order: 6 }],
    ['别人对我的信任', { light: 9, order: 8 }],
    ['我还能继续做的那件事', { obsession: 11, sacrifice: 7 }],
    ['我自己的身体', { sacrifice: -9, order: 8 }]
  ], { multi: [2, 3] }],

  ['哪些是你"知道该做但一直没做"的', [
    ['跟一个人道歉', { light: 8, order: 7 }],
    ['去做一次体检', { sacrifice: -8, order: 8 }],
    ['把欠的事还清', { order: 9, light: 6 }],
    ['把那件事彻底放下', { obsession: -7, light: 5 }],
    ['其实我该做的都做了', { order: 8, light: 4 }]
  ], { multi: 3 }],

  ['你在什么状态下最容易做出好东西', [
    ['深夜一个人', { obsession: 8, bond: -5 }],
    ['被逼到角落的时候', { obsession: 10, sacrifice: 7 }],
    ['有人认真期待的时候', { bond: 9, light: 7 }],
    ['心情特别好的时候', { passion: 10, light: 6 }],
    ['按计划一步步来的时候', { order: 10, passion: -5 }]
  ], { multi: 3 }],

  ['下面哪些是你会"重新看一遍"的东西', [
    ['自己发出去的消息', { obsession: 8, light: -3 }],
    ['一部看过的电影', { obsession: 7, light: 5 }],
    ['自己写过的字', { obsession: 8, light: 4 }],
    ['一段聊天记录', { obsession: 9, bond: 5 }],
    ['其实很少重看', { obsession: -8, light: 4 }]
  ], { multi: 3 }],

  ['你觉得什么样的人值得等', [
    ['会给我明确答案的人', { order: 9, light: 5 }],
    ['在乎我感受的人', { light: 9, mercy: 8 }],
    ['哪怕慢也不会走的人', { bond: 10, obsession: 7 }],
    ['其实谁也不值得等', { obsession: -9, light: -4 }],
    ['值得等的人不用我判断', { fate: 8, light: 5 }]
  ], { multi: 3 }],

  ['哪些时刻你会觉得自己特别清醒', [
    ['凌晨四点', { passion: -6, obsession: 7 }],
    ['跑完步', { passion: 7, sacrifice: -5 }],
    ['把话说开之后', { bond: 8, light: 6 }],
    ['一个人坐很久的车', { bond: -6, light: 5 }],
    ['做完一个重大决定之后', { order: 9, obsession: 7 }]
  ], { multi: 3 }],

  ['你身上有哪些是"想改又不想改"的', [
    ['太念旧', { obsession: 9, light: 5 }],
    ['太容易心软', { mercy: 8, light: 6 }],
    ['太想赢', { obsession: 10, passion: 6 }],
    ['太独立', { bond: -9, order: 6 }],
    ['其实都想改', { order: 7, light: 4 }]
  ], { multi: 3 }],

  ['哪些事你会"先答应再想办法"', [
    ['朋友的求助', { light: 9, bond: 8 }],
    ['一个看着就很难的任务', { obsession: 10, passion: 7 }],
    ['一个没把握的邀请', { passion: 7, fate: 5 }],
    ['其实我都先想清楚才答应', { order: 10, sacrifice: -5 }],
    ['看对方是谁', { light: 5, bond: 6 }]
  ], { multi: 3 }],

  ['你身上有哪些是"只有极少数人见过"的', [
    ['我崩溃的样子', { light: 5, bond: 8 }],
    ['我真正在意的东西', { obsession: 8, light: 5 }],
    ['我幼稚的一面', { light: 7, passion: 6 }],
    ['我发脾气', { passion: 8, light: -3 }],
    ['其实我没什么藏的', { light: 7, order: 4 }]
  ], { multi: 3 }],

  ['哪些是你"从来不会主动说"的', [
    ['我需要帮忙', { bond: -9, light: 5 }],
    ['我很在意这件事', { obsession: 7, light: -3 }],
    ['我其实很难过', { bond: 8, light: 4 }],
    ['我觉得自己做得不错', { obsession: 6, light: 4 }],
    ['其实我都会说', { light: 6, passion: 5 }]
  ], { multi: 3 }],

  ['你觉得"被爱"是什么感觉', [
    ['有人记得我说过的小事', { light: 9, bond: 9 }],
    ['我不用解释他就懂', { bond: 10, light: 7 }],
    ['我难看的时候他也在', { light: 10, bond: 9 }],
    ['他让我变得更像我自己', { light: 8, obsession: 6 }],
    ['其实我不太确定', { light: -3, bond: -5 }]
  ], { multi: 3 }],

  ['哪些是你愿意"再试一次"的', [
    ['一件失败过的事', { obsession: 10, passion: 6 }],
    ['一段结束过的关系', { bond: 8, light: 6 }],
    ['一个放弃过的爱好', { obsession: 7, passion: 5 }],
    ['其实我不喜欢回头', { obsession: -9, order: 6 }],
    ['看是谁先开口', { bond: 5, light: 4 }]
  ], { multi: 3 }],

  ['你在意一个人时会有哪些表现', [
    ['会记住他随口说的话', { bond: 9, light: 7 }],
    ['会主动找话题', { bond: 8, passion: 5 }],
    ['会想给他带点东西', { light: 8, bond: 8 }],
    ['反而变得话少', { bond: 5, light: -3 }],
    ['会想让他过得更好', { light: 10, sacrifice: 8 }]
  ], { multi: 3 }],

  ['哪些时刻你会觉得"我长大了"', [
    ['自己一个人去医院', { sacrifice: -6, obsession: 6 }],
    ['跟父母说"我没事"', { light: 5, bond: 6 }],
    ['把一件很难的事做完了', { obsession: 9, order: 7 }],
    ['主动跟人道歉', { light: 8, order: 8 }],
    ['放弃了一个很想得到的东西', { obsession: -6, light: 5 }]
  ], { multi: 3 }],

  ['哪些是你"宁愿自己麻烦"也不想做的事', [
    ['开口求人', { bond: -10, light: 4 }],
    ['被人照顾', { bond: -8, sacrifice: -5 }],
    ['解释一件事', { obsession: 6, order: 5 }],
    ['欠别人人情', { order: 9, bond: -6 }],
    ['其实我不怕麻烦别人', { bond: 8, light: 5 }]
  ], { multi: 3 }],

  ['如果给你一个重新选择的机会，你会改什么', [
    ['我做过的一个决定', { obsession: 9, light: -4 }],
    ['我说过的一句话', { obsession: 8, light: 4 }],
    ['我错过的一个机会', { obsession: 8, passion: 5 }],
    ['我不会改任何事', { fate: -6, light: 7 }],
    ['我会选那个更难的路', { obsession: 9, sacrifice: 7 }]
  ], { multi: [2, 3] }]
];
