const { Widget } = require('./widget.js');
const { Button } = require('./interactive.js');
const { COLOR, FONT, font, RADIUS, EASE } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const entitlement = require('../../../services/entitlement.js');
const payment = require('../../../services/payment.js');
const reward = require('../../../services/reward.js');
const analytics = require('../../../services/analytics.js');

/**
 * 解锁面板：免费次数用完之后，让用户选"看广告"还是"开通畅玩卡"。
 *
 * 三个刻意的设计：
 *  1. **付费入口"有则显示"**。没开通虚拟支付（没版号）或设备不支持时，
 *     价格区整个消失，只留广告 —— 产品在纯 IAA 状态下也能完整上线。
 *  2. **买卡两步走（先选档位，再点开通）**。涉及钱的操作不能一点就扣款。
 *  3. **处理中吞掉所有点击**。广告加载、支付拉起期间重复点击会重复扣款，必须挡住。
 */

/** 一个价格档位 */
class PriceCell extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.product = opts.product;
    this.selected = !!opts.selected;
    this.onSelect = opts.onSelect || null;
    this.h = opts.h || 176;
  }

  onTap() {
    if (this.onSelect) this.onSelect(this.product);
  }

  drawSelf(ctx) {
    const on = this.selected;
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, on ? 'rgba(232,200,122,0.14)' : 'rgba(255,255,255,0.045)');
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, on ? COLOR.gold : COLOR.lineSoft, on ? 1.6 : 1);
    if (on) draw.glow(ctx, this.w / 2, this.h / 2, this.w * 0.5, COLOR.gold, 0.1);

    const p = this.product;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = font(FONT.h3, '600');
    ctx.fillStyle = on ? COLOR.gold : COLOR.ink;
    ctx.fillText(copy.fill(copy.UI.unlockPassTag, { days: p.days }), this.w / 2, 46);

    // 配置里的 price 单位是「分」（接口要求就是这样），界面显示成元
    const yuan = p.price % 100 === 0 ? String(p.price / 100) : (p.price / 100).toFixed(2);
    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = on ? COLOR.gold : COLOR.ink;
    ctx.fillText(`¥${yuan}`, this.w / 2, 100);

    if (p.note) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(text.singleLine(p.note, this.w - 16, font(FONT.micro)), this.w / 2, 144);
    }
    ctx.textAlign = 'left';
  }
}

/**
 * 从底部弹起的距离。
 *
 * ⚠️ 位移**只画在 drawSelf 里**，不改控件的 y，也不让命中测试跟着动 ——
 *    因为面板里的按钮分布在整块高度上（最后一个"以后再说"贴着底部），
 *    如果让整体 y 跟着动画走，动画期间那些按钮的命中区就被推到屏幕外了：
 *    用户（和测试）按"看得见的位置"点会点空。这里改成
 *    "视觉先滑进来、一碰就落位"，两者永远不会不一致。
 */
const SLIDE = 72;

