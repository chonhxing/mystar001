const { Scene } = require('../router.js');
const { Widget, Paragraph, Card, SectionTitle, HLine } = require('../ui/widget.js');
const { Button, ScrollView } = require('../ui/interactive.js');
const { Starfield, TopBar, CharCard } = require('../ui/game.js');
const { COLOR, FONT, font } = require('../theme.js');
const copy = require('../../../config/copy.js');
const storage = require('../../../utils/storage.js');
const fmt = require('../../../utils/format.js');
const { CHARACTER_MAP, RARITY } = require('../../../data/characters.js');
const { FATE_MAP } = require('../../../data/fates.js');

/**
 * 占星记录。
 *
 * 数据来自本机（`storage.getHistory()`）+ 账号同步下来的那些（带 source: 'remote' 标记）。
 * 只存"索引级"信息，不存整份命盘 —— 否则 storage 会迅速膨胀。
 * 名字和作品是本地角色表还原的（服务端只给 id），避免两边版本漂移渲染出空白。
 */
class RecordsScene extends Scene {
  constructor(stage, params) {
    super(stage, params);
    this.rows = [];
  }

  onEnter() {
    this.alwaysRender = true;
    this.build();
  }

  onResume() {
    this.build();
  }

  build() {
    const W = this.stage.width;
    const pad = 32;
    const contentW = W - pad * 2;
    const top = this.stage.contentTop + 92;

    this.root.clear();
    this.root.add(new Starfield({ x: 0, y: 0, w: W, h: this.stage.height, seed: 37, ring: false }));
    this.root.add(new TopBar({
      x: pad, y: this.stage.contentTop + 10, w: contentW, h: 72,
      title: copy.UI.recordsTitle,
      onBack: () => this.stage.router.pop()
    }));

    const scroll = new ScrollView({ x: 0, y: top, w: W, h: this.stage.height - top });
    this.scroll = scroll;
    this.root.add(scroll);

    const history = storage.getHistory();
    let y = 16;

    if (!history.length) {
      // 空状态给一句"下一步做什么"，而不是只写"暂无数据"
      scroll.add(new Paragraph({
        x: pad, y: y + 60, w: contentW, align: 'center',
        size: FONT.h3, color: COLOR.ink2, text: copy.UI.recordsEmpty
      }));
      scroll.add(new Paragraph({
        x: pad, y: y + 130, w: contentW, align: 'center',
        size: FONT.small, color: COLOR.ink4, text: copy.UI.recordsEmptyDesc
      }));
      scroll.add(new Button({
        x: pad, y: y + 240, w: contentW, variant: 'ghost',
        text: copy.UI.accountStartNow,
        onTap: () => this.stage.router.reset('home')
      }));
      scroll.setContentHeight(y + 400);
      return;
    }

    scroll.add(new Paragraph({
      x: pad, y, w: contentW, size: FONT.small, color: COLOR.ink4,
      text: copy.fill(copy.UI.recordsCount, { n: history.length })
    }));
    y += 56;

    // 每条记录用一张小卡（复用 CharCard 的 sm 版，和结果页副推一致）
    history.forEach((row) => {
      const char = CHARACTER_MAP[row.mainId];
      if (!char) return;
      const card = new CharCard({
        x: pad, y, w: contentW,
        char, rarity: RARITY[char.rarity], resonance: row.resonance || 0,
        size: 'sm', showFates: false,
        onTap: () => this.stage.router.push('character', { id: char.id })
      });
      scroll.add(card);
      y += card.h + 16;

      // 时间 + 命途标签压在卡片下面（卡片本身放不下这么多信息）
      const meta = [];
      if (row.dominantBadge) meta.push(row.dominantBadge);
      meta.push(fmt.fromNow(row.at));
      if (row.source === 'remote') meta.push('账号');
      scroll.add(new Paragraph({
        x: pad + 8, y: y - 8, w: contentW - 16,
        size: FONT.micro, color: COLOR.ink4, text: meta.join(' · ')
      }));
      y += 42;
    });

    y += 12;
    scroll.add(new Button({
      x: pad, y, w: contentW, variant: 'plain', small: true,
      text: copy.UI.recordsClear,
      onTap: () => this.doClear()
    }));
    y += 120;

    scroll.setContentHeight(y);
  }

  doClear() {
    this.confirm({
      title: copy.UI.recordsClear,
      body: copy.UI.recordsClearConfirm,
      confirmText: '确定清空'
    }).then((yes) => {
      if (!yes) return;
      storage.clearHistory();
      this.toast(copy.UI.recordsCleared);
      this.build();
    });
  }
}

module.exports = RecordsScene;
