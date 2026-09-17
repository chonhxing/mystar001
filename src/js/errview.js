const { COLOR, FONT, font } = require('./theme.js');
const draw = require('./draw.js');
const text = require('./text.js');
const analytics = require('../../services/analytics.js');

/**
 * 把"最后一条错误"画在屏幕上。
 *
 * ## 为什么非要有这个
 *
 * 小游戏在**真机上没有控制台**。而 Canvas 自绘只要某一帧抛一次异常：
 *   1. 异常从 scene.draw 冒出去 → 打断 stage 的帧循环（`requestAnimationFrame` 在最后一行，
 *      根本执行不到）→ **画面永远停在那一帧**
 *   2. 表现就是"打开只有背景，什么都没有"，而且**完全看不出为什么** —— 这个坑真踩过
 *
 * 所以：捕获 → 记住 → **画在屏幕上**。这样至少能对着手机把错误读出来。
 * 同时 console.error 一份（开着 vConsole 时手机上可见），并进埋点。
 *
 * 注意：同一条错误只报一次（相同 where+message 累加计数），
 * 否则每帧都报会把日志和屏幕刷爆。
 */

let current = null;

/** 只留最有用的两行栈：第一行通常就指向出错的函数 */
function brief(err) {
  const stack = String((err && err.stack) || '');
  return stack
    .split('\n')
    .slice(1, 4)
    .map((l) => l.trim().replace(/^at\s+/, ''))
    .filter((l) => l && l.indexOf('native') < 0)
    .slice(0, 2)
    .join('  ←  ');
}

/**
 * 记一条错误。
 * @param {string} where 出错位置，例如 'draw:HomeScene'
 * @param {Error} err
 */
function record(where, err) {
  const message = (err && err.message) || String(err || 'unknown');
  if (current && current.where === where && current.message === message) {
    current.count += 1;
    return current;
  }
  current = {
    where,
    message,
    stack: brief(err),
    count: 1,
    at: Date.now()
  };
  // 控制台（vConsole 在真机上可见）+ 埋点 + 环形日志
  // eslint-disable-next-line no-console
  console.error(`[game] ${where} 出错: ${message}\n${current.stack}`);
  try {
    analytics.error(where, `${message} @ ${current.stack}`);
  } catch (e) {
    /* 埋点自己出错也不能再抛 */
  }
  return current;
}

function get() {
  return current;
}

function clear() {
  current = null;
}

/** 把错误卡画在画布上（stage 每帧末尾调用，画在所有内容之上） */
function drawCard(ctx, stage) {
  if (!current) return;
  const pad = 24;
  const w = stage.width - pad * 2;
  const lines = [
    `✕ ${current.where}`,
    current.message,
    current.stack,
    current.count > 1 ? `已重复 ${current.count} 次 · ${new Date(current.at).toLocaleTimeString()}` : ''
  ].filter(Boolean);

  const layout = lines.map((s, i) => {
    const size = i === 0 ? FONT.small : FONT.tiny;
    return {
      s,
      size,
      l: text.layoutParagraph({
        text: s,
        font: font(size),
        size,
        lineHeight: Math.round(size * 1.5),
        maxWidth: w - pad * 2
      })
    };
  });
  const bodyH = layout.reduce((s, l) => s + l.l.height + 8, 0);
  const h = bodyH + pad * 2;
  const x = pad;
  const y = stage.contentTop + 12;

  ctx.save();
  draw.fillRoundRect(ctx, x, y, w, h, 20, 'rgba(20,8,12,0.94)');
  draw.strokeRoundRect(ctx, x, y, w, h, 20, 'rgba(232,106,106,0.75)', 2);

  let ty = y + pad;
  layout.forEach((l, i) => {
    l.l.width = w - pad * 2;
    l.l.size = l.size;
    text.drawParagraph(ctx, l.l, x + pad, ty, i === 0 ? COLOR.red : i === 1 ? COLOR.ink : COLOR.ink3);
    ty += l.l.height + 8;
  });

  ctx.font = font(FONT.micro);
  ctx.fillStyle = COLOR.ink4;
  ctx.textBaseline = 'middle';
  ctx.fillText('把这一屏截图发给开发者', x + pad, y + h + 22);
  ctx.restore();
}

module.exports = { record, get, clear, drawCard };
