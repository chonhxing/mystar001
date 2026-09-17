/**
 * 文案模板。核心思路：不手写"某角色对应某段话"，而是用命盘的公共字段拼装。
 * 好处是加角色、加星座都不用补文案，坏处是模板要写得足够有质感 —— 所以这个文件值得反复打磨。
 *
 * 占位符用 {xxx}，由 core/copywriter.js 填充。列表类字段用 {list} 形式，会用顿号连接。
 */

const TEMPLATES = {
  // ---------- 结果页标题 ----------
  resultTitle: '你的命途已被读出',
  resultSubtitle: '{sunName} · {lifeNumberName} · {pillarYearName}年',

  // ---------- 第一段：命盘本质 ----------
  essence:
    '你的命盘由{sunName}压住重心，{sunTagline}。' +
    '月亮落在{moonName}，说明你真正难受的时候是这么处理的：{moonTagline}。' +
    '{risingSentence}',
  risingSentence: '上升{risingName}是你递给世界的那张脸，{risingTagline}。',
  risingUnknown: '你没有提供出生时辰，所以上升星座留白——那一格本来就是你还没决定的部分。',

  // 随心抽签模式的替代开场
  essenceDraw:
    '这张命盘不是算出来的，是抽出来的。它由{veins}这几条线交织而成，' +
    '说明此刻的你正站在它们的交点上。你命盘上最强的那一轴是「{dominantName}」——{dominantBadge}。',

  // ---------- 第二段：与角色的共振 ----------
  resonanceHeader: '与你共振最强的，是{charName}',
  resonanceBody:
    '在{total}个命途样本里，{charName}（《{work}》）与你的命盘共振度达到{score}%。' +
    '{fateSentence}',
  resonanceFate: '你们同样走在【{fateName}】上——{fateSummary}',
  resonanceShared: '你们共享的坐标是{sharedList}，这些是别人学不像的部分。',

  // ---------- 第三段：差异（为什么不是你） ----------
  differenceHeader: '但你没有走进TA的全部命途',
  differenceBody: '{gapText}',
  gapCharHigher: 'TA的「{dimName}」比你更偏{pos}——{posDesc}；而你这一格还空着，这是你比TA自由的地方。',
  gapCharLower: 'TA的「{dimName}」比你更偏{neg}——{negDesc}；你做不到那么彻底，这就是你没被那条命途收走的原因。',

  // ---------- 第四段：未带入的命途 ----------
  antiHeader: '你带不动的命途',
  antiBody:
    '共振度最低的是{charName}（《{work}》），只有{score}%。' +
    'TA的命运对你是另一种语言：{missingText}',
  antiMissing: '你的命盘里「{dimName}」这一格是{userLevel}{userPole}，而TA是{charLevel}{charPole}。',

  // ---------- 神谕 ----------
  counselHeader: '神谕',
  counsel: '{counselText}',

  // ---------- 副推 ----------
  sideHeader: '副推：另外两条你可能走得通的路',
  sideLine: '{charName}（《{work}》）· 共振 {score}%',

  // ---------- 我的命盘 ----------
  chartHeader: '命盘全相',
  chartSun: '太阳 · {name}',
  chartMoon: '月亮 · {name}',
  chartRising: '上升 · {name}',
  chartPillar: '{label} · {name}（{element}{yinyang}）',
  chartLifeNumber: '生命灵数 · {number} {name}',

  // ---------- 其它 ----------
  quizIntro: '接下来九个问题没有正确答案。你选得越随意，命盘越像你。',
  shareTitle: '我的命途是{charName}，你的是谁？',
  emptyCodex: '还没有解锁任何命途。先去占一次吧。'
};

module.exports = { TEMPLATES };
