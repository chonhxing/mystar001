const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine, IconText } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar } = require('../ui/game.js');
const { COLOR, CARD, FONT, font, RADIUS, TXT } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
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
    this.pressScale = 0.97;
  }

  onTap() {
    if (this.onSelect) this.onSelect(this.product);
  }

  drawSelf(ctx) {
    const on = this.selected;
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, CARD.radius, on ? 'rgba(232,200,122,0.12)' : 'rgba(255,255,255,0.04)');
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, CARD.radius, on ? COLOR.gold : 'rgba(255,255,255,0.12)', on ? 1.6 : 1);
    if (on) draw.glow(ctx, this.w / 2, this.h / 2, this.w * 0.5, COLOR.gold, 0.1);

    const p = this.product;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(FONT.body, '600');
    ctx.fillStyle = on ? COLOR.gold : COLOR.ink2;
    ctx.fillText(copy.fill(copy.UI.unlockPassTag, { days: p.days }), this.w / 2, 46);

    // 配置里的 price 单位是「分」（接口要求），界面显示成元
    const yuan = p.price % 100 === 0 ? String(p.price / 100) : (p.price / 100).toFixed(2);
    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = on ? COLOR.gold : COLOR.ink;
    ctx.fillText(`¥${yuan}`, this.w / 2, 100);

    if (p.note) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(text.singleLine(p.note, this.w - 16, font(FONT.micro)), this.w / 2, 142);
    }
    ctx.textAlign = 'left';
  }
}

/**
 * 畅玩卡的**实体卡面**。
 *
 * 之前这一页没有"卡"这个东西，只有几行字和价签 —— 用户看完不知道自己买的是什么
 * （用户原话："畅玩卡区域是空的"）。有了这张 16:9 的卡面，
 * 未开通是灰调、开通后转金光并有一道流光扫过，产品才有了视觉锚点。
 */
class PassCard extends Widget {
  constructor(opts) {
    super(opts);
    const o = opts || {};
    this.active = !!o.active;
    this.days = o.days || 0;
    this.h = o.h || Math.round(this.w * 9 / 16);
  }

  update() {
    return this.active; // 开通后的流光要一直扫
  }

  drawSelf(ctx, stage, t) {
    const r = RADIUS.lg;
    const w = this.w;
    const h = this.h;

    // 外圈：金色渐变边框（未开通时是灰的）
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (this.active) {
      g.addColorStop(0, COLOR.gold);
      g.addColorStop(0.5, 'rgba(232,200,122,0.35)');
      g.addColorStop(1, COLOR.goldLight);
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0.08)');
    }
    draw.fillRoundRect(ctx, 0, 0, w, h, r, g);

    // 内层：深紫卡面
    const bg = ctx.createLinearGradient(0, 0, w * 0.7, h);
    bg.addColorStop(0, '#1B1638');
    bg.addColorStop(1, '#120F2A');
    draw.fillRoundRect(ctx, 2.5, 2.5, w - 5, h - 5, r - 2, bg);

