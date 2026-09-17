const { Scene } = require('../router.js');
const { Widget, Label, Paragraph, Panel, Hotspot, ProgressBar } = require('../ui/widget.js');
const { Button } = require('../ui/interactive.js');
const { Starfield } = require('../ui/game.js');
const { COLOR, FONT, font, RADIUS } = require('../theme.js');
const draw = require('../draw.js');
const text = require('../text.js');
const copy = require('../../../config/copy.js');
const quizCore = require('../../../core/quiz.js');
const divination = require('../../../services/divination.js');
const storage = require('../../../utils/storage.js');
const fmt = require('../../../utils/format.js');

const ADVANCE_DELAY = 260;

/**
 * 一个选项。
 *
 * 单选画圆点、多选画方框 —— 用户不用读提示就知道"这题能不能勾好几个"。
 * 选项数量是变长的（2~6 个），所以行高必须按文案实际折行算，不能写死。
 */
class OptionRow extends Widget {
  constructor(opts) {
    super(Object.assign({ tapEnabled: true }, opts));
    this.label = opts.label || '';
    this.multi = !!opts.multi;
    this.selected = false;
    this.pressed = false;
    this.onSelect = opts.onSelect || null;
    this.layout = text.layoutParagraph({
      text: this.label,
      font: font(FONT.body),
      size: FONT.body,
      lineHeight: 46,
      maxWidth: this.w - 100
    });
    this.h = Math.max(112, this.layout.height + 64);
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
    if (this.onSelect) this.onSelect();
  }

  drawSelf(ctx) {
    draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, this.selected ? 'rgba(232,200,122,0.12)' : 'rgba(255,255,255,0.045)');
    draw.strokeRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, this.selected ? 'rgba(232,200,122,0.6)' : COLOR.lineSoft, 1);
    if (this.pressed) draw.fillRoundRect(ctx, 0, 0, this.w, this.h, RADIUS.md, 'rgba(255,255,255,0.04)');
    if (this.selected) draw.glow(ctx, 48, this.h / 2, 52, COLOR.gold, 0.12);

    const cx = 48;
    const cy = this.h / 2;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(232,200,122,0.5)';
    if (this.multi) {
      // 多选：圆角方框 + 里面的对勾
      draw.roundRectPath(ctx, cx - 12, cy - 12, 24, 24, 7);
      ctx.stroke();
      if (this.selected) {
        draw.fillRoundRect(ctx, cx - 12, cy - 12, 24, 24, 7, COLOR.gold);
        ctx.strokeStyle = '#2A1E05';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 1);
        ctx.lineTo(cx - 1, cy + 6);
        ctx.lineTo(cx + 7, cy - 6);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.stroke();
      if (this.selected) {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.gold;
        ctx.fill();
      }
    }

    this.layout.width = this.w - 100;
    this.layout.size = FONT.body;
    text.drawParagraph(ctx, this.layout, 84, (this.h - this.layout.height) / 2, COLOR.ink);
  }
}

/** 多选提示：'可以多选，最多 3 项' */
function multiHintOf(multi) {
  if (!multi) return '';
  if (multi.min > 1 && multi.max > multi.min) {
    return copy.fill(copy.UI.quizMultiRange, { min: multi.min, max: multi.max });
  }
  if (multi.min > 1) return copy.fill(copy.UI.quizMultiMin, { n: multi.min });
  return copy.fill(copy.UI.quizMultiMax, { n: multi.max });
}

class QuizScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.list = [];
    this.index = 0;
    this.answers = {};
    this.locked = false;
  }

  onEnter() {
    this.alwaysRender = true;
    this.input = divination.peekPending() || { profile: storage.getProfile(), mode: 'chart' };
    // 抽题：题量来自首页那个选择器；seed 里带一次性 token，
    // 所以同一次占卜重进答题页不会换题，下一次占卜又是新的一套题
    const token = this.input.quizToken || 'quiz';
    this.list = quizCore.listQuestions({
      count: this.input.quizCount,
      seed: `${token}|${(this.input.profile && this.input.profile.birthDate) || ''}`
    });
    this.build();
  }

  /** 当前题已勾选的选项 */
  pickedOf(q) {
    const raw = this.answers[q.id];
    if (raw === undefined || raw === null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.filter((i) => typeof i === 'number');
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const top = this.stage.contentTop + 16;
    const total = this.list.length;
    const q = this.list[this.index];
    const picked = this.pickedOf(q);

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 7, ring: false }));

    // ---- 顶部：进度 ----
    this.root.add(new Label({ x: pad, y: top, w: 60, text: `${this.index + 1}`, size: 44, weight: '700', color: COLOR.gold }));
    this.root.add(new Label({ x: pad + 36, y: top + 12, w: 90, text: `/ ${total}`, size: FONT.tiny, color: COLOR.ink4 }));
    this.root.add(new ProgressBar({
      x: pad + 130, y: top + 22, w: contentW - 210, value: (this.index + 1) / total
    }));
    this.root.add(new Hotspot({
      x: W - pad - 90, y: top - 14, w: 90, h: 72,
      onTap: () => this.onSkipAll()
    }));
    this.root.add(new Label({
      x: W - pad - 90, y: top, w: 90, text: copy.UI.skip, size: FONT.small, color: COLOR.ink3, align: 'right'
    }));

    // ---- 题干 ----
    let y = top + 104;
    if (this.index === 0) {
      const intro = new Paragraph({
        x: pad + 24, y: y + 20, w: contentW - 48, text: copy.UI.quizIntro, size: FONT.small,
        color: COLOR.ink2, lineHeight: 44
      });
      const bg = new Panel({
        x: pad, y, w: contentW, h: intro.h + 40, radius: RADIUS.md,
        fill: 'rgba(139,108,240,0.10)', stroke: 'rgba(139,108,240,0.22)'
      });
      this.root.add(bg);
      this.root.add(intro);
      y += bg.h + 40;
    }

    const qPara = new Paragraph({
      x: pad, y, w: contentW, text: q.text, size: FONT.h1, weight: '600', color: COLOR.ink, lineHeight: 74
    });
    this.root.add(qPara);
    y += qPara.h + (q.hint || q.multi ? 16 : 36);

    if (q.hint) {
      this.root.add(new Label({ x: pad, y, w: contentW, text: q.hint, size: FONT.small, color: COLOR.ink4 }));
      y += 52;
    }
    const mHint = multiHintOf(q.multi);
    if (mHint) {
      this.root.add(new Label({ x: pad, y, w: contentW, text: mHint, size: FONT.small, color: COLOR.gold }));
      y += 52;
    }

    // ---- 选项（2~6 个不等） ----
    this.optionRows = [];
    q.options.forEach((opt, i) => {
      const row = new OptionRow({
        x: pad, y, w: contentW, label: opt.text, multi: !!q.multi,
        onSelect: () => this.select(i)
      });
      row.selected = picked.indexOf(i) >= 0;
      this.optionRows.push(row);
      this.root.add(row);
      y += row.h + 24;
    });

    // ---- 底部 ----
    const footY = this.stage.height - this.stage.safeBottom - 116;
    const halfW = (contentW - 24) / 2;
    const prev = new Button({
      x: pad, y: footY, w: halfW, small: true, variant: 'plain', text: copy.UI.quizPrev,
      onTap: () => this.prev()
    });
    prev.setEnabled(this.index > 0);
    this.root.add(prev);

    if (q.multi) {
      // 多选：右下角是「下一题」，勾够了下限才亮
      const done = new Button({
        x: pad + halfW + 24, y: footY, w: halfW, small: true, variant: 'primary', text: copy.UI.quizMultiDone,
        onTap: () => this.next()
      });
      done.setEnabled(picked.length >= q.multi.min);
      this.root.add(done);
      // 还是想跳过这一题的话，下面留一条
      this.root.add(new Hotspot({
        x: pad, y: footY + 74, w: contentW, h: 56, onTap: () => this.next()
      }));
      this.root.add(new Paragraph({
        x: pad, y: footY + 86, w: contentW, align: 'center', size: FONT.small, color: COLOR.ink3,
        text: copy.UI.quizSkip
      }));
    } else {
      this.root.add(new Button({
        x: pad + halfW + 24, y: footY, w: halfW, small: true, variant: 'plain', text: copy.UI.quizSkip,
        onTap: () => this.next()
      }));
      this.root.add(new Paragraph({
        x: pad, y: footY + 84, w: contentW, align: 'center', size: FONT.micro, color: COLOR.ink4,
        text: copy.UI.quizAnswered.replace('{n}', String(Object.keys(this.answers).length))
      }));
    }
  }

  /**
   * 单选：选中即自动翻页（老手感）。
   * 多选：点一下切换选中，勾满上限就不再让勾，要翻页按「下一题」。
   */
  select(i) {
    if (this.locked) return;
    const q = this.list[this.index];
    fmt.vibrate();

    if (!q.multi) {
      this.locked = true;
      this.answers[q.id] = i;
      this.optionRows[i].selected = true;
      this.optionRows[i].dirty();
      setTimeout(() => {
        this.locked = false;
        this.next();
      }, ADVANCE_DELAY);
      return;
    }

    const picked = this.pickedOf(q);
    const at = picked.indexOf(i);
    if (at >= 0) {
      picked.splice(at, 1);
    } else {
      if (picked.length >= q.multi.max) {
        this.toast(copy.fill(copy.UI.quizMultiMax, { n: q.multi.max }));
        return;
      }
      picked.push(i);
    }
    if (picked.length) this.answers[q.id] = picked.slice();
    else delete this.answers[q.id];
    this.build();
  }

  next() {
    if (this.locked) return;
    if (this.index >= this.list.length - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.build();
  }

  prev() {
    if (this.index <= 0) return;
    this.index -= 1;
    this.build();
  }

  onSkipAll() {
    this.confirm({ title: '跳过剩余问题', body: copy.UI.quizSkipConfirm }).then((yes) => {
      if (yes) this.finish();
    });
  }

  finish() {
    const base = this.input || {};
    divination.prepare(Object.assign({}, base, {
      answers: this.answers,
      // 真实问了几题（题库不够时可能少于所选档位），权重按它归一
      quizCount: this.list.length,
      mode: 'chart'
    }));
    this.stage.router.replace('casting');
  }
}

module.exports = QuizScene;
