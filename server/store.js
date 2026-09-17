/**
 * 存储层。
 *
 * 默认实现是「内存 + JSON 文件落盘」，零依赖，能直接跑起来。
 * 但它只是一个接口的实现 —— 上生产（多实例、要并发）请换成数据库：
 * 实现下面这 6 个方法，然后在 index.js 里换成你的实现即可。
 *
 * 需要持久化的东西只有三类：
 *   1. 解读缓存（省钱 + 保证同一命盘结果稳定）
 *   2. 每日配额计数
 *   3. 调用统计（花销监控）
 */

const fs = require('fs');
const path = require('path');

const EMPTY = {
  prose: {},
  quota: {},
  // 用户权益（服务端权威，因为涉及付费）
  users: {},
  // session_key 短期缓存：签名要用，但绝不能下发客户端
  sessions: {},
  stats: { calls: 0, cached: 0, failed: 0, tokensIn: 0, tokensOut: 0 }
};

function createStore(opts) {
  const dir = opts.dataDir;
  const file = path.join(dir, 'store.json');
  const cacheMs = (opts.proseCacheDays || 30) * 24 * 3600 * 1000;
  let data = JSON.parse(JSON.stringify(EMPTY));
  let dirty = false;
  let timer = null;
  /**
   * 额外的落盘出口。微信云托管上没有持久化磁盘（容器重启 = 文件没了），
   * 所以挂一个 MySQL 出口把整份快照存起来（见 store-mysql.js）。
   * 本地开发不挂，保持"零依赖 + 一个 JSON 文件"。
   */
  let saveHook = null;

  function load() {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        data = Object.assign(JSON.parse(JSON.stringify(EMPTY)), parsed);
      }
    } catch (e) {
      console.error('[store] 读取失败，使用空存储:', e.message);
      data = JSON.parse(JSON.stringify(EMPTY));
    }
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      const json = JSON.stringify(data);
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, file); // 先写临时文件再改名，避免写一半断电
      // 挂了 MySQL 出口就顺带回写一份（云托管上这是唯一持久的副本）
      if (saveHook) {
        try {
          saveHook(json);
        } catch (e) {
          console.error('[store] 外部落盘失败:', e.message);
        }
      }
    } catch (e) {
      console.error('[store] 落盘失败:', e.message);
    }
  }

  function touch() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 800);
    if (timer.unref) timer.unref();
  }

  load();

  return {
    // ---- 解读缓存 ----
    getProse(key) {
      const row = data.prose[key];
      if (!row) return null;
      if (Date.now() - row.at > cacheMs) {
        delete data.prose[key];
        touch();
        return null;
      }
      row.hits = (row.hits || 0) + 1;
      touch();
      return row.copy;
    },
    setProse(key, copy) {
      data.prose[key] = { copy, at: Date.now(), hits: 0 };
      touch();
    },
    proseCount() {
      return Object.keys(data.prose).length;
    },

    // ---- 每日配额 ----
    quotaKey(owner, day) {
      return `${owner}|${day}`;
    },
    getQuota(owner, day) {
      return data.quota[this.quotaKey(owner, day)] || 0;
    },
    bumpQuota(owner, day) {
      const k = this.quotaKey(owner, day);
      data.quota[k] = (data.quota[k] || 0) + 1;
      touch();
      return data.quota[k];
    },
    globalToday(day) {
      let sum = 0;
      Object.keys(data.quota).forEach((k) => {
        if (k.endsWith(`|${day}`)) sum += data.quota[k];
      });
      return sum;
    },

    // ---- 用户权益（付费相关，服务端权威） ----
    getUser(openid) {
      return data.users[openid] || null;
    },
    setUser(openid, user) {
      data.users[openid] = user;
      touch();
    },

    // ---- access_token 缓存（进程重启后复用，少调一次接口） ----
    getAccessToken() {
      return data.accessToken || null;
    },
    setAccessToken(v) {
      data.accessToken = v;
      touch();
    },

    // ---- session_key（签名用，仅在服务端流转） ----
    setSessionKey(openid, sessionKey) {
      if (!openid || !sessionKey) return;
      data.sessions[openid] = { key: sessionKey, at: Date.now() };
      touch();
    },
    getSessionKey(openid) {
      const row = data.sessions[openid];
      if (!row) return '';
      // 微信侧 session_key 会过期（错误码 -15015），这里也设个上限避免长期留着
      if (Date.now() - row.at > 7 * 24 * 3600 * 1000) return '';
      return row.key || '';
    },

    // ---- 统计 ----
    bumpStat(field, by) {
      data.stats[field] = (data.stats[field] || 0) + (by || 1);
      touch();
    },
    stats() {
      return Object.assign({}, data.stats, {
        proseCached: this.proseCount(),
        quotaUsers: Object.keys(data.quota).length,
        payingUsers: Object.keys(data.users).length
      });
    },

    // ---- 维护 ----
    prune() {
      const now = Date.now();
      Object.keys(data.prose).forEach((k) => {
        if (now - data.prose[k].at > cacheMs) delete data.prose[k];
      });
      // 只留最近 7 天的配额记录
      const keep = new Set();
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(now - i * 86400000);
        keep.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
      }
      Object.keys(data.quota).forEach((k) => {
        const day = k.split('|')[1];
        if (!keep.has(day)) delete data.quota[k];
      });
      touch();
      flush();
    },

    save: flush,

    // ---- 云托管持久化用（本地开发用不到） ----
    /** 把当前数据整份导成 JSON 字符串 */
    snapshot() {
      return JSON.stringify(data);
    },
    /** 用一份 JSON 覆盖当前数据（云托管启动时从 MySQL 读回来） */
    restore(json) {
      try {
        const parsed = JSON.parse(json);
        data = Object.assign(JSON.parse(JSON.stringify(EMPTY)), parsed);
        console.log(`[store] 已恢复：缓存 ${Object.keys(data.prose).length} 条 · 用户 ${Object.keys(data.users).length} 个`);
      } catch (e) {
        console.error('[store] 恢复失败，用空存储启动:', e.message);
      }
    },
    /** 挂一个额外的落盘出口（每次 flush 时调用） */
    setSaveHook(fn) {
      saveHook = typeof fn === 'function' ? fn : null;
    }
  };
}

module.exports = { createStore };
