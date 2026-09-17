const { DIMENSIONS, DIM_KEYS } = require('../data/archetypes.js');
const { CONFIG } = require('../config/index.js');

/**
 * 向量工具：所有"像不像"的判断都走这里。
 *
 * ⚠️ 核心设计：比较的是「形状」，不是「数值」。
 *
 * 为什么不用数值直接算距离？实测过：命盘的八轴内部标准差只有 8 左右，
 * 而角色库的八轴内部标准差是 19 左右 —— 命盘比角色"平"得多。
 * 直接算欧氏距离的话，结果永远是最中庸的那几个角色霸榜（实测一个角色占 41%），
 * 两极化的角色（比如光=12 的反派）永远出不来。
 *
 * 所以这里先把每个向量在它自己的八轴上标准化（z-score），
 * 再比"哪根轴相对突出"—— 也就是比较命盘的「形状」。
 * 这样"你的执念远高于你自己其他轴"就能对上"TA的执念远高于 TA 其他轴"，
 * 与整体数值高低无关，两极化角色也就都能出场了。
 *
 * 副作用（可接受）：极端程度不同但形状相同的两个人会匹配到同一个角色。
 * 这是有意的取舍 —— 解读本来就该讲"你最突出的是什么"。
 */

const WEIGHT = {};
DIMENSIONS.forEach((d) => {
  WEIGHT[d.key] = d.weight;
});
const SUM_WEIGHT = DIM_KEYS.reduce((s, k) => s + WEIGHT[k], 0);

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function safe(dims, k) {
  const v = dims ? dims[k] : undefined;
  return typeof v === 'number' && !Number.isNaN(v) ? v : 50;
}

/** 加权均值 */
function weightedMean(dims) {
  let sum = 0;
  for (let i = 0; i < DIM_KEYS.length; i += 1) {
    sum += WEIGHT[DIM_KEYS[i]] * safe(dims, DIM_KEYS[i]);
  }
  return sum / SUM_WEIGHT;
}

/**
 * 八轴标准化：返回 { z, mean, sd }。
 * z 的含义是"这根轴比你自己其他轴强/弱多少个标准差"。
 */
function zscore(dims) {
  const mean = weightedMean(dims);
  let varSum = 0;
  for (let i = 0; i < DIM_KEYS.length; i += 1) {
    const k = DIM_KEYS[i];
    const d = safe(dims, k) - mean;
    varSum += WEIGHT[k] * d * d;
  }
  const sd = Math.sqrt(varSum / SUM_WEIGHT);
  const z = {};
  for (let i = 0; i < DIM_KEYS.length; i += 1) {
    const k = DIM_KEYS[i];
    z[k] = sd < 1e-6 ? 0 : (safe(dims, k) - mean) / sd;
  }
  return { z, mean, sd };
}

/** 两个向量在标准空间里的加权均方距离（0 = 形状一致） */
function zDistance(za, zb) {
  let sum = 0;
  for (let i = 0; i < DIM_KEYS.length; i += 1) {
    const k = DIM_KEYS[i];
    const d = za[k] - zb[k];
    sum += WEIGHT[k] * d * d;
  }
  return Math.sqrt(sum / SUM_WEIGHT);
}

/** 命盘形状 vs 角色形状的距离。flip=true 时取镜像，用来找"和你相反的人"。 */
function shapeDistance(a, b, flip) {
  const za = zscore(a).z;
  const zb = zscore(b).z;
  if (flip) {
    const flipped = {};
    for (let i = 0; i < DIM_KEYS.length; i += 1) {
      const k = DIM_KEYS[i];
      flipped[k] = -za[k];
    }
    return zDistance(flipped, zb);
  }
  return zDistance(za, zb);
}

/**
 * 共振度百分比。
 *
 * 距离 d 到百分比的映射用「锚点曲线」而不是线性缩放：
 * 线性缩放没法同时满足"最高分要好看（85+）"和"平均分要低（50 上下）"，
 * 因为实测 d 的分布是长尾的（最好的一对约 0.5，随机一对约 1.3）。
 * 锚点表放在 config.MATCH.RESONANCE_CURVE，可以直接调手感。
 */
function curveScore(d) {
  const anchors = (CONFIG.MATCH && CONFIG.MATCH.RESONANCE_CURVE) || [[0, 99], [1, 60], [2, 18]];
  if (d <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const cur = anchors[i];
    if (d <= cur[0]) {
      const t = cur[0] === prev[0] ? 0 : (d - prev[0]) / (cur[0] - prev[0]);
      return prev[1] + (cur[1] - prev[1]) * t;
    }
  }
  return anchors[anchors.length - 1][1];
}

