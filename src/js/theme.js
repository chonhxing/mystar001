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
  panel: 'rgba(255,255,255,0.045)',
  panel2: 'rgba(255,255,255,0.08)',
  panelSolid: '#141230',

  line: 'rgba(232,200,122,0.18)',
  lineSoft: 'rgba(255,255,255,0.08)',

  ink: '#E9E7F7',
  ink2: '#A9A4C7',
  ink3: '#6E6A8F',
  ink4: '#575374',

  gold: '#E8C87A',
  goldLight: '#FFE9AE',
  goldDeep: '#A87A22',
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

const RARITY_STYLE = {
  legend: { color: COLOR.legend, glow: 'rgba(232,200,122,0.30)', label: '传说命途' },
  epic: { color: COLOR.epic, glow: 'rgba(139,108,240,0.26)', label: '史诗命途' },
  rare: { color: COLOR.rare, glow: 'rgba(99,215,232,0.22)', label: '稀有命途' },
  common: { color: COLOR.common, glow: 'rgba(200,200,220,0.14)', label: '寻常命途' }
};

/** 字号（设计稿 750 宽下的 px，和 rpx 同尺度） */
const FONT = {
  hero: 68,
  h1: 52,
  h2: 40,
  h3: 32,
  body: 28,
  small: 24,
  tiny: 21,
  micro: 19
};

const SPACE = [0, 8, 16, 24, 32, 40, 56, 72, 96];
const RADIUS = { sm: 12, md: 20, lg: 28, xl: 36, pill: 999 };

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

module.exports = { COLOR, RARITY_STYLE, FONT, SPACE, RADIUS, FONT_FAMILY, font, LAYOUT, BRAND_INFO };
