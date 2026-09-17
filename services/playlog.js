const storage = require('../utils/storage.js');
const api = require('./api.js');
const analytics = require('./analytics.js');
const { CHARACTER_MAP } = require('../data/characters.js');

/**
 * 游玩记录与账号。
 *
 * ## 数据边界（这个模块最要紧的约定）
 *
 * 账号里存的是**游玩结果**，不是**个人信息**：
 *
 * | 数据 | 存哪 | 为什么 |
 * | --- | --- | --- |
 * | 充值记录、畅玩卡 | **账号**（服务端权威） | 涉及钱，必须跨设备 |
 * | 游玩记录（主推角色/共振度/图鉴/历史） | **账号 + 本机** | 换设备不丢收集进度 |
 * | 生辰资料（日期/时间/城市/称呼） | **只有本机** | 与账号无关 |
 * | 命盘（八轴 / 四柱） | **只有本机** | ⚠️ 四柱可反推出生时刻，落库等于存生日 |
 *
 * 所以上报时**只发结果字段**，一个生辰相关字段都不带。
 * 服务端那边还有一层字段白名单兜底（server/playlog.js 的 sanitize）。
 *
 * ## 同步策略
 *
 * **本地是主，服务端是备份。** 因为生辰只在本机，本机算出的记录最全；
 * 而且刚玩完的那一局可能还没上报成功。所以合并是"取并集"，不是"服务端覆盖本地"。
 */

/** 从一次占卜结果里抽出"可以上传"的字段（只含结果，不含生辰） */
function extract(result) {
  if (!result || !result.match || !result.chart) return null;
  const m = result.match;
  const chart = result.chart;
  const scores = {};
  scores[m.main.id] = m.main.resonance;
  (m.side || []).forEach((s) => {
    scores[s.id] = s.resonance;
  });
  if (m.anti) scores[m.anti.id] = m.anti.resonance;

  return {
    resultId: result.resultId,
    mainId: m.main.id,
    resonance: m.main.resonance,
    rarity: chart.rarity ? chart.rarity.key : '',
    dominantBadge: chart.dominant ? chart.dominant.badge : '',
    fates: (chart.fates || []).map((f) => f.id),
    mode: chart.mode,
    at: result.createdAt || Date.now(),
    unlocked: result.unlocked || [],
    scores
  };
}

/**
 * 上报一次游玩。**异步、静默失败** —— 上报挂了绝不能影响用户玩。
 * 服务端按 resultId 幂等，重复上报不会重复计数。
 *
 * @returns {Promise<{ok:boolean, duplicate?:boolean, offline?:boolean}>}
 */
function report(result) {
  const entry = extract(result);
  if (!entry || !entry.resultId) return Promise.resolve({ ok: false, error: 'NOTHING_TO_REPORT' });

  // 没登录（开发模式 / 登录失败）时跳过：账号记录需要 openid
  if (!storage.getToken()) return Promise.resolve({ ok: false, offline: true });

  return api
    .request('/api/play/record', { method: 'POST', data: entry, timeout: 8000 })
    .then((res) => {
      if (res.ok && res.body) {
        analytics.report(analytics.REPORTABLE.PLAY_REPORT, {
          ok: 1,
          dup: res.body.duplicate ? 1 : 0
        });
        return { ok: true, duplicate: !!res.body.duplicate, stats: res.body.stats };
      }
      // 失败就失败，本地那份还在，下次可以再同步
      return { ok: false, offline: res.status === 0, error: res.reason };
    })
    .catch(() => ({ ok: false, error: 'REPORT_FAILED' }));
}

/** 把服务端记录合并进本地（换设备恢复、或补回没上报成功的那些） */
function mergeRemote(remote) {
  if (!remote || !remote.ok) return { ok: false };
  const codex = storage.mergeCodex(remote.codex);
  const history = storage.mergeHistory(remote.history);
  return {
    ok: true,
    codexAdded: codex.added,
    codexTotal: codex.total,
    historyTotal: history.total,
    stats: remote.stats || null
  };
}

/**
 * 同步：拉服务端的游玩记录并合并到本地。
 * 幂等，可以随便多调（比如每次进"我的"页面）。
 */
function sync() {
  if (!storage.getToken()) return Promise.resolve({ ok: false, offline: true });
  return api
    .request('/api/play', { timeout: 8000 })
    .then((res) => {
      if (!res.ok || !res.body) return { ok: false, error: res.reason };
      const merged = mergeRemote(res.body);
      // 服务端只存角色 id，名字用本地角色表补齐（避免版本漂移渲染出空白）
      hydrateHistoryNames();
      analytics.report(analytics.REPORTABLE.PLAY_SYNC, {
        codexAdded: merged.codexAdded || 0,
        codexTotal: merged.codexTotal || 0
      });
      return merged;
    })
    .catch(() => ({ ok: false, error: 'SYNC_FAILED' }));
}

/** 把本机历史里缺失的角色名补齐（服务端只存了角色 id） */
function hydrateHistoryNames() {
  const list = storage.getHistory();
  let changed = false;
  const next = list.map((row) => {
    if (row.mainName) return row;
    const c = CHARACTER_MAP[row.mainId];
    if (!c) return row;
    changed = true;
    return Object.assign({}, row, { mainName: c.name, mainWork: c.work });
  });
  if (changed) storage.setHistory ? storage.setHistory(next) : null;
  return changed;
}

/** 清空账号里的游玩记录（本机那份保留） */
function clearRemote() {
  if (!storage.getToken()) return Promise.resolve({ ok: false, offline: true });
  return api
    .request('/api/play/clear', { method: 'POST', timeout: 8000 })
    .then((res) => (res.ok ? { ok: true } : { ok: false, error: res.reason }))
    .catch(() => ({ ok: false, error: 'FAILED' }));
}

module.exports = { report, sync, mergeRemote, clearRemote, extract, hydrateHistoryNames };
