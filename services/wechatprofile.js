const storage = require('../utils/storage.js');

/**
 * 微信昵称头像。
 *
 * ## 先记住这条政策（决定了这里为什么这么写）
 *
 * **2022-10-25 之后，`wx.getUserInfo` / `wx.getUserProfile` / `open-type="getUserInfo"`
 * 拿到的都是匿名数据**：昵称固定为「微信用户」，头像固定为一张灰色默认图。
 * 官方给的替代方案是「头像昵称填写能力」——**由用户自己选**：
 *
 * | 端 | 正确做法 |
 * | --- | --- |
 * | 小程序 | `<button open-type="chooseAvatar">` + `<input type="nickname">` |
 * | 小游戏 | `wx.createUserInfoButton`（原生按钮，用户点它才给资料） |
 *
 * 小游戏**没有** `chooseAvatar` 的等价物（`wx.createChooseAvatarButton` 不存在，文档 404），
 * 所以只能走 `createUserInfoButton`。而它在新政策下有可能也返回匿名数据 ——
 * 所以这里**必须**检测匿名并如实反馈，而不是把一个灰色头像当成用户的头像画出去。
 *
 * ## 数据放在哪
 *
 * 只存**本机**（和生辰资料一个待遇），不上传：
 *  - 头像是用户提供的图片，传到我们自己服务器就等于"收集个人信息"，
 *    要写进隐私指引、要做文件存储、要处理删除请求 —— 为了一个装饰性的圆形头像不值。
 *  - 想同步到账号的话，见 config.ACCOUNT.UPLOAD_AVATAR 的说明。
 *
 * 小程序给的是**临时文件路径**（随时可能被系统清掉），所以要先 saveFile 再存。
 */

/** 匿名返回的昵称（官方固定值） */
const ANON_NICK = '微信用户';

/**
 * 匿名返回的头像里包含这段路径（灰色默认头像）。
 * 用"包含"而不是全等，是因为不同客户端会带不同的尺寸后缀（/132、/0）。
 */
const ANON_AVATAR_TAG = 'POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuW9nK1UicNIVZ7iaUJ1qw';

/**
 * 这份资料是不是匿名的（即"其实没拿到"）。
 *
 * 判断依据**只看头像**：
 *  - 头像是空 → 没东西可显示，算没拿到
 *  - 头像是官方那张灰色默认图 → 就是被收回后的匿名返回
 *
 * 刻意**不看昵称**：用户完全可以把自己叫「微信用户」，那是他的自由，
 * 不该因为名字撞上官方占位值就把他的真实头像丢掉。
 */
function isAnonymous(info) {
  const i = info || {};
  const avatar = String(i.avatarUrl || '');
  if (!avatar) return true;
  return avatar.indexOf(ANON_AVATAR_TAG) >= 0;
}

/** 本地存的微信资料（没有则返回 null） */
function get() {
  return storage.getWechatProfile();
}

function save(profile) {
  const p = profile || {};
  return storage.setWechatProfile({
    nickName: String(p.nickName || '').slice(0, 24),
    avatarUrl: String(p.avatarUrl || ''),
    at: Date.now(),
    source: p.source || ''
  });
}

function clear() {
  storage.setWechatProfile(null);
}

/**
 * 隐私授权。
 *
 * 微信要求：在收集用户信息前先让用户同意《用户隐私保护指引》。
 * 声明了"微信昵称头像"之后，平台会在这些 API 调用时校验授权状态，
 * 没同意就直接失败。所以调用前先走一遍。
 *
 * 低版本没有这些 API，直接放行（那时平台也还没强制）。
 * @returns {Promise<boolean>} 是否已授权
 */
function ensurePrivacy() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined') {
      resolve(true);
      return;
    }
    if (typeof wx.getPrivacySetting !== 'function') {
      resolve(true); // 老基础库没有隐私协议校验
      return;
    }
    try {
      wx.getPrivacySetting({
        success: (res) => {
          if (!res || !res.needAuthorization) {
            resolve(true);
            return;
          }
          if (typeof wx.requirePrivacyAuthorize !== 'function') {
            resolve(false); // 需要授权但没有授权接口：只能当失败，别硬调
            return;
          }
          wx.requirePrivacyAuthorize({
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(true) // 查不到就当不需要，别把功能卡死
      });
    } catch (e) {
      resolve(true);
    }
  });
}

