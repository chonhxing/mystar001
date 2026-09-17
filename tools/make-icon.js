/* eslint-disable no-console */
/**
 * 生成小游戏图标（144×144，PNG）。
 *
 *   node tools/make-icon.js                     # 写 store/icon-144.png + store/icon-512.png
 *   node tools/make-icon.js --out=D:/icon.png   # 写到别处
 *   node tools/make-icon.js --size=512          # 只出一张指定尺寸
 *
 * ## 为什么是手写光栅器 + 手写 PNG 编码器
 *
 * 这个项目**零依赖**（`package.json` 里连 devDependencies 都没有），
 * 而图标必须能随时重新生成 —— 以后换配色、换构图，跑一条命令就出来了，
 * 不用去找设计源文件。所以这里用 zlib + 手写 IHDR/IDAT 直接编码 PNG，
 * 画图部分自己算像素（和 src/js/assets.js 里"程序化生成占位立绘"是同一个思路）。
 *
 * ## 图标讲了什么
 *
 * - **八角星**：游戏的八轴命途图谱，四长四短 = 主星与副星
 * - **倾斜的星轨**：命途的走向。轨道上那颗小星是"和你共振的那个角色"
 * - **八边形虚线**：八根轴围成的图谱轮廓
 * - **深空底 + 暗金 + 紫**：和游戏内 UI 同一套色板（src/js/theme.js）
 *
 * 小图标的可读性优先：元素少、对比强、主体居中留白，缩到 48px 也认得出。
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------- PNG 编码

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}

function crc32(buf) {
  const t = crcTable();
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array，长度 w*h*4，非预乘 */
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10/11/12 = compression/filter/interlace，全 0
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * stride] = 0; // filter: none（有超采样抗锯齿，不需要滤波器）
    for (let x = 0; x < w * 4; x += 1) raw[y * stride + 1 + x] = rgba[y * w * 4 + x];
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------- 画布

function hex(s) {
  const v = String(s).replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255
  ];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 在 [stops] 上按 t(0~1) 取色。stops: [[t, '#rrggbb'], ...] */
function ramp(stops, t) {
  const v = clamp01(t);
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (v >= a[0] && v <= b[0]) {
      const span = b[0] - a[0] || 1;
      const k = (v - a[0]) / span;
      const ca = hex(a[1]);
      const cb = hex(b[1]);
      return [lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k)];
    }
  }
  return hex(stops[stops.length - 1][1]);
}

class Canvas {
  /** @param {number} size 逻辑边长 @param {number} ss 超采样倍数（抗锯齿靠它） */
  constructor(size, ss) {
    this.size = size;
    this.ss = ss || 1;
    this.w = size * this.ss;
    this.h = size * this.ss;
    this.buf = new Float32Array(this.w * this.h * 4); // 直线 alpha，0~1
  }

