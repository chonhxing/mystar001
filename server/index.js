/**
 * 我推的星运 · 后端
 *
 * 唯一的存在理由：把 DeepSeek 的 key 挡在小程序外面，顺便做缓存、限流和合规兜底。
 *
 * 启动：
 *   node --env-file=server/.env server/index.js
 *
 * 几个刻意的设计：
 *  1. 客户端只往上送「匿名数字」（八轴数值 + 星座/干支下标），不上送姓名和生辰，
 *     服务端再用自己的数据表还原成中文文案 —— 既保护隐私，也堵死了提示词注入。
 *  2. 命盘、角色匹配全部由服务端用 core/ 重算一遍，不信任客户端传来的"结果"。
 *  3. AI 只是可选环节：没配 key、超时、返回跑偏，一律静默退回本地模板文案，
 *     接口永远返回 200 和一份完整能渲染的文案。
 */

const http = require('http');
const crypto = require('crypto');

const { CONFIG, aiReady } = require('./config.js');
const { createStore } = require('./store.js');
const deepseek = require('./deepseek.js');
const prompts = require('./prompts.js');
const validate = require('./validate.js');
const wxauth = require('./wxauth.js');
const ratelimit = require('./ratelimit.js');
const pay = require('./pay.js');
const gameapi = require('./gameapi.js');
const wxnotify = require('./wxnotify.js');
const playlog = require('./playlog.js');

const chartCore = require('../core/chart.js');
const matcher = require('../core/matcher.js');
const copywriter = require('../core/copywriter.js');
const fortuneCore = require('../core/fortune.js');

const APP_CONFIG = require('../config/index.js').CONFIG;
const { DIM_KEYS } = require('../data/archetypes.js');
const { ZODIAC_MAP, ELEMENTS } = require('../data/zodiac.js');
const { LEVELS, LUCKY_COLORS } = require('../data/fortune.js');
const { makePillar } = require('../core/bazi.js');
const { LIFE_NUMBERS } = require('../data/numerology.js');
const { FATE_MAP } = require('../data/fates.js');
const { CHARACTERS, CHARACTER_MAP, RARITY, MEDIUMS } = require('../data/characters.js');

const store = createStore({ dataDir: CONFIG.dataDir, proseCacheDays: CONFIG.limits.proseCacheDays });
const startedAt = Date.now();

// ============================================================ 工具

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}

/** 纯文本响应：消息推送的 URL 验证要求**原样返回 echostr**，不能包成 JSON */
function sendText(res, status, text) {
  const body = String(text === undefined || text === null ? '' : text);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const limit = limitBytes || 32 * 1024;
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 取出"当前登录用户"。涉及账号/付费的接口都要用它。
 * token 失效时直接回 401，让客户端重新登录 —— 不要静默降级成 IP，
 * 否则用户会看到"我的畅玩卡没了"。
 * @returns {string|null} owner，或 null（已返回 401）
 */
function requireOwner(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const o = wxauth.resolveOwner(req, token);
  if (o.expired) {
    sendJson(res, 401, {
      ok: false,
      error: 'TOKEN_EXPIRED',
      message: '登录状态已过期，请重新登录'
    });
    return null;
  }
  return o.owner;
}

function clientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function hash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 20);
}

// ============================================================ 从匿名数字还原命盘

