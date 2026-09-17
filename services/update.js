const { CONFIG } = require('../config/index.js');
const analytics = require('./analytics.js');

/**
 * 版本更新。
 *
 * 为什么必须做：小游戏的更新机制是「静默更新」——
 *   - 发布新版本后，最差要 **24 小时**才能下发到所有用户
 *   - 「启动时更新」只是**异步下载**新包，**下次冷启动才生效**
 * 也就是说，如果用户不主动重启，可能一直停留在旧版本。
 * 官方原话：「如果对于版本依赖高的游戏，建议始终开启检测更新 API」。
 *
 * 对我们尤其重要：
 *   - 我们会**改合规措辞**（敏感词替换），旧版本的用户还看着旧文案
 *   - 我们会**加/改角色**，旧版本的图鉴和结果会对不上
 *   - 后端接口如果换了契约，旧版本可能直接不可用
 *
 * 所以这里在新版本下载完成后弹一个原生弹窗（`wx.showModal` 而不是自绘弹窗：
 * 原生弹窗永远在最上层，而且即使 Canvas 渲染挂了也弹得出来）。
 */

let updateManager = null;

/** 是否可用（低版本没有这个 API） */
function isAvailable() {
  return typeof wx !== 'undefined' && typeof wx.getUpdateManager === 'function';
}

/**
 * 挂上更新检测。幂等，重复调用没有副作用。
 * @param {object} opts { autoApply: 是否自动重启（默认 false，问用户） }
 */
function setup(opts) {
  const o = opts || {};
  if (updateManager) return updateManager;
  if (!isAvailable()) return null;

  try {
    updateManager = wx.getUpdateManager();
  } catch (e) {
    analytics.info('update', 'getUpdateManager 不可用');
    return null;
  }

  updateManager.onCheckForUpdate((res) => {
    analytics.info('update', `check hasUpdate=${res && res.hasUpdate}`);
  });

  updateManager.onUpdateReady(() => {
    analytics.info('update', 'ready');
    if (o.autoApply) {
      updateManager.applyUpdate();
      return;
    }
    // 用原生弹窗：它不受 Canvas 渲染状态影响，而且层级最高
    try {
      wx.showModal({
        title: '发现新版本',
        content: '新版本的星象已经准备好，需要重启一下才能用上。',
        confirmText: '立即重启',
        cancelText: '稍后',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate();
          } else {
            analytics.info('update', 'user postponed');
          }
        },
        fail() {
          // 弹窗失败就直接应用，保证用户能拿到新版本
          updateManager.applyUpdate();
        }
      });
    } catch (e) {
      updateManager.applyUpdate();
    }
  });

  updateManager.onUpdateFailed(() => {
    analytics.info('update', 'failed');
    // 下载失败：提示用户手动重启会重新下载，别静默吞掉
    try {
      wx.showModal({
        title: '更新失败',
        content: '新版本下载失败，重启一下小游戏会重新下载。',
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (e) {
      /* 忽略 */
    }
  });

  return updateManager;
}

/** 主动应用更新（比如用户点了"检查更新"） */
function apply() {
  if (updateManager && updateManager.applyUpdate) {
    updateManager.applyUpdate();
    return true;
  }
  return false;
}

/** 版本号比较，用于需要"最低基础库"判断的地方（不要用字符串比大小） */
function compareVersion(v1, v2) {
  const a = String(v1 || '0').split('.');
  const b = String(v2 || '0').split('.');
  const len = Math.max(a.length, b.length);
  while (a.length < len) a.push('0');
  while (b.length < len) b.push('0');
  for (let i = 0; i < len; i += 1) {
    const n1 = parseInt(a[i], 10) || 0;
    const n2 = parseInt(b[i], 10) || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

/** 当前基础库版本（<= 2.20.1 要用旧接口拿） */
function sdkVersion() {
  try {
    if (wx.getAppBaseInfo) return wx.getAppBaseInfo().SDKVersion || '';
    const info = wx.getSystemInfoSync();
    return (info && info.SDKVersion) || '';
  } catch (e) {
    return '';
  }
}

/** 是否满足某个最低基础库要求 */
function supports(minVersion) {
  const v = sdkVersion();
  return v ? compareVersion(v, minVersion) >= 0 : false;
}

module.exports = { setup, apply, isAvailable, compareVersion, sdkVersion, supports, CONFIG_VERSION: CONFIG.VERSION };
