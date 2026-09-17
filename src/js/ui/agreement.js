/**
 * 协议弹窗与隐私授权弹窗。
 *
 * 三个合规要件都在这一个文件里：
 *   1. **首次启动的用户协议弹窗**（AgreementSheet，gate 模式）：没同意过就挡在首屏前，
 *      同意状态持久化；不同意可以点退出，也可以再想想。
 *   2. **设置页的回看入口**（AgreementSheet，read 模式）：提审要求
 *      "应用内可以随时访问协议全文"，所以两份全文都能滚着看。
 *   3. **隐私授权弹窗**（PrivacySheet）：wx.onNeedPrivacyAuthorization 触发时
 *      由 services/privacy.js 调起，用户点「同意/拒绝」时调 resolve ——
 *      官方要求 resolve 必须挂在用户点击上，且必须在 10 秒内响应。
 *
 * 几何尺寸在构造时就定死（屏幕尺寸在启动时已知），这样 onTap / onDrag /
 * drawSelf 三处用的是同一套坐标，不会出现"先画后布局"的错位。
 */

const { Widget } = require('./widget.js');
const { COLOR, FONT, RADIUS, font } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const privacy = require('../../../services/privacy.js');
const agreement = require('../../../services/agreement.js');
const haptics = require('../../../services/haptics.js');

const MASK = 'rgba(6,5,18,0.78)';
const CARD_BG = '#15122E';

/** 弹窗底板：遮罩 + 圆角卡片。事件全部吞掉，点哪里由子类决定。 */
class Sheet extends Widget {
  constructor(opts) {
    super(Object.assign({ x: 0, y: 0, tapEnabled: true }, opts));
    this.title = String(opts.title || '');
  }

  hitTest() {
    return this.visible ? this : null;
  }
}

/**
 * 协议弹窗。
 * @param {object} o { w, h, mode: 'gate'|'read', onAgree, onClose }
 */
class AgreementSheet extends Sheet {
  constructor(opts) {
    super(Object.assign({ title: copy.UI.agreementTitle }, opts));
    const o = opts || {};
    this.mode = o.mode || 'gate';
    this.onAgree = o.onAgree || null;
    this.onClose = o.onClose || null;
    this.tab = 0; // 0 = 用户协议，1 = 隐私政策
    this.checked = false;
    this.scrollY = 0;
    this.dragStart = null;

    // ---- 几何（构造时定死）----
    const W = o.w || 750;
    const H = o.h || 1334;
    this.cardW = Math.min(640, W - 64);
    this.cardX = Math.round((W - this.cardW) / 2);
    const top = o.top || 44;
    this.cardY = top;
    const bottom = o.bottom || 52;
    this.cardH = H - top - bottom;
    const pad = 32;
    this.vp = {
      x: this.cardX + pad,
      y: this.cardY + 112, // 标题 + 页签
      w: this.cardW - pad * 2,
      // gate 底部：勾选 + 两个按钮 + 退出链接；read 底部：提示 + 关闭按钮
      h: this.cardH - 112 - (this.mode === 'gate' ? 208 : 190)
    };
  }

  currentText() {
    return this.tab === 0 ? copy.LEGAL.userAgreement : copy.LEGAL.privacyPolicy;
  }

  textLayout() {
    return text.layoutParagraph({
      text: this.currentText(),
      font: font(FONT.small),
      size: FONT.small,
      lineHeight: Math.round(FONT.small * 1.9),
      maxWidth: this.vp.w
    });
  }

  maxScroll() {
    return Math.max(0, this.textLayout().height - this.vp.h + 24);
  }

