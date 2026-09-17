const quizCore = require('../../core/quiz.js');
const divination = require('../../services/divination.js');
const fmt = require('../../utils/format.js');

const ADVANCE_DELAY = 260;

/** 把出生日期拼进抽样 seed，和 Canvas 版用的是同一套规则 */
function seedOf(pending) {
  const p = pending || {};
  const birthDate = (p.profile && p.profile.birthDate) || '';
  return (p.quizToken || 'quiz') + '|' + birthDate;
}

/** 多选题的提示文案 */
function hintOf(q) {
  if (!q || !q.multi) return '';
  if (q.multi.min > 1 && q.multi.max > q.multi.min) return '可以多选，' + q.multi.min + '~' + q.multi.max + ' 项';
  if (q.multi.min > 1) return '可以多选，至少 ' + q.multi.min + ' 项';
  return '可以多选，最多 ' + q.multi.max + ' 项';
}

Page({
  data: {
    list: [],
    index: 0,
    current: null,
    total: 0,
    answered: 0,
    progress: 0,
    intro: '',
    picking: -1,
    picked: [],
    multiHint: '',
    canNext: true
  },

  onLoad() {
    // 题量与抽题 token 来自首页，走 core/quiz.js 的分层抽样（同一套题库、同一套规则）
    const pending = divination.peekPending() || {};
    this.input = pending;
    const list = quizCore.listQuestions({
      count: pending.quizCount,
      seed: seedOf(pending)
    });
    this.answers = {};
    this.picked = [];
    this.setData({
      list,
      total: list.length,
      current: list[0],
      intro: '接下来 ' + list.length + ' 个问题没有正确答案。你选得越随意，图谱越像你。',
      progress: Math.round((1 / list.length) * 100),
      multiHint: hintOf(list[0])
    });
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  },

  sync() {
    const list = this.data.list;
    const q = list[this.data.index];
    // 翻回来时要还原这道题之前勾的
    const raw = this.answers[q.id];
    this.picked = raw === undefined ? [] : (Array.isArray(raw) ? raw.slice() : [raw]);
    this.setData({
      current: q,
      picked: this.picked,
      multiHint: hintOf(q),
      canNext: this.canNext(q),
      answered: Object.keys(this.answers).length,
      progress: Math.round(((this.data.index + 1) / list.length) * 100)
    });
  },

  /** 单选题不用等，多选题勾够下限才让走 */
  canNext(q) {
    if (!q || !q.multi) return true;
    return (this.picked || []).length >= q.multi.min;
  },

  /**
   * 单选：点一下就是答案，自动翻页。
   * 多选：点一下切换勾选，勾满上限就不再让勾，要翻页按「下一题」。
   */
  onSelect(e) {
    const optIndex = Number(e.currentTarget.dataset.index);
    const q = this.data.current;
    fmt.vibrate();

    if (!q.multi) {
      this.answers[q.id] = optIndex;
      this.setData({ picking: optIndex });
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.setData({ picking: -1 });
        this.next();
      }, ADVANCE_DELAY);
      return;
    }

    const picked = this.picked || [];
    const at = picked.indexOf(optIndex);
    if (at >= 0) {
      picked.splice(at, 1);
    } else if (picked.length >= q.multi.max) {
      fmt.toast('最多选 ' + q.multi.max + ' 项');
      return;
    } else {
      picked.push(optIndex);
    }
    if (picked.length) this.answers[q.id] = picked.slice();
    else delete this.answers[q.id];
    this.picked = picked;
    this.setData({
      picked: picked.slice(),
      canNext: this.canNext(q),
      answered: Object.keys(this.answers).length,
      picking: optIndex
    });
  },

  /** 多选题的「下一题」 */
  onDone() {
    if (!this.data.canNext) return;
    this.next();
  },

  /** 下一题（最后一题则收尾） */
  next() {
    if (this.data.index >= this.data.list.length - 1) {
      this.finish();
      return;
    }
    this.setData({ index: this.data.index + 1 });
    this.sync();
  },

  onPrev() {
    if (this.data.index <= 0) return;
    this.setData({ index: this.data.index - 1 });
    this.sync();
  },

  onSkipOne() {
    this.next();
  },

  onSkipAll() {
    fmt.confirm('剩下的问题都不答了？图谱会退回纯星象版本。').then((yes) => {
      if (yes) this.finish();
    });
  },

  finish() {
    const pending = divination.peekPending() || {};
    divination.prepare(
      Object.assign({}, pending, {
        answers: this.answers,
        // 真实问了几题：每题权重按它归一（和 Canvas 版一致）
        quizCount: this.data.list.length,
        mode: 'chart'
      })
    );
    wx.redirectTo({ url: '/pages/result/result' });
  }
});
