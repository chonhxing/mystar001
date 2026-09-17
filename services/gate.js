const entitlement = require('./entitlement.js');
const analytics = require('./analytics.js');

/**
 * 占卜准入。**每次占卜前都必须走这里**，它是唯一决定"能不能占"的地方。
 *
 * 顺序：免费额度 → 畅玩卡 → 广告券 → 弹解锁面板（看广告 / 买卡）。
 * 判定和消耗分开是有意的：先 check() 拿到 kind，真正要开始时才 consume(kind)，
 * 这样用户点了"以后再说"不会白白扣掉一次额度。
 */

/**
 * @param {object} scene 用来弹解锁面板（需要 scene.overlay / scene.toast）
 * @returns {Promise<{ok:boolean, kind?:string, via?:string, reason?:string, freeLeft?:number}>}
 */
function requestAccess(scene) {
  const st = entitlement.check();
  if (st.ok) {
    entitlement.consume(st.kind);
    reportGranted(st.kind, 'direct');
    return Promise.resolve({
      ok: true,
      kind: st.kind,
      via: 'direct',
      freeLeft: entitlement.freeLeft(),
      passRemainMs: entitlement.passRemainMs()
    });
  }

  // 需要解锁。把面板加载放在 require 里，避免 gate → unlock → gate 的循环依赖
  const { showUnlock } = require('../src/js/ui/unlock.js');
  return showUnlock(scene).then((r) => {
    if (!r || !r.ok) {
      analytics.report(analytics.REPORTABLE.GATE_CANCELLED, { reason: (r && r.reason) || 'UNKNOWN' });
      return { ok: false, reason: (r && r.reason) || 'CANCELLED' };
    }
    // 解锁后必须**重新判定**：看广告是发券、买卡是设到期时间，
    // 两者最终都要回到 check() 这一套逻辑上，避免各写一份导致状态不一致。
    const st2 = entitlement.check();
    if (!st2.ok) {
      // 理论上不该发生（解锁动作一定会让 check 通过），留着兜底并上报
      analytics.error('gate', `解锁后仍然不通过 kind=${st2.kind} via=${r.via}`);
      return { ok: false, reason: 'STILL_LOCKED' };
    }
    entitlement.consume(st2.kind);
    reportGranted(st2.kind, r.via || 'unlock');
    return {
      ok: true,
      kind: st2.kind,
      via: r.via || 'unlock',
      freeLeft: entitlement.freeLeft(),
      passRemainMs: entitlement.passRemainMs()
    };
  });
}

function reportGranted(kind, via) {
  analytics.report(analytics.REPORTABLE.GATE_PASS, { kind, via });
}

/** 给 UI 显示用的状态文案（首页那行"还剩几次"） */
function statusLine() {
  return entitlement.summary().statusText;
}

/** 是否处于"免费期"（用来决定首页要不要显示解锁入口的提示） */
function needsUnlock() {
  return !entitlement.check().ok;
}

module.exports = { requestAccess, statusLine, needsUnlock };
