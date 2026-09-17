-- 我推的星运 · 微信云托管 MySQL 建表脚本
--
-- 在云托管控制台 → 数据库（MySQL）→ 登录 phpMyAdmin（或"快捷语句"）里执行一次即可。
--
-- 为什么只有一张表：
--   服务端所有取数据的调用点都是**同步**的（`store.getUser(openid)` 直接返回对象），
--   改成关系表就得把整个 server 改成 async。而我们的数据量很小
--   （解读缓存 + 每日配额 + 用户权益，整份 JSON 也就几十 KB），
--   所以把内存里那份 JSON **整份存进一行**，同步接口一行都不用改。
--   代价：只支持单实例（云托管默认就是 1 个副本），多副本会互相覆盖。
--   详见 server/store-mysql.js 顶部的说明。

CREATE TABLE IF NOT EXISTS store_snapshot (
  id INT NOT NULL PRIMARY KEY,     -- 固定为 1，永远只有一行
  data LONGTEXT NOT NULL,          -- 整份 JSON 快照
  updated_at BIGINT NOT NULL       -- 毫秒时间戳，方便肉眼看"最后一次写入"
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '服务端存储快照（单行）';

-- 建议顺手确认一下字符集（emoji / 生僻字不会炸）
-- ALTER DATABASE wo_tui_zhan_xing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 看一眼有没有数据（服务端跑起来之后应该能看到一行）
-- SELECT id, updated_at, CHAR_LENGTH(data) AS bytes FROM store_snapshot;
