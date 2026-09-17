const { CONFIG } = require('../config/index.js');
const analytics = require('./analytics.js');

/**
 * 激励视频广告。这是小游戏最主要的变现位，也是唯一合规的"给奖励"方式
 * （分享给奖励属于运营规范 5.1 的滥用分享行为，会挨罚）。
 *
 * 设计上的几点考虑：
 *  1. 没配广告位 id 时**静默降级**：返回 false，业务侧当成"没有奖励"处理，
 *     绝不报错、绝不卡流程 —— 开发阶段和审核前都能正常跑。
 *  2. 广告实例复用（createRewardedVideoAd 只创建一次），重复创建会拿不到回调。
 *  3. 只有 isEnded === true 才算看完。中途关掉不给奖励，这是平台的硬规则。
 *  4. 一个广告位同一时间只能拉一次，加锁避免并发调用。
 */

const adCache = {};
let loading = false;

function unitOf(slot) {
  const units = CONFIG.ADS && CONFIG.ADS.UNITS;
  return (units && units[slot]) || '';
}

function isAvailable() {
  return !!(CONFIG.ADS && CONFIG.ADS.ENABLED && unitOf('divinate_again'));
}

function getAd(slot) {
  const unitId = unitOf(slot);
  if (!unitId) return null;
  if (adCache[unitId]) return adCache[unitId];
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) return null;
  try {
    const ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    adCache[unitId] = ad;
    return ad;
  } catch (e) {
    return null;
  }
}

/**
 * 展示激励视频。
 * @param {string} slot 广告位名（config.ADS.UNITS 里的键）
 * @returns {Promise<boolean>} 是否完整看完
 */
function showRewarded(slot) {
  const ad = getAd(slot || 'divinate_again');
  if (!ad) return Promise.resolve(false);
  if (loading) return Promise.resolve(false);
  loading = true;
  analytics.report(analytics.REPORTABLE.AD_SHOW, { slot: slot || 'divinate_again' });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      loading = false;
      ad.offClose(onClose);
      ad.offError(onError);
      resolve(v);
    };

    const onClose = (res) => {
      // isEnded 为 true 才是"看完"；老版本（< 2.1.0）没有这个字段时按看完处理
      const ended = res === undefined || res === null || res.isEnded === undefined ? true : !!res.isEnded;
      analytics.report(analytics.REPORTABLE.AD_REWARDED, { ended: ended ? 1 : 0 });
      finish(ended);
    };
    const onError = (err) => {
      analytics.report(analytics.REPORTABLE.AD_FAILED, { code: (err && err.errCode) || 0 });
      analytics.error('reward', (err && err.errMsg) || 'ad error');
      finish(false);
    };

    ad.onClose(onClose);
    ad.onError(onError);

    // show 失败时先 load 再 show，这是官方推荐的兜底流程
    ad.show().catch(() =>
      ad.load().then(() => ad.show()).catch(() => finish(false))
    );

    // 兜底超时：用户可能一直不关广告，但业务不能永远挂着
    setTimeout(() => finish(false), 120000);
  });
}

/**
 * 「看一次广告换一次解锁」的**完整策略**。
 *
 * ⚠️ 只能有这一处。以前解锁面板和充值页各写了一份，结果是：
 *   · 两边行为可能不一致（改了一边忘了另一边）
 *   · "广告位没配时直接发放"这个兜底被复制成两份，等于两处都在白送
 * 现在策略收敛在这里，调用方只管 UI（提示 + 发券 + 关面板）。
 *
 * @returns {Promise<{ok:boolean, granted:boolean, reason:string}>}
 *   reason: 'ad'                   真的看完广告了
 *           'AD_INCOMPLETE'        广告没看完
 *           'AD_NOT_OPEN_GRANTED'  广告位还没开放，按配置照发一次
 *           'AD_NOT_OPEN'          广告位还没开放，且配置成不发放
 */
