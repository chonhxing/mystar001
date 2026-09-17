const { Scene } = require('../router.js');
const { Label, Paragraph, Hotspot } = require('../ui/widget.js');
const { Starfield } = require('../ui/game.js');
const { COLOR, FONT } = require('../theme.js');
const draw = require('../draw.js');
const copy = require('../../../config/copy.js');
const { CONFIG } = require('../../../config/index.js');
const divination = require('../../../services/divination.js');
const storage = require('../../../utils/storage.js');

const MESSAGES = [
  '星象对齐中…',
  '检索命途样本…',
  '计算共振强度…',
  '正在写下你的解读…'
];

/**
 * 占卜过程场景。
 *
 * 一个体验上的取舍：本地命盘几毫秒就算完了，但 AI 文案可能要几秒。
 * 所以这里**不等网络**——动画放满最短时长就把本地命盘亮给用户看，
 * 并把还没回来的那个 Promise 一起交给结果页，文案到了再原地替换。
 * 用户永远不用盯着"加载中"发呆，也不会因为网络慢就看不到结果。
 */
class CastingScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.elapsed = 0;
    this.minMs = CONFIG.CASTING_MS;
    this.outcome = null;
    this.local = null;
    this.error = null;
    this.gone = false;
  }

  onEnter() {
    this.alwaysRender = true;
    this.input = this.params.input || divination.takePending() ||
      (storage.getProfile() ? { profile: storage.getProfile(), mode: 'chart' } : null);

    if (!this.input) {
      this.error = '没有生辰资料';
      return;
    }

    this.promise = divination
      .run(this.input, {
        onLocal: (r) => {
          this.local = r;
        }
      })
      .then((outcome) => {
        this.outcome = outcome;
        return outcome;
      })
      .catch(() => {
        this.error = '命途读取失败';
        return null;
      });

    this.build();
  }

  build() {
    const W = this.stage.width;
    const cx = W / 2;
    const cy = this.stage.height * 0.42;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 11 }));
    this.root.add(new Hotspot({ x: 0, y: 0, w: W, h: this.stage.height, onTap: () => this.skip() }));

    this.mainLabel = new Label({
      x: 0, y: cy + 190, w: W, align: 'center', text: copy.UI.castingMain, size: FONT.h3, color: COLOR.gold
    });
    this.subLabel = new Label({
      x: 0, y: cy + 246, w: W, align: 'center', text: copy.UI.castingSub, size: FONT.small, color: COLOR.ink4
    });
    this.tipLabel = new Label({
      x: 0, y: this.stage.height - this.stage.safeBottom - 120, w: W, align: 'center',
      text: '点一下可以跳过', size: FONT.micro, color: COLOR.ink4
    });
    this.root.add(this.mainLabel);
    this.root.add(this.subLabel);
    this.root.add(this.tipLabel);
    this.center = { x: cx, y: cy };
  }

  update(dt) {
    this.elapsed += dt;
    const idx = Math.min(MESSAGES.length - 1, Math.floor(this.elapsed / 700));
    if (this.msgIndex !== idx) {
      this.msgIndex = idx;
      this.subLabel.setText(MESSAGES[idx]);
    }
    if (!this.gone && this.elapsed >= this.minMs) {
      // 到点了：有完整结果就跳，没有就先把本地命盘亮出来
      if (this.outcome || this.error || this.local) this.go();
    }
    return true;
  }

  skip() {
    if (this.gone || this.elapsed < 400) return;
    if (this.outcome || this.local) this.go();
    else this.toast('还在读取，稍等一下');
  }

  go() {
    if (this.gone) return;
    this.gone = true;
    if (this.error && !this.local) {
      this.stage.router.replace('result', { error: this.error });
      return;
    }
    if (this.outcome) {
      this.stage.router.replace('result', { outcome: this.outcome });
    } else {
      // AI 还没回来：先把本地结果给结果页，同时把 Promise 交给它续上
      this.stage.router.replace('result', {
        outcome: { result: this.local, source: 'local', notice: '', aiPending: true },
        pending: this.promise
      });
    }
  }

  draw(ctx, stage, t) {
    this.root.draw(ctx, stage, t);
    const { x: cx, y: cy } = this.center;

    // 转环
    const spin = t / 900;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.strokeStyle = 'rgba(232,200,122,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI / 6) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 180, Math.sin(a) * 180);
      ctx.lineTo(Math.cos(a) * 200, Math.sin(a) * 200);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-spin * 0.7);
    ctx.strokeStyle = 'rgba(139,108,240,0.45)';
    ctx.setLineDash && ctx.setLineDash([8, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash && ctx.setLineDash([]);
    ctx.restore();

    // 呼吸光心
    const pulse = 0.5 + 0.5 * Math.sin(t / 420);
    draw.radialGlow(ctx, cx, cy, 130 + pulse * 26, 'rgba(232,200,122,0.30)', 0.85);
    draw.glow(ctx, cx, cy, 42 + pulse * 6, COLOR.gold, 0.5);
    draw.radialGlow(ctx, cx, cy, 300, 'rgba(139,108,240,0.12)', 1);

    // 进度圆环
    const p = Math.min(1, this.elapsed / this.minMs);
    draw.ring(ctx, cx, cy, 218, p, { lineWidth: 4, color: 'rgba(232,200,122,0.75)', track: 'rgba(255,255,255,0.06)' });

    if (this.transition > 0) {
      ctx.save();
      ctx.globalAlpha = this.transition;
      ctx.fillStyle = COLOR.bg;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.restore();
    }
  }
}

module.exports = CastingScene;
