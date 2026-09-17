/**
 * 角色库 —— 命途样本池。
 *
 * ⚠️ 版权说明（重要）：
 *   - 这里只使用「角色名 / 作品名」这类事实性标识，用于指代。
 *   - motif / signature 全部是原创描述，没有引用任何官方台词、立绘、截图。
 *   - 角色立绘、官方素材需要授权才能商用；商用前请法务确认，或替换为原创角色。
 *     （想绕开版权风险，最干净的做法是把这份表整体换成"原创角色 + 作者授权角色"。）
 *
 * ⚠️ 数值说明：
 *   dims 是策划调参用的，不是客观事实。8 个 key 必须齐全：
 *   光 light / 秩序 order / 羁绊 bond / 炽热 passion / 天命 fate / 温柔 mercy / 执念 obsession / 燃尽 sacrifice
 *   加角色时记得扫一眼：每根轴上最好都有人站在 20 以下、也有人站在 80 以上，否则某些命盘会没有归宿。
 */

const RARITY = {
  legend: { key: 'legend', name: '传说', stars: 5, label: '传说命途' },
  epic: { key: 'epic', name: '史诗', stars: 4, label: '史诗命途' },
  rare: { key: 'rare', name: '稀有', stars: 3, label: '稀有命途' },
  common: { key: 'common', name: '寻常', stars: 1, label: '寻常命途' }
};

const MEDIUMS = ['动画', '游戏', '影视', '小说'];

