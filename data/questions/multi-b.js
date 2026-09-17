/**
 * 跨轴多选题 · 第二批（最多勾 3 项）。
 *
 * 这一批偏"具体行为清单"：做过什么、会做什么、在哪些方面是这样的人。
 * 玩家勾中的每一条都会进入图谱，勾得越多这个方向的倾向越明确。
 */

module.exports = [
  ['下面哪些是你最近一次哭的原因', [
    ['太累了', { sacrifice: 9, obsession: 7 }],
    ['被一句话戳中', { light: 7, obsession: 6 }],
    ['事情终于过去了', { light: 8, passion: 7 }],
    ['觉得自己很没用', { light: -6, obsession: 7 }],
    ['其实很久没哭过了', { bond: -6, order: 5 }]
  ], { multi: 3 }],

  ['你身上有哪些"年纪越大越舍不得改的"', [
    ['睡觉的时间', { order: 9, sacrifice: -7 }],
    ['吃饭的口味', { order: 8, light: 4 }],
    ['对某些人的态度', { obsession: 8, light: 5 }],
    ['自己那点原则', { order: 10, obsession: 7 }],
    ['其实什么都能改', { order: -7, obsession: -6 }]
  ], { multi: 3 }],

  ['哪些情况下你会主动开口', [
    ['看到有人被为难', { light: 10, mercy: 8 }],
    ['事情明显不对', { order: 10, light: 6 }],
    ['我喜欢的人在场', { passion: 8, bond: 7 }],
    ['这是我一直想说的', { obsession: 9, passion: 7 }],
    ['其实我很少主动开口', { bond: -7, passion: -5 }]
  ], { multi: 3 }],

  ['哪些事你会"一个人做完"', [
    ['搬家', { bond: -7, order: 7 }],
    ['看病', { bond: -8, obsession: 6 }],
    ['过生日', { bond: -8, light: 3 }],
    ['处理一件麻烦事', { bond: -7, order: 8 }],
    ['其实都希望有人陪', { bond: 9, light: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你"表面看不出来"的', [
    ['我其实很较真', { order: 9, obsession: 8 }],
    ['我其实很想被夸', { light: 6, bond: 7 }],
    ['我其实很怕失去', { bond: 8, obsession: 7 }],
    ['我其实什么都记得', { obsession: 9, light: -3 }],
    ['我其实很会算计', { order: 8, light: -6 }]
  ], { multi: 3 }],

  ['哪些事会让你对一个人改观', [
    ['他承认了自己的错', { light: 9, order: 9 }],
    ['他在别人落难时伸了手', { light: 10, mercy: 8 }],
    ['他拒绝了不该拿的东西', { order: 10, light: 8 }],
    ['他在压力下还守住了话', { order: 10, obsession: 7 }],
    ['他记得我说过的小事', { light: 7, bond: 8 }]
  ], { multi: [1, 3] }],

  ['你身上有哪些"别人以为你不在意"的', [
    ['别人怎么看我', { obsession: 7, light: -3 }],
    ['有没有人记得我', { bond: 8, obsession: 6 }],
    ['我做的事有没有意义', { obsession: 8, fate: 6 }],
    ['我在这个群体里的位置', { bond: 7, order: 5 }],
    ['其实我真的不在意', { light: 7, obsession: -7 }]
  ], { multi: 3 }],

  ['哪些是你"想做但一直没开始"的', [
    ['学一样乐器或手艺', { order: 8, passion: 6 }],
    ['一个人去一个远地方', { fate: 8, passion: 7 }],
    ['把一段关系说清楚', { bond: 8, order: 6 }],
    ['把身体练回来', { order: 9, sacrifice: -7 }],
    ['其实我想做的都开始了', { passion: 8, order: 6 }]
  ], { multi: 3 }],

  ['下面哪些会让你"瞬间冷下来"', [
    ['对方开始说客套话', { order: 6, light: -5 }],
    ['对方在敷衍我', { light: -6, obsession: 5 }],
    ['发现对方在演', { light: -7, order: 5 }],
    ['被当众开了一个玩笑', { light: -6, obsession: 6 }],
    ['其实我不太会冷下来', { light: 6, bond: 5 }]
  ], { multi: 3 }],

  ['你在朋友眼里是哪种人', [
    ['有事第一个想到的人', { light: 9, bond: 9 }],
    ['能一起发疯的人', { passion: 9, bond: 8 }],
    ['靠谱但不爱说话的人', { order: 10, bond: -4 }],
    ['总能给出主意的人', { order: 9, light: 6 }],
    ['其实我不太确定他们怎么看我', { light: 4, obsession: 6 }]
  ], { multi: 3 }],

  ['哪些"小事"会让你记很久', [
    ['别人无意中的一句谢谢', { light: 8, obsession: 7 }],
    ['有人替我挡了一句', { light: 9, bond: 8 }],
    ['有人记得我不吃什么', { light: 8, bond: 9 }],
    ['有人在我难堪时没看我', { light: 9, mercy: 8 }],
    ['其实我不太记事', { obsession: -7, light: 4 }]
  ], { multi: 3 }],

  ['哪些是你会为别人做的"麻烦事"', [
    ['绕路送他回家', { light: 9, bond: 8 }],
    ['陪他去做他不敢做的事', { bond: 9, light: 7 }],
    ['帮他跟别人解释', { light: 8, order: 6 }],
    ['借钱给他', { light: 8, sacrifice: 8 }],
    ['其实我不太做麻烦事', { bond: -8, light: -5 }]
  ], { multi: 3 }],

  ['你在什么情况下会撒谎', [
    ['为了让别人好过', { light: 8, mercy: 8 }],
    ['为了不解释一堆', { order: -6, light: -4 }],
    ['为了保护一个人', { light: 7, bond: 8 }],
    ['为了不让自己难堪', { light: -5, obsession: 6 }],
    ['其实我基本不撒谎', { order: 10, light: 7 }]
  ], { multi: 3 }],

  ['下面哪些是你"宁愿吃亏也要做的"', [
    ['说真话', { order: 10, light: 6 }],
    ['守住一个承诺', { order: 11, obsession: 8 }],
    ['帮一个可怜的人', { light: 10, mercy: 9 }],
    ['把事做完再走', { obsession: 10, order: 8 }],
    ['其实我很会算账', { order: 9, light: -6 }]
  ], { multi: 3 }],

  ['哪些时刻你会觉得自己"其实挺孤独"', [
    ['一群人在笑，我笑不出来', { bond: -7, light: -4 }],
    ['深夜刷手机停不下来', { bond: -6, obsession: 6 }],
    ['有话但不知道跟谁说', { bond: -7, light: 4 }],
    ['生日那天没人提起', { bond: -8, light: -3 }],
    ['其实我很少觉得孤独', { bond: 6, light: 7 }]
  ], { multi: 3 }],

  ['你会在哪些事上"很固执"', [
    ['我觉得对的事', { order: 10, obsession: 9 }],
    ['我答应过的事', { order: 11, light: 6 }],
    ['我喜欢的东西', { obsession: 8, passion: 7 }],
    ['我不喜欢的人', { obsession: 8, light: -7, mercy: -6 }],
    ['其实我很容易妥协', { order: -8, light: 6 }]
  ], { multi: 3 }],

  ['哪些是你"听不进去"的劝', [
    ['"你该放下了"', { obsession: 9, light: -3 }],
    ['"你太认真了"', { order: 8, obsession: 6 }],
    ['"别人都这样"', { order: -7, obsession: 7 }],
    ['"你迟早会后悔"', { obsession: 8, passion: 6 }],
    ['其实我都能听进去', { light: 7, order: 8 }]
  ], { multi: 3 }],

  ['你身上有哪些是"自己也不太喜欢的"', [
    ['太在意别人的感受', { light: 8, mercy: 7 }],
    ['太不想麻烦别人', { bond: -8, light: 5 }],
    ['太容易相信人', { light: 9, order: -5 }],
    ['太不容易相信人', { light: -8, obsession: 6 }],
    ['其实我还挺喜欢自己', { light: 8, obsession: 6 }]
  ], { multi: 3 }],

  ['哪些事你会"做完了才告诉别人"', [
    ['换工作', { order: 9, bond: -5 }],
    ['做成了一件难事', { obsession: 9, light: 5 }],
    ['离开一个地方', { bond: -8, fate: 6 }],
    ['帮了一个人', { light: 9, obsession: -5 }],
    ['其实我什么都先说', { bond: 8, light: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你会"反复想"的', [
    ['我说过的一句重话', { light: -3, obsession: 9 }],
    ['一个我错过的人', { obsession: 9, bond: 6 }],
    ['一件没做完的事', { obsession: 9, order: 6 }],
    ['一个我没抓住的机会', { obsession: 8, passion: 5 }],
    ['其实我想完就过去了', { obsession: -8, light: 5 }]
  ], { multi: 3 }],

  ['你希望自己变成什么样', [
    ['更从容一点', { passion: -6, order: 7 }],
    ['更敢一点', { passion: 9, obsession: 8 }],
    ['更能放下', { obsession: -9, light: 6 }],
    ['更能照顾人', { light: 9, mercy: 8 }],
    ['其实现在的我也挺好', { light: 7, obsession: 5 }]
  ], { multi: 3 }],

  ['哪些情况下你会"装没事"', [
    ['在家人面前', { light: 6, bond: 6 }],
    ['在工作场合', { order: 8, light: 4 }],
    ['在喜欢的人面前', { bond: 7, light: 4 }],
    ['在一群不熟的人里', { bond: -6, light: -3 }],
    ['其实我很少装', { light: 8, order: 5 }]
  ], { multi: 3 }],

  ['你会因为哪些事"和一个人断掉"', [
    ['他踩了我的底线', { order: 9, obsession: 8 }],
    ['他一次次让我失望', { bond: -9, obsession: 6 }],
    ['他骗了我还觉得没什么', { light: -8, order: 9 }],
    ['他从来没把我当回事', { bond: -9, light: -4 }],
    ['其实我很难真的断掉', { bond: 8, light: 7 }]
  ], { multi: 3 }],

  ['下面哪些是你"一个人的时候才会做"的', [
    ['自言自语', { bond: -6, light: 5 }],
    ['认真做一顿饭', { order: 8, light: 5 }],
    ['把一件事反复演练', { obsession: 9, order: 6 }],
    ['什么都不做发呆', { passion: -8, obsession: -5 }],
    ['其实我一个人和有人时一样', { light: 5, order: 5 }]
  ], { multi: 3 }],

  ['哪些时刻你会"想放弃一切"', [
    ['事情堆到一起的时候', { sacrifice: 8, obsession: -5 }],
    ['被人误解又没人信的时候', { light: -5, bond: -5 }],
    ['努力很久没有结果的时候', { obsession: 8, sacrifice: 6 }],
    ['发现自己拖累了别人的时候', { light: 5, sacrifice: 9 }],
    ['其实我很少这样想', { light: 7, obsession: 6 }]
  ], { multi: 3 }],

  ['你更愿意和哪种人待在一起', [
    ['话不多但靠得住的人', { order: 9, light: 6 }],
    ['能一起说废话的人', { bond: 9, passion: 7 }],
    ['比我厉害能带我的人', { order: 8, fate: 6 }],
    ['需要我照顾的人', { light: 9, sacrifice: 8 }],
    ['其实我一个人待着最好', { bond: -10, obsession: 5 }]
  ], { multi: 3 }],

  ['你会对哪些事"提前做准备"', [
    ['一次重要的见面', { order: 10, obsession: 6 }],
    ['可能发生的坏结果', { order: 9, sacrifice: -7 }],
    ['一段长途出行', { order: 9, passion: -5 }],
    ['要花的钱', { order: 9, sacrifice: -6 }],
    ['其实我很少准备', { order: -9, passion: 6 }]
  ], { multi: 3 }],

  ['哪些是"看起来不强但其实很在意"的一点', [
    ['别人有没有回我消息', { bond: 8, light: -3 }],
    ['我做的事有没有被看见', { obsession: 8, light: 4 }],
    ['别人对我的评价', { obsession: 7, light: -4 }],
    ['我有没有拖累别人', { light: 8, sacrifice: 7 }],
    ['其实都不太在意', { light: 6, obsession: -7 }]
  ], { multi: 3 }],

  ['下面哪些是你会"主动承担"的', [
    ['没人愿意做的活', { sacrifice: 10, light: 7 }],
    ['一个说错话的场面', { light: 8, order: 6 }],
    ['替别人背下的锅', { sacrifice: 11, light: 8 }],
    ['一个烂摊子', { order: 10, obsession: 7 }],
    ['其实我很少主动承担', { sacrifice: -9, order: 5 }]
  ], { multi: 3 }],

  ['哪些是让你"愿意再来一次"的体验', [
    ['一次很难的挑战', { obsession: 10, passion: 7 }],
    ['一次很深的聊天', { bond: 9, light: 7 }],
    ['一次一个人走的远路', { fate: 8, obsession: 6 }],
    ['一次帮到别人的经历', { light: 10, mercy: 7 }],
    ['其实我不想再来一次', { obsession: -7, sacrifice: -5 }]
  ], { multi: 3 }],

  ['你身上有哪些是"从小被说过很多次的"', [
    ['你太懂事了', { light: 8, sacrifice: 8 }],
    ['你太倔了', { obsession: 10, order: 7 }],
    ['你想太多了', { obsession: 7, light: -4 }],
    ['你怎么这么慢', { order: 6, passion: -5 }],
    ['其实很少被说', { light: 5, order: 5 }]
  ], { multi: 3 }],

  ['哪些时刻你会"突然很想回家"', [
    ['在外面受了委屈', { bond: 9, light: 5 }],
    ['很累很累的时候', { sacrifice: 7, light: 5 }],
    ['过节的时候', { bond: 8, order: 6 }],
    ['吃到一道熟悉的菜', { bond: 8, light: 6 }],
    ['其实我不太想回', { bond: -9, order: 5 }]
  ], { multi: 3 }],

  ['你会为了哪些事"熬夜到天亮"', [
    ['把一个问题想清楚', { obsession: 10, order: 6 }],
    ['陪一个人', { bond: 10, light: 7 }],
    ['把活干完', { obsession: 9, order: 7 }],
    ['一部停不下来的作品', { passion: 8, obsession: 6 }],
    ['其实我很少熬到天亮', { order: 9, sacrifice: -6 }]
  ], { multi: 3 }],

  ['下面哪些是你"会主动道歉"的情况', [
    ['我确实错了', { order: 10, light: 7 }],
    ['虽然不全怪我，但我先低头', { light: 8, order: 6 }],
    ['对方是我在乎的人', { bond: 9, light: 7 }],
    ['不道歉会让事情更糟', { order: 9, light: 5 }],
    ['其实我很难开口道歉', { obsession: 7, light: -4 }]
  ], { multi: 3 }],

  ['哪些是你"不想再经历一次"的', [
    ['被人当众否定', { light: -5, obsession: 7 }],
    ['求人办事', { bond: -8, order: 5 }],
    ['等一个不确定的结果', { obsession: 8, order: 6 }],
    ['看着一个人离开', { bond: 8, light: 5 }],
    ['其实都还能再经历', { order: 6, light: 4 }]
  ], { multi: 3 }],

  ['你更愿意在哪些方面"被人需要"', [
    ['有事找我商量', { order: 8, light: 7 }],
    ['难过时找我', { bond: 9, light: 8 }],
    ['需要有人兜底时找我', { sacrifice: 10, light: 7 }],
    ['需要一个说实话的人时找我', { order: 9, light: 6 }],
    ['其实我不太想被需要', { bond: -9, sacrifice: -8 }]
  ], { multi: 3 }],

  ['哪些事你会"先替对方想好"', [
    ['他会不会为难', { light: 9, mercy: 8 }],
    ['他有没有时间', { order: 8, light: 6 }],
    ['他会不会多想', { light: 8, obsession: 5 }],
    ['他需不需要帮忙', { light: 9, bond: 7 }],
    ['其实我更多想自己', { light: -7, order: 6 }]
  ], { multi: 3 }],

  ['你身上有哪些"越看越明显"的', [
    ['我对某些事非常认真', { order: 10, obsession: 8 }],
    ['我其实很想被认可', { light: 6, obsession: 7 }],
    ['我其实很怕麻烦别人', { bond: -8, light: 5 }],
    ['我其实很能忍', { sacrifice: 9, order: 6 }],
    ['其实我没什么深浅', { light: 6, order: 4 }]
  ], { multi: 3 }],

  ['哪些时刻你会觉得"自己很值得"', [
    ['把一件难事做成了', { obsession: 10, light: 6 }],
    ['有人认真对我说谢谢', { light: 9, bond: 7 }],
    ['我守住了自己的底线', { order: 11, light: 6 }],
    ['我照顾好了某个人', { light: 10, sacrifice: 7 }],
    ['其实很少这样觉得', { light: -5, obsession: 6 }]
  ], { multi: 3 }],

  ['你会因为哪些原因"放弃一件事"', [
    ['它没有意义了', { obsession: -8, fate: 6 }],
    ['我做不到', { order: 5, light: -4 }],
    ['它伤害到别人了', { light: 9, mercy: 8 }],
    ['成本已经超过收获', { order: 10, obsession: -5 }],
    ['其实我很少放弃', { obsession: 11, sacrifice: 7 }]
  ], { multi: 3 }],

  ['哪些是你在"人多的场合"会做的', [
    ['观察每个人的关系', { order: 9, obsession: 6 }],
    ['照顾落单的人', { light: 10, mercy: 8 }],
    ['找一个人单独聊', { bond: 8, obsession: 5 }],
    ['早点找机会走', { bond: -8, passion: -5 }],
    ['其实我挺享受人多', { passion: 9, bond: 8 }]
  ], { multi: 3 }],

  ['下面哪些是你会"一个人想很久"的', [
    ['我到底想要什么', { obsession: 8, fate: 6 }],
    ['我是不是做错了', { light: -3, obsession: 8 }],
    ['他当时那句话是什么意思', { obsession: 9, bond: 5 }],
    ['接下来该怎么办', { order: 10, obsession: 6 }],
    ['其实我很少想这些', { obsession: -8, light: 5 }]
  ], { multi: 3 }],

  ['哪些是你会"默默记下来"的', [
    ['谁在我难的时候帮过我', { light: 9, bond: 8 }],
    ['谁在我难的时候没管我', { light: -6, obsession: 8 }],
    ['我答应过别人的事', { order: 11, light: 6 }],
    ['一件我要做但还没做的事', { obsession: 10, order: 7 }],
    ['其实我记性一般', { order: -6, light: 4 }]
  ], { multi: 3 }],

  ['你更愿意把"最好的一面"给谁看', [
    ['家人', { bond: 9, order: 6 }],
    ['朋友', { bond: 8, light: 6 }],
    ['喜欢的人', { passion: 8, bond: 8 }],
    ['谁也不给，我自己知道就行', { bond: -9, obsession: 6 }],
    ['其实我给谁看都一样', { light: 6, order: 4 }]
  ], { multi: 3 }],

  ['哪些事你会"做出计划但从不执行"', [
    ['早起', { order: 6, passion: -7 }],
    ['健身', { order: 7, sacrifice: -6 }],
    ['学一个新东西', { order: 7, passion: 5 }],
    ['联系一些老朋友', { bond: 7, light: 5 }],
    ['其实我定的计划一般都会执行', { order: 11, obsession: 7 }]
  ], { multi: 3 }],

  ['你身上有哪些"其实很矛盾但并存"的', [
    ['想要人陪又怕被打扰', { bond: 6, sacrifice: -4 }],
    ['想被认可又不想解释', { light: 5, bond: -5 }],
    ['想放松又停不下来', { obsession: 8, passion: -6 }],
    ['想争又觉得没必要', { obsession: -5, order: 6 }],
    ['其实我不怎么矛盾', { light: 6, order: 5 }]
  ], { multi: 3 }],

  ['哪些时刻你会"突然理解了一个人"', [
    ['他说了一句很轻的话', { light: 8, bond: 7 }],
    ['我看到他一个人待着', { light: 8, bond: 7 }],
    ['我自己经历了同样的事', { light: 7, obsession: 6 }],
    ['他做了一件我一直不理解的事', { light: 8, order: 6 }],
    ['其实我很少理解别人', { light: -6, bond: -6 }]
  ], { multi: 3 }],

  ['你会为哪些事"心甘情愿地排队"', [
    ['一家很好吃的店', { passion: 8, obsession: 6 }],
    ['一场演出或展览', { light: 7, passion: 8 }],
    ['一个限量但很想要的东西', { obsession: 9, passion: 7 }],
    ['给别人买的东西', { light: 9, bond: 7 }],
    ['其实我从不排队', { order: -7, passion: 5 }]
  ], { multi: 3 }],

  ['哪些是你会"自己扛下来"的', [
    ['经济上的压力', { sacrifice: 9, bond: -6 }],
    ['身体上的不舒服', { sacrifice: 8, light: 4 }],
    ['情绪上的低落', { bond: -7, light: 4 }],
    ['工作上的难题', { order: 9, obsession: 7 }],
    ['其实我都会说出来', { bond: 8, light: 6 }]
  ], { multi: 3 }],

  ['你更愿意在哪些事上"花心思"', [
    ['给别人准备礼物', { light: 9, bond: 8 }],
    ['把一件事做到最好', { order: 10, obsession: 9 }],
    ['维护一段关系', { bond: 9, light: 6 }],
    ['照顾自己的身体', { sacrifice: -9, order: 9 }],
    ['其实我不太花心思', { obsession: -7, order: -5 }]
  ], { multi: 3 }],

  ['哪些时刻你会"觉得自己没白活"', [
    ['有人因为我过得好一点', { light: 11, mercy: 8 }],
    ['我做成了别人说做不到的事', { obsession: 11, passion: 7 }],
    ['我终于放下了某件事', { obsession: -8, light: 7 }],
    ['我陪着一个人走过了难关', { light: 10, bond: 9 }],
    ['其实我常这样觉得', { light: 8, obsession: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你"不想承认但确实如此"的', [
    ['我有点怕被落下', { obsession: 7, bond: 6 }],
    ['我希望有人先开口', { bond: 8, light: 4 }],
    ['我其实挺在意输赢', { obsession: 9, passion: 6 }],
    ['我有时会装得很好', { light: -4, order: 5 }],
    ['其实我没什么不想承认的', { light: 7, order: 5 }]
  ], { multi: 3 }],

  ['哪些是你在"最难的时候"做过的事', [
    ['一个人待了很久', { bond: -7, obsession: 6 }],
    ['找人说了很久', { bond: 9, light: 6 }],
    ['把事硬做完了', { obsession: 10, sacrifice: 8 }],
    ['什么都不做，等它过去', { passion: -7, light: 4 }],
    ['其实我没经历过太难的时候', { light: 6, fate: 5 }]
  ], { multi: 3 }],

  ['你会因为哪些事"对一个人失望"', [
    ['他说话不算话', { order: 11, light: 5 }],
    ['他在利益面前变了', { light: -7, order: 8 }],
    ['他把我推出去挡了', { light: -4, sacrifice: 8 }],
    ['他一次次说下次', { obsession: 7, bond: -7 }],
    ['其实我很难对一个人失望', { light: 8, mercy: 7 }]
  ], { multi: 3 }],

  ['哪些是你会"主动给别人"的', [
    ['我的时间', { sacrifice: 10, light: 7 }],
    ['我的经验', { light: 8, order: 7 }],
    ['我的情绪价值', { light: 9, bond: 8 }],
    ['我的资源', { light: 8, order: 6 }],
    ['其实我不太主动给', { light: -7, bond: -5 }]
  ], { multi: 3 }],

  ['你身上有哪些是"改了很多次也没改掉"的', [
    ['爱操心', { light: 7, order: 7 }],
    ['爱记着一些事', { obsession: 9, light: -3 }],
    ['爱一个人扛', { sacrifice: 9, bond: -7 }],
    ['爱说是最后一次', { obsession: 7, light: -3 }],
    ['其实我改得都挺彻底', { order: 8, obsession: 5 }]
  ], { multi: 3 }],

  ['下面哪些是你"心里有答案但不愿承认"的', [
    ['这段关系已经到头了', { bond: -8, light: 4 }],
    ['这件事我做不成', { obsession: -7, light: 4 }],
    ['我其实需要人帮忙', { bond: 9, light: 6 }],
    ['我早该走了', { order: 8, fate: 6 }],
    ['其实我心里没什么藏着的事', { light: 7, order: 5 }]
  ], { multi: 3 }],

  ['哪些是你会"做一遍再决定要不要继续"的', [
    ['一件看起来很难的事', { obsession: 10, passion: 7 }],
    ['一段新的关系', { bond: 7, light: 6 }],
    ['一个新的城市', { fate: 8, passion: 6 }],
    ['一种新的生活方式', { order: -5, passion: 7 }],
    ['其实我很少试新东西', { order: 8, obsession: -5 }]
  ], { multi: 3 }],

  ['你更愿意在哪些方面"被别人记住"', [
    ['我说过的一句话', { light: 8, obsession: 7 }],
    ['我做过的一件事', { obsession: 9, order: 7 }],
    ['我给过的一次帮助', { light: 10, mercy: 8 }],
    ['我一直守着的那个东西', { order: 10, obsession: 9 }],
    ['其实我不需要被记住', { bond: -9, obsession: -6 }]
  ], { multi: 3 }]
];
