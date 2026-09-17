const { CONFIG } = require('../config/index.js');
const { DIM_KEYS, DIMENSIONS, levelOf } = require('../data/archetypes.js');
const { FATES } = require('../data/fates.js');
const { ZODIAC_MAP, ELEMENTS } = require('../data/zodiac.js');
const { ELEMENT_DIMS } = require('../data/ganzhi.js');
const { RARITY } = require('../data/characters.js');
const { placeOf, locate } = require('../data/cities.js');
const astro = require('./astro.js');
const bazi = require('./bazi.js');
const numerology = require('./numerology.js');
const { createRng } = require('./rng.js');
const vec = require('./vector.js');

/**
 * 命盘合成：把 星象 + 干支 + 灵数 揉成一个八维向量。
 *
 * 合成方式是最朴素的加权平均 —— 之所以这样选，是因为它可解释：
 * 任何一根轴上的分数，都能回溯到"是太阳星座给的多，还是日柱给的多"。
 * 策划改 data/ 里的任何一张表，命盘会立刻跟着变，不用改这个文件。
 */

const SIGN_ELEMENT_TO_WUXING = { 火: '火', 土: '土', 水: '水', 风: '木' };

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDate(str) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(str || '').trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function parseTime(str) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(str || '').trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function zodiacDimsOf(sign) {
  const z = ZODIAC_MAP[sign && sign.key];
  return z ? z.dims : null;
}

function elementMeta(name) {
  const e = ELEMENTS[name];
  return e || { name: name || '—', trait: '未定', color: '#8B6CF0' };
}

/** 按极端度查命格稀有度 */
function rarityOf(extScore) {
  const table = CONFIG.DIVINATION.CHART_RARITY;
  for (let i = 0; i < table.length; i += 1) {
    if (extScore >= table[i].min) return { ...RARITY[table[i].key], score: extScore };
  }
  return { ...RARITY.common, score: extScore };
}

/**
 * 从 chart.dims 推导出所有"展示用"字段。
 * 单独抽出来是为了让答题修正后可以原地重算，而不用重建整个命盘。
 */
