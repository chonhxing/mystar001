/* eslint-disable no-console */
/**
 * 共享代码同步工具：
 *   node tools/sync-shared.js          # 把共享目录复制到小程序工程里
 *   node tools/sync-shared.js --check  # 只校验是否一致（测试用，不写文件）
 *
 * 为什么需要它：
 *   微信的开发者工具**不能 require 工程目录之外的文件**（那些文件不会被上传，
 *   真机上必然加载失败）。而根目录现在是「小游戏」工程，小程序版在 miniprogram/，
 *   两边都要用 core/ data/ config/ services/ utils/，所以只能各自持有一份副本。
 *
 * 单一真源是本仓库根目录下的这五个目录；小程序工程里的副本是生成物，
 * 已在 .gitignore 里排除，改代码永远改根目录，然后跑一次 npm run sync。
 *
 * 复制时保持相对路径不变（core/chart.js 里的 '../data/x.js' 在两边都成立），
 * 所以小程序页面里的 require('../../core/...') 一个字都不用改。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'miniprogram');
const DIRS = ['core', 'data', 'config', 'services', 'utils'];
const MANIFEST = '.shared-copy.json';

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
}

function walk(dir, base, out) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach((d) => {
    if (d.name.startsWith('.')) return;
    const full = path.join(dir, d.name);
    const rel = path.relative(base, full);
    if (d.isDirectory()) walk(full, base, out);
    else out.push(rel);
  });
  return out;
}

/** 采集源文件清单（含内容哈希） */
function collect() {
  const files = [];
  DIRS.forEach((dir) => {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) return;
    walk(src, ROOT, files);
  });
  files.sort();
  const manifest = {};
  files.forEach((rel) => {
    manifest[rel.replace(/\\/g, '/')] = sha1(fs.readFileSync(path.join(ROOT, rel)));
  });
  return manifest;
}

function copyTo(manifest) {
  if (!fs.existsSync(TARGET)) fs.mkdirSync(TARGET, { recursive: true });
  // 先清掉旧的副本目录，避免源里删掉的文件在副本里残留
  DIRS.forEach((dir) => {
    const dst = path.join(TARGET, dir);
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
  });
  Object.keys(manifest).forEach((rel) => {
    const src = path.join(ROOT, rel);
    const dst = path.join(TARGET, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  });
  fs.writeFileSync(
    path.join(TARGET, MANIFEST),
    JSON.stringify({ syncedAt: Date.now(), files: manifest }, null, 2)
  );
}

function check() {
  const manifestPath = path.join(TARGET, MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, reason: '副本不存在，请先跑 npm run sync' };
  }
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: '副本清单损坏' };
  }
  const now = collect();
  const stale = [];
  Object.keys(now).forEach((k) => {
    if (!saved.files || saved.files[k] !== now[k]) stale.push(k);
  });
  Object.keys(saved.files || {}).forEach((k) => {
    if (!now[k]) stale.push(`${k}（源已删除）`);
  });
  return stale.length
    ? { ok: false, reason: `有 ${stale.length} 个文件不同步`, stale }
    : { ok: true, count: Object.keys(now).length };
}

module.exports = { collect, check, DIRS };

if (require.main === module) {
  if (process.argv.indexOf('--check') >= 0) {
    const r = check();
    if (r.ok) console.log(`共享代码副本一致（${r.count} 个文件）`);
    else {
      console.error(`共享代码不同步：${r.reason}`);
      (r.stale || []).slice(0, 20).forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    }
  } else {
    const manifest = collect();
    copyTo(manifest);
    console.log(`已同步 ${Object.keys(manifest).length} 个共享文件 → miniprogram/`);
  }
}
