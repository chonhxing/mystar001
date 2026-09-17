const { CONFIG } = require('../config/index.js');
const storage = require('../utils/storage.js');

/**
 * 使用权益。这是"能不能占卜"的唯一裁判，付费和广告都只是给它发券。
 *
 * 三层结构，按优先级判定：
 *   1. 畅玩卡（付费买来的时长）—— 有效期内不限次，**不消耗任何东西**
 *   2. 免费额度（默认 2 次）—— 一次性，用完不再有
 *   3. 广告解锁券 —— 看一次广告换一次，用一次少一张
 *
 * 为什么把"卡"放在最前面：用户花了钱，如果还去扣他的免费次数或广告券，
 * 是明显的体验 bug（也是退款投诉的常见来源）。
 *
 * ⚠️ 时间口径：畅玩卡按"绝对时间戳"存，不是"剩余毫秒"。
 *    否则用户杀掉进程、系统时间变化都会让剩余时长失真。
 */

function now() {
  return Date.now();
}

const DAY_MS = 24 * 3600 * 1000;

function readState() {
  const raw = storage.getEntitlement();
  // ⚠️ 必须保留**全部**字段。之前这里只挑了 4 个字段返回，
  //    把 grantedOrders（已发货订单号）丢了，导致幂等判断永远为"首次"——
  //    平台的重复发货推送会被重复发放时长。这是个真实的资金 bug。
  return Object.assign({}, raw, {
    freeUsed: Math.max(0, Number(raw.freeUsed) || 0),
    adTickets: Math.max(0, Number(raw.adTickets) || 0),
    passExpireAt: Math.max(0, Number(raw.passExpireAt) || 0),
    totalUsed: Math.max(0, Number(raw.totalUsed) || 0),
    grantedOrders:
      raw.grantedOrders && typeof raw.grantedOrders === 'object' ? raw.grantedOrders : {}
  });
}

function writeState(next) {
  storage.setEntitlement(next);
  return next;
}

/** 免费额度还剩几次 */
function freeLeft() {
  return Math.max(0, CONFIG.PAY.FREE_COUNT - readState().freeUsed);
}

/** 畅玩卡还剩多久（毫秒），没有卡返回 0 */
function passRemainMs() {
  return Math.max(0, readState().passExpireAt - now());
}

/** 畅玩卡是否有效 */
function hasPass() {
  return passRemainMs() > 0;
}

/**
 * 当前能不能占卜。
 * @returns {{ok:boolean, kind:'pass'|'free'|'ticket'|'locked', ...}}
 */
function check() {
  const st = readState();
  const remain = st.passExpireAt - now();

  if (remain > 0) {
    return { ok: true, kind: 'pass', passRemainMs: remain, passDays: Math.ceil(remain / DAY_MS) };
  }
  if (st.freeUsed < CONFIG.PAY.FREE_COUNT) {
    return {
      ok: true,
      kind: 'free',
      freeLeft: CONFIG.PAY.FREE_COUNT - st.freeUsed,
      freeTotal: CONFIG.PAY.FREE_COUNT
    };
  }
  if (st.adTickets > 0) {
    return { ok: true, kind: 'ticket', tickets: st.adTickets };
  }
  return {
    ok: false,
    kind: 'locked',
    freeLeft: 0,
    freeTotal: CONFIG.PAY.FREE_COUNT,
    tickets: 0,
    passExpireAt: 0
  };
}

/**
 * 消耗一次使用权。**必须在占卜成功发起前调用**，并且只调用一次。
 * @param {string} kind check() 返回的 kind
 */
function consume(kind) {
  const st = readState();
  st.totalUsed += 1;
  if (kind === 'free') st.freeUsed += 1;
  else if (kind === 'ticket') st.adTickets = Math.max(0, st.adTickets - 1);
  // pass 不消耗：有效期内随便用
  return writeState(st);
}

/**
 * 发广告解锁券（看完激励视频后调用）。
 * 券是可叠加的（用户可能连看几次先囤着）。
 */
function grantTickets(n) {
  const st = readState();
  st.adTickets += Math.max(1, Number(n) || 1);
  return writeState(st);
}

/**
 * 发畅玩卡（支付成功后调用）。
 * 已有卡：从**到期时间**往后叠加（不吞掉用户已买的时长）。
 * 没卡：从现在算起。
 */
function grantPass(days) {
  const d = Math.max(1, Number(days) || 1);
  const st = readState();
  const base = Math.max(now(), st.passExpireAt);
  st.passExpireAt = base + d * DAY_MS;
  return writeState(st);
}

/**
 * 幂等地发放"某笔订单"的权益。
 * 支付回调可能重复推送（官方文档明确说了会重试），所以必须去重。
 * @returns {boolean} true = 本次真的发了，false = 之前已经发过
 */
function grantPassOnce(orderNo, days) {
  const st = readState();
  st.grantedOrders = st.grantedOrders || {};
  if (st.grantedOrders[orderNo]) return false;
  st.grantedOrders[orderNo] = now();
  // 只留最近 50 笔，避免 storage 无限增长
  const keys = Object.keys(st.grantedOrders);
  if (keys.length > 50) {
    keys
      .sort((a, b) => st.grantedOrders[a] - st.grantedOrders[b])
      .slice(0, keys.length - 50)
      .forEach((k) => {
        delete st.grantedOrders[k];
      });
  }
  const base = Math.max(now(), st.passExpireAt);
  st.passExpireAt = base + Math.max(1, Number(days) || 1) * DAY_MS;
  writeState(st);
  return true;
}

/**
 * 直接把到期时间设成某个绝对时间戳（服务端同步用）。
 * 只在**晚于**当前记录时才生效，避免一侧记录滞后把用户的时长吃掉。
 */
function grantPassUntil(expireAt) {
  const st = readState();
  const target = Math.max(0, Number(expireAt) || 0);
  if (target <= st.passExpireAt) return st;
  st.passExpireAt = target;
  return writeState(st);
}

/** UI 用的完整摘要（一次读完，避免界面各处分别读 storage） */
function summary() {
  const st = readState();
  const c = check();
  const remain = passRemainMs();
  return {
    ok: c.ok,
    kind: c.kind,
    freeLeft: freeLeft(),
    freeTotal: CONFIG.PAY.FREE_COUNT,
    tickets: st.adTickets,
    hasPass: remain > 0,
    passDays: remain > 0 ? Math.ceil(remain / DAY_MS) : 0,
    passExpireAt: st.passExpireAt,
    totalUsed: st.totalUsed,
    // 给文案用的人话
    statusText:
      remain > 0
        ? `畅玩卡剩余 ${Math.ceil(remain / DAY_MS)} 天`
        : freeLeft() > 0
        ? `免费次数还剩 ${freeLeft()} 次`
        : st.adTickets > 0
        ? `有 ${st.adTickets} 次解锁券`
        : '免费次数已用完'
  };
}

/** 仅供测试与"重置"入口使用 */
function reset() {
  return writeState({ freeUsed: 0, adTickets: 0, passExpireAt: 0, totalUsed: 0, grantedOrders: {} });
}

module.exports = {
  check,
  consume,
  grantTickets,
  grantPass,
  grantPassOnce,
  grantPassUntil,
  freeLeft,
  hasPass,
  passRemainMs,
  summary,
  reset,
  readState,
  DAY_MS
};
