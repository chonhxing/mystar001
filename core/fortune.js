const { LEVELS, LUCKY_COLORS, GOOD_POOL, BAD_POOL, LUCKY_ITEMS } = require('../data/fortune.js');
const { createRng } = require('./rng.js');

/**
 * 每日运势。
 *
 * 关键设计：结果只由 (用户命盘种子 + 日期) 决定。
 * 所以同一个人同一天反复看是同一个结果（显得"准"），
 * 换一天自动翻篇（有回访理由），而且不需要服务端存任何东西。
 */

const LEVEL_WEIGHTS = [8, 22, 30, 27, 13]; // 大吉 / 吉 / 小吉 / 平 / 末吉

function localDateString(d) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  return `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

function daily(chart, dateStr) {
  const date = dateStr || localDateString();
  const rng = createRng(`${chart.seed}|fortune|${date}`);

  const levelIndex = rng.weightedIndex(LEVEL_WEIGHTS);
  const level = LEVELS[levelIndex];

  const good = rng.sample(GOOD_POOL, 2);
  const bad = rng.sample(BAD_POOL.filter((b) => good.indexOf(b) < 0), 2);

  const palette = LUCKY_COLORS[chart.element && chart.element.name] || LUCKY_COLORS['水'];
  const colorIndex = rng.int(0, palette.length - 1);
  const color = palette[colorIndex];

  return {
    date,
    level: level.key,
    levelName: level.name,
    stars: level.stars,
    levelDesc: level.desc,
    // 五档用五芒星展示，UI 直接渲染这个字符串
    starText: '★'.repeat(level.stars) + '☆'.repeat(5 - level.stars),
    good,
    bad,
    luckyColor: color,
    colorIndex,
    luckyNumber: rng.int(1, 9),
    luckyItem: rng.pick(LUCKY_ITEMS),
    basedOn: chart.element ? chart.element.name : '水'
  };
}

module.exports = { daily, localDateString, LEVELS };