const CHARACTERS = [
  // ================= 动画 / 漫画 =================
  {
    id: 'naruto', name: '漩涡鸣人', work: '火影忍者', medium: '动画', rarity: 'epic',
    dims: { light: 78, order: 45, bond: 95, passion: 88, fate: 82, mercy: 80, obsession: 75, sacrifice: 90 },
    fates: ['the_chosen', 'undying_bond', 'light_watch'],
    motif: '橘色的外套，和一颗从不肯低下的头',
    signature: '被所有人推开过，所以选择成为所有人的归处'
  },
  {
    id: 'sasuke', name: '宇智波佐助', work: '火影忍者', medium: '动画', rarity: 'epic',
    dims: { light: 25, order: 40, bond: 30, passion: 70, fate: 60, mercy: 35, obsession: 95, sacrifice: 70 },
    fates: ['shadow_heir', 'obsession_prisoner', 'loner'],
    motif: '一条走到底的孤路，和不肯回头的背影',
    signature: '把整个家族的血债，压缩成一个人的行程表'
  },
  {
    id: 'hinata', name: '日向雏田', work: '火影忍者', medium: '动画', rarity: 'common',
    dims: { light: 76, order: 60, bond: 84, passion: 42, fate: 28, mercy: 94, obsession: 82, sacrifice: 68 },
    fates: ['gentle_armor', 'undying_bond', 'homecoming'],
    motif: '躲在柱子后面，却每次都站得比昨天前一点',
    signature: '用最轻的声音，做出了最不轻的决定'
  },
  {
    id: 'luffy', name: '蒙奇·D·路飞', work: '海贼王', medium: '动画', rarity: 'legend',
    dims: { light: 85, order: 20, bond: 96, passion: 92, fate: 55, mercy: 70, obsession: 65, sacrifice: 72 },
    fates: ['wanderer', 'undying_bond', 'blaze'],
    motif: '草帽、海风，和一个永远往前的方向',
    signature: '不算计未来，但从不放下任何一个人'
  },
  {
    id: 'zoro', name: '罗罗诺亚·索隆', work: '海贼王', medium: '动画', rarity: 'epic',
    dims: { light: 55, order: 60, bond: 72, passion: 70, fate: 40, mercy: 45, obsession: 96, sacrifice: 60 },
    fates: ['obsession_prisoner', 'undying_bond', 'loner'],
    motif: '三把刀，和一个背对整个世界的站姿',
    signature: '把誓言当成身体的一部分，输了也不摘下来'
  },
  {
    id: 'tanjiro', name: '灶门炭治郎', work: '鬼灭之刃', medium: '动画', rarity: 'epic',
    dims: { light: 95, order: 72, bond: 90, passion: 70, fate: 55, mercy: 95, obsession: 80, sacrifice: 92 },
    fates: ['light_watch', 'gentle_armor', 'undying_bond'],
    motif: '一只旧木箱，和一路没停过的呼吸',
    signature: '对砍向他的人也会心软，但刀从不慢'
  },
  {
    id: 'nezuko', name: '灶门祢豆子', work: '鬼灭之刃', medium: '动画', rarity: 'rare',
    dims: { light: 90, order: 60, bond: 88, passion: 55, fate: 50, mercy: 92, obsession: 60, sacrifice: 85 },
    fates: ['gentle_armor', 'undying_bond', 'light_watch'],
    motif: '咬住竹筒，把咬人的冲动咽回去',
    signature: '用仅剩的理智，守住了自己还是谁的证明'
  },
  {
    id: 'giyu', name: '富冈义勇', work: '鬼灭之刃', medium: '动画', rarity: 'rare',
    dims: { light: 60, order: 78, bond: 40, passion: 45, fate: 35, mercy: 55, obsession: 85, sacrifice: 70 },
    fates: ['loner', 'order_keeper', 'guilt_bearer'],
    motif: '一身不被理解的正直，和总是晚一步的自责',
    signature: '把活着当成一种需要偿还的事'
  },
  {
    id: 'zenitsu', name: '我妻善逸', work: '鬼灭之刃', medium: '动画', rarity: 'rare',
    dims: { light: 72, order: 55, bond: 70, passion: 60, fate: 30, mercy: 88, obsession: 45, sacrifice: 55 },
    fates: ['gentle_armor', 'homecoming', 'undying_bond'],
    motif: '哭着喊不敢，睡着以后一刀不落',
    signature: '胆子最小的人，留下来陪着的人偏偏是他'
  },
  {
    id: 'inosuke', name: '嘴平伊之助', work: '鬼灭之刃', medium: '动画', rarity: 'common',
    dims: { light: 60, order: 25, bond: 70, passion: 85, fate: 25, mercy: 35, obsession: 75, sacrifice: 60 },
    fates: ['blaze', 'wanderer', 'undying_bond'],
    motif: '野猪头套，和一副谁都不服的嗓门',
    signature: '从林子里的野兽，一路打成了会替人挡刀的人'
  },
  {
    id: 'gojo', name: '五条悟', work: '咒术回战', medium: '动画', rarity: 'legend',
    dims: { light: 70, order: 25, bond: 55, passion: 80, fate: 75, mercy: 40, obsession: 60, sacrifice: 85 },
    fates: ['wanderer', 'loner', 'sacrifice_end'],
    motif: '一直没摘的眼罩，和一句谁也没接住的玩笑',
    signature: '强到不需要规则，最后却输给了自己不在场的时刻'
  },
  {
    id: 'yuji', name: '虎杖悠仁', work: '咒术回战', medium: '动画', rarity: 'epic',
    dims: { light: 88, order: 50, bond: 88, passion: 75, fate: 45, mercy: 88, obsession: 70, sacrifice: 95 },
    fates: ['sacrifice_end', 'light_watch', 'undying_bond'],
    motif: '过大的力气，和一句"我来"',
    signature: '主动把别人的账记到自己名下的人'
  },
  {
    id: 'madoka', name: '鹿目圆', work: '魔法少女小圆', medium: '动画', rarity: 'legend',
    dims: { light: 95, order: 60, bond: 85, passion: 55, fate: 90, mercy: 96, obsession: 60, sacrifice: 98 },
    fates: ['sacrifice_end', 'the_chosen', 'light_watch'],
    motif: '粉色的发带，和一个把愿望用完的决定',
    signature: '用一次许愿，替所有还没发生的绝望付账'
  },
  {
    id: 'homura', name: '晓美焰', work: '魔法少女小圆', medium: '动画', rarity: 'legend',
    dims: { light: 35, order: 45, bond: 45, passion: 65, fate: 40, mercy: 50, obsession: 98, sacrifice: 85 },
    fates: ['obsession_prisoner', 'loner', 'shadow_heir'],
    motif: '永远停在同一个路口，重复同一段路',
    signature: '把无数次失败叠成一份力气，只为了重来一次'
  },
  {
    id: 'lelouch', name: '鲁路修', work: '叛逆的鲁路修', medium: '动画', rarity: 'legend',
    dims: { light: 30, order: 35, bond: 60, passion: 60, fate: 70, mercy: 30, obsession: 95, sacrifice: 92 },
    fates: ['shadow_heir', 'chessmaster', 'sacrifice_end'],
    motif: '一张面具，和一场算到自己头上的局',
    signature: '把自己写成反派，让别人去当英雄'
  },
  {
    id: 'yagami', name: '夜神月', work: '死亡笔记', medium: '动画', rarity: 'epic',
    dims: { light: 20, order: 62, bond: 25, passion: 55, fate: 85, mercy: 15, obsession: 96, sacrifice: 55 },
    fates: ['chessmaster', 'the_chosen', 'shadow_heir'],
    motif: '一本写下去就停不下来的本子',
    signature: '把正义一路推到了只剩自己'
  },
  {
    id: 'edward', name: '爱德华·艾尔利克', work: '钢之炼金术师', medium: '动画', rarity: 'epic',
    dims: { light: 80, order: 55, bond: 85, passion: 78, fate: 35, mercy: 72, obsession: 88, sacrifice: 80 },
    fates: ['guilt_bearer', 'undying_bond', 'fate_breaker'],
    motif: '机械的义肢，和一本人人想要的书',
    signature: '用一次错误换一辈子的偿还，而且不接受赊账'
  },
  {
    id: 'rei', name: '绫波丽', work: '新世纪福音战士', medium: '动画', rarity: 'rare',
    dims: { light: 45, order: 80, bond: 25, passion: 30, fate: 75, mercy: 60, obsession: 40, sacrifice: 96 },
    fates: ['sacrifice_end', 'loner', 'the_chosen'],
    motif: '白色的房间，和一句"我大概会死"',
    signature: '被制造出来的人，自己选了要替谁挡'
  },
  {
    id: 'asuka', name: '明日香', work: '新世纪福音战士', medium: '动画', rarity: 'rare',
    dims: { light: 40, order: 55, bond: 45, passion: 88, fate: 30, mercy: 20, obsession: 85, sacrifice: 60 },
    fates: ['blaze', 'loner', 'obsession_prisoner'],
    motif: '红色的驾驶服，和不肯示弱的口音',
    signature: '把"我可以一个人"喊得最大声的人，最怕被丢下'
  },
  {
    id: 'shinji', name: '碇真嗣', work: '新世纪福音战士', medium: '动画', rarity: 'rare',
    dims: { light: 55, order: 35, bond: 50, passion: 28, fate: 25, mercy: 85, obsession: 40, sacrifice: 60 },
    fates: ['gentle_armor', 'loner', 'guilt_bearer'],
    motif: '一副耳机，和一个永远在犹豫的姿势',
    signature: '不想伤害任何人，于是每次都被推着上机'
  },
  {
    id: 'hanamichi', name: '樱木花道', work: '灌篮高手', medium: '动画', rarity: 'rare',
    dims: { light: 75, order: 30, bond: 88, passion: 96, fate: 20, mercy: 60, obsession: 78, sacrifice: 65 },
    fates: ['blaze', 'undying_bond', 'wanderer'],
    motif: '红头发，和第一次认真起来的样子',
    signature: '天赋是借口，练习才是他的主角光环'
  },
  {
    id: 'mitsui', name: '三井寿', work: '灌篮高手', medium: '动画', rarity: 'common',
    dims: { light: 62, order: 45, bond: 78, passion: 70, fate: 30, mercy: 62, obsession: 85, sacrifice: 70 },
    fates: ['homecoming', 'guilt_bearer', 'blaze'],
    motif: '跪下来的那一句，和重新长回来的头发',
    signature: '离开过的人，回来时比谁都珍惜'
  },
  {
    id: 'ai', name: '灰原哀', work: '名侦探柯南', medium: '动画', rarity: 'rare',
    dims: { light: 35, order: 70, bond: 40, passion: 35, fate: 30, mercy: 45, obsession: 60, sacrifice: 70 },
    fates: ['shadow_heir', 'chessmaster', 'loner'],
    motif: '冷静的侧脸，和一段不能提的来处',
    signature: '从黑暗的组织里逃出来，学会在光下生活'
  },
  {
    id: 'ran', name: '毛利兰', work: '名侦探柯南', medium: '动画', rarity: 'common',
    dims: { light: 88, order: 65, bond: 90, passion: 55, fate: 30, mercy: 90, obsession: 60, sacrifice: 75 },
    fates: ['gentle_armor', 'undying_bond', 'homecoming'],
    motif: '一直开着的门，和一句"你回来啦"',
    signature: '等一个人很多年，还顺手把日子过得很好'
  },
  {
    id: 'shinichi', name: '工藤新一', work: '名侦探柯南', medium: '动画', rarity: 'epic',
    dims: { light: 78, order: 82, bond: 65, passion: 60, fate: 55, mercy: 50, obsession: 85, sacrifice: 60 },
    fates: ['order_keeper', 'chessmaster', 'the_chosen'],
    motif: '一句"真相只有一个"，和缩小的身体',
    signature: '为了追一个答案，连身份都可以不要'
  },
  {
    id: 'eren', name: '艾伦·耶格尔', work: '进击的巨人', medium: '动画', rarity: 'legend',
    dims: { light: 25, order: 30, bond: 55, passion: 85, fate: 88, mercy: 35, obsession: 98, sacrifice: 88 },
    fates: ['fate_breaker', 'the_chosen', 'obsession_prisoner'],
    motif: '一直往前的方向，和越来越不像自己的脸',
    signature: '为了自由走到最后，把自己变成了笼子'
  },
  {
    id: 'mikasa', name: '三笠·阿克曼', work: '进击的巨人', medium: '动画', rarity: 'epic',
    dims: { light: 55, order: 68, bond: 60, passion: 60, fate: 40, mercy: 55, obsession: 90, sacrifice: 92 },
    fates: ['obsession_prisoner', 'undying_bond', 'loner'],
    motif: '一条红围巾，和随时挡在身前的位置',
    signature: '全世界都在变的时候，她只守一个坐标'
  },
  {
    id: 'levi', name: '利威尔·阿克曼', work: '进击的巨人', medium: '动画', rarity: 'legend',
    dims: { light: 50, order: 72, bond: 45, passion: 50, fate: 25, mercy: 35, obsession: 88, sacrifice: 78 },
    fates: ['loner', 'order_keeper', 'obsession_prisoner'],
    motif: '一条从没换过的围巾，和脏话里藏着的口头关心',
    signature: '一直在替没活下来的人做决定，而且全部做完了'
  },
  {
    id: 'armin', name: '阿尔敏·阿诺德', work: '进击的巨人', medium: '动画', rarity: 'rare',
    dims: { light: 78, order: 60, bond: 80, passion: 40, fate: 30, mercy: 88, obsession: 60, sacrifice: 85 },
    fates: ['gentle_armor', 'chessmaster', 'sacrifice_end'],
    motif: '一本书里的海，和一个不敢喊出口的答案',
    signature: '最怕冲突的人，靠想象活下来了所有人'
  },
  {
    id: 'vi', name: '蔚', work: '双城之战', medium: '动画', rarity: 'rare',
    dims: { light: 60, order: 30, bond: 75, passion: 90, fate: 25, mercy: 55, obsession: 82, sacrifice: 78 },
    fates: ['blaze', 'wanderer', 'undying_bond'],
    motif: '缠着绷带的拳头，和一个一定要找回的名字',
    signature: '用拳头解决问题的人，为了一个人学会了收手'
  },
  {
    id: 'jinx', name: '金克丝', work: '双城之战', medium: '动画', rarity: 'epic',
    dims: { light: 20, order: 15, bond: 45, passion: 92, fate: 35, mercy: 30, obsession: 90, sacrifice: 50 },
    fates: ['fate_breaker', 'shadow_heir', 'blaze'],
    motif: '蓝色的辫子，和一场自己都控制不住的烟花',
    signature: '被丢下太多次以后，学会了先炸掉一切'
  },
  {
    id: 'kirito', name: '桐谷和人', work: '刀剑神域', medium: '动画', rarity: 'rare',
    dims: { light: 72, order: 75, bond: 70, passion: 65, fate: 45, mercy: 70, obsession: 72, sacrifice: 85 },
    fates: ['order_keeper', 'undying_bond', 'homecoming'],
    motif: '两把剑，和一条必须走完的登顶路',
    signature: '一个人也没有丢下的通关方式，代价是自己扛'
  },

  // ================= 游戏 =================
  {
    id: 'cloud', name: '克劳德·斯特莱夫', work: '最终幻想VII', medium: '游戏', rarity: 'epic',
    dims: { light: 45, order: 50, bond: 60, passion: 45, fate: 60, mercy: 60, obsession: 82, sacrifice: 75 },
    fates: ['guilt_bearer', 'loner', 'the_chosen'],
    motif: '过大的剑，和一段自己都记不清的过去',
    signature: '一直以为在追别人，最后发现是替别人活着'
  },
  {
    id: 'tifa', name: '蒂法·洛克哈特', work: '最终幻想VII', medium: '游戏', rarity: 'epic',
    dims: { light: 88, order: 76, bond: 88, passion: 48, fate: 30, mercy: 84, obsession: 74, sacrifice: 86 },
    fates: ['gentle_armor', 'undying_bond', 'homecoming'],
    motif: '一间酒馆，和永远给旧朋友留着的位置',
    signature: '在最乱的地方开着最暖的灯'
  },
  {
    id: 'sephiroth', name: '萨菲罗斯', work: '最终幻想VII', medium: '游戏', rarity: 'legend',
    dims: { light: 12, order: 55, bond: 20, passion: 65, fate: 92, mercy: 10, obsession: 97, sacrifice: 50 },
    fates: ['the_chosen', 'shadow_heir', 'chessmaster'],
    motif: '一把长刀，和一句关于星球的结论',
    signature: '知道了自己的来处之后，选择了毁掉剧本'
  },
  {
    id: 'n2b', name: '2B', work: '尼尔：机械纪元', medium: '游戏', rarity: 'epic',
    dims: { light: 50, order: 88, bond: 45, passion: 40, fate: 70, mercy: 50, obsession: 70, sacrifice: 90 },
    fates: ['order_keeper', 'sacrifice_end', 'loner'],
    motif: '被蒙住的眼，和一句不允许说出口的称呼',
    signature: '命令和感情冲突时，她选了先做完命令'
  },
  {
    id: 'geralt', name: '杰洛特', work: '巫师', medium: '游戏', rarity: 'epic',
    dims: { light: 55, order: 78, bond: 50, passion: 45, fate: 40, mercy: 48, obsession: 80, sacrifice: 72 },
    fates: ['order_keeper', 'loner', 'fate_breaker'],
    motif: '两把剑，和一套自己给自己定的规矩',
    signature: '拿钱办事的猎人，每次都多管了一点闲事'
  },
  {
    id: 'arthas', name: '阿尔萨斯·米奈希尔', work: '魔兽世界', medium: '游戏', rarity: 'legend',
    dims: { light: 15, order: 65, bond: 40, passion: 70, fate: 90, mercy: 20, obsession: 96, sacrifice: 80 },
    fates: ['shadow_heir', 'the_chosen', 'obsession_prisoner'],
    motif: '一把会说话的剑，和一个不肯停的手',
    signature: '为了救一座城，把整座城变成了他的一部分'
  },
  {
    id: 'malenia', name: '玛莲妮亚', work: '艾尔登法环', medium: '游戏', rarity: 'legend',
    dims: { light: 25, order: 40, bond: 30, passion: 75, fate: 70, mercy: 20, obsession: 96, sacrifice: 85 },
    fates: ['shadow_heir', 'obsession_prisoner', 'blaze'],
    motif: '锈蚀的义手，和一句"我从未败过"',
    signature: '用一场必输的战斗，证明自己没有输'
  },
  {
    id: 'zhongli', name: '钟离', work: '原神', medium: '游戏', rarity: 'epic',
    dims: { light: 70, order: 92, bond: 45, passion: 40, fate: 80, mercy: 65, obsession: 78, sacrifice: 90 },
    fates: ['order_keeper', 'the_chosen', 'sacrifice_end'],
    motif: '一份记得清所有旧账的记性',
    signature: '亲手拆掉自己立了两千年的规矩'
  },
  {
    id: 'link', name: '林克', work: '塞尔达传说', medium: '游戏', rarity: 'epic',
    dims: { light: 85, order: 70, bond: 55, passion: 55, fate: 82, mercy: 75, obsession: 78, sacrifice: 90 },
    fates: ['the_chosen', 'sacrifice_end', 'light_watch'],
    motif: '一把大师之剑，和一言不发的背影',
    signature: '不说话，但把所有人托付的事都做完了'
  },
  {
    id: 'hollow_knight', name: '小骑士', work: '空洞骑士', medium: '游戏', rarity: 'rare',
    dims: { light: 45, order: 75, bond: 20, passion: 40, fate: 85, mercy: 65, obsession: 60, sacrifice: 98 },
    fates: ['sacrifice_end', 'loner', 'guilt_bearer'],
    motif: '一个空壳，和一条朝最深处走的路',
    signature: '被造出来当容器，最后自己选了要装什么'
  },
  {
    id: 'joker_p5', name: 'Joker', work: '女神异闻录5', medium: '游戏', rarity: 'rare',
    dims: { light: 60, order: 25, bond: 75, passion: 65, fate: 50, mercy: 55, obsession: 80, sacrifice: 60 },
    fates: ['rule_breaker', 'undying_bond', 'fate_breaker'],
    motif: '一张面具，和一群同样不服的人',
    signature: '专偷坏人心里那点自以为是的正义'
  },

  // ================= 影视 =================
  {
    id: 'luke', name: '卢克·天行者', work: '星球大战', medium: '影视', rarity: 'legend',
    dims: { light: 90, order: 60, bond: 80, passion: 75, fate: 92, mercy: 82, obsession: 70, sacrifice: 85 },
    fates: ['the_chosen', 'light_watch', 'homecoming'],
    motif: '一片荒凉的农场，和两颗太阳',
    signature: '被命运推上台的人，中途想过跑，但回来了'
  },
  {
    id: 'vader', name: '达斯·维达', work: '星球大战', medium: '影视', rarity: 'legend',
    dims: { light: 20, order: 80, bond: 45, passion: 65, fate: 88, mercy: 25, obsession: 92, sacrifice: 88 },
    fates: ['shadow_heir', 'the_chosen', 'sacrifice_end'],
    motif: '黑色的呼吸声，和一只伸向旧日的手',
    signature: '选了黑暗的人，最后用自己换了儿子的路'
  },
  {
    id: 'leia', name: '莱娅', work: '星球大战', medium: '影视', rarity: 'epic',
    dims: { light: 85, order: 82, bond: 80, passion: 65, fate: 60, mercy: 65, obsession: 85, sacrifice: 85 },
    fates: ['order_keeper', 'light_watch', 'undying_bond'],
    motif: '一句都不退让的口气，和扛到底的位置',
    signature: '所有人都在崩的时候，她还在排明天的班'
  },
  {
    id: 'han', name: '汉·索罗', work: '星球大战', medium: '影视', rarity: 'rare',
    dims: { light: 65, order: 20, bond: 70, passion: 78, fate: 20, mercy: 55, obsession: 40, sacrifice: 60 },
    fates: ['wanderer', 'blaze', 'undying_bond'],
    motif: '一艘随时会散架的船，和一张先笑的嘴',
    signature: '说自己只认钱，每次都回头'
  },
  {
    id: 'frodo', name: '弗罗多', work: '指环王', medium: '影视', rarity: 'epic',
    dims: { light: 80, order: 55, bond: 75, passion: 40, fate: 85, mercy: 92, obsession: 60, sacrifice: 95 },
    fates: ['the_chosen', 'sacrifice_end', 'gentle_armor'],
    motif: '一个很小的身影，和一件越来越重的东西',
    signature: '最不适合出发的人，走完了最长的那段路'
  },
  {
    id: 'aragorn', name: '阿拉贡', work: '指环王', medium: '影视', rarity: 'epic',
    dims: { light: 82, order: 85, bond: 82, passion: 65, fate: 80, mercy: 70, obsession: 78, sacrifice: 88 },
    fates: ['the_chosen', 'order_keeper', 'homecoming'],
    motif: '一把需要重新接上的断剑',
    signature: '躲了很久自己的名字，最后还是接了下来'
  },
  {
    id: 'gandalf', name: '甘道夫', work: '指环王', medium: '影视', rarity: 'legend',
    dims: { light: 92, order: 80, bond: 75, passion: 60, fate: 88, mercy: 85, obsession: 70, sacrifice: 88 },
    fates: ['light_watch', 'order_keeper', 'sacrifice_end'],
    motif: '一根旧法杖，和一句"你无法通过"',
    signature: '负责指路的人，掉下去之前还在安排下一步'
  },
  {
    id: 'hermione', name: '赫敏·格兰杰', work: '哈利·波特', medium: '影视', rarity: 'epic',
    dims: { light: 85, order: 92, bond: 78, passion: 60, fate: 40, mercy: 70, obsession: 88, sacrifice: 65 },
    fates: ['order_keeper', 'fate_breaker', 'undying_bond'],
    motif: '一本被翻烂的书，和举手最快的那只手',
    signature: '知道所有规则，也知道哪条必须打破'
  },
  {
    id: 'snape', name: '西弗勒斯·斯内普', work: '哈利·波特', medium: '影视', rarity: 'legend',
    dims: { light: 30, order: 82, bond: 35, passion: 45, fate: 60, mercy: 40, obsession: 96, sacrifice: 95 },
    fates: ['shadow_heir', 'obsession_prisoner', 'sacrifice_end'],
    motif: '一直穿着的黑色长袍，和一句解释都没留下的沉默',
    signature: '被所有人当成敌人，是他愿意付的价格'
  },
  {
    id: 'harry', name: '哈利·波特', work: '哈利·波特', medium: '影视', rarity: 'epic',
    dims: { light: 85, order: 55, bond: 88, passion: 75, fate: 92, mercy: 85, obsession: 65, sacrifice: 90 },
    fates: ['the_chosen', 'undying_bond', 'light_watch'],
    motif: '额头上的一道疤，和一整段被写好的命运',
    signature: '被标了记号长大的人，选择自己走过去'
  },
  {
    id: 'ron', name: '罗恩·韦斯莱', work: '哈利·波特', medium: '影视', rarity: 'common',
    dims: { light: 82, order: 45, bond: 90, passion: 60, fate: 25, mercy: 80, obsession: 50, sacrifice: 70 },
    fates: ['undying_bond', 'homecoming', 'gentle_armor'],
    motif: '一副旧棋，和永远站在旁边的位置',
    signature: '不是被选中的那个，但每次都留下来了'
  },
  {
    id: 'tony', name: '托尼·斯塔克', work: '漫威', medium: '影视', rarity: 'legend',
    dims: { light: 70, order: 40, bond: 65, passion: 88, fate: 55, mercy: 45, obsession: 90, sacrifice: 92 },
    fates: ['fate_breaker', 'blaze', 'sacrifice_end'],
    motif: '一个方舟反应炉，和一句先把自己搭进去的赌注',
    signature: '用最不讨人喜欢的方式，把后果全想到了'
  },
  {
    id: 'steve', name: '史蒂夫·罗杰斯', work: '漫威', medium: '影视', rarity: 'epic',
    dims: { light: 95, order: 90, bond: 85, passion: 65, fate: 60, mercy: 80, obsession: 85, sacrifice: 92 },
    fates: ['order_keeper', 'light_watch', 'sacrifice_end'],
    motif: '一面旧盾牌，和一句"I can do this all day"式的固执',
    signature: '身体最小的时候，就已经是那个不肯退的人了'
  },
  {
    id: 'batman', name: '布鲁斯·韦恩', work: 'DC', medium: '影视', rarity: 'legend',
    dims: { light: 45, order: 85, bond: 40, passion: 55, fate: 55, mercy: 50, obsession: 94, sacrifice: 80 },
    fates: ['shadow_heir', 'order_keeper', 'loner'],
    motif: '一条巷子，和一座停不下来的城市',
    signature: '用最黑的方式守一条最亮的线'
  },
  {
    id: 'jack', name: '杰克·斯派罗', work: '加勒比海盗', medium: '影视', rarity: 'rare',
    dims: { light: 55, order: 10, bond: 55, passion: 70, fate: 20, mercy: 45, obsession: 35, sacrifice: 30 },
    fates: ['wanderer', 'fate_breaker', 'loner'],
    motif: '一只罗盘，和一条永远偏一点的航线',
    signature: '所有人都以为他在瞎走，其实他每次都到了'
  },
  {
    id: 'neo', name: '尼奥', work: '黑客帝国', medium: '影视', rarity: 'epic',
    dims: { light: 80, order: 45, bond: 70, passion: 60, fate: 95, mercy: 70, obsession: 75, sacrifice: 90 },
    fates: ['the_chosen', 'fate_breaker', 'sacrifice_end'],
    motif: '一粒红色药丸，和一句关于选择的追问',
    signature: '被通知自己是被选中的人，然后选择了不接受通知'
  },

  // ================= 小说 / 神话 =================
  {
    id: 'wukong', name: '孙悟空', work: '西游记', medium: '小说', rarity: 'legend',
    dims: { light: 70, order: 20, bond: 75, passion: 92, fate: 60, mercy: 60, obsession: 85, sacrifice: 55 },
    fates: ['fate_breaker', 'blaze', 'wanderer'],
    motif: '一根金箍棒，和一块压不住的石头的脾气',
    signature: '把整个天庭打过一遍，最后学会了给一个人让路'
  }
];

/** id → 角色，O(1) 查询 */
const CHARACTER_MAP = {};
CHARACTERS.forEach((c) => {
  CHARACTER_MAP[c.id] = c;
});

function getCharacter(id) {
  return CHARACTER_MAP[id] || null;
}

module.exports = { CHARACTERS, CHARACTER_MAP, RARITY, MEDIUMS, getCharacter };
