/* eslint-disable no-console */
/**
 * 一次性检查：云托管那台 MySQL 是不是真的能连、表是不是真的在。
 *
 * 为什么值得单独查一次：服务端在连不上库时会**静默退回纯内存**
 * （server/store-mysql.js 的行为，为了不让整个服务起不来），
 * 于是"部署成功"和"数据能存住"是两件事 —— 这一步就是把后者验掉。
 *
 *   node tools/check-db.js
 * 用的是外网地址（内网地址只有云托管的容器能连），
 * 但账号、库名、表结构都一样，足以说明问题。
 */
const path = require('path');
const mysql = require('mysql2/promise');

const HOST = process.env.DB_CHECK_HOST || 'sh-cynosdbmysql-grp-p4pa14l4.sql.tencentcdb.com';
const PORT = Number(process.env.DB_CHECK_PORT || 26487);
const USER = process.env.DB_CHECK_USER || 'root';
const PASSWORD = process.env.DB_CHECK_PASSWORD || '';
const DB = process.env.DB_CHECK_NAME || 'wo_tui_zhan_xing';

(async () => {
  if (!PASSWORD) {
    console.error('没有密码。用 DB_CHECK_PASSWORD=... node tools/check-db.js');
    process.exit(1);
  }
  const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DB });
  const [ver] = await conn.query('SELECT VERSION() AS v');
  console.log(`✓ 连上了 ${HOST}:${PORT} ｜ MySQL ${ver[0].v}`);

  const [tables] = await conn.query('SHOW TABLES');
  console.log(`  库 ${DB} 里的表：${tables.map((r) => Object.values(r)[0]).join('、') || '（空）'}`);

  const [ddl] = await conn.query('SHOW CREATE TABLE store_snapshot');
  console.log(`✓ store_snapshot 表存在，${ddl[0]['Create Table'].split('\n').length} 行建表语句`);

  const [rows] = await conn.query('SELECT id, updated_at, CHAR_LENGTH(data) AS len FROM store_snapshot');
  if (!rows.length) {
    console.log('  表里还没有数据（正常：服务端第一次保存快照时会写入）');
  } else {
    rows.forEach((r) => {
      console.log(
        `  快照 id=${r.id} ｜ ${r.len} 字节 ｜ 更新时间 ${new Date(Number(r.updated_at)).toLocaleString('zh-CN')}`
      );
    });
  }

  const [grants] = await conn.query('SHOW GRANTS');
  console.log(`  权限：${grants.map((g) => Object.values(g)[0]).join(' ｜ ')}`);
  await conn.end();
})().catch((e) => {
  console.error(`✗ 连接或查询失败：${e.code || ''} ${e.message}`);
  process.exit(1);
});
