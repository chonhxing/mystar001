/**
 * 变长选项题 · 单选与多选混编。
 *
 * 这个文件是**故意**把选项数量做散的：
 *   - 二分题（2 个选项）：逼一个方向，答案最有信息量
 *   - 四选项题：比三选项多一条中间路
 *   - 六选项题：清单型，选"最像你的那一个"
 *   - 多选（min/max 各不相同）
 *
 * 页面那边不许假设选项是 3 个（`OptionRow` 高度按文案折行算），
 * 这里就是那条约定的活体测试数据。
 */

module.exports = [
  // ---------------- 二分题（只有两条路） ----------------
  ['如果只能保住一样，你保哪个', [
    ['我做的事', { obsession: 12, order: 6 }],
    ['我身边的人', { bond: 12, light: 8 }]
  ]],

  ['一件事上你更在意哪一边：做对还是做完', [
    ['做对', { order: 12, obsession: 6 }],
    ['做完', { obsession: 12, order: -4 }]
  ]],

  ['你更容易被哪一种打动', [
    ['一个人拼命的样子', { passion: 11, light: 6 }],
    ['一个人忍住的样子', { order: 8, sacrifice: 8, light: 5 }]
  ]],

  ['你更怕变成哪一种人', [
    ['变成自己讨厌的人', { light: 11, order: 8 }],
    ['变成一个没用的人', { obsession: 10, order: 6 }]
  ]],

  ['你想要的关系是', [
    ['彼此都在，随时能靠', { bond: 12, light: 7 }],
    ['各自独立，互不打扰', { bond: -12, order: 7 }]
  ]],

  ['你更愿意听', [
    ['一句实话', { order: 11, mercy: -6 }],
    ['一句宽慰', { light: 9, mercy: 9 }]
  ]],

  ['你更愿意做', [
    ['第一个上的人', { passion: 12, sacrifice: 8 }],
    ['最后一个走的人', { order: 10, sacrifice: 9, light: 6 }]
  ]],

  ['你的钱更愿意花在', [
    ['体验上', { passion: 10, light: 5 }],
    ['东西上', { order: 10, obsession: 5 }]
  ]],

  ['你更愿意', [
    ['被人需要', { bond: 11, sacrifice: 8 }],
    ['被人尊重', { order: 10, obsession: 6 }]
  ]],

  ['你的错更愿意', [
    ['当场认', { light: 9, order: 9 }],
    ['回去想清楚再说', { order: 8, obsession: 7 }]
  ]],

  ['你更相信', [
    ['努力', { obsession: 11, order: 7 }],
    ['时机', { fate: 11, order: -6 }]
  ]],

  ['更难受的是', [
    ['我本可以', { obsession: 12, light: -4 }],
    ['我尽力了', { sacrifice: 8, light: 5 }]
  ]],

  ['你在团队里更愿意', [
    ['说了算', { order: 10, obsession: 8 }],
    ['做事就好', { order: 6, bond: -5 }]
  ]],

  ['你更愿意记得', [
    ['别人对我的好', { light: 11, mercy: 8 }],
    ['别人对我的坏', { light: -10, obsession: 10 }]
  ]],

  ['你更愿意', [
    ['被人看穿', { light: 7, bond: 7 }],
    ['被人误会', { bond: -8, obsession: 6 }]
  ]],

  ['夜深了，你更愿意', [
    ['把今天做完', { obsession: 10, order: 7 }],
    ['把今天放下', { obsession: -9, light: 6 }]
  ]],

  ['你更愿意', [
    ['先道歉', { light: 9, order: 8 }],
    ['等对方先开口', { order: 6, obsession: 7 }]
  ]],

  ['你更想成为', [
    ['一把刀', { mercy: -10, passion: 9, order: 5 }],
    ['一堵墙', { light: 8, sacrifice: 9, order: 6 }]
  ]],

  ['你更愿意在', [
    ['人前发光', { passion: 11, light: 6 }],
    ['人后撑着', { sacrifice: 10, light: 7 }]
  ]],

  ['你更愿意相信', [
    ['我看到的', { order: 10, light: 4 }],
    ['我感觉到的', { fate: 9, passion: 8 }]
  ]],

  // ---------------- 四选项题 ----------------
  ['工作上遇到一个很难的活，你的第一反应是', [
    ['我先接下来', { passion: 8, obsession: 9 }],
    ['先把难点列出来', { order: 11 }],
    ['找人一起做', { bond: 9, light: 5 }],
    ['先问清楚为什么要做', { order: 9, obsession: 5 }]
  ]],

  ['你在意的"体面"是什么', [
    ['不欠人情', { order: 10, bond: -5 }],
    ['不说大话', { order: 10, light: 6 }],
    ['不占便宜', { light: 9, order: 8 }],
    ['不让人看笑话', { light: -4, obsession: 7 }]
  ]],

  ['你的一天如果被毁了，多半是因为', [
    ['计划被打乱', { order: 11, passion: -5 }],
    ['跟人闹了别扭', { bond: 9, light: -4 }],
    ['事情没做完', { obsession: 10, order: 6 }],
    ['觉得自己白过了', { obsession: 8, fate: 5 }]
  ]],

  ['你觉得一个人最没救的是', [
    ['不肯认错', { order: 10, light: -6 }],
    ['不肯改变', { obsession: -8, order: 6 }],
    ['不肯相信自己', { light: 8, fate: -6 }],
    ['不肯放过别人', { light: -7, obsession: 9 }]
  ]],

  ['如果有个按钮能让你看到十年后，你会', [
    ['按，我想知道', { fate: 6, order: 5 }],
    ['不按，没意思', { fate: -8, passion: 7 }],
    ['按，但只看一眼', { obsession: 7, order: 5 }],
    ['先问清楚代价', { order: 10, sacrifice: -6 }]
  ]],

  ['你更愿意接受哪一种道歉', [
    ['一句诚恳的对不起', { light: 9, order: 5 }],
    ['一个实际的补偿', { order: 10, light: 4 }],
    ['一个以后不会再犯的保证', { order: 9, light: 5 }],
    ['不道歉也行，别再来一次', { obsession: -6, light: 4 }]
  ]],

  ['你会在什么时候最想家', [
    ['生病的时候', { bond: 9, light: 5 }],
    ['受了委屈', { bond: 9, light: 6 }],
    ['过节的时候', { bond: 8, order: 6 }],
    ['吃到熟悉的东西', { bond: 7, light: 6 }]
  ]],

  ['你怎么看"藏拙"这件事', [
    ['会，没必要全露出来', { order: 9, obsession: 6 }],
    ['不会，我宁愿直来直去', { light: 8, passion: 7 }],
    ['看对象，值得才露', { bond: 7, order: 6 }],
    ['我没什么可藏的', { light: 7, bond: 5 }]
  ]],

  ['你最想删掉自己身上的哪一样', [
    ['拖延', { order: -9, passion: 5 }],
    ['敏感', { light: 6, obsession: 6 }],
    ['心软', { mercy: 7, light: 6 }],
    ['固执', { obsession: 9, order: 7 }]
  ]],

  ['哪一句更像你', [
    ['算了，我来吧', { sacrifice: 9, light: 7 }],
    ['那就这样吧', { obsession: -8, light: 4 }],
    ['我不这么觉得', { order: 9, passion: 7 }],
    ['再等等看', { order: 8, obsession: 6 }]
  ]],

  ['你对"仪式感"的态度是', [
    ['很重要，那是给日子的标记', { order: 9, fate: 7, light: 5 }],
    ['一般，看人', { bond: 6, light: 4 }],
    ['不重要，形式而已', { order: -8, light: -3 }],
    ['喜欢，但不好意思想要', { light: 5, obsession: 6 }]
  ]],

  ['你更愿意把心事说给', [
    ['最好的朋友', { bond: 10, light: 6 }],
    ['陌生人', { bond: -6, light: 4 }],
    ['写下来', { obsession: 8, bond: -5 }],
    ['谁也不说', { bond: -10, obsession: 6 }]
  ]],

  ['你觉得"成熟"最像哪一个', [
    ['能自己扛事', { bond: -8, sacrifice: 8 }],
    ['能体谅别人', { light: 9, mercy: 8 }],
    ['能接受不如意', { obsession: -8, light: 5 }],
    ['能守住分寸', { order: 10, light: 6 }]
  ]],

  ['你更愿意被人说', [
    ['你真靠得住', { order: 11, light: 6 }],
    ['你真有意思', { passion: 9, light: 6 }],
    ['你真厉害', { obsession: 9, order: 6 }],
    ['你人真好', { light: 10, mercy: 7 }]
  ]],

  ['遇到一件不公平的事，你更可能', [
    ['当场说', { passion: 10, light: 7 }],
    ['反映给能管的人', { order: 11 }],
    ['自己想办法绕开', { order: -5, obsession: 7 }],
    ['忍着，但记着', { obsession: 9, light: -4 }]
  ]],

  ['你的一天里最不能少的是', [
    ['一段没人打扰的时间', { bond: -9, obsession: 6 }],
    ['一件做完了的事', { obsession: 9, order: 7 }],
    ['和一个人说上话', { bond: 9, light: 6 }],
    ['一点期待', { fate: 8, light: 6 }]
  ]],

  ['如果能换掉一样，你换', [
    ['出身', { fate: -9, obsession: 8 }],
    ['长相', { light: -4, order: 6 }],
    ['性格', { order: 8, light: 5 }],
    ['什么都不换', { light: 8, fate: 6 }]
  ]],

  ['你更愿意接受哪一种失败', [
    ['技不如人', { order: 9, obsession: 6 }],
    ['时运不济', { fate: 9, order: -5 }],
    ['自己放弃', { obsession: -8, light: -4 }],
    ['被人算计', { light: -7, obsession: 8 }]
  ]],

  ['你的"原则"更像哪一种', [
    ['答应的事要做到', { order: 12, light: 6 }],
    ['不能害人', { light: 11, mercy: 8 }],
    ['不能骗自己', { light: 8, obsession: 8 }],
    ['不该拿的不拿', { order: 11, light: 7 }]
  ]],

  ['你更愿意在什么时候做决定', [
    ['想清楚之后', { order: 11, passion: -7 }],
    ['感觉对了就行', { passion: 11, fate: 7 }],
    ['问过人之后', { bond: 9, light: 5 }],
    ['拖到最后不得不做', { order: -8, obsession: 6 }]
  ]],

  // ---------------- 六选项题（清单型，选最像的） ----------------
  ['如果只能用一句话介绍自己，你选哪一句', [
    ['我答应的事一定做到', { order: 12, light: 6 }],
    ['我从来不会先走', { bond: 11, light: 7 }],
    ['我一直在做同一件事', { obsession: 12, order: 7 }],
    ['我不太需要别人', { bond: -12, obsession: 6 }],
    ['我看不得别人难受', { light: 12, mercy: 9 }],
    ['我什么都不太在意', { obsession: -12, light: 5 }]
  ]],

  ['你的一个下午，最可能是哪种', [
    ['把拖了很久的事做完了', { order: 10, obsession: 9 }],
    ['和一个人聊了很久', { bond: 10, light: 6 }],
    ['一个人待着，什么都没做', { bond: -9, obsession: -5 }],
    ['临时起意去了个地方', { passion: 11, order: -8 }],
    ['把要做的事排了一遍', { order: 12, passion: -6 }],
    ['帮别人处理了一件麻烦事', { light: 10, mercy: 8 }]
  ]],

  ['你身上最像"主角"的一点是', [
    ['认定了就不回头', { obsession: 12, passion: 7 }],
    ['总在护着别人', { light: 11, mercy: 9 }],
    ['什么都自己扛', { sacrifice: 11, bond: -8 }],
    ['越难越来劲', { passion: 11, obsession: 9 }],
    ['一直在等一个答案', { fate: 10, obsession: 7 }],
    ['我只是个普通人', { light: 6, obsession: -6 }]
  ]],

  ['你最想拥有哪一种能力', [
    ['说放就放', { obsession: -12, light: 6 }],
    ['一眼看穿人', { order: 9, light: -5 }],
    ['不会累', { sacrifice: 12, obsession: 8 }],
    ['让所有人都喜欢我', { light: 9, bond: 9 }],
    ['想做什么就做什么', { passion: 11, order: -9 }],
    ['永远做对选择', { order: 12, fate: 6 }]
  ]],

  ['半夜三点你还醒着，最可能的原因是', [
    ['事情没做完', { obsession: 11, order: 7 }],
    ['心里有个人', { bond: 8, obsession: 8 }],
    ['白天受的委屈', { light: -4, obsession: 7 }],
    ['纯粹睡不着', { passion: -6, order: -5 }],
    ['在等一个消息', { bond: 8, order: 6 }],
    ['在为自己高兴', { light: 8, passion: 8 }]
  ]],

  ['你最受不了别人哪一种', [
    ['说话不算话', { order: 12, light: 5 }],
    ['踩着别人往上走', { light: -6, order: 9 }],
    ['明明在意却装无所谓', { light: 6, obsession: 6 }],
    ['对弱者不客气', { light: 10, mercy: 8 }],
    ['永远在抱怨', { obsession: -7, light: -5 }],
    ['什么都不说清楚', { order: 10, bond: -5 }]
  ]],

  ['如果人生有一个主题曲，它更像', [
    ['一直在路上', { fate: 10, obsession: 8 }],
    ['守住这一个', { order: 11, obsession: 9 }],
    ['和你们一起', { bond: 12, light: 8 }],
    ['一个人也很好', { bond: -12, obsession: 5 }],
    ['烧完就算了', { sacrifice: 12, passion: 10 }],
    ['慢慢来，不着急', { obsession: -11, light: 6 }]
  ]],

  ['你希望别人在你的葬礼上说什么', [
    ['他是个说到做到的人', { order: 12, light: 6 }],
    ['他一直在护着我们', { light: 12, mercy: 9 }],
    ['他从来没停过', { obsession: 12, sacrifice: 8 }],
    ['他活得很自在', { obsession: -10, light: 6 }],
    ['他其实一直很累', { sacrifice: 10, light: 5 }],
    ['他谁也没麻烦过', { bond: -11, order: 6 }]
  ]],

  ['你最难做到的是哪一件', [
    ['开口求人', { bond: -10, light: 4 }],
    ['承认自己错', { order: 8, obsession: 7 }],
    ['把话咽回去', { passion: 9, order: 6 }],
    ['对一个人彻底死心', { obsession: 10, light: -4 }],
    ['什么都不管', { light: -7, sacrifice: -6 }],
    ['对自己好一点', { sacrifice: 10, light: 6 }]
  ]],

  ['如果只能改自己一个习惯，你改', [
    ['熬夜', { order: -8, sacrifice: 7 }],
    ['什么都自己扛', { sacrifice: 10, bond: -7 }],
    ['反复想同一件事', { obsession: 10, light: -3 }],
    ['答应得太快', { light: 8, order: -6 }],
    ['什么都不说', { bond: -8, light: 5 }],
    ['不愿意麻烦别人', { bond: -9, light: 5 }]
  ]],

  ['你觉得一个人"活得明白"是什么样', [
    ['知道自己要什么', { obsession: 10, order: 8 }],
    ['知道什么不重要', { obsession: -9, light: 6 }],
    ['知道什么时候该退', { order: 11, sacrifice: -6 }],
    ['知道该护着谁', { light: 10, bond: 9 }],
    ['什么都不用知道', { fate: 8, obsession: -8 }],
    ['知道自己错在哪', { light: 8, order: 10 }]
  ]],

  ['你最想要哪一种关系', [
    ['说什么都不用解释', { bond: 11, light: 8 }],
    ['各过各的，偶尔见', { bond: -9, order: 7 }],
    ['一起把一件事做成', { obsession: 9, bond: 8 }],
    ['一个人在前面带，我在后面跟', { fate: 8, order: 6 }],
    ['我在前面挡，他在后面', { sacrifice: 11, light: 8 }],
    ['其实一个人也挺好', { bond: -12, obsession: 5 }]
  ]],

  // ---------------- 多选（形状各不相同） ----------------
  ['下面哪些是你"已经不再解释"的', [
    ['我为什么这么做', { bond: -7, obsession: 6 }],
    ['我为什么拒绝', { order: 9, light: 4 }],
    ['我为什么难过', { bond: -8, light: 4 }],
    ['我为什么还在坚持', { obsession: 10, fate: 6 }],
    ['其实我还一直在解释', { light: 6, bond: 6 }]
  ], { multi: [1, 2] }],

  ['你身上有哪些"只有你自己知道"的', [
    ['我其实一直很怕', { light: 5, obsession: 7 }],
    ['我其实早就想走了', { bond: -7, fate: 6 }],
    ['我其实很在意那句话', { obsession: 8, light: -3 }],
    ['我其实没那么强', { light: 6, sacrifice: 5 }],
    ['其实我没什么秘密', { light: 7, order: 5 }]
  ], { multi: 2 }],

  ['下面哪些是你会"为了让别人安心"而做的', [
    ['说"我没事"', { light: 7, bond: 5 }],
    ['装作很忙', { light: -4, order: 5 }],
    ['把难处说得轻一点', { light: 8, mercy: 7 }],
    ['按时回消息', { order: 8, light: 5 }],
    ['其实我不太做这种事', { light: -5, bond: -4 }]
  ], { multi: 3 }],

  ['你会在哪些事上"明知不对还是做了"', [
    ['熬夜', { order: -7, sacrifice: 6 }],
    ['心软答应别人', { light: 8, order: -5 }],
    ['又把话咽回去了', { bond: -5, light: 5 }],
    ['反复看一个人的动态', { obsession: 9, light: -3 }],
    ['其实我很少明知故犯', { order: 9, light: 6 }]
  ], { multi: [1, 3] }],

  ['哪些是你"一个人也过得挺好"的证据', [
    ['能自己吃饭看电影', { bond: -7, light: 5 }],
    ['生病了自己去医院', { bond: -8, obsession: 6 }],
    ['情绪自己能消化', { bond: -8, light: 5 }],
    ['一个人旅行也不慌', { bond: -8, fate: 7 }],
    ['其实我一点都不想一个人', { bond: 10, light: 6 }]
  ], { multi: 3 }],

  ['你更愿意在哪几件事上"被人依赖"', [
    ['有难题的时候', { order: 9, obsession: 6 }],
    ['难过的时候', { light: 9, bond: 9 }],
    ['需要有人兜着的时候', { sacrifice: 10, light: 7 }],
    ['需要有人说实话的时候', { order: 9, light: 6 }],
    ['其实我不想被依赖', { bond: -9, sacrifice: -7 }]
  ], { multi: 2 }],

  ['下面哪些是你"做过但没跟人提过"的', [
    ['替人背了一次锅', { sacrifice: 11, light: 8 }],
    ['把机会让给了别人', { light: 10, sacrifice: 8 }],
    ['一个人扛过了一段', { sacrifice: 10, bond: -7 }],
    ['把一个人从很差的状态里拉出来', { light: 10, mercy: 8 }],
    ['其实我做的事都会说', { light: 6, passion: 5 }]
  ], { multi: 3 }],

  ['哪些是你"再怎么努力也做不到"的', [
    ['对讨厌的人客气', { light: -7, mercy: -6 }],
    ['把话咽回去', { passion: 9, order: 5 }],
    ['假装不在意', { obsession: 9, light: -4 }],
    ['开口求人', { bond: -9, light: 4 }],
    ['其实我什么都能做到', { obsession: 8, light: 4 }]
  ], { multi: 3 }],

  ['你更愿意在哪些方面"保持现状"', [
    ['现在的工作', { order: 7, obsession: -5 }],
    ['现在的关系', { bond: 8, light: 5 }],
    ['现在的城市', { order: 7, fate: -5 }],
    ['现在的自己', { light: 7, obsession: 5 }],
    ['其实我什么都想变', { order: -9, fate: 7 }]
  ], { multi: 2 }],

  ['哪些是你"会为了别人改变"的', [
    ['作息', { bond: 8, order: -5 }],
    ['口味', { light: 6, bond: 5 }],
    ['计划', { bond: 8, order: -7 }],
    ['脾气', { light: 7, mercy: 6 }],
    ['其实我很少为别人改', { order: 9, obsession: 6 }]
  ], { multi: 3 }],

  ['你身上有哪些是"别人一夸你就不自在"的', [
    ['说我靠谱', { order: 8, light: 4 }],
    ['说我善良', { light: 9, mercy: 6 }],
    ['说我努力', { obsession: 8, light: 4 }],
    ['说我懂事', { light: 6, sacrifice: 6 }],
    ['其实我被夸挺开心的', { light: 8, passion: 6 }]
  ], { multi: 3 }],

  ['下面哪些是你会"反复确认"的', [
    ['门锁了没有', { order: 9, obsession: 8 }],
    ['消息发出去了没有', { obsession: 8, light: -3 }],
    ['那句话有没有说错', { obsession: 9, light: -4 }],
    ['对方是不是不高兴了', { light: 6, obsession: 7 }],
    ['其实我很少确认', { order: -7, light: 4 }]
  ], { multi: 3 }]
];