  /** 逻辑坐标 → 缓冲坐标 */
  px(v) {
    return v * this.ss;
  }

  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const al = a <= 0 ? 0 : a > 1 ? 1 : a;
    if (al === 0) return;
    const i = (y * this.w + x) * 4;
    const buf = this.buf;
    const da = buf[i + 3];
    const ia = 1 - al;
    const outA = al + da * ia;
    if (outA <= 0) return;
    buf[i] = (r * al + buf[i] * da * ia) / outA;
    buf[i + 1] = (g * al + buf[i + 1] * da * ia) / outA;
    buf[i + 2] = (b * al + buf[i + 2] * da * ia) / outA;
    buf[i + 3] = outA;
  }

  /** 铺底：径向渐变（逻辑坐标） */
  radial(cx, cy, r0, r1, stops) {
    const x0 = Math.max(0, Math.floor(this.px(cx - r1)));
    const x1 = Math.min(this.w - 1, Math.ceil(this.px(cx + r1)));
    const y0 = Math.max(0, Math.floor(this.px(cy - r1)));
    const y1 = Math.min(this.h - 1, Math.ceil(this.px(cy + r1)));
    const c = this.ss;
    const R0 = this.px(r0);
    const R1 = this.px(r1);
    for (let y = y0; y <= y1; y += 1) {
      const dy = y - this.px(cy);
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - this.px(cx);
        const d = Math.sqrt(dx * dx + dy * dy);
        const t = clamp01((d - R0) / (R1 - R0 || 1));
        const col = ramp(stops, t);
        this.blend(x, y, col[0], col[1], col[2], 1);
      }
    }
    void c;
  }

  /** 加色发光：中心亮、向外衰减（d^2 衰减，比线性更"发光"） */
  glow(cx, cy, r, color, intensity) {
    const c = hex(color);
    const R = this.px(r);
    const x0 = Math.max(0, Math.floor(this.px(cx) - R));
    const x1 = Math.min(this.w - 1, Math.ceil(this.px(cx) + R));
    const y0 = Math.max(0, Math.floor(this.px(cy) - R));
    const y1 = Math.min(this.h - 1, Math.ceil(this.px(cy) + R));
    for (let y = y0; y <= y1; y += 1) {
      const dy = y - this.px(cy);
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - this.px(cx);
        const d = Math.sqrt(dx * dx + dy * dy) / R;
        if (d >= 1) continue;
        const f = (1 - d) * (1 - d);
        const a = intensity * f;
        // 加色混合（发光不该把背景压暗）
        const i = (y * this.w + x) * 4;
        this.buf[i] = clamp01(this.buf[i] + c[0] * a);
        this.buf[i + 1] = clamp01(this.buf[i + 1] + c[1] * a);
        this.buf[i + 2] = clamp01(this.buf[i + 2] + c[2] * a);
        this.buf[i + 3] = Math.max(this.buf[i + 3], clamp01(a));
      }
    }
  }

  /** 多边形填充。pts 是逻辑坐标数组 [[x,y], ...]；color 可以是函数 (t) => [r,g,b] */
  polygon(pts, colorFn) {
    const P = pts.map((p) => [this.px(p[0]), this.px(p[1])]);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    P.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    const x0 = Math.max(0, Math.floor(minX));
    const x1 = Math.min(this.w - 1, Math.ceil(maxX));
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y += 1) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x += 1) {
        const px = x + 0.5;
        let inside = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i, i += 1) {
          const xi = P[i][0];
          const yi = P[i][1];
          const xj = P[j][0];
          const yj = P[j][1];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (!inside) continue;
        // 用"离中心的相对高度"当渐变参数，主体更有体积感
        const t = clamp01((y - minY) / (maxY - minY || 1));
        const col = colorFn(t, x, y);
        if (col) this.blend(x, y, col[0], col[1], col[2], col[3] === undefined ? 1 : col[3]);
      }
    }
  }

  /** 圆环（逻辑坐标），alpha 可以是函数 (angle01) => 0~1 */
  circleRing(cx, cy, r, width, color, alphaFn) {
    const c = hex(color);
    const R = this.px(r);
    const w = this.px(width);
    const x0 = Math.max(0, Math.floor(this.px(cx) - R - w));
    const x1 = Math.min(this.w - 1, Math.ceil(this.px(cx) + R + w));
    const y0 = Math.max(0, Math.floor(this.px(cy) - R - w));
    const y1 = Math.min(this.h - 1, Math.ceil(this.px(cy) + R + w));
    for (let y = y0; y <= y1; y += 1) {
      const dy = y - this.px(cy);
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - this.px(cx);
        const d = Math.sqrt(dx * dx + dy * dy);
        const edge = R / Math.max(1, w); // 大圆用更窄的相对宽度，避免糊
        const half = w / (edge > 8 ? 3.2 : 2);
        const dd = Math.abs(d - R);
        if (dd > half) continue;
        const a = alphaFn ? alphaFn(Math.atan2(dy, dx)) : 1;
        this.blend(x, y, c[0], c[1], c[2], a);
      }
    }
  }

  /** 斜椭圆环：星轨 */
  ellipseRing(cx, cy, rx, ry, rotDeg, width, colorFn) {
    const rot = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const RX = this.px(rx);
    const RY = this.px(ry);
    const w = this.px(width);
    const mx = Math.max(RX, RY) + w;
    const x0 = Math.max(0, Math.floor(this.px(cx) - mx));
    const x1 = Math.min(this.w - 1, Math.ceil(this.px(cx) + mx));
    const y0 = Math.max(0, Math.floor(this.px(cy) - mx));
    const y1 = Math.min(this.h - 1, Math.ceil(this.px(cy) + mx));
    for (let y = y0; y <= y1; y += 1) {
      const dy = y + 0.5 - this.px(cy);
      for (let x = x0; x <= x1; x += 1) {
        const dx = x + 0.5 - this.px(cx);
        // 转到椭圆本地坐标系
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const nr = Math.sqrt((lx / RX) * (lx / RX) + (ly / RY) * (ly / RY));
        if (nr <= 0.0001) continue;
        const approxDist = Math.abs(nr - 1) * Math.min(RX, RY);
        if (approxDist > w / 2) continue;
        // 角度：用本地角度决定明暗（前段亮、后段暗）
        const ang = Math.atan2(ly / RY, lx / RX);
        const col = colorFn(ang);
        if (!col) continue;
        this.blend(x, y, col[0], col[1], col[2], col[3]);
      }
    }
  }

  /** 四角星（✦ 那种闪光），用在星尘上 */
  sparkle(cx, cy, r, color, alpha, rotDeg) {
    const pts = [];
    const rot = ((rotDeg || 0) * Math.PI) / 180;
    for (let i = 0; i < 8; i += 1) {
      const rr = i % 2 === 0 ? r : r * 0.24;
      const a = rot + (Math.PI / 4) * i - Math.PI / 2;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const c = hex(color);
    this.polygon(pts, () => [c[0], c[1], c[2], alpha]);
  }

  /** n 角星：nLong 个长尖 + (n-nLong) 个短尖 */
  starPolygon(cx, cy, n, longR, shortR, innerR, rotDeg) {
    const pts = [];
    const rot = ((rotDeg || 0) * Math.PI) / 180;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i += 1) {
      const a = rot + step * i - Math.PI / 2;
      pts.push([cx + Math.cos(a) * longR, cy + Math.sin(a) * longR]);
      const am = a + step / 2;
      pts.push([cx + Math.cos(am) * innerR, cy + Math.sin(am) * innerR]);
      void shortR;
    }
    return pts;
  }

  /** 超采样降采样 → RGBA Uint8Array（做一次盒式平均，边缘就平滑了） */
  resolve() {
    const out = new Uint8Array(this.size * this.size * 4);
    const s = this.ss;
    const n = s * s;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < s; sy += 1) {
          for (let sx = 0; sx < s; sx += 1) {
            const i = ((y * s + sy) * this.w + (x * s + sx)) * 4;
            const al = this.buf[i + 3];
            r += this.buf[i] * al;
            g += this.buf[i + 1] * al;
            b += this.buf[i + 2] * al;
            a += al;
          }
        }
        const o = (y * this.size + x) * 4;
        if (a <= 0) {
          out[o] = 0;
          out[o + 1] = 0;
          out[o + 2] = 0;
          out[o + 3] = 0;
        } else {
          out[o] = Math.round(clamp01(r / a) * 255);
          out[o + 1] = Math.round(clamp01(g / a) * 255);
          out[o + 2] = Math.round(clamp01(b / a) * 255);
          out[o + 3] = Math.round(clamp01(a / n) * 255);
        }
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------- 图标本身

