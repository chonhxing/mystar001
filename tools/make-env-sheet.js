/* eslint-disable no-console */
/**
 * 生成「云托管环境变量粘贴表」到桌面（或 --out 指定的路径）。
 *
 * 为什么要做成脚本而不是手写一个 txt：
 *   1. 手写的那份变成过 UTF-16（没有 BOM），Windows 记事本打开全是乱码；
 *   2. 里面的值要跟 server/.env 同步（模型、时间参数一改就得跟着改），
 *      手工维护迟早对不上；
 *   3. 密钥不该进仓库 —— 所以仓库里只有这个"生成器"，真有值的文件只写到桌面。
 *
 *   node tools/make-env-sheet.js                # 写到桌面
 *   node tools/make-env-sheet.js --out x.txt    # 写到指定文件
 *
 * 值的来源（按这个顺序，后面的覆盖前面的）：
 *   1. container.config.json 的 envParams —— 非密钥的基建值（数据库内网地址、AppID 等），
 *      它本来就进仓库，不算秘密
 *   2. server/.env —— 本地开发那份（AI key、时间参数），已在 .gitignore 里
 *   3. server/.env.cloud —— 只在云上用的密钥（数据库密码、WX_SECRET），同样已忽略
 *
 * ⚠️ 生成的文件含明文密钥，填完控制台就删掉。终端里**不会**打印任何密钥值。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, 'server', '.env');
const CLOUD_ENV_FILE = path.join(ROOT, 'server', '.env.cloud');
const CONTAINER_JSON = path.join(ROOT, 'container.config.json');

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function readContainerParams() {
  try {
    const j = JSON.parse(fs.readFileSync(CONTAINER_JSON, 'utf8'));
    return j.envParams || {};
  } catch (e) {
    return {};
  }
}

// 三层合并：仓库里的配置 → 本地 .env → 云上专用 .env.cloud
// ⚠️ 空值不算"覆盖"：server/.env 里的 `WX_APPID=` 就是空的（本地用不到），
//    如果让它盖掉 container.config.json 里那个真值，生成出来的表就少一个必填项
function merge(target, extra) {
  Object.keys(extra).forEach((k) => {
    if (extra[k] !== undefined && extra[k] !== '') target[k] = extra[k];
  });
  return target;
}
const src = merge(merge({}, readContainerParams()), readEnv(ENV_FILE));
merge(src, readEnv(CLOUD_ENV_FILE));

const pick = (key, fallback) => {
  const v = src[key];
  if (v !== undefined && v !== '') return v;
  return fallback === undefined ? '' : fallback;
};

// AUTH_SECRET：会话 token 的签名密钥。
// ⚠️ 没配的话服务端会临时随机一个（不会崩），代价是每次重启所有人都要重新登录，
//    所以这里**自动生成一个够长的**并写进表里 —— 只生成一次，之后复用（存在 .env.cloud）。
let authSecret = pick('AUTH_SECRET');
let authSecretFresh = false;
if (!authSecret || authSecret.length < 32) {
  authSecret = crypto.randomBytes(32).toString('hex');
  authSecretFresh = true;
  const file = CLOUD_ENV_FILE;
  const line = `AUTH_SECRET=${authSecret}`;
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = /^AUTH_SECRET=.*$/m.test(prev)
    ? prev.replace(/^AUTH_SECRET=.*$/m, line)
    : `${prev.replace(/\s*$/, '')}\n${line}\n`;
  fs.writeFileSync(file, next, 'utf8');
}

const PAIRS = [
  ['PORT', '80'],
  // 云托管上必须用**内网**地址（外网地址只有我们本机能连）
  ['DB_HOST', pick('DB_HOST', '10.19.112.185')],
  ['DB_PORT', pick('DB_PORT', '3306')],
  ['DB_USER', pick('DB_USER', 'root')],
  ['DB_PASSWORD', pick('DB_PASSWORD')],
  ['DB_NAME', pick('DB_NAME', 'wo_tui_zhan_xing')],
  ['WX_APPID', pick('WX_APPID')],
  ['WX_SECRET', pick('WX_SECRET')],
  ['AUTH_SECRET', authSecret],
  ['DEEPSEEK_API_KEY', pick('DEEPSEEK_API_KEY')],
  ['DEEPSEEK_BASE_URL', pick('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')],
  ['DEEPSEEK_MODEL', pick('DEEPSEEK_MODEL', 'deepseek-flash')],
  ['DEEPSEEK_TIMEOUT_MS', pick('DEEPSEEK_TIMEOUT_MS', '45000')],
  ['DEEPSEEK_BUDGET_MS', pick('DEEPSEEK_BUDGET_MS', '50000')],
  ['DEEPSEEK_SYNC_BUDGET_MS', pick('DEEPSEEK_SYNC_BUDGET_MS', '35000')],
  ['DEEPSEEK_MAX_TOKENS', pick('DEEPSEEK_MAX_TOKENS', '4000')],
  ['SHOW_AI_LABEL', pick('SHOW_AI_LABEL', '1')],
  ['ADMIN_TOKEN', pick('ADMIN_TOKEN')]
];

const missing = PAIRS.filter(([k, v]) => !v).map(([k]) => k);
const wxSecretMissing = !pick('WX_SECRET');

const block = PAIRS.map(([k, v]) => `${k}=${v}`).join('\n');

const sheet = `# ============================================================
# 微信云托管 → 服务 → 服务设置 → 环境变量
# 把下面「PORT=80」到「ADMIN_TOKEN=...」这一段整段复制粘进去（控制台支持批量添加）
# 这一段只有 KEY=VALUE、没有注释，粘进去不会出错
# ============================================================

${block}

# ============================================================
# 上面那一段的说明（不用粘）
# ============================================================
#
# ⚠️ 这个文件里有明文密钥（DeepSeek key${pick('DB_PASSWORD') ? ' + 数据库密码' : ''}）。
#    填完控制台就删掉它，别放进仓库、别截图发人。
# ⚠️ 数据库密码和 DeepSeek key 都在聊天里出现过 —— 上线前各轮换一次，
#    轮换后重新跑一次生成脚本（node tools/make-env-sheet.js）就会带上新值。
#
${wxSecretMissing ? `# 【⚠️ WX_SECRET 还空着，必须填】
#   WX_APPID 是 wx 开头的短串（你之前给过，已填好）；
#   WX_SECRET 是另一回事，要的是 **AppSecret**：
#     MP 后台 → 开发管理 → 开发设置 → 开发者ID → AppSecret → 重置 → 复制
#   它是 32 位字母数字（形如 3f8a9c...），不是 wx 开头。
#
#   ⚠️ 别发到聊天里，直接粘进控制台。密钥一旦在聊天/截图里出现过，就按已泄露处理，
#      去后台重置一次。我不需要知道它的值。
#
#   不填会怎样：服务端**不会报错**，它安静地改成"按设备认人"——
#   一切看起来都正常，直到用户换手机发现畅玩卡和记录都没了。
#   部署后进「我的 → 设置 → 解读服务状态」，它会直接告诉你当前是哪种模式。
#
` : '# WX_SECRET 已填（来自 server/.env）\n#\n'}# 【模型与时间参数】
#   DEEPSEEK_MODEL=${pick('DEEPSEEK_MODEL', 'deepseek-flash')}：实测一次解读 8.7~13.6 秒；
#     换 deepseek-v4-pro 要 50 秒一次，思考还容易吃满 max_tokens 把 JSON 截断。
#   三个时间参数必须成组看（server/config.js 的注释里有完整说明）：
#     单次尝试 ${pick('DEEPSEEK_TIMEOUT_MS', '45000')}ms < 总预算 ${pick('DEEPSEEK_BUDGET_MS', '50000')}ms
#       < 客户端愿意等 65000ms（config/index.js 的 DIVINATE_WAIT_MS）
#     同步接口 ${pick('DEEPSEEK_SYNC_BUDGET_MS', '35000')}ms + 余量 ≤ 客户端单次请求超时 50000ms
#   不填也能跑（走代码默认值），填了就是显式对齐；改一个要同时看另一个。
#
# 【控制台另外三处必须设对（照模板默认会出问题）】
#   1. 监听端口 = 80（和 PORT 一致）
#   2. 健康检查路径 = /api/health
#   3. **最大副本数 = 1** ← 最重要：数据是"内存整份快照 + 回写 MySQL 一行"，
#      多副本会互相覆盖，用户的畅玩卡、订单会丢
#
# 【部署完之后】
#   真机预览 → 我的 → 设置 → 「解读服务状态」：
#   它会说明连的是云调用还是公网、AI 有没有配上、登录是"按设备认人"还是真微信登录。
#
#   想在电脑上单独验数据库通不通（1 分钟）：
#     DB_CHECK_PASSWORD=你的库密码 npm run db:e2e
#   ⚠️ 这个脚本会先清空 store_snapshot，有真实用户数据时别跑。
#
# 遇到问题就把「解读服务状态」那一屏截图发我，上面有足够信息定位。
`;

const outArg = process.argv.indexOf('--out');
const out = outArg > 0 && process.argv[outArg + 1]
  ? process.argv[outArg + 1]
  : path.join(os.homedir(), 'Desktop', '云托管环境变量-粘贴用.txt');

// ⚠️ 必须显式写 UTF-8 + CRLF：上一次就是编码不对（UTF-16 无 BOM），
//    记事本打开全是乱码。写完下面会回读校验字节。
const text = sheet.split('\n').join('\r\n');
fs.writeFileSync(out, Buffer.from(text, 'utf8'));

const back = fs.readFileSync(out);
const first = back.slice(0, 8).toString('hex');
const decoded = back.toString('utf8');
console.log(`已写出：${out}`);
console.log(`  字节 ${back.length} ｜ 开头 ${first} ｜ 无 BOM：${!(back[0] === 0xef && back[1] === 0xbb && back[2] === 0xbf)}`);
console.log(`  回读校验：第一行内容正确 = ${decoded.split('\r\n').find((l) => l.indexOf('PORT=') === 0) === 'PORT=80'}`);
console.log(`  无效字符（乱码标志）个数：${(decoded.match(/\uFFFD/g) || []).length}`);
console.log(`  已填的键：${PAIRS.map(([k]) => k).join('、')}`);
if (missing.length) console.log(`  ⚠️ 还空着的键：${missing.join('、')}`);
if (wxSecretMissing) console.log('  ⚠️ WX_SECRET 还是空的 —— 需要你从 MP 后台复制 AppSecret 填进去');
console.log('  （密钥值不会打印在这里）');
