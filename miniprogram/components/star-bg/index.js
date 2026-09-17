/**
 * 星空背景。
 * 现在整块是纯 CSS（渐变星云 + 闪烁星点 + 缓慢转动的十二宫刻度环），
 * 后面要换成 canvas 星云或一张大图，只改这个组件即可，页面完全不用动。
 */
Component({
  properties: {
    // 结果页主推是传说角色时，把光调暖一点
    tone: { type: String, value: 'default' },
    // 是否显示十二宫刻度环
    ring: { type: Boolean, value: true }
  },

  data: {
    ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  }
});
