const { CONFIG } = require('../config/index.js');
const chartCore = require('./chart.js');
const quizCore = require('./quiz.js');
const matcher = require('./matcher.js');
const fortuneCore = require('./fortune.js');
const copywriter = require('./copywriter.js');

/**
 * 占卜总入口。
 *
 *   divinate({ profile, answers, drawToken, date })
 *     → { resultId, chart, match, fortune, copy, unlocked }
 *
 * 这一层只做编排，不含任何算法。想换算法就换 core/ 里的模块，
 * 想换数据源（比如改成后端下发角色库）就换 services/api.js，两边互不影响。
 */

/** 稳定的短 id，用于历史记录去重 */
function shortId(str) {
  let h = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36).slice(0, 8);
}

/**
 * @param {object} input
 *   - profile: { name, gender, birthDate, birthTime, timeKnown, province, city, district }
 *   - answers: { [questionId]: optionIndex | optionIndex[] }  可选，答题修正
 *   - quizCount: number  可选，这次一共问了几题（决定每题权重，见 core/quiz.js）
 *   - drawToken: string  可选，随心抽签用（调用方给，保证 core 无副作用）
 *   - date: 'YYYY-MM-DD'  可选，每日运势的日期，默认取本地今天
 */
function divinate(input) {
  const opt = input || {};
  // drawToken 需要和 profile 合在一起传给 build，否则抽签的"同 token 同结果"会失效
  const chartInput = opt.profile
    ? Object.assign({}, opt.profile, { drawToken: opt.drawToken })
    : opt;
  const chart = chartCore.build(chartInput);

  if (!chart) {
    return { error: 'MISSING_BIRTH_DATE', message: '出生日期格式不对，需要 YYYY-MM-DD' };
  }

  const refined = opt.answers
    ? quizCore.applyAnswers(chart, opt.answers, { quizCount: opt.quizCount })
    : chart;
  const match = matcher.match(refined);
  const fortune = fortuneCore.daily(refined, opt.date);
  const copy = copywriter.build(refined, match, fortune);

  const unlocked = [match.main.id]
    .concat(match.side.map((s) => s.id))
    .concat([match.anti.id]);

  return {
    resultId: shortId(refined.seed + (opt.answers ? JSON.stringify(opt.answers) : '')),
    version: CONFIG.VERSION,
    createdAt: Date.now(),
    chart: refined,
    match,
    fortune,
    copy,
    unlocked
  };
}

module.exports = {
  divinate,
  shortId,
  buildChart: chartCore.buildChart,
  buildDraw: chartCore.buildDraw,
  listQuestions: quizCore.listQuestions,
  sampleQuestions: quizCore.sampleQuestions,
  normalizeCount: quizCore.normalizeCount,
  bankStats: quizCore.bankStats,
  quizCounts: quizCore.COUNTS,
  applyAnswers: quizCore.applyAnswers,
  match: matcher.match,
  daily: fortuneCore.daily,
  localDateString: fortuneCore.localDateString
};
