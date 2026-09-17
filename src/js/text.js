const { FONT_FAMILY } = require('./theme.js');

/**
 * 中文文本排版。这是 Canvas 自绘里最费劲的一块 —— ctx.fillText 不会自动换行，
 * 而本产品的核心体验就是大段解读文字，所以这里必须做扎实。
 *
 * 规则（按中文排版习惯，做了简化但够用）：
 *  1. 中日韩字符可以任意处断行；连续的英文/数字当一个整词，不拆开；
 *  2. 行首不出现收尾标点（，。、）」』！？：；%》）
 *  3. 行尾不出现开头标点（（「『《【）
 *  4. 显式 \n 强制换行
 *  5. 支持 maxLines + 省略号
 *
 * 测量用的 ctx 是离屏画布（wx.createCanvas 第二次调用起都是离屏），不占屏幕。
 */

const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
const ASCII_WORD = /[A-Za-z0-9_@#$%&*+\-=/\\'.":;,~^|<>[\]{}()!?]/;
const CLOSE_PUNCT = '，。、）」』！？：；%》〉】…·';
const OPEN_PUNCT = '（「『《【〈';

let measureCtx = null;

function getMeasureCtx() {
  if (measureCtx) return measureCtx;
  try {
    const canvas = wx.createCanvas(); // 第一次是上屏画布，这里一定已经不是第一次
    /**
     * ⚠️ 真机上 getContext('2d') 有可能返回 null（画布还没就绪、离屏画布数量到上限）。
     * 以前这里直接赋值，之后在 measure() 里 `ctx.font = ...` 就在 null 上抛 TypeError ——
     * 而且是在场景 build() 里抛，整页都建不出来，真机表现就是白屏/只剩背景。
     * 所以这里必须验证拿到的 ctx 真的能用，不行就退回宽度估算。
     */
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    measureCtx = ctx && typeof ctx.measureText === 'function'
      ? ctx
      : { font: '', measureText: defaultMeasure };
  } catch (e) {
    // 测试环境的兜底：没有 wx 时用估算宽度
    measureCtx = { font: '', measureText: defaultMeasure };
  }
  return measureCtx;
}

/**
 * 从字体串里取出字号。
 *
 * ⚠️ 不能用 `parseFloat(font)`：字体简写是 `700 52px sans-serif`，
 *    parseFloat 会把**字重 700 当成字号**，估算出来的宽度直接大十几倍，
 *    每段文字都被截成"…"（真机表现是大面积省略号，而且一条错误都没有）。
 */
function fontSizeOf(fontStr) {
  const m = /(\d+(?:\.\d+)?)px/.exec(String(fontStr || ''));
  if (m) {
    const v = parseFloat(m[1]);
    if (isFinite(v) && v > 0) return v;
  }
  return 16;
}

/** 没有真实 canvas 时的宽度估算（中文按 1em，西文按 0.55em） */
function defaultMeasure(text) {
  const size = fontSizeOf(this && this.font);
  let w = 0;
  for (let i = 0; i < String(text).length; i += 1) {
    w += CJK.test(text[i]) ? size : size * 0.55;
  }
  return { width: w };
}

function measure(text, fontStr) {
  const ctx = getMeasureCtx();
  if (fontStr) ctx.font = fontStr;
  const v = ctx.measureText(String(text === undefined || text === null ? '' : text));
  return v && typeof v.width === 'number' ? v.width : 0;
}

/** 把一段文本切成"不可再拆的最小单元" */
function tokenize(text) {
  const units = [];
  const s = String(text === undefined || text === null ? '' : text);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\n') {
      units.push({ type: 'break', text: '\n' });
      i += 1;
    } else if (CJK.test(ch)) {
      units.push({ type: 'char', text: ch });
      i += 1;
    } else if (ch === ' ') {
      units.push({ type: 'space', text: ' ' });
      i += 1;
    } else if (ASCII_WORD.test(ch)) {
      let word = ch;
      i += 1;
      while (i < s.length && ASCII_WORD.test(s[i])) {
        word += s[i];
        i += 1;
      }
      units.push({ type: 'word', text: word });
    } else {
      units.push({ type: 'char', text: ch });
      i += 1;
    }
  }
  return units;
}

