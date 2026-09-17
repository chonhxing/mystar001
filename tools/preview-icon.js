/* eslint-disable no-console */
/**
 * 图标自检：把生成结果转成"能读"的形式，用来审查构图。
 *
 *   node tools/preview-icon.js            # 144 尺寸
 *   node tools/preview-icon.js --size=512
 *
 * 为什么需要它：图标是程序化生成的，改一个数字就可能把主体画歪、把对比度画没，
 * 而 PNG 本身没法用眼睛逐像素检查。这里做三件事：
 *   1. 亮度矩阵 → 字符画（能看出主体位置、留白、有没有糊成一团）
 *   2. 色相标记 → 金/紫/白各自落在哪（验证配色是不是照设计走）
 *   3. 缩到 48px 再统计对比度与主体占比（小图标可读性的硬指标）
 */

const { makeIcon } = require('./make-icon.js');

const args = process.argv.slice(2);
const getArg = (n) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : '';
};
const SIZE = Number(getArg('size')) || 144;

/** 把 PNG 解回像素：直接重新生成一份画布数据更省事（同一份代码，不会不一致） */
function pixels(size) {
  const png = makeIcon(size, 4);
  const zlib = require('zlib');
  // 解析自己写的 PNG：IHDR + IDAT（filter 全是 0，直接读）
  let off = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w * 4; x += 1) out[y * w * 4 + x] = raw[y * stride + 1 + x];
  }
  return { w, h, px: out };
}

function lumAt(px, w, x, y) {
  const i = (y * w + x) * 4;
  const a = px[i + 3] / 255;
  const r = (px[i] / 255) * a + (1 - a) * 0.06;
  const g = (px[i + 1] / 255) * a + (1 - a) * 0.06;
  const b = (px[i + 2] / 255) * a + (1 - a) * 0.06;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function main() {
  const { w, h, px } = pixels(SIZE);
  const COLS = 56;
  const ROWS = 28;
  const cellW = w / COLS;
  const cellH = h / ROWS;
  const rampChars = ' .:-=+*#%@';

  console.log(`\n=== ${SIZE}x${SIZE} 亮度字符画（越亮越靠右： "${rampChars}"）===`);
  let sum = 0;
  let bright = 0;
  let bx0 = w;
  let by0 = h;
  let bx1 = -1;
  let by1 = -1;
  let cxSum = 0;
  let cySum = 0;
  let brightN = 0;
  const rows = [];
  for (let ry = 0; ry < ROWS; ry += 1) {
    let line = '';
    for (let rx = 0; rx < COLS; rx += 1) {
      let acc = 0;
      let n = 0;
      for (let y = Math.floor(ry * cellH); y < Math.floor((ry + 1) * cellH); y += 1) {
        for (let x = Math.floor(rx * cellW); x < Math.floor((rx + 1) * cellW); x += 1) {
          acc += lumAt(px, w, x, y);
          n += 1;
        }
      }
      const v = n ? acc / n : 0;
      line += rampChars[Math.min(rampChars.length - 1, Math.round(v * (rampChars.length - 1)))];
    }
    rows.push(line);
  }

  // 全图统计（按像素，不按格子）
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = lumAt(px, w, x, y);
      sum += v;
      if (v > 0.55) {
        bright += 1;
        cxSum += x;
        cySum += y;
        brightN += 1;
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x);
        by1 = Math.max(by1, y);
      }
    }
  }
  rows.forEach((r) => console.log(`  ${r}`));

  const total = w * h;
  let minA = 255;
  for (let i = 3; i < px.length; i += 4) minA = Math.min(minA, px[i]);
  console.log(`\n=== 统计 ===`);
  console.log(
    `  最小 alpha ${minA}（必须是 255 —— 图标不能有透明像素，否则平台垫的底色会透出来）`
  );
  console.log(`  平均亮度 ${(sum / total).toFixed(3)}（深色底：0.06~0.15 算正常）`);
  console.log(`  亮部（>0.55）占比 ${((bright / total) * 100).toFixed(1)}%（主体不该超过 ~25%）`);
  if (brightN) {
    const cx = cxSum / brightN / w;
    const cy = cySum / brightN / h;
    console.log(`  亮部重心 (${(cx * 100).toFixed(1)}%, ${(cy * 100).toFixed(1)}%)（想居中就该在 50% 附近）`);
    console.log(
      `  亮部包围盒 x ${((bx0 / w) * 100).toFixed(0)}~${((bx1 / w) * 100).toFixed(0)}% · ` +
        `y ${((by0 / h) * 100).toFixed(0)}~${((by1 / h) * 100).toFixed(0)}%`
    );
  } else {
    console.log('  ⚠️ 没有亮部：主体是不是没画出来？');
  }

  // 缩到 48px 的可读性：对比度与主体占比
  {
    const T = 48;
    const step = Math.round(w / T);
    let lo = 1;
    let hi = 0;
    let tBright = 0;
    for (let y = 0; y < T; y += 1) {
      for (let x = 0; x < T; x += 1) {
        let acc = 0;
        let n = 0;
        for (let sy = 0; sy < step; sy += 1) {
          for (let sx = 0; sx < step; sx += 1) {
            acc += lumAt(px, w, Math.min(w - 1, x * step + sx), Math.min(h - 1, y * step + sy));
            n += 1;
          }
        }
        const v = acc / n;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
        if (v > 0.55) tBright += 1;
      }
    }
    console.log(`\n=== 缩到 48x48 之后 ===`);
    console.log(`  对比度 ${lo.toFixed(3)} ~ ${hi.toFixed(3)}（差距越大越"跳"）`);
    console.log(`  主体占比 ${((tBright / (T * T)) * 100).toFixed(1)}%`);
  }
}

main();
