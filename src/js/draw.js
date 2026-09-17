const { COLOR, font } = require('./theme.js');

/**
 * 绘图原语。所有"好看的形状"都在这里，场景代码里不该出现裸的 path 拼接。
 * 每个函数都做了参数兜底 —— Canvas 里传 NaN 会静默不画，很难排查。
 */

function num(v, def) {
  return typeof v === 'number' && isFinite(v) ? v : def || 0;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(num(r, 0), Math.min(num(w, 0), num(h, 0)) / 2));
  const X = num(x);
  const Y = num(y);
  const W = num(w);
  const H = num(h);
  ctx.beginPath();
  if (rr <= 0) {
    ctx.rect(X, Y, W, H);
    return;
  }
  ctx.moveTo(X + rr, Y);
  ctx.lineTo(X + W - rr, Y);
  ctx.quadraticCurveTo(X + W, Y, X + W, Y + rr);
  ctx.lineTo(X + W, Y + H - rr);
  ctx.quadraticCurveTo(X + W, Y + H, X + W - rr, Y + H);
  ctx.lineTo(X + rr, Y + H);
  ctx.quadraticCurveTo(X, Y + H, X, Y + H - rr);
  ctx.lineTo(X, Y + rr);
  ctx.quadraticCurveTo(X, Y, X + rr, Y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  if (num(w) <= 0 || num(h) <= 0) return;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, lineWidth) {
  if (num(w) <= 0 || num(h) <= 0) return;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = num(lineWidth, 1);
  ctx.stroke();
}

/** 竖向线性渐变填充的圆角矩形 */
function fillRoundRectGradient(ctx, x, y, w, h, r, from, to) {
  if (num(w) <= 0 || num(h) <= 0) return;
  const g = ctx.createLinearGradient(num(x), num(y), num(x), num(y) + num(h));
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
}

/** 描边发光（画两遍，外圈粗而透明） */
function glow(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.5 : alpha;
  ctx.beginPath();
  ctx.arc(num(x), num(y), Math.max(0, num(r)), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** 圆形进度环（共振度用） */
function ring(ctx, cx, cy, radius, progress, opts) {
  const o = opts || {};
  const p = Math.max(0, Math.min(1, num(progress, 0)));
  ctx.save();
  ctx.lineWidth = num(o.lineWidth, 6);
  ctx.lineCap = 'round';
  // 底环
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), num(radius), 0, Math.PI * 2);
  ctx.strokeStyle = o.track || 'rgba(255,255,255,0.10)';
  ctx.stroke();
  // 进度
  if (p > 0) {
    ctx.beginPath();
    ctx.arc(num(cx), num(cy), num(radius), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.strokeStyle = o.color || COLOR.gold;
    ctx.stroke();
  }
  ctx.restore();
}

/** 五角星（稀有度） */
function star(ctx, cx, cy, radius, color, filled) {
  const spikes = 5;
  const inner = radius * 0.45;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? radius : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled === false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

/** 星尘背景（固定随机种子，保证每帧一样，不会闪） */
function starfield(ctx, w, h, t, seed) {
  const count = 70;
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    // 用三角函数的确定性伪随机，避免每帧 Math.random 导致星星跳动
    const a = Math.sin(i * 12.9898 + (seed || 0)) * 43758.5453;
    const b = Math.sin(i * 78.233 + (seed || 0)) * 12345.6789;
    const fx = a - Math.floor(a);
    const fy = b - Math.floor(b);
    const x = fx * w;
    const y = fy * h;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 1400 + i));
    const r = i % 7 === 0 ? 2.4 : 1.4;
    ctx.globalAlpha = tw * 0.75;
    ctx.fillStyle = i % 11 === 0 ? COLOR.cyan : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 缓慢转动的十二宫刻度环 */
function zodiacRing(ctx, cx, cy, radius, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t / 24000);
  ctx.strokeStyle = 'rgba(232,200,122,0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI / 6) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.lineTo(Math.cos(a) * (radius + 18), Math.sin(a) * (radius + 18));
    ctx.stroke();
  }
  ctx.restore();
}

