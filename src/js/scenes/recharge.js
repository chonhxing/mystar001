const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar } = require('../ui/game.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
const draw = require('../draw.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const entitlement = require('../../../services/entitlement.js');
const payment = require('../../../services/payment.js');
const reward = require('../../../services/reward.js');

/**
 * 开通畅玩卡（充值页）。
 *
 * 两条解锁路径并排展示：**看广告换一次** 和 **开通畅玩卡**。
 * 支付不可用时（没开通虚拟支付 / 设备不支持）价格区整个隐藏，只留广告
 * —— 这样产品在纯 IAA 状态下也能完整上线，不会出现"点了没反应"的死按钮。
 *
 * 买卡要两步（先选档位、再点开通）：涉及钱的操作不能一点就扣款。
 */

/** 一个价格档位 */
class PriceCell extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.product = opts.product;
    this.selected = !!opts.selected;
    this.onSelect = opts.onSelect || null;
    this.h = opts.h || 168;
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
    ctx.fillText(copy.fill(copy.UI.unlockPassTag, { days: p.days }), this.w / 2, 44);

    // 配置里的 price 单位是「分」（接口要求），界面显示成元
    const yuan = p.price % 100 === 0 ? String(p.price / 100) : (p.price / 100).toFixed(2);
    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = on ? COLOR.gold : COLOR.ink;
    ctx.fillText(`¥${yuan}`, this.w / 2, 96);

    if (p.note) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(p.note, this.w / 2, 138);
    }
    ctx.textAlign = 'left';
  }
}

class RechargeScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.selectedId = '';
    this.busy = '';
    this.payUsable = false;
    this.probing = true;
    this.cells = [];
  }

  onEnter() {
    this.alwaysRender = true;
    this.build();
    this.probePay();
  }

  /**
   * 回到这一页时也要重新探测。
   *
   * ⚠️ 不能只在 onEnter 里探：`router.reset` 到**同一个场景**时框架会复用实例、
   * 只调 onResume，onEnter 根本不会再跑。那样一旦状态变了（比如管理后台开了支付），
   * 页面会一直停留在旧判断上。
   * probe 内部有缓存，重复调用成本很低。
   */
  onResume() {
    this.probePay();
    this.build();
  }

  /** 探测支付可用性：决定价格区显不显示 */
  probePay() {
    payment.probe().then((support) => {
      this.payUsable = !!support.ok;
      this.probing = false;
      this.build();
    });
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const top = this.stage.contentTop + 92;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 41, ring: false }));
    this.root.add(new TopBar({
      x: pad, y: this.stage.contentTop + 10, w: contentW, h: 72,
      title: copy.UI.rechargeTitle,
      onBack: () => this.stage.router.pop()
    }));

    const scroll = new ScrollView({ x: 0, y: top, w: W, h: this.stage.height - top });
    this.scroll = scroll;
    this.root.add(scroll);

    this.cells = [];
    const st = entitlement.summary();
    const busy = !!this.busy;
    let y = 16;

    // ---------- 当前状态 ----------
    const stateCard = new Card({ x: pad, y, w: contentW, glow: true });
    let sy = 0;
    const stateRows = [
      {
        k: copy.UI.rechargeFree,
        v: copy.fill(copy.UI.rechargeFreeLeft, { left: st.freeLeft, total: st.freeTotal }),
        vColor: st.freeLeft > 0 ? COLOR.gold : COLOR.ink3
      }
    ];
    if (st.tickets > 0) {
      stateRows.push({ k: copy.UI.rechargeTickets, v: `${st.tickets} 次`, vColor: COLOR.gold });
    }
    stateRows.push({
      k: copy.UI.rechargePass,
      v: st.hasPass ? copy.fill(copy.UI.rechargePassOn, { days: st.passDays }) : copy.UI.rechargePassOff,
      vColor: st.hasPass ? COLOR.gold : COLOR.ink3
    });
    stateRows.forEach((r, i) => {
      stateCard.add(new Label({
        x: 0, y: sy, w: contentW - 56, text: r.k, size: FONT.small, color: COLOR.ink4
      }));
      stateCard.add(new Label({
        x: 0, y: sy, w: contentW - 56, align: 'right', text: r.v,
        size: FONT.body, weight: '600', color: r.vColor
      }));
      sy += 60;
      if (i < stateRows.length - 1) stateCard.add(new HLine({ x: 0, y: sy - 1, w: contentW - 56 }));
    });
    stateCard.content.h = sy;
    stateCard.fitHeight(0);
    scroll.add(stateCard);
    y += stateCard.h + 28;

    // ---------- 看广告 ----------
    // 这是"不花钱也能继续"的路径，永远放在最前面
    const adBtn = new Button({
      x: pad, y, w: contentW, variant: st.hasPass ? 'plain' : 'primary',
      text: busy ? this.busy : copy.UI.rechargeAdBtn,
      onTap: () => this.doAd()
    });
    adBtn.setEnabled(!busy);
    scroll.add(adBtn);
    y += 116;

    // ---------- 畅玩卡 ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.rechargeTitle }));
    y += 64;

    if (this.probing) {
      scroll.add(new Paragraph({
        x: pad, y, w: contentW, size: FONT.small, color: COLOR.ink4, text: copy.UI.accountSessionUnchecked
      }));
      y += 60;
    } else if (!this.payUsable) {
      // 支付不可用时给一句明确说明，而不是显示一堆点不动的按钮
      const note = new Card({ x: pad, y, w: contentW });
      note.add(new Paragraph({
        x: 0, y: 0, w: contentW - 56, size: FONT.small, color: COLOR.ink3, lineHeight: 44,
        text: CONFIG.PAY.ENABLED ? copy.UI.rechargeIosNote : copy.UI.rechargeUnavailable
      }));
      note.fitHeight(0);
      scroll.add(note);
      y += note.h + 28;
    } else {
      const products = payment.products();
      const gap = 16;
      const cellW = Math.floor((contentW - gap * (products.length - 1)) / products.length);
      products.forEach((p, i) => {
        const cell = new PriceCell({
          x: pad + i * (cellW + gap), y, w: cellW,
          product: p, selected: this.selectedId === p.id,
          onSelect: (prod) => this.selectProduct(prod)
        });
        this.cells.push(cell);
        scroll.add(cell);
      });
      y += 168 + 24;

      const buyBtn = new Button({
        x: pad, y, w: contentW, variant: 'ghost',
        text: busy ? this.busy : copy.UI.rechargeBuy,
        onTap: () => this.doBuy()
      });
      buyBtn.setEnabled(!busy && !!this.selectedId);
      scroll.add(buyBtn);
      y += 112;
    }

    // ---------- 说明 ----------
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center',
      size: FONT.micro, color: COLOR.ink4, text: copy.UI.rechargeNote
    }));
    y += 100;

    // ---------- 忙碌遮罩 ----------
    if (busy) {
      this.root.add(new Panel({
        x: 0, y: 0, w: W, h: this.stage.height,
        radius: 0, fill: 'rgba(11,10,31,0.82)'
      }));
      this.root.add(new Label({
        x: 0, y: this.stage.height / 2 - 20, w: W, align: 'center',
        text: this.busy, size: FONT.h3, color: COLOR.gold
      }));
    }

    scroll.setContentHeight(y);
  }

  selectProduct(p) {
    if (this.busy) return;
    this.selectedId = p.id;
    this.cells.forEach((c) => {
      c.selected = c.product.id === p.id;
      c.dirty();
    });
    this.build();
  }

  setBusy(text) {
    this.busy = text || '';
    this.build();
  }

  doAd() {
    if (this.busy) return;
    if (!reward.isAvailable()) {
      // 没配广告位（开发期）：直接给一次，不让流程卡死
      entitlement.grantTickets(1);
      this.toast(copy.UI.rechargeAdOk);
      this.build();
      return;
    }
    this.setBusy(copy.UI.unlockAdPlaying);
    reward.showRewarded('divinate_again').then((ok) => {
      this.setBusy('');
      if (ok) {
        entitlement.grantTickets(1);
        this.toast(copy.UI.rechargeAdOk);
      } else {
        this.toast(copy.UI.rechargeAdFail);
      }
      this.build();
    });
  }

  doBuy() {
    if (this.busy || !this.selectedId) return;
    const product = payment.findProduct(this.selectedId);
    if (!product) return;

    this.setBusy(copy.UI.unlockPaying);
    payment
      .purchase(product.id, { onPayStart: () => this.setBusy(copy.UI.unlockChecking) })
      .then((r) => {
        this.setBusy('');
        if (r.ok) {
          this.toast(r.pending ? copy.UI.rechargePending : copy.fill(copy.UI.rechargePaid, { days: r.days || product.days }));
        } else if (!r.cancelled) {
          this.toast(r.message || copy.UI.rechargeAdFail);
        } else {
          this.toast(copy.UI.rechargeCancel);
        }
        this.build();
      });
  }
}

module.exports = RechargeScene;
