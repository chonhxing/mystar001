/**
 * MySQL 持久化（微信云托管用）。
 *
 * ## 为什么是"整份快照"而不是每个方法一条 SQL
 *
 * 服务端所有调用点都是**同步**的（`store.getUser(openid)` 直接返回对象）。
 * 改成关系表就意味着把整个 server 改成 async —— 那是一次伤筋动骨的重构，
 * 而我们的数据量很小：解读缓存 + 每日配额 + 用户权益，整份 JSON 也就几十 KB。
 * 所以这里把内存里的那份 JSON **整份存取**（一行一列），同步接口一行都不用改。
 *
 * ## 代价（必须知道）
 *
 * **只支持单实例。** 两个副本各自持有一份内存快照，会互相覆盖。
 * 微信云托管默认就是 1 个副本，我们的量也远没到需要扩容的程度；
 * 真要扩容，就得把这个文件换成"每个方法一条 SQL"的实现（接口不用变）。
 *
 * ## 依赖
 *
 * `mysql2` 是**按需 require** 的：本地开发不配 `DB_HOST` 就完全不会加载它，
 * 仓库依旧零依赖（`package.json` 里没有 dependencies）。
 * 云托管的镜像在构建时单独装（见 Dockerfile）。
 *
 * ## 安全
 *
 * 数据库密码只走**环境变量**（云托管控制台 → 服务设置 → 环境变量），
 * 绝对不要写进仓库或前端。
 */

const TABLE = 'store_snapshot';
const ROW_ID = 1;

/** 建表语句（和 cloud/init.sql 保持一致） */
const DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id INT NOT NULL PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

function createMysqlSink(opts) {
  const o = opts || {};
  let pool = null;
  let mysql = null;
  let lastError = '';

  function connect() {
    if (pool) return pool;
    // 按需加载：没装 mysql2 时给出可执行的提示，而不是一个看不懂的 MODULE_NOT_FOUND
    try {
      // eslint-disable-next-line global-require
      mysql = require('mysql2/promise');
    } catch (e) {
      throw new Error('缺少 mysql2 —— 云托管的镜像里会装（见 Dockerfile）；本地想连库请 npm i mysql2');
    }
    pool = mysql.createPool({
      host: o.host,
      port: o.port || 3306,
      user: o.user,
      password: o.password,
      database: o.database,
      waitForConnections: true,
      connectionLimit: 4,
      charset: 'utf8mb4',
      // 云托管内网连 MySQL，不需要 SSL
      ssl: o.ssl ? {} : undefined
    });
    return pool;
  }

  return {
    /** 读回上次的快照（没有就返回 null） */
    async load() {
      const p = connect();
      await p.query(DDL);
      const [rows] = await p.query(`SELECT data FROM ${TABLE} WHERE id = ?`, [ROW_ID]);
      if (!rows || !rows.length) return null;
      return rows[0].data;
    },

    /** 写回快照。失败只记日志，绝不让保存失败影响正在处理的请求 */
    async save(json) {
      try {
        const p = connect();
        await p.query(
          `INSERT INTO ${TABLE} (id, data, updated_at) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
          [ROW_ID, json, Date.now()]
        );
        lastError = '';
        return true;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        if (msg !== lastError) {
          lastError = msg;
          console.error('[store-mysql] 保存失败:', msg);
        }
        return false;
      }
    },

    async ping() {
      const p = connect();
      const [rows] = await p.query('SELECT 1 AS ok');
      return !!(rows && rows.length);
    },

    async close() {
      if (pool) {
        const p = pool;
        pool = null;
        await p.end();
      }
    },

    lastError() {
      return lastError;
    }
  };
}

/**
 * 把 MySQL 挂到 store 上：先读回历史快照，之后 store 每次落盘都会回写一份。
 * @returns {Promise<{ok:boolean, restored:boolean, message:string}>}
 */
async function attach(store, dbConfig) {
  const sink = createMysqlSink(dbConfig);
  try {
    const json = await sink.load();
    if (json) {
      store.restore(json);
    }
    // 之后 store 的每次 flush 都顺带回写（fire-and-forget，不阻塞请求）
    store.setSaveHook((snapshotJson) => {
      sink.save(snapshotJson);
    });
    return { ok: true, restored: !!json, message: json ? '已从 MySQL 恢复' : 'MySQL 已就绪（首次为空）' };
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.error('[store-mysql] 初始化失败，本次退回纯内存（数据会丢）:', msg);
    return { ok: false, restored: false, message: msg };
  }
}

module.exports = { attach, createMysqlSink, DDL, TABLE };
