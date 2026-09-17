/**
 * 题库聚合层。
 *
 * ## 文件格式（写题目看这里）
 *
 * 每个模块导出的是一个数组，每道题就是一个 `[题干, 选项数组, 备注?]` 三元组：
 *
 *   ['半夜刷到一条求助帖，你会——', [
 *     ['先转出去，多一个人看到就多一分希望', { light: 9, bond: 6 }],
 *     ['看看有没有人已经帮了，没有我再动', { order: 7, bond: 4 }],
 *     ['私信他，不想让这事被围观', { bond: 8, mercy: 5, light: -4 }]
 *   ]]
 *
 * 选项是 `[文案, 增量, 命途id?]`，命途 id 可省略（见 data/fates.js）。
 * 用数组而不是对象字面量，纯粹是因为题目量大 —— 一千多道题，每道省 20 个字符
 * 就是两万多字符，而字段名（text/options/add）在这里没有任何信息量。
 *
 * 想让某道题偏离所在模块的主轴，加第三个元素：
 *
 *   ['...', [...], { dim: 'fate', hint: '第一反应最准' }]
 *
 * 多选（可以勾好几个再提交）：
 *
 *   ['...', [...], { multi: 3 }]              // 最多勾 3 个
 *   ['...', [...], { multi: [1, 3] }]         // 至少 1 个、最多 3 个
 *
 * ## 为什么按轴分文件
 *
 * 抽题是**按轴分层**的（见 core/quiz.js）：10 道题必须覆盖到 8 根轴，
 * 否则用户答完 10 题，图谱可能只动了两根轴，命盘形状会假。
 * 按轴分文件让"每个轴有多少题"一眼可见，也方便按轴补题。
 *
 * ## 写作口径（和 core/copywriter 的风格保持一致）
 *
 *  - 第二人称、**具体场景**，不写"你是一个怎样的人"这种自评题（用户答不出来）
 *  - 每题 2~6 个选项；选项之间要真的互斥或真的可以并存，别写"以上都对"
 *  - 增量建议 ±6 ~ ±16；同一道题里各选项的"总力度"要大致相当，
 *    否则用户会本能地去挑那个力度最大的选项
 *  - 多选题的每项增量要更小（±5 ~ ±9），因为会累加
 */

const { DIM_KEYS } = require('../archetypes.js');
const { FATE_MAP } = require('../fates.js');

/**
 * 数据模块。顺序无关紧要，但保持稳定方便 diff。
 *
 * 每根轴两个文件（a/b 各 60 题左右）—— 一个文件塞一百多道题会有两三千行，
 * 编辑器和 diff 都不好受；分两个文件还能两个人同时写不同的批次。
 * id 是"前缀 + 模块内连续序号"，所以**往文件末尾追加**不会影响已有题的 id。
 */
const MODULES = [
  // core 是手工精修的核心题，每题自带 dim 与 id（id 保持稳定，别改）
  { prefix: 'c', dim: 'none', files: ['./core.js'] },
  { prefix: 'l', dim: 'light', files: ['./light-a.js', './light-b.js'] },
  { prefix: 'o', dim: 'order', files: ['./order-a.js', './order-b.js'] },
  { prefix: 'b', dim: 'bond', files: ['./bond-a.js', './bond-b.js'] },
  { prefix: 'p', dim: 'passion', files: ['./passion-a.js', './passion-b.js'] },
  { prefix: 'f', dim: 'fate', files: ['./fate-a.js', './fate-b.js'] },
  { prefix: 'm', dim: 'mercy', files: ['./mercy-a.js', './mercy-b.js'] },
  { prefix: 'x', dim: 'obsession', files: ['./obsession-a.js', './obsession-b.js'] },
  { prefix: 's', dim: 'sacrifice', files: ['./sacrifice-a.js', './sacrifice-b.js'] },
  // 多选与跨轴混合题
  { prefix: 'u', dim: 'none', files: ['./multi-a.js', './multi-b.js'] },
  // 变长选项题（2 / 4 / 6 个选项，以及各种 min/max 的多选）——
  // 页面不许假设选项一定有 3 个，这个模块就是那条约定的活体测试数据
  { prefix: 'v', dim: 'none', files: ['./vary-a.js'] }
];

/** 一道题允许的选项数量区间 */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/** 单个维度的增量上限（超过这个值说明力度失衡，抽样时会一边倒） */
const MAX_DELTA = 22;

