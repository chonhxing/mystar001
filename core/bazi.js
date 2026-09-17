const {
  STEMS,
  BRANCHES,
  ELEMENT_DIMS,
  YINYANG_TWEAK,
  BRANCH_TWEAK,
  SEXAGENARY,
  STEM_TAGLINE
} = require('../data/ganzhi.js');
const { julianDay, norm360 } = require('./astro.js');

/**
 * 东方生辰：年 / 月 / 日 / 时 四柱。
 *
 * 三件值得说明的事：
 *  1. 干支历按「节气」走，不按阴历月，所以我们完全不需要农历转换表。
 *  2. 月柱不用查表：十二「节」正好落在太阳黄经 ≡ 15° (mod 30°) 的位置上，
 *     立春 = 315°、惊蛰 = 345°、清明 = 15°…… 所以直接由黄经反推月支，
 *     精度只受 core/astro.js 里太阳黄经公式的限制（约 ±15 分钟）。
 *  3. 2000-01-01 是戊午日（六十甲子第 54 位），日柱由此锚点推 JDN 差值。
 *
 * ⚠️ 已知简化：不处理真太阳时（经度时差）、不处理历史时区变更与夏令时。
 *    时柱在「时辰边界出生」的情况下可能与专业排盘差一个时辰。
 */

const LICHUN_LON = 315; // 立春的太阳黄经，也是干支年的分界
const DAY_ANCHOR_JDN = 2451545; // 2000-01-01 12:00 UT
const DAY_ANCHOR_INDEX = 54; // 戊午

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 由 天干下标 + 地支下标 组装一柱 */
function makePillar(stemIndex, branchIndex) {
  const s = STEMS[((stemIndex % 10) + 10) % 10];
  const b = BRANCHES[((branchIndex % 12) + 12) % 12];
  const idx = SEXAGENARY.indexOf(s.name + b.name);
  return {
    name: s.name + b.name,
    sexagenaryIndex: idx < 0 ? null : idx,
    stem: s.name,
    branch: b.name,
    element: s.element,
    yinyang: s.yinyang,
    zodiac: b.zodiac,
    stemNote: s.note,
    tagline: STEM_TAGLINE[s.name] || '',
    stemIndex: ((stemIndex % 10) + 10) % 10,
    branchIndex: ((branchIndex % 12) + 12) % 12
  };
}

/**
 * 把一柱折算成八维向量：天干六成 + 地支四成，再叠加阴阳与地支个性修正。
 * 天干是"你对外的样子"，地支是"里面的底子"，所以天干权重更高。
 */
function pillarDims(stemIndex, branchIndex) {
  const s = STEMS[((stemIndex % 10) + 10) % 10];
  const b = BRANCHES[((branchIndex % 12) + 12) % 12];
  const sd = ELEMENT_DIMS[s.element];
  const bd = ELEMENT_DIMS[b.element];
  const out = {};
  Object.keys(sd).forEach((k) => {
    out[k] = sd[k] * 0.6 + (bd[k] || 50) * 0.4;
  });
  const yy = YINYANG_TWEAK[s.yinyang] || {};
  Object.keys(yy).forEach((k) => {
    out[k] += yy[k];
  });
  const bt = BRANCH_TWEAK[((branchIndex % 12) + 12) % 12] || {};
  Object.keys(bt).forEach((k) => {
    out[k] += bt[k];
  });
  return out;
}

/** 地支时辰下标：23:00-00:59 = 子(0)，01:00-02:59 = 丑(1)…… */
function hourBranchIndex(hour) {
  return Math.floor((((hour + 1) % 24) + 24) % 24 / 2);
}

/**
 * 排四柱。
 * @param {object} p { year, month, day, hour, minute, sunLon, ziHourSwitchDay }
 */
function buildPillars(p) {
  const { year, month, day, sunLon } = p;
  const hour = typeof p.hour === 'number' ? p.hour : 12;
  const ziSwitch = !!p.ziHourSwitchDay;
  const lon = norm360(sunLon);

  // ---- 年柱：以立春为界 ----
  // 注意：不能只看"黄经是否 ≥ 315"，因为黄经过 315° 之后会绕回 0°，
  // 那样 3~12 月全都会被误判成立春前。用月份做主体判断，二月再交给黄经定交节日。
  let beforeLichun = false;
  if (month === 1) {
    beforeLichun = true; // 一月必然在立春前（冬至后黄经 270°~315°）
  } else if (month === 2) {
    beforeLichun = lon < LICHUN_LON; // 二月初的黄经 312° 左右，跨过 315° 即交立春
  }
  const ganzhiYear = beforeLichun ? year - 1 : year;
  const yearStem = ((ganzhiYear - 4) % 10 + 10) % 10;
  const yearBranch = ((ganzhiYear - 4) % 12 + 12) % 12;
  const yearPillar = makePillar(yearStem, yearBranch);

  // ---- 月柱：由太阳黄经反推，每 30° 一个月建 ----
  const monthOrder = Math.floor(norm360(lon - LICHUN_LON) / 30); // 0 = 寅月
  const monthStem = (((yearStem * 2 + 2 + monthOrder) % 10) + 10) % 10;
  const monthBranch = (monthOrder + 2) % 12;
  const monthPillar = makePillar(monthStem, monthBranch);

  // ---- 日柱：JDN 锚点法（23 点后是否进位由配置决定）----
  let dayY = year;
  let dayM = month;
  let dayD = day;
  if (ziSwitch && hour >= 23) {
    // 简单 +1 天：交给 Date 处理月末与闰年
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + 1);
    dayY = d.getUTCFullYear();
    dayM = d.getUTCMonth() + 1;
    dayD = d.getUTCDate();
  }
  const jdn = Math.floor(julianDay(dayY, dayM, dayD, 12) + 0.5);
  const dayIndex = (((jdn - DAY_ANCHOR_JDN + DAY_ANCHOR_INDEX) % 60) + 60) % 60;
  const dayPillar = makePillar(dayIndex % 10, dayIndex % 12);

  // ---- 时柱：日干起时 ----
  const hBranch = hourBranchIndex(hour);
  const hStem = ((dayPillar.stemIndex % 5) * 2 + hBranch) % 10;
  const hourPillar = makePillar(hStem, hBranch);

  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };
}

/** 四柱的五行分布，用来定「本命元素」 */
function elementStats(pillars) {
  const counter = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const list = [pillars.year, pillars.month, pillars.day, pillars.hour];
  list.forEach((pl) => {
    counter[pl.element] += 1;
    counter[BRANCHES[pl.branchIndex].element] += 1;
  });
  let top = '木';
  let max = -1;
  Object.keys(counter).forEach((k) => {
    if (counter[k] > max) {
      max = counter[k];
      top = k;
    }
  });
  return { counter, dominant: top };
}

function formatBirth(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

module.exports = {
  LICHUN_LON,
  makePillar,
  pillarDims,
  buildPillars,
  elementStats,
  hourBranchIndex,
  formatBirth
};
