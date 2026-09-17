/**
 * 分享。小游戏没有 <button open-type="share">，必须主动调 wx.shareAppMessage，
 * 并且用 wx.showShareMenu 把右上角菜单里的"转发"打开。
 *
 * ⚠️ 审核红线（运营规范 5.1 滥用分享行为）：不能"分享后给奖励"。
 *    所以这里只做分享入口，不返回任何奖励 —— 想激励就用激励视频广告。
 */

let lastShare = null;

/** 初始化：打开转发菜单 + 注册被动转发内容 */
function setup(getShareInfo) {
  try {
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    }
  } catch (e) {
    /* 老版本忽略 */
  }

  if (wx.onShareAppMessage) {
    wx.onShareAppMessage(() => {
      const info = (getShareInfo && getShareInfo()) || {};
      return buildCard(info, null);
    });
  }
}

function buildCard(info, canvas) {
  const card = {
    title: info.title || '我推的星运 · 看看你的命途像哪个角色',
    // ⚠️ 分享路径不带命盘数据：命盘种子含生辰，不该出现在别人的手机上
    query: '',
    imageUrl: ''
  };
  if (canvas && canvas.toTempFilePathSync) {
    try {
      // 转发卡片最佳比例 5:4
      card.imageUrl = canvas.toTempFilePathSync({ destWidth: 500, destHeight: 400 });
    } catch (e) {
      /* 生成失败就用默认图 */
    }
  }
  if (info.imageUrlId && info.imageUrl) {
    card.imageUrlId = info.imageUrlId;
    card.imageUrl = info.imageUrl;
  }
  return card;
}

/** 主动分享：把当前画布截一张图当转发卡片 */
function shareResult(info) {
  lastShare = info;
  try {
    wx.shareAppMessage(buildCard(info, info.canvas));
    return true;
  } catch (e) {
    return false;
  }
}

function lastShareInfo() {
  return lastShare;
}

module.exports = { setup, shareResult, buildCard, lastShareInfo };
