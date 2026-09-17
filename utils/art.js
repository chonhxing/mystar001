const { CONFIG } = require('../config/index.js');

/**
 * 美术资源解析。
 *
 * 现在的状态：一张图都没有，但全流程要能跑通、能看、能给人演示。
 * 所以默认走「渐变底 + 名字首字 + 稀有度描边」的占位渲染 ——
 * 后面美术把立绘丢进 assets/chars/ 之后，只要把 config.ENABLE_ART 改成 true，
 * 所有卡片自动换成真图，一行组件代码都不用改。
 */

/** 稳定的色相：同一个角色每次渲染都是同一个颜色 */
function hueOf(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 360;
  }
  return h;
}

const RARITY_GLOW = {
  legend: { from: 'rgba(232,200,122,0.34)', to: 'rgba(120,80,20,0.06)', ring: '#E8C87A' },
  epic: { from: 'rgba(139,108,240,0.30)', to: 'rgba(60,40,120,0.06)', ring: '#8B6CF0' },
  rare: { from: 'rgba(99,215,232,0.26)', to: 'rgba(30,80,100,0.06)', ring: '#63D7E8' },
  common: { from: 'rgba(200,200,220,0.16)', to: 'rgba(60,60,80,0.04)', ring: '#A9A4C7' }
};

/**
 * 解析一个角色的展示资源。
 * @returns {{ mode:'image'|'placeholder', src?:string, glyph:string, style:string, ring:string }}
 */
function resolveArt(character) {
  if (!character) {
    return { mode: 'placeholder', glyph: '?', style: '', ring: '#A9A4C7' };
  }
  const rarity = RARITY_GLOW[character.rarity] || RARITY_GLOW.common;
  const hue = hueOf(character.id);

  if (CONFIG.ENABLE_ART) {
    const file = character.art || character.id;
    return {
      mode: 'image',
      src: `${CONFIG.ART_BASE}${file}${CONFIG.ART_EXT}`,
      glyph: character.name.slice(0, 1),
      style: '',
      ring: rarity.ring
    };
  }

  // 占位：按角色 id 生成一个稳定的渐变，加上首字
  const style =
    `background-image:linear-gradient(150deg, hsl(${hue}, 46%, 34%) 0%, hsl(${(hue + 42) % 360}, 38%, 14%) 100%);` +
    `box-shadow:inset 0 0 40rpx 10rpx ${rarity.to};`;

  return {
    mode: 'placeholder',
    glyph: character.name.length > 2 ? character.name.slice(-1) : character.name.slice(0, 1),
    style,
    ring: rarity.ring,
    hue
  };
}

/** 命途标签的展示色（按 id 稳定分配） */
function fateColor(id) {
  const hue = hueOf(id);
  return `hsl(${hue}, 52%, 68%)`;
}

/** 八轴条形图的两端色：偏"前极"用暖金，偏"后极"用冷紫 */
function axisColor(value) {
  return value >= 50 ? '#E8C87A' : '#8B6CF0';
}

module.exports = { resolveArt, fateColor, axisColor, hueOf, RARITY_GLOW };