function pad3(n) {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`;
}

/** 归一化一条备注 */
function metaOf(raw) {
  const m = raw || {};
  let multi = null;
  if (m.multi === true) multi = { min: 1, max: 3 };
  else if (typeof m.multi === 'number') multi = { min: 1, max: Math.max(1, m.multi) };
  else if (Array.isArray(m.multi)) {
    multi = { min: Math.max(0, m.multi[0] | 0), max: Math.max(1, m.multi[1] | 0) };
  }
  if (multi && multi.max < multi.min) multi.max = multi.min;
  return { hint: String(m.hint || ''), multi };
}

/** 还没写出来的模块文件。自检会把它当问题报出来，避免文件名写错却静默漏掉整批题 */
const MISSING = [];

/** 一个模块 → 题目对象数组（多文件时序号连续，追加文件不影响已有 id） */
function expand(mod) {
  const out = [];
  mod.files.forEach((file) => {
    let rows = [];
    try {
      // eslint-disable-next-line global-require
      rows = require(file) || [];
    } catch (e) {
      // 分批写题库的时候某个文件可能还没建。不静默吞掉 —— 记下来，自检会报。
      MISSING.push(file);
      return;
    }
    rows.forEach((row) => {
      const text = row[0];
      const opts = row[1] || [];
      const raw = row[2] || {};
      const meta = metaOf(raw);
      const n = out.length + 1;
      out.push({
        // 默认按"模块前缀 + 序号"生成 id；核心题自带 id（稳定，别动）
        id: raw.id || `${mod.prefix}${pad3(n)}`,
        dim: raw.dim || mod.dim,
        text,
        hint: meta.hint,
        multi: meta.multi,
        options: opts.map((o) => {
          const item = { text: o[0], add: o[1] || {} };
          if (o[2]) item.fate = o[2];
          return item;
        })
      });
    });
  });
  return out;
}

const QUESTIONS = [];
const MODULE_STATS = [];
MODULES.forEach((mod) => {
  const list = expand(mod);
  MODULE_STATS.push({ prefix: mod.prefix, dim: mod.dim, count: list.length });
  list.forEach((q) => QUESTIONS.push(q));
});

const QUESTION_MAP = {};
QUESTIONS.forEach((q) => {
  QUESTION_MAP[q.id] = q;
});

/** 按轴分组 —— 抽样要靠它做分层 */
const BY_DIM = {};
DIM_KEYS.concat(['none']).forEach((k) => {
  BY_DIM[k] = [];
});
QUESTIONS.forEach((q) => {
  const key = BY_DIM[q.dim] ? q.dim : 'none';
  BY_DIM[key].push(q);
});

/**
 * 题库自检。**不放在加载路径上**（一道坏题不该让整个游戏起不来），
 * 由 tools/selftest.js 调用，写完题跑一次 `npm run test:core` 就知道有没有写错。
 */
function validate() {
  const problems = MISSING.map((f) => `题库文件缺失：${f}`);
  const seen = {};
  QUESTIONS.forEach((q) => {
    if (seen[q.id]) problems.push(`id 重复：${q.id}`);
    seen[q.id] = true;
    if (!q.text || q.text.length < 4) problems.push(`${q.id} 题干太短`);
    if (q.text && q.text.length > 42) problems.push(`${q.id} 题干太长（${q.text.length} 字）`);
    if (q.options.length < MIN_OPTIONS) problems.push(`${q.id} 选项少于 ${MIN_OPTIONS} 个`);
    if (q.options.length > MAX_OPTIONS) problems.push(`${q.id} 选项多于 ${MAX_OPTIONS} 个`);
    const texts = {};
    q.options.forEach((o, i) => {
      if (!o.text) problems.push(`${q.id} 第 ${i + 1} 个选项没有文案`);
      if (o.text && o.text.length > 30) problems.push(`${q.id} 第 ${i + 1} 个选项太长`);
      if (texts[o.text]) problems.push(`${q.id} 有重复选项：${o.text}`);
      texts[o.text] = true;
      const keys = Object.keys(o.add);
      if (!keys.length) problems.push(`${q.id} 第 ${i + 1} 个选项没有任何增量`);
      keys.forEach((k) => {
        if (DIM_KEYS.indexOf(k) < 0) problems.push(`${q.id} 选项 ${i + 1} 的轴名不存在：${k}`);
        const v = o.add[k];
        if (typeof v !== 'number' || !isFinite(v) || v === 0) {
          problems.push(`${q.id} 选项 ${i + 1} 的 ${k} 增量非法：${v}`);
        } else if (Math.abs(v) > MAX_DELTA) {
          problems.push(`${q.id} 选项 ${i + 1} 的 ${k} 增量过大：${v}`);
        }
      });
      if (o.fate && !FATE_MAP[o.fate]) problems.push(`${q.id} 选项 ${i + 1} 的命途 id 不存在：${o.fate}`);
    });
    if (q.multi) {
      if (q.multi.min > q.options.length) problems.push(`${q.id} 多选下限超过选项数`);
      if (q.multi.max > q.options.length) problems.push(`${q.id} 多选上限超过选项数`);
    }
  });
  return problems;
}

/** 统计信息，自检与文档用 */
function stats() {
  const byDim = {};
  Object.keys(BY_DIM).forEach((k) => {
    byDim[k] = BY_DIM[k].length;
  });
  return {
    total: QUESTIONS.length,
    multi: QUESTIONS.filter((q) => q.multi).length,
    byDim,
    modules: MODULE_STATS.slice()
  };
}

module.exports = { QUESTIONS, QUESTION_MAP, BY_DIM, MODULES, validate, stats, MIN_OPTIONS, MAX_OPTIONS };
