const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, SectionTitle, Tag, HLine, Hotspot } = require('../ui/widget.js');
const { Button, ScrollView, showPicker, prompt, Segmented, drawSwitchShape } = require('../ui/interactive.js');
const { Starfield, TabBar, TodayCard } = require('../ui/game.js');
const { COLOR, CARD, FONT, font, RADIUS, TXT } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const { PROVINCE_NAMES, provinceLabel, cityNamesOf, districtsOf, cityFullName, placeOf, placeLabel } = require('../../../data/cities.js');
const { CHARACTERS } = require('../../../data/characters.js');
const core = require('../../../core/index.js');
const storage = require('../../../utils/storage.js');
const fmt = require('../../../utils/format.js');
const reward = require('../../../services/reward.js');
const divination = require('../../../services/divination.js');
const entitlement = require('../../../services/entitlement.js');
const gate = require('../../../services/gate.js');
const wechatprofile = require('../../../services/wechatprofile.js');
const assets = require('../assets.js');

const GENDERS = ['保密', '她', '他'];
/** 三个性别各自的图标：不给文字，"保密"用菱形和 ♀ ♂ 区分开 */
const GENDER_ITEMS = [
  { label: '保密', icon: 'diamond' },
  { label: '她', icon: 'female' },
  { label: '他', icon: 'male' }
];

/** 时辰滚轮里那条"不知道"的出路的返回值（和正常的时间数组区分开） */
const TIME_UNKNOWN = 'unknown';

/**
 * 表单里的一行：**左标签、右值、行尾箭头**。
 *
 * 用户明确要求统一成这一种（"表单行统一为：左标签、右值+chevron「›」"）。
 * 之前是"标签在上、值在下"的两行式，一屏看下来像一堆注释；
 * 而且时辰那行的「不知道」按钮是**悬空**挂在右侧的，位置和别的行对不上
 * （用户："去填写按钮不要悬浮在右侧"）。现在那个动作变成行尾的金色文字，
 * 整行可点开选择器、动作文字单独可点。
 */
class FormRow extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    const o = opts || {};
    this.label = o.label || '';
    this.value = o.value === undefined ? '' : String(o.value);
    this.hint = o.hint || '';
    this.action = o.action || '';
    this.h = o.h || (this.hint ? 150 : 104);
    this.chevron = o.chevron !== false;
    this.handler = o.onTap || null;
    this.onAction = o.onAction || null;
    this.valueColor = o.valueColor || TXT.body;
    this.actionColor = o.actionColor || COLOR.gold;
    this.pressed = false;

    // 行尾的动作（「不知道」/「去填写」）是一个**真的按钮子控件**：
    // 自己画一段文字再叠个热区的话，控件树里就没有"这个动作"这个东西了 ——
    // 测试找不到它，无障碍/自动化也认不出它。
    if (this.onAction && this.action) {
      this.actionW = Math.round(text.measure(this.action, font(FONT.tiny, '600')));
      const btnW = this.actionW + 32;
      // 右边留 40px 给行尾箭头（箭头画在 w-12 附近）
      this.actionBtnX = this.w - 40 - btnW;
      this.add(new Button({
        x: this.actionBtnX,
        y: this.h / 2 - 30,
        w: btnW,
        h: 60,
        variant: 'text',
        size: FONT.tiny,
        text: this.action,
        onTap: () => this.onAction()
      }));
    }
  }

  setValue(v) {
    this.value = v === undefined || v === null ? '' : String(v);
    this.dirty();
    return this;
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
    const cy = this.hint ? 50 : this.h / 2;
    ctx.textBaseline = 'middle';

    // 标签：辅助色一档（不要和值抢）
    ctx.font = font(FONT.small);
    ctx.fillStyle = COLOR.ink3;
    ctx.textAlign = 'left';
    ctx.fillText(this.label, 0, cy);

    // 从右往左让位：箭头 → 动作按钮（子控件自己画）→ 值
    let right = this.w - 26;
    if (this.actionW) right = this.actionBtnX - 10;
    const labelW = Math.round(text.measure(this.label, font(FONT.small)));
    ctx.font = font(FONT.body);
    ctx.fillStyle = this.valueColor;
    ctx.textAlign = 'right';
    ctx.fillText(text.singleLine(this.value, right - labelW - 24, font(FONT.body)), right, cy);

    if (this.hint) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.textAlign = 'left';
      ctx.fillText(text.singleLine(this.hint, this.w - 20, font(FONT.micro)), 0, 118);
    }
    if (this.chevron) draw.chevron(ctx, this.w - 12, cy, 11, 'rgba(255,255,255,0.30)');
    draw.hairline(ctx, 0, this.h - 1, this.w, 'rgba(255,255,255,0.06)');
  }
}

