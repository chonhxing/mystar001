/**
 * 「光与影」轴 · 第二批。
 * 场景尽量与第一批不重复：家庭、童年、学校、网络、陌生人、自我审视。
 */

module.exports = [
  ['你妈转发给你一条明显是谣言的养生文章', [
    ['认真找一篇靠谱的给她换过去', { light: 8, order: 8, bond: 7 }],
    ['回个「收到」，不点开', { light: -2, bond: -4, order: 3 }],
    ['直接说这是假的，让她别乱转', { light: 2, passion: 7, mercy: -7 }]
  ]],

  ['你在家族群里被人拿来和表弟比较', [
    ['笑着糊弄过去', { light: 4, order: 6, bond: 3 }],
    ['认真回一句：我们不一样', { passion: 8, light: 3, order: 5 }],
    ['不吭声，但心里记了很久', { light: -9, obsession: 9, bond: -5 }]
  ]],

  ['小时候你被老师冤枉过，很多年后同学还记得', [
    ['笑笑说早忘了', { light: 6, mercy: 5, obsession: -6 }],
    ['说其实我一直没忘', { obsession: 9, light: -2, bond: 5 }],
    ['借这个机会，把当年的事讲清楚', { light: 7, order: 7, passion: 5 }]
  ]],

  ['你带的小孩把家里的东西打碎了，然后说不是他', [
    ['先问他怕不怕，再谈这件事', { light: 10, mercy: 11, order: 5 }],
    ['当场戳穿，撒谎这件事必须管', { order: 11, light: -4, mercy: -6 }],
    ['什么都不说，看他接下来怎么做', { light: -3, order: 6, obsession: 5 }]
  ]],

  ['家里长辈说「我们都是为你好」', [
    ['听着，但不一定照做', { light: 5, order: 6, bond: 5 }],
    ['跟他们说说我真正想要什么', { light: 8, bond: 9, order: 4 }],
    ['听了，然后按他们说的做', { bond: 8, fate: 7, light: 3 }]
  ]],

  ['你在公交车上让了座，对方一句谢谢都没说', [
    ['无所谓，我让座不是给他看的', { light: 10, obsession: -6 }],
    ['下次不一定会让了', { light: -9, mercy: -6, obsession: 5 }],
    ['心里有点不舒服，但下次还是会让', { light: 6, mercy: 6 }]
  ]],

  ['网上有个和你观点完全相反的人，他说得还挺有条理', [
    ['认真读一遍，想想他哪里对', { light: 8, order: 9, obsession: -5 }],
    ['依然不同意，但理解他为什么这么想', { light: 7, mercy: 6, order: 6 }],
    ['划走，道不同不相为谋', { light: -7, bond: -6, order: 4 }]
  ]],

  ['一个朋友总在深夜给你发很长的负能量消息', [
    ['每次都回，哪怕自己也很累', { light: 8, bond: 8, sacrifice: 11 }],
    ['告诉他我接不住了，但我还在', { light: 9, mercy: 9, order: 6 }],
    ['设置消息免打扰', { light: -7, bond: -8, sacrifice: -6 }]
  ]],

  ['你的同事在背后替你说了一句好话，你后来才知道', [
    ['当面谢他，把这份情记下', { light: 9, bond: 9, order: 5 }],
    ['不点破，以后有好事想着他', { light: 6, bond: 6, obsession: 4 }],
    ['心里一暖，然后照常相处', { light: 5, bond: 4, passion: -4 }]
  ]],

  ['你在深夜想起一件很多年前做过的、对不起别人的事', [
    ['想办法联系他，说一声', { light: 9, order: 9, bond: 7 }],
    ['在心里道个歉，然后睡觉', { light: 5, obsession: 6, mercy: 5 }],
    ['翻来覆去，越想越难受', { obsession: 12, light: -5, passion: -6 }]
  ]],

  ['一个你觉得人品一般的人，今天帮了你大忙', [
    ['谢他，一码归一码', { light: 8, order: 9, mercy: 5 }],
    ['谢他，但心里那杆秤没变', { light: 2, order: 7, obsession: 6 }],
    ['重新想一想，也许我一直看错了他', { light: 10, mercy: 8, order: -4 }]
  ]],

  ['你被误解了，但解释起来要花很多力气', [
    ['解释，哪怕花一晚上', { light: 6, order: 8, passion: 8 }],
    ['算了，信我的人不需要解释', { light: -4, bond: -6, obsession: -5 }],
    ['只跟最在乎的那个人解释', { light: 5, bond: 8, order: 5 }]
  ]],

  ['排队时你发现前面的人少付了钱，收银员没察觉', [
    ['提醒收银员', { light: 10, order: 10 }],
    ['不吭声，那是他们的事', { light: -9, order: -5 }],
    ['如果那人明显很拮据就算了', { light: 3, mercy: 8, order: 3 }]
  ]],

  ['一个陌生人问你能不能帮他拍张照，手机挺贵的', [
    ['接过手机，认真帮他拍几张', { light: 9, bond: 5, order: 5 }],
    ['帮他拍，但心里有点防着', { light: 2, order: 7, passion: -3 }],
    ['说不太方便', { light: -8, bond: -6 }]
  ]],

  ['你在楼道里捡到一串钥匙，上面没有联系方式', [
    ['挂在一楼显眼的地方，再写张纸条', { light: 10, order: 9 }],
    ['交给物业', { order: 11, light: 4 }],
    ['放回原处，也许人家一会就回来找', { light: 3, order: 2, obsession: -5 }]
  ]],

  ['你的朋友在饭桌上被人当众开了一个过分的玩笑', [
    ['替他接一句，把玩笑化掉', { light: 9, bond: 9, mercy: 7 }],
    ['当场把话挑明，让对方下不来台', { light: -3, passion: 10, mercy: -6 }],
    ['低头吃饭，他自己的事', { light: -8, bond: -8 }]
  ]],

  ['有人在你最忙的时候来问你一个很琐碎的问题', [
    ['停下来，认真回答', { light: 8, mercy: 8, sacrifice: 6 }],
    ['让他等我十分钟', { order: 9, light: 3 }],
    ['直接说没空', { light: -6, bond: -5, order: 5 }]
  ]],

  ['你的一个朋友在骗另一个朋友，被骗的那个也是你朋友', [
    ['告诉被骗的那个', { light: 8, order: 10, bond: -4 }],
    ['先私下劝骗人的那个收手', { light: 9, mercy: 8, bond: 7 }],
    ['谁都不说，我不该卷进去', { light: -6, bond: -5, order: 3 }]
  ]],

  ['你骑车时被人别了一下', [
    ['按铃，让他知道我在', { passion: 9, order: 5, light: -4 }],
    ['减速让他走，安全第一', { light: 7, order: 10, passion: -7 }],
    ['跟上去看看是什么人', { light: -8, obsession: 9, passion: 8 }]
  ]],

  ['你的一位前辈当年对你说过一句很重的话', [
    ['谢谢他，那句话确实管用', { light: 8, order: 8, bond: 5 }],
    ['到现在还是不能接受', { light: -6, obsession: 9, mercy: -5 }],
    ['当时恨他，后来懂了', { light: 6, order: 7, obsession: 4 }]
  ]],

  ['在一个全是陌生人的场合，需要有人先开口', [
    ['我先来，反正没人认识我', { light: 7, passion: 10, bond: 6 }],
    ['等别人先开口', { light: -3, bond: -5, order: 4 }],
    ['先观察一圈，再决定要不要开口', { order: 9, light: 2, passion: -6 }]
  ]],

  ['你帮了别人一个大忙，他到处跟人说你多好', [
    ['有点不好意思，让他别说了', { light: 6, mercy: 5, bond: -3 }],
    ['随他说，能帮到就好', { light: 8, obsession: -6 }],
    ['不太舒服，帮忙本来不是为了让别人知道', { light: 7, order: 7, obsession: 4 }]
  ]],

  ['你身上有一件从没跟任何人说过的事', [
    ['偶尔想说出来，但一直没说', { light: 3, bond: 4, obsession: 6 }],
    ['就这样带着，也挺好', { light: 5, obsession: -5, bond: -6 }],
    ['等一个真正值得说的人', { light: 6, bond: 8, fate: 5 }]
  ]],

  ['你在网上被人误解并且骂了，很多人跟着骂', [
    ['一条条解释，讲道理', { order: 8, light: 5, passion: 7 }],
    ['关掉手机，不看了', { light: 3, passion: -8, obsession: -6 }],
    ['删号，重新开始', { light: -5, bond: -8, obsession: 6 }]
  ]],

  ['邻居半夜还在装修，你去敲门', [
    ['客客气气地说，请他明天白天再弄', { light: 9, order: 9, mercy: 5 }],
    ['开口就带着火', { passion: 10, light: -5, mercy: -8 }],
    ['不敲，直接找物业', { order: 10, light: 2, bond: -4 }]
  ]],

  ['一个你曾经帮过的人，在你需要的时候消失了', [
    ['理解，人都有自己的难处', { light: 9, mercy: 9, obsession: -6 }],
    ['不再联系了，也不会再帮', { light: -8, bond: -7, order: 5 }],
    ['直接问他当时去哪了', { light: 3, order: 8, passion: 6 }]
  ]],

  ['你在深夜收到一条陌生人发来的「谢谢你」', [
    ['回一句不客气，虽然不知道是谁', { light: 9, mercy: 6 }],
    ['想半天是谁', { obsession: 9, light: 3 }],
    ['不回，大概是发错了', { light: -5, bond: -4, order: 4 }]
  ]],

  ['你的一个决定让一个无辜的人受了损失', [
    ['想办法补偿，哪怕他永远不知道是我', { light: 11, order: 9, sacrifice: 6 }],
    ['补偿，并且当面告诉他', { light: 9, order: 10, bond: 5 }],
    ['补偿不了就算了，往前走', { light: -4, obsession: -7, mercy: -5 }]
  ]],

  ['朋友说「你变了」，语气不太像夸你', [
    ['问他哪里变了', { light: 6, bond: 7, order: 6 }],
    ['不解释，人本来就会变', { light: 3, bond: -6, obsession: -6 }],
    ['心里被戳了一下，回去想了很久', { light: -4, obsession: 9, bond: 5 }]
  ]],

  ['你在整理旧物时翻到一封很多年前的信', [
    ['坐下来读完，然后好好收起来', { light: 7, bond: 8, obsession: 6 }],
    ['看一眼就合上，过去的事了', { light: 4, obsession: -8 }],
    ['直接扔掉', { light: -3, bond: -8, obsession: -5 }]
  ]],

  ['一个和你关系一般的人出了事，大家在群里商量要不要凑钱', [
    ['第一个转账，不说什么', { light: 10, mercy: 9, bond: 7 }],
    ['跟大家一起随个份', { light: 4, order: 6, bond: 4 }],
    ['不参与，我们没那么熟', { light: -8, bond: -6 }]
  ]],

  ['你答应了一件做不到的事，现在要去解释', [
    ['早点说，越晚越糟', { light: 7, order: 11 }],
    ['想办法硬撑下来', { light: 6, obsession: 11, sacrifice: 8 }],
    ['拖着，也许对方就忘了', { light: -10, order: -8, passion: -5 }]
  ]],

  ['有人夸你的朋友，比夸你自己更让你高兴', [
    ['对，就是这样', { light: 11, bond: 10 }],
    ['替朋友高兴，但也希望有人夸我', { light: 5, bond: 6, obsession: 4 }],
    ['心里有点不是滋味', { light: -6, obsession: 8, bond: -4 }]
  ]],

  ['会议方案里有个明显漏洞，但提出它会拖慢进度', [
    ['当场提，宁可晚一天', { order: 11, light: 7, passion: -4 }],
    ['会后单独跟负责人说', { order: 9, light: 5, bond: 5 }],
    ['不提，出了问题再说', { light: -9, order: -8 }]
  ]],

  ['你的一位朋友相信你完全不认同的东西', [
    ['尊重，各信各的', { light: 8, order: 8, mercy: 5 }],
    ['跟他辩论，哪怕伤感情', { light: -5, passion: 8, mercy: -7 }],
    ['嘴上不说，心里觉得他有点傻', { light: -7, mercy: -6, obsession: 5 }]
  ]],

  ['你在等一个结果，已经等了很久，还没有消息', [
    ['继续等，我相信会有', { light: 8, fate: 9, obsession: 6 }],
    ['先去忙别的，来了再说', { light: 4, obsession: -8, order: 5 }],
    ['已经开始准备最坏的打算', { light: -6, order: 9, passion: -4 }]
  ]],

  ['你发现你的善意对一个特定的人完全没有作用', [
    ['不勉强了，换个方式或者走开', { light: 5, order: 7, obsession: -6 }],
    ['还是继续，总有一天会有用', { light: 9, obsession: 9, sacrifice: 5 }],
    ['从此不再对这个人心软', { light: -11, mercy: -9, obsession: 6 }]
  ]],

  ['你的手机里存着一些你永远不会再联系的人', [
    ['删掉，清爽', { light: -3, order: 7, obsession: -6 }],
    ['留着，万一呢', { light: 4, obsession: 7, fate: 4 }],
    ['留着，但从不看', { light: 2, obsession: 4, bond: -3 }]
  ]],

  ['你在一家店里看到老板对员工很凶', [
    ['看不下去，结完账就走，下次不来', { light: 5, order: 6, mercy: 6 }],
    ['多说一句：没必要这样吧', { light: 8, mercy: 9, passion: 7 }],
    ['装作没看见，人家的事', { light: -8, bond: -5 }]
  ]],

  ['有人请你去评价他的作品，你觉得很一般', [
    ['先说好的地方，再说能改的', { light: 9, mercy: 8, order: 4 }],
    ['直接说哪里不行', { light: 2, order: 7, mercy: -8 }],
    ['说挺好的，然后什么都不再提', { light: -3, mercy: 5, order: -4 }]
  ]],

  ['你被安排和一个你很讨厌的人合作', [
    ['把事做完，别的不管', { order: 11, light: 4, bond: -4 }],
    ['试着找找他的优点', { light: 8, mercy: 7, order: 4 }],
    ['做，但处处留一手', { light: -8, order: 6, obsession: 7 }]
  ]],

  ['你在电梯里遇到一个刚哭过的人', [
    ['递张纸，什么都不问', { light: 10, mercy: 10, bond: 5 }],
    ['问一句你还好吗', { light: 8, mercy: 8, passion: 5 }],
    ['看自己的手机', { light: -7, mercy: -5 }]
  ]],

  ['你的一个朋友总在关键时刻消失，但平时特别热情', [
    ['跟他把这件事说清楚', { light: 6, order: 8, bond: 6 }],
    ['降温处理，不再指望他', { light: -5, bond: -7, order: 6 }],
    ['想想是不是自己要求太多', { light: 7, mercy: 7, obsession: 5 }]
  ]],

  ['你被分到一份明显不公平的任务', [
    ['当场提出来，讲清楚道理', { order: 10, passion: 7, light: 3 }],
    ['做了，但让大家看见是我做的', { order: 8, light: -5, obsession: 6 }],
    ['做完就走，不争', { light: 4, obsession: -6, bond: -5 }]
  ]],

  ['你的努力没有人在意，但你还是每天在做', [
    ['我做这件事本来就不是为了被看见', { light: 8, obsession: 10, fate: 5 }],
    ['会累，但停不下来', { obsession: 11, sacrifice: 7, light: 4 }],
    ['开始怀疑值不值得', { light: -6, obsession: -8, passion: -5 }]
  ]],

  ['有人在你面前炫耀，而你正好在那件事上很失败', [
    ['真心夸他，自己的事自己消化', { light: 10, mercy: 7, obsession: -5 }],
    ['附和两句，然后转移话题', { light: 3, order: 5, bond: -3 }],
    ['心里很难受，回家想了很久', { light: -7, obsession: 9, bond: -4 }]
  ]],

  ['你在图书馆提醒一个大声说话的人', [
    ['用最小的声音说，客气地', { light: 8, order: 10, mercy: 5 }],
    ['直接说，声音比他大', { passion: 9, order: 8, light: -3 }],
    ['忍着，等他自己发现', { light: 2, passion: -8, order: 3 }]
  ]],

  ['朋友做了件会让你很没面子的事，他自己没意识到', [
    ['当场提醒他', { light: 4, order: 8, bond: 5 }],
    ['事后跟他说', { light: 8, bond: 8, order: 7 }],
    ['算了，面子没那么重要', { light: 7, obsession: -7, bond: 5 }]
  ]],

  ['你要把一个坏消息告诉一个很期待的人', [
    ['直接说，长痛不如短痛', { order: 10, light: 3, mercy: -5 }],
    ['先铺垫，慢慢说', { light: 7, mercy: 10, order: 4 }],
    ['让别人去说', { light: -10, mercy: -6, bond: -7 }]
  ]],

  ['你在一段关系里一直是付出的那个', [
    ['说出来，让对方看见', { light: 6, bond: 8, order: 7 }],
    ['继续付出，我甘愿', { light: 9, sacrifice: 11, obsession: 6 }],
    ['慢慢往回收', { light: -6, bond: -8, order: 5 }]
  ]],

  ['你在深夜想：如果没人知道我做的这件好事，我还会做吗', [
    ['会，本来就不是做给人看的', { light: 12, obsession: -5 }],
    ['不知道，可能就不会了', { light: -6, order: 6, obsession: 4 }],
    ['会，但心里会有点空', { light: 5, bond: 5, mercy: 4 }]
  ]],

  ['一个曾经误解你的人，现在明白过来了，但他没道歉', [
    ['不用他道歉，明白就好', { light: 11, mercy: 8, obsession: -6 }],
    ['等他一句话', { light: -3, obsession: 9, order: 5 }],
    ['主动去找他，把这件事翻过去', { light: 8, order: 7, bond: 6 }]
  ]],

  ['有人对你说「你这样会吃亏的」', [
    ['那就吃亏吧', { light: 8, obsession: 6, order: -6 }],
    ['认真想一想他说得对不对', { light: 5, order: 10 }],
    ['我会吃亏，但不是因为傻', { light: 7, order: 8, passion: 4 }]
  ]],

  ['你在做一个没有人理解的选择', [
    ['不需要被理解', { light: 3, obsession: 11, bond: -6 }],
    ['找一个能理解的人聊聊', { light: 6, bond: 9, mercy: 5 }],
    ['还是希望有一天他们能懂', { light: 7, bond: 8, fate: 5 }]
  ]],

  ['你在陌生的城市迷路了，手机没电', [
    ['找个人问路，不怕麻烦别人', { light: 8, bond: 7, passion: 5 }],
    ['凭感觉走，走错了再说', { light: 4, passion: 8, order: -7 }],
    ['走进一家店，借个充电的地方', { order: 9, light: 4, bond: 4 }]
  ]],

  ['你被一个你很尊敬的人批评了', [
    ['认真听完，问清哪里不对', { light: 7, order: 11 }],
    ['表面上接受，心里不服', { light: -5, obsession: 8, order: -5 }],
    ['难受了很久，反复想他那句话', { light: -3, obsession: 10, mercy: 4 }]
  ]],

  ['你发现自己越来越难被感动了', [
    ['有点怕，想找回那种感觉', { light: 8, mercy: 7, obsession: 6 }],
    ['正常，人长大就是这样', { light: -4, order: 7, passion: -6 }],
    ['不觉得有什么问题', { light: -6, obsession: -5, mercy: -6 }]
  ]],

  ['如果有人能替你承担一半的痛苦，你会不会答应', [
    ['不会，那是我的', { light: 6, obsession: 8, sacrifice: 10 }],
    ['会，我也没有那么强', { light: 5, bond: 8, sacrifice: -8 }],
    ['看是谁，如果他也愿意', { light: 7, bond: 7, order: 5 }]
  ]]
];
