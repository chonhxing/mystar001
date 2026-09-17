const { Widget } = require('./widget.js');
const { Button } = require('./interactive.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
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
    this.buildLayout();
  }

  /** 高度按内容算，之后改档位数或文案都不会错位 */
  buildLayout() {
    this.headerH = 128;
    this.adBtnH = 96;
    this.hasBuyArea = this.payUsable && this.products.length > 0;
    this.buyAreaH = this.hasBuyArea ? 92 + 196 + 92 : 96;
    this.footerH = 96 + (this.stage_ ? this.stage_.safeBottom : 0);
    this.sheetH = this.headerH + this.adBtnH + 32 + this.buyAreaH + this.footerH;
    this.sheetTop = this.h - this.sheetH;
    this.build();
  }

  build() {
    this.clear();
    this.cells = [];
    const pad = 32;
    const cw = this.w - pad * 2;
    let y = this.headerH;

    this.adBtn = new Button({
      x: pad, y, w: cw, text: copy.UI.unlockByAd, variant: 'primary',
      onTap: () => this.byAd()
    });
    this.add(this.adBtn);
    y += this.adBtnH + 32;

    if (this.hasBuyArea) {
      y += 30; // 给"或 开通畅玩卡"那行留位置
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
      y += 196;

      this.buyBtn = new Button({
        x: pad, y, w: cw, text: copy.UI.unlockBuy, variant: 'ghost',
        onTap: () => this.buy()
      });
      this.buyBtn.setEnabled(!!this.selectedId);
      this.add(this.buyBtn);
      y += 92;
    }

    this.add(new Button({
      x: pad, y: y + 16, w: cw, text: copy.UI.unlockLater, variant: 'plain', small: true,
      onTap: () => this.finish({ ok: false, reason: 'LATER' })
    }));
  }

  drawSelf(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,18,0.72)';
    ctx.fillRect(0, 0, this.w, this.sheetTop);

    draw.fillRoundRect(ctx, 0, this.sheetTop, this.w, this.sheetH, RADIUS.xl, '#15122E');
    draw.hairline(ctx, 24, this.sheetTop, this.w - 24, 'rgba(232,200,122,0.18)');

    const pad = 32;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    let ty = this.sheetTop + 46;
    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = COLOR.gold;
    ctx.fillText(copy.UI.unlockTitle, pad, ty);
    ty += 46;

    // 当前状态比"还剩几次"信息量更大
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink3;
    ctx.fillText(entitlement.summary().statusText, pad, ty);

    const divY = this.sheetTop + this.headerH + this.adBtnH + 32 + 14;
    if (this.hasBuyArea) {
      ctx.font = font(FONT.tiny);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'center';
      ctx.fillText(copy.UI.unlockOrBuy, this.w / 2, divY);
      ctx.textAlign = 'left';
      draw.hairline(ctx, pad, divY, this.w / 2 - 90, 'rgba(255,255,255,0.10)');
      draw.hairline(ctx, this.w / 2 + 90, divY, this.w - pad, 'rgba(255,255,255,0.10)');
    } else {
      // 给一句解释，免得用户以为我们把付费入口藏起来了
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      const msg = CONFIG.PAY && CONFIG.PAY.ENABLED ? copy.UI.unlockNoPay : copy.UI.unlockPayOff;
      ctx.fillText(text.singleLine(msg, this.w - pad * 2, font(FONT.micro)), pad, divY + 20);
    }

    if (this.busy) {
      ctx.fillStyle = 'rgba(11,10,31,0.84)';
      ctx.fillRect(0, this.sheetTop, this.w, this.sheetH);
      ctx.textAlign = 'center';
      ctx.font = font(FONT.h3);
      ctx.fillStyle = COLOR.gold;
      ctx.fillText(this.busyText || copy.UI.unlockChecking, this.w / 2, this.sheetTop + this.sheetH / 2);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /** 处理中时吞掉点击，防止重复扣款/重复播广告 */
  hitTest(x, y, loose) {
    if (!this.visible) return null;
    if (loose ? !this.containsPadded(x, y) : !this.contains(x, y)) return null;
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
    if (!reward.isAvailable()) {
      // 没配广告位（开发期 / 流量主还没下来）：直接送一次，不让流程卡死。
      // ⚠️ 提审前要确认广告位是否已配好，否则这等于"免费无限"。
      analytics.report(analytics.REPORTABLE.AD_FAILED, { reason: 'UNAVAILABLE' });
      entitlement.grantTickets(1);
      this.finish({ ok: true, kind: 'ticket', via: 'ad_unavailable' });
      return;
    }

    this.setBusy(true, copy.UI.unlockAdPlaying);
    reward.showRewarded('divinate_again').then((ok) => {
      this.setBusy(false);
      if (ok) {
        entitlement.grantTickets(1);
        this.finish({ ok: true, kind: 'ticket', via: 'ad' });
      } else {
        this.toast(copy.UI.unlockAdFail);
      }
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