/** 开关行（AI 深化解读）：标题 + 说明 + 行尾 iOS 开关 */
class SwitchRow extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.title = opts.title || '';
    this.desc = opts.desc || '';
    this.on = !!opts.on;
    this.h = opts.h || 126;
    this.onChange = opts.onChange || null;
    this.swW = 100;
    this.swH = 60;
    this.t = this.on ? 1 : 0;
  }

  onTap() {
    this.on = !this.on;
    this.dirty();
    if (this.onChange) this.onChange(this.on);
  }

  update(dt) {
    const target = this.on ? 1 : 0;
    if (Math.abs(this.t - target) < 0.01) {
      if (this.t !== target) {
        this.t = target;
        return true;
      }
      return false;
    }
    this.t += (target - this.t) * Math.min(1, dt / 110);
    return true;
  }

  drawSelf(ctx) {
    const sx = this.w - this.swW;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(FONT.body);
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(this.title, 0, 44);
    ctx.font = font(FONT.micro);
    ctx.fillStyle = this.on ? COLOR.ink3 : COLOR.ink4;
    ctx.fillText(text.singleLine(this.desc, this.w - this.swW - 24, font(FONT.micro)), 0, 82);
    drawSwitchShape(ctx, sx, (this.h - this.swH) / 2, this.swW, this.swH, this.on, this.t);
    draw.hairline(ctx, 0, this.h - 1, this.w, 'rgba(255,255,255,0.06)');
  }
}

/**
 * 顶部账号行。
 *
 * 固定在滚动区之上，始终可见 —— 左边进个人中心，右边显示"还能占几次"。
 * 这两件事是用户进主界面最想知道的，不该藏在滚动内容里。
 *
 * ⚠️ 右侧要留出胶囊按钮的位置（stage.contentRight），否则会被原生按钮压住。
 */
class AccountBar extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.h = opts.h || 84;
    this.label = opts.label || '我的';
    this.quota = opts.quota || '';
    this.quotaColor = opts.quotaColor || COLOR.ink3;
    this.rightLimit = opts.rightLimit || 0;
    this.handler = opts.onTap || null;
    this.pressed = false;
    /**
     * ⚠️ 头像是异步加载的，所以这里存**取值函数**而不是图片本身：
     * 存图片的话，"加载完成"那一刻组件手里的引用还是 null，得重建页面才换得上。
     */
    this.getAvatar = opts.getAvatar || (() => null);
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
      draw.fillRoundRect(ctx, 0, 0, this.w, this.h, 20, 'rgba(255,255,255,0.05)');
    }

    // 左：微信头像（有的话）+ 金色描边环 + 文字
    const av = 46;
    const ax = 32;
    const ay = (this.h - av) / 2;
    // 头像还没加载完就画徽记兜底 —— 加载完场景会重绘一次换上（和角色立绘一个套路）
    if (!draw.avatar(ctx, this.getAvatar(), ax + av / 2, ay + av / 2, av / 2)) {
      draw.emblem(ctx, ax + av / 2, ay + av / 2, av / 2, this.label.length * 11, COLOR.gold, false);
      ctx.font = font(20, '700');
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('我', ax + av / 2, ay + av / 2 + 1);
      ctx.textAlign = 'left';
    }
    draw.avatarRing(ctx, ax + av / 2, ay + av / 2, av / 2 + 3, 0, 0.75);

    ctx.font = font(FONT.body, '600');
    ctx.fillStyle = COLOR.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, ax + av + 16, this.h / 2);

    // 右：可用次数（不超过胶囊左侧）
    const rightX = this.rightLimit > 0 ? Math.min(this.w - 32, this.rightLimit - 16) : this.w - 32;
    ctx.font = font(FONT.small, '600');
    ctx.fillStyle = this.quotaColor;
    ctx.textAlign = 'right';
    ctx.fillText(this.quota, rightX, this.h / 2);
    ctx.textAlign = 'left';
  }
}

class HomeScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.form = {
      name: '',
      genderIndex: 0,
      birthDate: '1998-06-15',
      birthTime: '12:00',
      timeKnown: true,
      // 出生地三级：省 → 市 → 区/县（直辖市与港澳台的市和省同名）
      province: '北京',
      city: '北京',
      district: '东城区'
    };
    this.today = null;
    this.useAi = true;
    this.codexCount = 0;
    // 问几道题（10/20/30/50）。存在 settings 里，下次进来还是上次选的
    this.quizCount = core.quizCounts[0];
  }

  onEnter() {
    this.alwaysRender = true; // 星空背景一直在动
    this.loadSaved();
    this.build();
    // banner 广告：首页常驻曝光位（原生控件，贴底部导航上沿，永不遮可点内容）
    reward.mountBanner('home', this.stage);
  }

  /** 从别的场景回来（比如结果页）：额度可能变了，重建界面刷新那行状态 */
  onResume() {
    this.loadSaved();
    this.build();
    reward.mountBanner('home', this.stage);
  }

  onPause() {
    reward.hideBanner();
  }

  onExit() {
    reward.hideBanner();
  }

  loadSaved() {
    const saved = storage.getProfile();
    const settings = storage.getSettings();
    this.useAi = settings.useAi;
    // 题量只认四个档位，存进来的怪值就近取一档
    const counts = core.quizCounts;
    const ci = counts.indexOf(settings.quizCount);
    this.quizCount = counts[ci >= 0 ? ci : 0];
    this.loadAvatar();
    if (saved) {
      const place = placeOf(saved);
      this.form = {
        name: saved.name || '',
        genderIndex: Math.max(0, GENDERS.indexOf(saved.gender || '保密')),
        birthDate: saved.birthDate || '1998-06-15',
        birthTime: saved.birthTime || '12:00',
        timeKnown: saved.timeKnown !== false,
        province: place.province,
        city: place.city,
        district: place.district
      };
      try {
        const chart = core.buildChart(saved);
        if (chart) this.today = { chart, fortune: core.daily(chart, fmt.dateStr()) };
      } catch (e) {
        this.today = null;
      }
    }
    this.codexCount = storage.codexCount();
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 3 }));

    // 顶部账号行：固定在滚动区之上，始终可见
    const barH = 84;
    const st0 = entitlement.summary();
    const quotaText = st0.hasPass
      ? copy.fill(copy.UI.homeQuotaPass, { days: st0.passDays })
      : st0.freeLeft > 0
      ? copy.fill(copy.UI.homeQuotaFree, { n: st0.freeLeft })
      : st0.tickets > 0
      ? copy.fill(copy.UI.homeQuotaTicket, { n: st0.tickets })
      : copy.UI.homeQuotaNone;
    const quotaColor = st0.hasPass || st0.freeLeft > 0 || st0.tickets > 0 ? COLOR.gold : COLOR.red;

    this.root.add(new AccountBar({
      x: 0, y: this.stage.contentTop, w: W, h: barH,
      label: copy.UI.homeAccount,
      quota: quotaText,
      quotaColor,
      rightLimit: this.stage.contentRight,
      getAvatar: () => this.avatarImg,
      onTap: () => this.stage.router.push('account')
    }));

    const scroll = new ScrollView({
      x: 0, y: this.stage.contentTop + barH, w: W,
      h: this.stage.height - this.stage.contentTop - barH - 108
    });
    this.scroll = scroll;
    this.root.add(scroll);

    let y = 24;

    // ---- 标题区 ----
    const title = new Label({ x: pad, y, w: contentW, text: copy.BRAND.NAME, size: FONT.hero, weight: '700', color: COLOR.gold });
    scroll.add(title);
    y += 92;
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, text: copy.UI.homeIntro, size: FONT.small, color: COLOR.ink2, lineHeight: 44, maxLines: 3
    }));
    y += 132;
    scroll.add(new Label({
      x: pad, y, w: contentW, text: copy.UI.homePrivacy, size: FONT.micro, color: COLOR.ink4
    }));
    y += 40;

    // ---- 今日提示（和结果页同一个组件，这里是精简密度） ----
    if (this.today) {
      const card = new TodayCard({
        x: pad, y, w: contentW,
        fortune: this.today.fortune,
        chart: this.today.chart,
        full: false
      });
      scroll.add(card);
      y += card.h + CARD.gap;
    }

    // ---- 生辰表单 ----
    scroll.add(new SectionTitle({ x: pad, y, w: contentW, text: '你的生辰' }));
    y += 64;

    const form = new Card({ x: pad, y, w: contentW });
    let fy = 0;
    const innerW = contentW - CARD.pad * 2;

    form.add(new FormRow({
      x: 0, y: fy, w: innerW, label: copy.UI.homeNameLabel,
      value: this.form.name || '未填写',
      valueColor: this.form.name ? TXT.body : COLOR.ink3,
      onTap: () => this.editName()
    }));
    fy += 104;

    form.add(new Label({ x: 0, y: fy + 8, w: innerW, text: copy.UI.homeGenderLabel, size: FONT.small, color: COLOR.ink3 }));
    form.add(new Segmented({
      x: 0, y: fy + 48, w: innerW, items: GENDER_ITEMS, index: this.form.genderIndex,
      onChange: (i) => {
        this.form.genderIndex = i;
      }
    }));
    fy += 156;

    form.add(new FormRow({
      x: 0, y: fy, w: innerW, label: copy.UI.homeDateLabel, value: this.form.birthDate,
      onTap: () => this.pickDate()
    }));
    fy += 104;

    // 时辰行：行尾一行金色小字就能表达"我不知道/去填写"，
    // 不用点开滚轮再关掉，也不用在行右侧悬空挂一个按钮
    form.add(new FormRow({
      x: 0, y: fy, w: innerW,
      label: copy.UI.homeTimeLabel,
      value: this.form.timeKnown ? this.form.birthTime : copy.UI.homeTimeBlank,
      valueColor: this.form.timeKnown ? TXT.body : COLOR.ink3,
      hint: this.form.timeKnown ? '' : copy.UI.homeTimeHint,
      action: this.form.timeKnown ? copy.UI.homeTimeDunno : copy.UI.homeTimePick,
      onAction: () => this.toggleTime(),
      onTap: () => this.pickTime()
    }));
    fy += this.form.timeKnown ? 104 : 150;

    form.add(new FormRow({
      x: 0, y: fy, w: innerW, label: copy.UI.homeCityLabel, value: placeLabel(this.form),
      hint: copy.UI.homeCityHint,
      onTap: () => this.pickCity()
    }));
    fy += 150;

    const sw = new SwitchRow({
      x: 0, y: fy, w: innerW, title: copy.UI.homeAiLabel,
      desc: this.useAi ? copy.UI.homeAiOn : copy.UI.homeAiOff,
      on: this.useAi,
      onChange: (on) => {
        this.useAi = on;
        storage.setSettings({ useAi: on });
        sw.desc = on ? copy.UI.homeAiOn : copy.UI.homeAiOff;
        this.toast(on ? '解读将由 AI 深化' : '已切回本机解读');
      }
    });
    form.add(sw);
    fy += 126;

    // 题量：题越多图谱越准。总影响力不变（权重按题量归一，见 core/quiz.js）
    form.add(new Label({ x: 0, y: fy + 8, w: innerW, text: copy.UI.homeQuizLabel, size: FONT.small, color: COLOR.ink3 }));
    form.add(new Segmented({
      x: 0, y: fy + 48, w: innerW,
      items: core.quizCounts.map((n) => copy.fill(copy.UI.homeQuizUnit, { n })),
      index: Math.max(0, core.quizCounts.indexOf(this.quizCount)),
      onChange: (i) => {
        this.quizCount = core.quizCounts[i];
        storage.setSettings({ quizCount: this.quizCount });
      }
    }));
    fy += 156;

    form.content.h = fy;
    form.fitHeight(0);
    scroll.add(form);
    y += form.h + 32;

    // ---- 按钮 ----
    const startBtn = new Button({
      x: pad, y, w: contentW, text: copy.UI.homeStart,
      onTap: () => this.start()
    });
    scroll.add(startBtn);
    y += 116;

    const drawBtn = new Button({
      x: pad, y, w: contentW, variant: 'ghost', text: copy.UI.homeDraw,
      onTap: () => this.quickDraw()
    });
    scroll.add(drawBtn);
    y += 116;

    // ---- 进度 ----
    // （可用次数已经移到顶部那行，这里不再重复）
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.small, color: COLOR.ink3,
      text: copy.UI.homeProgress.replace('{n}', this.codexCount).replace('{total}', CHARACTERS.length)
    }));
    y += 60;
    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
      text: `${copy.LEGAL.footer}\n${copy.LEGAL.privacy}`,
      lineHeight: 34
    }));
    y += 140;

    scroll.setContentHeight(y);

    // ---- 底部导航 ----
    this.root.add(new TabBar({
      x: 0, y: 0, w: W, h: this.stage.height, active: 0,
    }));
  }

  // ---------------- 表单交互 ----------------

  /** 微信头像：有就加载，加载完重绘一次换上（没加载完先用徽记兜底） */
  loadAvatar() {
    if (!CONFIG.ACCOUNT.ENABLE_WECHAT_PROFILE) {
      this.avatarImg = null;
      return;
    }
    const w = wechatprofile.get();
    const url = w && w.avatarUrl;
    if (!url) {
      this.avatarImg = null;
      return;
    }
    if (this.avatarImg && this.avatarImg.__src === url) return;
    assets.loadImage(url).then((img) => {
      if (img) {
        img.__src = url;
        this.avatarImg = img;
        this.stage.requestRender();
      }
    });
  }

  editName() {
    prompt({ value: this.form.name, maxLength: 12 }).then((v) => {
      if (v === null) return;
      this.form.name = String(v).slice(0, 12);
      storage.setProfile(this.snapshot());
      this.build();
    });
  }

  pickDate() {
    const cur = this.form.birthDate.split('-').map(Number);
    const nowYear = new Date().getFullYear();
    const years = [];
    for (let y = nowYear; y >= 1930; y -= 1) years.push({ label: `${y}`, value: y });
    const months = [];
    for (let m = 1; m <= 12; m += 1) months.push({ label: `${m} 月`, value: m });
    const daysIn = (y, m) => new Date(y, m, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysIn(cur[0], cur[1]); d += 1) days.push({ label: `${d}`, value: d });

    showPicker(this, {
      title: '出生日期',
      columns: [
        { items: years, index: years.findIndex((i) => i.value === cur[0]) },
        { items: months, index: cur[1] - 1 },
        { items: days, index: Math.min(cur[2] - 1, days.length - 1) }
      ]
    }).then((v) => {
      if (!v) return;
      const [y, m, d] = v;
      const max = daysIn(y, m);
      this.form.birthDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, max)).padStart(2, '0')}`;
      this.persist();
    });
  }

  pickTime() {
    const cur = (this.form.birthTime || '12:00').split(':').map(Number);
    const hours = [];
    for (let h = 0; h < 24; h += 1) hours.push({ label: `${h < 10 ? `0${h}` : h} 时`, value: h });
    const mins = [];
    for (let m = 0; m < 60; m += 1) mins.push({ label: `${m < 10 ? `0${m}` : m} 分`, value: m });

    showPicker(this, {
      title: '出生时辰',
      // 滚轮里也给一条"不知道"的出路：翻到一半发现真不记得了，不用退出去再点
      extra: { text: copy.UI.homeTimeDunno, value: TIME_UNKNOWN },
      columns: [
        { items: hours, index: cur[0] || 0 },
        { items: mins, index: cur[1] || 0 }
      ]
    }).then((v) => {
      if (v === TIME_UNKNOWN) {
        this.setTimeKnown(false);
        return;
      }
      if (!v) return;
      this.form.birthTime = `${String(v[0]).padStart(2, '0')}:${String(v[1]).padStart(2, '0')}`;
      this.form.timeKnown = true;
      this.persist();
    });
  }

  /** 右侧那个小按钮：知道 ↔ 不知道 */
  toggleTime() {
    this.setTimeKnown(!this.form.timeKnown);
  }

  setTimeKnown(known) {
    this.form.timeKnown = !!known;
    // 不清 birthTime：用户手滑点了「不知道」，再点回来时还想看到他刚才选的时间。
    // snapshot() 里"未知就不写 birthTime"，所以落库的仍然是空。
    if (this.form.timeKnown && !this.form.birthTime) this.form.birthTime = '12:00';
    this.persist();
  }

  /**
   * 出生地：三级联动（省级 → 市级 → 区/县）。
   * 后两列的候选项是函数 —— 换了省，市和区的滚轮会跟着重建并回到第一项，
   * 不会留下"广东 · 成都"这种不存在的组合。
   */
  pickCity() {
    const f = this.form;
    const provinceItems = PROVINCE_NAMES.map((n) => ({ label: provinceLabel(n), value: n }));
    showPicker(this, {
      title: '出生地',
      columns: [
        {
          items: provinceItems,
          index: () => Math.max(0, PROVINCE_NAMES.indexOf(f.province))
        },
        {
          items: (v) => cityNamesOf(v[0]).map((n) => ({ label: cityFullName(v[0], n), value: n })),
          index: (v) => Math.max(0, cityNamesOf(v[0]).indexOf(f.city))
        },
        {
          items: (v) => districtsOf(v[0], v[1]).map((n) => ({ label: n, value: n })),
          index: (v) => Math.max(0, districtsOf(v[0], v[1]).indexOf(f.district))
        }
      ]
    }).then((v) => {
      if (!v || !v[0]) return;
      const place = placeOf({ province: v[0], city: v[1], district: v[2] });
      f.province = place.province;
      f.city = place.city;
      f.district = place.district;
      this.persist();
    });
  }

  /** 表单变化：存下资料 + 刷新今日提示 + 重建界面 */
  persist() {
    storage.setProfile(this.snapshot());
    this.loadSaved();
    this.build();
  }

  snapshot() {
    const place = placeOf(this.form);
    return {
      name: String(this.form.name || '').trim().slice(0, 12),
      gender: GENDERS[this.form.genderIndex] === '保密' ? '' : GENDERS[this.form.genderIndex],
      birthDate: this.form.birthDate,
      birthTime: this.form.timeKnown ? this.form.birthTime : '',
      timeKnown: !!this.form.timeKnown,
      province: place.province,
      city: place.city,
      district: place.district,
      cityLabel: place.cityLabel
    };
  }

  // ---------------- 开始 ----------------

  start() {
    const profile = this.snapshot();
    if (!profile.birthDate) {
      this.toast('先选一下出生日期');
      return;
    }
    // 先过准入再动状态。顺序很重要：用户在看广告/付费面板里取消时，
    // 不该留下"资料已存、页面已跳"的半截状态。
    gate.requestAccess(this).then((access) => {
      if (!access.ok) return;
      storage.setProfile(profile);
      divination.prepare({
        profile,
        mode: 'chart',
        quizCount: this.quizCount,
        // 一次性 token：抽题靠它，保证同一次占卜重进答题页不会换题，
        // 而下一次占卜又是新的一套题
        quizToken: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      });
      this.stage.router.push('quiz');
    });
  }

  quickDraw() {
    gate.requestAccess(this).then((access) => {
      if (!access.ok) return;
      divination.prepare({
        profile: { name: String(this.form.name || '').trim().slice(0, 12) },
        mode: 'draw',
        drawToken: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });
      this.stage.router.push('casting');
    });
  }
}

module.exports = HomeScene;
