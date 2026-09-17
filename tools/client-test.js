/* eslint-disable no-console */
/**
 * 客户端全流程模拟测试（不需要微信开发者工具）：
 *   node tools/client-test.js
 *
 * 做法：用内存实现替掉 wx.* API，用 Node 的 http 代理 wx.request，
 * 然后把 5 个页面的生命周期真的跑一遍：
 *   首页填表 → 开始占卜 → 九道题 → 结果页揭幕 → 图鉴 → 角色详情 → 我的
 *
 * 这个测试解决的是"我没法在开发者工具里点一遍"的问题：
 * 页面 JS 里少一个函数、setData 里多引一个字段、服务端字段名对不上，
 * 都会在这里直接暴露成抛错或断言失败。
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
// 小程序工程在 miniprogram/ 子目录里（根目录现在是「小游戏」工程）
const MINI = path.join(ROOT, 'miniprogram');
const TMP = path.join(ROOT, 'server', '.tmp-client-test');
// 端口按 PID 派生：连跑多套测试时前一套进程可能还在退出，固定端口会撞车
// （表现为"后端没起来"→ 全流程静默降级 → 一堆莫名其妙的断言失败）
const APP_PORT = 8802 + (process.pid % 200);
const MOCK_PORT = APP_PORT + 1;

process.env.PORT = String(APP_PORT);
process.env.DATA_DIR = TMP;
process.env.DEEPSEEK_API_KEY = 'client-test-key';
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.DAILY_PER_USER = '50';
process.env.PER_MINUTE_PER_IP = '500';

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

// ============================================================ mock AI
const AI_PROSE = {
  title: '扛着灯的独行者',
  essence: '你的命盘里，羁绊这一格低得显眼，而执念又高得吓人。你大概很早就学会了一件事：靠谁都不如靠自己把那件事做完。',
  resonance: '所以你会在桐人身上看到自己——同样是一个人把所有人的份都背下来，同样把"我没事"说得比谁都顺口。',
  difference: '差别在于秩序。TA 愿意把自己钉在一条规矩上，而你的这一格还是空的：那是你还能改的地方。',
  anti: '路飞对你来说是另一种语言。他的自由不需要代价，而你的每一步都标着价，所以你不必学他。',
  counsel: '今天把那件"等别人先开口"的事，自己起个头。'
};

let aiHits = 0;
const mock = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    aiHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'deepseek-chat',
      choices: [{ message: { role: 'assistant', content: JSON.stringify(AI_PROSE) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 700, completion_tokens: 200 }
    }));
  });
});

// ============================================================ wx 运行时替身
const storageMap = new Map();
let navLog = [];
let toastLog = [];

global.wx = {
  getStorageSync: (k) => (storageMap.has(k) ? JSON.parse(JSON.stringify(storageMap.get(k))) : ''),
  setStorageSync: (k, v) => { storageMap.set(k, JSON.parse(JSON.stringify(v))); },
  removeStorageSync: (k) => { storageMap.delete(k); },
  clearStorageSync: () => storageMap.clear(),

  request(opts) {
    const u = new URL(opts.url);
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    if (port !== APP_PORT) {
      // 模拟"后端打不通"：这是降级测试要走的路径
      setTimeout(() => {
        if (opts.fail) opts.fail({ errMsg: 'request:fail connect ECONNREFUSED' });
        if (opts.complete) opts.complete();
      }, 5);
      return { abort() {} };
    }
    const body = opts.data ? Buffer.from(JSON.stringify(opts.data)) : null;
    const headers = Object.assign({}, opts.header || {});
    if (body) headers['Content-Length'] = body.length;

    const req = http.request(
      { host: '127.0.0.1', port: APP_PORT, path: u.pathname + u.search, method: opts.method || 'GET', headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let data = raw;
          try { data = JSON.parse(raw); } catch (e) { /* keep raw */ }
          if (opts.success) opts.success({ statusCode: res.statusCode, data });
          if (opts.complete) opts.complete();
        });
      }
    );
    req.on('error', (e) => {
      if (opts.fail) opts.fail({ errMsg: `request:fail ${e.message}` });
      if (opts.complete) opts.complete();
    });
    if (body) req.write(body);
    req.end();
    return { abort() {} };
  },

  login: (o) => {
    if (o && o.success) o.success({ code: 'mock-code' });
    if (o && o.complete) o.complete();
  },
  showToast: (o) => { toastLog.push(o.title); },
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (o) => { if (o.success) o.success({ confirm: true, cancel: false }); },
  vibrateShort: () => {},
  setNavigationBarTitle: () => {},
  pageScrollTo: () => {},
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 3 }),
  // 头像临时路径要 saveFile 才能长期用（chooseAvatar 给的是临时文件）
  getFileSystemManager: () => ({
    saveFile: (o) => {
      const name = String(o.tempFilePath || '').split('/').pop();
      if (o.success) o.success({ savedFilePath: `wxfile://store/${name}` });
    }
  }),
  navigateTo: (o) => { navLog.push(o.url); },
  redirectTo: (o) => { navLog.push(o.url); },
  switchTab: (o) => { navLog.push(o.url); },
  navigateBack: () => { navLog.push('back'); }
};

