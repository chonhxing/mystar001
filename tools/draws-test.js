/**
 * 新绘图原语的冒烟测试：用一个"什么都不做但会记录"的 ctx 把每个函数都跑一遍。
 *
 * 为什么要单独测：Canvas 里传 NaN / undefined 会**静默不画**，
 * 表现是"某个装饰不见了"，没有任何报错。这里断言每个函数都真的产生了绘制指令，
 * 并且没有把 NaN 传进 ctx（mock 会抛）。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

const draw = require(path.join(ROOT, 'src/js/draw.js'));
const icon = require(path.join(ROOT, 'src/js/ui/icon.js'));
const theme = require(path.join(ROOT, 'src/js/theme.js'));

let fails = 0;
let count = 0;
function ok(cond, label) {
  count += 1;
  if (!cond) {
    fails += 1;
    console.log(`  ✗ ${label}`);
  }
}

/** 严格 mock：任何 NaN/undefined 数字进 ctx 都抛（真机是静默不画，更难查） */
function makeCtx() {
  const ops = [];
  let depth = 0;
  const chk = (name, args) => {
    ops.push({ name, args: args.slice() });
    args.forEach((a) => {
      if (typeof a === 'number' && !isFinite(a)) {
        throw new Error(`${name} 收到非有限数字: ${args.join(',')}`);
      }
    });
  };
  const ctx = {
    _ops: ops,
    /** save/restore 配平检查用 */
    get _depth() { return depth; },
    canvas: { width: 750, height: 1624 },
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '#000',
    fillStyle: '#000',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '#000',
    shadowBlur: 0,
    save() { ops.push({ name: 'save' }); depth += 1; },
    restore() { ops.push({ name: 'restore' }); depth -= 1; },
    translate() { chk('translate', Array.from(arguments)); },
    rotate() { chk('rotate', Array.from(arguments)); },
    scale() { chk('scale', Array.from(arguments)); },
    beginPath() { ops.push({ name: 'beginPath' }); },
    closePath() { ops.push({ name: 'closePath' }); },
    moveTo() { chk('moveTo', Array.from(arguments)); },
    lineTo() { chk('lineTo', Array.from(arguments)); },
    rect() { chk('rect', Array.from(arguments)); },
    arc() { chk('arc', Array.from(arguments)); },
    quadraticCurveTo() { chk('quadraticCurveTo', Array.from(arguments)); },
    fill() { ops.push({ name: 'fill' }); },
    stroke() { ops.push({ name: 'stroke' }); },
    clip() { ops.push({ name: 'clip' }); },
    fillRect() { chk('fillRect', Array.from(arguments)); },
    fillText(t, x, y) { chk('fillText', [x, y]); ops.push({ name: 'fillText', text: String(t) }); },
    measureText(s) { return { width: String(s).length * 10 }; },
    createLinearGradient() {
      chk('createLinearGradient', Array.from(arguments));
      return { addColorStop(p, c) { chk('addColorStop', [p]); if (typeof c !== 'string' || !c) throw new Error('坏色值: ' + c); } };
    },
    createRadialGradient() {
      chk('createRadialGradient', Array.from(arguments));
      return { addColorStop(p, c) { chk('addColorStop', [p]); if (typeof c !== 'string' || !c) throw new Error('坏色值: ' + c); } };
    },
    setLineDash(arr) { chk('setLineDash', arr || []); },
    clearRect() {}, drawImage() {}
  };
  return ctx;
}

