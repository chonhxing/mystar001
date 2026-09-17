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

module.exports = { showRewarded, isAvailable, unitOf };