function resonance(a, b, flip) {
  const d = shapeDistance(a, b, flip);
  return clamp(Math.round(curveScore(d)), 5, 99);
}

/**
 * 命格「偏科度」：八轴的加权标准差，0~100。
 * 用标准差而不是"离 50 的幅度"，是因为后者会被各张表的整体偏高（μ≈70）带跑，
 * 让所有人都变成传说。标准差只关心"你有多不平均" —— 一根轴飞出天际的人才是稀有命格。
 */
function extremity(dims) {
  const sd = zscore(dims).sd;
  const MAX = (CONFIG.DIVINATION && CONFIG.DIVINATION.SPIKE_MAX) || 24;
  return Math.round(clamp((sd / MAX) * 100, 0, 100) * 10) / 10;
}

/** 命盘上最突出的一根轴（在标准化空间里挑，和匹配口径一致） */
function dominantAxis(dims) {
  const { z } = zscore(dims);
  let best = DIM_KEYS[0];
  DIM_KEYS.forEach((k) => {
    if (z[k] > z[best]) best = k;
  });
  const meta = DIMENSIONS.find((d) => d.key === best);
  const value = Math.round(safe(dims, best));
  return {
    key: best,
    name: meta.name,
    pole: value >= 50 ? meta.pos : meta.neg,
    badge: value >= 50 ? meta.posBadge : meta.negBadge,
    value,
    z: Math.round(z[best] * 100) / 100
  };
}

/** 形状差异最大的一根轴：用来解释"为什么你没能走进TA的命途" */
function biggestGap(a, b) {
  const za = zscore(a).z;
  const zb = zscore(b).z;
  let best = DIM_KEYS[0];
  let bestGap = -1;
  DIM_KEYS.forEach((k) => {
    const gap = Math.abs(za[k] - zb[k]);
    if (gap > bestGap) {
      bestGap = gap;
      best = k;
    }
  });
  return {
    key: best,
    userValue: Math.round(safe(a, best)),
    targetValue: Math.round(safe(b, best)),
    // 正数 = TA 在这根轴上比你更靠"高"的那一端
    diff: zb[best] - za[best],
    zGap: Math.round(bestGap * 100) / 100
  };
}

/** 形状方向相反、且差异最大的几根轴（用于「你带不动的命途」） */
function opposingAxes(a, b, n) {
  const za = zscore(a).z;
  const zb = zscore(b).z;
  const list = [];
  DIM_KEYS.forEach((k) => {
    // 两根轴上"相对突出"的方向相反，才算真正对立
    if (za[k] * zb[k] < 0) {
      list.push({
        key: k,
        userValue: Math.round(safe(a, k)),
        targetValue: Math.round(safe(b, k)),
        gap: Math.abs(za[k] - zb[k])
      });
    }
  });
  list.sort((x, y) => y.gap - x.gap);
  return list.slice(0, n || 2);
}

/** 加权平均多个向量 */
function mix(list) {
  const out = {};
  let totalW = 0;
  DIM_KEYS.forEach((k) => {
    out[k] = 0;
  });
  (list || []).forEach((item) => {
    const w = item.weight || 1;
    totalW += w;
    DIM_KEYS.forEach((k) => {
      out[k] += safe(item.dims, k) * w;
    });
  });
  if (totalW <= 0) return out;
  DIM_KEYS.forEach((k) => {
    out[k] /= totalW;
  });
  return out;
}

/**
 * 对比度拉伸：把过于集中的数值拉开，让八轴图有看点。
 * 围绕向量自己的均值拉，而不是围绕 50 拉 —— 否则各张表的整体偏高会被放大，
 * 一堆轴撞到 100 上限，反而丢掉信息。
 */
function contrast(dims, k) {
  const mean = weightedMean(dims);
  const out = {};
  DIM_KEYS.forEach((key) => {
    out[key] = mean + (safe(dims, key) - mean) * k;
  });
  return out;
}

/** 夹取并取整，保证进 UI 的永远是 0~100 整数 */
function normalize(dims) {
  const out = {};
  DIM_KEYS.forEach((k) => {
    out[k] = Math.round(clamp(safe(dims, k), 0, 100));
  });
  return out;
}

module.exports = {
  clamp,
  zscore,
  zDistance,
  shapeDistance,
  resonance,
  extremity,
  dominantAxis,
  biggestGap,
  opposingAxes,
  mix,
  contrast,
  normalize,
  WEIGHT,
  SUM_WEIGHT
};
