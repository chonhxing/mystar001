const { CONFIG } = require('../config/index.js');
const { placeOf } = require('../data/cities.js');

/**
 * 本地存储。
 *
 * 隐私红线：姓名、生辰、出生地只存在用户手机本地，不上传服务器。
 * 上行给 AI 的只有"匿名数字"（八轴数值、星座/干支下标），见 core/payload.js。
 */

const KEYS = {
  profile: 'profile',
  // 多份"资料卡"：可以给自己、朋友、家人各存一份，占卜时一键选
  profiles: 'profiles',
  activeProfileId: 'activeProfileId',
  entitlement: 'entitlement',
  history: 'history',
  codex: 'codex',
  settings: 'settings',
  token: 'token',
  devId: 'devId',
  dataVersion: 'dataVersion',
  // 微信昵称头像。属于**账号层**（不是生辰资料），所以和 profile 分开存；
  // 只存本机，不上传（原因见 services/wechatprofile.js 的说明）
  wechatProfile: 'wechatProfile'
};

function get(key, def) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? def : v;
  } catch (e) {
    return def;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    /* ignore */
  }
}

// ---------------- 用户资料 ----------------
/**
 * 取"当前激活"的资料卡。
 * 保留这个函数是为了向后兼容 —— 老代码（首页表单、结果页）都只关心"那一份生辰"。
 * 多份管理走 getProfiles / addProfile。
 */
function getProfile() {
  const list = getProfiles();
  if (!list.length) return null;
  const id = getActiveProfileId();
  return list.find((x) => x.id === id) || list[0];
}

/** 写入资料：有激活的卡就更新它，没有就新建一张 */
function setProfile(profile) {
  const list = getProfiles();
  const id = getActiveProfileId();
  if (id && list.some((x) => x.id === id)) {
    updateProfile(id, profile);
  } else {
    const r = addProfile(profile);
    if (r.profile) setActiveProfileId(r.profile.id);
  }
  // 同时写一份到老 key，保证还没升级的读取路径也能拿到
  set(KEYS.profile, profile);
  return profile;
}

// ---------------- 资料卡（可存多份生辰） ----------------

/** 资料卡上限：够用且不让界面失控 */
const MAX_PROFILES = 10;

function makeId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeProfile(p) {
  const src = p || {};
  // 出生地三级。老数据只有 city 一个字符串，placeOf 会反查出它属于哪个省，
  // 所以升级后老用户的资料卡不会变成一片空白。
  const place = placeOf({
    province: src.province,
    city: src.city,
    district: src.district,
    cityLabel: src.cityLabel
  });
  return {
    id: src.id || makeId(),
    name: String(src.name || '').trim().slice(0, 12),
    gender: src.gender || '',
    birthDate: String(src.birthDate || '').slice(0, 10),
    birthTime: String(src.birthTime || '').slice(0, 5),
    timeKnown: !!src.timeKnown,
    province: place.province,
    city: place.city,
    district: place.district,
    cityLabel: place.cityLabel,
    createdAt: src.createdAt || Date.now(),
    lastUsedAt: src.lastUsedAt || 0
  };
}

/**
 * 取全部资料卡。
 * 兼容旧数据：以前只存一份（KEYS.profile），第一次读的时候把它升级成第一张卡。
 */
function getProfiles() {
  const list = get(KEYS.profiles, null);
  if (Array.isArray(list) && list.length) return list.map(normalizeProfile);

  const legacy = get(KEYS.profile, null);
  if (legacy && legacy.birthDate) {
    const first = normalizeProfile(legacy);
    set(KEYS.profiles, [first]);
    set(KEYS.activeProfileId, first.id);
    return [first];
  }
  return [];
}

function setProfiles(list) {
  const trimmed = (Array.isArray(list) ? list : []).slice(0, MAX_PROFILES).map(normalizeProfile);
  set(KEYS.profiles, trimmed);
  return trimmed;
}

/** 新增一张资料卡（同名同生辰的会复用，避免重复添加） */
function addProfile(p) {
  const list = getProfiles();
  const next = normalizeProfile(p);
  const dup = list.find(
    (x) => x.birthDate === next.birthDate && x.birthTime === next.birthTime && x.name === next.name
  );
  if (dup) return { list, profile: dup, duplicate: true };
  if (list.length >= MAX_PROFILES) return { list, profile: null, full: true };
  const merged = list.concat([next]);
  setProfiles(merged);
  return { list: merged, profile: next, duplicate: false };
}