  /** 矩形命中（局部坐标系） */
  inRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }

  onTap(x, y) {
    const cx = this.cardX;
    const cy = this.cardY;
    const cw = this.cardW;
    // 卡片外：gate 模式无响应（协议不能点遮罩跳过）；read 模式点遮罩关闭
    if (!this.inRect(x, y, cx, cy, cw, this.cardH)) {
      if (this.mode === 'read' && this.onClose) this.onClose();
      return;
    }
    // 页签
    if (this.inRect(x, y, cx + 24, cy + 68, cw - 48, 44)) {
      const half = cx + cw / 2;
      this.tab = x < half ? 0 : 1;
      this.scrollY = 0;
      this.dirty();
      return;
    }
    const bottom = cy + this.cardH;
    if (this.mode === 'gate') {
      // 退出游戏（左下小字）
      if (this.inRect(x, y, cx + 32, bottom - 98, 140, 30)) {
        this.tryExit();
        return;
      }
      // 勾选框（点击整行都算）
      if (this.inRect(x, y, cx + 32, bottom - 124, cw - 120, 40)) {
        this.checked = !this.checked;
        haptics.tap();
        this.dirty();
        return;
      }
      // 同意 / 不同意
      const btnW = (cw - 72) / 2;
      if (this.inRect(x, y, cx + 24, bottom - 108, btnW * 2 + 24, 80)) {
        const mid = cx + 24 + btnW + 12;
        if (x > mid) {
          if (!this.checked) return; // 没勾选：按钮是暗的，不响应
          haptics.tap();
          if (this.onAgree) this.onAgree();
        } else {
          haptics.tap();
          if (this.onClose) this.onClose();
        }
      }
      return;
    }
    // read 模式：关闭按钮
    if (this.inRect(x, y, cx + (cw - 200) / 2, bottom - 88, 200, 60)) {
      haptics.tap();
      if (this.onClose) this.onClose();
    }
  }

  tryExit() {
    try {
      if (typeof wx !== 'undefined' && typeof wx.exitMiniProgram === 'function') {
        wx.exitMiniProgram({});
      }
    } catch (e) {
      /* 开发者工具里没有退出，忽略 */
    }
  }

  onDragStart() {
    this.dragStart = this.scrollY;
  }

  onDrag(x, y, extra) {
    if (this.dragStart === null) return;
    // ⚠️ 方向与滚动容器一致：手指上滑内容上移 = scrollY 增大
    const dy = (extra && extra.dy) || 0;
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.dragStart - dy));
    this.dirty();
  }

  onDragEnd() {
    this.dragStart = null;
  }

  drawSelf(ctx) {
    ctx.save();
    ctx.fillStyle = MASK;
    ctx.fillRect(0, 0, this.w, this.h);

    const cx = this.cardX;
    const cy = this.cardY;
    const cw = this.cardW;
    const ch = this.cardH;
    const vp = this.vp;

    draw.fillRoundRect(ctx, cx, cy, cw, ch, RADIUS.xl, CARD_BG);
    draw.strokeRoundRect(ctx, cx, cy, cw, ch, RADIUS.xl, COLOR.line, 1);

    // 标题
    ctx.font = font(FONT.h3, '600');
    ctx.fillStyle = COLOR.gold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, cx + cw / 2, cy + 40);
    ctx.textAlign = 'left';

    // 两个页签
    const tabW = (cw - 48) / 2;
    const tabY = cy + 68;
    [copy.UI.agreementTabUser, copy.UI.agreementTabPrivacy].forEach((label, i) => {
      const tx = cx + 24 + i * tabW;
      const active = i === this.tab;
      if (active) draw.fillRoundRect(ctx, tx, tabY, tabW, 44, 22, 'rgba(232,200,122,0.14)');
      ctx.fillStyle = active ? COLOR.gold : COLOR.ink4;
      ctx.font = font(FONT.body, active ? '600' : '');
      ctx.textAlign = 'center';
      ctx.fillText(label, tx + tabW / 2, tabY + 22);
      ctx.textAlign = 'left';
    });

    // 文本区（滚动 + 裁剪）
    const layout = this.textLayout();
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    text.drawParagraph(ctx, layout, vp.x, vp.y, COLOR.ink2);
    ctx.restore();

    const bottom = cy + ch;
    if (this.mode === 'gate') {
      // 退出游戏（左下）
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(copy.UI.agreementExit, cx + 32, bottom - 88);

      // 勾选框 + 文案
      const chkX = cx + 32;
      const chkY = bottom - 124;
      draw.strokeRoundRect(ctx, chkX, chkY, 34, 34, 8, this.checked ? COLOR.gold : COLOR.ink4, 2);
      if (this.checked) {
        ctx.strokeStyle = COLOR.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(chkX + 8, chkY + 18);
        ctx.lineTo(chkX + 14, chkY + 24);
        ctx.lineTo(chkX + 27, chkY + 10);
        ctx.stroke();
      }
      ctx.font = font(FONT.small);
      ctx.fillStyle = this.checked ? COLOR.ink : COLOR.ink4;
      const checkLabel = text.singleLine(copy.UI.agreementCheck, cw - 120, font(FONT.small));
      ctx.fillText(checkLabel, chkX + 48, chkY + 21);

      // 不同意 / 同意
      const btnW = (cw - 72) / 2;
      const btnY = bottom - 108;
      draw.fillRoundRect(ctx, cx + 24, btnY, btnW, 80, 20, 'rgba(255,255,255,0.05)');
      draw.strokeRoundRect(ctx, cx + 24, btnY, btnW, 80, 20, COLOR.lineSoft, 1);
      ctx.font = font(FONT.body);
      ctx.fillStyle = COLOR.ink3;
      ctx.textAlign = 'center';
      ctx.fillText(copy.UI.agreementDisagree, cx + 24 + btnW / 2, btnY + 40);
      const agreeOn = this.checked;
      draw.fillRoundRect(ctx, cx + 48 + btnW, btnY, btnW, 80, 20,
        agreeOn ? 'rgba(232,200,122,0.92)' : 'rgba(232,200,122,0.22)');
      ctx.fillStyle = agreeOn ? '#15122E' : 'rgba(255,255,255,0.5)';
      ctx.font = font(FONT.body, '600');
      ctx.fillText(copy.UI.agreementAgree, cx + 48 + btnW + btnW / 2, btnY + 40);
      ctx.textAlign = 'left';
    } else {
      // read 模式：提示 + 关闭
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'center';
      ctx.fillText(copy.UI.agreementReadOnlyHint, cx + cw / 2, bottom - 104);
      ctx.textAlign = 'left';
      const closeW = 200;
      draw.fillRoundRect(ctx, cx + (cw - closeW) / 2, bottom - 88, closeW, 60, 20,
        'rgba(232,200,122,0.16)');
      draw.strokeRoundRect(ctx, cx + (cw - closeW) / 2, bottom - 88, closeW, 60, 20, COLOR.gold, 1);
      ctx.font = font(FONT.body, '600');
      ctx.fillStyle = COLOR.gold;
      ctx.textAlign = 'center';
      ctx.fillText(copy.UI.agreementClose, cx + cw / 2, bottom - 58);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

/**
 * 隐私授权弹窗（wx.onNeedPrivacyAuthorization 触发时展示）。
 * 点「同意/拒绝」调 services/privacy.js 的 agree()/disagree()，把挂起的
 * resolve 结算掉 —— 官方要求 resolve 必须挂在用户点击上。
 */
class PrivacySheet extends Sheet {
  constructor(opts) {
    super(Object.assign({ title: copy.UI.privacyRequestTitle }, opts));
    const o = opts || {};
    this.onDone = o.onDone || null;
    const W = o.w || 750;
    const H = o.h || 1334;
    this.cardW = Math.min(560, W - 64);
    this.cardX = Math.round((W - this.cardW) / 2);
    this.cardH = 480;
    this.cardY = Math.max(32, Math.round((H - this.cardH) / 2));
    this.linkRect = null; // 画的时候填，点击用它命中
  }

  inRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }

  onTap(x, y) {
    // 查看隐私保护指引全文（官方 API 打开）
    if (this.linkRect && this.inRect(x, y, this.linkRect.x, this.linkRect.y, this.linkRect.w, this.linkRect.h)) {
      privacy.openContract();
      return;
    }
    const btnY = this.cardY + this.cardH - 108;
    if (this.inRect(x, y, this.cardX + 24, btnY, this.cardW - 48, 80)) {
      const mid = this.cardX + this.cardW / 2;
      haptics.tap();
      if (x > mid) privacy.agree();
      else privacy.disagree();
      if (this.onDone) this.onDone();
    }
    // 点卡片其它位置：不关（必须明确选一边）
  }

  drawSelf(ctx) {
    ctx.save();
    ctx.fillStyle = MASK;
    ctx.fillRect(0, 0, this.w, this.h);

    const cx = this.cardX;
    const cy = this.cardY;
    const cw = this.cardW;

    draw.fillRoundRect(ctx, cx, cy, cw, this.cardH, RADIUS.xl, CARD_BG);
    draw.strokeRoundRect(ctx, cx, cy, cw, this.cardH, RADIUS.xl, COLOR.line, 1);

    ctx.font = font(FONT.h3, '600');
    ctx.fillStyle = COLOR.gold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, cx + cw / 2, cy + 44);
    ctx.textAlign = 'left';

    const layout = text.layoutParagraph({
      text: copy.UI.privacyRequestBody,
      font: font(FONT.body),
      size: FONT.body,
      lineHeight: Math.round(FONT.body * 1.7),
      maxWidth: cw - 72
    });
    text.drawParagraph(ctx, layout, cx + 36, cy + 106, COLOR.ink2);

    // 查看隐私保护指引全文（官方 API）
    const linkY = cy + 106 + layout.height + 28;
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.gold;
    ctx.fillText('点击查看《隐私保护指引》全文', cx + 36, linkY);
    this.linkRect = { x: cx + 36, y: linkY - 20, w: 320, h: 36 };

    const btnW = (cw - 72) / 2;
    const btnY = cy + this.cardH - 108;
    draw.fillRoundRect(ctx, cx + 24, btnY, btnW, 80, 20, 'rgba(255,255,255,0.05)');
    draw.strokeRoundRect(ctx, cx + 24, btnY, btnW, 80, 20, COLOR.lineSoft, 1);
    ctx.font = font(FONT.body);
    ctx.fillStyle = COLOR.ink3;
    ctx.textAlign = 'center';
    ctx.fillText(copy.UI.privacyRequestRefuse, cx + 24 + btnW / 2, btnY + 40);
    draw.fillRoundRect(ctx, cx + 48 + btnW, btnY, btnW, 80, 20, 'rgba(232,200,122,0.92)');
    ctx.fillStyle = '#15122E';
    ctx.font = font(FONT.body, '600');
    ctx.fillText(copy.UI.privacyRequestAgree, cx + 48 + btnW + btnW / 2, btnY + 40);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

module.exports = { AgreementSheet, PrivacySheet, ensureAgreed };

/**
 * 协议闸门：没同意过就弹窗挡住，同意后放行。
 *
 * 三个调用点共用（首启、账号页登录前、头像授权前），
 * 保证"不管从哪条路进来，未同意就过不去"。
 *
 * @param {object} stage 舞台（用它拿 router 和屏幕尺寸）
 * @param {function} [onDone] 同意后回调（首次启动时为空）
 * @returns {boolean} 是否已同意（true = 没弹窗直接放行）
 */
function ensureAgreed(stage, onDone) {
  if (agreement.hasAgreed()) {
    if (onDone) onDone();
    return true;
  }
  // 弹窗挂当前场景的浮层上（浮层是**场景**的成员，Router 本身没有浮层）
  const scene = stage.router ? stage.router.current() : null;
  if (!scene || !scene.overlay) return false;
  const sheet = new AgreementSheet({
    w: stage.width,
    h: stage.height,
    mode: 'gate'
  });
  sheet.onAgree = () => {
    agreement.accept();
    scene.overlay.clearChild(sheet);
    if (onDone) onDone();
  };
  // 不同意：留在弹窗里。唯一出路是"同意并继续"或"退出游戏"——
  // 不同意还要继续用，和协议本身矛盾
  sheet.onClose = () => {};
  scene.overlay.add(sheet);
  return false;
}