function unlockByAd() {
  if (isAvailable()) {
    return showRewarded('divinate_again').then((ok) => ({
      ok: !!ok,
      granted: !!ok,
      reason: ok ? 'ad' : 'AD_INCOMPLETE'
    }));
  }
  analytics.report(analytics.REPORTABLE.AD_FAILED, { reason: 'UNAVAILABLE' });
  if (CONFIG.ADS.GRANT_WHEN_UNAVAILABLE === false) {
    return Promise.resolve({ ok: false, granted: false, reason: 'AD_NOT_OPEN' });
  }
  return Promise.resolve({ ok: true, granted: true, reason: 'AD_NOT_OPEN_GRANTED' });
}

// ============================================================ banner 广告

/**
 * banner 广告（常驻曝光位）。
 *
 * 和激励视频的区别：激励是"用户主动换奖励"，banner 是"页面常驻曝光"，
 * 两者不冲突。小游戏的 banner 是**原生控件**，浮在 canvas 之上：
 *  - 位置用 CSS 像素（设计稿坐标 × device.scale）
 *  - 不随页面滚动，所以只挂在固定不动的页面（首页底部导航上方）
 *  - 离开页面必须 hide，否则会盖在别的场景上
 *
 * 设计约束：广告**永远不能盖住可点内容**（平台红线），
 * 所以它的位置始终贴着底部导航上沿，不遮任何按钮。
 */

let bannerAd = null;
let bannerUnitId = '';

/** 换算：设计稿 y（750 宽）→ CSS 像素 */
function toCss(stage, designY) {
  if (!stage || !stage.dev) return 0;
  return Math.round((designY * stage.dev.cssWidth) / stage.width);
}

function bannerUnit() {
  return unitOf('banner_home');
}

/**
 * 按场景挂/摘 banner。
 * @param {string} sceneName 场景名（CONFIG.ADS.BANNER.SCENES 里配置的才展示）
 * @param {object} stage 舞台（拿屏幕尺寸）
 */
function mountBanner(sceneName, stage) {
  const cfg = CONFIG.ADS && CONFIG.ADS.BANNER;
  const unit = bannerUnit();
  const allowed = cfg && cfg.ENABLED && unit &&
    (cfg.SCENES || []).indexOf(sceneName) >= 0;

  if (!allowed) {
    hideBanner();
    return;
  }
  if (typeof wx === 'undefined' || typeof wx.createBannerAd !== 'function') return;
  if (bannerAd && bannerUnitId === unit) {
    bannerAd.show().catch(() => {});
    return;
  }

  try {
    bannerUnitId = unit;
    // 初始位置：底部导航上沿（导航高 108 设计稿 px）+ 再往上让出一点间隙
    const designY = stage.height - 108 - 8;
    bannerAd = wx.createBannerAd({
      adUnitId: unit,
      style: {
        left: 0,
        top: toCss(stage, designY),
        width: Math.round(stage.dev.cssWidth)
      }
    });
    bannerAd.onResize((size) => {
      // 拿到真实高度后再摆一次，确保底边正好贴着导航上沿
      const h = (size && size.height) || 60;
      const top = Math.max(0, stage.dev.cssHeight - toCss(stage, 108) - h - toCss(stage, 8));
      try {
        bannerAd.style.top = top;
        bannerAd.style.left = 0;
      } catch (e) { /* 老基础库不支持改 style，用初始位置 */ }
    });
    bannerAd.onError((err) => {
      // 没开通流量主 / 未配置时平台会报 1002 之类：静默销毁，别让游戏坏掉
      analytics.report(analytics.REPORTABLE.AD_FAILED, { slot: 'banner', code: (err && err.errCode) || 0 });
      bannerAd = null;
      bannerUnitId = '';
    });
    bannerAd.show().catch(() => {});
  } catch (e) {
    bannerAd = null;
    bannerUnitId = '';
  }
}

function hideBanner() {
  if (bannerAd) {
    try {
      bannerAd.hide();
    } catch (e) { /* 已销毁等场景，忽略 */ }
  }
}

function destroyBanner() {
  if (bannerAd) {
    try {
      bannerAd.destroy();
    } catch (e) { /* 忽略 */ }
    bannerAd = null;
    bannerUnitId = '';
  }
}

module.exports = { showRewarded, isAvailable, unlockByAd, unitOf, mountBanner, hideBanner, destroyBanner };