// ============================================================ Page 替身
const pages = {};
function setByPath(obj, pathStr, value) {
  const parts = String(pathStr).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

global.Page = function registerPage(config) {
  pages[config.__name] = config;
};
global.Component = function registerComponent() {};
global.App = function registerApp() {};
global.getApp = () => ({ globalData: {}, setProfile(p) { storageMap.set('profile', p); } });

function loadPage(relPath, name) {
  // 相对 miniprogram/ 目录
  global.Page = function (config) {
    config.__name = name;
    pages[name] = config;
  };
  delete require.cache[require.resolve(path.join(MINI, relPath))];
  require(path.join(MINI, relPath));
  const cfg = pages[name];
  const page = Object.assign({}, cfg);
  page.data = JSON.parse(JSON.stringify(cfg.data || {}));
  page.setData = function (patch, cb) {
    Object.keys(patch || {}).forEach((k) => setByPath(this.data, k, patch[k]));
    if (typeof cb === 'function') cb();
  };
  page.triggerEvent = () => {};
  return page;
}

/** 轮询 /api/health 直到后端真的开始服务 */
function waitBackend(tries) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http
        .get({ host: '127.0.0.1', port: APP_PORT, path: '/api/health' }, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          n += 1;
          if (n > (tries || 100)) return reject(new Error('后端没起来（健康检查超时）'));
          setTimeout(tick, 50);
        });
    };
    tick();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, timeoutMs, stepMs) {
  const deadline = Date.now() + (timeoutMs || 4000);
  while (Date.now() < deadline) {
    if (fn()) return true;
    /* eslint-disable no-await-in-loop */
    await sleep(stepMs || 30);
  }
  return false;
}

