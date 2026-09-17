/* eslint-disable no-console */
/**
 * 服务端全链路自测（不需要真的 DeepSeek key）：
 *   node tools/server-test.js
 *
 * 用一个本地 mock 顶替 DeepSeek，把三条路都走一遍：
 *   1. 正常返回        → 文案用 AI 的，且缓存起来（第二次不花钱）
 *   2. 返回跑偏内容    → 命中违禁词 / 编造作品名 → 整段退回本地模板
 *   3. 服务不可用      → 5xx / 超时 → 依然返回 200 和一份能渲染的文案
 * 再顺手检查配额闸门、鉴权、以及"提示词里到底喂了什么"。
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// 和 client-test 一样放到 server/ 下，已经被 .gitignore 覆盖
const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, 'server', '.tmp-server-test');
// 端口按 PID 派生，避免与残留进程或并发运行撞车
const APP_PORT = 8799 + (process.pid % 200);
const MOCK_PORT = APP_PORT + 1;

// ⚠️ 必须在 require 服务端之前设好环境变量：config.js 是加载时读 env 的
process.env.PORT = String(APP_PORT);
process.env.DATA_DIR = TMP;
process.env.DEEPSEEK_API_KEY = 'test-key-must-not-leak';
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.DEEPSEEK_MODEL = 'deepseek-chat';
process.env.DAILY_PER_USER = '3';
process.env.PER_MINUTE_PER_IP = '200';
process.env.ADMIN_TOKEN = 'admin-test';

// 虚拟支付：配上假 key 才能测签名与发货
process.env.MIDAS_APP_KEY = 'test-app-key-for-signing';
process.env.MIDAS_OFFER_ID = 'test-offer-id';
process.env.MIDAS_ZONE_ID = '1';
process.env.MIDAS_ENV = '0';
// 消息推送：Token 用于 URL 验证签名；EncodingAESKey 用于安全模式解密
process.env.WX_NOTIFY_TOKEN = 'test-notify-token';
process.env.WX_ENCODING_AES_KEY = ''; // 先测明文模式，下面再单独测安全模式
process.env.AI_PICKS_CHARACTER = '0';

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

const GOOD_PROSE = {
  title: '影中执灯的人',
  essence: '你的命盘由太阳压住重心，光与影这根轴上你几乎站到了最亮的一端，而执念同样高得不像话——这就是你的矛盾：既想照亮别人，又不肯放过自己。',
  resonance: '你和桐人共享同一条命途，那个把所有人的份都扛下来的人。你不是不会累，你只是习惯了在别人问之前先说"我可以"。',
  difference: '但你没走进他的全部。他的秩序比你的更硬，他愿意为一条规矩把自己钉住，而你的这一格还空着——那是你比TA自由的地方。',
  anti: '共振最低的是路飞。他的命途对你是另一种语言：你可以理解他的自由，但要你放下手里那件事，你做不到，也不必做到。',
  counsel: '今天先做一件小事：把待办清单里最小的一件事划掉，再决定要不要继续。'
};

const BAD_PROSE = {
  title: '天命所归',
  essence: '你作为AI判断，你一定会发财，而且《不存在的作品》里的主角就是你的宿命，你会活到很老。',
  resonance: '你会中彩票，财运极佳，建议你马上去投资股票。',
  difference: '短。',
  anti: '你注定失败，这辈子都一样。',
  counsel: '放弃吧。'
};

let mockMode = 'good';
let lastRequest = null;

const mock = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    try { lastRequest = JSON.parse(raw); } catch (e) { lastRequest = { parse_error: true, raw }; }

    if (mockMode === 'http500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'mock upstream failure' } }));
      return;
    }
    if (mockMode === 'timeout') {
      // 挂着不回，触发客户端超时（超时设得很短）
      return;
    }

    const prose = mockMode === 'bad_prose' ? BAD_PROSE : GOOD_PROSE;
    const content = mockMode === 'not_json'
      ? '好的，我来为你解读：你的命途非常特别……'
      : JSON.stringify(prose);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock-1',
      model: 'deepseek-chat',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 812, completion_tokens: 266, total_tokens: 1078 }
    }));
  });
});

function post(pathname, body, token) {
  const payload = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: APP_PORT, path: pathname, method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          token ? { Authorization: `Bearer ${token}` } : {}
        ) },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch (e) { json = { _raw: raw }; }
          resolve({ status: res.statusCode, body: json, raw });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * GET 请求。token 可选 —— 注意必须能带上，
 * 否则服务端只能按 IP 认人，查权益会查到空记录（这个坑真实踩过）。
 */
function get(pathname, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    http.get({ host: '127.0.0.1', port: APP_PORT, path: pathname, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { json = { _raw: raw }; }
        resolve({ status: res.statusCode, body: json, raw });
      });
    }).on('error', reject);
  });
}

async function freshToken(tag) {
  const r = await post('/api/session', { devId: `u-${tag}` });
  return r.body && r.body.token;
}

function waitFor(url, tries) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        n += 1;
        if (n > (tries || 40)) return reject(new Error('服务没起来'));
        setTimeout(tick, 120);
      });
    };
    tick();
  });
}

