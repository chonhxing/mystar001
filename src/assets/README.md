# 美术资源（可选）

**当前一张图都不需要。** 角色卡走「星徽 + 文字」：
徽记按角色 id 稳定生成（同心多边形 + 星芒 + 名字首字，见 `../js/draw.js` 的 `emblem`），
所以整个游戏零美术资源就能跑、能看、能上架。

这也顺带规避了版权风险（引用作品的角色，用官方立绘有风险）和包体压力（主包只有 334KB）。

## 想加立绘的话

```
assets/chars/<角色id>.png     ← 3:4 竖版，建议 750×1000，单张 < 150KB
```

角色 id 见 `docs/WHAT-I-NEED.md` 末尾的表（就是 `data/characters.js` 里的 `id`）。
放好之后把 `config/index.js` 的 `ENABLE_ART` 改成 `true`，卡片顶部的徽记区会换成图片。

⚠️ 格式只能用 **png / jpg**。`webp` **不在小游戏的文件白名单里**，上传会失败。

## 其它可替换位

| 位置 | 现状 | 怎么换 |
| --- | --- | --- |
| 星空背景 | 纯代码：星云渐变 + 闪烁星点 + 转动的十二宫刻度环 | `src/js/ui/game.js` 的 `Starfield` 里改成 `drawImage` |
| 占卜仪式 | 纯代码：转环 + 呼吸光 + 进度环 | `src/js/scenes/casting.js` 的 `draw` |
| 图标 | 文字/几何图形 | 加 `assets/icons/*.png`，在控件里换 `drawImage` |
| 音频 | 没有（缺文件就静默不播） | 加 `assets/audio/*.mp3`，接 `wx.createInnerAudioContext()`（用完记得 `destroy()`） |
