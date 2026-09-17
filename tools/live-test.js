/* eslint-disable no-console */
/**
 * 真实 AI 端到端测试（会真的调用 DeepSeek，产生费用）：
 *   node --env-file=server/.env tools/live-test.js
 *
 * 它做三件事：
 *   1. 起一个真的后端（读 server/.env 里的 key 和模型）
 *   2. 在本机算一份真命盘，按真实契约发一次 /api/divinate
 *   3. 把拿回来的文案、耗时、token 用量、粗算成本全部打出来
 *
 * 这是唯一能证明"AI 链路通不通、要等多久、花多少钱"的办法。
 */

const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);

function post(pathname, body, token) {
  const payload = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: pathname,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          token ? { Authorization: `Bearer ${token}` } : {}
        )
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            json = { _raw: raw };
          }
          resolve({ status: res.statusCode, body: json, raw });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: pathname }, (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      })
      .on('error', reject);
  });
}

function waitReady(tries) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http
        .get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          n += 1;
          if (n > (tries || 50)) return reject(new Error('后端没起来'));
          setTimeout(tick, 120);
        });
    };
    tick();
  });
}

(async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('没有读到 DEEPSEEK_API_KEY。用这个命令跑：node --env-file=server/.env tools/live-test.js');
    process.exit(1);
  }

  const core = require(path.join(ROOT, 'core/index.js'));
  const payloadCore = require(path.join(ROOT, 'core/payload.js'));
  const app = require(path.join(ROOT, 'server/index.js'));
  await waitReady();

  const health = await get('/api/health');
  console.log('\n=== 后端状态 ===');
  console.log(`  模型: ${health.body.ai.model}（已配置: ${health.body.ai.configured}）`);
  console.log(`  角色库: ${health.body.characters} 个`);

  const session = await post('/api/session', { devId: 'live-test' });
  const token = session.body.token;

  // 一份真实生辰：用命盘模式 + 答几道题，走完整链路
  // LIVE_VARIANT 换一份命盘，避免命中缓存导致测不出真实耗时
  const variant = process.env.LIVE_VARIANT || '';
  const profile = {
    name: `测试者${variant}`,
    gender: 'she',
    birthDate: process.env.LIVE_BIRTH || '1996-08-19',
    birthTime: '07:20',
    timeKnown: true,
    city: '上海'
  };
  const answers = {
    q_rewrite: 1,
    q_night_walk: 1,
    q_unfair_rule: 1,
    q_emergency_call: 0,
    q_destiny: 1,
    q_bystander: 0,
    q_price: 0,
    q_last_hit: 0,
    q_remembered: 1
  };

  const local = core.divinate({ profile, answers });
  console.log('\n=== 本机算出的图谱（不上传姓名生辰，只发这些数字）===');
  console.log(`  ${local.chart.signs.sun.name} / 月亮${local.chart.signs.moon.name} / 上升${local.chart.signs.rising.name}`);
  console.log(`  四柱：${local.chart.pillarsList.map((p) => p.label + p.pillar.name).join(' ')}`);
  console.log(`  命格：${local.chart.rarity.label} ｜ 八轴：${Object.keys(local.chart.dims).map((k) => `${k}=${local.chart.dims[k]}`).join(' ')}`);
  console.log(`  本机匹配的主推：${local.match.main.char.name}（共振 ${local.match.main.resonance}%）`);

  const facts = payloadCore.buildFacts(local);
  console.log(`\n=== 上行数据（${Buffer.byteLength(JSON.stringify(facts))} 字节）===`);
  console.log(`  ${JSON.stringify(facts).slice(0, 220)}...`);

  console.log('\n=== 请求 AI 解读（推理模型，可能要等十几秒）… ===');
  const t0 = Date.now();
  const res = await post('/api/divinate', facts, token);
  const cost = Date.now() - t0;

  if (!res.body.ok) {
    console.log(`  ✗ 失败：HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
    app.server.close();
    process.exit(1);
  }

  console.log(`  ✓ 耗时 ${(cost / 1000).toFixed(1)}s ｜ source=${res.body.source}`);
  console.log(`  服务端匹配的主推：${res.body.match.main.id}（共振 ${res.body.match.main.resonance}%）`);

  const copy = res.body.copy;
  console.log('\n=== 命途名 ===');
  console.log(`  ${copy.title}`);
  console.log('\n=== 图谱解读 ===');
  console.log(`  ${copy.essence}`);
  console.log('\n=== 为什么是 TA ===');
  console.log(`  ${copy.resonance}`);
  console.log('\n=== 你没走进的部分 ===');
  console.log(`  ${copy.difference}`);
  console.log('\n=== 你带不动的命途 ===');
  console.log(`  ${copy.anti}`);
  console.log('\n=== 一句提点 ===');
  console.log(`  ${copy.counsel}`);
  console.log(`\n  aiGenerated=${copy.aiGenerated}（通过校验的字段数）`);

  const stats = await get('/api/stats?token=' + encodeURIComponent(process.env.ADMIN_TOKEN || 'local-admin'));
  const st = stats.body.stats || {};
  console.log('\n=== 累计用量 ===');
  console.log(`  调用 ${st.calls} 次 ｜ 缓存命中 ${st.cached} ｜ 失败降级 ${st.failed}`);
  console.log(`  input ${st.tokensIn} token（其中缓存命中 ${st.cacheHitTokens || 0}）｜ output ${st.tokensOut} token（其中思考 ${st.tokensReasoning || 0}）`);

  // 粗算成本（按官网定价量级，具体以官网为准）
  const inPrice = 0.002 / 1000; // 假设 ¥2 / 百万 input token
  const outPrice = 0.008 / 1000; // 假设 ¥8 / 百万 output token
  const est = st.tokensIn * inPrice + st.tokensOut * outPrice;
  console.log(`  粗算花费 ≈ ¥${est.toFixed(4)}（单次约 ¥${(est / Math.max(1, st.calls)).toFixed(4)}，请以 DeepSeek 官网定价为准）`);

  const again = await post('/api/divinate', facts, token);
  console.log(`\n=== 再发一次同样的请求 ===`);
  console.log(`  source=${again.body.source}（cache 说明命中了缓存，没花第二次钱）`);

  app.server.close();
  setTimeout(() => process.exit(0), 150);
})().catch((e) => {
  console.error('真实测试异常:', e);
  process.exit(1);
});
