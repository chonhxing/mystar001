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
const TMP = path.join(__dirname, '..', 'server', '.tmp-server-test');
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
    ok(!/test-key-must-not-leak/.test(h.raw), 'health 不泄露 API key');

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

  // ------------------------------------------------------------ 抽签模式
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
      const realFetch = global.fetch;
      const savedAppId = CONFIG.wechat.appid;
      const savedSecret = CONFIG.wechat.secret;
      CONFIG.wechat.appid = 'wxtestappid';
      CONFIG.wechat.secret = 'testsecret';
      global.fetch = () =>
        Promise.resolve({
          json: () => Promise.resolve({ errcode: 40226, errmsg: 'code blocked' })
        });
      try {
        const r = await post('/api/account/relogin', { code: 'some-code' });
        ok(r.status === 403 && r.body.blocked === true, '40226 返回 403 且标记 blocked');
        ok(/暂时无法/.test(r.body.message || ''), `话术得体，不引导重试："${r.body.message}"`);

        // 40029（code 无效）：这个要引导重试
        global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ errcode: 40029, errmsg: 'invalid code' }) });
        const r2 = await post('/api/account/relogin', { code: 'stale-code' });
        ok(r2.status === 401 && r2.body.blocked !== true, '40029 不标记 blocked');
        ok(/重试/.test(r2.body.message || ''), `40029 引导重试："${r2.body.message}"`);
      } finally {
        global.fetch = realFetch;
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
