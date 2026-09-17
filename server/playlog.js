const { CONFIG } = require('./config.js');

/**
 * 游戏账号的游玩记录。
 *
 * ⚠️ 这里的数据边界是这个模块最重要的设计，别改：
 *
 *   **账号存"结果"，不存"生辰"。**
 *
 * 起因：干支四柱可以反推出生时刻（四柱 → 年月日时的映射是唯一确定的，
 * 枚举就能还原到小时）。所以只要把四柱落库，等于把用户的出生日期存到了服务端。
 * 因此这里**只记录**用户玩出了什么结果 —— 主推角色、共振度、稀有度、命途 —— 
 * 这些是"游戏记录"，即使泄露也推不回生日。
 *
 * 对应地，客户端也**不会**把 birthDate / birthTime / 四柱 / 八轴上报到这里。
 * 生辰资料永远只在本机（见 services/playlog.js 的说明）。
 */

const MAX_HISTORY = 50; // 每个账号保留多少次对局记录
const MAX_DEDUP = 200; // 幂等去重表的上限
const MAX_CODEX = 300; // 图鉴条目上限（角色库目前 60 个，留足余量）

function emptyPlay() {
  return {
    total: 0, // 累计匹配次数
    firstAt: 0, // 首次游玩时间
    lastAt: 0, // 最近一次游玩时间
    codex: {}, // { [角色id]: { firstAt, count, firstScore } }
    history: [], // 最近 MAX_HISTORY 次
    dedup: {} // { [resultId]: at } 幂等去重
  };
}

function playOf(user) {
  const u = user || {};
  if (!u.play || typeof u.play !== 'object') return emptyPlay();
  return Object.assign(emptyPlay(), u.play);
}

/** 给客户端展示的统计 */
function statsOf(p) {
  return {
    total: p.total || 0,
    firstAt: p.firstAt || 0,
    lastAt: p.lastAt || 0,
    codexCount: Object.keys(p.codex || {}).length
  };
}

/** 校验并裁剪上报内容。字段白名单是刻意的 —— 多进来的字段一律丢弃。 */
function sanitize(entry) {
  const e = entry || {};
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const int = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : 0);

  const unlocked = Array.isArray(e.unlocked)
    ? e.unlocked.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, 20)
    : [];
  const scores = {};
  if (e.scores && typeof e.scores === 'object') {
    Object.keys(e.scores)
      .slice(0, 20)
      .forEach((k) => {
        if (k.length <= 40) scores[k] = int(e.scores[k]);
      });
  }

  return {
    resultId: str(e.resultId, 24),
    mainId: str(e.mainId, 40),
    resonance: int(e.resonance),
    rarity: str(e.rarity, 12),
    dominantBadge: str(e.dominantBadge, 20),
    // 命途标签的 id 列表（不是名字，名字由服务端自己的数据表还原）
    fates: Array.isArray(e.fates) ? e.fates.filter((x) => typeof x === 'string' && x.length <= 30).slice(0, 5) : [],
    mode: str(e.mode, 10), // chart | draw
    at: int(e.at) || Date.now(),
    unlocked,
    scores
  };
}

/**
 * 记录一次游玩。**幂等**：同一个 resultId 重复上报不会重复计数
 * （客户端可能因为网络重试、或换设备后重新同步而重复上报）。
 *
 * @returns {{ ok:boolean, duplicate:boolean, stats:object }}
 */
function record(store, openid, rawEntry) {
  if (!openid) return { ok: false, error: 'NO_OWNER' };
  const entry = sanitize(rawEntry);
  const user = store.getUser(openid) || {};
  const p = playOf(user);

  if (entry.resultId && p.dedup[entry.resultId]) {
    return { ok: true, duplicate: true, stats: statsOf(p) };
  }
  if (entry.resultId) p.dedup[entry.resultId] = Date.now();

  const now = Date.now();
  p.total = (p.total || 0) + 1;
  if (!p.firstAt) p.firstAt = entry.at || now;
  p.lastAt = entry.at || now;

  // ---- 图鉴 ----
  // 同一角色多次遇到：计数累加，但"首次遇到时间"取更早的那个
  // （换设备同步时可能先上报晚的，之后又补上早的）
  entry.unlocked.forEach((id) => {
    const row = p.codex[id];
    if (!row) {
      p.codex[id] = { firstAt: entry.at || now, count: 1, firstScore: entry.scores[id] || 0 };
    } else {
      row.count = (row.count || 1) + 1;
      if (entry.at && (!row.firstAt || entry.at < row.firstAt)) row.firstAt = entry.at;
      if (!row.firstScore && entry.scores[id]) row.firstScore = entry.scores[id];
    }
  });

  // ---- 历史 ----
  if (entry.mainId) {
    p.history.unshift({
      resultId: entry.resultId,
      mainId: entry.mainId,
      resonance: entry.resonance,
      rarity: entry.rarity,
      dominantBadge: entry.dominantBadge,
      fates: entry.fates,
      mode: entry.mode,
      at: entry.at || now
    });
    if (p.history.length > MAX_HISTORY) p.history = p.history.slice(0, MAX_HISTORY);
  }

  // ---- 限额清理 ----
  const dedupKeys = Object.keys(p.dedup);
  if (dedupKeys.length > MAX_DEDUP) {
    dedupKeys
      .sort((a, b) => p.dedup[a] - p.dedup[b])
      .slice(0, dedupKeys.length - MAX_DEDUP)
      .forEach((k) => {
        delete p.dedup[k];
      });
  }
  const codexKeys = Object.keys(p.codex);
  if (codexKeys.length > MAX_CODEX) {
    codexKeys
      .sort((a, b) => (p.codex[a].firstAt || 0) - (p.codex[b].firstAt || 0))
      .slice(0, codexKeys.length - MAX_CODEX)
      .forEach((k) => {
        delete p.codex[k];
      });
  }

  user.play = p;
  store.setUser(openid, user);
  return { ok: true, duplicate: false, stats: statsOf(p) };
}

/** 拉取账号的游玩记录（给客户端做跨设备恢复） */
function pull(store, openid) {
  if (!openid) return { ok: false, error: 'NO_OWNER' };
  const user = store.getUser(openid) || {};
  const p = playOf(user);
  return {
    ok: true,
    stats: statsOf(p),
    codex: p.codex,
    history: p.history
  };
}

/** 清空游玩记录（账号注销 / 用户主动清空时用） */
function clear(store, openid) {
  if (!openid) return { ok: false, error: 'NO_OWNER' };
  const user = store.getUser(openid) || {};
  user.play = null;
  store.setUser(openid, user);
  return { ok: true };
}

module.exports = { record, pull, clear, playOf, statsOf, sanitize, MAX_HISTORY, emptyPlay };