function widthOf(units, fontStr) {
  let w = 0;
  units.forEach((u) => {
    w += measure(u.text, fontStr);
  });
  return w;
}

/**
 * 折行。
 * @returns {string[]} 每行文本
 */
function wrap(text, maxWidth, fontStr) {
  if (!maxWidth || maxWidth <= 0) return [String(text || '')];
  const paragraphs = String(text === undefined || text === null ? '' : text).split('\n');
  const lines = [];

  paragraphs.forEach((para) => {
    if (!para) {
      lines.push('');
      return;
    }
    const units = tokenize(para).filter((u) => u.type !== 'break');
    let line = [];
    let lineWidth = 0;

    const flush = () => {
      // 行尾不留空格
      while (line.length && line[line.length - 1].type === 'space') line.pop();
      if (line.length) lines.push(line.map((u) => u.text).join(''));
      line = [];
      lineWidth = 0;
    };

    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      // 行首空格丢弃
      if (!line.length && u.type === 'space') continue;
      const w = measure(u.text, fontStr);

      if (lineWidth + w > maxWidth && line.length) {
        // 标点避头：这一行的最后一个字是开引号之类，就一起挪到下一行
        const last = line[line.length - 1];
        if (last && last.type === 'char' && OPEN_PUNCT.indexOf(last.text) >= 0) {
          line.pop();
          lineWidth -= measure(last.text, fontStr);
        }
        // 标点避尾：下一个字是收尾标点，就允许它挤在这一行
        const isClose = u.type === 'char' && CLOSE_PUNCT.indexOf(u.text) >= 0;
        if (isClose && lineWidth + w <= maxWidth * 1.15) {
          line.push(u);
          lineWidth += w;
          continue;
        }
        flush();
        if (u.type === 'space') continue;
      }
      line.push(u);
      lineWidth += w;
    }
    flush();
  });

  return lines.length ? lines : [''];
}

/**
 * 段落布局：给一段文字和宽度，算出行数组与总高度。
 * @param {object} o { text, font, lineHeight, maxWidth, maxLines, align, ellipsis }
 */
function layoutParagraph(o) {
  const opt = o || {};
  const font = opt.font || `${16}px ${FONT_FAMILY}`;
  const lineHeight = opt.lineHeight || Math.round((opt.size || 16) * 1.75);
  let lines = wrap(opt.text, opt.maxWidth, font);

  let truncated = false;
  if (opt.maxLines && lines.length > opt.maxLines) {
    lines = lines.slice(0, opt.maxLines);
    truncated = true;
    if (opt.ellipsis !== false) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.replace(/[，。、；：,.\s]+$/, '')}…`;
    }
  }

  return {
    lines,
    truncated,
    lineHeight,
    // size 必须带上：drawParagraph 靠它把文字在行高里做视觉居中
    size: opt.size || parseFloat(font) || 16,
    font,
    align: opt.align || 'left',
    width: opt.maxWidth,
    height: lines.length * lineHeight
  };
}

/** 把已排好的行画出来 */
function drawParagraph(ctx, layout, x, y, color) {
  if (!layout || !layout.lines) return 0;
  ctx.font = layout.font;
  ctx.fillStyle = color || '#E9E7F7';
  ctx.textBaseline = 'top';
  ctx.textAlign = layout.align === 'center' ? 'center' : layout.align === 'right' ? 'right' : 'left';

  const anchorX = layout.align === 'center' ? x + layout.width / 2 : layout.align === 'right' ? x + layout.width : x;

  layout.lines.forEach((line, i) => {
    // 行高按字体基线视觉居中：fillText 的 y 是文字顶部（textBaseline='top'）
    ctx.fillText(line, anchorX, y + i * layout.lineHeight + (layout.lineHeight - layout.size) / 2);
  });
  ctx.textAlign = 'left';
  return layout.height;
}

/** 单行文本，超宽自动截断加省略号 */
function singleLine(text, maxWidth, fontStr) {
  const s = String(text === undefined || text === null ? '' : text);
  if (measure(s, fontStr) <= maxWidth) return s;
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    if (measure(`${out}${s[i]}…`, fontStr) > maxWidth) break;
    out += s[i];
  }
  return `${out}…`;
}

module.exports = { measure, wrap, layoutParagraph, drawParagraph, singleLine, tokenize, CJK };
