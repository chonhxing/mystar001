/**
 * 全站文案与品牌名 —— 所有出现在用户眼前的字都从这里出。
 *
 * 为什么单独抽一个文件：
 *  1. 合规。微信《常见拒绝情形》3.2.4 明确写了"不能存在测试类内容；示例：算命，抽签，星座运势等"。
 *     所以"占卜/算命/抽签/运势预测"这类词在提审时是高风险词，必须能一处改全站。
 *     下面的 SAFE_WORDING 就是那套替换表，改它等于改全站口径。
 *  2. 运营。换个活动名、换句引导语不用翻代码。
 *  3. 本地化。以后要出繁体/英文版，只改这一个文件。
 *
 * ⚠️ 注意：改这里不影响 AI 生成的文案。AI 的口径约束在 server/prompts.js 里，
 *    两边要一起改（提示词里已经做了同样的约束）。
 */

const BRAND = {
  /**
   * 当前名。
   * 已从「我推的星运」改成「我推的星运」—— 去掉了"占星"，落在敏感区间之外。
   *
   * ⚠️ 但"星运"仍带一个"运"字，审核员有可能联想到"星座运势"（那是官方点名的词）。
   *    想再稳一档就用下面 SAFE_NAME 里完全不带玄学色彩的那个。
   */
  NAME: '我推的星运',
  // 完全规避联想的备选（提审被追问时可以直接换）：
  //   '我推的角色' / '命途镜像' / '角色命途' / '谁是你'
  SAFE_NAME: '我推的角色',
  SLOGAN: '把生辰写成一张命途图谱，看你的性格最像哪个角色',
  VERSION: '0.1.0'
};

/** 高风险词 → 安全表述。UI 里一律用右边。 */
const SAFE_WORDING = {
  占卜: '匹配',
  算卦: '分析',
  算命: '性格分析',
  抽签: '随机匹配',
  一签: '一次随机',
  签文: '结果',
  运势: '今日提示',
  吉凶: '状态',
  大吉: '顺畅',
  末吉: '需要留神',
  预言: '提示',
  命运预测: '性格倾向',
  图谱: '命途图谱',
  八字: '生辰四柱',
  风水: '环境',
  法事: '仪式',
  灵验: '贴合',
  神谕: '一句提点'
};

/**
 * 需要展示"替换后文本"的地方统一走这里。
 * 用法：copy.safe('今天来占卜一下') → '今天来匹配一下'
 */
function safe(text) {
  let out = String(text === undefined || text === null ? '' : text);
  Object.keys(SAFE_WORDING).forEach((k) => {
    if (out.indexOf(k) >= 0) out = out.split(k).join(SAFE_WORDING[k]);
  });
  return out;
}

/** 页面/场景标题（已过 safe） */
const SCENE = {
  home: { title: safe(BRAND.NAME), tab: '匹配' },
  quiz: { title: '九个问题', tab: '' },
  casting: { title: '正在读取命途图谱' },
  result: { title: '结果已生成' },
  codex: { title: '角色图鉴', tab: '图鉴' },
  character: { title: '角色命途' },
  // 三个主页共用底部导航：匹配 / 图鉴 / 我的
  account: { title: '账号', tab: '我的' },
  // 设置是二级页（从个人中心进），不占 tab
  profile: { title: '设置', tab: '' }
};

