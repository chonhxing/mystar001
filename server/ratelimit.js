const { CONFIG } = require('./config.js');

/**
 * 限流。三把闸门，缺一不可 —— AI 调用是按量付费的，被人刷一夜是真金白银。
 *
 *   1. 每 IP 每分钟（内存计数）：挡脚本
 *   2. 每用户每天（落盘）：挡正常用户刷太多次
 *   3. 全站每天（落盘）：挡最坏情况的总账单
 *
 * 上生产建议再加一层 Redis 计数（多实例部署时内存计数会失真），
 * 换掉 hitIp 一个方法即可。
 */

const ipHits = new Map(); // ip -> { count, resetAt }

function hitIp(ip) {
  const now = Date.now();
  const row = ipHits.get(ip);
  if (!row || row.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + 60000 });
    return { ok: true, remaining: CONFIG.limits.perMinutePerIp - 1 };
  }
  row.count += 1;
  if (row.count > CONFIG.limits.perMinutePerIp) {
    return { ok: false, remaining: 0, retryAfterMs: row.resetAt - now };
  }
  return { ok: true, remaining: CONFIG.limits.perMinutePerIp - row.count };
}

// 定期清理，避免内存里堆 IP
setInterval(() => {
  const now = Date.now();
  ipHits.forEach((row, ip) => {
    if (row.resetAt < now) ipHits.delete(ip);
  });
}, 120000).unref();

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 检查并占用一次配额。
 * @returns {{ok:boolean, used?:number, limit?:number, reason?:string, retryAfterMs?:number}}
 */
function consume(store, owner, ip) {
  const ipRes = hitIp(ip || owner);
  if (!ipRes.ok) {
    return { ok: false, reason: 'TOO_FAST', retryAfterMs: ipRes.retryAfterMs };
  }

  const day = today();
  const used = store.getQuota(owner, day);
  if (used >= CONFIG.limits.dailyPerUser) {
    return { ok: false, reason: 'DAILY_USER_LIMIT', used, limit: CONFIG.limits.dailyPerUser };
  }
  if (store.globalToday(day) >= CONFIG.limits.dailyGlobal) {
    return { ok: false, reason: 'DAILY_GLOBAL_LIMIT', limit: CONFIG.limits.dailyGlobal };
  }

  const next = store.bumpQuota(owner, day);
  return { ok: true, used: next, limit: CONFIG.limits.dailyPerUser };
}

/** 读缓存时不消耗 AI 配额，但仍然要占用用户配额（防止无限刷） */
function consumeCached(store, owner, ip) {
  const ipRes = hitIp(ip || owner);
  if (!ipRes.ok) return { ok: false, reason: 'TOO_FAST', retryAfterMs: ipRes.retryAfterMs };
  const day = today();
  const next = store.bumpQuota(owner, day);
  return { ok: true, used: next, limit: CONFIG.limits.dailyPerUser };
}

module.exports = { consume, consumeCached, today, hitIp };
