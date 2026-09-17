const { CONFIG } = require('./config/index.js');
const storage = require('./utils/storage.js');

App({
  globalData: {
    version: CONFIG.VERSION,
    /** 当前用户的命盘输入资料，null 表示还没填过 */
    profile: null,
    /** 本次占卜的临时结果，result 页读取后清理 */
    pendingResult: null,
    systemInfo: null
  },

  onLaunch() {
    this.globalData.profile = storage.getProfile();

    // 系统信息（后面接 canvas 星空、适配安全区都要用）
    try {
      this.globalData.systemInfo =
        wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      this.globalData.systemInfo = null;
    }

    // 数据版本迁移的挂载点：以后加字段时在这里按 storage.getDataVersion() 升级
    storage.migrate(CONFIG.VERSION);
  },

  /** 页面里改完资料后同步到全局 */
  setProfile(next) {
    this.globalData.profile = next;
    storage.setProfile(next);
  }
});