/** 径向光晕（占卜仪式的核心视觉，后面可以换成美术图的 drawImage） */
function radialGlow(ctx, cx, cy, radius, color, alpha) {
  const g = ctx.createRadialGradient(num(cx), num(cy), 0, num(cx), num(cy), Math.max(1, num(radius)));
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), Math.max(1, num(radius)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 图片按 cover 方式填满目标矩形（立绘用） */
function drawImageCover(ctx, img, x, y, w, h) {
  if (!img) return false;
  const iw = img.width || (img._w || 0);
  const ih = img.height || (img._h || 0);
  if (!iw || !ih) return false;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  return true;
}

/** 带发光的分隔线 */
function hairline(ctx, x1, y, x2, color) {
  const g = ctx.createLinearGradient(x1, y, x2, y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, color || 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x1, y, x2 - x1, 1);
}

/**
 * HSL → rgba 字符串。
 *
 * ⚠️ **微信小游戏的 Canvas 不接受 `hsl()` / `hsla()` 颜色。**
 * 在 `addColorStop` 里用它会直接抛 `addColorStop with invalid params`
 * （真机日志实测：基础库 3.17.2）。而开发者工具的 canvas 是浏览器的、支持 hsl ——
 * 于是就成了"工具里一切正常、真机某一帧抛异常"，而帧循环一断画面就停在那一帧
 * （表现就是"打开只剩背景，点哪都没反应"）。这个坑真踩过，别再写 hsl。
 */
function hslToRgba(h, s, l, a) {
  const hh = ((((num(h) % 360) + 360) % 360) / 360);
  const ss = Math.max(0, Math.min(100, num(s))) / 100;
  const ll = Math.max(0, Math.min(100, num(l))) / 100;
  const alpha = a === undefined ? 1 : Math.max(0, Math.min(1, num(a)));

  if (ss === 0) {
    const v = Math.round(ll * 255);
    return `rgba(${v}, ${v}, ${v}, ${alpha})`;
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const r = Math.round(channel(hh + 1 / 3) * 255);
  const g = Math.round(channel(hh) * 255);
  const b = Math.round(channel(hh - 1 / 3) * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 星徽：不需要任何美术资源，也能让每个角色有辨识度。
 *
 * 产品决策：角色卡不依赖立绘（引用作品的角色，用官方立绘有版权风险，
 * 自己画又有成本）。所以用"按角色 id 稳定生成的几何纹样 + 名字首字"来做视觉标识 ——
 * 同一个角色每次渲染都是同一个徽记，不同角色之间有区分度，而且零资源。
 *
 * @param {number} cx,cy 圆心
 * @param {number} radius 半径
 * @param {number} seed   角色 id 派生的整数（决定瓣数、纹样）
 * @param {string} ring   稀有度主色
 */
function emblem(ctx, cx, cy, radius, seed, ring, muted) {
  const R = Math.max(8, num(radius));
  const h = ((seed % 360) + 360) % 360;
  const petals = 3 + (seed % 6); // 3~8 边，按角色稳定
  const sat = muted ? 0 : 52; // 未解锁时去色，做成剪影

  ctx.save();
  // 底：径向渐变
  const g = ctx.createRadialGradient(num(cx), num(cy) - R * 0.3, R * 0.1, num(cx), num(cy), R);
  g.addColorStop(0, hslToRgba(h, sat, muted ? 16 : 42, 0.95));
  g.addColorStop(0.65, hslToRgba((h + 30) % 360, sat, muted ? 10 : 24, 0.9));
  g.addColorStop(1, 'rgba(11,10,31,0.95)');
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // 星芒：12 条，长短交替
  ctx.save();
  ctx.translate(num(cx), num(cy));
  ctx.rotate((seed % 12) * (Math.PI / 6));
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI / 6) * i;
    const len = i % 3 === 0 ? R * 0.86 : R * 0.62;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.strokeStyle = i % 3 === 0 ? ring : muted ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = i % 3 === 0 ? 1.6 : 1;
    ctx.stroke();
  }
  // 同心多边形
  for (let ring2 = 0; ring2 < 2; ring2 += 1) {
    const rr = R * (ring2 === 0 ? 0.88 : 0.66);
    ctx.beginPath();
    for (let i = 0; i <= petals; i += 1) {
      const a = (Math.PI * 2 * i) / petals - Math.PI / 2;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = ring2 === 0 ? 'rgba(232,200,122,0.5)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();

  // 中心光晕，给首字做底
  const cg = ctx.createRadialGradient(num(cx), num(cy), 0, num(cx), num(cy), R * 0.5);
  cg.addColorStop(0, 'rgba(11,10,31,0.85)');
  cg.addColorStop(1, 'rgba(11,10,31,0)');
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.restore();
}

/**
 * 圆形头像。
 *
 * 头像是用户自己选的（微信给的临时路径 / CDN 链接），尺寸和比例都不可控，
 * 所以按 cover 裁进圆形；没图、或图还在加载，就返回 false 让调用方画自己的徽记兜底。
 *
 * @returns {boolean} 是否真的画了头像
 */
function avatar(ctx, img, cx, cy, radius) {
  const R = Math.max(4, num(radius));
  if (!img) return false;
  const iw = img.width || img._w || 0;
  const ih = img.height || img._h || 0;
  if (!iw || !ih) return false;

  ctx.save();
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
  ctx.clip();
  drawImageCover(ctx, img, num(cx) - R, num(cy) - R, R * 2, R * 2);
  ctx.restore();

  // 细金边：让头像和深色底分开，不然深色头像会糊在背景里
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(232,200,122,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return true;
}

/**
 * 主按钮的金色渐变（linear-gradient(180deg, #F0D695, #D9B45F)）。
 * 之前的对角渐变在长按钮上会显得"一边亮一边暗"，竖直渐变才是正常的金属感。
 */
function goldGrad(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(num(x), num(y), num(x), num(y) + num(h));
  g.addColorStop(0, COLOR.goldTop || '#F0D695');
  g.addColorStop(1, COLOR.goldBottom || '#D9B45F');
  return g;
}

/** 顶部 1px 高光：金属按钮"不塌"的关键，少这一笔就成一块死平的黄 */
function topHighlight(ctx, x, y, w, r, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 0.55 : alpha;
  ctx.beginPath();
  ctx.moveTo(num(x) + num(r) * 0.7, num(y) + 1.5);
  ctx.lineTo(num(x) + num(w) - num(r) * 0.7, num(y) + 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * 星级：实心金 + 空心灰并排。
 * 返回整行的宽度，方便调用方右对齐（自己算宽度容易差一颗星的位置）。
 */
function starsRow(ctx, x, y, size, filled, total, gap) {
  const n = Math.max(0, Math.round(total === undefined ? 5 : total));
  const f = Math.max(0, Math.min(n, Math.round(filled || 0)));
  const g = gap === undefined ? size * 1.15 : gap;
  for (let i = 0; i < n; i += 1) {
    star(ctx, num(x) + i * g, num(y), size, i < f ? COLOR.gold : 'rgba(255,255,255,0.20)', i < f);
  }
  return n > 0 ? (n - 1) * g + size * 2 : 0;
}

/** 星形四角光点（✦）。未遇见的角色占位、解锁面板顶端都用它 */
function sparkle(ctx, cx, cy, r, color, alpha) {
  const R = Math.max(1, num(r));
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color || COLOR.gold;
  ctx.beginPath();
  // 四个尖 + 内收的腰，比五角星更"光点"
  for (let i = 0; i < 8; i += 1) {
    const rad = i % 2 === 0 ? R : R * 0.24;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const px = num(cx) + Math.cos(a) * rad;
    const py = num(cy) + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 圆形印章（「吉」那种）。
 * 双圈 + 正中一个字，比一行"★★★★☆ 顺畅"有玄学味得多。
 */
function seal(ctx, cx, cy, r, label, color, alpha) {
  const R = Math.max(6, num(r));
  const c = color || COLOR.gold;
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = c;
  ctx.lineWidth = Math.max(1, R * 0.075);
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(0.8, R * 0.045);
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha /= 0.55;
  if (label) {
    const s = String(label);
    // 两个字（"大吉"/"小吉"/"末吉"）要收一档字号，否则会顶出印章
    const size = s.length >= 2 ? R * 0.62 : R * 0.82;
    ctx.font = font(size, '700');
    ctx.fillStyle = c;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, num(cx), num(cy) + R * 0.04);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/**
 * 引号装饰（金色「“」）。
 *
 * 刻意**画成图形而不是写字**：一是引号在小游戏 Canvas 上字形不稳，
 * 二是文字会被布局审计当成一段真文字去比对重叠——装饰不该参与排版。
 */
function quoteMark(ctx, x, y, size, color, alpha) {
  const S = Math.max(8, num(size));
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 0.3 : alpha;
  ctx.strokeStyle = color || COLOR.gold;
  ctx.lineWidth = S * 0.30;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i += 1) {
    const cx = num(x) + S * 0.46 + i * S * 0.98;
    const cy = num(y) + S * 0.52;
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.28, Math.PI * 0.72, Math.PI * 2.06);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 星座连线装饰：几个定点用细线连起来，再在顶点上点小星。
 * 确定性伪随机 —— 同一个 seed 每次都是同一张图，不会每帧闪。
 */
function constellation(ctx, x, y, w, h, seed, alpha, count) {
  const n = Math.max(3, count || 5);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = Math.sin((i + 1) * 12.9898 + (seed || 0) * 3.7) * 43758.5453;
    const b = Math.sin((i + 1) * 78.233 + (seed || 0) * 1.3) * 12345.6789;
    pts.push({
      x: num(x) + (a - Math.floor(a)) * num(w),
      y: num(y) + (b - Math.floor(b)) * num(h)
    });
  }
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 0.10 : alpha;
  ctx.strokeStyle = COLOR.gold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  // 收尾连回起点附近的点，让连线闭合一点，像真的星座
  if (pts.length > 3) ctx.lineTo(pts[1].x, pts[1].y);
  ctx.stroke();
  pts.forEach((p, i) => {
    ctx.fillStyle = i % 3 === 0 ? COLOR.cyan : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, i % 3 === 0 ? 1.8 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * 流星。每颗流星有自己的周期（默认 9~16 秒一颗），
 * 只在周期前 1/5 的时间可见 —— 大部分时候天上什么都没有才是对的。
 */
function meteor(ctx, w, h, t, seed) {
  const s = seed || 0;
  const period = 11000 + (s % 5) * 1400;
  const phase = ((num(t) + s * 3700) % period) / period;
  if (phase > 0.20) return;
  const p = phase / 0.20; // 0~1 划过过程
  const fromX = num(w) * (0.12 + ((s * 37) % 60) / 100);
  const fromY = num(h) * (0.04 + ((s * 17) % 28) / 100);
  const len = num(w) * 0.34;
  const x = fromX + len * p * 1.4;
  const y = fromY + len * p * 0.62;
  const fade = Math.sin(p * Math.PI); // 头尾淡入淡出
  ctx.save();
  ctx.globalAlpha *= 0.75 * fade;
  const g = ctx.createLinearGradient(x, y, x - len * 0.5, y - len * 0.22);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(232,200,122,0.55)');
  g.addColorStop(1, 'rgba(232,200,122,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * 0.5, y - len * 0.22);
  ctx.stroke();
  ctx.restore();
}

/** 统一的右箭头。以前每个控件各画一遍，粗细角度都不一样 */
function chevron(ctx, x, y, size, color) {
  const S = Math.max(4, num(size));
  ctx.save();
  ctx.strokeStyle = color || 'rgba(255,255,255,0.30)';
  ctx.lineWidth = Math.max(1.5, S * 0.18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(num(x), num(y) - S * 0.6);
  ctx.lineTo(num(x) + S * 0.6, num(y));
  ctx.lineTo(num(x), num(y) + S * 0.6);
  ctx.stroke();
  ctx.restore();
}

/** 虚线圆角框（"+ 新建资料卡"那种"添加"暗示） */
function dashedRoundRect(ctx, x, y, w, h, r, color, dash, gap) {
  if (num(w) <= 0 || num(h) <= 0) return;
  ctx.save();
  if (ctx.setLineDash) ctx.setLineDash([num(dash, 10), num(gap, 8)]);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color || 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (ctx.setLineDash) ctx.setLineDash([]);
  ctx.restore();
}

/**
 * 选项字母徽章（A / B / C）。
 * 选中态是"金底黑字"，未选中是"描边 + 灰字" —— 对比度一下子拉开了。
 */
function letterBadge(ctx, cx, cy, r, letter, on, color) {
  const R = Math.max(6, num(r));
  const c = color || COLOR.gold;
  ctx.save();
  if (on) {
    drawFillCircle(ctx, cx, cy, R, c);
    ctx.fillStyle = '#2A1E05';
  } else {
    ctx.beginPath();
    ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COLOR.ink3;
  }
  ctx.font = font(R * 1.02, '700');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(letter || ''), num(cx), num(cy) + 1);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawFillCircle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), num(r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * 未解锁的占位：一个虚线圆 + 中间的 ✦。
 * 以前这里画的是问号 —— 那个符号读起来像"你答错了"，
 * 而收集类页面的空位应该是"还等着你去遇见"。
 */
function starPlaceholder(ctx, cx, cy, r, color) {
  const R = Math.max(6, num(r));
  const c = color || 'rgba(255,255,255,0.30)';
  ctx.save();
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  if (ctx.setLineDash) ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
  ctx.stroke();
  if (ctx.setLineDash) ctx.setLineDash([]);
  sparkle(ctx, cx, cy, R * 0.52, c, 1);
  ctx.restore();
}

/** 六边形（加载态、头像框）：可旋转，可只描边 */
function hexRing(ctx, cx, cy, r, rot, color, lineWidth) {
  const R = Math.max(4, num(r));
  ctx.save();
  ctx.strokeStyle = color || COLOR.gold;
  ctx.lineWidth = num(lineWidth, 2);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 6; i += 1) {
    const a = (Math.PI / 3) * i + num(rot);
    const px = num(cx) + Math.cos(a) * R;
    const py = num(cy) + Math.sin(a) * R;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** 头像的金色渐变描边环（用户头像、资料卡头像统一用它） */
function avatarRing(ctx, cx, cy, r, t, alpha) {
  const R = Math.max(4, num(r));
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
  const g = ctx.createLinearGradient(num(cx) - R, num(cy) - R, num(cx) + R, num(cy) + R);
  g.addColorStop(0, COLOR.gold);
  g.addColorStop(0.45, 'rgba(232,200,122,0.45)');
  g.addColorStop(1, COLOR.goldLight);
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, 0, Math.PI * 2);
  ctx.stroke();
  // 顶上再加一小段高光，环就"活"了
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  const a0 = -Math.PI * 0.86 + Math.sin(num(t) / 2600) * 0.4;
  ctx.beginPath();
  ctx.arc(num(cx), num(cy), R, a0, a0 + 0.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * 稀有度描边光效：一道本色细边 + 一圈外扩渐隐光晕。
 * 收集类页面的核心爽点就是"一眼看出哪张卡稀有"。
 */
function rarityEdge(ctx, x, y, w, h, r, color, strength) {
  const a = strength === undefined ? 1 : strength;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 顶部再补一层内发光，让边框有厚度
  const g = ctx.createLinearGradient(0, num(y), 0, num(y) + num(h) * 0.5);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha *= 0.16;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/**
 * 带流光的进度条。
 * `flow` 是一道从左到右循环的高光 —— 结果页那条"81%"用它撑场面。
 */
function flowBar(ctx, x, y, w, h, value, t, opts) {
  const o = opts || {};
  const H = num(h, 8);
  const W = num(w);
  const p = Math.max(0, Math.min(1, num(value)));
  fillRoundRect(ctx, x, y, W, H, H / 2, o.track || 'rgba(255,255,255,0.08)');
  const fw = Math.max(0, W * p);
  if (fw < 1) return;
  const g = ctx.createLinearGradient(num(x), 0, num(x) + W, 0);
  g.addColorStop(0, o.from || COLOR.violet);
  g.addColorStop(1, o.to || COLOR.gold);
  fillRoundRect(ctx, x, y, fw, H, H / 2, g);
  if (o.flow !== false) {
    // 流光只在前 62% 的行程里跑，跑完有一段"休息"，比一直在跑自然
    const cycle = (num(t) / 2200) % 1.6;
    if (cycle < 1) {
      const fx = num(x) + fw * cycle;
      const g2 = ctx.createLinearGradient(fx - 60, 0, fx + 30, 0);
      g2.addColorStop(0, 'rgba(255,255,255,0)');
      g2.addColorStop(0.7, 'rgba(255,255,255,0.55)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, x, y, fw, H, H / 2);
      ctx.clip();
      ctx.fillStyle = g2;
      ctx.fillRect(fx - 60, num(y), 90, H);
      ctx.restore();
    }
  }
}

module.exports = {
  emblem,
  avatar,
  roundRectPath,
  fillRoundRect,
  strokeRoundRect,
  fillRoundRectGradient,
  glow,
  ring,
  star,
  starfield,
  zodiacRing,
  radialGlow,
  hslToRgba,
  drawImageCover,
  hairline,
  // ---- 美化轮新增 ----
  goldGrad,
  topHighlight,
  starsRow,
  sparkle,
  starPlaceholder,
  seal,
  quoteMark,
  constellation,
  meteor,
  chevron,
  dashedRoundRect,
  letterBadge,
  drawFillCircle,
  hexRing,
  avatarRing,
  rarityEdge,
  flowBar
};
