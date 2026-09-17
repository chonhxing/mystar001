const { CONFIG } = require('../../config/index.js');
const { CHARACTER_MAP, RARITY, CHARACTERS } = require('../../data/characters.js');
const core = require('../../core/index.js');
const storage = require('../../utils/storage.js');
const fmt = require('../../utils/format.js');
const api = require('../../services/api.js');

Page({
  data: {
    version: CONFIG.VERSION,
    profile: null,
    chartLine: '',
    // 微信昵称头像（只存本机）。2022-10-25 之后只能靠 chooseAvatar / nickname 让用户自己选
    wechat: { nickName: '', avatarUrl: '' },
    stats: {
      divinations: 0,
      codexCount: 0,
      totalCharacters: CHARACTERS.length,
      aiCount: 0
    },
    history: [],
    settings: { useAi: true, saveHistory: true },
    backend: { text: '未检测', state: 'idle', base: '' }
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  /**
   * 用户选了一张头像。
   *
   * ⚠️ 拿到的 `avatarUrl` 是**临时路径**，随时会被系统清掉 —— 必须 saveFile 存到
   * 用户目录才能长期用。存失败也不阻塞：先用临时路径显示。
   */
  onChooseAvatar(e) {
    const temp = (e && e.detail && e.detail.avatarUrl) || '';
    if (!temp) return;
    const done = (path) => {
      const next = storage.setWechatProfile({
        nickName: this.data.wechat.nickName || '',
        avatarUrl: path,
        source: 'miniprogram'
      });
      this.setData({ wechat: next || { nickName: '', avatarUrl: '' } });
      fmt.toast('头像已更新');
    };
    if (typeof wx.getFileSystemManager === 'function') {
      try {
        wx.getFileSystemManager().saveFile({
          tempFilePath: temp,
          success: (res) => done((res && res.savedFilePath) || temp),
          fail: () => done(temp)
        });
        return;
      } catch (err) {
        /* 落到下面的兜底 */
      }
    }
    done(temp);
  },

  /**
   * 昵称失焦时保存。
   * 2.24.4 起微信会异步审核昵称，不合规会清空用户输入，所以要在 blur 里读值再存。
   */
  onNicknameBlur(e) {
    const name = String((e && e.detail && e.detail.value) || '').trim().slice(0, 24);
    if (!name || name === this.data.wechat.nickName) return;
    const next = storage.setWechatProfile({
      nickName: name,
      avatarUrl: this.data.wechat.avatarUrl || '',
      source: 'miniprogram'
    });
    this.setData({ wechat: next || { nickName: '', avatarUrl: '' } });
  },

  refresh() {
    const profile = storage.getProfile();
    const settings = storage.getSettings();
    const history = storage.getHistory();
    const codex = storage.getCodex();

    let chartLine = '';
    if (profile) {
      try {
        const chart = core.buildChart(profile);
        if (chart) {
          const sun = chart.signs.sun ? chart.signs.sun.name : '';
          const rising = chart.signs.risingKnown && chart.signs.rising ? ` · 上升${chart.signs.rising.name}` : '';
          chartLine = `${sun}${rising} · 本命${chart.element.name} · ${chart.rarity.label}`;
        }
      } catch (e) {
        chartLine = '';
      }
    }

    const rows = history.map((h) => {
      const c = CHARACTER_MAP[h.mainId];
      const rarity = c ? RARITY[c.rarity] : null;
      return {
        id: h.resultId,
        mainId: h.mainId,
        mainName: h.mainName || (c ? c.name : '未知'),
        work: h.mainWork || (c ? c.work : ''),
        resonance: h.resonance || 0,
        badge: h.dominantBadge || '',
        rarityLabel: rarity ? rarity.label : '',
        rarityKey: c ? c.rarity : 'common',
        timeText: fmt.fromNow(h.at),
        sourceText: h.source === 'local' ? '本地' : 'AI'
      };
    });

    const saved = storage.getWechatProfile();
    this.setData({
      profile,
      chartLine,
      wechat: {
        nickName: (saved && saved.nickName) || '',
        avatarUrl: (saved && saved.avatarUrl) || ''
      },
      history: rows,
      settings,
      stats: {
        divinations: history.length,
        codexCount: Object.keys(codex).length,
        totalCharacters: CHARACTERS.length,
        aiCount: rows.filter((r) => r.sourceText === 'AI').length
      },
      backend: Object.assign({}, this.data.backend, {
        base: CONFIG.API_BASE,
        text: CONFIG.USE_REMOTE ? '未检测' : '已关闭（纯本地）',
        state: CONFIG.USE_REMOTE ? 'idle' : 'off'
      })
    });
  },

  onEdit() {
    wx.switchTab({ url: '/pages/index/index' });
    fmt.toast('在首页改出生资料');
  },

  onToggleAi() {
    const useAi = !this.data.settings.useAi;
    const next = storage.setSettings({ useAi });
    this.setData({ settings: next });
    fmt.toast(useAi ? '已开启 AI 深化解读' : '已切换为纯本地解读');
  },

  onToggleHistory() {
    const saveHistory = !this.data.settings.saveHistory;
    const next = storage.setSettings({ saveHistory });
    this.setData({ settings: next });
  },

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.mainid;
    if (!id) return;
    wx.navigateTo({ url: `/pages/character/character?id=${id}` });
  },

  onCheckBackend() {
    if (!CONFIG.USE_REMOTE) {
      fmt.toast('已在配置里关闭了远端解读');
      return;
    }
    this.setData({ backend: Object.assign({}, this.data.backend, { text: '检测中…', state: 'idle' }) });
    api.health().then((h) => {
      if (h && h.ok) {
        this.setData({
          backend: Object.assign({}, this.data.backend, {
            text: h.ai && h.ai.configured ? '连接正常 · AI 可用' : '连接正常 · AI 未配置',
            state: h.ai && h.ai.configured ? 'ok' : 'warn'
          })
        });
      } else {
        this.setData({
          backend: Object.assign({}, this.data.backend, { text: '连不上后端，将使用本地解读', state: 'bad' })
        });
      }
    });
  },

  onClearHistory() {
    fmt.confirm('清空所有匹配记录？图鉴不受影响。').then((yes) => {
      if (!yes) return;
      storage.clearHistory();
      this.refresh();
      fmt.toast('记录已清空');
    });
  },

  onClearCodex() {
    fmt.confirm('清空图鉴？所有已解锁的角色会重新变成剪影。').then((yes) => {
      if (!yes) return;
      storage.clearCodex();
      this.refresh();
      fmt.toast('图鉴已清空');
    });
  },

  onClearAll() {
    fmt.confirm('清空全部本地数据？包括出生资料、记录和图鉴。这一步不能撤销。').then((yes) => {
      if (!yes) return;
      storage.clearAll();
      this.refresh();
      fmt.toast('已清空');
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于与说明',
      content:
        '图谱由星象（太阳/月亮/上升）与干支（年月日时四柱）算法在你的手机本地计算；' +
        '解读文案由人工智能生成，仅在开启"AI 深化解读"时才会把你的匿名图谱数值发送到服务器（不含姓名和生辰）。' +
        '所有内容仅供娱乐，不构成任何建议。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onShareAppMessage() {
    return { title: '我推的星运 · 看看你的命途像哪个角色', path: '/pages/index/index' };
  }
});
