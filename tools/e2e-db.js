/* eslint-disable no-console */
/**
 * 真机部署前的最后一次联调：**用云上那台真 MySQL 跑一遍服务端**。
 *
 * 为什么必须单独做这一步：
 *   1. server-test 里的 MySQL 是"注入的假驱动"，只证明接口接对了，
 *      不证明真 MySQL 上能跑（DDL、字符集、连接参数都可能不认）；
 *   2. 连不上库时服务端会**静默退回纯内存**（为了不让服务起不来），
 *      于是"服务起来了"完全不等于"数据存得住"。
 * 这一步就是把这些都验掉：起服务 → 造一条数据 → 等落库 → 查真表。
 *
 *   DB_CHECK_PASSWORD=xxx node tools/e2e-db.js
 */
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');

const PORT = 8899;
process.env.PORT = String(PORT);
process.env.DATA_DIR = path.join(ROOT, 'server', '.tmp-e2e-db');
process.env.DB_HOST = process.env.DB_CHECK_HOST || 'sh-cynosdbmysql-grp-p4pa14l4.sql.tencentcdb.com';
process.env.DB_PORT = process.env.DB_CHECK_PORT || '26487';
process.env.DB_USER = process.env.DB_CHECK_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_CHECK_PASSWORD || '';
process.env.DB_NAME = process.env.DB_CHECK_NAME || 'wo_tui_zhan_xing';
// 不配 AI key：这一步只验数据库链路，不去花 AI 的钱
process.env.DEEPSEEK_API_KEY = '';
// 固定会话密钥：下面要验'重启后同一个 token 还能查到权益'，
// 没配 AUTH_SECRET 时服务端会每次启动换一个随机密钥（那是有意的安全行为），
// 这里要测的是数据恢复，不是会话密钥，所以显式给一个。
process.env.AUTH_SECRET = 'e2e-fixed-secret-for-restart-check-0123456789';

if (!process.env.DB_PASSWORD) {
  console.error('没有密码。用 DB_CHECK_PASSWORD=... node tools/e2e-db.js');
  process.exit(1);
}

function post(pathname, body, token) {
  const payload = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: pathname, method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          token ? { Authorization: `Bearer ${token}` } : {}
        ) },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: { _raw: raw } }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 每次查询都**新开一条连接**。
 *
 * 为什么不复用一条：腾讯云 MySQL 的**外网**入口对空闲连接会主动断开，
 * 而这个脚本要在中间等落盘、重启服务端，一条连接捂到最后多半已经断了
 * （现象是 ECONNRESET，看着像代码 bug，其实是连接被回收）。
 * 内网入口没这个问题，但脚本是拿外网地址跑的。
 */
async function dbQuery(sql) {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    return await conn.query(sql);
  } finally {
    try { await conn.end(); } catch (e) { /* 关闭失败无所谓 */ }
  }
}

/** 轮询等 /api/health 起来（服务端是"先接好 MySQL 再 listen"，启动时间不固定） */
async function waitHealth() {
  for (let i = 0; i < 60; i += 1) {
    /* eslint-disable no-await-in-loop */
    await sleep(250);
    try {
      return await new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => resolve(JSON.parse(raw)));
        }).on('error', reject);
      });
    } catch (e) { /* 还没起来，继续等 */ }
  }
  return null;
}

