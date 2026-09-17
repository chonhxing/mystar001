/**
 * 后端配置。全部走环境变量，本地开发可以放一个 server/.env（用 node --env-file=.env 启动）。
 *
 * ⚠️ DEEPSEEK_API_KEY 只能存在这里（服务端），绝对不要下发到小程序。
 *    小程序包体是可以被解包看的，任何写进前端的 key 都等于公开。
 */

const path = require('path');

function str(key, def) {
  const v = process.env[key];
  return v === undefined || v === '' ? def : v;
}

function num(key, def) {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : def;
}

function bool(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return v === '1' || v === 'true';
}

const CONFIG = {
  port: num('PORT', 8787),
  host: str('HOST', '0.0.0.0'),
  dataDir: str('DATA_DIR', path.join(__dirname, 'runtime')),

  ai: {
    apiKey: str('DEEPSEEK_API_KEY', ''),
    baseUrl: str('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    // ⚠️ DeepSeek 接口只认 deepseek-flash / deepseek-v4-pro（旧的 deepseek-chat /
    //    deepseek-reasoner 作为别名仍可用，但 deepseek-v4.1 这类名字会被 400 拒绝）。
    //    这两个都是**推理模型**：会先产出 reasoning_tokens 再给正文，
    //    所以 maxTokens 必须同时覆盖"思考 + 五段文案"，否则 JSON 会被截断。
    model: str('DEEPSEEK_MODEL', 'deepseek-v4-pro'),
    timeoutMs: num('DEEPSEEK_TIMEOUT_MS', 55000),
    maxTokens: num('DEEPSEEK_MAX_TOKENS', 4000),
    // 推理模型对 temperature 未必买账（不支持时接口会忽略），留着不碍事
    temperature: num('DEEPSEEK_TEMPERATURE', 1.1),
    retries: num('DEEPSEEK_RETRIES', 1),
    // 允许模型在候选池里自己挑角色（更"AI 原生"，但角色出场分布会变）
    aiPicksCharacter: bool('AI_PICKS_CHARACTER', false)
  },

  /**
   * 虚拟支付 2.0（道具直购）。全部走环境变量，**绝不下发客户端**。
   * 没配时整条支付链路返回"未开通"，不影响其他功能。
   * ⚠️ 开通前提：企业主体 + 中宣部实名认证接入 + 游戏版号。
   */
  pay: {
    // 米大师「支付基础配置」里的 AppKey，用于 paySig 与发货推送校验
    appKey: str('MIDAS_APP_KEY', ''),
    /**
     * ⚠️ 支付签名的拼接方式。官方的《支付请求签名算法说明》在腾讯文档里、
     * 需要权限才能打开，所以"拼接串里到底放接口英文名还是路径"无法从公开文档确认。
     * 能确定的只有 requestMidasPaymentGameItem 的例子（用接口英文名）。
     * 接入真实支付时若签名报错（90011 pay_sig 错误），改这个值换一种拼法即可：
     *   english_name（默认）| path | path_no_slash | body_only
     */
    sigMode: str('MIDAS_SIG_MODE', 'english_name'),
    /**
     * 消息推送配置（MP 后台「虚拟支付2.0 - 基本配置 - 基础配置 - 发货推送配置」）。
     * Token 用于 URL 验证的签名；EncodingAESKey 用于安全模式下解密消息体。
     * ⚠️ 没有这两个，MP 后台的 URL 验证过不了，发货推送一条也收不到。
     */
    notifyToken: str('WX_NOTIFY_TOKEN', ''),
    encodingAESKey: str('WX_ENCODING_AES_KEY', ''),
    // 虚拟支付 2.0 - 基础配置 - 支付应用 ID
    offerId: str('MIDAS_OFFER_ID', ''),
    // 基础配置 - 游戏币/道具配置 - 分区配置 - 分区 ID
    zoneId: str('MIDAS_ZONE_ID', '1'),
    // 0 = 正式环境，1 = 沙箱环境（沙箱只有开发版/体验版可用，正式版必须用 0）
    env: num('MIDAS_ENV', 0),
    // 道具档位要和 MP 后台「道具配置」里的完全一致（id/价格），价格单位是「分」
    products: [
      { id: str('MIDAS_GOODS_1D', 'pass_1d'), days: 1, price: num('MIDAS_PRICE_1D', 600) },
      { id: str('MIDAS_GOODS_7D', 'pass_7d'), days: 7, price: num('MIDAS_PRICE_7D', 3000) },
      { id: str('MIDAS_GOODS_30D', 'pass_30d'), days: 30, price: num('MIDAS_PRICE_30D', 10000) }
    ]
  },

  wechat: {
    appid: str('WX_APPID', ''),
    secret: str('WX_SECRET', ''),
    // 服务端接口域名（access_token / queryOrder / msgSecCheck 都走这里）
    apiBase: str('WX_API_BASE', 'https://api.weixin.qq.com'),
    // 小程序登录接口，一般不用改
    loginUrl: 'https://api.weixin.qq.com/sns/jscode2session'
  },

  auth: {
    // 签发会话 token 的密钥，上线必须换掉
    secret: str('AUTH_SECRET', 'dev-only-change-me'),
    tokenTtlHours: num('TOKEN_TTL_HOURS', 24 * 30)
  },

  limits: {
    // 每个用户每天能占几次（AI 调用是要花钱的，这个值是成本闸门）
    dailyPerUser: num('DAILY_PER_USER', 10),
    // 全站每天上限，防刷爆账单
    dailyGlobal: num('DAILY_GLOBAL', 3000),
    // 同一 IP 每分钟请求上限（只用于开发模式和异常保护）
    perMinutePerIp: num('PER_MINUTE_PER_IP', 40),
    // 解读文本缓存天数：同一个命盘重复占卜直接读缓存，省钱且结果稳定
    proseCacheDays: num('PROSE_CACHE_DAYS', 30)
  },

  // 客户端会展示这段话，自己按当地法规调整
  disclaimer: str(
    'DISCLAIMER',
    '本内容由算法与人工智能生成，属娱乐性创作，不构成任何建议，请勿据此做出重要决定。'
  ),
  // 是否在客户端展示"AI 生成"标识。按《人工智能生成合成内容标识办法》应当保留。
  showAiLabel: bool('SHOW_AI_LABEL', true),

  /**
   * 数据库（微信云托管用云托管自带的 MySQL）。
   *
   * 不配 `DB_HOST` 就是纯本地模式：内存 + JSON 文件，零依赖。
   * 配了就把整份快照持久化到 MySQL（原因和代价见 store-mysql.js 顶部）。
   *
   * ⚠️ 密码只走**环境变量**（云托管控制台 → 服务设置 → 环境变量），
   *    绝不写进仓库，更不下发客户端。
   */
  db: {
    enabled: !!str('DB_HOST', ''),
    host: str('DB_HOST', ''),
    port: num('DB_PORT', 3306),
    user: str('DB_USER', ''),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', 'wo_tui_zhan_xing'),
    ssl: bool('DB_SSL', false)
  }
};

/**
 * 端口。微信云托管**要求容器监听控制台里配置的那个端口（默认 80）**，
 * 平台把实际端口塞进 `PORT` 环境变量。本地开发不设 PORT 就是 8787。
 * ⚠️ 版本配置里的容器端口必须和这里实际监听的一致，否则请求到不了容器（表现为一直超时）。
 */
CONFIG.port = num('PORT', 8787);
// 云托管要监听 0.0.0.0：只绑 127.0.0.1 的话平台健康检查探不到，容器会被判定启动失败
CONFIG.host = str('HOST', '0.0.0.0');

/** 没有配 key 就跑纯本地模板（便于开发和压测），不会报错 */
function aiReady() {
  return !!CONFIG.ai.apiKey;
}

module.exports = { CONFIG, aiReady };
