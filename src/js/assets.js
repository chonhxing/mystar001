const { CONFIG } = require('../../config/index.js');
const { COLOR, RARITY_STYLE } = require('./theme.js');
const draw = require('./draw.js');

/**
 * 资源层。美术没到位的阶段，这里负责**凭空生成占位立绘**：
 * 用离屏画布画一张「按角色 id 稳定配色 + 名字首字」的渐变图，缓存起来当图片用。
 * 所以现在一张 png 都没有，图鉴和结果页也是有画面感的，不是空白。
 *
 * 美术接入：把图按 src/assets/manifest.js 里的 key 放进 assets/，
 * 然后把 config 的 ENABLE_ART 改成 true —— 场景代码一行都不用动。
 */

const cache = {};
const images = {};
const pending = {};

let artCanvasFactory = null;

function setCanvasFactory(fn) {
  artCanvasFactory = fn;
}

/** 稳定的色相：同一角色每次都是同一个颜色 */
function hueOf(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * 色相 → rgba 字符串。
 *
 * ⚠️ 这里以前返回的是 `hsl(...)` —— **微信小游戏的 Canvas 不接受 hsl/hsla**，
 * 放进渐变会直接抛 `addColorStop with invalid params`（真机实测，基础库 3.17.2），
 * 而开发者工具的 canvas 是浏览器的所以支持，于是"工具正常、真机崩"。
 * 统一走 draw.hslToRgba 转成 rgba。
 */
function hsl(h, s, l, a) {
  return draw.hslToRgba(h, s, l, a);
}

/**
 * 生成一张占位立绘（离屏画布）。
 * @returns {object|null} 可被 ctx.drawImage 使用的画布对象
 */
function placeholder(character) {
  if (!artCanvasFactory) return null;
  const key = `ph:${character.id}`;
  if (cache[key]) return cache[key];

  const W = 300;
  const H = 400;
  const canvas = artCanvasFactory();
  canvas.width = W;
  canvas.height = H;
  // 真机上离屏画布可能拿不到 ctx（离屏画布数量到上限 / 还没就绪）——
  // 那就返回 null，调用方会退回纯文字渲染（drawImageCover 对 falsy 是安全的）
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (!ctx) return null;

  const hue = hueOf(character.id);
  const style = RARITY_STYLE[character.rarity] || RARITY_STYLE.common;

  // 底色：对角渐变
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, hsl(hue, 46, 34));
  g.addColorStop(1, hsl((hue + 42) % 360, 38, 12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 稀有度光晕
  const rg = ctx.createRadialGradient(W * 0.7, H * 0.25, 0, W * 0.7, H * 0.25, W * 0.9);
  rg.addColorStop(0, style.glow);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  // 星点
  for (let i = 0; i < 26; i += 1) {
    const a = Math.sin(i * 12.9898 + hue) * 43758.5453;
    const b = Math.sin(i * 78.233 + hue) * 12345.6789;
    const fx = a - Math.floor(a);
    const fy = b - Math.floor(b);
    ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(fx * W, fy * H, i % 9 === 0 ? 2 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 名字首字（大字，作为剪影替身）
  const glyph = character.name ? character.name.slice(-1) : '?';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 130px sans-serif';
  ctx.fillText(glyph, W / 2, H / 2 - 10);

  // 底部渐隐，让文字压上去也看得清
  const fg = ctx.createLinearGradient(0, H * 0.6, 0, H);
  fg.addColorStop(0, 'rgba(11,10,31,0)');
  fg.addColorStop(1, 'rgba(11,10,31,0.85)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  cache[key] = canvas;
  return canvas;
}

/** 加载一张真实图片（异步），失败就返回 null，调用方自动退回占位 */
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (images[src]) return Promise.resolve(images[src]);
  if (pending[src]) return pending[src];

  pending[src] = new Promise((resolve) => {
    let img = null;
    try {
      img = wx.createImage();
    } catch (e) {
      resolve(null);
      return;
    }
    img.onload = () => {
      images[src] = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
    // 真机上偶尔不回调，兜个底
    setTimeout(() => resolve(images[src] || null), 6000);
  });
  return pending[src];
}

/**
 * 拿一个角色的立绘（同步）。
 * 有真图返回真图，否则返回占位画布。
 */
function getArt(character) {
  if (!character) return null;
  if (CONFIG.ENABLE_ART) {
    const file = character.art || character.id;
    // 小游戏里图片路径用相对路径最稳：去掉 ART_BASE 开头的斜杠
    const src = `${String(CONFIG.ART_BASE).replace(/^\//, '')}${file}${CONFIG.ART_EXT}`;
    if (images[src]) return images[src];
    // 真图还没加载完，先用占位顶上，加载完自动换（场景会在下一帧重绘）
    loadImage(src).then((img) => {
      if (img) {
        const stage = require('./ui/widget.js').getStage();
        if (stage) stage.requestRender();
      }
    });
    return placeholder(character);
  }
  return placeholder(character);
}

/** 预加载当前需要的立绘（进图鉴前调一次） */
function preload(list) {
  if (!CONFIG.ENABLE_ART) return Promise.resolve();
  const base = String(CONFIG.ART_BASE).replace(/^\//, '');
  return Promise.all((list || []).map((c) => loadImage(`${base}${c.art || c.id}${CONFIG.ART_EXT}`)));
}

/**
 * 清缓存。收到 wx.onMemoryWarning 时调用 —— 占位立绘是离屏画布，
 * 最占内存，而且随时可以按需重建。
 */
function clearCache() {
  Object.keys(cache).forEach((k) => {
    delete cache[k];
  });
}

module.exports = { getArt, placeholder, loadImage, preload, setCanvasFactory, hueOf, clearCache };
