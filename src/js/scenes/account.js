const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine, Hotspot } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TabBar } = require('../ui/game.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const entitlement = require('../../../services/entitlement.js');
const account = require('../../../services/account.js');
const playlog = require('../../../services/playlog.js');
const gate = require('../../../services/gate.js');
const divination = require('../../../services/divination.js');
const wechatprofile = require('../../../services/wechatprofile.js');
const agreement = require('../../../services/agreement.js');
const agreementUi = require('../ui/agreement.js');
const assets = require('../assets.js');
const storage = require('../../../utils/storage.js');
const { CHARACTERS } = require('../../../data/characters.js');

/** 头像区的尺寸（设计稿坐标） */
const AVATAR_R = 44;
const AVATAR_ROW_H = 148;

/**
 * 账号（个人中心）。
 *
 * 这一页是"我的"的总入口，按「最有用的排最前」组织：
 *   1. **资料卡** —— 存多份生辰，点一下直接开始占卜。这是最常用的动作。
 *   2. **可用次数** —— 还剩几次、有没有畅玩卡，一眼看到。
 *   3. **图鉴 / 记录 / 充值** —— 三个二级入口。
 *   4. 账号信息与数据边界 —— 放最后。
 *
 * 文案克制：只给标签和值。唯一的例外是底部那句"无需注册"，
 * 以及一行数据边界说明 —— 不写的话用户会去找登录按钮、也不知道换手机会丢什么。
 */

/** 一行"标签 → 值" */
class Row extends Widget {
  constructor(opts) {
    super(opts);
    this.k = opts.k || '';
    this.v = opts.v || '';
    this.h = opts.h || 64;
    this.vColor = opts.vColor || COLOR.ink;
  }

  drawSelf(ctx) {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink4;
    ctx.fillText(this.k, 0, this.h / 2);

    ctx.font = font(FONT.body, '600');
    ctx.fillStyle = this.vColor;
    ctx.textAlign = 'right';
    ctx.fillText(text.singleLine(this.v, this.w - 130, font(FONT.body, '600')), this.w, this.h / 2);
    ctx.textAlign = 'left';
  }
}

/** 带箭头的入口行 */
class EntryRow extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.title = opts.title || '';
    this.value = opts.value || '';
    this.valueColor = opts.valueColor || COLOR.ink3;
    this.h = opts.h || 96;
    this.handler = opts.onTap || null;
    this.pressed = false;
  }

  onPressStart() {
    this.pressed = true;
    this.dirty();
  }

  onPressEnd() {
    this.pressed = false;
    this.dirty();
  }

  onTap() {
    if (this.handler) this.handler();
  }

  drawSelf(ctx) {
    if (this.pressed) {
      draw.fillRoundRect(ctx, -12, 4, this.w + 24, this.h - 8, RADIUS.md, 'rgba(255,255,255,0.05)');
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(FONT.body);
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(this.title, 0, this.h / 2);

    if (this.value) {
      ctx.font = font(FONT.small);
      ctx.fillStyle = this.valueColor;
      ctx.textAlign = 'right';
      ctx.fillText(this.value, this.w - 28, this.h / 2);
    }
    ctx.strokeStyle = COLOR.ink4;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.w - 14, this.h / 2 - 9);
    ctx.lineTo(this.w - 5, this.h / 2);
    ctx.lineTo(this.w - 14, this.h / 2 + 9);
    ctx.stroke();
    ctx.textAlign = 'left';
  }
}

/**
 * 顶部头像行（固定不滚动）。
 *
 * ⚠️ 为什么必须固定：取头像用的是 `wx.createUserInfoButton`，那是**原生控件**，
 * 它不跟着 canvas 上的内容滚动。放进滚动区的话，用户一滑，按钮就留在原地，
 * 既压住了别的内容、又指向了错误的位置。所以头像整行放在滚动区之上。
 *
 * 原生按钮自己会画背景和文字，所以 nativeOk 时这里只画头像和昵称，
 * 不再画自己的按钮（否则文字会叠两层）；创建失败时（开发者工具里常见）
 * 才退回自己画的胶囊，点击给个提示。
 */
