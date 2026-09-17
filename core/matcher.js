const { CHARACTERS, CHARACTER_MAP, RARITY } = require('../data/characters.js');
const { FATE_MAP } = require('../data/fates.js');
const { DIM_KEYS } = require('../data/archetypes.js');
const { CONFIG } = require('../config/index.js');
const vec = require('./vector.js');

/**
 * 角色匹配 —— 这个游戏的"抽卡"。
 *
 * 三步：
 *  1. 全量算共振度（形状匹配，见 core/vector.js 的说明）；
 *  2. 取前 SELECT_POOL 名进候选池；
 *  3. 在池子里扣掉稀有度惩罚分再挑第一名。
 *
 * 为什么要有第 2、3 步：纯按共振度取最高会比较"平"，
 * 传说角色出不来（实测出场率 0.02%）。先圈小池子再扣一小笔分，
 * 能让传说角色有稳定出场率，又不会出现"随便一个人就抽到最强角色"的廉价感。
 * 两个旋钮都在 config.MATCH 里。
 *
 * 「反向角色」（你没带入的那条命途）用的是镜像匹配：
 * 把命盘形状取反，看谁离"反过来的你"最近。这比"分数最低的那个"有意义得多 ——
 * 后者常常只是另一个跟你很像但数值偏低的角色。
 */

/** 单个角色与命盘的共振度（角色详情页要用） */
function resonanceOf(chart, character) {
  return vec.resonance(chart.dims, character.dims);
}

function scoreAll(chart, flip) {
  return CHARACTERS.map((c) => ({
    character: c,
    score: vec.resonance(chart.dims, c.dims, flip)
  })).sort((a, b) => b.score - a.score);
}

function decorate(chart, character, score, mirrorScore) {
  const sharedFates = chart.fates
    .filter((f) => character.fates.indexOf(f.id) >= 0)
    .map((f) => ({ id: f.id, name: f.name, summary: f.summary }));

  const missingFates = character.fates
    .filter((id) => !chart.fates.some((f) => f.id === id))
    .map((id) => FATE_MAP[id])
    .filter(Boolean)
    .map((f) => ({ id: f.id, name: f.name }));

  return {
    id: character.id,
    char: character,
    rarity: RARITY[character.rarity] || RARITY.common,
    score: Math.round(score * 10) / 10,
    resonance: Math.round(score),
    mirrorScore: mirrorScore === undefined ? null : Math.round(mirrorScore),
    sharedFates,
    missingFates,
    gap: vec.biggestGap(chart.dims, character.dims),
    axis: vec.dominantAxis(character.dims),
    opposing: vec.opposingAxes(chart.dims, character.dims, 2)
  };
}

function match(chart) {
  const cfg = CONFIG.MATCH;
  const scored = scoreAll(chart, false);

  // ---- 候选池 + 稀有度惩罚 ----
  const pool = scored.slice(0, cfg.SELECT_POOL).map((item) => ({
    character: item.character,
    score: item.score,
    adjusted: item.score - (cfg.RARITY_PENALTY[item.character.rarity] || 0)
  }));
  pool.sort((a, b) => (b.adjusted === a.adjusted ? b.score - a.score : b.adjusted - a.adjusted));

  const picked = pool[0];
  const main = decorate(chart, picked.character, picked.score);
  main.adjusted = Math.round(picked.adjusted * 10) / 10;
  main.poolRank = scored.findIndex((s) => s.character.id === picked.character.id) + 1;
  main.rankedAll = scored.length;

  const side = pool.slice(1, 3).map((item) => decorate(chart, item.character, item.score));

  // ---- 反向角色：镜像匹配 ----
  const mirrored = scoreAll(chart, true);
  const antiTop = mirrored.slice(0, cfg.ANTI_POOL);
  // 在镜像池里优先挑知名度高的（更像"另一部作品的主角"），同档再比镜像分
  const antiPick = antiTop.slice().sort((a, b) => {
    const ra = (RARITY[a.character.rarity] || {}).stars || 1;
    const rb = (RARITY[b.character.rarity] || {}).stars || 1;
    return rb - ra || b.score - a.score;
  })[0];

  const anti = decorate(
    chart,
    antiPick.character,
    scored.find((s) => s.character.id === antiPick.character.id).score,
    antiPick.score
  );
  anti.opposing = anti.opposing.length
    ? anti.opposing
    : vec.opposingAxes(chart.dims, antiPick.character.dims, 2);

  return { main, side, anti, ranked: scored };
}

/**
 * 用服务端返回的匹配结果，重建本地可渲染的对象结构。
 *
 * 为什么不让服务端直接下发整份 match：一是体积（角色对象很大），
 * 二是版本漂移会崩（服务端加了新角色，老客户端没有）。
 * 所以这里只信任"id + 数字"，其余字段一律用本地角色表重建；
 * 一旦发现 id 在本地查不到，就返回 null，调用方退回本地匹配结果。
 */
function hydrate(chart, serverMatch) {
  if (!chart || !serverMatch || !serverMatch.main || !CHARACTER_MAP[serverMatch.main.id]) return null;

  const build = (row, mirrorKey) => {
    const character = CHARACTER_MAP[row.id];
    if (!character) return null;
    const item = decorate(chart, character, Number(row.resonance) || 0, row.mirrorScore);
    if (Array.isArray(row.sharedFateIds) && row.sharedFateIds.length) {
      item.sharedFates = row.sharedFateIds
        .map((id) => FATE_MAP[id])
        .filter(Boolean)
        .map((f) => ({ id: f.id, name: f.name, summary: f.summary }));
    }
    if (row.gap && DIM_KEYS.indexOf(row.gap.key) >= 0) item.gap = row.gap;
    if (Array.isArray(row.opposing) && row.opposing.length) item.opposing = row.opposing;
    return item;
  };

  const main = build(serverMatch.main);
  if (!main) return null;

  return {
    main,
    side: (serverMatch.side || []).map(build).filter(Boolean),
    anti: build(serverMatch.anti) || null,
    hydrated: true
  };
}

module.exports = { match, scoreAll, decorate, hydrate, resonanceOf };
