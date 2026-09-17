const { BRAND } = require('../../config/copy.js');

/**
 * 设计令牌。表现层只认这里的名字，不写魔法数字。
 *
 * 视觉基调：深空底 + 星尘 + 暗金。这套色值和「我推的星运」的 WXSS 版一致，
 * 所以小程序版和 Canvas 版看起来是同一个产品。
 *
 * 美术接入：颜色/圆角/间距留在代码里，图片/音频走 src/assets/manifest.js。
 */

const COLOR = {
  bg: '#0B0A1F',
  bgDeep: '#08071A',
  bgSoft: '#14112E',
  /**
   * 卡片统一规格（对应"卡片四件套"）。
   * 底色 4%、描边 8% —— 比这更重的底会让深空背景失去层次，
   * 更轻则卡片和背景糊在一起（"看不出哪是一块"）。
   */
  panel: 'rgba(255,255,255,0.04)',
  panel2: 'rgba(255,255,255,0.08)',
  panelSolid: '#141230',

  line: 'rgba(232,200,122,0.18)',
  lineSoft: 'rgba(255,255,255,0.08)',

  /**
   * ⚠️ 文字四档的**用法**（这是"层级糊成一团"的根治办法）：
   *   ink  90%  标题、关键值
   *   ink2 66%  正文（正文**最低**用这一档，再暗就不合格了）
   *   ink3 47%  辅助说明、标签
   *   ink4 34%  只给脚注/合规/装饰编号 —— 不要拿它排正文
   * 之前的问题就是正文大量用了 ink3/ink4，整页"灰蒙蒙看不清"。
   */
  ink: '#E9E7F7',
  ink2: '#A9A4C7',
  ink3: '#7B7794',
  ink4: '#575374',

  gold: '#E8C87A',
  goldLight: '#FFE9AE',
  goldDeep: '#A87A22',
  /** 主按钮渐变的两端（linear-gradient(180deg, #F0D695, #D9B45F)） */
  goldTop: '#F0D695',
  goldBottom: '#D9B45F',
  violet: '#8B6CF0',
  violetLight: '#C6B4FF',
  cyan: '#63D7E8',
  rose: '#F06C9B',
  green: '#7BD88F',
  red: '#E86A6A',

  // 稀有度
  legend: '#E8C87A',
  epic: '#8B6CF0',
  rare: '#63D7E8',
  common: '#A9A4C7'
};

/**
 * 语义化文字色。表现层优先用它，不要直接写 COLOR.inkN ——
 * 这样"正文太暗"这类调整只需要改这里一处。
 */
const TXT = {
  title: COLOR.ink, // 大标题
  strong: COLOR.ink, // 卡片标题、关键值
  body: COLOR.ink, // 卡片正文
  sub: COLOR.ink2, // 页面副标题、次级正文
  aux: COLOR.ink3, // 辅助说明
  faint: COLOR.ink4, // 脚注 / 合规
  gold: COLOR.gold,
  dim: COLOR.ink2
};

/**
 * 卡片统一规格：圆角 32、内边距 32、间距 24（= 逻辑 375 宽下的 16/16/12px）。
 * 之前圆角有大有小（20/28/36）、内边距 28 和 32 混用，是"细节粗糙"的主要来源。
 */
const CARD = {
  radius: 32,
  pad: 32,
  gap: 24,
  fill: COLOR.panel,
  stroke: COLOR.lineSoft
};

const RARITY_STYLE = {
  legend: { color: COLOR.legend, glow: 'rgba(232,200,122,0.30)', label: '传说命途' },
  epic: { color: COLOR.epic, glow: 'rgba(139,108,240,0.26)', label: '史诗命途' },
  rare: { color: COLOR.rare, glow: 'rgba(99,215,232,0.22)', label: '稀有命途' },
  common: { color: COLOR.common, glow: 'rgba(200,200,220,0.14)', label: '寻常命途' }
};

/**
 * 字号（设计稿 750 宽下的 px，和 rpx 同尺度）。
 *
 * 层级规范（括号里是 375 逻辑宽下的等效 px，对着设计稿看就知道该用哪档）：
 *   hero 68(34)   品牌大标题
 *   h1   52(26)   页面大标题
 *   h2   40(20)   弹窗标题
 *   h3   32(16)   卡片标题 / 小节标题
 *   body 28(14)   正文
 *   small 24(12)  辅助说明 / 表单标签
 *   tiny 21(10.5) 小标签
 *   micro 19(9.5) 脚注
 * 另有几个语义别名（big/cardTitle/qtitle）—— 它们不是新档位，
 * 而是"这一处的字号有明确用途、不该随手改"的标记。
 */
const FONT = {
  hero: 68,
  h1: 52,
  h2: 40,
  h3: 32,
  body: 28,
  small: 24,
  tiny: 21,
  micro: 19,
  /** 共振度那种"整页锚点"的大数字 */
  big: 64,
  /** 卡片标题：比 h3 略大一档，和正文拉开 */
  cardTitle: 34,
  /** 题干：答题页的主角 */
  qtitle: 48,
  /** 列表前置图标 */
  icon: 40
};

const SPACE = [0, 8, 16, 24, 32, 40, 56, 72, 96];
const RADIUS = { sm: 12, md: 20, lg: 28, xl: 36, pill: 999, card: 32 };

/** 字体族：小游戏里直接用系统字体，中文不用带字体文件 */
const FONT_FAMILY = 'sans-serif';

/**
 * 字体串。
 *
 * ⚠️ 字号必须取整：真机 Canvas 对 `font` 简写的解析比开发者工具严格，
 * 像 `700 116.55px sans-serif` 这种带小数的字号有可能被**静默忽略**
 * （不报错，但字体保持上一次的值）—— 表现是"该显示的字没显示"，
 * 而日志里一条错误都没有，极难查。统一在这里取整，调用方不用自己 round。
 */
function font(size, weight) {
  const n = Number(size);
  const px = isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : 16;
  return `${weight ? `${weight} ` : ''}${px}px ${FONT_FAMILY}`;
}

/** 布局常量 */
const LAYOUT = {
  designWidth: 750,
  pad: 32,
  safeTopMin: 40 // 刘海屏兜底（实际取 safeArea.top）
};

const BRAND_INFO = { name: BRAND.NAME, safeName: BRAND.SAFE_NAME, slogan: BRAND.SLOGAN };

/**
 * 缓动。数字滚动、入场动画、按压反馈都用它 ——
 * 线性插值看起来"机械"，这几十行换来的手感是整个 App 的质感。
 */
const EASE = {
  outCubic: (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3),
  outQuint: (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 5),
  outBack: (p) => {
    const c = 1.70158;
    const x = Math.max(0, Math.min(1, p)) - 1;
    return 1 + (c + 1) * x * x * x + c * x * x;
  },
  /** 0→1→0 的呼吸曲线（发光动画用） */
  breathe: (p) => 0.5 - 0.5 * Math.cos(Math.max(0, Math.min(1, p)) * Math.PI * 2)
};

/** 两位补零：题号、编号（02 / No.04） */
function pad2(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return v < 10 ? `0${v}` : String(v);
}

module.exports = {
  COLOR,
  TXT,
  CARD,
  RARITY_STYLE,
  FONT,
  SPACE,
  RADIUS,
  FONT_FAMILY,
  EASE,
  pad2,
  font,
  LAYOUT,
  BRAND_INFO
};