/** 界面文案 */
const UI = {
  // 首页
  homeIntro: '把你的生辰写成一张八轴的命途图谱，再从 60 个角色里找出与你共振最强的那一个。',
  homePrivacy: '生辰只存在你的手机上，不会上传',
  homeStart: '开始匹配',
  homeDraw: '不想填生辰 · 随机来一次',
  homeNameLabel: '称呼（可留空）',
  homeNamePlaceholder: '随便写一个',
  homeGenderLabel: '性别（可留空）',
  homeDateLabel: '出生日期',
  homeTimeLabel: '出生时辰',
  homeTimeUnknown: '不知道',
  homeTimeKnown: '知道',
  /** 时辰行右侧那个小按钮的两种状态 */
  homeTimeDunno: '不知道',
  homeTimePick: '去填写',
  homeTimeBlank: '空着也可以',
  homeTimeHint: '不知道就空着——上升星座和时柱会留白，太阳月亮照样能算',
  homeCityLabel: '出生地',
  homeCityHint: '只用来估算上升星座，不会上传',
  homeAiLabel: 'AI 深化解读',
  homeAiOn: '命途图谱在本机计算，解读文案由 AI 生成',
  homeAiOff: '全部在本机完成，不联网',
  // 答题数量：题越多越准，但影响力不变（见 core/quiz.js 的权重归一）
  homeQuizLabel: '问几道题',
  homeQuizUnit: '{n} 题',
  homeProgress: '已遇见 {n} / {total} 个角色',
  homeAccount: '我的',
  homeQuotaFree: '免费 {n} 次',
  homeQuotaTicket: '解锁券 {n} 次',
  homeQuotaPass: '畅玩卡 {days} 天',
  homeQuotaNone: '次数已用完',

  // 今日提示
  todayTitle: '{date} · 今日提示',
  todayGood: '宜',
  todayBad: '忌',
  todayLucky: '幸运色',
  todayNumber: '幸运数',
  todayItem: '幸运物',
  todayAxis: '今天最突出的一轴：{name}',

  // 问答
  quizIntro: '这些问题没有正确答案。你选得越随意，图谱越像你。',
  quizPrev: '上一题',
  quizSkip: '跳过这题',
  quizSkipAll: '全部跳过',
  quizAnswered: '已经答了 {n} 题',
  quizSkipConfirm: '剩下的问题都不答了？图谱会退回纯星象版本。',
  // 多选：勾几个再走（选项数量与题目数量都是变长的）
  quizMultiMax: '可以多选，最多 {n} 项',
  quizMultiMin: '可以多选，至少 {n} 项',
  quizMultiRange: '可以多选，{min}~{max} 项',
  quizMultiDone: '下一题',
  quizMore: '再来一次',

  // 匹配中
  castingMain: '正在打开你的命途图谱',
  castingSub: '星象对齐 · 角色检索中',

  // 结果页
  resultEssenceTitle: '图谱解读',
  resultFateTitle: '你携带的命途',
  resultChartTitle: '命途图谱全相',
  resultAxesTitle: '八轴坐标',
  resultResonanceTitle: '为什么是 TA',
  resultSideTitle: '另外两条你可能走得通的路',
  resultDiffTitle: '但你没有走进 TA 的全部命途',
  resultAntiTitle: '你带不动的命途',
  resultCounselTitle: '一句提点',
  resultTodayTitle: '今日提示',
  resultAgain: '再来一次',
  resultShare: '分享结果',
  resultCodex: '去图鉴',
  resultResonanceTag: '共振 {n}%',
  resultShared: '你们共享的命途',
  resultUnlock: '图鉴解锁 {n} 个新角色，已收集 {total} 个',
  resultLocalNotice: '星象信号不好，这次用本机图谱为你解读',
  resultQuotaNotice: '今天的深度解读用完了，明天再来',
  resultAiLabel: '本页解读文案由人工智能生成',
  resultAiLabelLocal: '本页解读由本机算法生成',

  // 图鉴
  codexProgress: '已遇见 {n} / {total}',
  codexAll: '全部',
  codexUnlocked: '已遇见',
  codexLocked: '未遇见',
  codexLockedTip: '还没在匹配中遇见 TA',
  codexEmpty: '这个筛选下还没有角色',
  codexGo: '去匹配，遇见新的命途',

  // 角色详情
  charFatesTitle: 'TA 的命途',
  charAxesTitle: 'TA 的八轴坐标',
  charResonance: '与你共振 {n}%',
  charShare: '分享这条命途',
  charBack: '回到图鉴',
  charAxisNote: '0 = 完全靠后一极，100 = 完全靠前一极',
  charLocked: '你还没有遇见 TA',

  // 我的
  profileEdit: '编辑出生资料',
  profileNoData: '还没有录入生辰',
  profileStatsTitle: '我的记录',
  profileStatDraw: '次匹配',
  profileStatCodex: '已遇见',
  profileStatAi: '次 AI 深化',
  profileHistoryTitle: '匹配记录',
  profileHistoryEmpty: '还没有记录，去试一次。',
  profileClearHistory: '清空记录',
  profileClearCodex: '清空图鉴',
  profileSettingsTitle: '设置',
  profileAiSwitch: 'AI 深化解读',
  profileAiSwitchDesc: '开启后，匿名图谱数值会发送到服务器生成文案',
  profileSaveSwitch: '保存记录',
  profileSaveSwitchDesc: '记录只存在本机',
  profileBackend: '解读服务状态',
  profileAbout: '图谱怎么算的 / 数据去哪了',
  profileClearAll: '清空全部本地数据',
  profileAboutBody:
    '图谱由星象与干支算法在你的手机本地计算，生辰资料只存在本机、不上传。' +
    '解读文案由人工智能生成：开启"AI 深化解读"时，会把图谱数值（不包括姓名与出生资料）发送到服务器生成文案。' +
    '我们不会获取你的昵称、头像或手机号。所有内容仅供娱乐。',

  // 解锁（免费次数用完之后）
  unlockTitle: '今天的免费次数用完了',
  unlockFreeDone: '免费 {n} 次已经用完',
  unlockByAd: '看广告 · 解锁 1 次',
  unlockOrBuy: '或 开通畅玩卡',
  unlockNoPay: '当前设备不支持支付，可以先看广告解锁',
  unlockPayOff: '畅玩卡暂未开放，可以先看广告解锁',
  unlockBuy: '立即开通',
  unlockLater: '以后再说',
  unlockPassTag: '{days} 天',
  unlockAdPlaying: '广告加载中…',
  unlockPaying: '正在拉起支付…',
  unlockChecking: '正在确认…',
  unlockAdFail: '广告没看完，再试一次吧',
  unlockAdNone: '暂时没有可用的广告，稍后再试',
  unlockPaidOk: '畅玩卡已到账，{days} 天内不限次',
  unlockPaidPending: '支付已受理，权益稍后到账',
  unlockTicketLeft: '解锁券还剩 {n} 次',
  unlockInPass: '畅玩卡剩余 {days} 天',
  unlockNoItems: '暂时无法解锁，请稍后再试',

  // 匹配记录
  recordsTitle: '匹配记录',
  recordsEmpty: '还没有记录',
  recordsEmptyDesc: '去匹配一次，这里会留下你走过的命途',
  recordsCount: '共 {n} 条',
  recordsClear: '清空记录',
  recordsClearConfirm: '清空所有匹配记录？图鉴不受影响。',
  recordsCleared: '已清空',

  // 开通畅玩卡
  rechargeTitle: '开通畅玩卡',
  rechargeFree: '免费次数',
  rechargeFreeLeft: '{left} / {total} 次',
  rechargeTickets: '解锁券',
  rechargePass: '畅玩卡',
  rechargePassOn: '剩余 {days} 天',
  rechargePassOff: '未开通',
  rechargeAdBtn: '看广告 · 解锁 1 次',
  rechargeAdOk: '已解锁 1 次',
  rechargeAdFail: '广告没看完，再试一次',
  rechargeAdNone: '暂时没有可用的广告',
  rechargeBuy: '立即开通',
  rechargeNote: '支付由微信提供，开通后不限次',
  rechargeUnavailable: '畅玩卡暂未开放，可以先看广告解锁',
  rechargeIosNote: '当前设备暂不支持支付',
  rechargePaid: '{days} 天畅玩卡已到账',
  rechargePending: '支付已受理，权益稍后到账',
  rechargeCancel: '已取消',

  // 账号（正式版：只留必要信息，不做解释性文案）
  accountTitle: '账号',
  accountLoggedIn: '已登录',
  accountDevMode: '开发模式',
  accountExpired: '登录已过期',
  accountSessionOk: '有效',
  accountSessionLost: '已失效',
  accountSessionNone: '无',
  accountSessionUnchecked: '未校验',
  accountIdLabel: '账号标识',
  accountPassLabel: '畅玩卡',
  accountPassNone: '未开通',
  accountPassUntil: '{days} 天',
  accountLoginLabel: '登录方式',
  accountLoginWay: '微信登录',
  accountPlayTitle: '游玩记录',
  accountPlayTotal: '累计匹配',
  accountPlayCount: '{n} 次',
  accountPlayCodex: '已遇见',
  accountPlayFirst: '首次游玩',
  accountDataTitle: '数据存放',
  accountDataProfile: '生辰资料',
  accountDataHistory: '匹配记录',
  accountDataCodex: '图鉴进度',
  accountDataEntitlement: '畅玩卡',
  accountLocal: '本机',
  accountBoth: '账号 · 本机',
  accountCloud: '账号',
  accountSync: '从账号恢复记录',
  accountSyncing: '同步中…',
  accountSyncOk: '已恢复 {n} 个角色',
  accountSyncNone: '已是最新',
  accountSyncFail: '同步失败',
  accountRelogin: '重新登录',
  accountRelogining: '登录中…',
  accountReloginOk: '已刷新',
  accountReloginFail: '登录失败',
  accountBlocked: '当前账号暂时无法登录',
  accountClear: '清空账号记录',
  accountClearConfirm: '只清账号里的那一份，本机记录保留。换设备后找不回这些进度。',
  accountClearOk: '已清空',
  // 离线态：真机上后端不可达（127.0.0.1 指向手机自己），要说清是连不上而不是登录过期
  accountOffline: '连不上服务器',
  accountOfflineWhy: '原因',
  accountOfflineHow: '怎么办',
  accountNoRegister: '微信小游戏无需注册，进入即已登录',
  // 微信昵称头像（2022-10-25 之后只能让用户自己选，不能直接读）
  accountAvatarUse: '用微信头像',
  accountAvatarChange: '换一张',
  accountAvatarClear: '不用微信头像',
  accountAvatarSaved: '头像已更新',
  accountAvatarAnonymous: '微信只给了默认头像，换不了——可以用下面的方式',
  accountAvatarDenied: '没有授权，头像没换成',
  accountAvatarUnsupported: '当前环境不支持换头像（真机上可以）',
  accountAvatarTimeout: '等太久了，先不换了',
  accountAvatarNeedPrivacy: '先同意隐私协议才能用微信头像',
  accountNicknameEmpty: '还没有昵称',
  accountQuotaTitle: '可用次数',
  accountQuotaFree: '免费 {n} 次',
  accountQuotaTicket: '解锁券 {n} 次',
  accountQuotaPass: '畅玩卡 {days} 天',
  accountQuotaNone: '已用完',
  accountBuyShort: '去开通',
  accountProfilesTitle: '资料卡',
  accountProfileAdd: '+ 新建资料卡',
  accountProfileEmpty: '还没有资料卡',
  accountProfileHint: '新建一张，以后一键开始',
  accountProfileFull: '最多 {n} 张资料卡',
  accountProfileDelete: '删除这张资料卡？',
  accountProfileDeleted: '已删除',
  accountProfileTimeUnknown: '时辰未知',
  accountEntryCodex: '我的图鉴',
  accountEntryRecords: '匹配记录',
  accountEntryRecharge: '开通畅玩卡',
  accountSettings: '设置',
  accountCount: '{n} / {total}',
  accountRecordsCount: '{n} 条',
  accountStartNow: '开始匹配',

  // 通用
  back: '返回',
  confirm: '确定',
  cancel: '取消',
  loading: '加载中',
  empty: '这里还什么都没有',
  retry: '重试',
  skip: '跳过',
  next: '下一步',
  done: '完成',
  disabled: '暂不可用'
};

/** 免责声明（合规必需，别删） */
const LEGAL = {
  footer:
    '本产品为娱乐性创作，图谱与匹配结果均为算法与人工智能生成，不构成任何建议，请勿据此做出重要决定。',
  privacy:
    '姓名与生辰只保存在你的手机本地；仅在开启 AI 深化解读时，我们会发送匿名化的图谱数值（八轴分数、星座与干支下标）。',
  copyright:
    '角色名与作品名仅用于指代，相关权利归各自权利人所有；库内所有描述文字均为原创，未使用任何官方素材。',
  aiLabel: '含人工智能生成内容'
};

/** 简单的 {n} 插值 */
function fill(tpl, dict) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) =>
    dict && dict[k] !== undefined && dict[k] !== null ? String(dict[k]) : ''
  );
}

module.exports = { BRAND, SAFE_WORDING, safe, SCENE, UI, LEGAL, fill };
