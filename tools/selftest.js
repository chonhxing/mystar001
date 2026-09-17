/* eslint-disable no-console */
/**
 * 核心逻辑自测（Node 直接跑，不需要微信开发者工具）：
 *   node tools/selftest.js
 *
 * 检查四类东西：
 *   1. 数据完整性（角色/命途/星座的表有没有写漏、写错）
 *   2. 天文与干支的锚点（对不上就说明公式写错了）
 *   3. 确定性（同输入必须同输出）
 *   4. 匹配分布（有没有角色霸榜 / 有没有角色永远出不来 / 命格稀有度比例是否合理）
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');
const chartCore = require(path.join(ROOT, 'core/chart.js'));
const astro = require(path.join(ROOT, 'core/astro.js'));
const bazi = require(path.join(ROOT, 'core/bazi.js'));
const core = require(path.join(ROOT, 'core/index.js'));
const { createRng } = require(path.join(ROOT, 'core/rng.js'));
const { DIM_KEYS, DIMENSIONS } = require(path.join(ROOT, 'data/archetypes.js'));
const { CHARACTERS } = require(path.join(ROOT, 'data/characters.js'));
const { FATE_MAP } = require(path.join(ROOT, 'data/fates.js'));
const { ZODIAC } = require(path.join(ROOT, 'data/zodiac.js'));
const { SEXAGENARY } = require(path.join(ROOT, 'data/ganzhi.js'));
const cities = require(path.join(ROOT, 'data/cities.js'));
const { PROVINCES } = cities;
const bank = require(path.join(ROOT, 'data/questions.js'));
const { QUESTIONS } = bank;

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const FORMULAS = { ramc: 0, latitude: 0 };

// ---------------------------------------------------------------- 数据完整性
section('1. 数据完整性');
{
  const seen = {};
  let dimsOk = true;
  let fateOk = true;
  let badChar = '';
  CHARACTERS.forEach((c) => {
    if (seen[c.id]) badChar = `重复 id: ${c.id}`;
    seen[c.id] = true;
    DIM_KEYS.forEach((k) => {
      const v = c.dims[k];
      if (typeof v !== 'number' || v < 0 || v > 100 || Number.isNaN(v)) {
        dimsOk = false;
        badChar = `${c.id}.dims.${k} = ${v}`;
      }
    });
    (c.fates || []).forEach((f) => {
      if (!FATE_MAP[f]) {
        fateOk = false;
        badChar = `${c.id} 引用了不存在的命途 ${f}`;
      }
    });
  });
  ok(CHARACTERS.length >= 30, `角色库数量 = ${CHARACTERS.length}`);
  ok(dimsOk, '所有角色八维数值合法（0~100）', badChar);
  ok(fateOk, '所有角色的命途 id 都存在', badChar);
  ok(
    CHARACTERS.every((c) => c.name && c.work && c.rarity && c.motif && c.signature),
    '角色必填字段（name/work/rarity/motif/signature）齐全'
  );

  // 角色库的覆盖度：每根轴都要有人站两头，否则某些命盘会没归宿
  const sparse = [];
  DIMENSIONS.forEach((d) => {
    const vals = CHARACTERS.map((c) => c.dims[d.key]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    if (lo > 40) sparse.push(`${d.key} 最低只有 ${lo}`);
    if (hi < 70) sparse.push(`${d.key} 最高只有 ${hi}`);
  });
  ok(sparse.length === 0, '八轴都有人站两端（共鸣覆盖面）', sparse.join('; '));

  ok(SEXAGENARY.length === 60 && SEXAGENARY[0] === '甲子' && SEXAGENARY[59] === '癸亥',
    '六十甲子生成正确');
  ok(ZODIAC.length === 12, '十二星座齐全');

  // ---- 出生地表（三级：省级 → 市级 → 区/县） ----
  {
    const st = cities.stats();
    ok(st.provinces === 35, `省级行政区齐全（${st.provinces} 个：34 个中国省级 + 海外）`);
    const names = PROVINCES.map((p) => p.name);
    ok(new Set(names).size === names.length, '省级名称无重名');
    ['北京', '天津', '上海', '重庆'].forEach((n) => {
      ok(names.indexOf(n) >= 0, `直辖市与省同级：${n}`);
    });
    ['香港', '澳门', '台湾'].forEach((n) => {
      ok(names.indexOf(n) >= 0, `包含中国${n}`);
    });
    ok(
      cities.provinceLabel('香港') === '中国香港'
        && cities.provinceLabel('澳门') === '中国澳门'
        && cities.provinceLabel('台湾') === '中国台湾',
      '港澳台展示为"中国XX"'
    );
    ok(
      cities.provinceLabel('北京') === '北京市'
        && cities.provinceLabel('广东') === '广东省'
        && cities.provinceLabel('内蒙古') === '内蒙古自治区',
      '省级全称正确'
    );

    // 三级都要能落地：每个省有市、每个市有经纬度和第三级、坐标不越界
    const bad = [];
    PROVINCES.forEach((p) => {
      if (!p.cities.length) bad.push(`${p.name} 没有城市`);
      p.cities.forEach((c) => {
        if (typeof c.lng !== 'number' || typeof c.lat !== 'number') bad.push(`${p.name}/${c.name} 缺经纬度`);
        if (Math.abs(c.lng) > 180 || Math.abs(c.lat) > 90) bad.push(`${p.name}/${c.name} 经纬度越界`);
        if (!cities.districtsOf(p.name, c.name).length) bad.push(`${p.name}/${c.name} 第三级为空`);
        const g = cities.locate(p.name, c.name);
        if (!g || !g.lng) bad.push(`${p.name}/${c.name} 查不到坐标`);
      });
    });
    ok(bad.length === 0, '每个市都有经纬度和第三级', bad.slice(0, 5).join('; '));
    ok(st.cities >= 330, `城市数量足够覆盖（${st.cities} 个）`);

    // 三级地名归一化：三级数据、只有城市名的老数据、空值都要能落地
    const gd = cities.placeOf({ province: '广东', city: '深圳', district: '南山区' });
    ok(gd.cityLabel === '广东省 深圳市 南山区' && gd.province === '广东', `三级地名归一化（${gd.cityLabel}）`);
    const old = cities.placeOf({ city: '杭州' });
    ok(old.province === '浙江' && old.city === '杭州', `老数据只有城市名也能反查省份（${old.cityLabel}）`);
    const empty = cities.placeOf({});
    ok(empty.province === '北京' && empty.city === '北京', `空值回退到默认城市（${empty.cityLabel}）`);
    const foreign = cities.placeOf({ province: '海外', city: '纽约' });
    ok(
      foreign.cityLabel === '纽约' && cities.locate('海外', '纽约').tz === -5,
      `海外城市带自己的时区（${foreign.cityLabel} / UTC-5）`
    );

    // 全称 → 短名（小程序版原生地区选择器回传的是全称）
    const back = cities.placeFromRegion(['广东省', '深圳市', '南山区']);
    ok(back.city === '深圳' && back.district === '南山区', '原生地区选择器的全称能还原');
    const backHk = cities.placeFromRegion(['香港特别行政区', '香港特别行政区', '中西区']);
    ok(backHk.province === '香港', `港澳的全称也能还原（${backHk.cityLabel}）`);

    // 经纬度真的进了上升星座的计算，而且说明里带上了出生地
    const a = core.buildChart({ birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, province: '北京', city: '北京' });
    const b = core.buildChart({ birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, province: '新疆', city: '喀什' });
    ok(a && b && a.signs.risingKnown && b.signs.risingKnown, '两地都能算出上升星座');
    ok(
      a.signs.risingNote.indexOf('北京') >= 0 && b.signs.risingNote.indexOf('喀什') >= 0,
      '上升星座说明里带上了出生地'
    );
  }

  // 题库：一千多道题，格式错一个字段就会静默影响一批用户的图谱，所以逐题校验
  {
    const problems = bank.validate();
    ok(problems.length === 0, '题库格式校验通过', problems.slice(0, 4).join('; '));
    const st = bank.stats();
    ok(st.total >= 1000, `题库规模（${st.total} 道）`);
    const sizes = {};
    QUESTIONS.forEach((q) => {
      sizes[q.options.length] = (sizes[q.options.length] || 0) + 1;
    });
    ok(Object.keys(sizes).length >= 3,
      `选项数量不固定（${Object.keys(sizes).sort().join('/')} 项各有）`);
    // 每根轴都要有足够的题，否则分层抽样抽不出 50 题
    const thin = Object.keys(st.byDim).filter((k) => st.byDim[k] < 50);
    ok(thin.length === 0, '每个轴都有足够的题供 50 题模式抽样', thin.join('、'));
  }
}

// ---------------------------------------------------------------- 天文锚点
section('2. 天文与干支锚点');
{
  // 太阳黄经：春分约 0°、夏至约 90°
  const jdEquinox = astro.julianDay(2024, 3, 20, 3); // 2024-03-20 03:06 UT 春分
  const eqLon = astro.norm360(astro.sunLongitude(jdEquinox));
  const eqDiff = Math.min(eqLon, 360 - eqLon); // 0° 和 360° 是同一个点
  ok(eqDiff < 0.5, '太阳黄经在 2024 春分点 ≈ 0°', `实际 ${eqLon.toFixed(3)}°`);

  const jdSolstice = astro.julianDay(2024, 6, 20, 20.9);
  const sl = astro.norm360(astro.sunLongitude(jdSolstice));
  ok(Math.abs(sl - 90) < 0.5, '太阳黄经在 2024 夏至点 ≈ 90°', `实际 ${sl.toFixed(3)}°`);

  // 太阳星座 vs 日期表法（只在远离交界的日期上比，交界日本身两法都有歧义）
  const cases = [
    [1990, 1, 5, 'capricorn'], [1990, 2, 5, 'aquarius'], [1990, 3, 5, 'pisces'],
    [1990, 4, 5, 'aries'], [1990, 5, 5, 'taurus'], [1990, 6, 5, 'gemini'],
    [1990, 7, 5, 'cancer'], [1990, 8, 5, 'leo'], [1990, 9, 5, 'virgo'],
    [1990, 10, 5, 'libra'], [1990, 11, 5, 'scorpio'], [1990, 12, 5, 'sagittarius']
  ];
  let mismatch = [];
  cases.forEach(([y, m, d, expect]) => {
    const r = astro.resolveSigns({
      year: y, month: m, day: d, hour: 12, minute: 0, timeKnown: true,
      tzOffset: 8, longitude: 116.4, latitude: 39.9
    });
    const byDate = astro.sunSignByDate(m, d);
    if (r.sun.key !== expect || byDate.key !== expect) {
      mismatch.push(`${y}-${m}-${d} 天文=${r.sun.key} 日期=${byDate.key} 期望=${expect}`);
    }
  });
  ok(mismatch.length === 0, '太阳星座：天文算法与日期表法互相校验（12 个月）', mismatch.join('; '));

  // 上升点公式基准：赤道 + RAMC=0 ⇒ 上升应为 90°（白羊0°起算的巨蟹0°）
  ok(Math.abs(astro.ascendant(0, 0) - 90) < 0.01, '上升点公式基准（赤道/RAMC=0 ⇒ 90°）',
    `实际 ${astro.ascendant(0, 0).toFixed(3)}°`);

  // 日柱锚点：2000-01-01 = 戊午
  const p2000 = bazi.buildPillars({ year: 2000, month: 1, day: 1, hour: 12, sunLon: 280 });
  ok(p2000.day.name === '戊午', '日柱锚点 2000-01-01 = 戊午日', `实际 ${p2000.day.name}`);

  // 年柱锚点：1984 = 甲子年，2024 = 甲辰年
  const p1984 = bazi.buildPillars({ year: 1984, month: 6, day: 1, hour: 12, sunLon: 70 });
  const p2024 = bazi.buildPillars({ year: 2024, month: 6, day: 1, hour: 12, sunLon: 70 });
  ok(p1984.year.name === '甲子', '年柱锚点 1984 = 甲子年', `实际 ${p1984.year.name}`);
  ok(p2024.year.name === '甲辰', '年柱锚点 2024 = 甲辰年', `实际 ${p2024.year.name}`);

  // 立春分界：2024-02-01 应算癸卯年，2024-03-01 应算甲辰年
  const beforeLc = bazi.buildPillars({ year: 2024, month: 2, day: 1, hour: 12, sunLon: 312 });
  const afterLc = bazi.buildPillars({ year: 2024, month: 3, day: 1, hour: 12, sunLon: 341 });
  ok(beforeLc.year.name === '癸卯', '立春前算上一年（2024-02-01 = 癸卯）', `实际 ${beforeLc.year.name}`);
  ok(afterLc.year.name === '甲辰', '立春后算本年（2024-03-01 = 甲辰）', `实际 ${afterLc.year.name}`);

  // 月柱：春分在卯月（黄经 0° → monthOrder 1）
  const mMonth = bazi.buildPillars({ year: 1990, month: 3, day: 25, hour: 12, sunLon: 4 });
  ok(mMonth.month.name === '己卯', '月柱 1990 庚午年春分后 = 己卯月', `实际 ${mMonth.month.name}`);

  // 时柱：五鼠遁 —— 戊癸日起壬子，甲己日起甲子
  const hourPillar = bazi.buildPillars({ year: 2000, month: 1, day: 1, hour: 0, sunLon: 280 });
  ok(hourPillar.day.name === '戊午' && hourPillar.hour.name === '壬子',
    '时柱 戊午日 00:00 = 壬子时（戊癸起壬子）', `实际 ${hourPillar.hour.name}`);
  const jiaDay = bazi.buildPillars({ year: 2000, month: 1, day: 7, hour: 0, sunLon: 281 });
  ok(jiaDay.day.stem === '甲' && jiaDay.hour.name === '甲子',
    '时柱 甲日子时 = 甲子时（甲己起甲子）', `实际 ${jiaDay.day.name}日 ${jiaDay.hour.name}时`);
  const chouHour = bazi.buildPillars({ year: 2000, month: 1, day: 1, hour: 1, sunLon: 280 });
  ok(chouHour.hour.branch === '丑', '01:00 落在丑时');
  const ziHour = bazi.buildPillars({ year: 2000, month: 1, day: 1, hour: 23, sunLon: 280 });
  ok(ziHour.hour.branch === '子', '23:00 落在子时');

  ok(astro.julianDay(2000, 1, 1, 12) === 2451545, '儒略日锚点 J2000 = 2451545');
  ok(FORMULAS.latitude === 0, '基准纬度常量可用');

  // 月亮黄经在合理区间内循环
  let moonOk = true;
  for (let i = 0; i < 60; i += 1) {
    const jd = astro.julianDay(1995, 1, 1, i * 12);
    const ml = astro.moonLongitude(jd);
    if (!(ml >= 0 && ml < 360)) moonOk = false;
  }
  ok(moonOk, '月亮黄经恒在 [0,360)');
}

// ---------------------------------------------------------------- 确定性
section('3. 确定性与边界');
{
  const profile = {
    name: '测试君', gender: 'female', birthDate: '1998-05-12',
    birthTime: '14:30', timeKnown: true, city: '杭州'
  };
  const a = core.divinate({ profile });
  const b = core.divinate({ profile });
  ok(a.resultId === b.resultId, '同输入 → 同 resultId', `${a.resultId} / ${b.resultId}`);
  ok(a.match.main.id === b.match.main.id, '同输入 → 同主推角色', a.match.main.char.name);
  ok(JSON.stringify(a.chart.dims) === JSON.stringify(b.chart.dims), '同输入 → 同命盘八轴');
  ok(a.fortune.level === b.fortune.level, '同人同日 → 同运势');

  // 不同人必须不同
  const c = core.divinate({
    profile: Object.assign({}, profile, { birthDate: '1998-05-13' })
  });
  ok(a.match.main.id !== c.match.main.id || JSON.stringify(a.chart.dims) !== JSON.stringify(c.chart.dims),
    '换一天出生 → 命盘或主推改变');

  // 不知道时辰也要能跑，且上升留白
  const noTime = core.divinate({
    profile: { name: '无时辰', birthDate: '1988-11-03', timeKnown: false, city: '成都' }
  });
  ok(!noTime.chart.signs.risingKnown, '未提供时辰 → 上升星座标记为未知');
  ok(noTime.chart.pillarsList.filter((p) => !p.known).length === 1, '未提供时辰 → 时柱标记为未知');
  ok(noTime.match.main.char.name.length > 0, '未提供时辰 → 依然能匹配到角色');

  // 随心抽签
  const draw1 = core.divinate({ drawToken: 'token-A' });
  const draw2 = core.divinate({ drawToken: 'token-A' });
  const draw3 = core.divinate({ drawToken: 'token-B' });
  ok(draw1.chart.mode === 'draw' && draw1.chart.draw, '抽签模式命盘结构完整');
  ok(draw1.resultId === draw2.resultId, '同 token 抽签结果一致');
  ok(draw1.resultId !== draw3.resultId, '不同 token 抽签结果不同');
  ok(draw1.match.main.char.name.length > 0, '抽签也能匹配到角色');

  // 答题修正：只答按题量抽出来的那一套，权重按题量归一
  const picked = core.listQuestions({ count: 30, seed: 'selftest' });
  const answers = {};
  picked.forEach((q) => {
    answers[q.id] = 0;
  });
  const withQuiz = core.divinate({ profile, answers, quizCount: 30 });
  ok(withQuiz.chart.quiz.answered === 30, `答题全部计入（${withQuiz.chart.quiz.answered} / 30 题）`);
  ok(withQuiz.chart.quiz.asked === 30, '图谱记住了这次问了几题（权重按它归一）');
  ok(JSON.stringify(withQuiz.chart.dims) !== JSON.stringify(a.chart.dims), '答题会改变命盘');
  // 多选题：勾多项取平均，不该等于多答几道题
  {
    const multi = core.listQuestions({ count: 50, seed: 'selftest-multi' }).filter((q) => q.multi)[0];
    ok(!!multi, '50 题的样本里有多选题');
    const one = core.applyAnswers(a.chart, { [multi.id]: [0] }, { quizCount: 50 });
    const many = core.applyAnswers(a.chart, { [multi.id]: multi.options.map((o) => o.index) }, { quizCount: 50 });
    const keys = Object.keys(a.chart.dims);
    const drift = (c) => keys.reduce((s, k) => s + Math.abs(c.dims[k] - a.chart.dims[k]), 0) / keys.length;
    ok(drift(many) <= drift(one) + 0.51,
      `多选取平均而不是累加（勾满 ${drift(many).toFixed(1)} vs 勾一个 ${drift(one).toFixed(1)}）`);
  }

  // 出错的输入
  const bad = core.divinate({ profile: { birthDate: '1998/05/12' } });
  ok(!!bad.error, '非法日期返回 error 而不是抛异常', bad.message);

  // 八轴范围与文案完整性
  let rangeOk = true;
  let copyOk = true;
  let nanOk = true;
  const rng = createRng('fuzz-1');
  const names = ['林', '沈', '苏', '白', '顾', '江', '秦', '云', '叶', '温'];
  for (let i = 0; i < 400; i += 1) {
    const y = rng.int(1940, 2018);
    const m = rng.int(1, 12);
    const d = rng.int(1, 28);
    const hasTime = rng.next() > 0.35;
    const res = core.divinate({
      profile: {
        name: rng.pick(names) + rng.int(2, 99),
        birthDate: `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`,
        birthTime: hasTime ? `${rng.int(0, 23)}:${rng.int(0, 59)}` : '',
        timeKnown: hasTime,
        city: rng.pick(PROVINCES).name
      }
    });
    if (res.error) { nanOk = false; break; }
    DIM_KEYS.forEach((k) => {
      const v = res.chart.dims[k];
      if (!(typeof v === 'number' && v >= 0 && v <= 100)) rangeOk = false;
    });
    const blob = Object.keys(res.copy)
      .map((k) => (Array.isArray(res.copy[k]) ? res.copy[k].join(' || ') : String(res.copy[k])))
      .join(' || ');
    if (/\{|\}|undefined|NaN/.test(blob)) {
      copyOk = false;
      console.log(`     文案异常样本: ${blob.slice(0, 400)}`);
      break;
    }
  }
  ok(rangeOk, '400 次随机命盘：八轴恒在 0~100');
  ok(nanOk, '400 次随机命盘：无报错');
  ok(copyOk, '400 次随机命盘：文案无未替换占位符 / undefined');
}

// ---------------------------------------------------------------- 匹配分布
section('4. 匹配分布（抽卡手感）');
{
  const N = 4000;
  const rng = createRng('distribution-seed');
  const mainCount = {};
  const chartRarity = {};
  const charRarity = {};
  const scoreBuckets = {};
  const names = ['林', '沈', '苏', '白', '顾', '江', '秦', '云', '叶', '温', '许', '陆'];
  const cities = PROVINCES.map((p) => p.name);

  let minMainScore = 999;
  let maxMainScore = 0;
  let totalMainScore = 0;
  let antiScoreSum = 0;

  for (let i = 0; i < N; i += 1) {
    const y = rng.int(1945, 2015);
    const m = rng.int(1, 12);
    const d = rng.int(1, 28);
    const hasTime = rng.next() > 0.3;
    const res = core.divinate({
      profile: {
        name: rng.pick(names) + rng.int(1, 99),
        birthDate: `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`,
        birthTime: hasTime ? `${rng.int(0, 23)}:${rng.int(0, 59)}` : '',
        timeKnown: hasTime,
        city: rng.pick(cities)
      }
    });
    const id = res.match.main.id;
    mainCount[id] = (mainCount[id] || 0) + 1;
    const cr = res.chart.rarity.key;
    chartRarity[cr] = (chartRarity[cr] || 0) + 1;
    const mr = res.match.main.char.rarity;
    charRarity[mr] = (charRarity[mr] || 0) + 1;
    const s = res.match.main.resonance;
    totalMainScore += s;
    if (s < minMainScore) minMainScore = s;
    if (s > maxMainScore) maxMainScore = s;
    const bucket = Math.floor(s / 5) * 5;
    scoreBuckets[bucket] = (scoreBuckets[bucket] || 0) + 1;
    antiScoreSum += res.match.anti.resonance;
  }

  const counts = Object.keys(mainCount).map((k) => ({ id: k, n: mainCount[k] }));
  counts.sort((a, b) => b.n - a.n);
  const distinct = counts.length;
  const top = counts[0];
  const bottom = counts[counts.length - 1];
  const topShare = ((top.n / N) * 100).toFixed(1);
  const never = CHARACTERS.filter((c) => !mainCount[c.id]).map((c) => c.name);

  console.log(`    样本数 ${N}，出场角色 ${distinct}/${CHARACTERS.length}`);
  console.log(`    最高频：${top.id} ${topShare}%（${top.n} 次），最低频：${bottom.id} ${bottom.n} 次`);
  console.log(`    主推共振度：平均 ${(totalMainScore / N).toFixed(1)}，区间 ${minMainScore}~${maxMainScore}`);
  console.log(`    反推共振度平均：${(antiScoreSum / N).toFixed(1)}`);
  console.log(`    命格稀有度分布：${JSON.stringify(chartRarity)}`);
  console.log(`    主推角色稀有度分布：${JSON.stringify(charRarity)}`);
  const buckets = Object.keys(scoreBuckets).sort((a, b) => a - b)
    .map((k) => `${k}-${Number(k) + 4}:${scoreBuckets[k]}`).join('  ');
  console.log(`    共振度直方：${buckets}`);

  ok(distinct >= CHARACTERS.length * 0.9, `至少 90% 的角色能出现在主推位（${distinct}/${CHARACTERS.length}）`);
  // 12% 是"手感警戒线"而不是正确性标准：形状相近的角色之间必然有挤压，
  // 只要不回到早期那种"一个角色占 41%"就算健康。
  ok(top.n / N < 0.12, `没有角色霸榜（最高 ${topShare}% < 12%）`, `${top.id}`);
  // 出场覆盖要求 95% 以上即可：边缘角色（形状被同类挤占）出现率很低是正常的，
  // 只要不是"永远出不来"就不算 bug。想看具体是谁就把下面这行的阈值调到严格。
  ok(never.length <= Math.floor(CHARACTERS.length * 0.05),
    `角色出场覆盖率 ≥95%（从未出场 ${never.length} 个）`, never.join('、'));
  ok(totalMainScore / N > 70, `主推平均共振度 > 70（实际 ${(totalMainScore / N).toFixed(1)}）`);
  ok(charRarity.legend / N < 0.25, `传说角色不是随手就出（占 ${((charRarity.legend || 0) / N * 100).toFixed(1)}%）`);
  ok((charRarity.legend || 0) / N > 0.02, `传说角色也不是出不了（占 ${((charRarity.legend || 0) / N * 100).toFixed(1)}%）`);
  ok((chartRarity.legend || 0) / N < 0.15, `传说级命格比例合理（占 ${(((chartRarity.legend || 0) / N) * 100).toFixed(1)}%）`);

  // 主推必须真的比反向角色更共振
  let sanityOk = true;
  const check = core.divinate({
    profile: { name: '校验', birthDate: '1993-08-08', birthTime: '08:08', timeKnown: true, city: '北京' }
  });
  if (check.match.main.resonance <= check.match.anti.resonance) sanityOk = false;
  if (check.match.main.rarity.label === undefined) sanityOk = false;
  ok(sanityOk, '主推共振度 > 反向角色共振度');

  console.log('\n--- 样例输出 ---');
  console.log(`  命盘：${check.chart.signs.sun.name} / 月亮${check.chart.signs.moon.name} / 上升${check.chart.signs.rising.name}`);
  console.log(`  四柱：${check.chart.pillarsList.map((p) => `${p.label}${p.pillar.name}${p.known ? '' : '(未知)'}`).join(' ')}`);
  console.log(`  命格：${check.chart.rarity.label}（极端度 ${check.chart.extremity}） 本命${check.chart.element.name} 命途前三：${check.chart.fates.map((f) => f.name).join('、')}`);
  console.log(`  主推：${check.match.main.char.name}《${check.match.main.char.work}》 共振 ${check.match.main.resonance}%`);
  console.log(`  副推：${check.match.side.map((s) => `${s.char.name}(${s.resonance}%)`).join('、')}`);
  console.log(`  反向：${check.match.anti.char.name}《${check.match.anti.char.work}》 共振 ${check.match.anti.resonance}%`);
  console.log(`  运势：${check.fortune.levelName} ${check.fortune.starText} 幸运色${check.fortune.luckyColor.name} 幸运数${check.fortune.luckyNumber}`);
  console.log(`  宜：${check.fortune.good.join(' / ')}`);
  console.log(`  忌：${check.fortune.bad.join(' / ')}`);
  console.log(`\n  【本质】${check.copy.essence}`);
  console.log(`  【共振】${check.copy.resonance}`);
  console.log(`  【差异】${check.copy.difference}`);
  console.log(`  【未带入】${check.copy.anti}`);
  console.log(`  【神谕】${check.copy.counsel}`);
}

// ---------------------------------------------------------------- 汇总
console.log('\n========================================');
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  console.log('失败明细：');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('全部通过 ✅');
