# API 核对清单

对 [小游戏 API 文档](https://developers.weixin.qq.com/minigame/dev/api/)（920 个 API 页）逐类过了一遍，
下面分成三部分：**在用的（已逐条核对）**、**该用但之前漏了的（已补上）**、**以后可能用得上的**。

---

## 一、在用的 API（逐条核对结果）

| API | 我们的用法 | 核对结论 |
| --- | --- | --- |
| `wx.createCanvas` | 首次调用得上屏画布，之后是离屏（占位立绘/文本测量） | ✅ 顺序正确（boot 里先建舞台再允许离屏） |
| `wx.getWindowInfo` | 取窗口尺寸/dpr/安全区；低版本退回 `getSystemInfoSync` | ✅ 正是官方推荐的"API 存在判断"写法 |
| `wx.getMenuButtonBoundingClientRect` | **新加**：避让右上角胶囊按钮 | ⚠️ 见第二部分，之前漏了 |
| `wx.onTouchStart/Move/End/Cancel` | 自研点击/拖动/长按识别 | ✅ 文档注明 Windows/Mac 上鼠标事件会转成触摸，已适配 |
| `wx.onWheel` | PC 滚轮滚动列表 | ✅ 用 `offWheel` 对应移除（我们没移除，长生命周期场景无影响） |
| `wx.onShow/onHide` | 前后台切换暂停/恢复主循环 | ✅ 注意官方明确：**后台 5s 内未结束的网络请求会 `fail interrupted`** |
| `wx.getEnterOptionsSync` | **新加**：拿启动参数（含热启动） | ⚠️ 之前用的是只覆盖冷启动的 `getLaunchOptionsSync` |
| `wx.onMemoryWarning` | 清图片缓存；level≥10 时催 GC | ✅ `level` 仅 Android 有（5/10/15） |
| `wx.triggerGC` | **新加**：内存告警后主动回收 | ✅ |
| `wx.setPreferredFramesPerSecond` | 60fps | ✅ 有效范围 1~60 |
| `requestAnimationFrame` | 主循环 | ✅ |
| `wx.request` | 调自家后端；`timeout` 显式指定 | ✅ 默认超时 60000，我们显式设了更短的；`content-type` 默认 json |
| `wx.createImage` | 加载立绘 | ✅ |
| `wx.setStorageSync/getStorageSync/removeStorageSync/clearStorageSync` | 生辰/图鉴/记录/设置 | ✅ 上限 10MB，按用户隔离 |
| `wx.showToast/showModal/showLoading/hideLoading` | 提示与确认 | ✅ `showModal` 还用于版本更新提示（原生弹窗层级最高） |
| `wx.showKeyboard/hideKeyboard` + `onKeyboardInput/Confirm/Complete` + `offKeyboard*` | 拉起原生键盘输入称呼 | ✅ 必填参数（defaultValue/maxLength/multiple/confirmHold/confirmType）都传了 |
| `wx.vibrateShort` | 点击反馈 | ✅ `type` 是必填，我们传了 `light`；低端机可能 fail，已 try/catch |
| `wx.createRewardedVideoAd` + `onClose/onError/offClose/offError/load/show` | 激励视频 | ✅ 小游戏端是**全局单例**，我们按 adUnitId 缓存复用；`onClose.isEnded`(2.1.0+) 才是"看完" |
| `wx.shareAppMessage` + `onShareAppMessage` + `showShareMenu` | 转发 | ✅ `title/imageUrl/query/imageUrlId/path`；**query 必须是 `k=v&k=v` 格式**；不填 imageUrl 时平台用游戏画面截图 |
| `wx.createInnerAudioContext` | （待接音频） | ✅ 注意：**不会自动释放，不用时要 `destroy()`**；短音频建议 `useWebAudioImplement: true` |
| `wx.loadSubpackage/preDownloadSubpackage` | （待接分包） | ✅ 主包≤4M、总计≤30M、单分包不限、独立分包≤4M |
| `wx.getUpdateManager` | 版本更新提示 | ✅ 见 RELEASE-CHECKLIST |
| `wx.reportEvent` | 埋点（默认关闭） | ✅ 事件 id 必须先在 MP 后台"自定义分析"建好 |
| `wx.getLogManager` | 日志进"玩家反馈" | ✅ |
| `wx.onError/onUnhandledRejection` | 全局异常 | ✅ |
| `wx.getAppBaseInfo` | 拿基础库版本 | ✅ `<=2.20.1` 要用 `getSystemInfoSync` 取版本号 |
| `wx.setKeepScreenOn` | **新加**：等 AI 时保持常亮 | ⚠️ 见第二部分 |
| `wx.onNetworkWeakChange` | **新加**：弱网直接走本机 | ⚠️ 见第二部分 |

---

## 二、之前漏掉的（已补上）

### 1. ⚠️ 右上角胶囊按钮会挡住我们的内容（真 bug）
`wx.getMenuButtonBoundingClientRect`（2.1.0+）返回胶囊按钮的布局信息。

**问题**：我只避开了"刘海"（`safeArea.top`），但胶囊按钮通常在刘海下方还延伸一截。
实测（`device.js` 的设计稿坐标）：带刘海设备 `safeTop = 88`，而胶囊**底边在 160**。
也就是说我们顶部的标题、自检场景的帧率角标画在 y≈104 —— **literally 压在胶囊按钮下面**。

**修法**：新增 `contentTop = max(safeTop, capsule.bottom)`，所有"贴顶"的元素改用它；
同时暴露 `contentRight = capsule.left`，右上角元素不该越过这条线。
自检场景里还把胶囊占位**用红色虚线画出来**，肉眼就能确认没被挡。

### 2. ⚠️ 等 AI 时用户锁屏，请求会被中断
官方文档明确：「小程序进入后台运行后，如果 **5s 内网络请求没有结束，会回调错误信息 `fail interrupted`**」。

**问题**：我们的 AI 解读现在约 9~14 秒（`deepseek-flash`），慢的时候会到几十秒。
用户等得无聊锁屏，这次请求就白费了（还白花了钱）。

**修法**：请求期间 `wx.setKeepScreenOn({ keepScreenOn: true })`，拿到结果立刻恢复。
（实测验证过去重逻辑：重复开启只调一次 API。）

### 3. ⚠️ 弱网时不该让用户干等 50 秒
`wx.onNetworkWeakChange`（2.21.0+）能拿到弱网状态。

**修法**：弱网时**直接跳过 AI 走本机解读**，并给用户一句"星象信号不好，这次用本机图谱为你解读"。
比让用户等 50 秒再失败好得多，也省了 token。

### 4. 冷启动 vs 热启动的启动参数
`wx.getEnterOptionsSync`（2.13.2+）**同时覆盖冷启动和热启动**，
而 `wx.getLaunchOptionsSync` 只给冷启动的。

**修法**：优先用 `getEnterOptionsSync`，取不到再退回 `getLaunchOptionsSync`。

### 5. 内存告警后主动催 GC
`wx.triggerGC` 可以加快触发 JavaScriptCore 垃圾回收。

**修法**：内存告警 `level >= 10`（中等以上）时，清完缓存再主动催一次 GC。

---

## 三、隐私相关：我们**不需要**自绘隐私弹窗（但要知道边界）

官方给了四个隐私接口：`wx.getPrivacySetting`、`wx.onNeedPrivacyAuthorization`、
`wx.openPrivacyContract`、`wx.requirePrivacyAuthorize`（均 2.32.3+）。

**关键机制**（原文）：

> 小游戏**未**注册 `wx.onNeedPrivacyAuthorization` 事件监听时，会默认使用**平台统一隐私弹窗**；
> 注册后会切换至**自定义隐私弹窗**，此时需要开发者自行渲染隐私弹窗。

**我们的判断：不注册更省事也更安全。**

隐私接口只在调用"隐私相关 API"且用户未同意时触发。对照官方标准 API 清单，
**我们一个都没用**：

| 隐私 API 类别 | 我们 |
| --- | --- |
| 昵称头像（`getUserInfo`/`createUserInfoButton`） | ❌ 没用 |
| 位置信息（`getLocation`/`getFuzzyLocation`） | ❌ 没用 |
| 微信运动步数 | ❌ 没用 |
| 相册/相机/麦克风 | ❌ 没用 |
| 蓝牙 / 传感器（加速计/陀螺仪/罗盘/方向） | ❌ 没用 |
| **剪贴板（`setClipboardData`/`getClipboardData`）** | ❌ 没用 |
| 微信朋友关系（`getFriendCloudStorage` 等） | ❌ 没用（**做排行榜就会用上，那时要回来处理**） |

所以平台不会向我们弹隐私授权，也就不用自绘。

**⚠️ 但这是边界不是豁免**：
- 以后加「复制结果文案」→ 用了 `setClipboardData` → 就要处理隐私授权
- 以后加「好友排行榜」→ 用了`getFriendCloudStorage` → 同上
- 用户输入「称呼」只存本地、不上传、不展示给别人 → 不算，但**要在《用户隐私保护指引》里如实披露**

---

## 四、以后可能用得上的（按价值排序）

| API | 用途 | 什么时候用 |
| --- | --- | --- |
| `wx.getTextLineHeight` | 精确的一行文本行高 | 想让中文排版更精细时（现在是 `size × 1.85` 的经验值）。⚠️ 需要传 `fontFamily` 和 `text`，且可能是异步回调，换之前要测 |
| `wx.getDeviceBenchmarkInfo` | 设备性能得分/机型档位 | 立绘接入后，低端机自动降级（少画粒子、不播动画） |
| `wx.reportPerformance` / `wx.getPerformance` | 性能上报到 MP 后台 | 想看线上真实帧率/启动耗时分布时 |
| `wx.onUserCaptureScreen` | 用户截屏事件 | 截屏时提示"分享给朋友"（但注意别变成暗示分享） |
| `wx.shareImageToGroup` 等聊天工具 | 转发图片/文本到群 | 分享图做好之后 |
| `wx.onAddToFavorites` / `wx.onCopyUrl` | 收藏 / 复制链接 | 想做"收藏起来慢慢看" |
| `wx.createGameClubButton` | 游戏圈入口按钮 | 开游戏圈之后 |
| `wx.createFeedbackButton` | 意见反馈按钮 | 收集反馈 |
| `wx.requestSubscribeSystemMessage` | 订阅"排行被超越"提醒 | 做排行榜之后（⚠️ 别滥用，规范 5.21） |
| `wx.checkIsAddedToMyMiniProgram` | 是否被添加到"我的小程序" | 引导回访 |
| `wx.getGroupEnterInfo` | 群聊场景启动信息 | 做群排行/群分享 |
| `wx.loadFont` | 加载自定义字体 | 美术给了品牌字体（注意字体文件要进包体，且版权要清） |
| `wx.createPath2D` | 复用路径对象 | 图形绘制变复杂时（现在路径都很简单，用不上） |
| `wx.setVisualEffectOnCapture` | 截屏/录屏时的屏幕表现 | 想保护隐私内容不被截屏 |
| `wx.onWindowResize` | 窗口尺寸变化（PC） | 我们关了 `resizable`，暂时不需要；PC 适配时再看 |
| `wx.getBatteryInfo` | 电量 | 低电量时降帧 |
| `wx.getRankManager` | 擂台赛（得分排行榜） | 想做周期冲榜玩法 |
| `wx.createUserInfoButton` | 用户信息按钮 | **⚠️ 会用上隐私接口，用之前先读第三节** |

---

## 四点五、服务端 API（`api.weixin.qq.com`，共 45 个）

这些**只能在服务端调**（官方原文：「接口应在服务器端调用，不可在前端直接调用」），且都要 access_token。

### 在用的

| 接口 | 路径 | 说明 |
| --- | --- | --- |
| `auth.code2Session` | `/sns/jscode2session` | code 换 openid。**会话密钥 session_key 只存服务端**（用户态签名要用，绝不下发） |
| `getStableAccessToken` | `/cgi-bin/stable_token` | access_token。**官方推荐替代老的 getAccessToken** |
| `pay_v2.queryOrder` | `/wxa/game/queryorderinfo` | **查订单。判断"用户到底付没付钱"的权威来源** |
| `gameMsgSecCheck` | `/wxa/game/content_spam/msg_sec_check` | 游戏专用文本内容安全（有 UGC 才必须调，能力已备好） |
| 消息推送 | 自建 URL | 道具发货推送（GET 验证 + POST 收消息） |

### access_token 的几个关键细节（配错就全盘 40001）

- **用 `stable_token`，不用 `getAccessToken`**。官方原文：「此接口和 getAccessToken 互相隔离，
  且比其更加稳定，推荐使用此接口替代」
- **普通模式（不传 `force_refresh`）在有效期内重复调用不会刷新 token** —— 所以可以放心缓存、反复请求
- 「普通模式下平台会**提前 5 分钟**更新 access_token」→ 我们也提前 5 分钟续期
- ⚠️ **强制刷新模式每天限 20 次、需间隔 30 秒**，用错会把线上 token 打废 —— 我们不用它
- ⚠️ **IP 白名单**：错误码 `40164` = 服务器 IP 不在白名单，要去 MP 后台加
- 并发要合并（single-flight），否则多人同时进会浪费配额

### 消息推送：这是最容易配错、错了用户就收不到货的一环

| 步骤 | 要点 |
| --- | --- |
| 1. 后台配置 | MP「虚拟支付2.0 - 基本配置 - 基础配置 - 发货推送配置」填 **URL + Token + EncodingAESKey**，加解密方式建议**安全模式** |
| 2. **URL 验证是 GET** | 微信会发 `GET ?signature&timestamp&nonce&echostr`，要按 `sha1(sort([Token, timestamp, nonce]).join(''))` 验签，通过后**原样返回 echostr**（纯文本，不是 JSON）。**不做这步后台会一直显示"未通过"，配置存不下来** |
| 3. 安全模式要解密 | 消息体是 **AES-256-CBC**：`aeskey = base64decode(EncodingAESKey + '=')`、`iv = aeskey[0..16]`、PKCS#7 填充；明文结构 `random(16) + msgLen(4,大端) + msg + appId`。**回复微信的内容不需要加密** |
| 4. 幂等 | 官方：「同样的发货请求可能被请求多次，开发者需要自行保证只发货一次，且回包要和第一次一样返回成功」。重试周期 15s/15s/30s/3m/10m/20m/30m/... |
| 5. 必须有按钮开启 | 「**必须要开启道具发货推送**才能收到回调请求」 |

### ⚠️ 一处必须核实的地方（我把它做成了可切换）

`pay_sig`（查订单用）和 `PayEventSig`（发货推送用）的算法都指向同一份
**《支付请求签名算法说明》**，而它放在**腾讯文档里、需要权限才能打开**，不在微信文档站内。
所以"拼接串里放接口英文名、路径、还是事件名"这一条**无法从公开文档确认**。

能确定的只有 `wx.requestMidasPaymentGameItem` 文档里给的例子：
```
paySig = to_hex(hmac_sha256(appKey, 'requestMidasPaymentGameItem' + '&' + signData))
```
注意它用的是**接口英文名**，不是 URL 路径。所以默认按同一口径实现，
并把模式做成配置项 `MIDAS_SIG_MODE`（`english_name` | `path` | `path_no_slash` | `body_only`）。

**接入真实支付时的自查**：如果查订单返回 `90011`（pay_sig 签名错误），换一个模式再试；
`90010` 则是 `signature`（用户登录态签名）错了，那个算法是确定的
（`hmac_sha256(session_key, 请求体原文)`）。

### 以后可能用得上的服务端接口

| 接口 | 用途 | 什么时候用 |
| --- | --- | --- |
| `storage.setUserStorage` | 服务端写托管数据 | 排行榜（配合开放数据域） |
| `analysis.getGameAnalysisData` | 拉小游戏分析数据 | 想看 DAU/留存，但建议落库再分析（官方建议 6 小时采一次） |
| `getwxacodeunlimit` | 不限量小程序码 | 拉新/地推 |
| `subscribeMessage.send` | 发送订阅消息 | 排行被超越提醒等（⚠️ 别滥用，规范 5.21） |
| `getUserRiskRank` | 用户安全等级 | 反作弊 |
| `media_check_async` / `media_check_sync` | 图片/音频内容安全 | 有图片 UGC 时 |
| `pay_v2.getBalance` / `pay` / `cancelPay` / `present` | 游戏币账户 | ⚠️ **我们用道具直购，不需要游戏币**。官方明确说游戏币模式做道具直购会有到账延迟、前端回调丢失、zone_id 当道具 id 导致分区上限等问题，建议直接上道具直购 |
| `gameMatch.*` / `lockStep.*` | 对局匹配 / 帧同步 | 做多人对战时才用 |
| `midasFriendPayment`（朋友的礼物） | 好友送礼 | 社交玩法 |

---

## 五、核对了但**故意不用**的

| API | 为什么不用 |
| --- | --- |
| `wx.reportUserBehaviorBranchAnalytics` | 埋点已用 `wx.reportEvent`，两个都上会重复 |
| `wx.reportScene` | 启动场景上报，我们启动场景很简单，用不上 |
| `wx.onOfficialComponentsInfoChange` 等官方组件 API | 没接官方组件 |
| `wx.setWindowSize` | 仅 PC，我们用固定比例 |
| `wx.requestPointerLock` / `wx.setCursor` | 鼠标样式，我们不是 PC 优先 |
| 虚拟支付全套（`requestMidasPayment*`） | **我们选 IAA（广告变现），明确不开虚拟支付**（开了要多一整套中宣部实名认证流程） |
| 蓝牙/传感器/相机/麦克风/位置全套 | 与玩法无关 |
| `wx.getUserInfo` | 不需要昵称头像（也少一堆隐私合规工作） |