function clampDims(raw) {
  const out = {};
  DIM_KEYS.forEach((k) => {
    const v = Number(raw && raw[k]);
    out[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 50;
  });
  return out;
}

function signView(key) {
  const z = ZODIAC_MAP[key];
  if (!z) return null;
  return {
    key: z.key,
    name: z.name,
    en: z.en,
    glyph: z.glyph,
    element: z.element,
    ruler: z.ruler,
    tagline: z.tagline
  };
}

function pillarView(idx) {
  const n = Number(idx);
  if (!Number.isFinite(n)) return null;
  const i = ((Math.round(n) % 60) + 60) % 60;
  return makePillar(i % 10, i % 12);
}

function lifeNumberView(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const meta = LIFE_NUMBERS[num] || LIFE_NUMBERS[9];
  return { number: num, name: meta.name, tagline: meta.tagline, dims: meta.dims };
}

/**
 * 把客户端送来的「匿名数字」还原成一份完整的命盘。
 * 这里所有中文都来自服务端自己的数据表，客户端送不进任何自由文本。
 */
function rebuildChart(p) {
  const mode = p.mode === 'draw' ? 'draw' : 'chart';
  const dims = clampDims(p.dims);
  const s = p.signs || {};
  const signs = {
    sun: signView(s.sun),
    moon: signView(s.moon),
    rising: signView(s.rising),
    risingKnown: mode === 'chart' && !!s.risingKnown && !!signView(s.rising),
    risingNote: s.risingKnown ? '按出生地估算' : '未提供出生时辰，上升星座留白'
  };
  if (!signs.risingKnown) signs.rising = null;

  const pl = p.pillars || {};
  const pYear = pillarView(pl.year);
  const pMonth = pillarView(pl.month);
  const pDay = pillarView(pl.day);
  const hourKnown = mode === 'chart' && !!pl.hourKnown;
  const pHour = hourKnown ? pillarView(pl.hour) : null;
  const pillars = pYear && pMonth && pDay ? { year: pYear, month: pMonth, day: pDay, hour: pHour } : null;

  const elementName = ELEMENTS[p.element] ? p.element : '水';
  const chart = {
    mode,
    seed: p.key || '',
    dims,
    signs,
    pillars,
    pillarsList: pillars
      ? [
          { key: 'year', label: '年柱', pillar: pillars.year, known: true, meaning: '出身与时代' },
          { key: 'month', label: '月柱', pillar: pillars.month, known: true, meaning: '环境与际遇' },
          { key: 'day', label: '日柱', pillar: pillars.day, known: true, meaning: '本性与配偶' },
          { key: 'hour', label: '时柱', pillar: pHour || pDay, known: !!pHour, meaning: '晚年与去向' }
        ]
      : [],
    lifeNumber: mode === 'chart' ? lifeNumberView(p.lifeNumber) : null,
    nameNumber: { number: 0, name: '无名', tagline: '', dims: null },
    element: Object.assign({ name: elementName }, ELEMENTS[elementName]),
    yinyang: pillars ? pillars.day.yinyang : (p.yinyang === '阴' ? '阴' : '阳'),
    input: {
      name: '',
      gender: '',
      birthDate: '',
      birthTime: '',
      timeKnown: hourKnown,
      city: '',
      label: mode === 'draw' ? '随心一签' : '生辰命盘'
    }
  };

  if (mode === 'draw') {
    const a = signView((p.draw && p.draw.signA) || 'aries');
    const b = signView((p.draw && p.draw.signB) || 'pisces');
    const f = FATE_MAP[(p.draw && p.draw.fateId) || ''] || null;
    chart.draw = {
      token: '',
      note: '此签不依生辰，只依你按下按钮的这一刻',
      veins: [a && a.name, b && b.name, f && f.name].filter(Boolean).join(' · ')
    };
    chart.pillars = null;
    chart.pillarsList = [];
    chart.signs.sun = a;
    chart.signs.moon = b;
  }

  return chartCore.finalize(chart);
}

/**
 * 客户端已经本地算好了运势（同一个人同一天结果固定），
 * 这里只接收档位/色号/数字这些"索引"，再从服务端表里还原成中文 ——
 * 这样提示词里写的幸运色和用户屏幕上看到的完全一致。
 */
function resolveFortune(body, chart) {
  const local = fortuneCore.daily(chart, body && body.date);
  const f = (body && body.fortune) || {};
  const level = LEVELS.find((l) => l.key === f.level) || null;
  const palette = LUCKY_COLORS[chart.element && chart.element.name] || LUCKY_COLORS['水'];
  const color = Number.isFinite(Number(f.colorIndex)) ? palette[Math.abs(Math.round(f.colorIndex)) % palette.length] : palette[0];
  const luckyNumber = Number.isFinite(Number(f.luckyNumber)) && f.luckyNumber >= 1 && f.luckyNumber <= 9
    ? Math.round(Number(f.luckyNumber))
    : local.luckyNumber;
  if (!level) return local;
  return Object.assign({}, local, {
    level: level.key,
    levelName: level.name,
    levelDesc: level.desc,
    stars: level.stars,
    starText: '★'.repeat(level.stars) + '☆'.repeat(5 - level.stars),
    luckyColor: color,
    luckyNumber
  });
}

function serializeMatch(m) {
  return {
    main: {
      id: m.main.id,
      resonance: m.main.resonance,
      mirrorScore: m.main.mirrorScore,
      sharedFateIds: m.main.sharedFates.map((f) => f.id),
      gap: m.main.gap,
      opposing: m.main.opposing
    },
    side: m.side.map((s) => ({ id: s.id, resonance: s.resonance, sharedFateIds: s.sharedFates.map((f) => f.id) })),
    anti: {
      id: m.anti.id,
      resonance: m.anti.resonance,
      mirrorScore: m.anti.mirrorScore,
      opposing: m.anti.opposing
    }
  };
}

// ============================================================ 主流程

async function handleDivinate(req, res, body) {
  const ip = clientIp(req);
  const owner = wxauth.ownerOf(req, (req.headers.authorization || '').replace(/^Bearer\s+/i, ''));

  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'BAD_BODY' });
  }
  if (!body.dims || !body.key || typeof body.key !== 'string' || body.key.length < 6) {
    return sendJson(res, 400, { ok: false, error: 'MISSING_FIELDS', message: 'key 和 dims 必填' });
  }

  const cacheKey = `p:${hash(body.key.slice(0, 64))}`;
  // getProse 返回的就是文案对象本身（不是 { copy } 包装）
  const cached = store.getProse(cacheKey);

  // 缓存命中：不花 AI 的钱，但仍然占配额（防止无限刷）
  if (cached) {
    const q = ratelimit.consumeCached(store, owner, ip);
    if (!q.ok) return quotaError(res, q);
    store.bumpStat('cached');
    return sendJson(res, 200, {
      ok: true,
      source: 'cache',
      copy: cached,
      meta: metaPayload(q)
    });
  }

  const q = ratelimit.consume(store, owner, ip);
  if (!q.ok) return quotaError(res, q);

  let chart;
  try {
    chart = rebuildChart(body);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'BAD_FACTS', message: e.message });
  }

  const match = matcher.match(chart);
  const fortune = resolveFortune(body, chart);
  const localCopy = copywriter.build(chart, match, fortune);

  const ctx = { chart, match, fortune };
  let copy = Object.assign({}, localCopy, { aiGenerated: false });
  let source = 'local';

  if (aiReady()) {
    store.bumpStat('calls');
    const pool = match.ranked.slice(0, APP_CONFIG.MATCH.SELECT_POOL);
    const candidates = pool.map((item) => matcher.decorate(chart, item.character, item.score));
    const usePicker = CONFIG.ai.aiPicksCharacter;

    const res2 = await deepseek.chat(
      usePicker ? prompts.buildPickerMessages(ctx, candidates) : prompts.buildMessages(ctx),
      { tag: 'divinate', maxTokens: CONFIG.ai.maxTokens }
    );

    if (res2.ok) {
      if (res2.usage) {
        store.bumpStat('tokensIn', res2.usage.tokensIn);
        store.bumpStat('tokensOut', res2.usage.tokensOut);
        store.bumpStat('tokensReasoning', res2.usage.tokensReasoning || 0);
        store.bumpStat('cacheHitTokens', res2.usage.cacheHit || 0);
      }
      // 模型自己在候选池里挑了角色的话，替换掉本地主推（只认池子里的 id）
      if (usePicker) {
        const pickedId = validate.validatePick(res2.data.mainId, candidates);
        if (pickedId && pickedId !== match.main.id) {
          const hit = candidates.find((c) => c.id === pickedId);
          match.main = hit;
        }
      }
      const allowed = []
        .concat(candidates.map((c) => c.char))
        .concat(match.side.map((s) => s.char))
        .concat([match.anti.char]);
      const v = validate.validateProse(res2.data, localCopy, { allowedNames: allowed });
      copy = Object.assign({}, localCopy, v.copy, {
        aiModel: undefined, // 技术信息不下发
        aiGenerated: v.copy.aiGenerated
      });
      source = v.copy.aiGenerated ? 'ai' : 'local';
      if (!v.copy.aiGenerated) store.bumpStat('failed');
    } else {
      store.bumpStat('failed');
      copy = Object.assign({}, localCopy, { aiGenerated: false, aiNote: res2.error });
    }
  }

  // 只有真的是 AI 写的（或完整的模板）才进缓存，跑偏的结果不缓存
  if (source === 'ai' || !aiReady()) {
    store.setProse(cacheKey, copy);
  }

  return sendJson(res, 200, {
    ok: true,
    source,
    match: serializeMatch(match),
    copy,
    fortune: { date: fortune.date, level: fortune.levelName, stars: fortune.stars },
    meta: metaPayload(q)
  });
}