function updateProfile(id, patch) {
  const list = getProfiles().map((x) => (x.id === id ? normalizeProfile(Object.assign({}, x, patch, { id })) : x));
  setProfiles(list);
  return list;
}

function removeProfile(id) {
  const list = getProfiles().filter((x) => x.id !== id);
  setProfiles(list);
  if (get(KEYS.activeProfileId, '') === id) {
    set(KEYS.activeProfileId, list.length ? list[0].id : '');
  }
  return list;
}

function getActiveProfileId() {
  const id = get(KEYS.activeProfileId, '');
  const list = getProfiles();
  if (id && list.some((x) => x.id === id)) return id;
  return list.length ? list[0].id : '';
}

function setActiveProfileId(id) {
  set(KEYS.activeProfileId, id || '');
  return id;
}

/** 标记"刚用过这张卡"，用来在列表里排到最前 */
function touchProfile(id) {
  return updateProfile(id, { lastUsedAt: Date.now() });
}

// ---------------- 历史记录 ----------------
function getHistory() {
  const list = get(KEYS.history, []);
  return Array.isArray(list) ? list : [];
}

/**
 * 追加一条历史。只存"索引级"信息 + 结果快照的必要部分，
 * 不重复存整份命盘（大对象会让 storage 迅速膨胀）。
 */
function appendHistory(row) {
  const list = getHistory();
  const item = Object.assign({ id: row.resultId, at: Date.now() }, row);
  const dedup = list.filter((r) => r.id !== item.id);
  dedup.unshift(item);
  const trimmed = dedup.slice(0, CONFIG.HISTORY_LIMIT);
  set(KEYS.history, trimmed);
  return trimmed;
}

function setHistory(list) {
  const trimmed = (Array.isArray(list) ? list : []).slice(0, CONFIG.HISTORY_LIMIT);
  set(KEYS.history, trimmed);
  return trimmed;
}

function clearHistory() {
  set(KEYS.history, []);
}

// ---------------- 图鉴 ----------------
/** { [charId]: { firstAt, count, lastScore } } */
function getCodex() {
  const c = get(KEYS.codex, {});
  return c && typeof c === 'object' ? c : {};
}

function unlock(ids, meta) {
  const codex = getCodex();
  const now = Date.now();
  let added = 0;
  (ids || []).forEach((id) => {
    if (!id) return;
    if (codex[id]) {
      codex[id].count = (codex[id].count || 1) + 1;
      codex[id].lastAt = now;
    } else {
      codex[id] = { firstAt: now, lastAt: now, count: 1, firstScore: (meta && meta[id]) || null };
      added += 1;
    }
  });
  set(KEYS.codex, codex);
  return { codex, added, total: Object.keys(codex).length };
}

/**
 * 合并服务端图鉴到本地（换设备恢复用）。
 *
 * 规则是"取并集"而不是"服务端覆盖本地"，因为**本地可能比服务端新**
 * （刚玩的一局还异步上报呢）。具体：
 *   - 同一角色保留**更早的首次遇到时间**（换设备同步时可能先报到晚的）
 *   - 次数取**更大值**（避免把本地玩的次数冲掉）
 */
function mergeCodex(remote) {
  const codex = getCodex();
  let added = 0;
  Object.keys(remote || {}).forEach((id) => {
    const r = remote[id] || {};
    if (!codex[id]) {
      codex[id] = {
        firstAt: r.firstAt || Date.now(),
        lastAt: r.firstAt || Date.now(),
        count: r.count || 1,
        firstScore: r.firstScore || null
      };
      added += 1;
    } else {
      if (r.firstAt && (!codex[id].firstAt || r.firstAt < codex[id].firstAt)) {
        codex[id].firstAt = r.firstAt;
      }
      codex[id].count = Math.max(codex[id].count || 1, r.count || 1);
      if (!codex[id].firstScore && r.firstScore) codex[id].firstScore = r.firstScore;
    }
  });
  set(KEYS.codex, codex);
  return { added, total: Object.keys(codex).length };
}

/** 合并服务端历史到本地（按 resultId 去重，按时间倒序） */
function mergeHistory(remoteList) {
  const local = getHistory();
  const seen = {};
  local.forEach((r) => {
    seen[r.id || r.resultId] = true;
  });
  const merged = local.slice();
  (remoteList || []).forEach((r) => {
    const id = r.resultId;
    if (!id || seen[id]) return;
    seen[id] = true;
    merged.push({
      id,
      resultId: id,
      at: r.at || 0,
      mode: r.mode || 'chart',
      mainId: r.mainId || '',
      // 服务端只存了角色 id，名字由本地角色表还原（避免服务端和客户端版本漂移）
      mainName: '',
      mainWork: '',
      resonance: r.resonance || 0,
      dominantBadge: r.dominantBadge || '',
      rarity: r.rarity || '',
      source: 'remote'
    });
  });
  merged.sort((a, b) => (b.at || 0) - (a.at || 0));
  const trimmed = merged.slice(0, CONFIG.HISTORY_LIMIT);
  set(KEYS.history, trimmed);
  return { total: trimmed.length };
}