class UnlockSheet extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.stage_ = o.stage;
    if (!this.w && o.stage) this.w = o.stage.width;
    if (!this.h && o.stage) this.h = o.stage.height;
    this.tapEnabled = true;
    this.busy = false;
    this.busyText = '';
    this.selectedId = '';
    this.payUsable = !!o.payUsable;
    this.products = o.products || [];
    this.scene = null;
    this.resolve_ = null;
    this.cells = [];
    /** 入场进度 0 → 1；slide 是当前的下滑量（只影响绘制） */
    this.anim = 0;
    this.slide = SLIDE;
    this.buildLayout();
  }

  /** 高度按内容算，之后改档位数或文案都不会错位 */
  buildLayout() {
    this.headerH = 196;
    this.adBtnH = 96;
    this.hasBuyArea = this.payUsable && this.products.length > 0;
    // 付费区：分隔行 + 档位格 + 开通按钮 + 下方留白；不可付费时只留一行说明
    this.buyAreaH = this.hasBuyArea ? 44 + 176 + 24 + 88 + 24 : 64;
    this.laterH = 92;
    this.footerH = (this.stage_ ? this.stage_.safeBottom : 0) + 8;
    this.sheetH = this.headerH + this.adBtnH + 28 + this.buyAreaH + this.laterH + this.footerH;
    this.sheetTop = this.h - this.sheetH;
    this.build();
  }

  update(dt) {
    if (this.anim >= 1) return this.updatePress(dt) || false;
    this.anim = Math.min(1, this.anim + dt / 250);
    this.slide = (1 - EASE.outCubic(this.anim)) * SLIDE;
    return true;
  }

  /** 一碰就落位：动画只值 0.25 秒，与其让用户"点了个还没到位的东西"，不如直接收掉 */
  settleAnim() {
    this.anim = 1;
    this.slide = 0;
  }

  settle() {
    this.settleAnim();
    return super.settle();
  }

  build() {
    this.clear();
    this.cells = [];
    const pad = 32;
    const cw = this.w - pad * 2;
    let y = this.headerH;

    // 主路径：看广告换一次。放在最显眼的位置、给主按钮样式、整行全宽
    this.adBtn = new Button({
      x: pad, y, w: cw, h: this.adBtnH, text: copy.UI.unlockByAd, variant: 'primary',
      onTap: () => this.byAd()
    });
    this.add(this.adBtn);
    y += this.adBtnH + 28;

    if (this.hasBuyArea) {
      y += 44;
      const gap = 16;
      const cellW = Math.floor((cw - gap * (this.products.length - 1)) / this.products.length);
      this.products.forEach((p, i) => {
        const cell = new PriceCell({
          x: pad + i * (cellW + gap), y, w: cellW, h: 176,
          product: p, selected: this.selectedId === p.id,
          onSelect: (prod) => this.selectProduct(prod)
        });
        this.cells.push(cell);
        this.add(cell);
      });
      y += 176 + 24;

      this.buyBtn = new Button({
        x: pad, y, w: cw, h: 88, text: copy.UI.unlockBuy, variant: 'ghost',
        onTap: () => this.buy()
      });
      this.buyBtn.setEnabled(!!this.selectedId);
      this.add(this.buyBtn);
      y += 88 + 24;
    } else {
      // 付费不可用时给一句明确说明，免得用户以为我们把入口藏起来了
      this.noteText = CONFIG.PAY && CONFIG.PAY.ENABLED ? copy.UI.unlockNoPay : copy.UI.unlockPayOff;
      y += this.buyAreaH;
    }

    // 次级出路：一行灰字，不是第二个按钮。
    // 两个药丸按钮并排会让用户以为它们平级，分不清主次（用户直接点名过这个问题）。
    this.add(new Button({
      x: pad, y: this.sheetTop + this.sheetH - this.footerH - this.laterH,
      w: cw, h: this.laterH - 12, variant: 'text', small: true, size: FONT.body,
      text: copy.UI.unlockLater,
      onTap: () => this.finish({ ok: false, reason: 'LATER' })
    }));
  }

  drawSelf(ctx) {
    ctx.save();
    // 遮罩加深到 78%：以前 72% 时下层的表单还隐约可见，
    // 用户会觉得"弹层和页面内容叠在一起，逻辑混乱"
    ctx.fillStyle = 'rgba(6,5,18,0.78)';
    ctx.fillRect(0, 0, this.w, this.sheetTop + this.slide + 2);

    ctx.translate(0, this.slide);
    draw.fillRoundRect(ctx, 0, this.sheetTop, this.w, this.sheetH, RADIUS.xl, '#15122E');
    draw.hairline(ctx, 24, this.sheetTop, this.w - 24, 'rgba(232,200,122,0.20)');

    const pad = 32;
    const cx = this.w / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // 顶端一颗星：这页讲的是"再来一次"，用星形当视觉锚点
    const icY = this.sheetTop + 54;
    draw.radialGlow(ctx, cx, icY, 62, 'rgba(232,200,122,0.22)', 1);
    draw.sparkle(ctx, cx, icY, 20, COLOR.gold);
    ctx.globalAlpha *= 0.35;
    ctx.strokeStyle = COLOR.gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, icY, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha /= 0.35;

    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(copy.UI.unlockTitle, cx, this.sheetTop + 112);
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText(copy.UI.unlockSub, cx, this.sheetTop + 160);

    const divY = this.sheetTop + this.headerH + this.adBtnH + 28 + (this.hasBuyArea ? 22 : 32);
    if (this.hasBuyArea) {
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(copy.UI.unlockOrBuy, cx, divY);
      draw.hairline(ctx, pad, divY, cx - 90, 'rgba(255,255,255,0.10)');
      draw.hairline(ctx, cx + 90, divY, this.w - pad, 'rgba(255,255,255,0.10)');
    } else {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink3;
      ctx.fillText(text.singleLine(this.noteText, this.w - pad * 2, font(FONT.micro)), cx, divY);
    }
    ctx.textAlign = 'left';

    if (this.busy) {
      ctx.fillStyle = 'rgba(11,10,31,0.86)';
      ctx.fillRect(0, this.sheetTop, this.w, this.sheetH);
      ctx.textAlign = 'center';
      ctx.font = font(FONT.h3);
      ctx.fillStyle = COLOR.gold;
      ctx.fillText(this.busyText || copy.UI.unlockChecking, cx, this.sheetTop + this.sheetH / 2);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /** 处理中时吞掉点击，防止重复扣款/重复播广告 */
  hitTest(x, y, loose) {
    if (!this.visible) return null;
    if (loose ? !this.containsPadded(x, y) : !this.contains(x, y)) return null;
    if (this.anim < 1) this.settleAnim(); // 用户碰了 = 动画结束（见 SLIDE 的说明）
    if (this.busy) return this;
    for (let i = this.children.length - 1; i >= 0; i -= 1) {
      const c = this.children[i];
      const hit = c.hitTest(x - c.x, y - c.y, loose);
      if (hit) return hit;
    }
    return this;
  }

  /** 点背板不关闭：涉及付费的面板，让用户明确点"以后再说"再离开 */
  onTap() {}

  setBusy(on, textStr) {
    this.busy = !!on;
    this.busyText = textStr || '';
    if (this.adBtn) this.adBtn.setEnabled(!on);
    if (this.buyBtn) this.buyBtn.setEnabled(!on && !!this.selectedId);
    this.dirty();
  }

  selectProduct(p) {
    if (this.busy) return;
    this.selectedId = p.id;
    this.cells.forEach((c) => {
      c.selected = c.product.id === p.id;
      c.dirty();
    });
    if (this.buyBtn) this.buyBtn.setEnabled(true);
    this.dirty();
  }

  // ---------------- 两条解锁路径 ----------------

  byAd() {
    if (this.busy) return;
    // 策略（有没有广告位、没广告位时给不给）全在 reward.unlockByAd 里，
    // 这里只负责 UI：转圈、提示、发券、收面板
    const hasAd = reward.isAvailable();
    if (hasAd) this.setBusy(true, copy.UI.unlockAdPlaying);
    reward.unlockByAd().then((r) => {
      if (hasAd) this.setBusy(false);
      if (!r.granted) {
        // AD_NOT_OPEN = 广告位没开放且配置成不发放；AD_INCOMPLETE = 没看完
        this.toast(r.reason === 'AD_NOT_OPEN' ? copy.UI.unlockAdNotOpen : copy.UI.unlockAdFail);
        return;
      }
      if (r.reason === 'AD_NOT_OPEN_GRANTED') this.toast(copy.UI.unlockAdNotOpen);
      entitlement.grantTickets(1);
      this.finish({ ok: true, kind: 'ticket', via: r.reason === 'ad' ? 'ad' : 'ad_unavailable' });
    });
  }

  buy() {
    if (this.busy || !this.selectedId) return;
    const product = payment.findProduct(this.selectedId);
    if (!product) return;

    this.setBusy(true, copy.UI.unlockPaying);
    payment
      .purchase(product.id, {
        // 原生支付面板会盖住 Canvas，先把"处理中"画出来
        onPayStart: () => this.setBusy(true, copy.UI.unlockChecking)
      })
      .then((r) => {
        this.setBusy(false);
        if (r.ok) {
          this.toast(
            r.pending
              ? copy.UI.unlockPaidPending
              : copy.fill(copy.UI.unlockPaidOk, { days: r.days || product.days })
          );
          this.finish({ ok: true, kind: 'pass', via: 'pay', orderNo: r.orderNo });
        } else if (!r.cancelled) {
          this.toast(r.message || copy.UI.unlockNoItems);
        }
      });
  }

  toast(msg) {
    if (this.scene && this.scene.toast) this.scene.toast(msg);
  }

  ask(scene) {
    this.scene = scene;
    return new Promise((resolve) => {
      this.resolve_ = resolve;
    });
  }

  finish(result) {
    if (!this.resolve_) return;
    const r = this.resolve_;
    this.resolve_ = null;
    r(result);
  }
}

/**
 * 弹出解锁面板。先探测支付可用性，再决定价格区显不显示。
 * @returns {Promise<{ok:boolean, kind?:string, via?:string}>}
 */
function showUnlock(scene) {
  return payment.probe().then((support) => {
    const sheet = new UnlockSheet({
      x: 0,
      y: 0,
      w: scene.stage.width,
      h: scene.stage.height,
      stage: scene.stage,
      payUsable: !!support.ok,
      products: payment.products()
    });
    scene.overlay.add(sheet);
    return sheet.ask(scene).then((result) => {
      scene.overlay.clearChild(sheet);
      return result;
    });
  });
}

module.exports = { UnlockSheet, showUnlock, PriceCell };