const INK = '#0B0A1F';
const GOLD = '#E8C87A';
const GOLD_LIGHT = '#FFE9AE';
const GOLD_DEEP = '#A87A22';
const VIOLET = '#8B6CF0';
const VIOLET_LIGHT = '#C6B4FF';

/**
 * 画一张图标。
 * @param {number} size 输出边长（建议 144）
 * @param {number} ss 超采样倍数（4 足够；8 会更细腻但慢 4 倍）
 */
function makeIcon(size, ss) {
  const S = size / 144; // 一切按 144 设计，其它尺寸等比缩放
  const C = new Canvas(size, ss || 4);
  const cx = 72 * S;
  const cy = 70 * S;

  // ---- 1. 深空底：中心偏上亮一点，四周吃掉光 ----
  C.radial(72 * S, 52 * S, 0, 108 * S, [
    [0, '#1C1C42'],
    [0.42, '#100F28'],
    [0.78, '#09081C'],
    [1, '#040310']
  ]);

  // ---- 2. 星云：左下紫、右上金，给画面一点纵深 ----
  C.glow(34 * S, 116 * S, 74 * S, VIOLET, 0.22);
  C.glow(116 * S, 30 * S, 62 * S, GOLD, 0.12);

  // ---- 3. 八边形：八根轴围出的图谱轮廓（很淡，只做暗示） ----
  {
    const r = 55 * S;
    const pts = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let i = 0; i < 8; i += 1) {
      const p = pts[i];
      const q = pts[(i + 1) % 8];
      // 边：细线，用短线分段画出"虚线"的感觉
      const segs = 5;
      for (let k = 0; k < segs; k += 1) {
        if (k === 3) continue; // 留个缺口当虚线
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const a0 = [lerp(p[0], q[0], t0), lerp(p[1], q[1], t0)];
        const a1 = [lerp(p[0], q[0], t1), lerp(p[1], q[1], t1)];
        const dx = a1[0] - a0[0];
        const dy = a1[1] - a0[1];
        const len = Math.hypot(dx, dy);
        const steps = Math.max(2, Math.ceil(len * ss));
        for (let s2 = 0; s2 <= steps; s2 += 1) {
          const t = s2 / steps;
          const x = (a0[0] + dx * t) * ss;
          const y = (a0[1] + dy * t) * ss;
          const col = hex(VIOLET_LIGHT);
          C.blend(Math.round(x), Math.round(y), col[0], col[1], col[2], 0.26);
          C.blend(Math.round(x) + 1, Math.round(y), col[0], col[1], col[2], 0.16);
        }
      }
    }
    // 顶点小点
    pts.forEach((p) => {
      const col = hex(VIOLET_LIGHT);
      const R = 2.2 * S * ss;
      for (let y = -R; y <= R; y += 1) {
        for (let x = -R; x <= R; x += 1) {
          if (x * x + y * y > R * R) continue;
          C.blend(Math.round(p[0] * ss + x), Math.round(p[1] * ss + y), col[0], col[1], col[2], 0.62);
        }
      }
    });
  }

  // ---- 4. 星轨：倾斜的椭圆环，前段亮后段暗 ----
  C.ellipseRing(cx, cy, 60 * S, 22 * S, -16, 2.3 * S, (ang) => {
    // 下方（靠近观众）亮，上方暗
    const front = Math.max(0, -Math.sin(ang));
    const t = 0.14 + front * 0.86;
    if (front > 0.25) {
      const c = hex(GOLD_LIGHT);
      return [c[0], c[1], c[2], 0.07 + t * 0.42];
    }
    const c = hex(VIOLET);
    return [c[0], c[1], c[2], 0.09 + t * 0.2];
  });

  // ---- 5. 主星：八角（四长四短）= 八轴，带发光 ----
  C.glow(cx, cy, 70 * S, GOLD, 0.46);
  C.glow(cx, cy, 32 * S, GOLD_LIGHT, 0.38);
  {
    const long = 44 * S;
    const short = 27 * S;
    const inner = 7.5 * S;
    const pts = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? long : short;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      const am = a + Math.PI / 8;
      const ri = i % 2 === 0 ? inner * 1.5 : inner;
      pts.push([cx + Math.cos(am) * ri, cy + Math.sin(am) * ri]);
    }
    C.polygon(pts, (t) => {
      const c = ramp(
        [
          [0, '#FFF6D8'],
          [0.38, '#F0D894'],
          [1, '#C79A38']
        ],
        t
      );
      return [c[0], c[1], c[2], 1];
    });
  }
  // 星芯：一点白热，让主体"燃"起来
  C.glow(cx, cy, 9 * S, '#FFFFFF', 0.85);

  // ---- 6. 轨道上的小星：和你共振的那个角色 ----
  {
    const rot = (-16 * Math.PI) / 180;
    const t = 0.22; // 参数角（靠右前方）
    const lx = Math.cos(t * Math.PI * 2) * 60 * S;
    const ly = Math.sin(t * Math.PI * 2) * 22 * S;
    const x = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
    const y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
    C.glow(x, y, 10 * S, GOLD_LIGHT, 0.35);
    const R = 3.0 * S * ss;
    const col = hex('#FFF6D8');
    for (let dy = -R; dy <= R; dy += 1) {
      for (let dx = -R; dx <= R; dx += 1) {
        if (dx * dx + dy * dy > R * R) continue;
        C.blend(Math.round(x * ss + dx), Math.round(y * ss + dy), col[0], col[1], col[2], 1);
      }
    }
  }

  // ---- 7. 星尘：六颗，大小和透明度都错开，避免"撒胡椒面" ----
  [
    [31, 39, 5.2, GOLD_LIGHT, 0.75, 8],
    [110, 63, 4.2, '#FFFFFF', 0.58, -14],
    [52, 113, 4.4, GOLD, 0.66, 20],
    [104, 108, 3.4, VIOLET_LIGHT, 0.6, -6],
    [45, 66, 2.6, '#FFFFFF', 0.5, 0],
    [99, 96, 2.2, GOLD_LIGHT, 0.46, 12]
  ].forEach(([x, y, r, color, a, rot2]) => {
    C.sparkle(x * S, y * S, r * S, color, a, rot2);
  });

  return encodePng(size, size, C.resolve());
}

module.exports = { makeIcon, encodePng, Canvas };

// ---------------------------------------------------------------- CLI

if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : '';
  };
  const outArg = getArg('out');
  const sizeArg = Number(getArg('size')) || 0;
  const root = path.join(__dirname, '..');

  if (outArg) {
    const size = sizeArg || 144;
    fs.writeFileSync(outArg, makeIcon(size));
    const st = fs.statSync(outArg);
    console.log(`已生成 ${outArg} · ${size}x${size} · ${(st.size / 1024).toFixed(1)} KB`);
  } else {
    const dir = path.join(root, 'store');
    fs.mkdirSync(dir, { recursive: true });
    const list = sizeArg ? [sizeArg] : [144, 512];
    list.forEach((s) => {
      const p = path.join(dir, `icon-${s}.png`);
      fs.writeFileSync(p, makeIcon(s));
      console.log(`已生成 ${path.relative(root, p)} · ${s}x${s} · ${(fs.statSync(p).size / 1024).toFixed(1)} KB`);
    });
  }
}
