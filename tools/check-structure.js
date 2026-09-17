/* eslint-disable no-console */
/**
 * 工程结构静态检查（小游戏 + 小程序两个目标一起查）：
 *   node tools/check-structure.js
 *
 * 微信开发者工具不在这里，编译期错误只能自己提前抓。检查内容：
 *   小游戏侧：game.js/game.json/project.config.json 配置、打包忽略规则、主包体积、场景注册
 *   小程序侧：页面四件套、组件引用、事件绑定、WXML 标签闭合、WXSS 括号
 *   共享代码：core/data/config/services/utils 的副本是否与源一致（防"改了没同步"）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MINI = path.join(ROOT, 'miniprogram');
let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}
function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}
function walk(dir, out) {
  const acc = out || [];
  if (!fs.existsSync(dir)) return acc;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules' || d.name.startsWith('.')) return;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  });
  return acc;
}

// ============================================================ 小游戏工程
section('1. 小游戏工程配置');
{
  const gameJson = readJson(path.join(ROOT, 'game.json'));
  ok(!!gameJson, 'game.json 是合法 JSON');
  ok(!!gameJson && gameJson.deviceOrientation === 'portrait', '竖屏配置（本产品是竖版阅读型）');
  ok(!!gameJson && !!gameJson.networkTimeout, '配置了网络超时（默认 60s 太长，AI 请求要早失败早降级）');
  ok(fs.existsSync(path.join(ROOT, 'game.js')), 'game.js 入口存在');

  const proj = readJson(path.join(ROOT, 'project.config.json'));
  ok(!!proj && proj.compileType === 'game', `project.config.json compileType = ${proj && proj.compileType}`);

  // ⚠️ 这两条是这个项目真实踩过的坑：开发者工具的"过滤无依赖文件"静态分析
  //    认不出入口的 require 时，会把整个 src/ 判成无人引用从代码包里剔掉，
  //    运行时直接报 "module 'src/boot.js' is not defined"。
  ok(!!proj && proj.setting && proj.setting.ignoreUploadUnusedFiles === false,
    '已关闭上传时的"过滤无依赖文件"（ignoreUploadUnusedFiles）');
  const priv = readJson(path.join(ROOT, 'project.private.config.json'));
  const devFilter = priv && priv.setting ? priv.setting.ignoreDevUnusedFiles : undefined;
  ok(devFilter !== true,
    '已关闭本地开发时的"过滤无依赖文件"（ignoreDevUnusedFiles）',
    devFilter === true ? '开发者工具重新生成的私有配置里又打开了，改成 false' : '');
  ok(!proj || proj.setting.resizable !== true, '没有开启可拉伸（画布尺寸只在启动时算一次）');

  // 入口的 require 不能是链式调用：静态分析认不出来，会让依赖被误判为无用。
  // 注意要先剥掉注释再判断 —— 注释里正好写着这个反面例子。
  const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const gameCode = gameSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(String.fromCharCode(10))
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/.*$/, '')))
    .join(String.fromCharCode(10));
  ok(!/require\([^)]*\)\s*\./.test(gameCode), '入口的 require 不是链式调用（require(...).xxx）');
  const reqs = [];
  const re = /require\('([^']+)'\)/g;
  let m = re.exec(gameCode);
  while (m) {
    reqs.push(m[1]);
    m = re.exec(gameCode);
  }
  const missing = reqs.filter((r) => !fs.existsSync(path.join(ROOT, r)));
  ok(reqs.length > 0 && missing.length === 0,
    `入口 require 的 ${reqs.length} 个目标都存在`, missing.join('、') || reqs.join('、'));
  ok(gameSrc.indexOf('showFatal') >= 0, '入口有引导失败的兜底画面（小游戏没有控制台）');
  const ignored = ((proj && proj.packOptions && proj.packOptions.ignore) || []).map((i) => i.value);
  ok(ignored.length > 0, '配置了打包忽略规则');
  ['miniprogram', 'server', 'tools', 'docs'].forEach((d) => {
    ok(ignored.indexOf(d) >= 0, `打包忽略 ${d}/（否则会被打进代码包）`);
  });

  // 主包体积估算：只算会进代码包的文件
  const gameFiles = walk(ROOT, []).filter((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel.charAt(0) === '.') return false;
    const top = rel.split('/')[0];
    if (['miniprogram', 'server', 'tools', 'docs', 'node_modules'].indexOf(top) >= 0) return false;
    return /\.(js|json|png|jpg|jpeg|mp3|wav|m4a)$/i.test(f);
  });
  const size = gameFiles.reduce((s, f) => s + fs.statSync(f).size, 0);
  ok(size < 4 * 1024 * 1024, `主包体积估算 ${(size / 1024).toFixed(0)}KB / 上限 4096KB`, `${gameFiles.length} 个文件`);
}

section('2. 场景与启动链路');
{
  const boot = fs.readFileSync(path.join(ROOT, 'src/js/boot.js'), 'utf8');
  const sceneFiles = fs.readdirSync(path.join(ROOT, 'src/js/scenes')).filter((f) => f.endsWith('.js'));
  const unregistered = sceneFiles.filter((f) => boot.indexOf(`./scenes/${f}`) < 0);
  ok(unregistered.length === 0, `boot 注册了全部 ${sceneFiles.length} 个场景`, unregistered.join('、'));

  const routerSrc = fs.readFileSync(path.join(ROOT, 'src/js/router.js'), 'utf8');
  ['onEnter', 'onExit', 'hitTest', 'update', 'draw'].forEach((m) => {
    ok(routerSrc.indexOf(`${m}(`) >= 0, `场景基类实现 ${m}()`);
  });

  // 上屏画布必须先创建（第一次 createCanvas 返回上屏画布）
  ok(boot.indexOf('stageModule.create()') < boot.indexOf('setCanvasFactory'),
    '启动顺序正确：先建舞台拿到上屏画布，再允许创建离屏画布');
}

section('3. 共享代码同步状态');
{
  const sync = require('./sync-shared.js');
  const r = sync.check();
  ok(r.ok, '小程序工程里的共享代码副本是最新的', r.reason || `${r.count} 个文件`);
  if (!r.ok) console.log('    → 跑一次：npm run sync');
}

// ============================================================ 小程序工程
section('4. 小程序工程（备用 / 参考实现）');
{
  const appJson = readJson(path.join(MINI, 'app.json'));
  ok(!!appJson, 'miniprogram/app.json 是合法 JSON');
  const pages = (appJson && appJson.pages) || [];
  ok(pages.length > 0, `声明了 ${pages.length} 个页面`);

  const missingFiles = [];
  pages.forEach((p) => {
    ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
      if (!fs.existsSync(path.join(MINI, `${p}.${ext}`))) missingFiles.push(`${p}.${ext}`);
    });
  });
  ok(missingFiles.length === 0, '页面四件套齐全', missingFiles.join('、'));

  const tabs = (appJson && appJson.tabBar && appJson.tabBar.list) || [];
  ok(tabs.length >= 2 && tabs.length <= 5, `tabBar 数量合规（${tabs.length} 个）`);

  const proj = readJson(path.join(MINI, 'project.config.json'));
  ok(!!proj && proj.compileType === 'miniprogram',
    `miniprogram/project.config.json compileType = ${proj && proj.compileType}`);

  const jsonFiles = walk(MINI, []).filter((f) => f.endsWith('.json'));
  const badJson = jsonFiles.filter((f) => readJson(f) === null).map((f) => path.relative(ROOT, f));
  ok(badJson.length === 0, `${jsonFiles.length} 个 JSON 可解析`, badJson.join('、'));

  const missComp = [];
  let refCount = 0;
  jsonFiles.forEach((f) => {
    const json = readJson(f);
    if (!json || !json.usingComponents) return;
    Object.keys(json.usingComponents).forEach((tag) => {
      refCount += 1;
      const rel = json.usingComponents[tag];
      const base = rel.charAt(0) === '/' ? path.join(MINI, rel) : path.resolve(path.dirname(f), rel);
      const jsPath = fs.existsSync(base) && fs.statSync(base).isDirectory() ? path.join(base, 'index.js') : `${base}.js`;
      if (!fs.existsSync(jsPath)) missComp.push(`${path.relative(MINI, f)} → ${tag}`);
    });
  });
  ok(missComp.length === 0, `${refCount} 处组件引用可解析`, missComp.join('、'));

  // 事件绑定：用替身加载页面定义，确认处理函数真的存在
  const registered = {};
  global.wx = new Proxy({}, { get: () => () => ({}) });
  global.getApp = () => ({ globalData: {} });
  global.App = () => {};
  global.Component = (cfg) => {
    registered[global.__cur] = cfg;
  };
  global.Page = (cfg) => {
    registered[global.__cur] = cfg;
  };

  const wxmls = walk(MINI, []).filter((f) => f.endsWith('.wxml'));
  const problems = [];
  let bindCount = 0;
  wxmls.forEach((wxml) => {
    const jsPath = wxml.replace(/\.wxml$/, '.js');
    if (!fs.existsSync(jsPath)) return;
    const key = path.relative(ROOT, jsPath).replace(/\\/g, '/');
    global.__cur = key;
    try {
      delete require.cache[require.resolve(jsPath)];
      require(jsPath);
    } catch (e) {
      problems.push(`${key} 加载失败: ${e.message}`);
      return;
    }
    const cfg = registered[key];
    if (!cfg) return;
    const src = fs.readFileSync(wxml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const re = /\b(?:bind|catch|capture-bind|capture-catch)[:-]?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g;
    let m = re.exec(src);
    while (m) {
      const handler = m[2].trim();
      bindCount += 1;
      const inMethods = cfg.methods && typeof cfg.methods[handler] === 'function';
      if (!inMethods && typeof cfg[handler] !== 'function') {
        problems.push(`${path.relative(MINI, wxml)} → ${handler}() 未定义`);
      }
      m = re.exec(src);
    }
  });
  ok(problems.length === 0, `${bindCount} 处事件绑定都有处理函数`, problems.join('; '));

  const VOID = ['image', 'input', 'import', 'include', 'wxs', 'icon', 'progress', 'slider', 'switch', 'audio'];
  const tagProblems = [];
  wxmls.forEach((wxml) => {
    const src = fs.readFileSync(wxml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
    const stack = [];
    let m = re.exec(src);
    while (m) {
      const tag = m[1];
      const selfClose = m[3] === '/';
      const isClose = m[0].charAt(1) === '/';
      if (isClose) {
        const top = stack.pop();
        if (top !== tag) {
          tagProblems.push(`${path.relative(MINI, wxml)}: </${tag}> 与 <${top || '无'}> 不匹配`);
          break;
        }
      } else if (!selfClose && VOID.indexOf(tag) < 0) {
        stack.push(tag);
      }
      m = re.exec(src);
    }
    if (stack.length) tagProblems.push(`${path.relative(MINI, wxml)}: 未闭合 <${stack.join('>, <')}>`);
  });
  ok(tagProblems.length === 0, `${wxmls.length} 个 WXML 标签闭合正确`, tagProblems.join('; '));

  const wxsss = walk(MINI, []).filter((f) => f.endsWith('.wxss'));
  const braceProblems = [];
  wxsss.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    for (let i = 0; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      if (depth < 0) break;
    }
    if (depth !== 0) braceProblems.push(`${path.relative(MINI, f)} 差 ${depth} 个 }`);
  });
  ok(braceProblems.length === 0, `${wxsss.length} 个 WXSS 括号平衡`, braceProblems.join('; '));
}

// ============================================================ 关键约定
section('5. 关键约定与合规');
{
  const { CONFIG } = require(path.join(ROOT, 'config/index.js'));
  ok(typeof CONFIG.API_BASE === 'string' && CONFIG.API_BASE.indexOf('example.com') < 0,
    `接口地址已配置：${CONFIG.API_BASE}`);
  ok(typeof CONFIG.ENABLE_ART === 'boolean', `美术开关 ENABLE_ART = ${CONFIG.ENABLE_ART}`);
  ok(typeof CONFIG.ADS.ENABLED === 'boolean', `广告开关 ADS.ENABLED = ${CONFIG.ADS.ENABLED}（没配广告位时静默跳过）`);

  const art = require(path.join(ROOT, 'utils/art.js'));
  ok(!!art.resolveArt({ id: 'naruto', name: '漩涡鸣人', rarity: 'epic' }).glyph, '美术未就位时占位渲染可用');

  // 合规：用户可见文案里不能出现高风险词（config/copy.js 已做统一替换）
  const copy = require(path.join(ROOT, 'config/copy.js'));
  const visible = JSON.stringify(copy.UI) + JSON.stringify(copy.SCENE) + JSON.stringify(copy.BRAND);
  // ⚠️ 「星座运势」是官方在拒绝情形 3.2.4 里**点名的三个示例词之一**
  //    （原文："不能存在测试类内容；示例：算命，抽签，星座运势等"），
  //    所以它必须出现在禁止列表里，绝不能当成"安全的替换目标"。
  const risky = ['占卜', '算命', '抽签', '运势', '吉凶', '预言', '星座运势', '占星', '命盘'];
  const leaked = risky.filter((w) => visible.indexOf(w) >= 0);
  ok(leaked.length === 0, '用户可见文案里没有高风险词（拒绝情形 3.2.4）', leaked.join('、'));

  // 小游戏场景里的文案也必须来自 copy.js
  const sceneSrcs = walk(path.join(ROOT, 'src/js/scenes'), []);
  const hardcoded = [];
  sceneSrcs.forEach((f) => {
    // 注释里出现这些词无所谓（用户看不到），只看真正会渲染出去的字符串
    const src = fs
      .readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const hits = risky.filter((w) => src.indexOf(w) >= 0);
    if (hits.length) hardcoded.push(`${path.basename(f)}: ${hits.join('、')}`);
  });
  ok(hardcoded.length === 0, '小游戏场景的可见文案里没有高风险词', hardcoded.join('; '));

  // ⚠️ 题库也全是用户可见的文字（题干和选项直接显示在答题页上），必须一起扫。
  //    一千多道题是手写的，很容易顺手写进"运势""命盘"这类词，而它们在提审时是硬伤。
  const qBank = require(path.join(ROOT, 'data/questions.js'));
  const qLeaks = [];
  const qRisky = risky.concat(['星运', '星座']);
  qBank.QUESTIONS.forEach((q) => {
    const blob = q.text + '|' + (q.hint || '') + '|' + q.options.map((o) => o.text).join('|');
    const hits = qRisky.filter((w) => blob.indexOf(w) >= 0);
    if (hits.length) qLeaks.push(`${q.id}: ${hits.join('、')}`);
  });
  ok(qLeaks.length === 0,
    `题库 ${qBank.QUESTIONS.length} 道题的文案里没有高风险词`, qLeaks.slice(0, 5).join('; '));

  // 小程序版的文案是写在 WXML 里的（历史原因），也要一起扫
  const miniWxmls = walk(MINI, []).filter((f) => f.endsWith('.wxml'));
  const wxmlLeaks = [];
  miniWxmls.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const hits = risky.filter((w) => src.indexOf(w) >= 0);
    if (hits.length) wxmlLeaks.push(`${path.relative(MINI, f)}: ${hits.join('、')}`);
  });
  ok(wxmlLeaks.length === 0, '小程序版页面里也没有高风险词', wxmlLeaks.join('; '));

  // 提审红线：运营规范 5.8「游戏测试行为」禁止"利用隐藏小程序的测试内容绕过审核"。
  // 所以不许存在自检/测试场景 —— 这条改成硬检查，防止以后又加回来。
  const sceneDir = path.join(ROOT, 'src/js/scenes');
  const testScenes = fs.existsSync(sceneDir)
    ? fs.readdirSync(sceneDir).filter((f) => /^(smoke|demo|test|debug)/i.test(f))
    : [];
  ok(testScenes.length === 0, '没有自检/测试场景（提审红线 5.8）', testScenes.join('、'));
  // 启动场景必须是首页（开发期可以改成别的页面，但上线前必须改回来）
  if (CONFIG.START_SCENE && CONFIG.START_SCENE !== 'home') {
    console.log(
      `  ⚠ 提醒：START_SCENE 现在是 '${CONFIG.START_SCENE}'（开发用）。` +
        '上线前必须改回 home，否则用户一进来看到的是内页。'
    );
  } else {
    ok(true, '启动场景是首页（START_SCENE = home）');
  }

  // 分包：开了就必须和 game.json 对得上，否则运行时 loadSubpackage 会失败
  const gameJson2 = readJson(path.join(ROOT, 'game.json'));
  const declared = (gameJson2 && gameJson2.subpackages) || [];
  if (CONFIG.SUBPACKAGES && CONFIG.SUBPACKAGES.ENABLED) {
    const want = CONFIG.SUBPACKAGES.LIST.map((x) => x.root);
    const have = declared.map((x) => x.root);
    const missing = want.filter((r) => have.indexOf(r) < 0);
    ok(missing.length === 0, `分包配置与 game.json 一致（${have.length} 个）`, missing.join('、'));
    const noDir = want.filter((r) => !fs.existsSync(path.join(ROOT, r)));
    ok(noDir.length === 0, '分包目录都存在', noDir.join('、'));
  } else {
    ok(declared.length === 0, '没开分包时 game.json 里也没有分包声明');
  }

  const { CHARACTERS } = require(path.join(ROOT, 'data/characters.js'));
  ok(CHARACTERS.length >= 40, `角色库 ${CHARACTERS.length} 个`);
  ok(CHARACTERS.every((c) => c.id && c.name), '每个角色都有 id 与 name');

  // 警示词：不判定失败，但要提醒。它们比"占卜"温和，仍在"星座运势"的邻近区间。
  // 品牌名里就带"占星"，所以不能当失败项 —— 但提审前值得权衡要不要换。
  // 品牌名已去掉"占星"，所以这里只剩真正需要权衡的邻近词。
  // "星座"是命理术语（上升星座/月亮星座），算法本身就依赖它，删不掉。
  const WARN_WORDS = ['星座', '命理', '风水', '星运'];
  const allVisible =
    JSON.stringify(copy.UI) + JSON.stringify(copy.SCENE) + JSON.stringify(copy.BRAND);
  const warned = WARN_WORDS.filter((w) => allVisible.indexOf(w) >= 0);
  if (warned.length) {
    console.log(
      `  ⚠ 提醒：文案里出现了邻近敏感词「${warned.join('、')}」。` +
        '官方点名的示例是"星座运势"，这些词在提审时可能被追问；' +
        '品牌名有安全备选（config/copy.js 的 BRAND.SAFE_NAME）。'
    );
  } else {
    ok(true, '没有出现邻近敏感词（占星/星座/命理/风水）');
  }
}

console.log('\n========================================');
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('全部通过 ✅');
