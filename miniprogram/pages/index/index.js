const core = require('../../core/index.js');
const { placeOf, placeLabel, placeFromRegion, provinceLabel, cityFullName } = require('../../data/cities.js');
const { CHARACTERS } = require('../../data/characters.js');
const storage = require('../../utils/storage.js');
const fmt = require('../../utils/format.js');
const divination = require('../../services/divination.js');

const GENDERS = ['保密', '她', '他'];
const DATE_START = '1930-01-01';
/** 可选题量，和 Canvas 版共用同一份配置 */
const QUIZ_COUNTS = require('../../config/index.js').CONFIG.DIVINATION.QUIZ_COUNTS;

/** 把出生地拼成原生地区选择器要的 ["广东省","深圳市","南山区"] */
function regionOf(place) {
  const p = place || {};
  const arr = [];
  if (p.province) arr.push(provinceLabel(p.province));
  if (p.city) arr.push(cityFullName(p.province, p.city));
  if (p.district) arr.push(p.district);
  return arr;
}

Page({
  data: {
    form: {
      name: '',
      genderIndex: 0,
      birthDate: '1998-06-15',
      birthTime: '12:00',
      timeKnown: true,
      province: '北京',
      city: '北京',
      district: '东城区'
    },
    genders: GENDERS,
    // 三级地区：省级（含直辖市、中国香港/澳门/台湾）→ 市级 → 区/县
    region: ['北京市', '北京市', '东城区'],
    cityLabel: '北京市 东城区',
    dateStart: DATE_START,
    dateEnd: fmt.dateStr(),
    hasProfile: false,
    today: null,
    codexCount: 0,
    totalCharacters: CHARACTERS.length,
    useAi: true,
    aiBackend: true,
    // 问几道题（题越多图谱越准，但总影响力不变，见 core/quiz.js）
    quizCounts: QUIZ_COUNTS,
    quizIndex: 0
  },

  onLoad() {
    const saved = storage.getProfile();
    const settings = storage.getSettings();
    const patch = {
      useAi: settings.useAi,
      aiBackend: require('../../config/index.js').CONFIG.USE_REMOTE,
      // 上次选的题量还在（存 settings，不在生辰资料里）
      quizIndex: Math.max(0, QUIZ_COUNTS.indexOf(settings.quizCount))
    };
    if (saved) {
      const place = placeOf(saved);
      patch.form = {
        name: saved.name || '',
        genderIndex: Math.max(0, GENDERS.indexOf(saved.gender || '保密')),
        // picker 不接受未来日期，历史脏数据兜一下
        birthDate: saved.birthDate || '1998-06-15',
        birthTime: saved.birthTime || '12:00',
        timeKnown: saved.timeKnown !== false,
        province: place.province,
        city: place.city,
        district: place.district
      };
      patch.region = regionOf(place);
      patch.cityLabel = place.cityLabel;
      patch.hasProfile = true;
    }
    this.setData(patch);
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  /** 刷新"今日提示"和收集进度 */
  refresh() {
    const saved = storage.getProfile();
    const settings = storage.getSettings();
    const patch = {
      codexCount: storage.codexCount(),
      useAi: settings.useAi
    };

    if (saved) {
      try {
        // 运势只依赖图谱，不必跑整套匹配
        const chart = core.buildChart(saved);
        if (chart) {
          const fortune = core.daily(chart, fmt.dateStr());
          const dominantAxis = chart.axes.slice().sort(
            (a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50)
          )[0];
          patch.today = {
            date: fortune.date,
            levelName: fortune.levelName,
            starText: fortune.starText,
            levelDesc: fortune.levelDesc,
            good: fortune.good,
            bad: fortune.bad,
            luckyColor: fortune.luckyColor,
            luckyNumber: fortune.luckyNumber,
            luckyItem: fortune.luckyItem,
            sunName: chart.signs.sun ? chart.signs.sun.name : '',
            dominantName: dominantAxis.name,
            dominantBadge: dominantAxis.badge,
            element: chart.element.name,
            rarityLabel: chart.rarity.label
          };
          patch.hasProfile = true;
        }
      } catch (e) {
        patch.today = null;
      }
    } else {
      patch.today = null;
    }
    this.setData(patch);
  },

  // ---------------- 表单 ----------------
  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onGenderTap(e) {
    this.setData({ 'form.genderIndex': Number(e.currentTarget.dataset.index) });
  },

  onDateChange(e) {
    this.setData({ 'form.birthDate': e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ 'form.birthTime': e.detail.value, 'form.timeKnown': true });
  },

  onToggleTime() {
    const next = !this.data.form.timeKnown;
    this.setData({ 'form.timeKnown': next });
    if (next && !this.data.form.birthTime) this.setData({ 'form.birthTime': '12:00' });
    if (!next) fmt.toast('将不计算上升星座与时柱');
  },

  onRegionChange(e) {
    const place = placeFromRegion(e.detail.value);
    this.setData({
      region: e.detail.value,
      cityLabel: place.cityLabel,
      'form.province': place.province,
      'form.city': place.city,
      'form.district': place.district
    });
  },

  onToggleAi() {
    const useAi = !this.data.useAi;
    this.setData({ useAi });
    storage.setSettings({ useAi });
    fmt.toast(useAi ? '解读将由 AI 深化' : '已切回纯本地解读');
  },

  /** 题量：存进 settings，下次进来还是上次选的 */
  onQuizCountChange(e) {
    const i = Number(e.detail.value);
    this.setData({ quizIndex: i });
    storage.setSettings({ quizCount: QUIZ_COUNTS[i] });
  },

  /** 组装一份干净的 profile */
  buildProfile() {
    const f = this.data.form;
    const place = placeOf(f);
    return {
      name: String(f.name || '').trim().slice(0, 12),
      gender: GENDERS[f.genderIndex] === '保密' ? '' : GENDERS[f.genderIndex],
      birthDate: f.birthDate,
      birthTime: f.timeKnown ? f.birthTime : '',
      timeKnown: !!f.timeKnown,
      province: place.province,
      city: place.city,
      district: place.district,
      cityLabel: place.cityLabel
    };
  },

  // ---------------- 入口 ----------------
  onStart() {
    const profile = this.buildProfile();
    if (!profile.birthDate) {
      fmt.toast('先选一下出生日期');
      return;
    }
    storage.setProfile(profile);
    divination.prepare({
      profile,
      mode: 'chart',
      quizCount: QUIZ_COUNTS[this.data.quizIndex],
      // 一次性 token：抽题用它，保证同一次占卜重进答题页不换题，下次又是新的一套
      quizToken: Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    });
    wx.navigateTo({ url: '/pages/quiz/quiz' });
  },

  onQuickDraw() {
    const f = this.data.form;
    divination.prepare({
      profile: { name: String(f.name || '').trim().slice(0, 12) },
      mode: 'draw',
      // 抽签的随机性来自这个 token；不填生辰，所以不需要存档
      drawToken: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });
    wx.navigateTo({ url: '/pages/result/result' });
  },

  onCodex() {
    wx.switchTab({ url: '/pages/codex/codex' });
  },

  onEditAgain() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  onShareAppMessage() {
    return {
      title: '我推的星运 · 看看你的命途像哪个角色',
      path: '/pages/index/index'
    };
  }
});