function metaPayload(q) {
  return {
    disclaimer: CONFIG.disclaimer,
    showAiLabel: CONFIG.showAiLabel,
    quota: q && q.limit ? { used: q.used, limit: q.limit, remaining: Math.max(0, q.limit - q.used) } : null
  };
}

function quotaError(res, q) {
  const map = {
    TOO_FAST: [429, '请求太快了，歇一会儿再占'],
    DAILY_USER_LIMIT: [429, `今天的占卜次数用完了（${q.limit} 次），明天再来`],
    DAILY_GLOBAL_LIMIT: [503, '今天的星象额度已满，明天再来']
  };
  const row = map[q.reason] || [429, '暂时无法占卜'];
  return sendJson(res, row[0], {
    ok: false,
    error: q.reason,
    message: row[1],
    meta: metaPayload(q)
  });
}

// ============================================================ 路由

const ROUTES = {
  /**
   * 消息推送的 **URL 验证**（GET）。
   *
   * ⚠️ 这一步不做，MP 后台的"发货推送配置"永远显示"未通过"，配置根本存不下来 ——
   * 也就意味着发货推送一条都收不到，用户付了钱拿不到货。
   *
   * 官方流程：微信发 GET，带 signature/timestamp/nonce/echostr；
   * 开发者按 sha1(sort([Token, timestamp, nonce]).join('')) 算签名比对，
   * 通过后**原样返回 echostr**。
   */
  'GET /api/pay/notify': async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const signature = url.searchParams.get('signature');
    const timestamp = url.searchParams.get('timestamp');
    const nonce = url.searchParams.get('nonce');
    const echostr = url.searchParams.get('echostr');

    if (!wxnotify.isConfigured()) {
      console.error('[pay] 收到推送 URL 验证，但没配置 WX_NOTIFY_TOKEN');
      return sendText(res, 500, 'notify token not configured');
    }
    if (!wxnotify.checkSignature(signature, timestamp, nonce)) {
      console.error('[pay] 推送 URL 验证签名不通过');
      return sendText(res, 403, 'invalid signature');
    }
    console.log('[pay] 推送 URL 验证通过');
    sendText(res, 200, echostr || '');
  },

  'GET /api/health': async (req, res) => {
    sendJson(res, 200, {
      ok: true,
      version: APP_CONFIG.VERSION,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      ai: { configured: aiReady(), model: aiReady() ? CONFIG.ai.model : null, picksCharacter: CONFIG.ai.aiPicksCharacter },
      characters: CHARACTERS.length,
      stats: store.stats()
    });
  },

  // 客户端启动时调一次：拿角色库 + 一些展示用的配置
  'GET /api/roster': async (req, res) => {
    sendJson(res, 200, {
      ok: true,
      rarity: RARITY,
      mediums: MEDIUMS,
      dimensions: DIM_KEYS,
      characters: CHARACTERS,
      disclaimer: CONFIG.disclaimer,
      showAiLabel: CONFIG.showAiLabel
    });
  },

  'POST /api/session': async (req, res, body) => {
    // 传 store 是为了把 session_key 存到服务端（支付签名要用它，
    // 而它绝对不能下发客户端）。
    const r = await wxauth.login(body, store);
    if (!r.ok) return sendJson(res, 401, { ok: false, error: r.error });
    // ⚠️ 注意这里**只有** token，没有 sessionKey
    sendJson(res, 200, { ok: true, token: r.token, dev: r.dev });
  },

  // ---------------- 支付（虚拟支付 2.0 · 道具直购） ----------------

  /**
   * 下单签名。客户端拿到 signData/paySig/signature 后自己去拉起原生支付面板。
   * 所有密钥都留在这里，包体里一个都没有。
   */
  // 占卜主接口（本机算命盘 + 后端 AI 解读）。这个条目一度被我误删过，
  // 加回时顺手在测试里补断言，避免再丢。
  'POST /api/divinate': handleDivinate,

  'POST /api/pay/sign': async (req, res, body) => {
    if (!pay.isConfigured()) {
      return sendJson(res, 503, {
        ok: false,
        error: 'PAY_NOT_CONFIGURED',
        message: '支付尚未开通'
      });
    }
    const owner = requireOwner(req, res);
    if (!owner) return;
    const productId = body && body.productId;
    const product = CONFIG.pay.products.find((p) => p.id === productId);
    if (!product) {
      return sendJson(res, 400, { ok: false, error: 'UNKNOWN_PRODUCT', message: '没有这个档位' });
    }

    const sessionKey = store.getSessionKey(owner);
    if (!sessionKey) {
      // 用户态签名必须要 session_key，拿不到就得让客户端重新登录
      return sendJson(res, 401, {
        ok: false,
        error: 'NO_SESSION_KEY',
        message: '登录状态已过期，请重试'
      });
    }

    const outTradeNo = pay.genOrderNo();
    const signData = pay.signDataFor({
      productId: product.id,
      price: product.price,
      outTradeNo,
      attach: owner
    });

    // 记下订单，发货时用来核对天数（防止客户端传真天数）
    const user = store.getUser(owner) || {};
    user.orders = user.orders || {};
    user.orders[outTradeNo] = {
      productId: product.id,
      days: product.days,
      price: product.price,
      createdAt: Date.now(),
      delivered: false
    };
    store.setUser(owner, user);

    sendJson(res, 200, {
      ok: true,
      signData, // ⚠️ 必须原样传给支付接口，客户端不能重新序列化
      paySig: pay.paySig(signData),
      signature: pay.userSignature(signData, sessionKey),
      outTradeNo
    });
  },

  /**
   * 支付后确认。
   *
   * ⚠️ 安全权衡（必须知道）：
   *   金币到账的**权威来源是平台的发货推送**（见 /api/pay/notify），
   *   那个才是"真的付了钱"的凭据。
   *   这个接口只是为了让用户不用干等：客户端报告支付成功后，
   *   如果服务端已经通过发货推送发放过，就明确告诉他；
   *   如果还没收到推送（平台推送有几秒到几十秒的延迟），
   *   返回 pending 让客户端先放行、稍后再同步。
   *
   *   要更严格（防止伪造支付），应该在这里调 pay_v2.queryOrder 向平台核实订单，
   *   那需要 access_token 与米大师服务端接口，等接入真实支付时补上。
   */
  'POST /api/pay/confirm': async (req, res, body) => {
    const owner = requireOwner(req, res);
    if (!owner) return;
    const outTradeNo = body && body.outTradeNo;
    if (!outTradeNo) return sendJson(res, 400, { ok: false, error: 'MISSING_ORDER' });

    const user = store.getUser(owner) || {};
    const order = (user.orders || {})[outTradeNo];
    if (!order) {
      return sendJson(res, 404, { ok: false, error: 'ORDER_NOT_FOUND', message: '订单不存在' });
    }
    // 已经通过发货推送发放过：直接告诉他，不用再查
    if (order.delivered) {
      return sendJson(res, 200, { ok: true, delivered: true, passExpireAt: user.passExpireAt || 0 });
    }

    /**
     * 权威校验：问微信平台"这单到底付了没"。
     *
     * 这是从"信任客户端"升级到"平台说了算"的关键一步 ——
     * 客户端报告"我付了"是可以伪造的，而 pay_v2.queryOrder 返回的 pay_state
     * 是平台侧的账，伪造不了。
     *
     * 支付没配置（没版号/没填 key）或查询不可用时，退回 pending，
     * 由发货推送这条权威路径最终兜底。
     */
    if (!pay.isConfigured() || !gameapi.queryOrder) {
      return sendJson(res, 200, {
        ok: false,
        pending: true,
        error: 'PENDING_DELIVERY',
        message: '支付已受理，权益到账有短暂延迟',
        passExpireAt: user.passExpireAt || 0
      });
    }

    const sessionKey = store.getSessionKey(owner);
    const q = await gameapi.queryOrder({ openid: owner, outTradeNo, sessionKey, store });

    if (q.ok && q.paid) {
      // 平台确认已支付 → 发放（deliver 内部幂等）
      const r = pay.deliver(store, owner, outTradeNo, order.days);
      console.log(`[pay] queryOrder 确认已支付 order=${outTradeNo} → ${r.granted ? '已发放' : '已发放过'}`);
      const fresh = store.getUser(owner) || {};
      return sendJson(res, 200, {
        ok: true,
        delivered: true,
        verified: true,
        passExpireAt: fresh.passExpireAt || 0
      });
    }

    if (q.ok && !q.paid && q.payState) {
      // 平台明确说"未支付"：客户端报告了支付成功但平台没有这笔账 → 不能发货
      console.warn(`[pay] queryOrder 显示未支付 order=${outTradeNo} payState=${q.payState}`);
      return sendJson(res, 200, {
        ok: false,
        error: 'NOT_PAID',
        verified: true,
        message: '未检测到这笔支付'
      });
    }

    // 查询失败（网络/权限/订单还没同步）：退回 pending，别谎报
    return sendJson(res, 200, {
      ok: false,
      pending: true,
      error: q.error || 'PENDING_DELIVERY',
      message: q.message || '支付已受理，权益到账有短暂延迟',
      passExpireAt: user.passExpireAt || 0
    });
  },

  'GET /api/entitlement': async (req, res) => {
    const owner = requireOwner(req, res);
    if (!owner) return;
    const user = store.getUser(owner) || {};
    sendJson(res, 200, {
      ok: true,
      passExpireAt: user.passExpireAt || 0,
      orderCount: Object.keys(user.orders || {}).length
    });
  },

  /**
   * 平台的道具发货推送。
   *
   * 官方要求（原文）：
   *   - 「同样的发货请求（outTradeNo）可能因为网络原因会请求多次，
   *      开发者需要自行保证只发货一次，并且回包需要和第一次一样返回发货成功」
   *   - 「必须要开启道具发货推送才能收到回调请求」
   *   - 通知周期 15s/15s/30s/3m/10m/20m/30m/... 直到成功
   * 所以这里必须幂等，且成功时永远回 { ErrCode: 0 }。
   */
  // ---------------- 账号与登录态 ----------------

  /**
   * 账号信息。
   *
   * 说明：**小游戏没有"注册"这一步**。wx.login 拿到 code、服务端换 openid，
   * 整个过程没有 UI、不需要用户授权，用户进入即已登录。
   * 所以这个接口不是"登录页"的数据源，而是"账号状态"的展示源。
   *
   * ?check=1 时顺带向平台校验 session_key 是否还有效（会多一次平台调用，
   * 因为 session_key 会被重新登录顶替，失效会导致支付签名失败）。
   */
  'GET /api/account': async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const o = wxauth.resolveOwner(req, token);

    if (o.expired) {
      return sendJson(res, 401, {
        ok: false,
        error: 'TOKEN_EXPIRED',
        message: '登录状态已过期，请重新登录'
      });
    }

    const owner = o.owner;
    const isDev = String(owner).indexOf('dev_') === 0 || String(owner).indexOf('ip_') === 0;
    const user = store.getUser(owner) || {};
    const sessionKey = isDev ? '' : store.getSessionKey(owner);

    const mask = (v) => {
      const s = String(v || '');
      if (s.length < 10) return s ? `${s.slice(0, 2)}****` : '';
      return `${s.slice(0, 6)}****${s.slice(-4)}`;
    };

    let sessionCheck = { checked: false };
    if (url.searchParams.get('check') === '1' && sessionKey) {
      const c = await gameapi.checkSessionKey({ openid: owner, sessionKey, store });
      sessionCheck = {
        checked: true,
        valid: !!c.valid,
        error: c.error || '',
        message: c.valid ? '' : '登录凭证已失效，支付前需要重新登录'
      };
    }

    sendJson(res, 200, {
      ok: true,
      // 登录态本身
      loggedIn: !isDev,
      devMode: isDev,
      anonymous: o.anonymous,
      openidMasked: mask(owner),
      unionidMasked: mask(user.unionid),
      hasUnionid: !!user.unionid,
      // session_key 只在有真实登录时才有意义（支付签名要用）
      sessionKeyPresent: !!sessionKey,
      session: sessionCheck,
      // 服务端侧的权益（付费相关的权威数据）
      passExpireAt: user.passExpireAt || 0,
      orderCount: Object.keys(user.orders || {}).length,
      // 账号里的游玩记录（只含"结果"，不含生辰 —— 见 server/playlog.js 的说明）
      play: playlog.statsOf(playlog.playOf(user)),
      // 给 UI 用的一句话状态
      statusText: isDev
        ? '开发模式：未接入微信登录'
        : sessionCheck.checked && !sessionCheck.valid
        ? '登录凭证已失效，支付前需重新登录'
        : '已通过微信登录'
    });
  },

  /**
   * 重新登录。客户端重新 wx.login 拿 code 传过来。
   *
   * 什么时候需要：
   *   - session_key 被顶替/过期（支付签名会报 90016 / -15015）
   *   - 我们自己的 token 过期了（返回 401 TOKEN_EXPIRED）
   */
  'POST /api/account/relogin': async (req, res, body) => {
    const r = await wxauth.login(body || {}, store);
    if (!r.ok) {
      return sendJson(res, r.blocked ? 403 : 401, {
        ok: false,
        error: r.error,
        blocked: !!r.blocked,
        message: r.message || '重新登录失败'
      });
    }
    console.log(`[auth] 重新登录成功 openid=${r.openid}`);
    sendJson(res, 200, {
      ok: true,
      token: r.token,
      dev: r.dev,
      openidMasked: r.openid ? `${String(r.openid).slice(0, 6)}****${String(r.openid).slice(-4)}` : ''
    });
  },

  // ---------------- 账号里的游玩记录 ----------------

  /**
   * 上报一次游玩。
   *
   * ⚠️ 这里**只收结果，不收生辰**：字段白名单在 server/playlog.js 里，
   * 多传的字段一律丢弃。客户端也不会上报 birthDate / 四柱 / 八轴
   * —— 四柱能反推出生时刻，落库等于存了生日。
   *
   * 上报失败**不影响游戏**：客户端是"本地先写、异步上报"，这里挂了也不丢数据。
   */
  'POST /api/play/record': async (req, res, body) => {
    const owner = requireOwner(req, res);
    if (!owner) return;
    const r = playlog.record(store, owner, body || {});
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    sendJson(res, 200, { ok: true, duplicate: r.duplicate, stats: r.stats });
  },

  /** 拉取账号里的游玩记录（换设备后恢复图鉴与历史） */
  'GET /api/play': async (req, res) => {
    const owner = requireOwner(req, res);
    if (!owner) return;
    const r = playlog.pull(store, owner);
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    sendJson(res, 200, r);
  },

  /**
   * 清空账号里的游玩记录。
   * ⚠️ 这是**不可逆**的，而且清的是账号里的那一份（本机那份还在）。
   * 客户端要二次确认，并说清"账号记录清空，本机记录保留"。
   */
  'POST /api/play/clear': async (req, res) => {
    const owner = requireOwner(req, res);
    if (!owner) return;
    const r = playlog.clear(store, owner);
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    console.log(`[play] 已清空账号游玩记录 owner=${owner}`);
    sendJson(res, 200, { ok: true });
  },

  /**
   * 重置登录态（session_key）。
   *
   * ⚠️ 官方三个约束：重置后**原 session_key 立即失效**（会影响正在进行的支付签名）、
   * **重置不能续期**（新 key 继承原过期时间）、**不允许频繁重置**。
   * 所以这是一个"补救"手段，不是"续期"手段 —— 正常情况下重新登录更好。
   */
  'POST /api/account/reset-session': async (req, res) => {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const sessionKey = store.getSessionKey(owner);
    if (!sessionKey) {
      return sendJson(res, 400, {
        ok: false,
        error: 'NO_SESSION_KEY',
        message: '当前没有可重置的登录凭证，请直接重新登录'
      });
    }

    const r = await gameapi.resetUserSessionKey({ openid: owner, sessionKey, store });
    if (!r.ok) {
      return sendJson(res, 200, { ok: false, error: r.error, message: r.message || '重置失败' });
    }
    store.setSessionKey(owner, r.sessionKey);
    console.log(`[auth] 已重置登录态 openid=${owner}`);
    sendJson(res, 200, { ok: true, message: '登录凭证已重置' });
  },

  'POST /api/pay/notify': async (req, res, body) => {
    // 发货推送来自微信服务器，不走我们的登录态，靠签名证明身份
    if (!wxnotify.isConfigured()) {
      console.error('[pay] 收到发货推送，但没配置 WX_NOTIFY_TOKEN');
      return sendJson(res, 503, { ErrCode: 503, ErrMsg: 'notify not configured' });
    }

    // 解析：明文模式直接给 JSON，安全模式需要 AES 解密
    const parsed = wxnotify.parsePush(body);
    if (!parsed.ok) {
      console.error('[pay] 发货推送解析失败:', parsed.error);
      // 解析不了说明不是我们能处理的东西，回成功避免平台无意义重试
      return sendJson(res, 200, { ErrCode: 0, ErrMsg: 'Success' });
    }

    const info = parsed.data || {};
    const mini = info.MiniGame || {};
    const payload = mini.Payload || '';
    const sig = mini.PayEventSig || '';
    const isMock = !!(mini.IsMock || parsed.mock);

    // ⚠️ 必须校验 PayEventSig，否则任何人都能伪造"我付钱了"
    if (!wxnotify.checkPayEventSig(payload, sig, isMock)) {
      console.error('[pay] 发货推送 PayEventSig 校验失败，已拒收');
      return sendJson(res, 403, { ErrCode: 403, ErrMsg: 'invalid signature' });
    }

    let goods = null;
    try {
      goods = JSON.parse(payload);
    } catch (e) {
      return sendJson(res, 200, { ErrCode: 0, ErrMsg: 'Success' });
    }

    const openid = goods.OpenId;
    const outTradeNo = goods.OutTradeNo;
    const productId = (goods.GoodsInfo && goods.GoodsInfo.ProductId) || '';

    // 天数以**服务端下单时记录的**为准，不信推送内容（否则改个包就能买 1 天得 30 天）
    const user = store.getUser(openid) || {};
    const order = (user.orders || {})[outTradeNo];
    const days = order ? order.days : 1;

    const r = pay.deliver(store, openid, outTradeNo, days);
    console.log(
      `[pay] 发货${isMock ? '(模拟)' : ''} openid=${openid} order=${outTradeNo} ` +
        `product=${productId} → ${r.granted ? `已发放 ${days} 天` : '重复推送，跳过'}`
    );
    // 官方要求：成功永远回 { ErrCode: 0 }，重复推送也要回一样的
    sendJson(res, 200, { ErrCode: 0, ErrMsg: 'Success' });
  },
  'POST /api/fortune': async (req, res, body) => {
    const chart = rebuildChart(body || {});
    const f = fortuneCore.daily(chart, (body || {}).date);
    sendJson(res, 200, { ok: true, fortune: f });
  },

  'GET /api/stats': async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const token = url.searchParams.get('token');
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' });
    }
    sendJson(res, 200, { ok: true, stats: store.stats(), uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
  }
};

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const handler = ROUTES[`${req.method} ${url}`];

  if (!handler) {
    // 单独处理 /api/characters/:id，避免为它写一个路由匹配器
    const m = /^\/api\/characters\/([\w-]{1,40})$/.exec(url);
    if (m && req.method === 'GET') {
      const c = CHARACTER_MAP[m[1]];
      if (!c) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
      return sendJson(res, 200, { ok: true, character: c, rarity: RARITY[c.rarity] });
    }
    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', path: url });
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : null;
    await handler(req, res, body);
  } catch (e) {
    const code = e && e.message === 'BODY_TOO_LARGE' ? 413 : e && e.message === 'BAD_JSON' ? 400 : 500;
    if (code === 500) console.error('[server] 未捕获异常:', e);
    sendJson(res, code, { ok: false, error: e.message || 'INTERNAL' });
  } finally {
    console.log(`${req.method} ${url} ${res.statusCode || 200} ${Date.now() - started}ms`);
  }
});

