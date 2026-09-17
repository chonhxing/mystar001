/**
 * 小游戏入口。
 *
 * 小游戏没有 App()/Page()，game.js 就是整包代码的第一行；
 * 真正的工作在 src/js/boot.js 里（框架在 src/js/，美术资源在 src/assets/），
 * 这里只负责把引导过程护住。
 *
 * 这个文件里有两个讲究，都是被开发者工具坑出来的：
 *
 * 1) require 写成「先赋值、再调用」的独立语句，不要写 require('./x.js').start()。
 *    开发者工具有个「过滤无依赖文件」的静态分析（project.private.config.json 里的
 *    ignoreDevUnusedFiles），它读不出来链式调用里的依赖时会认为整个目录没人引用，
 *    直接把文件从代码包里剔掉，运行时就会报 "module 'xxx' is not defined"。
 *
 * 2) 引导失败必须能看见原因：小游戏没有控制台，用户手机上只会看到一片黑。
 *    所以这里用最原始的 canvas API 兜一张错误画面 —— 它不依赖任何模块，不会二次失败。
 */

let boot = null;

try {
  boot = require('./src/js/boot.js');
} catch (e) {
  showFatal('引导模块加载失败', e);
}

if (!boot) {
  // 已经在 showFatal 里报过了
} else if (typeof boot.start !== 'function') {
  showFatal('入口模块里没有 start()', new Error('boot.start 不是函数'));
} else {
  try {
    boot.start();
  } catch (e) {
    showFatal('启动过程出错', e);
  }
}

/**
 * 兜底错误画面。只用 wx.createCanvas + fillText，
 * 任何情况下都不会再抛出，保证"至少能看到出了什么事"。
 */
function showFatal(title, err) {
  const detail = (err && (err.stack || err.message)) || String(err || '未知错误');
  try {
    // eslint-disable-next-line no-console
    console.error('[game] ' + title + ':', detail);

    /**
     * ⚠️ 这里不能随便再调 wx.createCanvas()：**只有第一次调用返回上屏画布**，
     * 之后都是离屏画布。如果引导失败发生在舞台建好之后（比如某个场景的 onEnter 抛了），
     * 这时新建的画布是离屏的 —— 错误画面会画到用户看不见的地方，
     * 表现就是"打开一片黑、什么提示都没有"。所以优先复用舞台上那块画布。
     */
    let canvas = null;
    try {
      const st = boot && typeof boot.getStage === 'function' ? boot.getStage() : null;
      canvas = st && st.canvas ? st.canvas : null;
    } catch (e) {
      canvas = null;
    }
    if (!canvas) canvas = wx.createCanvas(); // 引导更早就失败了：这块就是上屏画布
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // 连画布都用不了，只能靠 console
    const w = canvas.width || 750;
    const h = canvas.height || 1334;
    // 字号按画布实际宽度缩放：画布是物理像素（可能 1170 宽），写死字号在真机上会小到看不清
    const k = Math.max(1, w / 750);
    const px = (n) => Math.round(n * k);

    ctx.fillStyle = '#0B0A1F';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#E86A6A';
    ctx.font = `bold ${px(40)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('启动失败', px(40), px(120));

    ctx.fillStyle = '#E8C87A';
    ctx.font = `${px(30)}px sans-serif`;
    ctx.fillText(title, px(40), px(196));

    // 详情按行硬折，避免长堆栈糊成一片
    ctx.fillStyle = '#A9A4C7';
    ctx.font = `${px(22)}px sans-serif`;
    const max = Math.max(8, Math.floor((w - px(80)) / px(12)));
    const lines = String(detail).split('\n').slice(0, 24);
    let y = px(258);
    lines.forEach((line) => {
      for (let i = 0; i < line.length; i += max) {
        ctx.fillText(line.slice(i, i + max), px(40), y);
        y += px(30);
      }
    });

    ctx.fillStyle = '#6E6A8F';
    ctx.font = `${px(22)}px sans-serif`;
    ctx.fillText('完整报错请看开发者工具的调试器 Console', px(40), h - px(90));
  } catch (e2) {
    // 连兜底都失败就只能放弃了，至少把日志打出去
    // eslint-disable-next-line no-console
    console.error('[game] 兜底画面也失败了', e2);
  }
}