function finalize(chart) {
  const dims = chart.dims;

  // 八轴明细（UI 直接用，不在 WXML 里做计算）
  chart.axes = DIMENSIONS.map((d) => {
    const v = dims[d.key];
    return {
      key: d.key,
      name: d.name,
      pos: d.pos,
      neg: d.neg,
      posBadge: d.posBadge,
      negBadge: d.negBadge,
      value: v,
      negValue: 100 - v,
      level: levelOf(v),
      pole: v >= 50 ? d.pos : d.neg,
      badge: v >= 50 ? d.posBadge : d.negBadge,
      posDesc: d.posDesc,
      negDesc: d.negDesc
    };
  });

  chart.dominant = vec.dominantAxis(dims);
  chart.extremity = vec.extremity(dims);
  chart.rarity = rarityOf(chart.extremity);

  // 命途判定：和每个命途标签各算一次共振，取前三
  chart.fates = FATES.map((f) => ({
    id: f.id,
    name: f.name,
    summary: f.summary,
    shadow: f.shadow,
    score: vec.resonance(dims, f.dims),
    boost: (chart.fateBoost && chart.fateBoost[f.id]) || 0
  }))
    .map((f) => ({ ...f, score: vec.clamp(f.score + f.boost, 0, 99) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return chart;
}

/** 命盘模式：真实生辰 */
function buildChart(input) {
  const date = parseDate(input.birthDate);
  const time = parseTime(input.birthTime);
  const timeKnown = !!input.timeKnown && !!time;
  // 出生地是三级（省/市/区）。经纬度只到市级精度就够 —— 上升每 2 小时才走一个星座，
  // 经度差 1 度约合 4 分钟时差，落在区县那一级上完全看不出来。
  const place = placeOf(input);
  const geo = locate(place.province, place.city);
  const cityName = place.cityLabel;

  const seed = [
    CONFIG.DIVINATION.SEED_SALT,
    'chart',
    (input.name || '-').trim(),
    input.gender || '-',
    input.birthDate,
    timeKnown ? input.birthTime : 'unknown',
    place.province,
    place.city
  ].join('|');

  const rng = createRng(seed);

  if (!date) {
    return null;
  }

  const hour = timeKnown ? time.hour : CONFIG.DIVINATION.DEFAULT_HOUR;
  const minute = timeKnown ? time.minute : 0;

  const signs = astro.resolveSigns({
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
    timeKnown,
    tzOffset: geo ? geo.tz : 8,
    longitude: geo ? geo.lng : CONFIG.DIVINATION.DEFAULT_LNG,
    latitude: geo ? geo.lat : CONFIG.DIVINATION.DEFAULT_LAT
  });

  const pillars = bazi.buildPillars({
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    sunLon: signs.sunLon,
    ziHourSwitchDay: CONFIG.DIVINATION.ZI_HOUR_SWITCH_DAY
  });

  const life = numerology.lifeNumber(date.year, date.month, date.day);
  const nameNum = numerology.nameNumber(input.name);

  const W = CONFIG.DIVINATION.WEIGHTS;
  const stack = [];
  const add = (dims, weight) => {
    if (dims && weight > 0) stack.push({ dims, weight });
  };

  add(zodiacDimsOf(signs.sun), W.sun);
  add(zodiacDimsOf(signs.moon), W.moon);
  if (signs.risingKnown) add(zodiacDimsOf(signs.rising), W.rising);
  add(bazi.pillarDims(pillars.year.stemIndex, pillars.year.branchIndex), W.yearPillar);
  add(bazi.pillarDims(pillars.month.stemIndex, pillars.month.branchIndex), W.monthPillar);
  add(bazi.pillarDims(pillars.day.stemIndex, pillars.day.branchIndex), W.dayPillar);
  if (timeKnown) add(bazi.pillarDims(pillars.hour.stemIndex, pillars.hour.branchIndex), W.hourPillar);
  add(life.dims, W.lifeNumber);
  add(nameNum.dims, W.nameNumber);

  const base = vec.mix(stack);

  // 微扰：让同一天出生的人不完全一样，但幅度小到不会推翻主星
  const jitter = CONFIG.DIVINATION.JITTER;
  DIM_KEYS.forEach((k) => {
    base[k] += rng.around(0, jitter);
  });

  const chart = {
    mode: 'chart',
    seed,
    dims: vec.normalize(vec.contrast(base, CONFIG.DIVINATION.CONTRAST)),
    jittered: true,
    signs: {
      sun: signs.sun,
      moon: signs.moon,
      rising: signs.rising,
      risingKnown: signs.risingKnown,
      risingNote: signs.risingKnown
        ? `按${cityName}（${geo ? geo.lng : CONFIG.DIVINATION.DEFAULT_LNG}°E）估算`
        : '未提供出生时辰，上升星座留白'
    },
    pillars,
    pillarsList: [
      { key: 'year', label: '年柱', pillar: pillars.year, known: true, meaning: '出身与时代' },
      { key: 'month', label: '月柱', pillar: pillars.month, known: true, meaning: '环境与际遇' },
      { key: 'day', label: '日柱', pillar: pillars.day, known: true, meaning: '本性与配偶' },
      { key: 'hour', label: '时柱', pillar: pillars.hour, known: timeKnown, meaning: '晚年与去向' }
    ],
    lifeNumber: life,
    nameNumber: nameNum,
    input: {
      name: (input.name || '').trim(),
      gender: input.gender || '',
      birthDate: input.birthDate,
      birthTime: timeKnown ? input.birthTime : '',
      timeKnown,
      province: place.province,
      city: place.city,
      district: place.district,
      cityLabel: cityName,
      label: timeKnown
        ? `${input.birthDate} ${input.birthTime} · ${cityName}`
        : `${input.birthDate}（时辰未提供）· ${cityName}`
    }
  };

  const stats = bazi.elementStats(pillars);
  chart.wuxing = stats.counter;
  chart.element = elementMeta(stats.dominant);
  chart.yinyang = pillars.day.yinyang;

  return finalize(chart);
}

/**
 * 随心抽签：不填生辰也能玩。
 * 命盘由 2 个随机星座 + 1 条命途 混合而成 —— 不是纯随机数，
 * 所以抽出来的命盘依然"像一个人"，只是不指向任何出生时刻。
 */
function buildDraw(input) {
  const token = (input && input.drawToken) || String(Date.now());
  const seed = [CONFIG.DIVINATION.SEED_SALT, 'draw', token].join('|');
  const rng = createRng(seed);

  const signs = rng.sample(Object.keys(ZODIAC_MAP), 2).map((k) => ZODIAC_MAP[k]);
  const fate = rng.pick(FATES);

  const base = vec.mix([
    { dims: signs[0].dims, weight: 1 },
    { dims: signs[1].dims, weight: 0.75 },
    { dims: fate.dims, weight: 0.6 }
  ]);

  DIM_KEYS.forEach((k) => {
    base[k] += rng.around(0, CONFIG.DIVINATION.JITTER * 1.6);
  });

  const dims = vec.normalize(vec.contrast(base, CONFIG.DIVINATION.CONTRAST));

  // 本命元素：找和命盘真正最贴近的五行，而不是硬编一个
  let best = '木';
  let bestScore = -1;
  Object.keys(ELEMENT_DIMS).forEach((k) => {
    const score = vec.resonance(dims, ELEMENT_DIMS[k]);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  });

  const chart = {
    mode: 'draw',
    seed,
    dims,
    jittered: true,
    signs: { sun: signs[0], moon: signs[1], rising: null, risingKnown: false, risingNote: '此签不依生辰' },
    pillars: null,
    pillarsList: [],
    lifeNumber: null,
    nameNumber: numerology.nameNumber(input && input.name),
    wuxing: null,
    element: elementMeta(best),
    yinyang: rng.next() > 0.5 ? '阳' : '阴',
    draw: {
      token,
      note: '此签不依生辰，只依你按下按钮的这一刻',
      veins: signs.map((s) => s.name).join(' · ') + ' · ' + fate.name,
      // 下面三个是"可还原索引"：服务端会用它们重建同样的签文，客户端送不进自由文本
      signA: signs[0].key,
      signB: signs[1].key,
      fateId: fate.id
    },
    input: {
      name: (input && input.name) || '',
      gender: '',
      birthDate: '',
      birthTime: '',
      timeKnown: false,
      province: '',
      city: '',
      district: '',
      cityLabel: '',
      label: '随心一签'
    }
  };

  return finalize(chart);
}

/** 统一入口：有生辰走命盘，没有就走抽签 */
function build(input) {
  if (input && input.birthDate) return buildChart(input);
  return buildDraw(input);
}

module.exports = {
  build,
  buildChart,
  buildDraw,
  finalize,
  parseDate,
  parseTime,
  rarityOf,
  pad2
};
