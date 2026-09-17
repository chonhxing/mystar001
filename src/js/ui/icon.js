const { COLOR } = require('../theme.js');

/**
 * 图标集。
 *
 * 全是**线条矢量**，不带任何图片资源 —— 三个理由：
 *  1. 小游戏的包体有硬上限，图标又是高频刚需，能省则省；
 *  2. 位图图标在 2x/3x 屏上要么糊要么白占几倍体积，矢量跟着 dpr 走；
 *  3. 换色只要传一个参数，深色主题调一次全站生效。
 *
 * 统一规格：`size` 是图标的**外接方框边长**（不是半径），线宽按 size 的 8% 走，
 * 所以同一个图标放大缩小都不会"线变粗成块"。所有图标都按"中心点 + 方框"定位，
 * 调用方只要给一行的中心 y 就能对齐。
 */

const TAU = Math.PI * 2;

/** 图标名 → 画面函数（都在 0,0 为中心的 size×size 方框里作画） */
const GLYPHS = {
  // —— 底部/列表 ——
  book(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.38);
    ctx.lineTo(-s * 0.32, s * 0.34);
    ctx.lineTo(0, s * 0.24);
    ctx.lineTo(s * 0.32, s * 0.34);
    ctx.lineTo(s * 0.32, -s * 0.38);
    ctx.lineTo(0, -s * 0.28);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.28);
    ctx.lineTo(0, s * 0.24);
    ctx.stroke();
  },
  clock(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.20);
    ctx.lineTo(0, 0);
    ctx.lineTo(s * 0.17, s * 0.10);
    ctx.stroke();
  },
  ticket(ctx, s) {
    const w = s * 0.74;
    const h = s * 0.50;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.stroke();
    // 中间的虚线撕口：这才是"票"的辨识点，比画缺口稳（缺口路径容易连线出错）
    if (ctx.setLineDash) ctx.setLineDash([s * 0.06, s * 0.06]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -h / 2);
    ctx.lineTo(-s * 0.08, h / 2);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
  },
  gear(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.20, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (TAU / 8) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26);
      ctx.lineTo(Math.cos(a) * s * 0.40, Math.sin(a) * s * 0.40);
      ctx.stroke();
    }
  },
  user(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, -s * 0.16, s * 0.19, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, s * 0.40, s * 0.34, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },
  doc(ctx, s) {
    const w = s * 0.56;
    const h = s * 0.78;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w * 0.16, -h / 2);
    ctx.lineTo(w / 2, -h * 0.16);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.stroke();
    [-0.16, 0.04, 0.24].forEach((fy) => {
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, h * fy);
      ctx.lineTo(w * 0.26, h * fy);
      ctx.stroke();
    });
  },
  trash(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.26);
    ctx.lineTo(s * 0.30, -s * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.20, -s * 0.26);
    ctx.lineTo(-s * 0.16, s * 0.36);
    ctx.lineTo(s * 0.16, s * 0.36);
    ctx.lineTo(s * 0.20, -s * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.26);
    ctx.lineTo(-s * 0.10, -s * 0.38);
    ctx.lineTo(s * 0.10, -s * 0.38);
    ctx.lineTo(s * 0.10, -s * 0.26);
    ctx.stroke();
  },
  shield(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.40);
    ctx.lineTo(s * 0.32, -s * 0.24);
    ctx.lineTo(s * 0.32, s * 0.06);
    ctx.quadraticCurveTo(s * 0.32, s * 0.34, 0, s * 0.42);
    ctx.quadraticCurveTo(-s * 0.32, s * 0.34, -s * 0.32, s * 0.06);
    ctx.lineTo(-s * 0.32, -s * 0.24);
    ctx.closePath();
    ctx.stroke();
  },
  info(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.02);
    ctx.lineTo(0, s * 0.20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.17, Math.max(1, s * 0.045), 0, TAU);
    ctx.fill();
  },
  calendar(ctx, s) {
    const w = s * 0.70;
    const h = s * 0.64;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + s * 0.10);
    ctx.lineTo(w / 2, -h / 2 + s * 0.10);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.10);
    ctx.lineTo(w / 2, -h * 0.10);
    ctx.stroke();
    [-w * 0.22, w * 0.22].forEach((fx) => {
      ctx.beginPath();
      ctx.moveTo(fx, -h / 2 + s * 0.10);
      ctx.lineTo(fx, -h / 2 - s * 0.04);
      ctx.stroke();
    });
  },
  // —— 状态/动作 ——
  check(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, s * 0.02);
    ctx.lineTo(-s * 0.08, s * 0.26);
    ctx.lineTo(s * 0.34, -s * 0.24);
    ctx.stroke();
  },
  cross(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.24);
    ctx.lineTo(s * 0.24, s * 0.24);
    ctx.moveTo(s * 0.24, -s * 0.24);
    ctx.lineTo(-s * 0.24, s * 0.24);
    ctx.stroke();
  },
  plus(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.28);
    ctx.lineTo(0, s * 0.28);
    ctx.moveTo(-s * 0.28, 0);
    ctx.lineTo(s * 0.28, 0);
    ctx.stroke();
  },
  edit(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, s * 0.28);
    ctx.lineTo(-s * 0.20, s * 0.04);
    ctx.lineTo(s * 0.20, -s * 0.34);
    ctx.lineTo(s * 0.32, -s * 0.22);
    ctx.lineTo(-s * 0.08, s * 0.16);
    ctx.closePath();
    ctx.stroke();
  },
  // —— 性别（不写成文字，字形在 Canvas 里不稳）——
  female(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.22, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.10);
    ctx.lineTo(0, s * 0.38);
    ctx.moveTo(-s * 0.14, s * 0.24);
    ctx.lineTo(s * 0.14, s * 0.24);
    ctx.stroke();
  },
  male(ctx, s) {
    ctx.beginPath();
    ctx.arc(-s * 0.08, s * 0.08, s * 0.22, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.06, -s * 0.06);
    ctx.lineTo(s * 0.32, -s * 0.32);
    ctx.moveTo(s * 0.32, -s * 0.32);
    ctx.lineTo(s * 0.14, -s * 0.32);
    ctx.moveTo(s * 0.32, -s * 0.32);
    ctx.lineTo(s * 0.32, -s * 0.14);
    ctx.stroke();
  },
  diamond(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.30);
    ctx.lineTo(s * 0.26, 0);
    ctx.lineTo(0, s * 0.30);
    ctx.lineTo(-s * 0.26, 0);
    ctx.closePath();
    ctx.stroke();
  },
  /** 次数：一小组圆点，比数字更像"配额" */
  dots(ctx, s) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(i * s * 0.26, 0, s * 0.075, 0, TAU);
      ctx.fill();
    }
  },
  /** 四角星芒（AI 深化解读那一行用它 —— 别用齿轮，那是"设置"的意思） */
  spark(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const rad = i % 2 === 0 ? s * 0.40 : s * 0.11;
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  },
  /** 卡（畅玩卡那一行用它，和"次数""票券"区分开） */
  card(ctx, s) {
    const w = s * 0.78;
    const h = s * 0.54;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.16);
    ctx.lineTo(w / 2, -h * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-w * 0.34, h * 0.10, w * 0.26, h * 0.18);
    ctx.stroke();
  }
};

