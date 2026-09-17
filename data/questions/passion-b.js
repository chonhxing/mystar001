/**
 * 「炽热与冷静」轴 · 第二批。
 * 场景偏"慢下来的时刻"：观察、忍耐、权衡、以及失控之后的收拾。
 */

module.exports = [
  ['你在一家店里等餐等了很久，会上火吗', [
    ['会，超过二十分钟就要问', { passion: 11, order: 6 }],
    ['不会，反正也不急', { passion: -10, order: 3 }],
    ['会，但不会说出口', { passion: -2, obsession: 7 }]
  ]],

  ['你在一条很长的队伍里会做什么', [
    ['盘算要不要换个窗口', { passion: 6, order: 9 }],
    ['安静等着，看看周围的人', { passion: -9, light: 4 }],
    ['戴上耳机，时间过得快一点', { passion: -7, obsession: -3 }]
  ]],

  ['你被人问了一个很尖锐的问题', [
    ['直接答，不怕得罪人', { passion: 11, light: 3, mercy: -6 }],
    ['先想两秒再答', { passion: -9, order: 10 }],
    ['反问回去', { passion: 5, obsession: 7, order: 4 }]
  ]],

  ['你在半夜突然想起一件白天的事，会不会睡不着', [
    ['会，越想越清醒', { passion: 5, obsession: 12 }],
    ['不会，翻个身就睡', { passion: -8, obsession: -9 }],
    ['会，但我知道明天就好了', { passion: -3, order: 8, light: 4 }]
  ]],

  ['你在一件事上被人反复拖延', [
    ['会直接找上门', { passion: 12, order: 7 }],
    ['再等一次，最后一次', { passion: -8, order: 9, light: 5 }],
    ['不等了，换人', { passion: 4, order: 10, bond: -5 }]
  ]],

  ['你在看一场比赛时会', [
    ['喊出来，站起来', { passion: 13, bond: 7 }],
    ['安静看，心里紧张', { passion: -6, obsession: 8 }],
    ['分析战术，猜下一步', { passion: -10, order: 10 }]
  ]],

  ['你在一件事上被朋友骗了一次', [
    ['当场翻脸', { passion: 12, bond: -10 }],
    ['先确认是不是误会', { passion: -8, order: 10, light: 6 }],
    ['记着，慢慢疏远', { passion: -6, obsession: 10, bond: -8 }]
  ]],

  ['你在一件很紧急的事上需要冷静', [
    ['越急我越冷静', { passion: -6, order: 13, fate: 5 }],
    ['冷静不了，先冲上去', { passion: 13, light: 5 }],
    ['需要有人喊我一声', { passion: 4, bond: 8 }]
  ]],

  ['你在一个需要谈判的场合', [
    ['直接把底牌摊开', { passion: 11, light: 7, order: -6 }],
    ['先听对方说，摸清底细', { passion: -10, order: 11 }],
    ['看气氛，随机应变', { passion: 3, light: 5, obsession: 4 }]
  ]],

  ['你在一件事上被人反复打扰', [
    ['会直接说，别烦我', { passion: 12, mercy: -7 }],
    ['把手机关了', { passion: -7, order: 8 }],
    ['一次次回应，只是越来越短', { passion: -5, light: 6, obsession: 5 }]
  ]],

  ['你会不会因为一句话就把一个人判死', [
    ['会，一句话够了', { passion: 9, obsession: 11, mercy: -8 }],
    ['不会，会再多看几次', { passion: -9, light: 8, order: 7 }],
    ['会记住，但不下结论', { passion: -6, obsession: 9 }]
  ]],

  ['你在做一件需要极大耐心的事', [
    ['能做，但会烦躁', { passion: 5, obsession: 8, order: 5 }],
    ['能沉进去，时间过得很快', { passion: -10, obsession: 9 }],
    ['做不了，会找人分担', { passion: 4, bond: 9, order: -5 }]
  ]],

  ['你的情绪写在脸上吗', [
    ['写，藏不住', { passion: 12, light: 5 }],
    ['不写，习惯了', { passion: -11, order: 9 }],
    ['熟人看得出来', { passion: -2, bond: 7 }]
  ]],

  ['你在一个需要拒绝别人的场合', [
    ['直接说不行', { passion: 11, mercy: -7 }],
    ['找个委婉的说法', { passion: -8, light: 8, order: 5 }],
    ['拖着不回答', { passion: -6, order: -5, light: -4 }]
  ]],

  ['你在一件事上花了很多情绪', [
    ['值得，投入过才有感觉', { passion: 12, light: 6 }],
    ['不值，情绪是最没用的东西', { passion: -11, order: 9 }],
    ['当时觉得值，现在不确定', { passion: 2, obsession: 6 }]
  ]],

  ['你在一个需要说服别人的场合', [
    ['用热情带动他', { passion: 12, bond: 8, light: 6 }],
    ['摆事实、列数据', { passion: -10, order: 12 }],
    ['找一个他信任的人来说', { passion: -6, bond: 9, light: 4 }]
  ]],

  ['你在一件事上被人吊着胃口', [
    ['受不了，直接问到底行不行', { passion: 12, order: 6 }],
    ['能等，反正不急', { passion: -9, obsession: -6 }],
    ['会开始准备别的方案', { passion: -5, order: 10 }]
  ]],

  ['你在一个人多的饭局上被人一直灌酒（或劝）', [
    ['直接拒绝，不解释', { passion: 11, order: 7, mercy: -6 }],
    ['找理由推，能推几轮推几轮', { passion: -6, light: 6, order: 5 }],
    ['陪到底，不想扫兴', { passion: 6, bond: 9, light: 7 }]
  ]],

  ['你在一件事上突然失去兴趣', [
    ['马上停，不勉强自己', { passion: 9, obsession: -11 }],
    ['再撑一阵，也许只是暂时的', { passion: -6, obsession: 10 }],
    ['换个方式再做一次', { passion: 5, order: 6, obsession: 5 }]
  ]],

  ['你在看完一部很长的作品之后', [
    ['会空落落一阵', { passion: 9, obsession: 9, light: 5 }],
    ['立刻找下一部', { passion: 5, obsession: -6 }],
    ['会去查所有相关的资料', { passion: -3, obsession: 10, order: 8 }]
  ]],

  ['你在一件事上需要别人配合，但对方很慢', [
    ['会催，而且催得很勤', { passion: 11, order: 8 }],
    ['按他的节奏来', { passion: -8, mercy: 7, light: 5 }],
    ['自己先把能做的做完', { passion: -3, order: 10, sacrifice: 6 }]
  ]],

  ['你在一个瞬间被人看穿了情绪', [
    ['会有点恼', { passion: 10, light: -4 }],
    ['不介意，反正也没想藏', { passion: -6, light: 6 }],
    ['会立刻收回来', { passion: -8, order: 8 }]
  ]],

  ['你在做一件需要冒险的事之前', [
    ['心跳加快，但很兴奋', { passion: 12, fate: 7 }],
    ['把每一步在脑子里过一遍', { passion: -11, order: 12 }],
    ['找个人说说话，缓解一下', { passion: -3, bond: 9 }]
  ]],

  ['你在一件事上被人踩了底线', [
    ['当场就炸', { passion: 13, order: 5 }],
    ['冷下来，然后处理', { passion: -10, order: 11 }],
    ['走开，不跟他一般见识', { passion: -8, light: 6 }]
  ]],

  ['你在一个需要快速反应的游戏里', [
    ['冲在最前面', { passion: 12, light: 5 }],
    ['在后面观察，找机会', { passion: -10, order: 9 }],
    ['配合别人，看队形', { passion: -7, bond: 9 }]
  ]],

  ['你在一件事上被人抢了功劳', [
    ['当场就提出来', { passion: 12, order: 8 }],
    ['私下找他谈', { passion: -8, light: 6, order: 8 }],
    ['算了，下次注意', { passion: -9, obsession: -4, light: 4 }]
  ]],

  ['你的耐心通常能撑多久', [
    ['很久，我可以一直等', { passion: -11, obsession: 9 }],
    ['不长，超过三次就走', { passion: 9, order: 8 }],
    ['看对方是谁', { passion: -2, light: 5 }]
  ]],

  ['你在一个人跟你讲道理讲了很久时会', [
    ['听到一半就打断他', { passion: 11, order: -5 }],
    ['听完，再一起梳理', { passion: -9, order: 11, light: 5 }],
    ['表面在听，心里已经决定', { passion: -4, obsession: 8 }]
  ]],

  ['你在一件事上被人说"你太急了"', [
    ['认，我确实急', { passion: 11, light: 4 }],
    ['不认，是你们太慢', { passion: 9, order: 6, mercy: -5 }],
    ['会想一想他说得有没有道理', { passion: -8, light: 7, order: 6 }]
  ]],

  ['你在一个需要长时间专注的下午', [
    ['状态好，能连着干四小时', { passion: 6, obsession: 9, order: 6 }],
    ['会不断分心，需要休息', { passion: -4, order: -6 }],
    ['放点音乐就能进入状态', { passion: 2, light: 4 }]
  ]],

  ['你在一件事上被人当众嘲笑', [
    ['当场就回敬', { passion: 13, light: -6, mercy: -7 }],
    ['笑一笑，不接', { passion: -7, order: 7, light: 5 }],
    ['脸上没什么，心里记很久', { passion: -5, obsession: 11 }]
  ]],

  ['你在一个很热的天气里会', [
    ['烦，什么都做不下去', { passion: 10, order: -6 }],
    ['照常做事，热就热', { passion: -8, order: 9 }],
    ['想办法换个环境', { passion: 3, order: 7 }]
  ]],

  ['你在一件事上需要放弃已有的成果', [
    ['舍不得，但该放就放', { passion: -3, order: 9, obsession: -6 }],
    ['绝不放弃，那是我的心血', { passion: 8, obsession: 13 }],
    ['留着，同时开新的', { passion: -2, order: 7, obsession: 6 }]
  ]],

  ['你在一次告别之后会', [
    ['难受好几天', { passion: 10, light: 6 }],
    ['第二天就恢复正常', { passion: -9, obsession: -7 }],
    ['会主动联系，不想断', { passion: 6, bond: 11 }]
  ]],

  ['你在一件事上被人质疑能力', [
    ['马上想证明自己', { passion: 12, obsession: 9 }],
    ['不解释，用结果说话', { passion: -9, obsession: 10 }],
    ['认真问清楚他为什么这么看', { passion: -8, light: 7, order: 7 }]
  ]],

  ['你在做一件重复的事久了会', [
    ['烦躁，想找点新的', { passion: 10, order: -7 }],
    ['进入心流，反而踏实', { passion: -9, obsession: 8 }],
    ['边做边想别的', { passion: -4, light: 3 }]
  ]],

  ['你在一个需要即时回应的对话里', [
    ['反应很快，话接得住', { passion: 11, bond: 6 }],
    ['会慢半拍，但说得更准', { passion: -9, order: 9 }],
    ['更愿意听完再一起说', { passion: -6, order: 8, light: 4 }]
  ]],

  ['你在一件事上被人误会成"冷漠"', [
    ['不认，我心里其实很热', { passion: 8, light: 6 }],
    ['认，我确实不太外露', { passion: -9, order: 7 }],
    ['无所谓别人怎么看', { passion: -7, obsession: -5 }]
  ]],

  ['你在一个人需要安慰的时候', [
    ['会先抱一下他', { passion: 11, light: 9, bond: 9 }],
    ['会先问他要不要说说', { passion: -6, light: 8, order: 6 }],
    ['会想办法解决他的问题', { passion: -8, order: 10, light: 6 }]
  ]],

  ['你在深夜做的决定，第二天会后悔吗', [
    ['经常后悔', { passion: 11, order: -8, obsession: 5 }],
    ['从不，晚上做的决定也是我做的', { passion: 6, obsession: 9, fate: 5 }],
    ['尽量不在晚上做决定', { passion: -10, order: 12 }]
  ]],

  ['你在一件事上被人不断施压', [
    ['越压越硬', { passion: 12, obsession: 10 }],
    ['先顺着，再找机会', { passion: -9, order: 10, light: -3 }],
    ['直接摊牌', { passion: 8, light: 7, order: 5 }]
  ]],

  ['你在一个需要长期投入的项目里', [
    ['靠热情撑着', { passion: 11, fate: 6 }],
    ['靠习惯和计划', { passion: -11, order: 12 }],
    ['靠和同伴互相打气', { passion: 2, bond: 10, light: 5 }]
  ]],

  ['你在一件事上被人当场反驳', [
    ['马上接话，声音也大了', { passion: 12, mercy: -6 }],
    ['让他说完，再一条条回', { passion: -10, order: 11 }],
    ['先记下来，会后再说', { passion: -7, order: 9, obsession: 6 }]
  ]],

  ['你会不会因为一时兴起改变一整天的安排', [
    ['会，而且经常', { passion: 12, order: -10 }],
    ['不会，安排好了就按着来', { passion: -11, order: 12 }],
    ['会，但只在小事上', { passion: 4, order: 6 }]
  ]],

  ['你在一件事上被人说"想得太简单"', [
    ['简单有什么不好', { passion: 9, order: -5, light: 5 }],
    ['那我去想细一点', { passion: -9, order: 11 }],
    ['先按简单的做，错了再补', { passion: 5, order: 4, light: 4 }]
  ]],

  ['你在一个人面前会不会紧张到说错话', [
    ['会，而且很难挽回', { passion: 11, light: 4, obsession: 6 }],
    ['很少，我说话一般不过脑', { passion: 8, order: -6 }],
    ['会紧张，但会先想再开口', { passion: -8, order: 10 }]
  ]],

  ['你在一件事上被人拖着不表态', [
    ['直接逼他给个说法', { passion: 12, order: 7, mercy: -5 }],
    ['不等了，自己往下走', { passion: -4, order: 10, obsession: 6 }],
    ['再等等，也许他有难处', { passion: -8, mercy: 9, light: 5 }]
  ]],

  ['你在一个人多的场合会不会突然兴奋', [
    ['会，人越多我越来劲', { passion: 12, bond: 9 }],
    ['不会，我只会更想走', { passion: -9, bond: -8 }],
    ['有一阵会，然后就想走了', { passion: 3, bond: 3 }]
  ]],

  ['你在一件事上被人踩了一脚（字面或比喻）', [
    ['当场说一句', { passion: 11, light: 3 }],
    ['算了，不值得', { passion: -8, mercy: 7, light: 5 }],
    ['看他的态度', { passion: -3, order: 7 }]
  ]],

  ['你在一件事上需要耐着性子解释很多遍', [
    ['第三遍就开始烦', { passion: 11, order: -4 }],
    ['能一直讲到我讲清楚', { passion: -8, obsession: 9, light: 6 }],
    ['换个方式讲，还是不懂就算了', { passion: -5, light: 6, order: 6 }]
  ]],

  ['你在一个需要等人回消息的时刻', [
    ['会一直看手机', { passion: 5, obsession: 11 }],
    ['把手机扔一边', { passion: -8, obsession: -6 }],
    ['去做别的事，回来再看', { passion: -6, order: 9 }]
  ]],

  ['你在一件事上被人抢了话头', [
    ['会立刻抢回来', { passion: 11, bond: 3 }],
    ['让他说完', { passion: -8, light: 7, mercy: 6 }],
    ['不说了，反正也不重要', { passion: -7, obsession: -4 }]
  ]],

  ['你会不会在生气的时候说出很难听的话', [
    ['会，事后会后悔', { passion: 12, light: -4, mercy: -6 }],
    ['不会，我会先走开', { passion: -10, order: 10 }],
    ['会，但只对最亲近的人', { passion: 7, bond: 7, light: -5 }]
  ]],

  ['你在一件事上被人说"你变了"', [
    ['认，人都会变', { passion: -5, order: 7 }],
    ['不认，我一直是我', { passion: 7, obsession: 9, order: -4 }],
    ['会认真想想他指的是什么', { passion: -7, light: 7, obsession: 5 }]
  ]],

  ['你在一个需要守夜的场合', [
    ['熬得住，天亮之前最清醒', { passion: -6, obsession: 9, sacrifice: 7 }],
    ['熬不住，会打瞌睡', { passion: -4, order: -6 }],
    ['会找人说说话撑过去', { passion: 3, bond: 9 }]
  ]],

  ['你在一件事上被人反复确认', [
    ['会不耐烦', { passion: 10, order: -6 }],
    ['每次都认真答一遍', { passion: -9, light: 7, order: 6 }],
    ['直接说：我记得，不用再问', { passion: 6, order: 8, mercy: -5 }]
  ]],

  ['你在一件让你兴奋的事面前，能等多久', [
    ['等不了，现在就做', { passion: 13, order: -8 }],
    ['能等，我会先安排好再动', { passion: -11, order: 12 }],
    ['会先告诉一个人', { passion: 7, bond: 9 }]
  ]]
];