function codexCount() {
  return Object.keys(getCodex()).length;
}

function clearCodex() {
  set(KEYS.codex, {});
}

// ---------------- 设置 ----------------
function getSettings() {
  return Object.assign(
    {
      // 是否允许把命盘送去后端生成 AI 解读。关掉就纯本地。
      useAi: true,
      // 是否允许保存历史
      saveHistory: true
    },
    get(KEYS.settings, {})
  );
}

function setSettings(next) {
  const merged = Object.assign(getSettings(), next || {});
  set(KEYS.settings, merged);
  return merged;
}

// ---------------- 使用权益 ----------------
/**
 * 权益状态：免费次数 / 广告解锁券 / 畅玩卡到期时间。
 * ⚠️ 只存本机。付费权益如果要跨设备生效，必须由服务端记录（见 server/pay.js 的说明）。
 */
const ENTITLEMENT_DEFAULT = {
  freeUsed: 0,
  adTickets: 0,
  passExpireAt: 0,
  totalUsed: 0,
  grantedOrders: {}
};

function getEntitlement() {
  const v = get(KEYS.entitlement, null);
  if (!v || typeof v !== 'object') return Object.assign({}, ENTITLEMENT_DEFAULT);
  return Object.assign({}, ENTITLEMENT_DEFAULT, v);
}

function setEntitlement(next) {
  set(KEYS.entitlement, next || ENTITLEMENT_DEFAULT);
  return next;
}

// ---------------- 会话 ----------------
function getToken() {
  return get(KEYS.token, '');
}

function setToken(token) {
  set(KEYS.token, token || '');
}

/** 开发模式下用来区分用户（服务端没配微信 appid 时） */
function getDevId() {
  let id = get(KEYS.devId, '');
  if (!id) {
    id = `wx${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    set(KEYS.devId, id);
  }
  return id;
}

// ---------------- 微信昵称头像 ----------------

/** @returns {object|null} { nickName, avatarUrl, at, source } */
function getWechatProfile() {
  const v = get(KEYS.wechatProfile, null);
  if (!v || typeof v !== 'object') return null;
  if (!v.avatarUrl && !v.nickName) return null;
  return v;
}

/** 传 null 表示清掉 */
function setWechatProfile(p) {
  if (!p) {
    remove(KEYS.wechatProfile);
    return null;
  }
  const next = {
    nickName: String(p.nickName || '').slice(0, 24),
    avatarUrl: String(p.avatarUrl || ''),
    at: p.at || Date.now(),
    source: String(p.source || '')
  };
  set(KEYS.wechatProfile, next);
  return next;
}

/** 退出登录/清空账号时要一起清掉：它属于账号，不属于这台设备 */
function clearWechatProfile() {
  remove(KEYS.wechatProfile);
}

// ---------------- 迁移与清理 ----------------
function getDataVersion() {
  return get(KEYS.dataVersion, '');
}

/** 版本升级时在这里做字段迁移；目前只记录版本号 */
function migrate(version) {
  const cur = getDataVersion();
  if (cur === version) return false;
  // 未来：if (cur < '0.2.0') { ... }
  set(KEYS.dataVersion, version);
  return true;
}

function clearAll() {
  Object.keys(KEYS).forEach((k) => {
    if (k !== KEYS.devId && k !== KEYS.dataVersion) remove(KEYS[k]);
  });
}

module.exports = {
  KEYS,
  MAX_PROFILES,
  getProfiles,
  setProfiles,
  addProfile,
  updateProfile,
  removeProfile,
  getActiveProfileId,
  setActiveProfileId,
  touchProfile,
  ENTITLEMENT_DEFAULT,
  getEntitlement,
  setEntitlement,
  getProfile,
  setProfile,
  getHistory,
  appendHistory,
  setHistory,
  clearHistory,
  getCodex,
  unlock,
  mergeCodex,
  mergeHistory,
  codexCount,
  clearCodex,
  getSettings,
  setSettings,
  getToken,
  setToken,
  getDevId,
  getWechatProfile,
  setWechatProfile,
  clearWechatProfile,
  getDataVersion,
  migrate,
  clearAll
};
