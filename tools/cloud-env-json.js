/* eslint-disable no-console */
/**
 * 把云托管「服务设置 → 环境变量」要粘贴的 JSON 放进剪贴板。
 *
 * 为什么不直接在终端打印再手抄：这些值里有真实密钥。
 * 剪贴板是给浏览器 Ctrl+V 用的，所以只输出"多少条、指纹是什么"，
 * 不输出任何值 —— 免得密钥又进一次日志/对话记录。
 *
 *   node tools/cloud-env-json.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && m[2] !== '') out[m[1]] = m[2];
  });
  return out;
}

const container = JSON.parse(fs.readFileSync(path.join(ROOT, 'container.config.json'), 'utf8')).envParams || {};
const env = readEnv(path.join(ROOT, 'server', '.env'));
const cloud = readEnv(path.join(ROOT, 'server', '.env.cloud'));

const pick = (...vals) => {
  for (let i = 0; i < vals.length; i += 1) {
    if (vals[i] !== undefined && vals[i] !== '') return String(vals[i]);
  }
  return '';
};

// 模板已经塞进去的那几个（COS_* / MYSQL_*）保留：平台"数据库"那套集成认识它们，
// 删掉可能被重新注入，留着也不影响我们的服务（我们的服务读 DB_*）
const existing = {
  COS_BUCKET: '7072-prod-d2g78apcte70a43f7-1489863270',
  COS_REGION: 'ap-shanghai',
  MYSQL_ADDRESS: '10.19.112.185:3306',
  MYSQL_PASSWORD: pick(cloud.DB_PASSWORD),
  MYSQL_USERNAME: 'root'
};

const missing = [];
const need = (k, v) => {
  if (!v) missing.push(k);
  return v;
};

const vars = Object.assign({}, existing, {
  // 我们的服务认这些
  PORT: '80',
  DB_HOST: '10.19.112.185',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: need('DB_PASSWORD', pick(cloud.DB_PASSWORD, env.DB_PASSWORD)),
  DB_NAME: need('DB_NAME', pick(container.DB_NAME, env.DB_NAME, 'wo_tui_zhan_xing')),
  WX_APPID: need('WX_APPID', pick(container.WX_APPID, env.WX_APPID)),
  // ⚠️ WX_SECRET 是 AppSecret，只有用户知道（不该经过我这儿），所以这里留空由他自己补
  WX_SECRET: pick(cloud.WX_SECRET, env.WX_SECRET),
  AUTH_SECRET: need('AUTH_SECRET', pick(cloud.AUTH_SECRET)),
  DEEPSEEK_API_KEY: need('DEEPSEEK_API_KEY', pick(env.DEEPSEEK_API_KEY)),
  DEEPSEEK_BASE_URL: pick(env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com'),
  DEEPSEEK_MODEL: pick(env.DEEPSEEK_MODEL, 'deepseek-flash'),
  DEEPSEEK_TIMEOUT_MS: pick(env.DEEPSEEK_TIMEOUT_MS, '45000'),
  DEEPSEEK_BUDGET_MS: pick(env.DEEPSEEK_BUDGET_MS, '50000'),
  DEEPSEEK_SYNC_BUDGET_MS: pick(env.DEEPSEEK_SYNC_BUDGET_MS, '35000'),
  DEEPSEEK_MAX_TOKENS: pick(env.DEEPSEEK_MAX_TOKENS, '4000'),
  SHOW_AI_LABEL: pick(env.SHOW_AI_LABEL, container.SHOW_AI_LABEL, '1'),
  ADMIN_TOKEN: need('ADMIN_TOKEN', pick(env.ADMIN_TOKEN))
});

const json = JSON.stringify(vars, null, 2);

// Windows 的 clip 从 stdin 读，写进系统剪贴板（UTF-16 由 clip 自己处理）
const r = spawnSync('clip', { input: json, encoding: 'utf8', shell: true });
if (r.status !== 0) {
  console.error('写入剪贴板失败（clip 命令不可用）:', r.stderr || r.status);
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 12);
console.log(`已放入剪贴板：${Object.keys(vars).length} 个变量 ｜ ${json.length} 字节 ｜ 指纹 ${hash}`);
console.log(`键名：${Object.keys(vars).join('、')}`);
if (missing.length) console.log(`⚠️ 值为空（要么本来就没有，要么需要你自己补）：${missing.join('、')}`);
if (!vars.WX_SECRET) {
  console.log('⚠️ WX_SECRET 空着：那是 AppSecret，你直接在那个 JSON 里补一行 "WX_SECRET": "你的AppSecret" 再保存');
}
