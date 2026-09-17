const { CONFIG } = require('../config/index.js');

/**
 * 事件上报与日志。
 *
 * 两个渠道：
 *  1. `wx.reportEvent(eventId, data)`（基础库 2.14.4+）：上报到 MP 后台的"自定义分析"。
 *     ⚠️ eventId 必须先在 MP 后台「数据分析 → 自定义分析」里建好，否则上报会被丢弃。
 *     所以这里在没配置事件表时**静默跳过**，不会报错也不会刷日志。
 *  2. 本地环形日志：小游戏没有控制台，线上出问题时用户没法给你看日志。
 *     这里把关键路径和异常记在内存里，配合 `LogManager`（有的话）一起用，
 *     出问题时能通过"玩家反馈"把现场带出来。
 *
 * 埋点原则：只报"匿名行为"，不报任何个人信息。姓名、生辰一个字段都不上报。
 */

const REPORTABLE = {
  // 首页
  HOME_VIEW: 'home_view',
  MATCH_START: 'match_start',        // 点了开始匹配（走九题）
  DRAW_START: 'draw_start',          // 点了随机来一次
  // 流程
  QUIZ_DONE: 'quiz_done',            // 参数：answered 答了几题
  RESULT_VIEW: 'result_view',        // 参数：rarity 命格稀有度、main 角色 id、resonance 共振度
  LOCAL_FALLBACK: 'local_fallback',  // 参数：reason 降级原因（后端不可用/AI 跑偏）
  // 留存与收集
  CODEX_VIEW: 'codex_view',          // 参数：unlocked 已解锁数
  CODEX_UNLOCK: 'codex_unlock',      // 参数：added 本次新增、total 总数
  CHARACTER_VIEW: 'character_view',  // 参数：id
  // 准入（免费额度 / 广告券 / 畅玩卡）
  GATE_PASS: 'gate_pass',            // 参数：kind(free/ticket/pass)、via(direct/ad/pay)
  GATE_CANCELLED: 'gate_cancelled',  // 参数：reason

  // 变现
  PAY_START: 'pay_start',            // 参数：product 档位、price 价格（分）
  PAY_SUCCESS: 'pay_success',        // 参数：product、price、days、confirmed 后端是否已确认
  PAY_FAILED: 'pay_failed',          // 参数：product、stage 失败阶段、code 错误码
  PAY_UNSUPPORTED: 'pay_unsupported',// 参数：reason（DISABLED / PLATFORM_DENIED / API_MISSING）
  AD_SHOW: 'ad_show',
  AD_REWARDED: 'ad_rewarded',
  AD_FAILED: 'ad_failed',
  SHARE_CLICK: 'share_click',
  // 账号与登录态
  PLAY_REPORT: 'play_report',          // 参数：ok、dup（是否幂等命中）
  PLAY_SYNC: 'play_sync',              // 参数：codexAdded、codexTotal
  ACCOUNT_VIEW: 'account_view',        // 参数：loggedIn、devMode
  ACCOUNT_RELOGIN: 'account_relogin',  // 参数：ok、blocked
  ACCOUNT_SESSION_CHECK: 'account_session_check', // 参数：valid

  // 异常
  ERROR: 'js_error'
};

// 环形日志：只留最近若干条，避免内存增长
const MAX_LOGS = 120;
const logs = [];
let errorCount = 0;

function push(level, tag, detail) {
  const row = { t: Date.now(), level, tag, detail: detail === undefined ? '' : String(detail).slice(0, 300) };
  logs.push(row);
  if (logs.length > MAX_LOGS) logs.shift();
  if (level === 'error') errorCount += 1;
  writeLogManager(row);
  return row;
}

/** 上报一个事件。未在 MP 后台配置时会静默失败，不影响任何流程。 */
function report(eventId, data) {
  push('event', eventId, data ? JSON.stringify(data) : '');
  if (!CONFIG.ANALYTICS || !CONFIG.ANALYTICS.ENABLED) return false;
  if (typeof wx === 'undefined' || typeof wx.reportEvent !== 'function') return false;
  try {
    // 只上报白名单里的事件，避免代码里随手写的事件名污染分析表
    if (Object.keys(REPORTABLE).every((k) => REPORTABLE[k] !== eventId)) return false;
    wx.reportEvent(eventId, sanitize(data));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 参数做一层清洗，防止不小心把个人信息带上分析平台。
 * 这个产品天然会接触生辰，所以除了截断长度，还专门拦"像日期/手机号的数字串"。
 */
function sanitize(data) {
  const out = {};
  Object.keys(data || {}).forEach((k) => {
    const v = data[k];
    if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') {
      const s = v.slice(0, 24);
      // 6 位以上连续数字一律丢弃：生日 19980101、手机号、时间戳都长这样
      if (/\d{6,}/.test(s)) return;
      out[k] = s;
    }
  });
  return out;
}

function info(tag, detail) {
  return push('info', tag, detail);
}

function error(tag, err) {
  const detail = err && (err.stack || err.message) ? err.stack || err.message : err;
  // 打到控制台，开发者工具的 Console 里能看到
  if (typeof console !== 'undefined' && console.error) console.error(`[${tag}]`, detail);
  push('error', tag, detail);
  report(REPORTABLE.ERROR, { tag });
  return detail;
}

function recent(n) {
  return logs.slice(-(n || 30));
}

function stats() {
  return { total: logs.length, errors: errorCount };
}

/**
 * 接 LogManager（可选，基础库 2.1.0+）。
 * 开通后日志会出现在 MP 后台的"玩家反馈"里，线上定位问题非常有用。
 * 未开通 / 不支持时静默忽略。
 *
 * 注意：LogManager 只是"顺手一起写"，不能让它影响主流程 ——
 * 所以整段都在 try 里，且只在 report/error 时附带写一条。
 */
let logManager = null;

function setupLogManager() {
  try {
    if (logManager) return true;
    if (typeof wx === 'undefined' || typeof wx.getLogManager !== 'function') return false;
    const lm = wx.getLogManager({ level: 1 });
    if (!lm || typeof lm.log !== 'function') return false;
    logManager = lm;
    info('analytics', 'LogManager 已接入');
    return true;
  } catch (e) {
    return false;
  }
}

/** 把一条日志同时写进 LogManager（如果接了的话） */
function writeLogManager(row) {
  if (!logManager) return;
  try {
    logManager.log(`[${row.level}] ${row.tag} ${row.detail}`);
  } catch (e) {
    /* 忽略：日志写失败绝不能影响游戏 */
  }
}

module.exports = { REPORTABLE, report, info, error, recent, stats, setupLogManager, push };