/**
 * 启动。
 *
 * ⚠️ 云托管上必须**先把历史快照从 MySQL 读回来，再开始接请求**：
 * 否则用户权益、付费订单会以"空的"状态被读到，万一用户正好在这几百毫秒里支付，
 * 就会出现"付了钱但权益没到账"这类最难查的问题。
 */
async function bootstrap() {
  if (CONFIG.db && CONFIG.db.enabled) {
    // eslint-disable-next-line global-require
    const { attach } = require('./store-mysql.js');
    const r = await attach(store, CONFIG.db);
    console.log(`  MySQL: ${r.ok ? `已连接（${r.message}）` : `连接失败 → 退回纯内存（${r.message}）`}`);
  }

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`我推的星运 · 后端已启动 http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`  AI: ${aiReady() ? `${CONFIG.ai.model} @ ${CONFIG.ai.baseUrl}` : '未配置 DEEPSEEK_API_KEY → 走本地模板'}`);
    console.log(`  微信登录: ${wxauth.isDevMode() ? '开发模式（客户端可自带 devId）' : '正式模式'}`);
    console.log(`  每日配额: 每人 ${CONFIG.limits.dailyPerUser} 次 / 全站 ${CONFIG.limits.dailyGlobal} 次`);
    console.log(`  存储: ${CONFIG.db && CONFIG.db.enabled ? 'MySQL 快照（单实例）' : '本机 JSON 文件'}`);
    store.prune();
  });
}

bootstrap().catch((e) => {
  console.error('[server] 启动失败:', (e && e.stack) || e);
  process.exit(1);
});

process.on('SIGINT', () => {
  store.save();
  console.log('\n已保存数据，退出。');
  process.exit(0);
});
process.on('SIGTERM', () => {
  store.save();
  process.exit(0);
});

// store / pay 导出给自动化测试用（测试需要注入 session_key 才能走签名流程，
// 而 session_key 的真实来源是微信 code2session，测试环境拿不到）
module.exports = { server, rebuildChart, store, pay };
