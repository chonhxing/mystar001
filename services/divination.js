const core = require('../core/index.js');
const api = require('./api.js');
const storage = require('../utils/storage.js');
const fmt = require('../utils/format.js');
const playlog = require('./playlog.js');

/**
 * 占卜流程的门面层。页面只调这里，不直接碰 core 和 api。
 *
 * 一次占卜的完整时序：
 *   1. 本地算命盘（同步，几毫秒）→ 立刻回调给页面渲染，用户马上看到命盘
 *   2. 并行请求后端拿 AI 解读 → 回来后再覆盖文案（用户看到文字"长出来"）
 *   3. 无论第 2 步成功与否，都会写历史 / 解锁图鉴
 */

const PENDING_KEY = 'pending_divination';

/** 把"待占卜的输入"暂存起来，供结果页读取（避免用 URL 传长参数） */
function prepare(input) {
  try {
    wx.setStorageSync(PENDING_KEY, input);
    return true;
  } catch (e) {
    return false;
  }
}

function peekPending() {
  try {
    return wx.getStorageSync(PENDING_KEY) || null;
  } catch (e) {
    return null;
  }
}

function takePending() {
  const v = peekPending();
  try {
    wx.removeStorageSync(PENDING_KEY);
  } catch (e) {
    /* ignore */
  }
  return v;
}

/** 纯本地占卜（不联网）——抽签、离线、预览都用它 */
function local(input) {
  return core.divinate({
    profile: input.profile,
    answers: input.answers,
    // 这次问了几题：决定每题权重，不传就按参考题数（兼容老调用点）
    quizCount: input.quizCount,
    drawToken: input.drawToken,
    date: fmt.dateStr()
  });
}

/** 汇总本次解锁的角色与分数 */
function unlockMap(result) {
  const ids = result.unlocked || [];
  const scores = {};
  if (result.match) {
    scores[result.match.main.id] = result.match.main.resonance;
    (result.match.side || []).forEach((s) => {
      scores[s.id] = s.resonance;
    });
    scores[result.match.anti.id] = result.match.anti.resonance;
  }
  return { ids, scores };
}

/**
 * 完整占卜。
 * @param {object} input { profile, answers, drawToken }
 * @param {object} hooks { onLocal(result) } —— 本地命盘算好时立刻回调
 * @returns {Promise<{result, source, notice, quota, error}>}
 */
async function run(input, hooks) {
  const h = hooks || {};
  const settings = storage.getSettings();

  const localResult = local(input);
  if (localResult.error) {
    return { error: localResult.error, message: localResult.message };
  }

  // 先让页面上命盘（用户不用等网络）
  if (h.onLocal) h.onLocal(localResult);

  let outcome = { result: localResult, source: 'local', notice: null };
  try {
    outcome = await api.divinate(localResult, input);
  } catch (e) {
    // api 层已经吞掉异常了，这里只是双保险
    outcome = { result: localResult, source: 'local', notice: '网络不太顺，这次的解读来自本地星盘' };
  }

  const finalResult = outcome.result;

  // ---- 落地：图鉴 + 历史 ----
  const { ids, scores } = unlockMap(finalResult);
  const codex = storage.unlock(ids, scores);
  finalResult.codex = { added: codex.added, total: codex.total };

  if (settings.saveHistory) {
    storage.appendHistory({
      resultId: finalResult.resultId,
      at: Date.now(),
      mode: finalResult.chart.mode,
      // 只存回看要展示的东西；命盘种子（含姓名生辰）不入库
      label: finalResult.chart.input.label,
      mainId: finalResult.match.main.id,
      mainName: finalResult.match.main.char.name,
      mainWork: finalResult.match.main.char.work,
      resonance: finalResult.match.main.resonance,
      score: finalResult.chart.dominant.value,
      dominantBadge: finalResult.chart.dominant.badge,
      rarity: finalResult.chart.rarity.key,
      source: outcome.source
    });
  }

  // ---- 上报到账号（异步、静默失败）----
  // 刻意放在最后且不 await：上报是"锦上添花"，网络不好时绝不能拖慢用户看到结果。
  // 本地那份记录已经写好了，没上报成功的话下次同步会补上。
  try {
    playlog.report(finalResult).then((r) => {
      if (r && r.ok && r.stats) finalResult.playStats = r.stats;
    });
  } catch (e) {
    /* 忽略 */
  }

  return {
    result: finalResult,
    localResult,
    source: outcome.source,
    notice: outcome.notice,
    quota: outcome.quota,
    limited: !!outcome.limited,
    reason: outcome.reason
  };
}

module.exports = { prepare, peekPending, takePending, local, run, unlockMap };
