const { CONFIG } = require('../config/index.js');
const storage = require('../utils/storage.js');
const api = require('./api.js');
const analytics = require('./analytics.js');

/**
 * 账号与登录态。
 *
 * ⚠️ 先澄清一件事：**小游戏没有"注册 / 登录页"**。
 * 微信的登录是**静默**的 —— `wx.login()` 无 UI、无需授权，服务端拿 code 换 openid 就完成了。
 * 用户进入游戏时已经是"已登录"状态，不存在输账号密码这一步，也没有"登录按钮"该有的位置。
 *
 * 所以这个模块管的不是"怎么登录"，而是**登录态的健康**：
 *   - token 过期要能自动重新登录（否则用户会看到"我的畅玩卡突然没了"）
 *   - session_key 失效要让用户知道（它失效会导致**支付签名失败**）
 *   - 换设备后付费权益要能找回来
 *
 * 一条底线：**登录失败绝不影响玩游戏**。命盘是本机算的，登录只影响 AI 解读和付费。
 */

/** 从服务端拉账号状态（可选顺带校验 session_key） */
function fetchAccount(checkSession) {
  return api
    .request('/api/account' + (checkSession ? '?check=1' : ''), { timeout: 8000 })
    .then((res) => {
      if (res.ok && res.body) return res.body;
      if (res.status === 401) {
        return { ok: false, error: 'TOKEN_EXPIRED', message: '登录状态已过期' };
      }
      return {
        ok: false,
        error: res.reason || 'FAILED',
        message: res.message || '获取账号状态失败'
      };
    });
}

/**
 * 重新登录：重新 wx.login 拿 code → 换新 token + 新 session_key。
 * 幂等，任何时候怀疑登录态有问题都可以调。
 */
function relogin() {
  return api.relogin().then((r) => {
    if (r && r.ok) {
      analytics.info('account', 'relogin ok');
      return { ok: true, dev: !!(r && r.dev) };
    }
    analytics.info('account', `relogin failed: ${(r && r.error) || 'unknown'}`);
    return {
      ok: false,
      blocked: !!(r && r.blocked),
      error: (r && r.error) || 'RELOGIN_FAILED',
      message:
        r && r.blocked
          ? '当前微信账号暂时无法完成登录'
          : (r && r.message) || '重新登录失败'
    };
  });
}

/**
 * 重置登录凭证（session_key）。
 * ⚠️ 官方约束：重置后原凭证**立即失效**，且**不能续期**（继承原过期时间），
 * 还不允许频繁重置。所以这是"补救"手段，正常情况应该重新登录。
 */
function resetSession() {
  return api
    .request('/api/account/reset-session', { method: 'POST', timeout: 10000 })
    .then((res) => (res.ok ? res.body : { ok: false, message: res.message || '重置失败' }));
}

/** 本地侧看得到的东西（不联网） */
function localStatus() {
  const settings = storage.getSettings();
  return {
    hasToken: !!storage.getToken(),
    useAi: settings.useAi
  };
}

/**
 * 汇总一份给 UI 用的状态。失败不抛错，返回可展示的降级信息
 * —— 账号页宁可显示"暂时获取不到"，也不能白屏。
 *
 * @param {boolean} checkSession 是否顺带向平台校验 session_key（会多一次平台调用）
 */
function status(checkSession) {
  return fetchAccount(checkSession).then((remote) => {
    const local = localStatus();
    if (!remote.ok) {
      /**
       * ⚠️ 「连不上服务器」≠「登录已过期」，必须分开说。
       * 以前这里失败统一被页面显示成"登录已过期"，而真机上（127.0.0.1 指向手机自己）
       * 后端本来就不可达，用户就会以为账号坏了 —— 其实只是网络到不了。
       */
      const reason = api.reasonText ? api.reasonText(remote.error) : '';
      return {
        ok: false,
        online: false,
        error: remote.error,
        message: remote.message,
        local,
        loggedIn: local.hasToken,
        devMode: false,
        offline: true,
        reasonText: reason || remote.message || '连不上服务器',
        reasonHint: api.baseHint ? api.baseHint() : '',
        statusText: '连不上服务器',
        canRetry: true
      };
    }
    return Object.assign({ ok: true, online: true, local }, remote);
  });
}

/**
 * 确保登录态可用：本地没 token，或服务端说 token 过期，就重新登录。
 * 给"准备支付"这类对登录态敏感的操作调。
 */
function ensureUsable() {
  const local = localStatus();
  if (!local.hasToken) return relogin();
  return status(false).then((s) => {
    if (s.ok) return { ok: true };
    if (s.error === 'TOKEN_EXPIRED') return relogin();
    // 其它失败（网络问题等）不当成登录态问题，别把用户挡在门外
    return { ok: true, degraded: true };
  });
}

module.exports = { status, relogin, resetSession, ensureUsable, localStatus, fetchAccount };
