# 部署到微信云托管（前后端都能用了）

> ## ✅ 已经替你做完的部分（2026-09-17）
>
| 事项 | 状态 |
| --- | --- |
| 数据库 | **已建好并通过外网实测**：库 `wo_tui_zhan_xing`、表 `store_snapshot`（MySQL 5.7.18 CynosDB） |
| 代码推送 | 已合并云托管官方模板仓库的初始提交，模板示例应用已删除，我们的代码优先 |
| 客户端配置 | `config/index.js` 的云调用已打开，服务名预设 `wotui-server`（**控制台起的服务名要和它一致，否则告诉我改成你的**） |
| 环境变量 | 桌面 `云托管环境变量-粘贴用.txt`，**整段粘进控制台即可**（含 DeepSeek key） |
| 表结构 | `cloud/init.sql` 已经跑过一遍，不需要再手动执行 |
>
> **剩下要你在控制台做的，只有第 2、3 步**（建服务 / 填环境变量）。

> 目标：把 `server/` 跑在微信云托管上，客户端通过 `wx.cloud.callContainer` 云调用访问 ——
> **不需要备案域名、不用配 request 合法域名，真机预览也能连上**。

## 0. 如果 `git push` 卡住 / 报 Connection was reset

在国内网络下 **`github.com` 这个域名经常是连不上的**（git 的 HTTPS 端点和网页都在它上面）。
本机实测：

| 域名 | 结果 |
| --- | --- |
| `github.com:443` | ❌ 连不上（连接超时） |
| `api.github.com` | ✅ 通 |
| `codeload.github.com` | ✅ 通 |
| `ssh.github.com:443` | ✅ 通 |
| `gitee.com` | ✅ 通 |
| `registry.npmjs.org` | ✅ 通（npm 能用） |

也就是说：**不是权限问题，是网络到不了 github.com**。三条路任选一条：

### 路线 A（推荐）：代码源换成 Gitee

微信云托管支持 GitHub / GitLab / **Gitee** 三种代码源，Gitee 在国内直连。
你本来就有 Gitee 账号（git 里的提交身份就是 Gitee 的），所以这条路最省事：

```bash
# 在 gitee.com 建一个私有仓库（不要勾 README，会和本地冲突）
cd "D:/杂项软件/微信小程序-我推的占星"
git remote add gitee https://gitee.com/你的用户名/仓库名.git
git push -u gitee master
```

然后在云托管「新建服务」时**代码源选 Gitee**，其余配置照本文档往下走。

### 路线 B：不走代码托管，直接上传代码包

云托管控制台支持上传本地代码包；也有官方 CLI（`npm i -g @wxcloud/cli`，npm 是通的）：

```bash
npm i -g @wxcloud/cli
wxcloud login       # 扫码登录
wxcloud deploy      # 在项目根目录执行，会把本目录打包上传
```

### 路线 C：把 github.com 弄通

挂代理 / 开 VPN 之后，原来那套就行：

```bash
git push -u origin master
```

> ⚠️ 注意本仓库的默认分支已经是 **`master`**（和云托管流水线里配的分支保持一致），
> 不是 `main`。

### SSH 走 443（要动 GitHub 网页，所以只在你能打开 github.com 时才有意义）

```bash
ssh-keygen -t ed25519 -C "chonhxing" -f ~/.ssh/id_ed25519_github -N ""
# 把 ~/.ssh/id_ed25519_github.pub 的内容加到 GitHub → Settings → SSH keys
cat >> ~/.ssh/config <<'EOF'
Host github-ssh
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519_github
EOF
git remote set-url origin git@github-ssh:chonhxing/mystar001.git
git push -u origin master
```

---

## 0.5 ⚠️ 数据库密码已经泄露了，先处理它

你在对话里贴过明文数据库密码。**请立刻去云托管控制台改掉它**（数据库 → 账号管理 → 改密码）。

改完之后按新密码走，并且记住三条硬规矩：

1. 密码只填在**云托管控制台 → 服务设置 → 环境变量**里，**永远不要写进仓库**
   （`.env` / `server/.env` 已在 `.gitignore` 里，`Dockerfile` 也配了 `.dockerignore`）