/**
 * 画一个图标。
 * @param {object} ctx
 * @param {string} name  GLYPHS 里的名字，未知名字不画（不抛，避免一个笔误黑屏）
 * @param {number} cx,cy 中心点
 * @param {number} size  外接方框边长
 * @param {number} alpha 透明度（默认 0.6 —— 列表前置图标的"退后一档"是规范动作）
 */
function drawIcon(ctx, name, cx, cy, size, color, alpha, lineWidth) {
  const g = GLYPHS[name];
  if (!g) return false;
  const s = Math.max(4, Number(size) || 20);
  ctx.save();
  ctx.translate(Number(cx) || 0, Number(cy) || 0);
  ctx.globalAlpha *= alpha === undefined ? 0.6 : alpha;
  ctx.strokeStyle = color || COLOR.ink;
  ctx.fillStyle = color || COLOR.ink;
  ctx.lineWidth = lineWidth === undefined ? Math.max(1.2, s * 0.08) : lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  g(ctx, s);
  ctx.restore();
  return true;
}

/** 名字是否有效（测试用：防止拼错的图标名静默消失） */
function has(name) {
  return !!GLYPHS[name];
}

function names() {
  return Object.keys(GLYPHS);
}

module.exports = { drawIcon, has, names, GLYPHS };
