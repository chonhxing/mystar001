const bank = require('../data/questions.js');
const { CONFIG } = require('../config/index.js');
const { DIM_KEYS } = require('../data/archetypes.js');
const { createRng } = require('./rng.js');
const vec = require('./vector.js');
const chartCore = require('./chart.js');

/**
 * 答题修正。
 *
 * ## 三件事，都是必须的
 *
 * 1. **分层抽样**（`sampleQuestions`）
 *    题库一千多道，用户只答 10~50 道。按轴分层轮转着抽，
 *    保证 10 道题也能覆盖到八根轴 —— 否则用户答完 10 题，
 *    图谱可能只动了两根轴，命盘形状就是假的。
 *
 * 2. **权重按题量归一**（`applyAnswers`）
 *    以前固定 9~11 道题、每题 ×1.1。现在可以答 50 道，如果还按每题 ×1.1 累加，
 *    单根轴会被推到 ±500，归一化之后所有命盘都变成"要么全 0 要么全 100"。
 *    所以每题权重 = `QUIZ_WEIGHT × 参考题数 / 实际题数`：
 *    **答 50 道和答 10 道对图谱的总影响力一样，只是 50 道更准**（噪声更小）。
 *
 * 3. **多选按平均算**
 *    多选题勾 3 个选项，不该等于 3 道题的力度。取所选选项增量的**平均**，
 *    语义上也更顺：勾出来这几条，共同描述了你的一种倾向。
 *
 * ## 答案格式
 *
 *   answers = { [questionId]: optionIndex | optionIndex[] }
 *
 * 单选存数字、多选存数组，老数据（全是数字）不用迁移。
 */

/** 允许的题量档位 */
const COUNTS = (CONFIG.DIVINATION.QUIZ_COUNTS || [10, 20, 30, 50]).slice();

/** 归一化题量：不在档位里就夹到最近的一档 */
function normalizeCount(n) {
  const v = Math.round(Number(n));
  if (!isFinite(v) || v <= 0) return COUNTS[0];
  let best = COUNTS[0];
  let diff = Infinity;
  COUNTS.forEach((c) => {
    const d = Math.abs(c - v);
    if (d < diff) {
      diff = d;
      best = c;
    }
  });
  return best;
}

/**
 * 分层抽样。
 *
 * 做法：按轴分桶 → 每桶用 rng 洗牌 → 各个桶轮转着取一道 → 最后整体打乱顺序。
 * 打乱顺序是必要的：否则用户会连着答 8 道"光与影"的题，明显感觉"怎么老问同一件事"。
 *
 * 同一个 seed + 同一个题量 → 同一套题（重进答题页不会换题）；
 * 不同的一次占卜带不同的 token，所以同一个用户每次玩到的题也不一样。
 */
function sampleQuestions(opts) {
  const o = opts || {};
  const count = normalizeCount(o.count);
  const seed = String(o.seed || 'quiz');
  const rng = createRng(`${seed}|${count}`);

  const buckets = DIM_KEYS.concat(['none']).map((key) => ({
    key,
    // 必须复制再洗：rng.shuffle 是就地打乱，直接用会把题库的原始数组搅乱
    list: rng.shuffle((bank.BY_DIM[key] || []).slice())
  }));
  // 桶本身的顺序也打乱，避免"每次第一题都是光与影"
  const order = rng.shuffle(buckets);

  const picked = [];
  const seen = {};
  let cursor = 0;
  // 轮转：每一轮从每个桶里各取一道，直到取满 count 或题库取空
  while (picked.length < count) {
    let progressed = false;
    for (let i = 0; i < order.length && picked.length < count; i += 1) {
      const b = order[i];
      if (cursor >= b.list.length) continue;
      const q = b.list[cursor];
      progressed = true;
      if (!seen[q.id]) {
        seen[q.id] = true;
        picked.push(q);
      }
    }
    cursor += 1;
    if (!progressed) break; // 所有桶都到底了：题库不够 count 道
  }

  return rng.shuffle(picked);
}

/** 给 UI 用的题目副本，附带进度与多选配置 */
function listQuestions(opts) {
  const picked = sampleQuestions(opts);
  return picked.map((q, i) => ({
    id: q.id,
    index: i + 1,
    total: picked.length,
    text: q.text,
    hint: q.hint || '',
    dim: q.dim,
    // { min, max } 或 null（单选）
    multi: q.multi ? { min: q.multi.min, max: q.multi.max } : null,
    // 选项数量是变长的（2~6 个），页面不许假设一定是 3 个
    options: q.options.map((op, oi) => ({ index: oi, text: op.text }))
  }));
}

/** 从答案里取出这次勾了哪几个选项（单选 → 长度 1 的数组） */
function picksOf(raw, optionCount) {
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  list.forEach((v) => {
    const i = Math.round(Number(v));
    if (!isFinite(i) || i < 0 || i >= optionCount) return;
    if (out.indexOf(i) < 0) out.push(i);
  });
  return out;
}

/**
 * 把答案叠加到命盘上，然后重新推导所有展示字段。
 * @param {object} chart build 出来的命盘
 * @param {object} answers { [questionId]: optionIndex | optionIndex[] }
 * @param {object} opts { quizCount } —— 用户这次选了几道题（决定每题权重）
 */
function applyAnswers(chart, answers, opts) {
  if (!chart || !answers) return chart;
  const o = opts || {};

  // 没传题量就按参考题数算 —— 老调用点（固定 11 题的年代）的力度和以前完全一致
  const asked = o.quizCount ? normalizeCount(o.quizCount) : CONFIG.DIVINATION.QUIZ_REF_COUNT;
  const per = (CONFIG.DIVINATION.QUIZ_WEIGHT * CONFIG.DIVINATION.QUIZ_REF_COUNT) / Math.max(1, asked);

  const dims = {};
  DIM_KEYS.forEach((k) => {
    dims[k] = chart.dims[k];
  });
  const fateBoost = {};
  let answered = 0;
  let multiCount = 0;

  bank.QUESTIONS.forEach((q) => {
    const raw = answers[q.id];
    if (raw === undefined || raw === null) return;
    const picks = picksOf(raw, q.options.length);
    if (!picks.length) return;
    answered += 1;
    if (picks.length > 1) multiCount += 1;

    // 多选取平均（见文件头说明），单选就它自己
    const share = 1 / picks.length;
    picks.forEach((pi) => {
      const opt = q.options[pi];
      const add = opt.add || {};
      Object.keys(add).forEach((k) => {
        if (dims[k] === undefined) return;
        dims[k] += add[k] * per * share;
      });
      if (opt.fate) {
        fateBoost[opt.fate] = (fateBoost[opt.fate] || 0) + 6 * share;
      }
    });
  });

  if (!answered) {
    return Object.assign({}, chart, { quiz: { answered: 0, asked, applied: false } });
  }

  const next = Object.assign({}, chart, {
    dims: vec.normalize(dims),
    fateBoost: Object.assign({}, chart.fateBoost, fateBoost),
    quiz: {
      answered,
      asked,
      multi: multiCount,
      applied: true,
      total: asked, // 兼容旧字段名
      answers: Object.assign({}, answers)
    }
  });

  return chartCore.finalize(next);
}

/** 题库统计（自检与"关于"页用） */
function bankStats() {
  return bank.stats();
}

module.exports = {
  QUESTIONS: bank.QUESTIONS,
  COUNTS,
  normalizeCount,
  sampleQuestions,
  listQuestions,
  applyAnswers,
  bankStats
};
