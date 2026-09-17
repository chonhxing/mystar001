const draw = require('./draw.js');
const textUtil = require('./text.js');
const { COLOR, RARITY_STYLE, FONT, font, TXT } = require('./theme.js');
const copy = require('../../config/copy.js');

/**
 * 结果海报：把一次匹配画成一张可以保存/发朋友圈的图。
 *
 * 为什么要专门画一张，而不是直接截屏：
 *  1. 结果页是**竖着滚的**，截屏只能拿到一屏，"分享出去"看不懂；
 *  2. 截图里带着别的按钮、底部导航、"去图鉴"，像一张 App 截图而不像一张作品；
 *  3. 海报可以只放最能传播的三件事：角色、共振度、一句命途。
 *
 * ⚠️ 合规：海报上**只放本机算法算出来的内容**（角色名 + 共振度 + 轴名），
 *    不放 AI 生成的那段解读文案 —— 那样就得按《人工智能生成合成内容标识办法》
 *    在图片上也带标识。宁可少放一句，也不留一个说不清的合规尾巴。
 *    底部固定一句"仅供娱乐"。
 */

const W = 750;
const H = 1000;

/** 离屏画布。第二次之后的 wx.createCanvas() 才是离屏（第一次是上屏画布） */
function createOffscreen() {
  if (typeof wx === 'undefined' || !wx.createCanvas) return null;
  try {
    const c = wx.createCanvas();
    if (!c || typeof c.getContext !== 'function') return null;
    return c;
  } catch (e) {
    return null;
  }
}

/**
 * 把海报画到 ctx 上。抽出来是为了**测试能直接调它**：
 * 真机上的 createCanvas / toTempFilePath 在 node 里没有，但画的部分必须能验。
 */
function paint(ctx, data) {
  const d = data || {};
  const char = d.char || { name: '?', work: '', id: 'x' };
  const style = RARITY_STYLE[d.rarityKey] || RARITY_STYLE.common;

  ctx.clearRect(0, 0, W, H);

  // ---- 底：深空 + 星云 + 星点 + 星座连线 ----
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLOR.bg);
  g.addColorStop(0.5, '#100D26');
  g.addColorStop(1, COLOR.bgDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  draw.radialGlow(ctx, W * 0.2, H * 0.1, W * 0.9, d.rarityKey === 'legend' ? 'rgba(232,200,122,0.26)' : 'rgba(139,108,240,0.26)', 1);
  draw.radialGlow(ctx, W * 0.85, H * 0.72, W * 0.8, 'rgba(99,215,232,0.14)', 1);
  draw.starfield(ctx, W, H, 0, 21);
  draw.constellation(ctx, 40, 60, W - 80, H * 0.42, 9, 0.12, 6);

  // ---- 顶：品牌 ----
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(FONT.small, '600');
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(copy.BRAND.NAME, 48, 66);
  ctx.font = font(FONT.micro);
  ctx.fillStyle = TXT.faint;
  ctx.fillText('命途图谱 · 角色匹配', 48, 100);

  // ---- 徽记 ----
  const cx = W / 2;
  const emblemR = 132;
  const cy = 320;
  draw.radialGlow(ctx, cx, cy, emblemR * 2.1, style.color, 0.16);
  ctx.save();
  ctx.globalAlpha = 0.9;
  draw.emblem(ctx, cx, cy, emblemR, d.seed || 0, style.color);
  ctx.restore();
  ctx.font = font(emblemR * 0.95, '700');
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.textAlign = 'center';
  ctx.fillText(String(char.name || '?').slice(0, 1), cx, cy + 4);

  // ---- 稀有度（印章感胶囊） ----
  const stars = (RARITY_STYLE[d.rarityKey] && d.stars) || 0;
  const rarityLabel = style.label || '';
  const rw = Math.round(textUtil.measure(rarityLabel, font(FONT.tiny))) + 44;
  const ry = 508;
  draw.fillRoundRect(ctx, cx - rw / 2, ry, rw, 46, 23, 'rgba(232,200,122,0.12)');
  draw.strokeRoundRect(ctx, cx - rw / 2, ry, rw, 46, 23, style.color, 1.2);
  ctx.font = font(FONT.tiny, '600');
  ctx.fillStyle = style.color;
  ctx.fillText(rarityLabel, cx, ry + 24);
  if (stars > 0) {
    const sw = draw.starsRow(ctx, 0, 0, 9, stars, 5, 22);
    draw.starsRow(ctx, cx - sw / 2 + 1, ry + 76, 9, stars, 5, 22);
  }

  // ---- 角色名 + 作品 ----
  ctx.font = font(FONT.h1, '700');
  ctx.fillStyle = TXT.title;
  ctx.fillText(textUtil.singleLine(char.name || '', W - 96, font(FONT.h1, '700')), cx, 640);
  ctx.font = font(FONT.small);
  ctx.fillStyle = TXT.aux;
  ctx.fillText(
    textUtil.singleLine(`《${char.work || ''}》· ${char.medium || ''}`, W - 96, font(FONT.small)),
    cx,
    698
  );

  // ---- 共振度：整张图的主角 ----
  const resonance = Math.max(0, Math.min(100, Math.round(d.resonance || 0)));
  ctx.font = font(FONT.micro);
  ctx.fillStyle = TXT.aux;
  ctx.fillText('与你共振', cx, 762);
  ctx.font = font(FONT.big, '700');
  ctx.fillStyle = COLOR.gold;
  ctx.fillText(`${resonance}%`, cx, 818);
  draw.flowBar(ctx, 120, 866, W - 240, 10, resonance / 100, 0, { flow: false });

  // ---- 一句命途 ----
  if (d.axisName) {
    ctx.font = font(FONT.body);
    ctx.fillStyle = TXT.sub;
    ctx.fillText(`最突出的一轴：${d.axisName}`, cx, 916);
  }

  // ---- 底：合规 + 落款 ----
  draw.hairline(ctx, 120, 950, W - 120, 'rgba(255,255,255,0.10)');
  ctx.font = font(FONT.micro);
  ctx.fillStyle = TXT.faint;
  ctx.fillText('仅供娱乐 · 生辰只存在你的手机上', cx, 976);
  ctx.textAlign = 'left';
  return true;
}

