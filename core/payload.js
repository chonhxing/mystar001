const { CONFIG } = require('../config/index.js');
const matcher = require('./matcher.js');
const { CHARACTER_MAP } = require('../data/characters.js');
const { FATE_MAP } = require('../data/fates.js');

/**
 * 客户端 ⇄ 服务端的数据契约。
 *
 * 放在 core/ 里而不是 services/ 里，是为了让服务端的自动化测试
 * 能直接用同一份代码构造请求、回填响应 —— 契约只有一处定义，两边不会写歪。
 *
 * 两条铁律：
 *  1. 上行只送「匿名数字」：八轴数值、星座/干支下标、色号、数字。
 *     姓名和生辰不出手机（隐私），自由文本一个都不送（防提示词注入）。
 *  2. 下行只收「id + 数字」：中文文案由客户端用本地角色表重建，
 *     避免服务端与客户端版本漂移时渲染出空白。
 */

/** 本地占卜结果 → POST /api/divinate 的请求体 */
function buildFacts(result, opts) {
  const chart = result.chart;
  const o = opts || {};
  const p = chart.pillars;

  const bodies = {
    key: `${result.resultId}.${CONFIG.ROSTER_VERSION}`,
    mode: chart.mode,
    dims: chart.dims,
    signs: {
      sun: chart.signs && chart.signs.sun ? chart.signs.sun.key : null,
      moon: chart.signs && chart.signs.moon ? chart.signs.moon.key : null,
      rising: chart.signs && chart.signs.rising ? chart.signs.rising.key : null,
      risingKnown: !!(chart.signs && chart.signs.risingKnown)
    },
    /**
     * 干支只送六十甲子下标（0~59），服务端自己查表还原成"庚申"这样的名字。
     *
     * ⚠️ 但四柱 → 出生时刻是唯一确定的映射，枚举就能还原到小时。
     *    所以带四柱等于让模型服务间接知道出生时间。
     *    要不要关掉见 config.PRIVACY.SEND_PILLARS_TO_AI 的说明。
     *
     *    注意：**我们自己的服务端不落库这个字段**（server/playlog.js 有字段白名单），
     *    它只在转发给 AI 的那一次请求里存在。
     */
    pillars: p && CONFIG.PRIVACY.SEND_PILLARS_TO_AI
      ? {
          year: p.year.sexagenaryIndex,
          month: p.month.sexagenaryIndex,
          day: p.day.sexagenaryIndex,
          hour: p.hour.sexagenaryIndex,
          hourKnown: !!(chart.input && chart.input.timeKnown)
        }
      : null,
    lifeNumber: chart.lifeNumber ? chart.lifeNumber.number : null,
    element: chart.element ? chart.element.name : null,
    draw:
      chart.mode === 'draw' && chart.draw
        ? { signA: chart.draw.signA, signB: chart.draw.signB, fateId: chart.draw.fateId }
        : null,
    fortune: result.fortune
      ? {
          level: result.fortune.level,
          colorIndex: result.fortune.colorIndex,
          luckyNumber: result.fortune.luckyNumber
        }
      : null,
    quizAnswered: chart.quiz ? chart.quiz.answered : 0,
    date: result.fortune ? result.fortune.date : undefined,
    clientVersion: CONFIG.VERSION
  };

  if (o.aiPicksCharacter) bodies.aiPicksCharacter = true;
  return bodies;
}

/**
 * 服务端响应 → 回填到本地结果。
 * 返回 { result, applied }：applied 说明哪几部分真的用上了服务端的结果。
 * 任何一部分对不上（id 不存在、文案缺失）就单独保住本地那份，不整体丢弃。
 */
function applyServerResponse(result, resp) {
  const applied = { match: false, copy: false };
  if (!resp || !resp.ok) return { result, applied };

  const next = Object.assign({}, result);

  if (resp.match) {
    const hydrated = matcher.hydrate(result.chart, resp.match);
    if (hydrated && hydrated.anti) {
      next.match = hydrated;
      applied.match = true;
    }
  }

  if (resp.copy && typeof resp.copy === 'object') {
    const fields = ['title', 'essence', 'resonance', 'difference', 'anti', 'counsel'];
    const merged = Object.assign({}, result.copy);
    let hits = 0;
    fields.forEach((k) => {
      const v = resp.copy[k];
      if (typeof v === 'string' && v.trim().length >= 2) {
        merged[k] = v.trim();
        hits += 1;
      }
    });
    if (hits >= 3) {
      // 静态的标题行/副推行/分享语留在本地（它们不含 AI 内容，也不需要重算）
      merged.aiGenerated = !!resp.copy.aiGenerated;
      merged.source = resp.source || 'ai';
      next.copy = merged;
      applied.copy = true;
    }
  }

  if (resp.meta) {
    next.meta = {
      disclaimer: resp.meta.disclaimer,
      showAiLabel: resp.meta.showAiLabel !== false,
      quota: resp.meta.quota || null
    };
  }
  if (resp.source) next.source = resp.source;
  return { result: next, applied };
}

/**
 * 降级提示。
 *
 * 按原因分别给话 —— 之前不管什么原因都说"星象信号不好"，
 * 用户分不清是网络问题、服务没起、还是额度用完（这三件事的应对完全不同）。
 */
function localNotice(reason) {
  const map = {
    NETWORK: '没连上解读服务，这次用本机图谱为你解读',
    TIMEOUT: '解读服务响应太慢，这次用本机图谱为你解读',
    DOMAIN: '解读服务域名未放行，这次用本机图谱为你解读',
    WEAK_NETWORK: '网络信号弱，这次用本机图谱为你解读',
    QUOTA: '今日深度解读额度用完，这次用本机图谱',
    AI_FAILED: '解读服务暂时不可用，这次用本机图谱为你解读'
  };
  return map[reason] || map.NETWORK;
}

/** 角色 id → 本地角色对象（详情页/图鉴用），带兜底 */
function characterOf(id) {
  return CHARACTER_MAP[id] || null;
}

function fateOf(id) {
  return FATE_MAP[id] || null;
}

module.exports = { buildFacts, applyServerResponse, localNotice, characterOf, fateOf };