2. 不要放进客户端：小游戏包体可以被解包看，任何写进前端的密钥都等于公开
3. 本项目对"数据库账号"的用法只有一种：**服务端连内网 MySQL**。客户端永远不直连数据库

---

## 1. 把代码推上去（分支用 master）

本地已经是一个 git 仓库并提交过了（`git log` 能看到"首次提交"）。你只需要建远端：

```bash
# 在 GitHub 上新建一个 Private 仓库（不要勾 README/.gitignore，会冲突）
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```

推之前先确认一遍**没有密钥进仓库**：

```bash
git ls-files | grep -E "\.env$"     # 应该什么都没有
```

---

## 2. 在云托管建服务

控制台 → 微信云托管 → 选你的环境（`prod-d2g78apcte70a43f7`）→ **新建服务**。

| 配置项 | 填什么 | 为什么 |
| --- | --- | --- |
| 服务名称 | 自己起一个，例如 `wotui-server` | **必须和客户端配置里的 `SERVICE` 完全一致**（区分大小写，填错会 404/503） |
| 代码源 | GitHub → 授权并选中刚推的私有仓库 | 之后每次 push 都能自动构建 |
| 分支 | `master` | 和推送的分支保持一致 |
| Dockerfile 路径 | `Dockerfile`（仓库根目录） | 已在仓库里准备好 |
| **监听端口** | **80** | Dockerfile 里 `ENV PORT=80`。端口不一致会让容器起来了但请求到不了（表现是一直超时） |
| 最小副本 | 1 | 见下面「为什么必须是 1 个副本」 |
| 健康检查路径 | **`/api/health`** | 默认探 `/`，我们的路由表里没有 `/`（会 404），平台会判定启动失败 |

### 为什么必须是 1 个副本

后端把内存里的数据**整份快照**存进 MySQL 的一行（`server/store-mysql.js`），
同步接口一行都不用改。代价就是**多副本会互相覆盖**。
云托管默认 1 个副本，我们的量也远没到需要扩容的程度；真要扩，得把
`store-mysql.js` 换成"每个方法一条 SQL"的实现（接口不用变）。

---

## 3. 配环境变量（这一步漏了就起不来）