class AvatarRow extends Widget {
  constructor(opts) {
    super(opts);
    this.nickName = opts.nickName || '';
    this.sub = opts.sub || '';
    /**
     * ⚠️ 头像是异步加载的，所以这里存**取值函数**而不是图片本身：
     * 存图片会让"加载完"那一刻手里的引用还是 null，只有重建页面才换得上。
     */
    this.getAvatar = opts.getAvatar || (() => null);
    this.seed = opts.seed || 7;
    this.nativeOk = !!opts.nativeOk;
    this.btnText = opts.btnText || '';
    this.cx = 0;
    this.cy = 0;
    this.btn = { x: 0, y: 0, w: 0, h: 0 };
    this.tapEnabled = false; // 只画不点：点击由原生按钮或下面的热区负责
  }

  drawSelf(ctx) {
    const r = AVATAR_R;
    const cx = this.cx;
    const cy = this.cy;

    // 头像：有图就是图，没有就退回徽记 + 昵称首字
    if (!draw.avatar(ctx, this.getAvatar(), cx, cy, r)) {
      draw.emblem(ctx, cx, cy, r, this.seed, COLOR.gold, false);
      const first = (this.nickName || '我').slice(0, 1);
      ctx.font = font(30, '700');
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(first, cx, cy + 1);
      ctx.textAlign = 'left';
    }

    const tx = cx + r + 24;
    ctx.textBaseline = 'middle';
    ctx.font = font(FONT.h3, '600');
    ctx.fillStyle = this.nickName ? COLOR.ink : COLOR.ink4;
    ctx.fillText(text.singleLine(this.nickName || copy.UI.accountNicknameEmpty, this.btn.x - tx - 20, font(FONT.h3, '600')), tx, cy - 14);

    if (this.sub) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(text.singleLine(this.sub, this.btn.x - tx - 20, font(FONT.micro)), tx, cy + 22);
    }

    // 原生按钮创建失败时的兜底：自己画一个胶囊，点了给提示
    if (!this.nativeOk && this.btnText) {
      const b = this.btn;
      draw.fillRoundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2, 'rgba(232,200,122,0.08)');
      draw.strokeRoundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2, COLOR.line, 1);
      ctx.font = font(FONT.small, '600');
      ctx.fillStyle = COLOR.gold;
      ctx.textAlign = 'center';
      ctx.fillText(this.btnText, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.textAlign = 'left';
    }
  }
}

/** 资料卡的三行内容各自的位置（卡片本地 y）。
 *  ⚠️ 三行都必须有自己的一条带，不能按 h/2 去算：
 *    上一版把名字放在 h/2-16、副标题 h/2+22、"默认"徽标放在 h-22，
 *    结果副标题的墨迹和徽标叠了 5px（布局审计抓到的）。
 *    行高 = 字号 × 1.3，相邻两行至少留 8px 缝。 */
const CARD_LINE = { name: 42, sub: 78, badge: 108 };
const CARD_H = 128;

/**
 * 一张资料卡。
 * 点主体 = 用这张卡直接开始占卜；点右上角的 × = 删除。
 * 两者共用一个控件，所以 onTap 要自己判断点在哪个区域。
 */