console.log('\n=== 绘图原语冒烟 ===');
{
  const ctx = makeCtx();
  const cases = [
    ['goldGrad', () => draw.goldGrad(ctx, 0, 0, 200, 96)],
    ['topHighlight', () => draw.topHighlight(ctx, 0, 0, 200, 48)],
    ['starsRow', () => draw.starsRow(ctx, 10, 20, 10, 4, 5)],
    ['star 空心', () => draw.star(ctx, 10, 20, 10, '#fff', false)],
    ['sparkle', () => draw.sparkle(ctx, 10, 20, 12, theme.COLOR.gold)],
    ['seal', () => draw.seal(ctx, 50, 50, 24, '吉')],
    ['quoteMark', () => draw.quoteMark(ctx, 0, 0, 40)],
    ['constellation', () => draw.constellation(ctx, 0, 0, 300, 200, 7, 0.1)],
    ['meteor(可见段)', () => draw.meteor(ctx, 750, 1624, 1000, 0)],
    // 不可见段**故意**什么都不画 —— 流星是"偶尔才有"的装饰
    ['meteor(不可见段)', () => draw.meteor(ctx, 750, 1624, 5000, 0), false],
    ['chevron', () => draw.chevron(ctx, 10, 10, 12)],
    ['dashedRoundRect', () => draw.dashedRoundRect(ctx, 0, 0, 200, 80, 20, null, 10, 8)],
    ['letterBadge 选中', () => draw.letterBadge(ctx, 30, 30, 18, 'A', true)],
    ['letterBadge 未选', () => draw.letterBadge(ctx, 30, 30, 18, 'B', false)],
    ['hexRing', () => draw.hexRing(ctx, 50, 50, 30, 0.4)],
    ['avatarRing', () => draw.avatarRing(ctx, 50, 50, 40, 1200)],
    ['rarityEdge', () => draw.rarityEdge(ctx, 0, 0, 200, 100, 32, theme.COLOR.gold)],
    ['flowBar', () => draw.flowBar(ctx, 0, 0, 300, 8, 0.81, 1500)],
    ['flowBar 0%', () => draw.flowBar(ctx, 0, 0, 300, 8, 0, 1500)],
    ['flowBar 100%', () => draw.flowBar(ctx, 0, 0, 300, 8, 1, 4000)],
    ['emblem', () => draw.emblem(ctx, 50, 50, 40, 12345, theme.COLOR.gold)],
    ['emblem 去色', () => draw.emblem(ctx, 50, 50, 40, 12345, theme.COLOR.gold, true)]
  ];
  cases.forEach(([name, fn, expectDrawn]) => {
    const before = ctx._ops.length;
    let threw = '';
    try {
      fn();
    } catch (e) {
      threw = e.message;
    }
    const drew = ctx._ops.length - before;
    ok(!threw, `${name} 不应抛异常（${threw}）`);
    if (!threw && expectDrawn !== false) ok(drew > 0, `${name} 应该产生绘制指令（实际 ${drew} 条）`);
    if (!threw && expectDrawn === false) ok(drew === 0, `${name} 应该什么都不画（实际 ${drew} 条）`);
    // save/restore 必须配平：不配平会污染后续所有绘制（真机上表现为"越画越透明/越画越偏"）
    ok(ctx._depth === 0, `${name} 的 save/restore 要配平（当前 ${ctx._depth}）`);
  });
}

console.log('\n=== 流星节奏 ===');
{
  // 流星是"偶尔才有"的装饰：一个周期里应该只有一小段时间在画，
  // 全程都在画就成了雨（用户明确要的是"每 8~15 秒一颗"）。
  const ctx = makeCtx();
  let visible = 0;
  const N = 240;
  for (let i = 0; i < N; i += 1) {
    const before = ctx._ops.length;
    draw.meteor(ctx, 750, 1624, (i / N) * 20000, 0);
    if (ctx._ops.length > before) visible += 1;
  }
  const ratio = visible / N;
  ok(ratio > 0.02 && ratio < 0.35, `20 秒内流星可见时间占比 ${(ratio * 100).toFixed(1)}%（应在 2%~35%）`);
}

console.log('\n=== 图标集 ===');
{
  const ctx = makeCtx();
  const all = icon.names();
  ok(all.length >= 16, `图标数量 ${all.length}（至少 16 个）`);
  const sizes = [16, 20, 40, 80];
  all.forEach((n) => {
    sizes.forEach((s) => {
      const before = ctx._ops.length;
      let threw = '';
      try {
        draw.goldGrad(ctx, 0, 0, 10, 10);
        icon.drawIcon(ctx, n, 100, 100, s, theme.COLOR.ink, 0.6);
      } catch (e) {
        threw = e.message;
      }
      ok(!threw && ctx._ops.length > before, `图标 ${n} @${s}px 应正常绘制（${threw}）`);
    });
  });
  ok(icon.drawIcon(ctx, 'not-a-real-icon', 0, 0, 20) === false, '未知图标名返回 false（不抛）');
  ok(icon.has('book') && !icon.has('bogus'), 'icon.has() 判定正确');
}