(async function main() {
  // 干净的运行目录
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));
  const core = require(path.join(__dirname, '..', 'core', 'index.js'));
  const payloadCore = require(path.join(__dirname, '..', 'core', 'payload.js'));
  const app = require(path.join(__dirname, '..', 'server', 'index.js'));
  await waitFor(`http://127.0.0.1:${APP_PORT}/api/health`);

  const profile = {
    name: '测试者', gender: 'female', birthDate: '1996-08-19',
    birthTime: '07:20', timeKnown: true, city: '上海'
  };

  // ------------------------------------------------------------ 基础
  section('1. 基础接口');
  {
    const h = await get('/api/health');
    ok(h.status === 200 && h.body.ok, 'GET /api/health');
    ok(h.body.ai && h.body.ai.configured === true, 'health 报告 AI 已配置', h.body.ai && h.body.ai.model);
    ok(h.body.characters === 60, `health 报告角色数 = ${h.body.characters}`);
    // 出网自检：这一项不开，AI 和微信登录会同时废掉（线上真踩过），
    // 所以健康检查必须带上它，而且失败时要给出"该去开公网出口"的提示
    ok(h.body.egress && typeof h.body.egress.ok === 'boolean',
      `health 报告容器出网状态（ok=${h.body.egress && h.body.egress.ok}）`);
    ok(h.body.egress.detail && 'wechat' in h.body.egress.detail && 'ai' in h.body.egress.detail,
      '出网自检覆盖微信和 AI 两个目标');
    if (!h.body.egress.ok) ok(String(h.body.egress.hint).indexOf('公网出口') >= 0, '出网失败时提示去开公网出口');
    ok(!/test-key-must-not-leak/.test(h.raw), 'health 不泄露 API key');

    // 登录模式必须报出来：没配 WX_SECRET 时服务端**不报错**，
    // 它安静地按设备认人，现象要到"用户换手机发现权益没了"才暴露。
    // 所以状态页得能直接看到当前是哪种模式（部署时最容易漏的一项）。
    ok(h.body.login && typeof h.body.login.devMode === 'boolean',
      `health 报告登录模式（devMode=${h.body.login && h.body.login.devMode}）`);
    ok(h.body.login.devMode === true, '本测试没配 WX_SECRET → 明确标记为按设备认人');
    ok(String(h.body.login.hint).indexOf('WX_SECRET') >= 0, '并给出"该配哪个变量"的提示');
    // 提示里出现"该配 WX_SECRET / AUTH_SECRET"是**故意的**，所以这里只查值：
    // 不能出现测试用的 key，也不能出现任何密钥样的长串（字段名不必管）
    ok(!/test-key-must-not-leak/.test(h.raw), '提示里没有真的密钥值');
    ok(!/[0-9a-f]{32,}/i.test(h.raw), 'health 里没有密钥样的长串');

    const r = await get('/api/roster');
    ok(r.status === 200 && r.body.characters.length === 60, 'GET /api/roster 下发角色库');
    ok(!!r.body.disclaimer, 'roster 带合规声明');

    const c = await get('/api/characters/naruto');
    ok(c.status === 200 && c.body.character.name === '漩涡鸣人', 'GET /api/characters/:id');
    const miss = await get('/api/characters/not-exist');
    ok(miss.status === 404, '未知角色返回 404');

    const nf = await get('/api/nope');
    ok(nf.status === 404, '未知路由返回 404');
  }

  // ------------------------------------------------------------ 登录
  section('2. 登录与鉴权');
  let token = null;
  {
    const s = await post('/api/session', { devId: 'tester-1' });
    ok(s.status === 200 && !!s.body.token, 'POST /api/session 开发模式签发 token');
    ok(s.body.dev === true, '开发模式标记正确');
    token = s.body.token;

    const bad = await post('/api/divinate', { key: 'x', dims: null }, token);
    ok(bad.status === 400 && bad.body.error === 'MISSING_FIELDS', '缺字段返回 400');
  }

  // ------------------------------------------------------------ 正常 AI 链路
  section('3. 正常链路（AI 文案 + 缓存）');
  {
    token = await freshToken('normal');
    mockMode = 'good';
    const local = core.divinate({ profile });
    const facts = payloadCore.buildFacts(local);
    ok(!/测试者|1996|08-19|上海/.test(JSON.stringify(facts)),
      '上行数据不含姓名/生辰等隐私（只有匿名数字）');
    ok(facts.pillars && typeof facts.pillars.year === 'number', '干支以六十甲子下标上行',
      String(facts.pillars && facts.pillars.year));
    ok(Object.keys(facts.dims).length === 8, '八轴数值上行');

    const r1 = await post('/api/divinate', facts, token);
    ok(r1.status === 200 && r1.body.ok, 'POST /api/divinate 成功');
    ok(r1.body.source === 'ai', `source = ${r1.body.source}（AI 生成）`);
    ok(r1.body.copy.essence === GOOD_PROSE.essence, 'AI 文案被采用');
    ok(r1.body.copy.counsel === GOOD_PROSE.counsel, 'counsel 字段被采用');
    ok(r1.body.copy.aiGenerated === true, 'aiGenerated 标记为 true');
    ok(!/deepseek|apiKey|Bearer/i.test(r1.raw), '响应里没有模型名/key 等实现细节');
    ok(!!r1.body.meta.disclaimer, '响应带合规声明');

    // 服务端重算的匹配必须和本地一致（同一套 core）
    ok(r1.body.match.main.id === local.match.main.id,
      '服务端与本地匹配结果一致', r1.body.match.main.id);
    ok(r1.body.match.anti.id === local.match.anti.id, '反向角色一致', r1.body.match.anti.id);

    // 提示词检查
    const sent = JSON.stringify(lastRequest);
    const mainChar = local.match.main.char;
    ok(sent.indexOf(mainChar.name) >= 0, `提示词里带上了主推角色名（${mainChar.name}）`);
    ok(sent.indexOf(mainChar.work) >= 0, '提示词里带上了作品名');
    ok(sent.indexOf('光与影') >= 0 || sent.indexOf('执念与随性') >= 0, '提示词里带上了轴名锚点');
    ok(sent.indexOf('命途') >= 0, '提示词里带上了命途锚点');
    ok(lastRequest.response_format && lastRequest.response_format.type === 'json_object',
      '要求模型输出 JSON');
    ok(!/测试者|1996-08-19/.test(sent), '提示词里没有用户隐私');

    // 回填到本地结果
    const merged = payloadCore.applyServerResponse(local, r1.body);
    ok(merged.applied.match && merged.applied.copy, '客户端能回填服务端结果');
    ok(merged.result.copy.essence === GOOD_PROSE.essence, '回填后的文案是 AI 版');
    ok(!!merged.result.match.main.char.name, '回填后的匹配对象带完整角色数据（本地重建）');
    ok(!!merged.result.copy.shareTitle, '静态文案（分享语等）保留在本地');

    // 缓存
    const r2 = await post('/api/divinate', facts, token);
    ok(r2.status === 200 && r2.body.source === 'cache', `重复请求命中缓存（source=${r2.body.source}）`);
    ok(r2.body.copy.essence === GOOD_PROSE.essence, '缓存内容一致');

    // 缓存命中不该再打模型
    const before = lastRequest;
    await post('/api/divinate', facts, token);
    ok(lastRequest === before, '命中缓存时没有再请求模型（省钱）');
  }

  // ------------------------------------------------------------ 跑偏内容
  section('4. 模型跑偏时的兜底');
  {
    token = await freshToken('fallback');
    mockMode = 'bad_prose';
    const local = core.divinate({
      profile: Object.assign({}, profile, { birthDate: '1997-01-25', name: '测试者二' })
    });
    const facts = payloadCore.buildFacts(local);
    const r = await post('/api/divinate', facts, token);

    ok(r.status === 200 && r.body.ok, '跑偏时依然返回 200');
    ok(r.body.source === 'local', `跑偏内容被拒绝（source=${r.body.source}）`);
    ok(r.body.copy.aiGenerated === false, 'aiGenerated 标为 false');
    ok(r.raw.indexOf('一定会发财') < 0, '违禁内容没有进入响应');
    ok(r.raw.indexOf('不存在的作品') < 0, '编造的作品名没有进入响应');
    ok(r.raw.indexOf('你作为AI') < 0 && r.raw.indexOf('作为AI') < 0, 'AI 自指没有进入响应');
    ok(r.body.copy.essence.length > 30, '退回的模板文案依然完整', `${r.body.copy.essence.length} 字`);

    mockMode = 'not_json';
    const local2 = core.divinate({
      profile: Object.assign({}, profile, { birthDate: '1997-02-25', name: '测试者三' })
    });
    const r2 = await post('/api/divinate', payloadCore.buildFacts(local2), token);
    ok(r2.status === 200 && r2.body.source === 'local', '模型不返回 JSON 时退回模板');

    mockMode = 'http500';
    const local3 = core.divinate({
      profile: Object.assign({}, profile, { birthDate: '1997-03-25', name: '测试者四' })
    });
    const r3 = await post('/api/divinate', payloadCore.buildFacts(local3), token);
    ok(r3.status === 200 && r3.body.source === 'local', '上游 5xx 时退回模板（不把错误抛给用户）');
    mockMode = 'good';
  }

  // ------------------------------------------------------------ 配额
  section('5. 配额闸门（成本控制）');
  {
    const t2 = await freshToken('quota');
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const local = core.divinate({
        profile: { name: 'Q' + i, birthDate: `199${i}-05-05`, timeKnown: false, city: '北京' }
      });
      /* eslint-disable no-await-in-loop */
      const r = await post('/api/divinate', payloadCore.buildFacts(local), t2);
      statuses.push(`${r.status}:${(r.body && r.body.error) || (r.body && r.body.source) || '-'}`);
    }
    console.log(`    四次请求结果：${statuses.join('  ')}`);
    ok(statuses[3].indexOf('429') === 0, '超过每日额度返回 429', statuses[3]);
    ok(statuses[3].indexOf('DAILY_USER_LIMIT') > 0, '返回明确的限流原因');

    const admin = await get('/api/stats?token=admin-test');
    ok(admin.status === 200 && admin.body.stats.calls > 0, '统计接口可用（调用数、token 用量）',
      JSON.stringify(admin.body.stats));
    const noAuth = await get('/api/stats');
    ok(noAuth.status === 403, '统计接口需要 ADMIN_TOKEN');
  }

  // ------------------------------------------------------------ 模型输出解析
  section('5.5 模型输出解析（推理模型会输出两个对象 / 尾部带废话）');
  {
    const { extractJson } = require(path.join(__dirname, '..', 'server', 'deepseek.js'));
    const BS = String.fromCharCode(92);
    const NL2 = String.fromCharCode(10);
    const FENCE = String.fromCharCode(96).repeat(3);
    const cases = [
      ['标准 JSON', JSON.stringify({ a: 1 }), true],
      ['带围栏', FENCE + 'json' + NL2 + '{"a":2}' + NL2 + FENCE, true],
      ['前后有解释文字', '好的，这是结果：{"a":3} 希望有帮助', true],
      ['输出两个对象', '{"a":4}{"b":5}', true],
      ['字符串里有花括号', '{"title":"含 { 括号 }"}', true],
      ['字符串里有转义引号', '{"a":"say ' + BS + '"hi' + BS + '""}', true],
      ['嵌套对象', '{"a":{"b":{"c":9}},"d":10}', true],
      ['被 max_tokens 截断', '{"title":"写一半","essence":"然后就没了', false]
    ];
    const bad = [];
    cases.forEach(([name, raw, expect]) => {
      const got = extractJson(raw);
      if (!!got !== expect) bad.push(name);
    });
    ok(bad.length === 0, `${cases.length} 种模型输出形态都能正确解析`, bad.join('、'));
  }

  // ------------------------------------------------------------ 落盘解耦
  section('5.6 落盘：本地文件写不进去时，MySQL 那份（唯一持久副本）也不能丢');
  {
    // 这条来自一个真实的坑：容器里 /app 属主是 root、进程跑在 USER node 下，
    // 于是 server/runtime 建不出来 → store.json 写失败。
    // 修复前两者共用一个 try，文件一失败就**跳过** MySQL 落盘 ——
    // 现象是"容器一切正常、重启后用户数据全没"，而且一声不响。
    // 这里用一个"目录名其实是文件"的路径稳定复现写失败（等价于 EACCES）。
    const os = require('os');
    const fsMod = require('fs');
    const { createStore } = require(path.join(__dirname, '..', 'server', 'store.js'));

    const blocked = path.join(os.tmpdir(), `wotui-blocked-${process.pid}-${Date.now()}`);
    fsMod.writeFileSync(blocked, 'x'); // 占住这个名字

    let hooked = null;
    const s2 = createStore({ dataDir: blocked, proseCacheDays: 30 });
    s2.setSaveHook((json) => { hooked = json; });
    s2.bumpStat('calls');
    s2.save();

    ok(hooked !== null, '本地文件写失败时，外部落盘钩子照样被调用');
    const snap = hooked ? JSON.parse(hooked) : {};
    ok(snap && snap.stats && snap.stats.calls === 1, '钩子拿到的是完整快照（不是空壳）');

    fsMod.unlinkSync(blocked);

    // 正常路径也不能坏：目录不存在时会自己建出来
    const fresh = path.join(os.tmpdir(), `wotui-fresh-${process.pid}-${Date.now()}`);
    const s3 = createStore({ dataDir: fresh, proseCacheDays: 30 });
    let hooked3 = null;
    s3.setSaveHook((json) => { hooked3 = json; });
    s3.bumpStat('calls');
    s3.save();
    ok(hooked3 !== null, '本地文件正常时，外部落盘照旧');
    ok(fsMod.existsSync(path.join(fresh, 'store.json')), '本地存档文件也真的写出来了');
    // 收尾：删掉这个临时目录
    try {
      fsMod.unlinkSync(path.join(fresh, 'store.json'));
      fsMod.rmdirSync(fresh);
    } catch (e) { /* 收尾失败不影响结论 */ }
  }
  // ------------------------------------------------------------ 会话密钥
  section('5.7 会话密钥：没配 AUTH_SECRET 时，公开的默认值不能用来冒充用户');
  {
    // token 就是 `openid.exp.签名`。签名密钥要是仓库里写死的默认值（公开可读），
    // 任何人手算一个 HMAC 就能签发任意 openid 的 token —— 读别人的账号、改别人的权益。
    // 所以没配时必须用**本次进程随机**的密钥，让用旧默认值签的 token 全部失效。
    const crypto = require('crypto');
    const wxauth = require(path.join(__dirname, '..', 'server', 'wxauth.js'));

    ok(wxauth.secretSource() === 'generated', '本测试没配 AUTH_SECRET → 明确标记为"临时随机密钥"');

    // "这个密钥能不能用"的判断本身也要测：第一版只做精确字符串比对，
    // 结果 .env 里那个 36 位的占位符**变体**（dev-only-...）被认为是真密钥，
    // 被原样抄进了部署表 —— 等于把签名密钥公开出去。
    const weakCases = [
      ['空串', '', true],
      ['短串', 'abc123', true],
      ['精确占位符', 'change-me-to-a-long-random-string', true],
      ['占位符变体（就是踩过的那个）', 'dev-only-change-me-to-a-long-random-xx', true],
      ['出现 placeholder 字样', 'placeholder-key-1234567890abcdefghijk', true],
      ['低熵重复', 'secretsecretsecretsecretsecretsecret', true],
      ['真随机 hex', crypto.randomBytes(32).toString('hex'), false],
      ['真随机 base64', crypto.randomBytes(32).toString('base64'), false]
    ];
    const wrong = weakCases.filter(([, val, want]) => wxauth.isWeakSecret(val) !== want)
      .map(([name]) => name);
    ok(wrong.length === 0,
      `${weakCases.length} 种密钥形态的判断都对（占位符/低熵一律不认）`,
      wrong.length ? `判错的：${wrong.join('、')}` : '');
    ok(wxauth.isWeakSecret(authSecretInEnvExample()) === true,
      'server/.env.example 里那个模板值本身就被判定为"必须换掉"');
    function authSecretInEnvExample() {
      const m = /^AUTH_SECRET=(.*)$/m.exec(
        require('fs').readFileSync(path.join(__dirname, '..', 'server', '.env.example'), 'utf8')
      );
      return m ? m[1] : '';
    }

    const b64urlS = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const forge = (openid, key) => {
      const payload = `${b64urlS(openid)}.${Date.now() + 86400000}`;
      const sig = b64urlS(crypto.createHmac('sha256', key).update(payload).digest()).slice(0, 43);
      return `${payload}.${sig}`;
    };

    ['dev-only-change-me', 'change-me-to-a-long-random-string', '', 'short'].forEach((bad) => {
      ok(wxauth.verifyToken(forge('o_victim', bad)) === null,
        `用「${bad || '(空)'}」这种公开/占位密钥伪造的 token 被拒绝`);
    });

    // 真 token 必须还有效（别修成"谁都不认"）
    const real = wxauth.issueToken('o_self');
    ok(wxauth.verifyToken(real) === 'o_self', '正常签发的 token 仍然有效');

    // 健康检查要把"用的是临时密钥"报出来，否则只有等重启后用户被登出才发现
    const h2 = await get('/api/health');
    ok(h2.body.auth && h2.body.auth.secretSource === 'generated',
      `health 报告会话密钥来源（${h2.body.auth && h2.body.auth.secretSource}）`);
    ok(String(h2.body.auth.hint).indexOf('AUTH_SECRET') >= 0, '并提示该配哪个变量');
    ok(h2.raw.indexOf(real.slice(-20)) < 0, 'health 不泄露 token 的签名');
  }

  section('5.8 AI 总预算（重试不能越过它，也不能超过客户端愿意等的时间）');
  {
    // 直接给 chat() 塞一个假 fetch：不碰真网络，能把"调了几次、等了多久"量出来
    const deepseek = require(path.join(__dirname, '..', 'server', 'deepseek.js'));
    const realFetch = global.fetch;
    let calls = 0;

    const stubFetch = (mode) => {
      calls = 0;
      global.fetch = (url, init) => {
        calls += 1;
        if (mode === 'hang') {
          // 挂着不回：只有 abort（超时/预算到点）才会让它结束
          return new Promise((resolve, reject) => {
            const sig = init && init.signal;
            if (sig) {
              sig.addEventListener('abort', () => {
                const e = new Error('aborted');
                e.name = 'TimeoutError';
                reject(e);
              });
            }
          });
        }
        // 返回的不是合法 JSON 信封 → deepseek 会判失败并重试（正好用来数次数）
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('这不是 JSON') });
      };
    };

    const MSGS = [{ role: 'user', content: 'hi' }];

    // ① 预算充足：该重试就重试（默认 retries=1 → 最多 2 次）
    stubFetch('badjson');
    await deepseek.chat(MSGS, { tag: 'test-budget-ok', budgetMs: 60000 });
    ok(calls === 2, `预算充足时按 retries 重试（调了 ${calls} 次）`, `期望 2 次，实际 ${calls} 次`);

    // ② 预算到点：不再开第二次（省下的是 40~50 秒和一次真金白银）
    stubFetch('badjson');
    const r2 = await deepseek.chat(MSGS, { tag: 'test-budget-tight', budgetMs: 1 });
    ok(calls === 1, `预算耗尽后不再重试（调了 ${calls} 次）`, `期望 1 次，实际 ${calls} 次`);
    ok(r2.ok === false, '预算耗尽时明确返回失败（不会假装成功）');

    // ③ 单次超时必须被"剩余预算"压住：默认超时 55 秒，预算 900ms
    stubFetch('hang');
    const t3 = Date.now();
    const r3 = await deepseek.chat(MSGS, { tag: 'test-budget-abort', budgetMs: 900 });
    const spent = Date.now() - t3;
    ok(spent < 4000, `单次超时被剩余预算压住（实际等了 ${spent}ms，默认超时是 55 秒）`, `${spent}ms`);
    ok(r3.ok === false && r3.error === 'TIMEOUT', `返回 TIMEOUT（${r3.error}）`);

    global.fetch = realFetch;
  }

  // ------------------------------------------------------------ 登录失败可诊断
  section('5.9 登录失败必须留痕（真机上"账号登录不上"靠这个查）');
  {
    // 线上踩过的坑：客户端没带 code 时服务端只回一句 401（3 毫秒），
    // 两端都没有任何原因 —— 分不清是 code 过期、appsecret 错、还是客户端压根没登录。
    // 现在要求：失败原因写进日志（云托管「运行日志」里直接看得到）。
    const wxauth = require(path.join(__dirname, '..', 'server', 'wxauth.js'));
    const { CONFIG } = require(path.join(__dirname, '..', 'server', 'config.js'));
    // 测试环境默认没配微信（就是开发模式），先临时"配上"才走得到正式那条路
    const saved = { appid: CONFIG.wechat.appid, secret: CONFIG.wechat.secret };
    CONFIG.wechat.appid = 'wxtestappid';
    CONFIG.wechat.secret = 'testsecret';

    const realWarn = console.warn;
    const grabbed = [];
    let r;
    try {
      console.warn = (...args) => { grabbed.push(args.join(' ')); };
      // ① 正式模式下客户端没带 code
      r = await wxauth.login({ devId: 'probe' });
    } finally {
      console.warn = realWarn;
      CONFIG.wechat.appid = saved.appid;
      CONFIG.wechat.secret = saved.secret;
    }
    ok(r.ok === false && r.error === 'MISSING_CODE', `没带 code → 明确返回 MISSING_CODE（${r.error}）`);
    ok(grabbed.some((s) => s.indexOf('MISSING_CODE') >= 0),
      '并把"客户端没带 code"写进了日志',
      grabbed.join(' ｜ ').slice(0, 120));
  }

  // ------------------------------------------------------------ 抽签模式
  // ------------------------------------------------------------ 微信接口的 TLS 阶梯
  const wxhttpMod = require(path.join(__dirname, '..', 'server', 'wxhttp.js'));
  section('5.95 微信接口走 TLS 阶梯：严格优先，只对这一个域名允许降级');
  {
    // 线上真因：云托管容器访问 api.weixin.qq.com 会走平台内网代理，
    // 代理出示**自签名证书**，Node 内置 fetch 直接失败（DEPTH_ZERO_SELF_SIGNED_CERT），
    // 表现为"账号一直登录不上"，而容器访问 DeepSeek 却完全正常
    // —— 很容易误判成"没有公网出口"，我们就是这么绕了一圈。
    const wxhttp = require(path.join(__dirname, '..', 'server', 'wxhttp.js'));

    const certCases = [
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'CERT_HAS_EXPIRED'
    ];
    const missed = certCases.filter((c) => !wxhttp.isCertError(c, ''));
    ok(missed.length === 0, `${certCases.length} 种证书错误都能识别出来`, missed.join('、'));
    ok(!wxhttp.isCertError('ECONNREFUSED', 'connect ECONNREFUSED'),
      '网络类错误不会被误判成证书问题（那种降级也没用，不该降）');
    ok(wxhttp.INSECURE_HOSTS.indexOf('api.weixin.qq.com') >= 0,
      'api.weixin.qq.com 在允许降级的白名单里（否则线上还是登录不上）');
    ok(wxhttp.INSECURE_HOSTS.indexOf('api.deepseek.com') < 0,
      'AI 供应商不在白名单里（它的证书是正常的，不该被放宽）');
    ok(wxhttp.INSECURE_HOSTS.length <= 2,
      `白名单足够窄（${wxhttp.INSECURE_HOSTS.length} 个域名），不是"一关全关"`);
  }

  section('6. 随心抽签模式');
  {
    const s = { body: { token: await freshToken('draw') } };
    const local = core.divinate({ drawToken: 'draw-token-1' });
    const facts = payloadCore.buildFacts(local);
    ok(facts.mode === 'draw' && facts.draw && facts.pillars === null, '抽签模式上行结构正确');
    const r = await post('/api/divinate', facts, s.body.token);
    ok(r.status === 200 && r.body.ok, '抽签模式可占卜');
    ok(r.body.source === 'ai', `抽签模式也用 AI（source=${r.body.source}）`);
    ok(r.body.match.main.id === local.match.main.id, '抽签模式匹配一致');
  }

  // ------------------------------------------------------------ 输入攻击面
  // ------------------------------------------------------------ 虚拟支付服务端
  section('6.5 虚拟支付：签名、发货推送、幂等');
  {
    const crypto = require('crypto');
    const sessions = await post('/api/session', { devId: 'pay-user' });
    const payToken = sessions.body.token;
    const owner = 'dev_pay-user';
    const APP_KEY = 'test-app-key-for-signing';

    // 真实来源是微信 code2session，测试环境注入一个假的
    app.store.setSessionKey(owner, 'fake-session-key-0123456789');

    const payMod = require(path.join(__dirname, '..', 'server', 'pay.js'));
    ok(payMod.isConfigured(), '服务端识别到支付配置（假 key）');

    // ---- 下单签名 ----
    const sign1 = await post('/api/pay/sign', { productId: 'pass_7d' }, payToken);
    ok(sign1.status === 200 && sign1.body.ok, 'POST /api/pay/sign 成功');
    ok(!!sign1.body.signData && !!sign1.body.paySig && !!sign1.body.signature,
      '返回 signData / paySig / signature');
    ok(sign1.body.outTradeNo && sign1.body.outTradeNo.length <= 32 && !/^_/.test(sign1.body.outTradeNo),
      `订单号合规（${sign1.body.outTradeNo}）`);

    let sd = null;
    try {
      sd = JSON.parse(sign1.body.signData);
    } catch (e) {
      sd = null;
    }
    ok(!!sd, 'signData 是合法 JSON');
    ok(sd && sd.mode === 'goods', 'mode = goods（道具直购）');
    ok(sd && sd.currencyType === 'CNY', '币种 CNY');
    ok(sd && sd.buyQuantity === 1, '购买数量 1');
    ok(sd && sd.offerId === 'test-offer-id', 'offerId 来自服务端配置');
    ok(sd && sd.zoneId === '1', 'zoneId 来自服务端配置');
    ok(sd && sd.productId === 'pass_7d', 'productId 与请求一致');
    // ⚠️ 价格单位是「分」。这里搞错会让用户实际付 100 倍的钱。
    ok(sd && sd.goodsPrice === 3000, `goodsPrice 单位是分（3000 = ¥30），实际 ${sd && sd.goodsPrice}`);
    ok(sd && sd.outTradeNo === sign1.body.outTradeNo, 'signData 里的订单号与返回一致');

    // ---- 签名能独立复现（交叉验证，不复用服务端的函数） ----
    const expectPaySig = crypto
      .createHmac('sha256', APP_KEY)
      .update('requestMidasPaymentGameItem&' + sign1.body.signData)
      .digest('hex');
    ok(sign1.body.paySig === expectPaySig,
      'paySig = HMAC-SHA256(AppKey, "requestMidasPaymentGameItem&signData")');
    const expectSig = crypto
      .createHmac('sha256', 'fake-session-key-0123456789')
      .update(sign1.body.signData)
      .digest('hex');
    ok(sign1.body.signature === expectSig, 'signature = HMAC-SHA256(session_key, signData)');

    // ---- 密钥绝不能出现在响应里 ----
    ok(sign1.raw.indexOf(APP_KEY) < 0, '响应里没有 AppKey');
    ok(sign1.raw.indexOf('fake-session-key') < 0, '响应里没有 session_key');
    ok(sessions.raw.indexOf('sessionKey') < 0 && sessions.raw.indexOf('session_key') < 0,
      '登录响应里也不含 sessionKey');

    // ---- 没有 session_key 就不能签名（用户态签名算不出来） ----
    const fresh = await post('/api/session', { devId: 'no-session-user' });
    const noSession = await post('/api/pay/sign', { productId: 'pass_7d' }, fresh.body.token);
    ok(noSession.status === 401 && noSession.body.error === 'NO_SESSION_KEY',
      '没有 session_key 时拒绝签名');

    // ---- 未知档位 ----
    const badProduct = await post('/api/pay/sign', { productId: 'not-exist' }, payToken);
    ok(badProduct.status === 400 && badProduct.body.error === 'UNKNOWN_PRODUCT', '未知档位返回 400');

    // ---- 发货推送：签名不对必须拒收 ----
    const payload = JSON.stringify({
      OpenId: owner,
      Env: 0,
      OutTradeNo: sign1.body.outTradeNo,
      GoodsInfo: { ProductId: 'pass_7d', Quantity: 1, ZoneId: '1', OrigPrice: 3000, ActualPrice: 3000 }
    });
    const badNotify = await post('/api/pay/notify', {
      Event: 'minigame_game_pay_goods_deliver_notify',
      MiniGame: { Payload: payload, PayEventSig: 'deadbeef' }
    });
    ok(badNotify.status === 403, '发货推送签名错误 → 403 拒收');

    // ---- 正确签名：发货 ----
    const goodSig = crypto.createHmac('sha256', APP_KEY).update(payload).digest('hex');
    const before = await get('/api/entitlement', payToken);
    const notify1 = await post('/api/pay/notify', {
      Event: 'minigame_game_pay_goods_deliver_notify',
      MiniGame: { Payload: payload, PayEventSig: goodSig }
    });
    ok(notify1.status === 200 && notify1.body.ErrCode === 0,
      '正确签名的发货推送被接受，返回 ErrCode 0');
    const after1 = await get('/api/entitlement', payToken);
    ok(after1.body.passExpireAt > (before.body.passExpireAt || 0), '权益已发放（到期时间写入）');
    const days1 = Math.round((after1.body.passExpireAt - Date.now()) / 86400000);
    ok(days1 === 7, `发放天数取自服务端下单记录（7 天），实际 ${days1}`);

    // ---- 幂等：平台会重复推送，绝不能重复加时长 ----
    const notify2 = await post('/api/pay/notify', {
      Event: 'minigame_game_pay_goods_deliver_notify',
      MiniGame: { Payload: payload, PayEventSig: goodSig }
    });
    ok(notify2.status === 200 && notify2.body.ErrCode === 0,
      '重复推送仍返回成功（官方要求回包与第一次一致）');
    for (let i = 0; i < 5; i += 1) {
      /* eslint-disable no-await-in-loop */
      await post('/api/pay/notify', {
        Event: 'minigame_game_pay_goods_deliver_notify',
        MiniGame: { Payload: payload, PayEventSig: goodSig }
      });
    }
    const after3 = await get('/api/entitlement', payToken);
    ok(after3.body.passExpireAt === after1.body.passExpireAt,
      '连推 6 次依然只发一次（幂等）');

    // ---- pending：还没收到平台推送时，确认接口不谎报成功 ----
    const sign2 = await post('/api/pay/sign', { productId: 'pass_1d' }, payToken);
    const confirm = await post('/api/pay/confirm', { outTradeNo: sign2.body.outTradeNo }, payToken);
    ok(confirm.status === 200 && confirm.body.ok === false && confirm.body.pending === true,
      '未收到发货推送时返回 pending，不谎报成功');
    ok(confirm.raw.indexOf(APP_KEY) < 0, '确认接口也不泄露 AppKey');
    const unknown = await post('/api/pay/confirm', { outTradeNo: 'NO_SUCH_ORDER' }, payToken);
    ok(unknown.status === 404, '未知订单返回 404');

    // ---- 天数以服务端记录为准，不信推送内容 ----
    // 这单买的是 1 天，推送里谎报 30 天档位，也只应发 1 天
    const lie = JSON.stringify({
      OpenId: owner,
      Env: 0,
      OutTradeNo: sign2.body.outTradeNo,
      GoodsInfo: { ProductId: 'pass_30d', Quantity: 1, ZoneId: '1', OrigPrice: 100, ActualPrice: 100 }
    });
    const lieSig = crypto.createHmac('sha256', APP_KEY).update(lie).digest('hex');
    await post('/api/pay/notify', {
      Event: 'minigame_game_pay_goods_deliver_notify',
      MiniGame: { Payload: lie, PayEventSig: lieSig }
    });
    const afterLie = await get('/api/entitlement', payToken);
    const totalDays = Math.round((afterLie.body.passExpireAt - Date.now()) / 86400000);
    ok(totalDays === 8, `推送谎报档位无效，只按服务端记录发 1 天（7+1=8，实际 ${totalDays}）`);
  }


  // ------------------------------------------------------------ 消息推送与平台查询
  section('6.6 消息推送：URL 验证、安全模式解密、平台查单');
  {
    const crypto = require('crypto');
    const { CONFIG } = require(path.join(__dirname, '..', 'server', 'config.js'));
    const accesstoken = require(path.join(__dirname, '..', 'server', 'accesstoken.js'));
    const gameapi = require(path.join(__dirname, '..', 'server', 'gameapi.js'));
    const NOTIFY_TOKEN = 'test-notify-token';

    const sha1Sorted = (parts) => crypto.createHash('sha1').update(parts.slice().sort().join('')).digest('hex');

    // ---- URL 验证（GET）。不做这一步，MP 后台的推送配置根本存不下来 ----
    {
      const ts = '1700735027';
      const nonce = '50328042';
      const echostr = 'Mzi3wDcVa5uI';
      const good = sha1Sorted([NOTIFY_TOKEN, ts, nonce]);

      const r1 = await get(`/api/pay/notify?signature=${good}&timestamp=${ts}&nonce=${nonce}&echostr=${echostr}`);
      ok(r1.status === 200 && (r1.raw === echostr || (r1.body && r1.body._raw === echostr)),
        'URL 验证通过时原样返回 echostr');

      const r2 = await get(`/api/pay/notify?signature=badbadbad&timestamp=${ts}&nonce=${nonce}&echostr=${echostr}`);
      ok(r2.status === 403, 'URL 验证签名不对 → 403');

      const r3 = await get(`/api/pay/notify?signature=${good}&timestamp=${ts}&echostr=${echostr}`);
      ok(r3.status === 403, 'URL 验证缺参数 → 403');
    }

    // ---- 没配 Token 时一律拒收（不能让伪造请求混进来） ----
    {
      const saved = CONFIG.pay.notifyToken;
      CONFIG.pay.notifyToken = '';
      const r = await post('/api/pay/notify', { MiniGame: { Payload: '{}', PayEventSig: 'x' } });
      ok(r.status === 503, '没配推送 Token 时拒收发货推送');
      CONFIG.pay.notifyToken = saved;
    }

    // ---- 安全模式：消息体是 AES-256-CBC 加密的 ----
    {
      const AES_KEY = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'; // 43 字符
      const savedKey = CONFIG.pay.encodingAESKey;
      CONFIG.pay.encodingAESKey = AES_KEY;

      // 按微信消息加密格式构造密文：random(16) + len(4,大端) + msg + appid，PKCS#7 填充
      const encryptMsg = (msg, appId) => {
        const key = Buffer.from(AES_KEY + '=', 'base64');
        const iv = key.slice(0, 16);
        const msgBuf = Buffer.from(msg, 'utf8');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(msgBuf.length, 0);
        let buf = Buffer.concat([crypto.randomBytes(16), lenBuf, msgBuf, Buffer.from(appId, 'utf8')]);
        const pad = 32 - (buf.length % 32);
        buf = Buffer.concat([buf, Buffer.alloc(pad, pad)]);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        cipher.setAutoPadding(false);
        return Buffer.concat([cipher.update(buf), cipher.final()]).toString('base64');
      };

      // 先用一个已下单的订单，这样解密后能走完整发货流程
      const s2 = await post('/api/session', { devId: 'enc-user' });
      const owner2 = 'dev_enc-user';
      app.store.setSessionKey(owner2, 'fake-session-key-enc');
      const signEnc = await post('/api/pay/sign', { productId: 'pass_1d' }, s2.body.token);
      ok(signEnc.status === 200, '安全模式用例：下单成功');

      const inner = JSON.stringify({
        OpenId: owner2,
        Env: 0,
        OutTradeNo: signEnc.body.outTradeNo,
        GoodsInfo: { ProductId: 'pass_1d', Quantity: 1, ZoneId: '1', OrigPrice: 600, ActualPrice: 600 }
      });
      // 加密模式下，外层是 { Encrypt }，解密后才是含 MiniGame 的消息体
      const outer = JSON.stringify({
        ToUserName: 'gh_test',
        FromUserName: 'o_test',
        CreateTime: 1700735027,
        MsgType: 'event',
        Event: 'minigame_game_pay_goods_deliver_notify',
        MiniGame: {
          Payload: inner,
          PayEventSig: crypto.createHmac('sha256', process.env.MIDAS_APP_KEY).update(inner).digest('hex')
        }
      });

      const beforeEnc = await get('/api/entitlement', s2.body.token);
      const rEnc = await post('/api/pay/notify', { Encrypt: encryptMsg(outer, 'wxtestappid') });
      ok(rEnc.status === 200 && rEnc.body.ErrCode === 0, '安全模式加密推送被正确解密并接受');
      const afterEnc = await get('/api/entitlement', s2.body.token);
      ok(afterEnc.body.passExpireAt > (beforeEnc.body.passExpireAt || 0),
        '解密后的发货消息正常发放权益');

      // 密文被改坏时不能崩，也不能误发货
      const rBad = await post('/api/pay/notify', { Encrypt: 'not-a-valid-ciphertext' });
      ok(rBad.status === 200 && rBad.body.ErrCode === 0, '非法密文不崩，回成功避免平台无意义重试');
      const afterBad = await get('/api/entitlement', s2.body.token);
      ok(afterBad.body.passExpireAt === afterEnc.body.passExpireAt, '非法密文不会误发货');

      CONFIG.pay.encodingAESKey = savedKey;
    }

    // ---- 平台查单（pay_v2.queryOrder）：把"信客户端"升级成"平台说了算" ----
    {
      const realFetch = global.fetch;
      const calls = [];
      // 给 store 塞一个未过期的 token，这样 accesstoken.get 不会发网络请求
      app.store.setAccessToken({ token: 'fake-access-token', expireAt: Date.now() + 3600000 });
      accesstoken.clearCache();

      global.fetch = (url, opt) => {
        calls.push({ url: String(url), body: opt && opt.body });
        const body = JSON.parse((opt && opt.body) || '{}');
        // 按官方返回体模拟
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              errcode: 0,
              errmsg: 'ok',
              out_trade_no: body.out_trade_no,
              product_id: 'pass_7d',
              pay_state: 2, // 已支付
              deliver_state: 2,
              pay_finish_time: Math.floor(Date.now() / 1000),
              transaction_id: 'wx_txn_test'
            })
        });
      };

      try {
        const q = await gameapi.queryOrder({
          openid: 'dev_pay-user',
          outTradeNo: 'ORDER_FOR_QUERY',
          sessionKey: 'fake-session-key-0123456789',
          store: app.store
        });
        ok(q.ok && q.paid === true, `平台查单返回已支付（payState=${q.payState}）`);

        ok(calls.length === 1, '只发起了一次平台调用');
        const url = calls[0].url;
        const bodyStr = calls[0].body;

        // URL 必须带四个参数：access_token / signature / sig_method / pay_sig
        ok(/access_token=fake-access-token/.test(url), '请求带 access_token');
        ok(/sig_method=hmac_sha256/.test(url), 'sig_method = hmac_sha256');
        ok(/[?&]signature=[0-9a-f]{64}/.test(url), '请求带 signature（64 位十六进制）');
        ok(/[?&]pay_sig=[0-9a-f]{64}/.test(url), '请求带 pay_sig');
        ok(url.indexOf('/wxa/game/queryorderinfo') > 0, '路径正确（/wxa/game/queryorderinfo）');

        // 请求体字段按文档要求
        const body = JSON.parse(bodyStr);
        ok(body.openid === 'dev_pay-user', 'body 带 openid');
        ok(body.offer_id === 'test-offer-id', 'body 带 offer_id');
        ok(typeof body.ts === 'number' && String(body.ts).length === 10, `ts 是秒级时间戳（${body.ts}）`);
        ok(body.zone_id === '1', 'body 带 zone_id');
        ok(body.env === 0, 'body 带 env');
        ok(body.out_trade_no === 'ORDER_FOR_QUERY', 'body 带 out_trade_no');
        // ⚠️ biz_id：1 = 代币，2 = 道具直购。我们是道具直购，写错会查不到订单
        ok(body.biz_id === 2, `biz_id = 2（道具直购），实际 ${body.biz_id}`);

        // 两个签名都能独立复现
        const expectSig = crypto
          .createHmac('sha256', 'fake-session-key-0123456789')
          .update(bodyStr)
          .digest('hex');
        ok(decodeURIComponent((url.match(/[?&]signature=([0-9a-f]{64})/) || [])[1] || '') === expectSig,
          'signature = HMAC-SHA256(session_key, 请求体原文)');
        const expectPaySig = crypto
          .createHmac('sha256', process.env.MIDAS_APP_KEY)
          .update('pay_v2.queryOrder&' + bodyStr)
          .digest('hex');
        ok(decodeURIComponent((url.match(/[?&]pay_sig=([0-9a-f]{64})/) || [])[1] || '') === expectPaySig,
          'pay_sig 按当前 MIDAS_SIG_MODE 生成（english_name 模式）');

        // 签名模式可切换：这是为"官方签名说明在腾讯文档里、需权限"留的后路
        const savedMode = CONFIG.pay.sigMode;
        CONFIG.pay.sigMode = 'path';
        calls.length = 0;
        await gameapi.queryOrder({
          openid: 'dev_pay-user',
          outTradeNo: 'ORDER_FOR_QUERY',
          sessionKey: 'fake-session-key-0123456789',
          store: app.store
        });
        const expectPathSig = crypto
          .createHmac('sha256', process.env.MIDAS_APP_KEY)
          .update('/wxa/game/queryorderinfo&' + calls[0].body)
          .digest('hex');
        ok(decodeURIComponent((calls[0].url.match(/[?&]pay_sig=([0-9a-f]{64})/) || [])[1] || '') === expectPathSig,
          'MIDAS_SIG_MODE=path 时换成路径拼法（签名报 90011 时可切换）');
        CONFIG.pay.sigMode = savedMode;

        // 平台说"未支付"时，confirm 不能发货
        calls.length = 0;
        global.fetch = () =>
          Promise.resolve({
            json: () =>
              Promise.resolve({
                errcode: 0,
                errmsg: 'ok',
                out_trade_no: 'ORDER_FOR_QUERY',
                pay_state: 1, // 未支付
                deliver_state: 1
              })
          });
        const order2 = await post('/api/pay/sign', { productId: 'pass_1d' }, (await post('/api/session', { devId: 'pay-user' })).body.token);
        void order2;
        const qUnpaid = await gameapi.queryOrder({
          openid: 'dev_pay-user',
          outTradeNo: 'ORDER_FOR_QUERY',
          sessionKey: 'fake-session-key-0123456789',
          store: app.store
        });
        ok(qUnpaid.ok && qUnpaid.paid === false && qUnpaid.payState === 1,
          '平台返回未支付时 paid=false（上层据此拒绝发货）');
      } finally {
        global.fetch = realFetch;
        accesstoken.clearCache();
      }
    }

    // ---- 内容安全接口（有 UGC 才需要，先把能力备好） ----
    {
      const realFetch = global.fetch;
      let captured = null;
      global.fetch = (url, opt) => {
        captured = { url: String(url), body: JSON.parse((opt && opt.body) || '{}') };
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              errcode: 0,
              errmsg: 'ok',
              trace_id: 'trace_test',
              result: { suggest: 'risky', label: 10001, replaced_content: '最新***红胡子攻略' },
              detail: [{ strategy: 'minigame_content_model', errcode: 0, suggest: 'risky', label: 10001, prob: 90 }]
            })
        });
      };
      try {
        const r = await gameapi.msgSecCheck({
          openid: 'dev_pay-user',
          content: '最新队换马嗖红胡子攻略团',
          scene: gameapi.MSG_SCENE.PROFILE,
          store: app.store
        });
        ok(r.ok && r.pass === false, '命中违规内容时 pass=false');
        ok(r.label === 10001, `返回命中标签（label=${r.label} 营销广告）`);
        ok(!!r.replaced, '返回替换后的文本（可直接展示）');
        ok(captured.url.indexOf('/wxa/game/content_spam/msg_sec_check') > 0,
          '用的是**小游戏专用**内容安全接口，不是小程序通用的那个');
        ok(captured.body.version === 2, 'version 固定为 2');
        ok(captured.body.openid === 'dev_pay-user' && !!captured.body.content, '带 openid 与 content');
      } finally {
        global.fetch = realFetch;
      }
    }
  }


  // ------------------------------------------------------------ 账号与登录态
  section('6.7 账号与登录态：严格鉴权、校验、重置');
  {
    const crypto = require('crypto');
    const { CONFIG } = require(path.join(__dirname, '..', 'server', 'config.js'));
    const accesstoken = require(path.join(__dirname, '..', 'server', 'accesstoken.js'));
    const gameapi = require(path.join(__dirname, '..', 'server', 'gameapi.js'));

    const sess = await post('/api/session', { devId: 'acct-user' });
    const acctToken = sess.body.token;
    ok(!!acctToken, '开发模式能拿到 token');

    // ---- GET /api/account ----
    const acct = await get('/api/account', acctToken);
    ok(acct.status === 200 && acct.body.ok, 'GET /api/account 成功');
    ok(acct.body.devMode === true, '开发模式下标记 devMode');
    ok(acct.body.loggedIn === false, '开发模式不算"已通过微信登录"');
    // 脱敏：不能把完整 openid 下发（虽然是标识符，但没必要给全）
    ok(/^\w{0,6}\*{4}/.test(acct.body.openidMasked || ''), `账号标识已脱敏（${acct.body.openidMasked}）`);
    ok(acct.raw.indexOf('dev_acct-user') < 0, '响应里没有完整 openid');
    ok(typeof acct.body.statusText === 'string' && acct.body.statusText.length > 0,
      `带一句可展示的状态文案（"${acct.body.statusText}"）`);
    ok(acct.body.hasUnionid === false, '未绑开放平台时 unionid 为空（如实反映）');

    // ---- ⚠️ token 失效必须明确报错，不能静默降级成 IP ----
    // 这是修过的一个真 bug：以前 token 过期后会回退到 ip_xxx，
    // 用户的付费权益会因此"消失"（owner 变了，查不到数据）。
    const expired = await get('/api/entitlement', 'aaaa.bbbb.cccc');
    ok(expired.status === 401 && expired.body.error === 'TOKEN_EXPIRED',
      'token 失效时返回 401 TOKEN_EXPIRED（不再静默按 IP 认人）');
    const expiredPay = await post('/api/pay/sign', { productId: 'pass_1d' }, 'aaaa.bbbb.cccc');
    ok(expiredPay.status === 401 && expiredPay.body.error === 'TOKEN_EXPIRED',
      '支付接口对失效 token 同样返回 401（涉及钱更要严格）');
    const expiredAcct = await get('/api/account', 'aaaa.bbbb.cccc');
    ok(expiredAcct.status === 401, '账号接口对失效 token 返回 401');

    // 不带 token 时仍允许（开发模式 / 匿名配额）
    const anon = await get('/api/account');
    ok(anon.status === 200 && anon.body.anonymous === true, '不带 token 时按匿名处理，不报错');

    // ---- 重新登录 ----
    const re = await post('/api/account/relogin', { devId: 'acct-user' });
    ok(re.status === 200 && re.body.ok && !!re.body.token, 'POST /api/account/relogin 成功');
    ok(re.raw.indexOf('sessionKey') < 0 && re.raw.indexOf('session_key') < 0,
      '重新登录的响应里没有 session_key');
    const acct2 = await get('/api/account', re.body.token);
    ok(acct2.status === 200, '新 token 可用');

    // ---- 重置登录凭证：没有凭证时要给可执行的提示 ----
    const resetNoKey = await post('/api/account/reset-session', {}, acctToken);
    ok(resetNoKey.status === 400 && resetNoKey.body.error === 'NO_SESSION_KEY',
      '开发模式没有凭证时，重置接口提示"直接重新登录"');
    ok(/重新登录/.test(resetNoKey.body.message || ''), `提示可执行："${resetNoKey.body.message}"`);

    // ---- checkSessionKey / resetUserSessionKey 的签名 ----
    // ⚠️ 这两个接口的签名是**对空字符串签名**：hmac_sha256(session_key, "")
    //    和支付那边的"对请求体签名"不同，混用会导致 87009 无效签名。
    {
      const realFetch = global.fetch;
      const calls = [];
      global.fetch = (url) => {
        calls.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ errcode: 0, errmsg: 'ok' }) });
      };
      app.store.setAccessToken({ token: 'fake-access-token', expireAt: Date.now() + 3600000 });
      accesstoken.clearCache();
      try {
        const c = await gameapi.checkSessionKey({
          openid: 'dev_acct-user',
          sessionKey: 'THE-SESSION-KEY',
          store: app.store
        });
        ok(c.ok && c.valid === true, 'checkSessionKey 校验通过');
        ok(calls[0].indexOf('/wxa/checksession') > 0, '路径正确（/wxa/checksession）');
        const expectEmpty = crypto.createHmac('sha256', 'THE-SESSION-KEY').update('').digest('hex');
        ok(calls[0].indexOf(`signature=${expectEmpty}`) > 0,
          'signature = hmac_sha256(session_key, "")（对空字符串签名，不是对 body）');
        ok(calls[0].indexOf('sig_method=hmac_sha256') > 0, '带 sig_method=hmac_sha256');

        // 87009 = 无效签名 → 判定为"凭证已失效"而不是"调用失败"
        calls.length = 0;
        global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ errcode: 87009, errmsg: 'invalid signature' }) });
        const c2 = await gameapi.checkSessionKey({
          openid: 'dev_acct-user', sessionKey: 'STALE-KEY', store: app.store
        });
        ok(c2.ok && c2.valid === false && c2.error === 'SESSION_INVALID',
          '87009 判定为"登录凭证已失效"（而不是当成调用失败）');

        // 重置凭证
        calls.length = 0;
        global.fetch = (url) => {
          calls.push(String(url));
          return Promise.resolve({
            json: () => Promise.resolve({ errcode: 0, errmsg: 'ok', openid: 'dev_acct-user', session_key: 'NEW-KEY' })
          });
        };
        const r = await gameapi.resetUserSessionKey({
          openid: 'dev_acct-user', sessionKey: 'THE-SESSION-KEY', store: app.store
        });
        ok(r.ok && r.sessionKey === 'NEW-KEY', 'resetUserSessionKey 返回新凭证');
        ok(calls[0].indexOf('/wxa/resetusersessionkey') > 0, '路径正确（/wxa/resetusersessionkey）');
        ok(calls[0].indexOf(`signature=${expectEmpty}`) > 0, '重置同样用空字符串签名');

        // 87007 = 凭证不存在或已过期 → 官方说重置**不能续期**，所以要提示重新登录
        global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ errcode: 87007, errmsg: 'session_key is not existed or expired' }) });
        const r2 = await gameapi.resetUserSessionKey({
          openid: 'dev_acct-user', sessionKey: 'GONE', store: app.store
        });
        ok(!r2.ok && r2.code === 87007, '87007 判定为凭证已不存在');
        ok(/重新登录/.test(r2.message || ''), `提示说明重置无法续期："${r2.message}"`);
      } finally {
        global.fetch = realFetch;
        accesstoken.clearCache();
      }
    }

    // ---- 40226：高风险用户被平台拦截登录 ----
    // 官方错误码：40226 code blocked「高风险等级用户，小程序登录拦截」。
    // 不能当成普通失败让用户重试，要给一句得体的话术，而且不能挡住玩游戏。
    {
      // ⚠️ 这里要**拦 wxhttp 而不是 global.fetch**：code2session 现在走 wxhttp
      //    （因为云托管内网代理是自签证书，fetch 必然失败，见 server/wxhttp.js）。
      //    拦 fetch 的话请求会真的打到微信去，测试环境只能收到 "invalid appid"。
      const realGetJson = wxhttpMod.getJson;
      const savedAppId = CONFIG.wechat.appid;
      const savedSecret = CONFIG.wechat.secret;
      CONFIG.wechat.appid = 'wxtestappid';
      CONFIG.wechat.secret = 'testsecret';
      const stub = (payload) => {
        wxhttpMod.getJson = () => Promise.resolve({ ok: true, status: 200, via: 'strict', json: payload });
      };
      try {
        stub({ errcode: 40226, errmsg: 'code blocked' });
        const r = await post('/api/account/relogin', { code: 'some-code' });
        ok(r.status === 403 && r.body.blocked === true, '40226 返回 403 且标记 blocked');
        ok(/暂时无法/.test(r.body.message || ''), `话术得体，不引导重试："${r.body.message}"`);

        // 40029（code 无效）：这个要引导重试
        stub({ errcode: 40029, errmsg: 'invalid code' });
        const r2 = await post('/api/account/relogin', { code: 'stale-code' });
        ok(r2.status === 401 && r2.body.blocked !== true, '40029 不标记 blocked');
        ok(/重试/.test(r2.body.message || ''), `40029 引导重试："${r2.body.message}"`);
      } finally {
        wxhttpMod.getJson = realGetJson;
        CONFIG.wechat.appid = savedAppId;
        CONFIG.wechat.secret = savedSecret;
      }
    }
  }


  // ------------------------------------------------------------ 账号游玩记录
  section('6.8 游戏账号的游玩记录（账号存结果，不存生辰）');
  {
    const s = await post('/api/session', { devId: 'play-user' });
    const t = s.body.token;

    // 上报一局
    const entry = {
      resultId: 'R_TEST_1',
      mainId: 'naruto',
      resonance: 88,
      rarity: 'epic',
      dominantBadge: '结绳者',
      fates: ['undying_bond', 'light_watch'],
      mode: 'chart',
      at: Date.now(),
      unlocked: ['naruto', 'sasuke', 'hinata'],
      scores: { naruto: 88, sasuke: 70, hinata: 65 }
    };
    const r1 = await post('/api/play/record', entry, t);
    ok(r1.status === 200 && r1.body.ok && r1.body.duplicate === false, '上报一局游玩记录');
    ok(r1.body.stats.total === 1, `累计次数 = ${r1.body.stats.total}`);
    ok(r1.body.stats.codexCount === 3, `图鉴记下 ${r1.body.stats.codexCount} 个角色`);

    // 幂等：同一个 resultId 重复上报不重复计数
    const r2 = await post('/api/play/record', entry, t);
    ok(r2.body.duplicate === true, '同 resultId 重复上报被识别为重复');
    ok(r2.body.stats.total === 1, '重复上报不增加次数');
    ok(r2.body.stats.codexCount === 3, '重复上报不增加图鉴');

    // ---- ⚠️ 字段白名单：连"间接泄露"的字段都要丢掉 ----
    // 四柱能反推出生时刻，所以它连出现都不能出现
    const dirty = await post('/api/play/record', {
      resultId: 'R_DIRTY',
      mainId: 'sasuke',
      resonance: 70,
      // 下面这些都不该被存下来
      birthDate: '1996-08-19',
      birthTime: '07:20',
      name: '张三',
      city: '上海',
      pillars: { year: 12, month: 32 },
      dims: { light: 50, order: 60 },
      seed: 'wo-tui-zhan-xing-v1|张三|1996-08-19',
      // 超长/非法字段也应被裁剪
      extraJunk: 'x'.repeat(5000)
    }, t);
    ok(dirty.status === 200, '带脏字段的上报不会报错');
    const pulled = await get('/api/play', t);
    const pulledBlob = JSON.stringify(pulled.body);
    ok(pulledBlob.indexOf('1996') < 0, '服务端没存出生日期');
    ok(pulledBlob.indexOf('张三') < 0 && pulledBlob.indexOf('上海') < 0, '没存姓名与城市');
    ok(pulledBlob.indexOf('pillars') < 0 && pulledBlob.indexOf('dims') < 0, '没存四柱与八轴');
    ok(pulledBlob.indexOf('wo-tui-zhan-xing-v1') < 0, '没存命盘种子（种子含生辰）');
    ok(pulledBlob.indexOf('extraJunk') < 0 && pulledBlob.length < 20000, '多余字段被丢弃，数据量可控');

    // ---- 拉取 ----
    ok(pulled.status === 200 && pulled.body.ok, 'GET /api/play 成功');
    ok(pulled.body.stats.total === 2, `累计 ${pulled.body.stats.total} 局`);
    ok(!!pulled.body.codex.naruto, '图鉴里有 naruto');
    ok(pulled.body.codex.naruto.count === 1 && pulled.body.codex.naruto.firstScore === 88,
      '图鉴记录了首次共振度');
    ok(pulled.body.history.length === 2, `历史 ${pulled.body.history.length} 条`);
    ok(pulled.body.history[0].resultId === 'R_DIRTY', '历史按时间倒序（最新在最前）');

    // 同一角色再次遇到：计数累加
    await post('/api/play/record', {
      resultId: 'R_TEST_2', mainId: 'naruto', resonance: 90, at: Date.now() + 1000,
      unlocked: ['naruto'], scores: { naruto: 90 }
    }, t);
    const pulled2 = await get('/api/play', t);
    ok(pulled2.body.codex.naruto.count === 2, '同一角色再次遇到，计数累加');
    ok(pulled2.body.codex.naruto.firstScore === 88, '首次共振度不会被后来的覆盖');

    // ---- 账号信息里也带上游玩统计 ----
    const acct = await get('/api/account', t);
    ok(acct.body.play && acct.body.play.total === 3, `账号信息里带游玩统计（${acct.body.play && acct.body.play.total} 局）`);

    // ---- token 失效时不能静默降级 ----
    const bad = await post('/api/play/record', { resultId: 'X' }, 'bad.token.here');
    ok(bad.status === 401 && bad.body.error === 'TOKEN_EXPIRED',
      '游玩记录接口对失效 token 返回 401（不能按 IP 记到别人头上）');

    // ---- 清空账号记录 ----
    const cleared = await post('/api/play/clear', {}, t);
    ok(cleared.status === 200 && cleared.body.ok, 'POST /api/play/clear 成功');
    const afterClear = await get('/api/play', t);
    ok(afterClear.body.stats.total === 0 && Object.keys(afterClear.body.codex).length === 0,
      '账号记录已清空');
  }


  section('7. 输入不干净时的表现');
  {
    const t = await freshToken('hacker');
    const nasty = {
      key: 'hack-key-1',
      mode: 'chart',
      dims: { light: 'DROP TABLE', order: 99999, bond: -50 },
      signs: { sun: '"><script>', moon: 'nope', risingKnown: true },
      pillars: { year: 999, month: -3, day: 'abc', hourKnown: true },
      element: '不存在的元素',
      lifeNumber: 'abc',
      draw: { signA: 'x', signB: 'y', fateId: 'nope' }
    };
    const r = await post('/api/divinate', nasty, t);
    ok(r.status === 200 && r.body.ok, '畸形输入不崩，返回可用结果');
    ok(r.raw.indexOf('DROP TABLE') < 0 && r.raw.indexOf('script') < 0, '自由文本没有回显到响应里');
    ok(!!r.body.copy.essence, '畸形输入下依然有完整文案');
    const sent = JSON.stringify(lastRequest);
    ok(sent.indexOf('DROP TABLE') < 0 && sent.indexOf('script') < 0,
      '自由文本没有进入提示词（防注入）');

    const oversized = await post('/api/divinate', { key: 'x'.repeat(5000), dims: { light: 50 } }, t);
    ok(oversized.status === 400 || oversized.status === 200, '超长 key 被处理而不是崩掉',
      String(oversized.status));
  }

  // ------------------------------------------------------------ 异步解读任务
  section('异步解读：提交任务 + 轮询（云调用单次超时 15s，同步请求会被截断）');
  {
    const token = await freshToken('task');
    // 换一个 key：避免命中上一条测试留下的缓存（缓存命中会直接返回 done，测不到轮询）
    const facts = {
      key: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dims: { light: 62, order: 44, bond: 71, passion: 38, fate: 55, mercy: 66, obsession: 49, sacrifice: 58 },
      signs: { sun: 'leo', moon: 'aries' },
      mode: 'chart'
    };

    const submit = await post('/api/divinate/task', facts, token);
    ok(submit.status === 200 && submit.body && submit.body.ok, '提交任务返回 200');
    // 这是这条链路存在的意义：提交必须"秒回"，否则云调用 15s 超时还是会截断
    ok(!!submit.body.jobId, `拿到 jobId（${submit.body.jobId}）`);
    ok(submit.body.status === 'pending' || submit.body.status === 'done',
      `提交后状态是 pending 或 done（${submit.body.status}）`);

    let final = null;
    if (submit.body.status === 'pending') {
      for (let i = 0; i < 20 && !final; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const poll = await get(`/api/divinate/task?jobId=${submit.body.jobId}`, token);
        if (poll.body && poll.body.status !== 'pending') final = poll.body;
        else await new Promise((r) => setTimeout(r, 150));
      }
    } else {
      final = submit.body;
    }
    ok(!!final, '轮询拿到最终状态');
    ok(final.status === 'done', `任务是 done（${final && final.status}）`);
    ok(final.source === 'ai', `拿到 AI 文案（source=${final.source}）`);
    ok(!!final.copy && final.copy.essence.length > 20, '文案完整');
    ok(final.copy.aiGenerated === true, '标注为 AI 生成（合规要求）');
    ok(!!final.meta && !!final.meta.quota, '带配额信息');
    ok(!!final.match && !!final.match.main, '带匹配结果（角色卡要用）');

    // ⚠️ 安全：别人的 jobId 不能读到别人的解读
    const other = await freshToken('task-other');
    const stolen = await get(`/api/divinate/task?jobId=${submit.body.jobId}`, other);
    ok(stolen.status === 404, `别人的 jobId 读不到（${stolen.status}）`);
    const noToken = await get(`/api/divinate/task?jobId=${submit.body.jobId}`);
    ok(noToken.status === 404, '不带 token 也读不到');

    // 同一个 key 再来一次 → 命中缓存，直接 done，不用轮询
    const again = await post('/api/divinate/task', facts, token);
    ok(again.body && again.body.status === 'done' && again.body.source === 'cache',
      `同盘再提交直接命中缓存（${again.body && again.body.source}）`);

    // 同步接口必须保留（老客户端、本地开发都在用）
    const syncFacts = Object.assign({}, facts, { key: `sync-${Date.now()}` });
    const sync = await post('/api/divinate', syncFacts, token);
    ok(sync.status === 200 && sync.body.ok && !!sync.body.copy, '同步接口 /api/divinate 仍然可用');
  }

  // ------------------------------------------------------------ 云托管持久化
  section('云托管：MySQL 快照持久化（注入假驱动验证 SQL，不需要真库）');
  {
    const { createMysqlSink, attach } = require(path.join(ROOT, 'server', 'store-mysql.js'));
    const { createStore } = require(path.join(ROOT, 'server', 'store.js'));

    const sql = [];
    let row = null;
    const driver = {
      createPool: () => ({
        query: async (q, params) => {
          const s = String(q).replace(/\s+/g, ' ').trim();
          sql.push(s);
          if (/^SELECT data FROM/.test(s)) return [row ? [{ data: row }] : []];
          if (/^INSERT INTO/.test(s)) {
            row = params[1];
            return [{ affectedRows: 1 }];
          }
          return [[]];
        },
        end: async () => {}
      })
    };
    const cfg = { driver, host: 'h', user: 'u', password: 'p', database: 'db' };

    const sink = createMysqlSink(cfg);
    ok((await sink.load()) === null, '空库时 load 返回 null');
    await sink.save('{"a":1}');
    ok((await sink.load()) === '{"a":1}', 'save 之后能读回来');
    ok(sql.some((s) => /CREATE TABLE IF NOT EXISTS store_snapshot/.test(s)), '自动建表（幂等，重复执行无害）');
    ok(sql.some((s) => /INSERT INTO store_snapshot .*ON DUPLICATE KEY UPDATE/.test(s)),
      '写库用 upsert：反复写不会插出多行');
    ok(sql.some((s) => /WHERE id = \?/.test(s)), '固定读写 id=1 那一行');

    const dir = path.join(ROOT, 'server', `.tmp-mysql-${Date.now()}`);
    const store = createStore({ dataDir: dir, proseCacheDays: 30 });
    const r = await attach(store, cfg);
    ok(r.ok && r.restored, 'attach 能把历史快照读回内存（付费权益不丢的前提）');

    store.setUser('openid_x', { passExpireAt: 1700000000000, orders: { o1: 1 } });
    store.save();
    await new Promise((res) => setTimeout(res, 50));
    const written = JSON.parse(row);
    ok(!!(written.users && written.users.openid_x), '用户权益被写进快照');
    ok(written.users.openid_x.passExpireAt === 1700000000000,
      '畅玩卡到期时间完整落库（重启后不会丢已购权益）');

    // 模拟重启：新 store 从同一份数据恢复
    const store2 = createStore({ dataDir: path.join(ROOT, 'server', `.tmp-mysql2-${Date.now()}`) });
    await attach(store2, cfg);
    ok(!!store2.getUser('openid_x') && store2.getUser('openid_x').passExpireAt === 1700000000000,
      '重启后能从 MySQL 恢复用户权益');

    // 连不上时不能把服务拖垮
    const bad = createMysqlSink({
      driver: {
        createPool: () => ({
          query: async () => {
            throw new Error('connect ECONNREFUSED');
          },
          end: async () => {}
        })
      },
      host: 'h', user: 'u', password: 'p', database: 'db'
    });
    const store3 = createStore({ dataDir: path.join(ROOT, 'server', `.tmp-mysql3-${Date.now()}`) });
    const r3 = await attach(store3, { driver: bad, host: 'h', user: 'u', password: 'p', database: 'db' });
    ok(r3.ok === false, '连不上 MySQL 时不抛异常，自动降级为纯内存');
    ok(typeof store3.getUser === 'function', '降级后 store 依然可用（服务不会因此起不来）');

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      /* 忽略 */
    }
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
  require(path.join(__dirname, '..', 'server', 'store.js'));
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
})().catch((e) => {
  console.error('测试自身异常:', e);
  process.exit(1);
});
