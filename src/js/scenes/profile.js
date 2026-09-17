const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Card, Panel, SectionTitle, HLine } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar } = require('../ui/game.js');
const { COLOR, FONT, RADIUS, font } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const { CHARACTER_MAP, RARITY, CHARACTERS } = require('../../../data/characters.js');
const { placeLabel } = require('../../../data/cities.js');
const core = require('../../../core/index.js');
const storage = require('../../../utils/storage.js');
const fmt = require('../../../utils/format.js');
const api = require('../../../services/api.js');

/** 可点的设置行 */
class SettingRow extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.title = opts.title || '';
    // desc 是可选的说明小字。不传时标题垂直居中、行高收窄 ——
    // 页面上不再有解释性小字（用户要求），所以大多数行都不带 desc
    this.desc = opts.desc || '';
    this.h = opts.h || (this.desc ? 118 : 92);
    this.switchOn = opts.switchOn;
    this.handler = opts.onTap || null;
    this.dotState = opts.dotState || '';
  }

  onTap() {
    if (this.handler) this.handler(this);
  }

  drawSelf(ctx) {
    ctx.font = font(FONT.body);
    ctx.fillStyle = COLOR.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, 0, this.desc ? 42 : this.h / 2);
    if (this.desc) {
      ctx.font = font(FONT.micro);
      ctx.fillStyle = COLOR.ink4;
      ctx.fillText(text.singleLine(this.desc, this.w - 140, font(FONT.micro)), 0, 82);
    }

    if (this.switchOn !== undefined && this.switchOn !== null) {
      const sw = 104;
      const sh = 56;
      const sx = this.w - sw;
      const sy = (this.h - sh) / 2;
      draw.fillRoundRect(ctx, sx, sy, sw, sh, sh / 2, this.switchOn ? 'rgba(232,200,122,0.16)' : 'rgba(255,255,255,0.06)');
      draw.strokeRoundRect(ctx, sx, sy, sw, sh, sh / 2, this.switchOn ? 'rgba(232,200,122,0.5)' : COLOR.lineSoft, 1);
      ctx.font = font(FONT.tiny, this.switchOn ? '600' : '');
      ctx.fillStyle = this.switchOn ? COLOR.gold : COLOR.ink4;
      ctx.textAlign = 'center';
      ctx.fillText(this.switchOn ? '开' : '关', sx + sw / 2, sy + sh / 2 + 1);
      ctx.textAlign = 'left';
    } else if (this.dotState) {
      const colors = { ok: COLOR.green, warn: COLOR.gold, bad: COLOR.red, off: COLOR.ink4, idle: COLOR.ink4 };
      ctx.beginPath();
      ctx.arc(this.w - 12, this.h / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = colors[this.dotState] || COLOR.ink4;
      ctx.fill();
    }
  }
}

class ProfileScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.settings = { useAi: true, saveHistory: true };
    this.backend = { text: '未检测', state: 'idle' };
  }

  onEnter() {
    this.alwaysRender = true;
    this.reload();
    this.build();
  }

  onResume() {
    this.reload();
    this.build();
  }

  reload() {
    this.profile = storage.getProfile();
    this.settings = storage.getSettings();
    this.codex = storage.getCodex();
    this.history = storage.getHistory();

    this.chartLine = '';
    if (this.profile) {
      try {
        const chart = core.buildChart(this.profile);
        if (chart) {
          const rising = chart.signs.risingKnown && chart.signs.rising ? ` · 上升${chart.signs.rising.name}` : '';
          this.chartLine = `${chart.signs.sun ? chart.signs.sun.name : ''}${rising} · 本命${chart.element.name} · ${chart.rarity.label}`;
        }
      } catch (e) {
        this.chartLine = '';
      }
    }
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const top = this.stage.contentTop + 92;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 23, ring: false }));
    // 设置是二级页（从个人中心进来），所以有返回键
    this.root.add(new TopBar({
      x: pad, y: this.stage.contentTop + 10, w: contentW, h: 72,
      title: copy.UI.accountSettings,
      onBack: () => this.stage.router.pop()
    }));

    const scroll = new ScrollView({ x: 0, y: top, w: W, h: this.stage.height - top });
    this.scroll = scroll;
    this.root.add(scroll);

    let y = 8;

    // ---- 档案 ----
    const avatar = new Panel({ x: pad, y, w: 132, h: 132, radius: 66, fill: 'rgba(139,108,240,0.22)', stroke: 'rgba(232,200,122,0.35)' });
    avatar.drawSelf = (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 132, 132);
      g.addColorStop(0, 'rgba(139,108,240,0.34)');
      g.addColorStop(1, 'rgba(232,200,122,0.14)');
      draw.fillRoundRect(ctx, 0, 0, 132, 132, 66, g);
      draw.strokeRoundRect(ctx, 0, 0, 132, 132, 66, 'rgba(232,200,122,0.35)', 1);
      ctx.font = font(48, '600');
      ctx.fillStyle = COLOR.gold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.profile && this.profile.name ? this.profile.name[0] : '✧', 66, 68);
      ctx.textAlign = 'left';
    };
    scroll.add(avatar);

    const nameX = pad + 160;
    // 三行各自的 y：名字是 52px（行高 68），所以下面两行必须让开它的行框，
    // 否则名字的下缘会和日期那行贴在一起（行高 68 却只隔 54px）。
    scroll.add(new Label({
      x: nameX, y: y + 10, w: W - nameX - pad, text: (this.profile && this.profile.name) || '无名旅人',
      size: FONT.h1, weight: '600', color: COLOR.ink
    }));
    scroll.add(new Label({
      x: nameX, y: y + 84, w: W - nameX - pad,
      text: this.profile
        ? `${this.profile.birthDate}${this.profile.timeKnown ? ` ${this.profile.birthTime}` : '（时辰未知）'} · ${placeLabel(this.profile)}`
        : copy.UI.profileNoData,
      size: FONT.tiny, color: COLOR.ink2
    }));
    scroll.add(new Label({
      x: nameX, y: y + 114, w: W - nameX - pad, text: this.chartLine, size: FONT.micro, color: COLOR.ink4
    }));
    y += 168;

    scroll.add(new Button({
      x: pad, y, w: contentW, small: true, variant: 'ghost', text: copy.UI.profileEdit,
      onTap: () => this.stage.router.reset('home')
    }));
    y += 104;

    // ---- 统计 ----
    const st = new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.profileStatsTitle });
    scroll.add(st);
    y += 68;

    const stats = [
      { n: String(this.history.length), k: copy.UI.profileStatDraw },
      { n: `${Object.keys(this.codex).length}/${CHARACTERS.length}`, k: copy.UI.profileStatCodex },
      { n: String(this.history.filter((h) => h.source !== 'local').length), k: copy.UI.profileStatAi }
    ];
    const cellW = (contentW - 40) / 3;
    stats.forEach((s, i) => {
      const p = new Panel({
        x: pad + i * (cellW + 20), y, w: cellW, h: 148, radius: RADIUS.md,
        fill: 'rgba(255,255,255,0.045)', stroke: COLOR.lineSoft
      });
      scroll.add(p);
      scroll.add(new Label({
        x: pad + i * (cellW + 20), y: y + 30, w: cellW, align: 'center', text: s.n,
        size: 40, weight: '700', color: COLOR.gold
      }));
      scroll.add(new Label({
        x: pad + i * (cellW + 20), y: y + 92, w: cellW, align: 'center', text: s.k,
        size: FONT.micro, color: COLOR.ink4
      }));
    });
    y += 176;

    // ---- 记录 ----
    const st2 = new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.profileHistoryTitle });
    scroll.add(st2);
    y += 68;

    if (!this.history.length) {
      const empty = new Card({ x: pad, y, w: contentW });
      empty.add(new Paragraph({ x: 0, y: 0, w: contentW - 56, text: copy.UI.profileHistoryEmpty, size: FONT.small, color: COLOR.ink4 }));
      empty.fitHeight(0);
      scroll.add(empty);
      y += empty.h + 24;
    } else {
      const hisCard = new Card({ x: pad, y, w: contentW });
      let hy = 0;
      this.history.forEach((h, i) => {
        const c = CHARACTER_MAP[h.mainId];
        const rarity = c ? RARITY[c.rarity] : null;
        const row = new Widget({ x: 0, y: hy, w: contentW - 56, h: 104 });
        row.drawSelf = (ctx) => {
          ctx.font = font(FONT.body);
          ctx.fillStyle = COLOR.ink;
          ctx.textBaseline = 'middle';
          ctx.fillText(h.mainName || (c ? c.name : '未知'), 0, 34);
          ctx.font = font(FONT.micro);
          ctx.fillStyle = COLOR.ink4;
          ctx.fillText(`《${h.mainWork || (c ? c.work : '')}》· ${h.dominantBadge || ''}`, 0, 74);
          ctx.font = font(FONT.body, '600');
          ctx.fillStyle = COLOR.gold;
          ctx.textAlign = 'right';
          ctx.fillText(`${h.resonance || 0}%`, contentW - 56, 34);
          ctx.font = font(FONT.micro);
          ctx.fillStyle = COLOR.ink4;
          ctx.fillText(fmt.fromNow(h.at), contentW - 56, 74);
          ctx.textAlign = 'left';
        };
        hisCard.add(row);
        hy += 104;
        if (i < this.history.length - 1) {
          hisCard.add(new HLine({ x: 0, y: hy - 1, w: contentW - 56 }));
        }
      });
      hisCard.content.h = hy;
      hisCard.fitHeight(0);
      scroll.add(hisCard);
      y += hisCard.h + 24;
    }

    const halfW = (contentW - 24) / 2;
    scroll.add(new Button({
      x: pad, y, w: halfW, small: true, variant: 'plain', text: copy.UI.profileClearHistory,
      onTap: () => this.clearHistory()
    }));
    scroll.add(new Button({
      x: pad + halfW + 24, y, w: halfW, small: true, variant: 'plain', text: copy.UI.profileClearCodex,
      onTap: () => this.clearCodex()
    }));
    y += 112;

    // ---- 设置 ----
    const st3 = new SectionTitle({ x: pad, y, w: contentW, text: copy.UI.profileSettingsTitle });
    scroll.add(st3);
    y += 68;

    const setCard = new Card({ x: pad, y, w: contentW });
    let sy = 0;
    const aiRow = new SettingRow({
      x: 0, y: sy, w: contentW - 56, title: copy.UI.profileAiSwitch, 
      switchOn: this.settings.useAi,
      onTap: (self) => {
        const on = !this.settings.useAi;
        storage.setSettings({ useAi: on });
        this.settings.useAi = on;
        self.switchOn = on;
        self.dirty();
        this.toast(on ? '已开启 AI 深化解读' : '已切回本机解读');
      }
    });
    setCard.add(aiRow);
    setCard.add(new HLine({ x: 0, y: sy + 117, w: contentW - 56 }));
    sy += 118;

    const hisRow = new SettingRow({
      x: 0, y: sy, w: contentW - 56, title: copy.UI.profileSaveSwitch, 
      switchOn: this.settings.saveHistory,
      onTap: (self) => {
        const on = !this.settings.saveHistory;
        storage.setSettings({ saveHistory: on });
        this.settings.saveHistory = on;
        self.switchOn = on;
        self.dirty();
      }
    });
    setCard.add(hisRow);
    setCard.add(new HLine({ x: 0, y: sy + 117, w: contentW - 56 }));
    sy += 118;

    const backendRow = new SettingRow({
      x: 0, y: sy, w: contentW - 56, title: copy.UI.profileBackend,
      // 这一行保留说明：它是**诊断信息**，不是产品文案 ——
      // AI 服务连不上时，用户（和开发者）需要知道连的是哪个地址、为什么不通。
      // ⚠️ 这里只能放**一行短字**（SettingRow 的 desc 不换行）：
      //    短状态放这儿，长提示放下面的段落里
      desc: this.backend.text,
      dotState: this.backend.state,
      onTap: () => this.checkBackend()
    });
    setCard.add(backendRow);
    sy += 118;
    setCard.content.h = sy;
    setCard.fitHeight(0);
    scroll.add(setCard);
    y += setCard.h + 28;

    // 连通性出问题（或 AI 没配）时，把"该怎么办"整段写在卡片下面：
    // 这类提示只有几行字，但它是**唯一**能让用户自己解决的地方，
    // 塞进一行 desc 会被截断成看不懂的半句话
    if (this.backend.detail) {
      const hint = new Paragraph({
        x: pad, y, w: contentW, size: FONT.micro,
        color: this.backend.state === 'bad' ? COLOR.red : COLOR.gold,
        text: this.backend.detail, lineHeight: 34
      });
      scroll.add(hint);
      y += hint.h + 28;
    }

    // ---- 关于 ----
    const aboutCard = new Card({ x: pad, y, w: contentW });
    let ay = 0;
    // 账号与登录放在最前：这是用户最容易困惑的地方（"我要不要注册？"）
    aboutCard.add(new SettingRow({
      x: 0, y: ay, w: contentW - 56, title: copy.UI.accountTitle,
      
      onTap: () => this.stage.router.push('account')
    }));
    ay += 118;
    aboutCard.add(new HLine({ x: 0, y: ay - 1, w: contentW - 56 }));
    aboutCard.add(new SettingRow({
      x: 0, y: ay, w: contentW - 56, title: copy.UI.profileAbout, 
      onTap: () => this.showAbout()
    }));
    ay += 118;
    aboutCard.add(new HLine({ x: 0, y: ay - 1, w: contentW - 56 }));
    aboutCard.add(new SettingRow({
      x: 0, y: ay, w: contentW - 56, title: copy.UI.profileClearAll, 
      onTap: () => this.clearAll()
    }));
    ay += 118;
    aboutCard.content.h = ay;
    aboutCard.fitHeight(0);
    scroll.add(aboutCard);
    y += aboutCard.h + 32;

    scroll.add(new Paragraph({
      x: pad, y, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
      text: `${copy.BRAND.NAME} v${copy.BRAND.VERSION}\n${copy.LEGAL.footer}\n${copy.LEGAL.copyright}`,
      lineHeight: 34
    }));
    y += 200;
    scroll.setContentHeight(y);

  }

  // ---------------- 交互 ----------------

  /**
   * 检测解读服务。
   *
   * 不通时**必须说清是哪一步不通、该怎么办** —— 之前只显示"连不上后端"，
   * 而实际原因就那么几种（域名没勾校验 / 后端没起 / AI 没配 key / 真机连了 127.0.0.1），
   * 每种都有明确的解决办法，不该让用户猜。
   */
  checkBackend() {
    if (!CONFIG.USE_REMOTE) {
      this.toast('已在配置里关闭了远端解读');
      return;
    }
    this.backend = { text: '检测中…', state: 'idle' };
    this.build();
    api.diagnose().then((d) => {
      // 一行短状态（走哪条路 + 通不通），详细"怎么办"放到下面的段落里。
      // 第一次部署时"走的是云调用还是公网"这一条信息能省掉半小时瞎猜：
      // 云调用失败（服务名/环境 ID/没部署）和服务没起，解决办法完全不同。
      const via = d.via === 'cloud' ? '云调用' : '公网';
      const short = d.ok
        ? `${via} · ${d.aiConfigured ? '正常' : 'AI 未配置'}`
        : `${via}失败`;
      this.backend = {
        text: short,
        state: d.ok ? (d.aiConfigured ? 'ok' : 'warn') : 'bad',
        detail: d.ok && d.aiConfigured ? '' : `${d.message}${d.hint ? `\n${d.hint}` : ''}`
      };
      this.build();
    });
  }

  clearHistory() {
    this.confirm({ title: '清空记录', body: '清空所有匹配记录？图鉴不受影响。' }).then((yes) => {
      if (!yes) return;
      storage.clearHistory();
      this.reload();
      this.build();
      this.toast('记录已清空');
    });
  }

  clearCodex() {
    this.confirm({ title: '清空图鉴', body: '所有已遇见的角色会重新变成剪影。' }).then((yes) => {
      if (!yes) return;
      storage.clearCodex();
      this.reload();
      this.build();
      this.toast('图鉴已清空');
    });
  }

  clearAll() {
    this.confirm({ title: '清空全部数据', body: '出生资料、记录、图鉴会一起删除，这一步不能撤销。' }).then((yes) => {
      if (!yes) return;
      storage.clearAll();
      this.reload();
      this.build();
      this.toast('已清空');
    });
  }

  showAbout() {
    this.confirm({
      title: '关于与说明',
      body: copy.UI.profileAboutBody,
      confirmText: '知道了',
      cancelText: '关闭'
    }).then(() => {});
  }
}

module.exports = ProfileScene;