class ProfileCard extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.profile = opts.profile;
    this.active = !!opts.active;
    this.h = CARD_H;
    this.onStart = opts.onStart || null;
    this.onDelete = opts.onDelete || null;
  }

  /** × 的命中区（本地坐标：右上角 72×72） */
  inDeleteZone(lx, ly) {
    return lx >= this.w - 76 && ly <= 76;
  }

  onTap(lx, ly) {
    const local = this.localPoint ? this.localPoint(lx, ly) : { x: lx, y: ly };
    if (this.inDeleteZone(local.x, local.y)) {
      if (this.onDelete) this.onDelete(this.profile);
      return;
    }
    if (this.onStart) this.onStart(this.profile);
  }

  drawSelf(ctx) {
    const p = this.profile;
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md,
      this.active ? 'rgba(232,200,122,0.10)' : COLOR.panel);
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md,
      this.active ? COLOR.line : COLOR.lineSoft, this.active ? 1.4 : 1);

    // 小徽记：和角色卡同一套视觉语言
    const av = 56;
    const ax = 22;
    const ay = (this.h - av) / 2;
    const seed = ((p.name || p.birthDate || 'x').length + (p.birthDate || '').length) * 7;
    draw.emblem(ctx, ax + av / 2, ay + av / 2, av / 2, seed,
      this.active ? COLOR.gold : 'rgba(255,255,255,0.5)', false);
    ctx.font = font(24, '700');
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((p.name || '?').slice(0, 1), ax + av / 2, ay + av / 2 + 2);
    ctx.textAlign = 'left';

    const tx = ax + av + 20;
    const tw = this.w - tx - 80;
    ctx.font = font(FONT.h3, '600');
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(text.singleLine(p.name || '未命名', tw, font(FONT.h3, '600')), tx, CARD_LINE.name);

    const sub = [p.birthDate, p.timeKnown ? p.birthTime : copy.UI.accountProfileTimeUnknown, p.cityLabel || p.city]
      .filter(Boolean)
      .join(' · ');
    ctx.font = font(FONT.micro);
    ctx.fillStyle = COLOR.ink4;
    ctx.fillText(text.singleLine(sub, tw, font(FONT.micro)), tx, CARD_LINE.sub);

    // 删除（×）
    const cx = this.w - 38;
    const cy = 38;
    ctx.strokeStyle = COLOR.ink4;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 8);
    ctx.lineTo(cx + 8, cy + 8);
    ctx.moveTo(cx + 8, cy - 8);
    ctx.lineTo(cx - 8, cy + 8);
    ctx.stroke();

    if (this.active) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.gold;
      ctx.fillText('默认', tx, CARD_LINE.badge);
    }
  }
}

class AccountScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.state = null;
    this.loading = true;
    this.busy = '';
    this.profiles = [];
    this.activeId = '';
    this.codexCount = 0;
    this.recordCount = 0;
    /** 微信昵称头像（只存本机，见 services/wechatprofile.js） */
    this.wechat = null;
    this.avatarImg = null;
    /** 取头像用的原生按钮会话：离开页面必须 cancel，否则按钮会留在屏幕上吃点击 */
    this.capture = null;
    /** 隐私授权是否已完成。没完成就不放按钮（放了也拿不到资料） */
    this.privacyReady = false;
    /** 这个环境能不能用原生取资料按钮。试一次失败就永久放弃，避免无限重试 */
    this.captureUnsupported = false;
    /** 已经离场（onExit 过的场景不该再响应任何异步回调） */
    this.exited = false;
  }

  onEnter() {
    this.alwaysRender = true;
    this.reloadLocal();
    this.build();
    // 进页面校验一次登录凭证：它是支付的前提，也是这页最该知道的账号状态
    this.reloadRemote(true);
    this.requestPrivacy();
  }

  onResume() {
    this.reloadLocal();
    this.reloadRemote(false);
  }

  /**
   * 这个场景还在台前吗。
   *
   * ⚠️ 异步回调必须问这一句。踩过的坑：进账号页后立刻点进图鉴，
   * 登录态请求 200ms 后才回来，回调里 `this.build()` 会把**已经离场的页面**
   * 重建一遍 —— 而 build 会给头像行放一个原生按钮，于是它就浮在图鉴页上吃点击。
   * 同理，onCaptured / 头像加载完的重绘也都要判断。
   */
  isActive() {
    return !this.exited && this.stage.router && this.stage.router.current() === this;
  }

  /**
   * 离开页面：把"用微信头像"那个原生按钮收掉。
   *
   * ⚠️ 这个不做的话，用户点了按钮但没授权就切页，按钮会一直浮在屏幕上，
   * 而且因为它画在所有 canvas 内容之上，会把下面页面的点击全挡掉。
   */
  onExit() {
    this.exited = true;
    this.cancelCapture();
  }

  /**
   * 被别的页面**盖住**（push 上层，比如点进图鉴）也要收掉。
   *
   * 这一条是测试逼出来的：只写 onExit 的话，账号页 →（push）→ 图鉴，
   * 账号页并没有 exit，那个原生按钮就浮在图鉴页的右上角继续吃点击。
   */
  onPause() {
    this.cancelCapture();
  }

  cancelCapture() {
    if (this.capture) {
      const c = this.capture;
      this.capture = null;
      c.cancel();
    }
  }

  reloadLocal() {
    this.profiles = storage.getProfiles();
    this.activeId = storage.getActiveProfileId();
    this.codexCount = storage.codexCount();
    this.recordCount = storage.getHistory().length;
    this.wechat = CONFIG.ACCOUNT.ENABLE_WECHAT_PROFILE ? wechatprofile.get() : null;
    this.loadAvatar();
  }

  /**
   * 头像图是异步的（本地临时文件或微信 CDN）。
   * 加载完再请求一次重绘就换上了 —— 和角色立绘一个套路。
   */
  loadAvatar() {
    const url = this.wechat && this.wechat.avatarUrl;
    if (!url) {
      this.avatarImg = null;
      return;
    }
    assets.loadImage(url).then((img) => {
      if (!img || !this.isActive()) return;
      if (this.wechat && this.wechat.avatarUrl === url) {
        this.avatarImg = img;
        this.stage.requestRender();
      }
    });
  }

  reloadRemote(checkSession) {
    this.loading = true;
    account.status(checkSession).then((s) => {
      // 页面可能已经被盖住或退掉了，别再往下走（否则会重建页面、重放原生按钮）
      if (!this.isActive()) return;
      this.loading = false;
      this.state = s;
      this.build();
    });
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const s = this.state;
    const st = entitlement.summary();

    const tabH = 108;
    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 29, ring: false }));

    // ---------- 顶部头像行（固定，不随滚动）----------
    // 位置和"用微信头像"那个原生按钮一致，所以先算好矩形，两边共用。
    const avTop = this.stage.contentTop;
    /**
     * ⚠️ 头像行里的坐标一律用**控件本地坐标**。
     *
     * drawSelf 画的是本地坐标（控件原点在 (0, contentTop)），
     * 之前这里把**绝对坐标**喂了进去，整行被画低了 AVATAR_ROW_H=148px，
     * 正好压在下面的「账号」标题上（布局审计抓到的就是这个）。
     * 需要绝对坐标的只有原生按钮 —— 它要换算成屏幕 CSS 像素。
     */
    const avCy = AVATAR_ROW_H / 2 - 6; // 本地
    const btnW = 208;
    const btnH = 68;
    const btnX = W - pad - btnW; // 控件横向铺满，本地 x 与绝对 x 相同
    const btnY = avCy - btnH / 2; // 本地
    // 头像行下面那行小字也用同一套口径：离线说"连不上服务器"，别说"登录已过期"
    const offlineTop = !this.loading && this.state && this.state.ok === false && this.state.offline;
    const statusText0 = this.loading
      ? copy.UI.accountSessionUnchecked
      : offlineTop
      ? copy.UI.accountOffline
      : this.state && this.state.devMode
      ? copy.UI.accountDevMode
      : this.state && this.state.ok
      ? copy.UI.accountLoggedIn
      : copy.UI.accountExpired;

    // 原生按钮要绝对坐标（avTop + 本地）
    this.nativeOk = this.setupCapture(btnX, avTop + btnY, btnW, btnH);
    const avatarRow = new AvatarRow({
      x: 0, y: avTop, w: W, h: AVATAR_ROW_H,
      nickName: (this.wechat && this.wechat.nickName) || '',
      sub: statusText0,
      getAvatar: () => this.avatarImg,
      seed: 29,
      nativeOk: this.nativeOk,
      btnText: this.wechat && this.wechat.avatarUrl ? copy.UI.accountAvatarChange : copy.UI.accountAvatarUse
    });
    avatarRow.cx = pad + AVATAR_R;
    avatarRow.cy = avCy;
    avatarRow.btn = { x: btnX, y: btnY, w: btnW, h: btnH };
    this.root.add(avatarRow);
    if (!this.nativeOk && CONFIG.ACCOUNT.ENABLE_WECHAT_PROFILE) {
      // 没有原生按钮时（未完成隐私授权 / 环境不支持），用热区兜住点击给个说法
      this.root.add(new Hotspot({
        x: btnX, y: avTop + btnY, w: btnW, h: btnH,
        onTap: () => {
          if (!this.privacyReady) {
            this.requestPrivacy();
            this.toast(copy.UI.accountAvatarNeedPrivacy);
          } else {
            this.toast(copy.UI.accountAvatarUnsupported);
          }
        }
      }));
    }

    // 这是三个主页之一（配 TabBar），所以不放返回键 —— 用户在主页之间切换而不是"返回"
    const scroll = new ScrollView({
      x: 0, y: avTop + AVATAR_ROW_H, w: W,
      h: this.stage.height - avTop - AVATAR_ROW_H - tabH
    });
    this.scroll = scroll;
    this.root.add(scroll);

    let y = 20;
    scroll.add(new Label({
      x: pad, y, w: contentW, text: copy.UI.accountTitle,
      size: FONT.hero, weight: '700', color: COLOR.gold
    }));
    y += 96;

    // ---------- 可用次数（最上面：用户最关心"还能占几次"） ----------
    const quotaCard = new Card({ x: pad, y, w: contentW, glow: true });
    const quotaText = st.hasPass
      ? copy.fill(copy.UI.accountQuotaPass, { days: st.passDays })
      : st.freeLeft > 0
      ? copy.fill(copy.UI.accountQuotaFree, { n: st.freeLeft })
      : st.tickets > 0
      ? copy.fill(copy.UI.accountQuotaTicket, { n: st.tickets })
      : copy.UI.accountQuotaNone;
    const quotaColor = st.hasPass || st.freeLeft > 0 || st.tickets > 0 ? COLOR.gold : COLOR.red;

    quotaCard.add(new Label({
      x: 0, y: 0, w: contentW - 56, text: copy.UI.accountQuotaTitle, size: FONT.small, color: COLOR.ink4
    }));
    quotaCard.add(new Label({
      x: 0, y: 0, w: contentW - 56, align: 'right', text: quotaText,
      size: FONT.h3, weight: '700', color: quotaColor
    }));
    quotaCard.content.h = 46;
    quotaCard.fitHeight(0);
    scroll.add(quotaCard);
    y += quotaCard.h + 24;

    // ---------- 资料卡 ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.accountProfilesTitle }));
    y += 64;

    if (!this.profiles.length) {
      scroll.add(new Paragraph({
        x: pad, y, w: contentW, size: FONT.small, color: COLOR.ink3, text: copy.UI.accountProfileEmpty
      }));
      y += 52;
    } else {
      this.profiles.forEach((p) => {
        const card = new ProfileCard({
          x: pad, y, w: contentW, profile: p, active: p.id === this.activeId,
          onStart: (prof) => this.startWith(prof),
          onDelete: (prof) => this.deleteProfile(prof)
        });
        scroll.add(card);
        y += card.h + 14;
      });
    }

    const addBtn = new Button({
      x: pad, y, w: contentW, variant: 'ghost', small: true,
      text: copy.UI.accountProfileAdd,
      onTap: () => this.newProfile()
    });
    addBtn.setEnabled(this.profiles.length < storage.MAX_PROFILES);
    scroll.add(addBtn);
    y += 92;

    if (!this.profiles.length) {
      scroll.add(new Paragraph({
        x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
        text: copy.UI.accountProfileHint
      }));
      y += 50;
    }
    y += 12;

    // ---------- 二级入口 ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: '收集与记录' }));
    y += 64;

    const entriesCard = new Card({ x: pad, y, w: contentW });
    const entries = [
      {
        title: copy.UI.accountEntryCodex,
        value: copy.fill(copy.UI.accountCount, { n: this.codexCount, total: CHARACTERS.length }),
        onTap: () => this.stage.router.push('codex')
      },
      {
        title: copy.UI.accountEntryRecords,
        value: copy.fill(copy.UI.accountRecordsCount, { n: this.recordCount }),
        onTap: () => this.stage.router.push('records')
      },
      {
        title: copy.UI.accountEntryRecharge,
        value: st.hasPass ? copy.fill(copy.UI.rechargePassOn, { days: st.passDays }) : '',
        valueColor: COLOR.gold,
        onTap: () => this.stage.router.push('recharge')
      }
    ];
    let ey = 0;
    entries.forEach((e, i) => {
      entriesCard.add(new EntryRow({
        x: 0, y: ey, w: contentW - 56, title: e.title, value: e.value,
        valueColor: e.valueColor, onTap: e.onTap
      }));
      ey += 96;
      if (i < entries.length - 1) entriesCard.add(new HLine({ x: 0, y: ey - 1, w: contentW - 56 }));
    });
    entriesCard.content.h = ey;
    entriesCard.fitHeight(0);
    scroll.add(entriesCard);
    y += entriesCard.h + 28;

    // ---------- 设置 ----------
    const settingsCard = new Card({ x: pad, y, w: contentW });
    settingsCard.add(new EntryRow({
      x: 0, y: 0, w: contentW - 56,
      title: copy.UI.accountSettings,
      value: '',
      onTap: () => this.stage.router.push('profile')
    }));
    settingsCard.content.h = 96;
    settingsCard.fitHeight(0);
    scroll.add(settingsCard);
    y += settingsCard.h + 28;

    // ---------- 账号信息 ----------
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: '账号' }));
    y += 64;

    // ⚠️ 离线必须说"连不上服务器"，不能说"登录已过期" ——
    //    真机上后端本来就不可达（127.0.0.1 指向手机自己），说成过期会让人以为账号坏了。
    const offline = !this.loading && s && s.ok === false && s.offline;
    const statusText = this.loading
      ? copy.UI.accountSessionUnchecked
      : offline
      ? copy.UI.accountOffline
      : s && s.devMode
      ? copy.UI.accountDevMode
      : s && s.ok
      ? copy.UI.accountLoggedIn
      : copy.UI.accountExpired;
    const statusColor = this.loading
      ? COLOR.ink3
      : offline
      ? COLOR.gold
      : s && s.ok && s.loggedIn
      ? COLOR.green
      : s && s.ok
      ? COLOR.gold
      : COLOR.red;

    const infoCard = new Card({ x: pad, y, w: contentW });
    const infoRows = [{ k: copy.UI.accountLoginLabel, v: statusText, vColor: statusColor }];
    if (s && !s.devMode) {
      infoRows.push({ k: copy.UI.accountIdLabel, v: (s && s.openidMasked) || '—', vColor: COLOR.ink2 });
      let sv = copy.UI.accountSessionUnchecked;
      let sc = COLOR.ink3;
      if (!this.loading && s.session && s.session.checked) {
        sv = s.session.valid ? copy.UI.accountSessionOk : copy.UI.accountSessionLost;
        sc = s.session.valid ? COLOR.green : COLOR.gold;
      } else if (!this.loading && !s.sessionKeyPresent) {
        sv = copy.UI.accountSessionNone;
        sc = COLOR.gold;
      }
      infoRows.push({ k: '登录凭证', v: sv, vColor: sc });
    }
    let iy = 0;
    infoRows.forEach((r, i) => {
      infoCard.add(new Row({ x: 0, y: iy, w: contentW - 56, k: r.k, v: r.v, vColor: r.vColor }));
      iy += 64;
      if (i < infoRows.length - 1) infoCard.add(new HLine({ x: 0, y: iy - 1, w: contentW - 56 }));
    });
    // 离线时把"为什么 + 怎么办"补在这张卡里（Row 的值是右对齐单行，放不下这么长的话）
    if (offline) {
      const hintText = [s.reasonText, s.reasonHint].filter(Boolean).join('\n');
      if (hintText) {
        const hp = new Paragraph({
          x: 0, y: iy + 6, w: contentW - 56, text: hintText,
          size: FONT.micro, color: COLOR.ink4, lineHeight: 34
        });
        infoCard.add(hp);
        iy += hp.h + 6;
      }
    }
    infoCard.content.h = iy;
    infoCard.fitHeight(0);
    scroll.add(infoCard);
    y += infoCard.h + 22;

    // ---------- 操作 ----------
    const busy = !!this.busy;
    const reloginBtn = new Button({
      x: pad, y, w: contentW, variant: 'plain',
      text: busy ? this.busy : copy.UI.accountRelogin,
      onTap: () => this.doRelogin()
    });
    reloginBtn.setEnabled(!busy);
    scroll.add(reloginBtn);
    y += 104;

    const syncBtn = new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true,
      text: busy ? this.busy : copy.UI.accountSync,
      onTap: () => this.doSync()
    });
    syncBtn.setEnabled(!busy);
    scroll.add(syncBtn);
    y += 92;

    const clearBtn = new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true,
      text: copy.UI.accountClear,
      onTap: () => this.doClear()
    });
    clearBtn.setEnabled(!busy);
    scroll.add(clearBtn);
    y += 104;

    scroll.setContentHeight(y);

    // ---------- 底部导航（三个主页共用） ----------
    this.root.add(new TabBar({
      x: 0, y: 0, w: W, h: this.stage.height, active: 2,
    }));
  }

  // ---------------- 微信昵称头像 ----------------

  /**
   * 先过隐私授权，再放按钮。
   *
   * 微信要求：收集昵称头像前用户必须先同意《用户隐私保护指引》
   * （前提是你在 MP 后台声明了这两项）。没同意就调，平台会直接拦掉 ——
   * 表现是"点了按钮什么也没发生"，很难查，所以这里主动先要授权。
   */
  requestPrivacy() {
    if (!CONFIG.ACCOUNT.ENABLE_WECHAT_PROFILE || this.privacyReady) return;
    // 头像昵称属隐私信息：先过协议闸门，再走平台隐私授权
    if (!agreement.hasAgreed()) {
      agreementUi.ensureAgreed(this.stage, () => this.requestPrivacy());
      return;
    }
    wechatprofile.ensurePrivacy().then((ok) => {
      if (!this.isActive()) return;
      this.privacyReady = !!ok;
      if (this.privacyReady) this.build();
    });
  }

  /**
   * 在头像行右侧放一个"用微信头像"的原生按钮。
   *
   * 每次 build 都先销毁旧的再建新的：build 会因为登录态回来、资料卡变动等原因
   * 被调用多次，不这么做就会同时挂着好几个按钮（它们都吃点击）。
   *
   * @returns {boolean} 原生按钮是否已放好（false 则调用方画自己的兜底按钮）
   */
  setupCapture(btnX, btnY, btnW, btnH) {
    this.cancelCapture();
    if (!CONFIG.ACCOUNT.ENABLE_WECHAT_PROFILE || !this.privacyReady) return false;
    // 环境根本不支持（开发者工具、老版本、被平台收回）时只试一次。
    // ⚠️ 不加这个判断会死循环：失败回调里 build → 又建按钮 → 又立刻失败。
    if (this.captureUnsupported) return false;

    const dev = this.stage.dev;
    const text = this.wechat && this.wechat.avatarUrl
      ? copy.UI.accountAvatarChange
      : copy.UI.accountAvatarUse;
    const session = wechatprofile.capture({
      // ⚠️ 原生按钮要的是 **CSS 像素**，不是设计稿坐标
      left: dev.toCss(btnX),
      top: dev.toCss(btnY),
      width: dev.toCss(btnW),
      height: dev.toCss(btnH)
    }, { text, timeoutMs: CONFIG.ACCOUNT.CAPTURE_TIMEOUT_MS });

    this.capture = session;
    session.promise.then((r) => {
      // 已经被新一轮 build（或页面退出）取消掉了：什么都不做
      if (this.capture !== session) return;
      this.capture = null;
      this.onCaptured(r);
    });
    return true;
  }

  onCaptured(r) {
    if (r && r.ok && r.profile) {
      this.wechat = wechatprofile.save(r.profile);
      this.loadAvatar();
      this.toast(copy.UI.accountAvatarSaved);
      this.build();
      return;
    }
    const reason = (r && r.reason) || '';
    // 环境不支持是**永久性**失败：记下来，别再试，否则失败回调里的 build 会无限重试
    const permanent = reason === 'UNSUPPORTED' || reason === 'CREATE_FAILED';
    if (permanent) this.captureUnsupported = true;

    const msg = reason === 'ANONYMOUS'
      ? copy.UI.accountAvatarAnonymous
      : permanent
      ? copy.UI.accountAvatarUnsupported
      : reason === 'TIMEOUT'
      ? copy.UI.accountAvatarTimeout
      : reason === 'DENIED'
      ? copy.UI.accountAvatarDenied
      : '';
    if (msg) this.toast(msg);
    // 失败后原生按钮已被销毁，重建一次让它继续可用（被取消的情况除外）
    if (reason !== 'CANCELLED') this.build();
  }

  // ---------------- 资料卡 ----------------

  /** 用这张资料卡直接开始占卜（用户要的"一键"流程） */
  startWith(profile) {
    storage.setActiveProfileId(profile.id);
    storage.touchProfile(profile.id);
    storage.setProfile(profile);
    gate.requestAccess(this).then((access) => {
      if (!access.ok) return;
      divination.prepare({ profile, mode: 'chart' });
      this.stage.router.push('quiz');
    });
  }

  newProfile() {
    if (this.profiles.length >= storage.MAX_PROFILES) {
      this.toast(copy.fill(copy.UI.accountProfileFull, { n: storage.MAX_PROFILES }));
      return;
    }
    // 新建一张卡并设为默认，然后去首页把生辰填上 ——
    // 首页已经有日期/时辰/城市选择器，没必要在账号页再造一套
    const r = storage.addProfile({
      name: '',
      birthDate: '1998-06-15',
      birthTime: '12:00',
      timeKnown: true,
      city: '北京'
    });
    if (r.profile) {
      storage.setActiveProfileId(r.profile.id);
      storage.setProfile(r.profile);
    }
    this.stage.router.reset('home');
    this.toast('填好生辰后就能一键开始');
  }

  deleteProfile(profile) {
    this.confirm({
      title: copy.UI.accountProfileDelete,
      body: `${profile.name || '未命名'} · ${profile.birthDate}`,
      confirmText: '删除'
    }).then((yes) => {
      if (!yes) return;
      storage.removeProfile(profile.id);
      this.reloadLocal();
      this.toast(copy.UI.accountProfileDeleted);
      this.build();
    });
  }

  // ---------------- 账号操作 ----------------

  doRelogin() {
    if (this.busy) return;
    // 合规：登录前必须过用户协议/隐私政策闸门（覆盖"首启弹窗被跳过"的边角情况）
    if (!agreement.hasAgreed()) {
      agreementUi.ensureAgreed(this.stage, () => this.doRelogin());
      return;
    }
    this.busy = copy.UI.accountRelogining;
    this.build();
    account.relogin().then((r) => {
      this.busy = '';
      if (r.ok) {
        this.toast(copy.UI.accountReloginOk);
        this.reloadRemote(true);
      } else {
        this.toast(r.blocked ? copy.UI.accountBlocked : r.message || copy.UI.accountReloginFail);
        this.build();
      }
    });
  }

  doSync() {
    if (this.busy) return;
    this.busy = copy.UI.accountSyncing;
    this.build();
    playlog.sync().then((r) => {
      this.busy = '';
      if (r && r.ok) {
        this.reloadLocal();
        this.toast(
          r.codexAdded > 0
            ? copy.fill(copy.UI.accountSyncOk, { n: this.codexCount })
            : copy.UI.accountSyncNone
        );
      } else {
        this.toast(r && r.offline ? copy.UI.accountDevMode : copy.UI.accountSyncFail);
      }
      this.build();
    });
  }

  doClear() {
    if (this.busy) return;
    this.confirm({
      title: copy.UI.accountClear,
      body: copy.UI.accountClearConfirm,
      confirmText: '确定清空'
    }).then((yes) => {
      if (!yes) return;
      this.busy = copy.UI.accountSyncing;
      this.build();
      playlog.clearRemote().then((r) => {
        this.busy = '';
        this.toast(r && r.ok ? copy.UI.accountClearOk : copy.UI.accountSyncFail);
        this.reloadRemote(false);
      });
    });
  }

}

module.exports = AccountScene;