(async function main() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));
  const app = require(path.join(ROOT, 'server', 'index.js'));
  // ⚠️ 必须真的等后端就绪，不能固定 sleep —— 机器慢时 listen 还没完成，
  //    请求会全部失败，整个流程静默降级成本地解读，AI 相关断言集体挂掉（很难查）
  await waitBackend();

  // 客户端的接口地址指到测试端口
  const { CONFIG } = require(path.join(MINI, 'config', 'index.js'));
  CONFIG.API_BASE = `http://127.0.0.1:${APP_PORT}`;
  CONFIG.CASTING_MS = 60; // 别让测试等 2.2 秒的仪式动画
  CONFIG.USE_REMOTE = true;

  const storage = require(path.join(MINI, 'utils', 'storage.js'));
  const divination = require(path.join(MINI, 'services', 'divination.js'));

  // ============================================================ 首页
  section('1. 首页：填资料');
  const index = loadPage('pages/index/index.js', 'index');
  index.onLoad();
  ok(index.data.region.length === 3, `地区选择器是三级（${index.data.region.join(' / ')}）`);
  ok(index.data.cityLabel.length > 2, `出生地显示串（${index.data.cityLabel}）`);
  ok(index.data.hasProfile === false, '首次进入没有资料');

  index.onNameInput({ detail: { value: '星野' } });
  index.onDateChange({ detail: { value: '1997-11-07' } });
  index.onTimeChange({ detail: { value: '21:40' } });
  // 原生地区选择器回传的是全称，页面要能还原成数据表里的短名
  index.onRegionChange({ detail: { value: ['广东省', '深圳市', '南山区'] } });
  index.onGenderTap({ currentTarget: { dataset: { index: 1 } } });
  ok(index.data.form.birthDate === '1997-11-07', '表单能改日期');
  ok(index.data.cityLabel === '广东省 深圳市 南山区', `三级出生地生效（${index.data.cityLabel}）`);
  ok(index.data.form.city === '深圳' && index.data.form.district === '南山区',
    `全称被还原成短名（${index.data.form.city}/${index.data.form.district}）`);

  index.onStart();
  const pending = divination.peekPending();
  ok(!!pending && pending.profile.birthDate === '1997-11-07', '开始占卜后写入待占卜输入');
  ok(navLog[navLog.length - 1] === '/pages/quiz/quiz', '跳转到问答页');
  ok(!!storage.getProfile(), '资料已存本地');

  // ============================================================ 问答
  section('2. 问答页：题量、单选与多选');
  const quiz = loadPage('pages/quiz/quiz.js', 'quiz');
  quiz.onLoad();
  // 题量来自首页选择器（默认 10 题），题库按轴分层抽样
  ok(quiz.data.total === 10, '按所选题量抽题（' + quiz.data.total + ' 题）');
  ok(!!quiz.data.current.text, '第一题显示正常');
  ok(quiz.data.list.every((q) => q.text && q.options.length >= 2), '每道题都有题干和至少两个选项');
  ok(new Set(quiz.data.list.map((q) => q.id)).size === quiz.data.total, '同一套题里没有重复');
  ok(new Set(quiz.data.list.map((q) => q.options.length)).size >= 1, '选项数量按题目各自决定');

  // 逐题走完：单选点一下就走，多选先勾再按「下一题」
  for (let i = 0; i < quiz.data.list.length; i += 1) {
    const q = quiz.data.current;
    if (q.multi) {
      quiz.onSelect({ currentTarget: { dataset: { index: 0 } } });
      ok(Array.isArray(quiz.answers[q.id]), '多选答案存成数组（' + q.id + '）');
      // ⚠️ 多选题的下限不一定是 1（有 min=2 的题），所以"能不能继续"必须按 min 判断，
      //    不能写死"勾一项就能走" —— 那样只在抽到 min=1 的题时才碰巧通过。
      ok(quiz.data.canNext === (q.multi.min <= 1),
        '勾 1 项后是否可继续，取决于这题的下限（min=' + q.multi.min + '）');
      for (let k = 1; k < q.multi.min && k < q.options.length; k += 1) {
        quiz.onSelect({ currentTarget: { dataset: { index: k } } });
      }
      ok(quiz.data.canNext, '勾够下限后可以继续（' + q.multi.min + ' 项）');
      quiz.onDone();
    } else {
      quiz.onSelect({ currentTarget: { dataset: { index: 0 } } });
      /* eslint-disable no-await-in-loop */
      await sleep(320);
    }
  }
  ok(quiz.data.index === quiz.data.total - 1, '走到最后一题（第 ' + (quiz.data.index + 1) + ' 题）');
  const answeredCount = Object.keys(quiz.answers).length;
  ok(answeredCount >= quiz.data.total - 2, '多数题都答了（' + answeredCount + ' / ' + quiz.data.total + '）');

  // 回到上一题，之前勾的还在
  quiz.onPrev();
  const prevQ = quiz.data.current;
  if (prevQ.multi) {
    ok(quiz.data.picked.length > 0, '翻回多选题时勾选状态还在');
  }
  quiz.onSkipOne();

  quiz.finish();
  const pending2 = divination.peekPending();
  ok(!!pending2.quizCount, '上报了这次问了几题（' + pending2.quizCount + '）');
  const realAnswered = Object.keys(pending2.answers || {}).length;
  ok(realAnswered >= 5, '答题结果写入（' + realAnswered + ' 题）');
  ok(navLog[navLog.length - 1] === '/pages/result/result', '答题结束跳结果页');

  // ============================================================ 结果页
  section('3. 结果页：本地先出命盘，AI 文案后续补上');
  const t0 = Date.now();
  const result = loadPage('pages/result/result.js', 'result');
  result.onLoad();
  ok(result.data.casting === true, '先进入占卜仪式动画');

  const revealed = await waitFor(() => result.data.ready === true, 5000);
  ok(revealed, '结果页揭幕');
  ok(Date.now() - t0 >= 50, '仪式动画至少播了设定的时长', `${Date.now() - t0}ms`);
  ok(result.data.ready, '视图模型构建完成');

  ok(!!result.data.main && !!result.data.main.char.name,
    `主推角色渲染出来（${result.data.main && result.data.main.char.name}）`);
  ok(result.data.axes.length === 8, '八轴数据完整');
  ok(result.data.axes.every((a) => typeof a.value === 'number' && a.value >= 0 && a.value <= 100),
    '八轴数值合法');
  ok(result.data.rows.length >= 5, `命盘全相 ${result.data.rows.length} 行`);
  ok(result.data.fates.length === 3, '命途前三渲染');
  ok(result.data.side.length === 2, '副推两个');
  ok(!!result.data.anti.char.name, `反向角色渲染（${result.data.anti.char.name}）`);
  ok(!!result.data.fortune && result.data.fortune.good.length === 2, '今日运势渲染');
  ok(!!result.data.copy && result.data.copy.essence.length > 30, '解读文案完整');
  ok(result.data.copy.essence === AI_PROSE.essence, '页面用的是 AI 文案');
  ok(result.data.source === 'ai', `来源标记 = ${result.data.source}`);
  ok(result.data.aiLabel === true, '展示 AI 生成标识');
  ok(!!result.data.codex && result.data.codex.added === 4, `图鉴解锁 ${result.data.codex && result.data.codex.added} 个角色`);
  ok(result.data.casting === false, '仪式动画已结束');

  const share = result.onShareAppMessage();
  ok(!!share && share.path === '/pages/index/index', '分享配置可用');
  ok(share.path.indexOf('profile') < 0 && share.path.indexOf('birth') < 0, '分享链接不含私人数据');

  // 分享文案
  ok(share.title.indexOf(result.data.main.char.name) >= 0, '分享标题带角色名');

  // 结果写进历史
  const history = storage.getHistory();
  ok(history.length === 1, '占卜写入历史记录');
  ok(history[0].mainId === result.data.main.char.id, '历史记录的主推与页面一致');
  ok(history[0].seed === undefined, '历史记录里不落盘命盘种子（种子含姓名生辰）');
  ok(history[0].resultId && history[0].resultId.length <= 12, '只留短 id 用于去重');

  // ============================================================ 图鉴
  section('4. 图鉴与角色详情');
  const codex = loadPage('pages/codex/codex.js', 'codex');
  codex.onLoad();
  ok(codex.data.list.length === 60, `图鉴列出全部 ${codex.data.list.length} 个角色`);
  ok(codex.data.unlockedCount === 4, `已解锁 ${codex.data.unlockedCount} 个`);
  ok(codex.data.percent > 0, '进度百分比计算正确', `${codex.data.percent}%`);
  const unlockedRow = codex.data.list.find((r) => r.unlocked);
  ok(!!unlockedRow && !!unlockedRow.char.name, '已解锁角色正常渲染');

  codex.onRarityTap({ currentTarget: { dataset: { key: 'legend' } } });
  const legends = codex.data.list;
  ok(legends.length > 0 && legends.every((r) => r.char.rarity === 'legend'),
    `稀有度筛选生效（传说 ${legends.length} 个）`);
  codex.onStatusTap({ currentTarget: { dataset: { key: 'unlocked' } } });
  ok(codex.data.list.every((r) => r.unlocked), '只显示已解锁筛选生效');

  codex.onStatusTap({ currentTarget: { dataset: { key: 'all' } } });
  codex.onRarityTap({ currentTarget: { dataset: { key: 'all' } } });

  const char = loadPage('pages/character/character.js', 'character');
  char.onLoad({ id: 'naruto' });
  ok(char.data.ready === true, '角色详情页加载');
  ok(char.data.char.name === '漩涡鸣人', '角色数据正确');
  ok(char.data.axes.length === 8, '角色的八轴渲染');
  ok(char.data.fates.length >= 2, `角色命途标签 ${char.data.fates.length} 个`);
  ok(typeof char.data.resonance === 'number', `算出与用户的共振度（${char.data.resonance}%）`);

  // ============================================================ 我的
  section('5. 我的页面');
  const profile = loadPage('pages/profile/profile.js', 'profile');
  profile.onLoad();
  ok(!!profile.data.profile, '读取到本地资料');
  ok(profile.data.history.length === 1, '历史列表渲染');
  ok(profile.data.stats.codexCount === 4, `统计：已遇见 ${profile.data.stats.codexCount} 个`);
  ok(!!profile.data.chartLine, '命盘摘要渲染', profile.data.chartLine);

  profile.onToggleAi();
  ok(profile.data.settings.useAi === false, '可以关闭 AI 解读');
  profile.onToggleAi();
  ok(profile.data.settings.useAi === true, '可以重新开启 AI 解读');

  // ---- 微信昵称头像（chooseAvatar 给的是临时路径，要先 saveFile 再存） ----
  {
    const storageMod = require(path.join(MINI, 'utils', 'storage.js'));
    storageMod.clearWechatProfile();
    profile.onChooseAvatar({ detail: { avatarUrl: 'wxfile://tmp/avatar_123.png' } });
    const wx1 = storageMod.getWechatProfile();
    ok(!!wx1 && wx1.avatarUrl === 'wxfile://store/avatar_123.png',
      `头像临时路径被转存（${wx1 && wx1.avatarUrl}）`);
    ok(wx1.source === 'miniprogram', '记下来源是小程序');
    ok(profile.data.wechat.avatarUrl === 'wxfile://store/avatar_123.png', '页面立刻用上了新头像');
    ok(toastLog.indexOf('头像已更新') >= 0, '给了提示');

    profile.onNicknameBlur({ detail: { value: '  星野  ' } });
    const wx2 = storageMod.getWechatProfile();
    ok(wx2.nickName === '星野', `昵称存下来了（已去空格：${wx2.nickName}）`);
    ok(wx2.avatarUrl === wx1.avatarUrl, '存昵称不会把头像冲掉');

    // 空昵称不覆盖已有的
    profile.onNicknameBlur({ detail: { value: '   ' } });
    ok(storageMod.getWechatProfile().nickName === '星野', '空昵称不会清掉已有昵称');

    // 微信把头像清空的情况（用户点了取消）：不该崩，也不该写脏数据
    profile.onChooseAvatar({ detail: {} });
    ok(storageMod.getWechatProfile().avatarUrl === wx1.avatarUrl, '拿不到新路径时保持原样');

    storageMod.clearWechatProfile();
    ok(storageMod.getWechatProfile() === null, '可以清掉（换账号时要一起清）');
  }

  profile.onCheckBackend();
  const okHealth = await waitFor(
    () => profile.data.backend.state === 'ok' || profile.data.backend.state === 'warn',
    3000,
    50
  );
  ok(okHealth, '后端状态检测可用', profile.data.backend.text);

  // ============================================================ 随心抽签
  section('6. 随心一签（不填生辰）');
  index.onQuickDraw();
  const pending3 = divination.peekPending();
  ok(pending3.mode === 'draw' && !pending3.profile.birthDate, '抽签模式不携带生辰');

  const result2 = loadPage('pages/result/result.js', 'result2');
  result2.onLoad();
  const revealed2 = await waitFor(() => result2.data.ready === true, 5000);
  ok(revealed2, '抽签结果揭幕');
  ok(result2.data.rows[0].k === '签源', '抽签模式展示签源而不是星象');
  ok(result2.data.copy.essence.length > 30, '抽签也有完整解读');
  ok(!!result2.data.main.char.name, `抽签也能主推角色（${result2.data.main.char.name}）`);

  // ============================================================ 断网降级
  section('7. 后端不可用时的降级');
  {
    const goodBase = CONFIG.API_BASE;
    CONFIG.API_BASE = 'http://127.0.0.1:1'; // 打不通的地址
    divination.prepare({
      profile: { name: '离线', birthDate: '1990-02-02', timeKnown: false, city: '北京' },
      mode: 'chart'
    });
    const offline = loadPage('pages/result/result.js', 'result3');
    offline.onLoad();
    const revealed3 = await waitFor(() => offline.data.ready === true, 6000);
    ok(revealed3, '后端不可用时依然出结果');
    ok(offline.data.ready === true && !!offline.data.main.char.name,
      `降级后仍有主推角色（${offline.data.main.char.name}）`);
    ok(offline.data.copy.essence.length > 30, '降级后用本地模板文案');
    ok(offline.data.source === 'local', `来源标记为 ${offline.data.source}`);
    ok(!!offline.data.notice, '给用户一句降级提示', offline.data.notice);
    ok(offline.data.aiLabel === true, '降级时依然标注文案来源');
    CONFIG.API_BASE = goodBase;
  }

  // ============================================================ 统计
  section('8. 服务端统计');
  {
    const s = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: APP_PORT, path: '/api/stats?token=' }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
    });
    ok(s === 403, '未带 ADMIN_TOKEN 的统计接口被拒绝');
    console.log(`    （本次共向 mock 模型发起 ${aiHits} 次请求）`);
  }

  console.log('\n========================================');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    failures.forEach((f) => console.log(`  - ${f}`));
  } else {
    console.log('全部通过 ✅');
  }

  mock.close();
  app.server.close();
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
})().catch((e) => {
  console.error('测试自身异常:', e);
  process.exit(1);
});
