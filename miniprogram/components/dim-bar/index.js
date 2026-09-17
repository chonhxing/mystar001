const { axisColor } = require('../../utils/art.js');

/**
 * 八轴条形图。
 * 每根轴都是双极的：左端是 pos（光/秩序/羁绊…），右端是 neg（影/混沌/孤高…），
 * 数值表示"偏 pos 的程度"，所以条形从左往右填充。
 */
Component({
  properties: {
    axes: { type: Array, value: [] },
    // 只显示数值最突出的前 N 根（首页 / 卡片预览用）
    limit: { type: Number, value: 0 },
    // 是否显示两极的短标签
    showPoles: { type: Boolean, value: true }
  },

  data: {
    rows: []
  },

  observers: {
    'axes, limit': function observe(axes) {
      const list = (axes || []).slice();
      const limited = this.data.limit > 0
        ? list.slice().sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50)).slice(0, this.data.limit)
        : list;
      this.setData({
        rows: limited.map((a) => ({
          key: a.key,
          name: a.name,
          pos: a.pos,
          neg: a.neg,
          badge: a.badge,
          value: a.value,
          active: a.value >= 50,
          fillStyle: `width:${Math.max(2, Math.min(100, a.value))}%;background:${axisColor(a.value)};`,
          valueStyle: `color:${axisColor(a.value)}`
        }))
      });
    }
  }
});