/**
 * 小游戏专用：在指定位置放一个"用微信头像"的原生按钮，等用户点。
 *
 * ⚠️ 这是**原生控件**（画在所有 canvas 内容之上），所以：
 *  - 位置必须用 **CSS 像素**（设计稿坐标 × device.scale），不是设计稿坐标
 *  - 它**不随页面滚动**。所以只能放在固定不动的区域（我们放在账号页顶部那行），
 *    放进滚动区会出现"按钮留在原地、内容滚走了"的错位。
 *  - 用完必须销毁，否则它会一直挂在那儿吃掉点击。除了点完/超时会自动销毁，
 *    调用方在离开页面时也要 `cancel()`（用户可能没点就走了）。
 *
 * @param {object} rect { left, top, width, height } —— CSS 像素
 * @param {object} opts { timeoutMs, text }
 * @returns {{ promise: Promise<object>, cancel: Function }}
 */
function capture(rect, opts) {
  const o = opts || {};
  let btn = null;
  let timer = null;
  let settled = false;
  let resolveOut = null;

  const promise = new Promise((resolve) => {
    resolveOut = resolve;
  });

  const finish = (payload) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (btn) {
      // 先置空再销毁：销毁本身可能抛，不能因此漏掉 resolve
      const gone = btn;
      btn = null;
      try {
        gone.destroy();
      } catch (e) {
        /* 忽略 */
      }
    }
    resolveOut(payload);
  };

  if (typeof wx === 'undefined' || typeof wx.createUserInfoButton !== 'function') {
    finish({ ok: false, reason: 'UNSUPPORTED' });
    return { promise, cancel: () => finish({ ok: false, reason: 'CANCELLED' }) };
  }

  const h = Math.max(1, Math.round(rect.height || 44));
  try {
    btn = wx.createUserInfoButton({
      type: 'text',
      text: o.text || '用微信头像',
      style: {
        left: Math.round(rect.left || 0),
        top: Math.round(rect.top || 0),
        width: Math.round(rect.width || 200),
        height: h,
        backgroundColor: o.backgroundColor || '#1B1830',
        borderColor: o.borderColor || '#E8C7A',
        borderWidth: 1,
        borderRadius: Math.round(h / 2),
        color: o.color || '#E8C87A',
        textAlign: 'center',
        fontSize: 15,
        lineHeight: h
      },
      // 我们只要昵称头像，不需要 encryptedData/iv，也就不需要登录态
      withCredentials: false,
      lang: 'zh_CN'
    });
  } catch (e) {
    finish({ ok: false, reason: 'CREATE_FAILED' });
    return { promise, cancel: () => finish({ ok: false, reason: 'CANCELLED' }) };
  }

  if (!btn || typeof btn.onTap !== 'function') {
    finish({ ok: false, reason: 'CREATE_FAILED' });
    return { promise, cancel: () => finish({ ok: false, reason: 'CANCELLED' }) };
  }

  btn.onTap((res) => {
    const info = (res && res.userInfo) || null;
    if (!info) {
      finish({ ok: false, reason: 'DENIED' });
      return;
    }
    if (isAnonymous(info)) {
      // 拿到的是匿名数据：如实告诉调用方，别把灰色头像当成用户的头像存下来
      finish({ ok: false, reason: 'ANONYMOUS' });
      return;
    }
    finish({
      ok: true,
      profile: {
        nickName: info.nickName || '',
        avatarUrl: info.avatarUrl || '',
        source: 'minigame'
      }
    });
  });

  // 用户可能一直不点。超时后必须把原生按钮收掉，否则它会挡住下面的内容。
  timer = setTimeout(() => finish({ ok: false, reason: 'TIMEOUT' }), o.timeoutMs || 120000);

  return { promise, cancel: () => finish({ ok: false, reason: 'CANCELLED' }) };
}

module.exports = {
  ANON_NICK,
  ANON_AVATAR_TAG,
  isAnonymous,
  get,
  save,
  clear,
  ensurePrivacy,
  capture
};