/** 导出成临时文件（小游戏是 canvas.toTempFilePath，小程序才是 wx.canvasToTempFilePath） */
function toTempFile(canvas, destWidth) {
  return new Promise((resolve) => {
    const done = (res) => resolve((res && (res.tempFilePath || res.filePath)) || '');
    const fail = () => resolve('');
    const opt = {
      x: 0,
      y: 0,
      width: W,
      height: H,
      destWidth: destWidth || W * 2,
      destHeight: (destWidth || W * 2) * (H / W),
      fileType: 'png',
      success: done,
      fail
    };
    try {
      if (canvas && typeof canvas.toTempFilePath === 'function') {
        canvas.toTempFilePath(Object.assign({ canvas }, opt));
        return;
      }
      if (typeof wx !== 'undefined' && wx.canvasToTempFilePath) {
        wx.canvasToTempFilePath(Object.assign({ canvas }, opt));
        return;
      }
    } catch (e) {
      /* 落到下面的空路径 */
    }
    resolve('');
  });
}

/** 存进相册。区分"用户拒绝过"和"真失败了"，因为这两件事的下一步不一样 */
function saveToAlbum(filePath) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.saveImageToPhotosAlbum) {
      resolve({ ok: false, reason: 'UNSUPPORTED' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve({ ok: true }),
      fail: (err) => {
        const msg = String((err && (err.errMsg || err.errmsg)) || '');
        if (/auth|authorize|deny|denied|permission/i.test(msg)) {
          resolve({ ok: false, reason: 'DENIED', message: msg });
          return;
        }
        resolve({ ok: false, reason: 'FAIL', message: msg });
      }
    });
  });
}

/**
 * 生成并保存结果海报。
 * @returns {Promise<{ok:boolean, reason?:string, filePath?:string}>}
 *   reason: UNSUPPORTED（环境不支持）/ PAINT（画不出来）/ EXPORT（导不出图）/ DENIED / FAIL
 */
function saveResult(data) {
  const canvas = createOffscreen();
  if (!canvas) return Promise.resolve({ ok: false, reason: 'UNSUPPORTED' });
  try {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve({ ok: false, reason: 'UNSUPPORTED' });
    paint(ctx, data);
  } catch (e) {
    return Promise.resolve({ ok: false, reason: 'PAINT', message: e.message });
  }
  return toTempFile(canvas).then((filePath) => {
    if (!filePath) return { ok: false, reason: 'EXPORT' };
    return saveToAlbum(filePath).then((r) => Object.assign({ filePath }, r));
  });
}

module.exports = { saveResult, paint, W, H };
