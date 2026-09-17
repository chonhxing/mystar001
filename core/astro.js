const { ZODIAC } = require('../data/zodiac.js');

/**
 * 西方星象：太阳 / 月亮 / 上升。
 *
 * 这里是真的在算，不是随机分配：
 *  - 太阳星座、月亮的黄经来自低精度天文公式（Astronomical Algorithms 的简化版，
 *    误差 ~0.01°，折算成时间约 15 分钟，判星座绰绰有余）。
 *  - 上升星座用 原点赤经(RAMC) + 赤纬倾角 + 观测地纬度 的标准球面公式。
 *    纬度从 data/cities.js 拿，没选城市就用北京。
 *
 * ⚠️ 想更精确（比如真太阳时、时区历史变更、夏令时），
 *    把这个文件替换成天文历表实现即可，对外接口保持不变。
 */

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911; // 黄赤交角（2000.0）

function norm360(x) {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

function sinD(deg) {
  return Math.sin(deg * DEG);
}

/**
 * 儒略日。hoursUT 是 UT 时的小数小时（0~24）。
 * 只支持格里历（1582 年以后出生的人都够用）。
 */
function julianDay(year, month, day, hoursUT) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const d = day + (hoursUT || 0) / 24;
  return (
    Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5
  );
}

/** 太阳视黄经（度，0° = 春分点 / 白羊 0°） */
function sunLongitude(jd) {
  const n = jd - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);
  const omega = 125.04 - 0.052954 * n;
  return norm360(L + 1.915 * sinD(g) + 0.02 * sinD(2 * g) - 0.00569 - 0.00478 * sinD(omega));
}

/** 月亮视黄经（度）。只取主项，误差 ~0.3°，约合 40 分钟，够判月亮星座。 */
function moonLongitude(jd) {
  const n = jd - 2451545.0;
  const lp = norm360(218.316 + 13.176396 * n);
  const m = norm360(134.963 + 13.064993 * n);
  return norm360(lp + 6.289 * sinD(m));
}

/** 格林尼治平恒星时（度） */
function gmst(jd) {
  const n = jd - 2451545.0;
  const t = n / 36525;
  return norm360(
    280.46061837 + 360.98564736629 * n + 0.000387933 * t * t - (t * t * t) / 38710000
  );
}

/** 地心赤经 RAMC（度）= 地方恒星时 */
function ramc(jd, longitude) {
  return norm360(gmst(jd) + longitude);
}

/**
 * 上升点黄经（度）。球面三角标准解，象限由 atan2 自动处理。
 * 校验过两个基准case：赤道 + MC白羊0° ⇒ 上升巨蟹0°；伦敦 + MC白羊0° ⇒ 巨蟹26.6°。
 */
function ascendant(ramcDeg, latitude) {
  const r = ramcDeg * DEG;
  const eps = OBLIQUITY * DEG;
  const phi = latitude * DEG;
  const y = Math.cos(r);
  const x = -(Math.sin(r) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  return norm360(Math.atan2(y, x) / DEG);
}

/** 黄经 → 星座下标（0 = 白羊） */
function signIndex(lon) {
  return Math.floor(norm360(lon) / 30) % 12;
}

function signByIndex(i) {
  const z = ZODIAC[(i + 12) % 12];
  return {
    key: z.key,
    name: z.name,
    en: z.en,
    glyph: z.glyph,
    element: z.element,
    ruler: z.ruler,
    tagline: z.tagline,
    lon: null
  };
}

/** 兜底用的日期法太阳星座（和天文算法互为校验，也方便不传时辰时快速出结果） */
function sunSignByDate(month, day) {
  const edge = ZODIAC.map((z) => ({ key: z.key, from: z.from, to: z.to }));
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < edge.length; i++) {
    const z = edge[i];
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm === tm) {
      if (month === fm && day >= fd && day <= td) return signByIndex(i);
    } else if ((month === fm && day >= fd) || (month === tm && day <= td)) {
      return signByIndex(i);
    }
  }
  return signByIndex(0);
}

/**
 * 解析出生资料 → 三个星座。
 * @param {object} p { year, month, day, hour, minute, tzOffset, longitude, latitude, timeKnown }
 */
function resolveSigns(p) {
  const hour = p.timeKnown ? p.hour : 12;
  const minute = p.timeKnown ? p.minute : 0;
  const tz = typeof p.tzOffset === 'number' ? p.tzOffset : 8;
  const lng = typeof p.longitude === 'number' ? p.longitude : 116.4;
  const lat = typeof p.latitude === 'number' ? p.latitude : 39.9;

  // 本地时间 → UT
  const hoursUT = hour + minute / 60 - tz;
  const jd = julianDay(p.year, p.month, p.day, hoursUT);

  const sunLon = sunLongitude(jd);
  const moonLon = moonLongitude(jd);

  const sun = signByIndex(signIndex(sunLon));
  sun.lon = Math.round(sunLon * 100) / 100;

  const moon = signByIndex(signIndex(moonLon));
  moon.lon = Math.round(moonLon * 100) / 100;

  const rising = signByIndex(signIndex(ascendant(ramc(jd, lng), lat)));

  return {
    sun,
    moon,
    rising,
    // 上升是"当天几点出生"的函数，不知道时辰就只能藏起来，不能瞎给
    risingKnown: !!p.timeKnown,
    sunLon: sunLon,
    moonLon: moonLon,
    jd
  };
}

module.exports = {
  DEG,
  julianDay,
  sunLongitude,
  moonLongitude,
  gmst,
  ramc,
  ascendant,
  signIndex,
  signByIndex,
  sunSignByDate,
  resolveSigns,
  norm360
};