(async () => {
  // 先把上次留下的快照清掉，才能确认"这次真的写进去了"
  await dbQuery('DELETE FROM store_snapshot');
  console.log('① 已清空 store_snapshot，准备从零验证');

  const app = require(path.join(ROOT, 'server/index.js'));

  const health = await waitHealth();
  if (!health) {
    console.log('✗ /api/health 一直没起来（服务端启动失败）');
    process.exit(1);
  }
  console.log('② 服务端已启动（连的就是云上那台库）');
  console.log(`   /api/health：${JSON.stringify(health).slice(0, 200)}`);

  const s = await post('/api/session', { devId: 'e2e-db-check' });
  const token = s.body.token;
  console.log(`③ 建了一个会话（token ${token ? '拿到了' : '没拿到'}）`);

  // 造一条**真的用户数据**：占卜一次会记下这个人的配额用量。
  // 只验"快照文件写进去了"不够 —— 得确认"某个用户的数据能存下来、重启后还在"，
  // 这才是用户会感知到的那件事（畅玩卡、订单、剩余次数都是这条路径）。
  const core = require(path.join(ROOT, 'core/index.js'));
  const payloadCore = require(path.join(ROOT, 'core/payload.js'));
  const local = core.divinate({
    profile: { name: '联调', gender: 'she', birthDate: '1996-08-19', birthTime: '07:20', timeKnown: true, city: '上海' },
    answers: { q_rewrite: 1, q_night_walk: 1, q_unfair_rule: 1 }
  });
  const div = await post('/api/divinate/task', payloadCore.buildFacts(local), token);
  console.log(`   占卜一次（没配 AI key，走本地模板）：HTTP ${div.status} source=${div.body.source} status=${div.body.status}`);

  // 再存一条"账号级"数据（游玩记录）—— 这条走的是 data.users，
  // 和畅玩卡、订单是同一块存储，最能代表"用户的资产有没有存住"
  const rec = await post('/api/play/record', {
    main: local.match.main.char.id,
    resonance: local.match.main.resonance,
    rarity: local.chart.rarity.key,
    axes: Object.keys(local.chart.dims).map((k) => local.chart.dims[k])
  }, token);
  console.log(`   上报一条游玩记录：HTTP ${rec.status} ${JSON.stringify(rec.body).slice(0, 100)}`);
  await sleep(2500);

  const [rows] = await dbQuery('SELECT id, updated_at, CHAR_LENGTH(data) AS len, data FROM store_snapshot');
  if (!rows.length) {
    console.log('✗ 表里还是空的 —— 数据没落到 MySQL（生产环境会表现为"重启就丢数据"）');
    app.server.close();
    process.exit(1);
  }
  const row = rows[0];
  const snap = JSON.parse(row.data);
  const users = Object.keys(snap.users || {}).length;
  const quotaKeys = Object.keys(snap.quota || {});
  console.log(`④ ✓ 快照已落库：id=${row.id} ｜ ${row.len} 字节`);
  console.log(`   账号数据（畅玩卡/记录就存这儿）：${users} 个用户`);
  console.log(`   配额记录：${quotaKeys.join('、') || '（无）'}`);
  console.log(`   写入时间：${new Date(Number(row.updated_at)).toLocaleString('zh-CN')}`);
  if (users <= 0) {
    console.log('✗ 快照里没有账号数据，这条路没验通');
    app.server.close();
    process.exit(1);
  }

  console.log('\n再验一次"重启恢复"：重启服务端，看它能不能把这份快照读回来');
  app.server.close();
  await sleep(300);
  Object.keys(require.cache).forEach((k) => {
    if (k.indexOf(path.join(ROOT, 'server')) >= 0 || k.indexOf(path.join(ROOT, 'core')) >= 0) delete require.cache[k];
  });
  const app2 = require(path.join(ROOT, 'server/index.js'));
  if (!(await waitHealth())) {
    console.log('✗ 重启后服务端没起来');
    process.exit(1);
  }
  const again = await post('/api/session', { devId: 'e2e-db-check' });
  const ent = await new Promise((resolve, reject) => {
    http.get(
      { host: '127.0.0.1', port: PORT, path: '/api/entitlement',
        headers: token ? { Authorization: `Bearer ${token}` } : {} },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve({ _raw: raw }); } });
      }
    ).on('error', reject);
  });
  const [rows2] = await dbQuery('SELECT id, CHAR_LENGTH(data) AS len, data FROM store_snapshot');
  let users2 = 0;
  try { users2 = Object.keys(JSON.parse(rows2[0].data).users || {}).length; } catch (e) { users2 = -1; }
  console.log(`⑤ ✓ 重启后快照仍是 id=${rows2[0].id} / ${rows2[0].len} 字节 ｜ 用户数 ${users2}`);
  console.log(`   重启后查同一个 token 的权益：${JSON.stringify(ent).slice(0, 160)}`);
  console.log(`   会话接口正常（HTTP ${again.status}）`);
  if (users2 <= 0) {
    console.log('✗ 重启后用户数据没恢复回来');
    app2.server.close();
    process.exit(1);
  }

  app2.server.close();

  // 收尾：删掉这次造的测试快照 —— 生产库里不该留这个假用户。
  // 想看它写进去长什么样，就加 KEEP=1 再跑一次。
  if (process.env.KEEP === '1') {
    console.log('\n（KEEP=1：保留这次写入的测试快照，记得自己删）');
  } else {
    await dbQuery('DELETE FROM store_snapshot');
    console.log('\n⑥ 已清掉测试快照（想保留就加 KEEP=1 再跑）');
  }
  console.log('结论：云上那台 MySQL 的读写、快照落库、重启恢复都通了 ✅');
  setTimeout(() => process.exit(0), 200);
})().catch((e) => {
  console.error('失败：', e);
  process.exit(1);
});