console.log('\n=== 结果海报 ===');
{
  const poster = require(path.join(ROOT, 'src/js/poster.js'));
  const ctx = makeCtx();
  const before = ctx._ops.length;
  let threw = '';
  try {
    poster.paint(ctx, {
      char: { id: 'levi', name: '利威尔', work: '进击的巨人', medium: '动画' },
      rarityKey: 'legend',
      stars: 5,
      resonance: 26,
      axisName: '秩序',
      seed: 12345
    });
  } catch (e) {
    threw = e.message;
  }
  ok(!threw, `paint 不应抛异常（${threw}）`);
  ok(ctx._ops.length > before, '海报画出了东西');
  ok(ctx._depth === 0, `海报的 save/restore 要配平（当前 ${ctx._depth}）`);

  // ⚠️ mock 的 chk() 也会记一条同名 op（只有坐标没有文字），这里只取真文本
  const texts = ctx._ops.filter((o) => o.name === 'fillText' && typeof o.text === 'string').map((o) => o.text);
  const joined = texts.join('|');
  ok(joined.indexOf('利威尔') >= 0, '海报上有角色名');
  ok(joined.indexOf('26%') >= 0, '海报上有共振度');
  ok(joined.indexOf('仅供娱乐') >= 0, '海报上有"仅供娱乐"（合规）');
  ok(joined.indexOf('进击的巨人') >= 0, '海报上有作品名');
  // 合规红线：海报上不能出现 AI 生成的那段解读文案，否则就得在图片上带 AI 标识
  ok(joined.indexOf('人工智能') < 0 && joined.indexOf('AI') < 0, '海报上没有 AI 相关字样');

  // 三种 rarity 都要能画（缺 map 会静默不画）
  ['legend', 'epic', 'rare', 'common'].forEach((k) => {
    const c2 = makeCtx();
    let t2 = '';
    try {
      poster.paint(c2, { char: { id: 'x', name: '测试', work: 'w', medium: 'm' }, rarityKey: k, stars: 3, resonance: 88, axisName: '共鸣', seed: 7 });
    } catch (e) {
      t2 = e.message;
    }
    ok(!t2 && c2._depth === 0, `稀有度 ${k} 的海报能正常画（${t2}）`);
  });

  // 极端值：0% 和 100% 都不能把进度条画成负宽/溢出
  [0, 100].forEach((v) => {
    const c3 = makeCtx();
    let t3 = '';
    try {
      poster.paint(c3, { char: { id: 'y', name: '甲', work: 'w', medium: 'm' }, rarityKey: 'epic', stars: 4, resonance: v, axisName: '轴', seed: 1 });
    } catch (e) {
      t3 = e.message;
    }
    ok(!t3, `共振 ${v}% 能画（${t3}）`);
  });

  // 没数据时不能抛（容错），也不能画出 undefined
  const c4 = makeCtx();
  let t4 = '';
  try {
    poster.paint(c4, {});
  } catch (e) {
    t4 = e.message;
  }
  ok(!t4, `空数据也能画（${t4}）`);
  const dirty = c4._ops.filter((o) => o.name === 'fillText' && typeof o.text === 'string').map((o) => o.text).filter((s) => /undefined|NaN|{w+}/.test(s));
  ok(dirty.length === 0, `空数据不产生脏文案（${dirty.join(',')}）`);

  // 环境不支持时要**明确报原因**，不能静默失败
  ok(typeof poster.saveResult === 'function', 'saveResult 存在');
  ok(poster.W === 750 && poster.H === 1000, `海报尺寸 750×1000（实际 ${poster.W}×${poster.H}）`);
}

console.log('\n=== 主题令牌 ===');
{
  ok(theme.pad2(2) === '02', `pad2(2) = ${theme.pad2(2)}`);
  ok(theme.pad2(10) === '10', `pad2(10) = ${theme.pad2(10)}`);
  ok(theme.pad2(0) === '00', `pad2(0) = ${theme.pad2(0)}`);
  ok(theme.pad2(undefined) === '00', 'pad2(undefined) 不返回 NaN');
  const e = theme.EASE;
  ok(Math.abs(e.outCubic(0) - 0) < 1e-6 && Math.abs(e.outCubic(1) - 1) < 1e-6, 'outCubic 端点正确');
  ok(Math.abs(e.outBack(1) - 1) < 1e-6, 'outBack(1) = 1');
  ok(e.outBack(0.5) > 1, 'outBack 中段会过冲（回弹手感）');
  ok(Math.abs(e.breathe(0) - 0) < 1e-6 && Math.abs(e.breathe(0.5) - 1) < 1e-6, 'breathe 0→1→0');
  ok(theme.CARD.radius === 32 && theme.CARD.pad === 32 && theme.CARD.gap === 24, '卡片统一规格 32/32/24');
  ok(theme.RADIUS.card === 32, 'RADIUS.card = 32');
  ok(theme.TXT.body === theme.COLOR.ink, 'TXT.body 指向主文字色');
  ok(String(theme.COLOR.panel).indexOf('0.04') >= 0, '卡片底色 4%');
  // 四档文字必须真的拉开：正文那档不能和辅助那档一样暗
  const lum = (hex) => {
    const m = /^#(\w\w)(\w\w)(\w\w)$/.exec(hex);
    return m ? (parseInt(m[1], 16) + parseInt(m[2], 16) + parseInt(m[3], 16)) / 3 : 0;
  };
  const l = [theme.COLOR.ink, theme.COLOR.ink2, theme.COLOR.ink3, theme.COLOR.ink4].map(lum);
  ok(l[0] > l[1] && l[1] > l[2] && l[2] > l[3], `文字四档亮度递减：${l.map((v) => Math.round(v)).join(' > ')}`);
  ok(l[2] / l[1] > 0.55, `辅助档不能比正文暗太多（${Math.round(l[2])} vs ${Math.round(l[1])}）`);
  // 字号必须是整数（真机会静默忽略小数号）
  const bad = Object.keys(theme.FONT).filter((k) => !Number.isInteger(theme.FONT[k]));
  ok(bad.length === 0, `FONT 全部为整数（问题项：${bad.join(',')}）`);
}

console.log(`\n${fails === 0 ? '✅' : '❌'} 原语冒烟：${count - fails} / ${count} 通过`);
process.exit(fails ? 1 : 0);
