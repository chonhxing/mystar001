/**
 * 「炽热与冷静」轴 · 第一批。
 *
 * 炽热 = 先动起来、情绪当场出来、热血、冲
 * 冷静 = 先算一遍、压住、观察、延迟反应
 */

module.exports = [
  ['你被人当面挑衅，第一秒的反应是', [
    ['血往上涌，话已经出去了', { passion: 13, light: -4 }],
    ['先看他到底想干什么', { passion: -11, order: 8 }],
    ['笑一下，然后慢慢说', { passion: -6, order: 9, mercy: -3 }]
  ]],

  ['你看到一个很想买的东西，但有点贵', [
    ['喜欢就买，钱可以再赚', { passion: 12, order: -8 }],
    ['回去想三天，还想要就买', { passion: -11, order: 10 }],
    ['先加购物车，等降价', { passion: -6, order: 7, obsession: 4 }]
  ]],

  ['你的朋友在饭桌上说了句让你很不舒服的话', [
    ['当场就说回去', { passion: 12, light: -5, mercy: -6 }],
    ['先记住，回去再想', { passion: -9, obsession: 9 }],
    ['笑着说一句轻的，把意思带过去', { passion: 3, light: 5, mercy: -4 }]
  ]],

  ['你有一件想做的事，已经想了很多年', [
    ['今天就去做，不等了', { passion: 13, fate: 6, order: -6 }],
    ['先做三个月准备，再动', { passion: -11, order: 11 }],
    ['一边做一边准备', { passion: 4, obsession: 8 }]
  ]],

  ['你在一场争执里突然发现自己错了', [
    ['当场认，改口很快', { passion: 8, light: 9, order: 6 }],
    ['先把这轮说完，回头再改', { passion: -7, obsession: 7 }],
    ['心里认了，嘴上不说', { passion: -5, order: 5, light: -3 }]
  ]],

  ['有人在你面前哭得很伤心', [
    ['会跟着难受，眼眶也热', { passion: 11, light: 8, mercy: 8 }],
    ['先递纸，想想能做什么', { passion: -8, order: 8, light: 6 }],
    ['会有点不知所措，想走开', { passion: 5, bond: -7, mercy: -3 }]
  ]],

  ['你在一件事上被激到了', [
    ['越激我越要赢给你看', { passion: 13, obsession: 9 }],
    ['不接招，我做我的', { passion: -10, order: 9 }],
    ['不接招，但记下了', { passion: -6, obsession: 10 }]
  ]],

  ['你在一个需要当众发言的场合', [
    ['有点紧张，但很兴奋', { passion: 11, bond: 7 }],
    ['不喜欢，尽量简短', { passion: -8, obsession: 4 }],
    ['提前写好了再说', { passion: -6, order: 10 }]
  ]],

  ['你的一位朋友做了一件很冲动的事', [
    ['先帮他兜着，事后再骂他', { passion: 8, bond: 9, sacrifice: 7 }],
    ['当场拉住他', { passion: 6, order: 9, light: 5 }],
    ['看着他做完，然后收拾', { passion: -5, order: 7, light: 4 }]
  ]],

  ['你在一个需要快速决定的场合', [
    ['凭直觉，先定了再说', { passion: 12, fate: 7, order: -7 }],
    ['快速把关键信息过一遍', { passion: -8, order: 11 }],
    ['先问一句最要紧的那个问题', { passion: -3, order: 9, light: 4 }]
  ]],

  ['你被人夸的时候会', [
    ['当场就很高兴', { passion: 11, light: 6 }],
    ['客气两句，心里存着', { passion: -6, order: 6 }],
    ['会想他是不是有别的意思', { passion: -9, light: -4, obsession: 6 }]
  ]],

  ['你听到一首歌特别对味时会', [
    ['单曲循环一整天', { passion: 11, obsession: 8 }],
    ['记下名字，有空再听', { passion: -8, order: 7 }],
    ['直接发给一个人', { passion: 9, bond: 9 }]
  ]],

  ['你的情绪来得快吗', [
    ['快，去得也快', { passion: 12, light: 4 }],
    ['慢，但一上来就压不住', { passion: 6, obsession: 9 }],
    ['很少有明显情绪', { passion: -12, order: 8 }]
  ]],

  ['你在一件事上被人拖了后腿', [
    ['当场就有点火', { passion: 11, mercy: -6 }],
    ['先处理事，事后看他态度', { passion: -8, order: 9, light: 5 }],
    ['不说了，但心里给他降级', { passion: -7, obsession: 8 }]
  ]],

  ['你更愿意在什么状态下工作', [
    ['有感觉的时候，一口气做完', { passion: 12, order: -9 }],
    ['固定的时间，固定的量', { passion: -10, order: 12 }],
    ['deadline 前那一段', { passion: 9, order: -7, obsession: 6 }]
  ]],

  ['你在一件事上被拒绝了', [
    ['马上再问一次，问清楚理由', { passion: 12, obsession: 8 }],
    ['接受，回头再找别的方式', { passion: -8, order: 8 }],
    ['难受一会，然后放下', { passion: 2, obsession: -8 }]
  ]],

  ['有人在你面前做了一件很勇敢的事', [
    ['会热血上头，想跟着上', { passion: 13, light: 8 }],
    ['会佩服，但先看清风险', { passion: -9, order: 10 }],
    ['会担心他', { passion: 4, light: 7, mercy: 8 }]
  ]],

  ['你在一场争论里更在意', [
    ['把道理讲赢', { passion: 9, order: 10 }],
    ['别伤了感情', { passion: -7, light: 9, bond: 7 }],
    ['把事推进下去', { passion: 4, order: 8 }]
  ]],

  ['你在深夜里情绪会怎样', [
    ['更容易上头，容易做决定', { passion: 12, obsession: 8, order: -7 }],
    ['更冷静，白天想不通的晚上能想通', { passion: -11, order: 9 }],
    ['差不多，没什么区别', { passion: -4, light: 3 }]
  ]],

  ['你的一位朋友说话很直，常常得罪人', [
    ['喜欢，至少不装', { passion: 10, light: 5, mercy: -6 }],
    ['会劝他收敛一点', { passion: -6, order: 8, light: 6 }],
    ['离他远一点，怕被误伤', { passion: -8, bond: -8, light: -3 }]
  ]],

  ['你需要在一个陌生领域快速上手', [
    ['先动手，边做边学', { passion: 12, order: -8 }],
    ['先看别人怎么做，再上手', { passion: -10, order: 10 }],
    ['找一个会的人带着', { passion: -2, bond: 9, order: 6 }]
  ]],

  ['你在一件事上被人反复催促', [
    ['越催越烦，可能会顶回去', { passion: 12, mercy: -6 }],
    ['照自己的节奏来，不理他', { passion: -7, order: 9, obsession: 6 }],
    ['先给他一个交代，安抚一下', { passion: -3, light: 7, order: 6 }]
  ]],

  ['你更相信哪一种判断', [
    ['第一反应', { passion: 11, fate: 8 }],
    ['反复推演过的结论', { passion: -12, order: 11 }],
    ['问过别人之后的结论', { passion: -5, bond: 8, light: 4 }]
  ]],

  ['你在一件事上需要冒险', [
    ['该冒就冒，机会不等人', { passion: 13, fate: 8, order: -7 }],
    ['先把最坏的结果想清楚', { passion: -11, order: 11, sacrifice: -5 }],
    ['拉一个人一起承担', { passion: 3, bond: 10, light: 5 }]
  ]],

  ['你的一位朋友受了很大的委屈，但他说没事', [
    ['不信，继续追问', { passion: 10, bond: 9, light: 6 }],
    ['信他，但会留意', { passion: -5, order: 8, light: 6 }],
    ['他不说就算了', { passion: -7, bond: -5 }]
  ]],

  ['你在一个需要长时间等待的场合', [
    ['坐不住，会一直找事做', { passion: 10, order: -6 }],
    ['正好，安静一会儿', { passion: -9, obsession: -5 }],
    ['开始盘算接下来的事', { passion: -8, order: 10 }]
  ]],

  ['你在一件事上被人误解成"你太冲了"', [
    ['承认，我确实冲', { passion: 11, light: 4 }],
    ['不认，我只是不想拖', { passion: 6, order: 8 }],
    ['会反省，下次收一点', { passion: -8, light: 7, order: 6 }]
  ]],

  ['你会为了一个瞬间的冲动付出代价吗', [
    ['已经付过很多次了', { passion: 12, order: -9 }],
    ['不会，我会先算代价', { passion: -12, order: 11 }],
    ['小事上会，大事不会', { passion: 3, order: 7 }]
  ]],

  ['你在一场输掉的比赛之后', [
    ['想马上再来一次', { passion: 12, obsession: 10 }],
    ['回去复盘，想清楚输在哪', { passion: -8, order: 11 }],
    ['难受一阵，然后算了', { passion: -4, obsession: -7 }]
  ]],

  ['你在一个人面前会紧张吗', [
    ['会，而且藏不住', { passion: 11, light: 4 }],
    ['会紧张，但看起来很正常', { passion: -6, order: 8 }],
    ['很少紧张', { passion: -8, order: 6, obsession: -3 }]
  ]],

  ['你在一件事上被朋友泼了冷水', [
    ['不服，偏要做给他看', { passion: 13, obsession: 10, bond: -5 }],
    ['认真听，他说得可能对', { passion: -10, light: 7, order: 8 }],
    ['不当回事，继续做', { passion: 4, obsession: 7 }]
  ]],

  ['你在什么情况下最容易做错决定', [
    ['情绪上来的时候', { passion: 12, obsession: 6 }],
    ['太累的时候', { passion: -4, order: 7, sacrifice: 5 }],
    ['被别人影响的时候', { passion: 2, bond: 8, light: 4 }]
  ]],

  ['你看到不公平的事，会当场说出来吗', [
    ['会，忍不住', { passion: 13, light: 8, order: 5 }],
    ['不会，先看情况', { passion: -9, order: 9 }],
    ['会说，但用不伤人的方式', { passion: 4, light: 9, mercy: 7 }]
  ]],

  ['你更愿意记得哪一刻', [
    ['一个热血上头的瞬间', { passion: 12, fate: 6 }],
    ['一个想清楚之后的决定', { passion: -10, order: 9 }],
    ['一个什么都没做的下午', { passion: -8, obsession: -6 }]
  ]],

  ['你的朋友说你"想太多"', [
    ['可能吧，但我想的都是真的', { passion: -8, obsession: 9 }],
    ['不觉得，我只是想清楚再动', { passion: -9, order: 10 }],
    ['承认，然后试着少想一点', { passion: 6, light: 5 }]
  ]],

  ['你在一件事上需要当众认错', [
    ['当场就认，不拖', { passion: 11, light: 9, order: 7 }],
    ['先想好怎么说再认', { passion: -8, order: 10 }],
    ['认，但会先解释为什么', { passion: -2, order: 9, light: 4 }]
  ]],

  ['你在一场大雨里没带伞', [
    ['直接跑，淋湿就淋湿', { passion: 11, order: -6 }],
    ['找个地方等雨停', { passion: -9, order: 9 }],
    ['买把伞，或者叫车', { passion: -7, order: 8, light: -3 }]
  ]],

  ['你会因为一时心软做决定吗', [
    ['经常，事后会后悔', { passion: 10, light: 8, obsession: -4 }],
    ['很少，我心比较硬', { passion: -9, mercy: -7 }],
    ['会，但会给自己留条后路', { passion: 2, order: 8, light: 5 }]
  ]],

  ['你在一件事上被人抢了先', [
    ['会很不甘心', { passion: 11, obsession: 11 }],
    ['说明我慢了，下次快点', { passion: -5, order: 9 }],
    ['无所谓，谁做都一样', { passion: -8, obsession: -8 }]
  ]],

  ['你的情绪会影响你的判断吗', [
    ['会，而且我知道', { passion: 11, light: 4 }],
    ['不会，我会分开看', { passion: -12, order: 11 }],
    ['会，所以我会等一等再决定', { passion: -5, order: 9, obsession: 4 }]
  ]],

  ['你在一个需要临时救场的场合', [
    ['我来，给我三分钟', { passion: 13, obsession: 8 }],
    ['先问清楚缺什么，再决定谁上', { passion: -8, order: 10 }],
    ['会紧张，但还是会站出来', { passion: 8, light: 6, bond: 5 }]
  ]],

  ['你更怕哪一种', [
    ['错过', { passion: 12, fate: 7, obsession: 5 }],
    ['做错', { passion: -11, order: 11 }],
    ['什么都没做', { passion: 8, obsession: -4, light: 4 }]
  ]],

  ['你的朋友在深夜说想立刻去做一件很疯的事', [
    ['穿衣服，走', { passion: 13, bond: 9 }],
    ['先劝他睡一觉', { passion: -9, order: 10, light: 6 }],
    ['问他为什么突然想这么做', { passion: -5, mercy: 8, light: 6 }]
  ]],

  ['你在一件事上被人小看了', [
    ['马上就想证明给他看', { passion: 12, obsession: 10 }],
    ['不证明，做好自己的', { passion: -9, order: 8 }],
    ['记下来，等有一天', { passion: -5, obsession: 11 }]
  ]],

  ['你更愿意在哪一种状态下做重要决定', [
    ['睡一觉起来之后', { passion: -10, order: 10 }],
    ['当场，凭感觉', { passion: 12, fate: 8 }],
    ['跟人聊完之后', { passion: -4, bond: 8, light: 4 }]
  ]],

  ['你会因为一首歌、一部电影而改变想法吗', [
    ['会，经常被击中', { passion: 12, fate: 8, light: 5 }],
    ['不会，那些只是娱乐', { passion: -10, order: 9 }],
    ['会，但只持续几天', { passion: 4, obsession: -4 }]
  ]],

  ['你在一件事上被人质疑动机', [
    ['急着解释', { passion: 11, light: -3 }],
    ['不解释，做完自有公论', { passion: -8, order: 9, obsession: 6 }],
    ['反问一句：你为什么会这么想', { passion: -2, order: 8, light: 5 }]
  ]],

  ['你更愿意听哪一种音乐', [
    ['能把我点燃的', { passion: 11, light: 5 }],
    ['能让我安静下来的', { passion: -10, obsession: -4 }],
    ['看当天状态', { passion: -2, light: 3 }]
  ]],

  ['你在一件事上花了很久，突然想放弃', [
    ['不放弃，都到这一步了', { passion: 6, obsession: 13 }],
    ['放弃，沉没成本不是理由', { passion: -4, order: 11 }],
    ['停一停，过几天再看', { passion: -6, order: 8, light: 4 }]
  ]],

  ['你在一个需要连续熬夜的项目里', [
    ['能撑，越忙越来劲', { passion: 12, sacrifice: 9, obsession: 8 }],
    ['撑不住，必须睡', { passion: -8, sacrifice: -9, order: 6 }],
    ['靠咖啡硬扛', { passion: 5, sacrifice: 7, order: -3 }]
  ]],

  ['你在一个人面前会想表现得好一点吗', [
    ['会，很明显', { passion: 11, light: 5, bond: 5 }],
    ['不会，我懒得演', { passion: -8, obsession: -5 }],
    ['会，但不会让人看出来', { passion: -6, order: 8 }]
  ]],

  ['你更愿意相信哪一种直觉', [
    ['对一个人的第一印象', { passion: 9, fate: 8, light: 4 }],
    ['相处很久后的判断', { passion: -10, order: 10 }],
    ['别人对他的评价', { passion: -6, bond: 7, light: 3 }]
  ]],

  ['你在一件事上被人当众否定了', [
    ['当场反驳', { passion: 12, obsession: 7, order: -5 }],
    ['不反驳，用结果说话', { passion: -9, obsession: 10, order: 7 }],
    ['先问清楚他为什么这么想', { passion: -6, light: 7, order: 8 }]
  ]],

  ['你身上有没有"一点就着"的地方', [
    ['有，而且不少', { passion: 12, light: -4 }],
    ['很少，我很少失控', { passion: -11, order: 9 }],
    ['只在特定的事上', { passion: 3, obsession: 8 }]
  ]],

  ['你在一个需要长期忍耐的环境里', [
    ['忍不了，会想办法改', { passion: 11, order: -6 }],
    ['忍着，等时机', { passion: -8, obsession: 9, order: 8 }],
    ['一边忍一边往外走', { passion: -4, obsession: 8 }]
  ]],

  ['你更愿意怎么过生日', [
    ['叫上一堆人，闹一场', { passion: 12, bond: 10 }],
    ['一个人，安安静静', { passion: -11, bond: -10 }],
    ['和最亲近的一两个人吃顿饭', { passion: -3, bond: 8 }]
  ]],

  ['你在一件事上被人恭维了', [
    ['会高兴，但也会飘一下', { passion: 11, light: 5, order: -4 }],
    ['笑笑就过，不往心里去', { passion: -9, order: 9 }],
    ['会想他到底要什么', { passion: -7, obsession: 7, light: -4 }]
  ]],

  ['你在一个人多的场合会不会突然不想说话', [
    ['会，说没电就没电', { passion: -5, bond: -8 }],
    ['不会，我越多人越有劲', { passion: 12, bond: 10 }],
    ['会，但会撑到结束', { passion: -3, order: 8, light: 4 }]
  ]],

  ['你会因为一个人而破例吗', [
    ['会，而且破得很彻底', { passion: 12, bond: 10, order: -8 }],
    ['会，但只在底线之内', { passion: -5, order: 11 }],
    ['很难，规矩就是规矩', { passion: -9, order: 12 }]
  ]]
];