控制台 → 服务 → **服务设置 → 环境变量**：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `PORT` | `80` | 和上面"监听端口"一致 |
| `DEEPSEEK_API_KEY` | 你的 key | **只在服务端**，绝不下发客户端 |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | |
| `WX_APPID` | `wxf34d29bb49d6cdc3` | |
| `WX_SECRET` | 小游戏的 AppSecret | 换 openid 要用；**不填会进开发模式** |
| `DB_HOST` | 云托管 MySQL 的**内网地址** | 控制台 → 数据库 → 连接信息 |
| `DB_PORT` | `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | **改过之后的新密码** | |
| `DB_NAME` | `wo_tui_zhan_xing` | 建库时用的名字 |
| `ADMIN_TOKEN` | 一串只有你知道的随机值 | 保护 `/api/stats` 这类管理接口 |
| `SHOW_AI_LABEL` | `1` | AI 生成标识，合规要求，别关 |

其余可选项见 `server/.env.example`（每个变量都有注释）。

---

## 4. 建数据库表

云托管控制台 → 数据库 → MySQL → 打开 phpMyAdmin（或"快捷语句"），
把 `cloud/init.sql` 的内容粘进去执行。就一张表：

```sql
CREATE TABLE IF NOT EXISTS store_snapshot (
  id INT NOT NULL PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

服务起来之后可以去库里看一眼有没有数据：

```sql
SELECT id, updated_at, CHAR_LENGTH(data) / 1024 AS kb FROM store_snapshot;
```

> 没配 `DB_HOST` 也能跑，但**数据存在容器里，重启就没了**（云托管没有持久化磁盘）。
> 付费订单和用户权益丢了是要赔钱的，所以生产环境请务必配上。

---

## 5. 客户端接上云托管

`config/index.js`：

```js
CLOUD: {
  ENABLED: true,                          // 部署好之后改成 true
  ENV: 'prod-d2g78apcte70a43f7',          // 已按你的环境填好
  SERVICE: 'wotui-server'                 // ← 填你第 2 步起的服务名
},
```

改完跑 `npm run sync`（小程序版要用同一份配置），然后重新编译。

**怎么确认接上了**：真机预览 → 我的 → 设置 → **解读服务状态**。
它会明确告诉你连没连上、失败原因是什么。

### 云调用 vs 公网域名：为什么现在是混着走的

`wx.cloud.callContainer` 有两条平台限制，其中一条正好卡住我们的 AI：

| 请求 | 走哪条路 | 原因 |
| --- | --- | --- |
| 健康检查 / 账号状态 / 上报记录 / 查订单 / 运势 | **云调用**（微信内网） | 都是几秒内返回，且**免域名白名单**，真机预览直接可用 |
| **AI 解读**（16~37 秒） | **公网域名**（`API_BASE`） | 云调用**单次超时不超过 15s**，走它必然超时 |

所以：

- **只配云调用**：账号、记录、充值查询在真机上全部可用 ✓，AI 文案会降级成本机模板
- **想连 AI 也上**：两条路选一条
  1. **推荐**：把 AI 改成"提交任务 + 轮询结果"（每次请求都在 15s 内），就能全走云调用。
     代价是要动 `services/divination.js` 与 `server/index.js` 各一处，属于待办
  2. 给云托管服务**绑一个已备案的 https 域名**，填进 `API_BASE`，
     并在 MP 后台「开发设置 → 服务器域名 → request 合法域名」里加上

---

## 6. 上线前最后一遍

```bash
npm test          # 7 套 800+ 断言
npm run check     # 结构与提审红线（含题库合规扫描）
```

| 检查 | 怎么做 |
| --- | --- |
| 密钥没进仓库 | `git ls-files \| grep -E "\.env$"` 应该为空 |
| 环境变量齐了 | 控制台里逐条对第 3 步的表 |
| 健康检查通过 | 浏览器打开 `https://<默认域名>/api/health`，返回 `{"ok":true,...}` |
| 数据真落库了 | 上面那条 SQL 能看到 `store_snapshot` 有一行 |
| 真机能连上 | 预览 → 我的 → 设置 → 解读服务状态 |
| 隐私指引已声明 | 昵称头像 + 出生信息，见 `docs/COMPLIANCE.md` |
| 云托管**公网域名**要不要关 | 见下 |
| **最大副本数 = 1** | ⚠️ 见第 7 节：模板默认 5，会把快照存储写坏 |

### 关于"公网域名"的一个安全提醒

云托管默认会给服务一个公网域名。**公网调用不携带微信身份信息，任何人都能打你的接口。**
我们现在的鉴权是自己发的 token（`Authorization: Bearer`），所以不是裸奔；
但如果你不打算给 AI 走公网，**可以在控制台把公网访问关掉**，只留云调用。
等以后要用公网域名连 AI 时再打开，并配好域名白名单。

---

## 7. ⚠️ 副本数必须锁成 1（模板默认是 5，会出事）

云托管官方模板的 `container.config.json` 里默认 `minNum: 0, maxNum: 5`。
**我们的服务不能跑多副本**：数据是「内存里的整份快照 + 定期回写 MySQL 一行」，
两个副本各自持有一份内存快照，会互相覆盖 —— 用户的畅玩卡、订单记录会丢。

控制台 → 服务设置 → 扩缩容：

| 配置 | 建议值 | 说明 |
| --- | --- | --- |
| 最小副本数 | `0` | 无请求半小时缩容到 0，省钱；代价是下次请求要冷启动（几百毫秒） |
| **最大副本数** | **`1`** | **不能改大**，除非把 `server/store-mysql.js` 换成「每个方法一条 SQL」的实现 |
| CPU / 内存 | `0.25 核 / 0.5GB` | 够用：这个服务几乎不占资源，AI 的时间都花在等 DeepSeek |

想要「随时都是热的」就把最小副本设成 1，代价是一直占着资源计费。

---

## 8. 部署完之后交给我做的两件事

1. **告诉我控制台里的服务名**：如果不是 `wotui-server`，我改 `config/index.js` 的
   `CLOUD.SERVICE`（现在预设的就是 `wotui-server`）
2. **AI 解读改异步**：`wx.cloud.callContainer` 单次超时上限 15s，而 AI 要 16~37s。
   改成「提交任务 + 轮询结果」之后 AI 也能走云调用，就彻底不需要公网域名了