    // 卡面纹理：星座连线 + 一颗大星芒水印 + 开通后的扫光
    draw.constellation(ctx, w * 0.06, h * 0.16, w * 0.52, h * 0.68, 5, this.active ? 0.20 : 0.08, 5);
    draw.sparkle(ctx, w * 0.80, h * 0.30, h * 0.20, this.active ? COLOR.gold : 'rgba(255,255,255,0.16)', this.active ? 0.35 : 0.18);
    if (this.active) {
      const cycle = (t / 2600) % 1.4;
      if (cycle < 1) {
        ctx.save();
        ctx.beginPath();
        draw.roundRectPath(ctx, 2.5, 2.5, w - 5, h - 5, r - 2);
        ctx.clip();
        const sx = -w * 0.3 + w * 1.6 * cycle;
        const sg = ctx.createLinearGradient(sx - w * 0.2, 0, sx + w * 0.12, h);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,235,190,0.18)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx - w * 0.2, 0, w * 0.34, h);
        ctx.restore();
      }
    }

    const pad = 30;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(FONT.h2, '700');
    ctx.fillStyle = this.active ? COLOR.gold : COLOR.ink;
    ctx.fillText(copy.UI.rechargeCardName, pad, h * 0.40);
    ctx.font = font(FONT.small);
    ctx.fillStyle = this.active ? COLOR.ink2 : COLOR.ink3;
    ctx.fillText(copy.UI.rechargeCardSlogan, pad, h * 0.40 + 46);

    // 右上角状态角标
    const statusText = this.active ? copy.fill(copy.UI.rechargePassOn, { days: this.days }) : copy.UI.rechargePassOff;
    const sf = font(FONT.tiny, '600');
    ctx.font = sf;
    const sw = Math.round(text.measure(statusText, sf)) + 30;
    const sx = w - pad - sw;
    draw.fillRoundRect(ctx, sx, pad - 6, sw, 44, 22, this.active ? 'rgba(232,200,122,0.18)' : 'rgba(255,255,255,0.07)');
    draw.strokeRoundRect(ctx, sx, pad - 6, sw, 44, 22, this.active ? 'rgba(232,200,122,0.6)' : 'rgba(255,255,255,0.14)', 1);
    ctx.fillStyle = this.active ? COLOR.gold : COLOR.ink3;
    ctx.textAlign = 'center';
    ctx.fillText(statusText, sx + sw / 2, pad + 17);
    ctx.textAlign = 'left';

    // 左下角落款
    ctx.font = font(FONT.micro);
    ctx.fillStyle = this.active ? 'rgba(232,200,122,0.75)' : COLOR.ink4;
    ctx.fillText(copy.BRAND.NAME, pad, h - pad);
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
    this.restorePass();
  }

  /**
   * 从服务端把已购的畅玩卡找回来。
   *
   * ⚠️ 这一步以前漏了：`payment.syncFromServer()` 写好了却**没有任何地方调用**。
   * 后果是换设备 / 重装微信之后，用户花 100 元买的 30 天卡在本地没有了、
   * 服务端明明存着却没人去取 —— 这会变成投诉和退款申请。
   *
   * 它内部已经判断 `PAY.ENABLED`，没开付费时不会发请求。
   */
  restorePass() {
    payment.syncFromServer().then((r) => {
      // 只有"确实恢复到了东西"、并且自己还在台前时才重建页面
      if (r && r.ok && r.changed && this.stage.router.current() === this) this.build();
    });
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

    // ---------- 当前状态（三行各自带图标：次数=圆点、券=票据、卡=卡片） ----------
    const stateCard = new Card({ x: pad, y, w: contentW, glow: true });
    let sy = 0;
    const stateRows = [
      {
        k: copy.UI.rechargeFree,
        icon: 'dots',
        v: copy.fill(copy.UI.rechargeFreeLeft, { left: st.freeLeft, total: st.freeTotal }),
        vColor: st.freeLeft > 0 ? COLOR.gold : COLOR.ink3
      }
    ];
    if (st.tickets > 0) {
      stateRows.push({ k: copy.UI.rechargeTickets, icon: 'ticket', v: `${st.tickets} 次`, vColor: COLOR.gold });
    }
    stateRows.push({
      k: copy.UI.rechargePass,
      icon: 'card',
      v: st.hasPass ? copy.fill(copy.UI.rechargePassOn, { days: st.passDays }) : copy.UI.rechargePassOff,
      vColor: st.hasPass ? COLOR.gold : COLOR.ink3
    });
    stateRows.forEach((r, i) => {
      stateCard.add(new IconText({
        x: 0, y: sy, w: contentW - CARD.pad * 2, h: 60,
        icon: r.icon, iconSize: 36, iconAlpha: 0.7,
        text: r.k, size: FONT.body, color: COLOR.ink3
      }));
      stateCard.add(new Label({
        x: 0, y: sy, w: contentW - CARD.pad * 2, align: 'right', text: r.v,
        size: FONT.body, weight: '600', color: r.vColor
      }));
      sy += 68;
      if (i < stateRows.length - 1) stateCard.add(new HLine({ x: 0, y: sy - 1, w: contentW - CARD.pad * 2 }));
    });
    stateCard.content.h = sy;
    stateCard.fitHeight(0);
    scroll.add(stateCard);
    y += stateCard.h + CARD.gap;

    // ---------- 看广告（不花钱也能继续的路径，永远放最前面） ----------
    const adBtn = new Button({
      x: pad, y, w: contentW, variant: st.hasPass ? 'plain' : 'primary',
      // 呼吸微光：这页的主动作需要一点"在等你点"的暗示
      pulse: !st.hasPass,
      text: busy ? this.busy : copy.UI.rechargeAdBtn,
      onTap: () => this.doAd()
    });
    adBtn.setEnabled(!busy);
    scroll.add(adBtn);
    y += 116;

    // ---------- 畅玩卡（实体卡面 + 价格） ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.rechargeTitle }));
    y += 68;

    const passCard = new PassCard({
      x: pad, y, w: contentW, active: st.hasPass, days: st.passDays
    });
    scroll.add(passCard);
    y += passCard.h + CARD.gap;

    if (this.probing) {
      scroll.add(new Paragraph({
        x: pad, y, w: contentW, size: FONT.small, color: COLOR.ink3, text: copy.UI.accountSessionUnchecked
      }));
      y += 60;
    } else if (!this.payUsable) {
      // 支付不可用时给一句明确说明，而不是显示一堆点不动的按钮
      const note = new Card({ x: pad, y, w: contentW });
      note.add(new Paragraph({
        x: 0, y: 0, w: contentW - CARD.pad * 2, size: FONT.small, color: TXT.sub, lineHeight: 44,
        text: CONFIG.PAY.ENABLED ? copy.UI.rechargeIosNote : copy.UI.rechargeUnavailable
      }));
      note.fitHeight(0);
      scroll.add(note);
      y += note.h + CARD.gap;
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
      y += 168 + CARD.gap;

      const buyBtn = new Button({
        x: pad, y, w: contentW, variant: 'ghost',
        text: busy ? this.busy : copy.UI.rechargeBuy,
        onTap: () => this.doBuy()
      });
      buyBtn.setEnabled(!busy && !!this.selectedId);
      scroll.add(buyBtn);
      y += 112;
    }

    // ---------- 权益：只列代码里真的做到的事 ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.rechargeBenefitsTitle }));
    y += 68;
    const benCard = new Card({ x: pad, y, w: contentW });
    copy.UI.rechargeBenefits.forEach((b, i) => {
      benCard.add(new IconText({
        x: 0, y: i * 66, w: contentW - CARD.pad * 2, h: 60,
        icon: 'check', iconSize: 30, iconColor: COLOR.gold, iconAlpha: 1,
        text: b, size: FONT.body, color: TXT.sub,
        maxWidth: contentW - CARD.pad * 2 - 46
      }));
    });
    benCard.content.h = copy.UI.rechargeBenefits.length * 66 - 6;
    benCard.fitHeight(0);
    scroll.add(benCard);
    y += benCard.h + CARD.gap;

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

  /**
   * 看广告换一次解锁。
   *
   * ⚠️ 策略（有没有广告位、没广告位时给不给）全在 reward.unlockByAd 里 ——
   *    这一页以前自己写了一份没广告位就直接发放，和解锁面板那份重复，
   *    结果改了一边忘另一边（两处都在白送）。现在只留统一策略，这里只管 UI。
   */
  doAd() {
    if (this.busy) return;
    const hasAd = reward.isAvailable();
    if (hasAd) this.setBusy(copy.UI.unlockAdPlaying);
    reward.unlockByAd().then((r) => {
      this.setBusy('');
      if (r.granted) {
        entitlement.grantTickets(1);
        this.toast(r.reason === 'AD_NOT_OPEN_GRANTED' ? copy.UI.unlockAdNotOpen : copy.UI.rechargeAdOk);
      } else {
        this.toast(r.reason === 'AD_NOT_OPEN' ? copy.UI.unlockAdNotOpen : copy.UI.unlockAdFail);
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
