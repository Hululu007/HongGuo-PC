# Android 游客播放研究与桌面端差异

日期：2026-11-24。原始审查基准：HongGuo-PC `main`，提交
`000babe4aeaed918780c1a639aa0cf202772dc92`；实现工作分支：
`codex/android-guest-playback-study`。本文件区分源码观察、项目已有实测记录、
本分支代码验证和未能执行的设备实验；社区客户端代码不等于红果官方 Android
源码或官方行为保证。

## 结论摘要

- `OOIUa/hongguo-android` 是社区客户端，不是红果官方 Android App。其
  v0.7.34 代码说明一种匿名注册及官网公开播放回退实现，但不能证明官方 App
  在真实手机上的确切游客初始化报文。
- HongGuo-PC 已有匿名设备注册、当前 App 播放模型请求、空响应有界恢复和官网
  公开访客播放路径。问题不能概括成“缺少设备初始化”或“只差 Android UA”。
- 项目已有 6.28 记录说明：同一匿名身份和签名下，新 App 播放画像与 Medusa
  明文字段 21=312 必须同时使用，才在该轮真实请求中取得完整模型。该结果
  解释了那次桌面端空响应的可复现客户端差异，不证明 Android App 游客播放
  成功的完整原因，也不保证当前服务策略。
- 本轮环境没有 `adb`，未连接或操控官方 Android App。故本轮未完成用户要求的
  五部剧手机/电脑同网对照、手机游客初始化、安装包真实播放和长时媒体验收。
- 因缺少官方行为与授权证据，不新增 `AndroidGuestPlaybackProvider`，不新增
  设备字段、不调整画像、不复制参考实现。先改善现有路径的可观测性和用户
  错误说明；路径行为变更须由设备与媒体证据另行支持。
- 本分支已实施来源/取源/媒体读取/解码/首帧脱敏诊断、成功来源标识、折叠诊断
  详情和普通用户错误文案。用户要求将其作为 6.29 诊断版本发布以便本人实测；
  该发布请求不构成手机或安装包播放验收，也不表示已找到新的取源修复。

## 参考项目与许可证

审查仓库：[`OOIUa/hongguo-android`](https://github.com/OOIUa/hongguo-android)，
目标标签 `v0.7.34`，提交
`554ca185ccad864d041a3e0a8763e5a6373856e1`。该仓库当前 `main` 已到 v0.8.0；
本报告聚焦用户指定的 v0.7.34，不把后续版本变化误写成该版本行为。

参考项目根 `LICENSE` 为 GPLv3；`THIRD_PARTY_NOTICES.md` 将项目及相关协议、
媒体组件标为 GPL-3.0-only，并记录官网访客播放器来源及上游致谢。它是
GPL-3.0-only 社区客户端。HongGuo-PC 的 `package.json` 声明 GPL-3.0，且现有
红果协议文件保留 SPDX 与上游来源注释。本轮只研究公开架构和行为，没有复制、
移植或改写参考仓库代码，因此没有新增该仓库代码的分发。本项目声明的 GPLv3
与 GPL-3.0-only 在许可证文本层面相符；如后续复用代码，仍须保留版权、许可证、
NOTICE/来源信息，并遵守对应源码发布义务。许可证不授予剧集播放权，也不允许
绕过访问控制或内容保护。

## v0.7.34 观察

以下是社区客户端实现事实，不是红果官方 SDK 文档：

1. 游客 App 接口路径使用 `PlaybackDevice.fresh()` 注册匿名设备，读取服务端
   返回的 `device_id` / `install_id`，与账号 Cookie 分开。该实现包含每次首播
   注册、进程内复用和失败冷却。它在本地生成随机 `cdid`、`openudid`、
   `clientudid`，同时固定填写 Android 16 / Redmi 等设备画像。固定画像并非
   真实手机的正常注册证据，不符合本任务“不伪造设备身份”的改造依据，不能
   直接照搬。
2. 公开目录和详情可通过无账号接口读取；是否可播放需逐集判断，不能由剧名、
   HTTP 200 或设备注册推断。账号模块和匿名播放注册是不同路径。
3. `AppSource` 先执行 App 取源。只有符合其 guest-candidate 条件的空响应，
   且没有业务拒绝、无效/不完整模型等较强失败时，才进入官网公开访客回退；
   取消、拒绝和非候选错误不会无限切换。
4. v0.7.34 的 `PublicEpisodeSource` 独立使用不带 Cookie 的官网请求：读取
   当前 `/player/{series}/{vid}` 页后调用官网
   `/api/video/protected/fallback-play-info`。要求分集与剧集身份一致、
   `pcLoginRequired=false`、`pcAuthenticatedPlayback=false`，且分集位于
   `accessible_episode_cnt` 可访问范围；还会校验 SEO 身份、时长、CDN 域名及
   URL 时效。官网拒绝、登录要求、越过可访问集数、限流或不可用时停止。
   这是参考代码观察到的公开边界；某内容是否需账号，必须以该集当前官方响应
   为准。
5. v0.7.34 验证记录称 Android API 37 arm64 模拟器由 `DramaRepository.prepare`
   交给 Media3/ExoPlayer。访客回退测试把 App 原生网络与设备注册换成 fixture，
   官网页面和 CDN 才使用真实网络；因此它验证了“模拟 App 路径失败后使用官网
   访客播放”的实现，不是官方 App 实测。其记录包括三个公开样本首帧、连续播放
   超过 11 秒、seek 后新帧，以及一个官网拒绝的分集；不满足本项目五剧真机对照
   和 Windows 验收。
6. 官网访客路径面向公开 MP4/VOD 地址，访客条目不带 App 原生轨道的解密字段。
   原生轨道另有 CENC/解密实现，但不能把它当作公开访客路径，也不能据此增加
   CENC/DRM 绕过。该版本验证记录没有逐集报告 codec，因此不声称访客样本已实测
   H.264/HEVC；Range、容器和 codec 支持仍取决于实际响应与设备解码能力。
7. v0.8.0 与 v0.7.34 不同：后续版本增加注册后的激活检查及 `klink_egdi`
   流程。不能把它写成 v0.7.34 的游客初始化步骤，也不能据后续版本擅自移植。

关键源码与行号（均为 v0.7.34 tag 内路径）：

- `app/src/main/java/com/hongguo/api/service/PlaybackDevice.java:28-53,147-177,215-229,268-327,360-367`：
  匿名身份注册、进程内缓存/冷却、服务端 ID 解析和固定 Android 画像。
- `app/src/main/java/com/hongguo/api/service/AppSource.java:131-141,142-220,231-280,310-324`：
  App-first 路由、官网回退准入、模型失败类别及明确拒绝停止。
- `app/src/main/java/com/hongguo/api/service/PublicEpisodeSource.java:39-53,73-90,93-149,173-214`：
  无 Cookie 官网回退、访客许可字段、剧集/分集绑定、CDN/时效校验、取消与限流策略。
- `app/src/main/java/com/hongguo/api/service/Client.java:827-853` 和
  `app/src/main/java/com/hongguo/android/DramaRepository.kt:133-142`：
  分集详情与解析。`README.md:71-89,98-109` 区分匿名公开功能与登录后账号功能。
- `app/src/androidTest/java/com/hongguo/api/util/PublicGuestPlaybackTest.kt:36-105,109-174`
  和 `VALIDATION.md:1-13`：访客公开播放回退测试的 fixture、静音、首帧/续播/seek
  验收及其模拟器边界。
- `app/src/main/java/com/hongguo/android/VideoPlayer.kt:32-38,128-194`、
  `ProgressiveVideoDataSource.kt:21-45,58-112,124-146` 与
  `ProgressiveMedia.java:43-52,173-247,267-308,402-447`：ExoPlayer、
  MP4 DataSource、Range 和原生媒体读取。`Mp4Progressive.java:10-21,83-103,179-203`
  记载其 CENC/layout 限制；这是实现事实，不构成授权或可复用解密依据。
- `THIRD_PARTY_NOTICES.md:1-20,180-182`：GPL-3.0-only 及官网访客播放器来源。
  v0.8.0 相对 v0.7.34 增加 activation/`egdi` 路径，不能回填成 v0.7.34 行为。

参考项目逐版本证据入口：

- [v0.7.34 源码树](https://github.com/OOIUa/hongguo-android/tree/554ca185ccad864d041a3e0a8763e5a6373856e1)
- [v0.7.34 VALIDATION.md](https://github.com/OOIUa/hongguo-android/blob/554ca185ccad864d041a3e0a8763e5a6373856e1/VALIDATION.md)
- [v0.7.34 THIRD_PARTY_NOTICES.md](https://github.com/OOIUa/hongguo-android/blob/554ca185ccad864d041a3e0a8763e5a6373856e1/THIRD_PARTY_NOTICES.md)

## HongGuo-PC 当前流程

| 阶段 | 当前实现 | 与需求的差异 / 证据边界 |
| --- | --- | --- |
| 取源调度 | 自动画质为官网公开页 → `app-source` 匿名设备注册及 App 播放模型 → 一次旧 API；显式 720p/1080p 直接走 `app-source`。 | 已有统一入口 `hongguo.fetchPlayUrlSingle`，但不是“新 Android 官方 Provider”。自动与手动清晰度路径不同；重排会改变来源优先级，需先测。 |
| App 请求 | 6.28 使用 `version_code=74532`、`preload/v1`、`dr_scene=preload`、`device_level=2`、Medusa 字段 21=312；空响应才进入备用官方主机、`video_tab` 与有限恢复。 | 这些是桌面客户端请求画像/协议兼容代码，不代表运行官方 App 或获平台确认的真实设备注册。 |
| 匿名初始化 | `playback-device.js` 运行时生成 UUID/CDID 并向 `device_register` 请求 ID；请求结构仍固定填 Redmi/Android 16 等画像，且包含 `guest_mode=0`。 | 有服务端注册步骤，但不能据此称其等同官方 App 游客模式。不要增加伪造参数或宣称游客初始化已验证。 |
| 官网访客 | 解析当前官网播放器页内嵌数据，要求剧集/分集匹配、`publicVideoSeo.available=true`、公开媒体 URL；`protectedPlayback=true` 明确拒绝。 | 已有合法公开回退，不读取任意网页中的推荐地址。它与参考项目使用的官网回退 API 形式不同。 |
| 媒体读取与播放 | 主进程代理支持 Range；HLS 转封装；明文/加密来源分别处理；当前画面交 Chromium `<video>`。FFmpeg/ffprobe 用于检查或兼容转换。 | 地址可读不等于解码、首帧或连续观看成功；Chromium Windows HEVC 能力受系统 codec/驱动影响。CENC 现有处理不在本任务扩展。 |
| 状态与诊断 | 有取消、缓存、超时、拒绝停止、最多三轮媒体恢复、自动兼容模式和首帧切换保护。 | 原始 `main` 的在线 IPC 未把实际来源回传 UI，空响应提示猜测签名/鉴权。本分支已回传白名单来源与阶段字段；UI 在播放器中显示来源，失败时折叠展示脱敏路线；收到媒体数据、`loadeddata` 与 `requestVideoFrameCallback` 后分别更新媒体读取、解码、首帧状态。浏览器事件不能证明整集已读或连续观看成功。 |

## 手机/桌面对照状态

本轮执行只读源码和既有证据核对。`adb` 命令在本机不可用，当前也没有可验证的
Android 设备会话，因此没有启动、登录或操控任何手机应用，没有采集账号或认证
数据，也没有进行同网五剧实验。

项目现有 [6.28 发行记录](release-6.28.md)记载 4 部真实红果分集使用当前 App
取源代码获得地址：其中两集完成解密后的前 90 帧和整集静音解码；另外两集记录
了 MP4/HEVC/AAC 信息或 ffprobe 结果。这不是本轮新测，也不是手机与桌面对照；
该记录也明确未做 Windows 安装包 GUI 长时播放、画中画、连播和看完自动删除
验收。[2026-11-20 来源稳定性记录](source-stability-2026-11-20.md)中的红果
空响应/官网仅预览结果早于 6.28 画像修复，不能替代修复后的五剧测试。

## 本轮真实素材记录（仅静音解码）

- 来源：红果官网公开播放器页《闪婚老公大十岁》第 1 集，
  `https://hongguoduanju.com/player/7709512254240066584`；由
  `scripts/fixtures/hongguo-video.cjs` 从公开目录随机选择，并确认当前分集有
  官网公开标记后才下载。未记录 CDN 媒体地址、账号凭据、Cookie 或签名。
- 记录：剧集 ID `7709512254240066584`，分集 ID `7709514214733253656`，
  614,587 字节，SHA-256
  `3924859d90f62a88801a191b0458ee8c2e922b11f2fd7acb031afaa118195a33`；
  下载时间 `2026-11-24T14:00:21.781Z`。
- 步骤与结果：运行 `node scripts/check-download-quality-integration.cjs`；
  项目使用隔离临时目录下载真实素材，FFmpeg 解码时指定 `-an`，随后运行真实
  ffprobe、HLS 重封装与恢复回归；本次该组 27/27 通过。测试脚本在结束时删除本次
  创建的临时目录，未使用正式应用资料或下载目录。
- 限制：这是官网公开片段，可能仅为预览。结果只证明该素材可用于本机静音解码和
  转封装回归，不证明完整分集、手机游客播放、Windows 安装包播放、真实声音、
  连播、切集或清晰度切换。

`npm test` 全量运行时，项目的真实媒体质量检查又随机选择并下载了另一部官网公开片段：

- 《不熟又怎样》第 1 集；剧集 ID `7706100589712657470`，分集 ID
  `7706102488578935832`，公开播放器页
  `https://hongguoduanju.com/player/7706100589712657470`。
- `2026-11-24T14:19:25.814Z` 下载，580,520 字节，SHA-256
  `60e18523a977a12c0ebc914a2b0bc9f6f5efe2929c6a604e735fd3cbc29f1d7c`。
- 自动化记录明确说明这是可能仅为预览的官网片段，全程静音；用于真实解码器、
  HLS 重封装与媒体兼容回归，不代表整集游客播放或 Windows 安装包验收。

最终源码全量 `npm test` 再随机选择了《十八岁太奶奶驾到，重整家族荣耀第五部》第
1 集；剧集 ID `7701935931787316286`，分集 ID `7701937936731737112`，公开播放器页
`https://hongguoduanju.com/player/7701935931787316286`。下载于
`2026-11-24T14:27:03.478Z`，1,178,134 字节，SHA-256
`f08e8fc4edf7dac39d97973ca3f8c8499914e85de060f69c5c5cb2a363098c0e`。
自动化明确标记该素材可能只是预览、全程静音，用于真实解码器和 HLS 转封装回归，
不代表完整分集播放。

## Windows 安装器 smoke test（非播放验收）

Windows x64 候选工作流
[#45414777118](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45414777118)
在最终实现提交 `9559130` 上通过。它构建 NSIS 安装器，在隔离临时目录测试全新安装、应用
启动、同版本重装及真实 1.80.0 到 6.28.0 升级后的资料保留，并验证 GPL FFmpeg/x264
对应源码档案随安装器保留。它没有联网播放红果剧集、解码、首帧或连续观看。本报告
没有把该 smoke test 写成 Windows 播放验收，也没有把候选安装器作为 Release 发布。

因此当前可报告的原因仅限于已有桌面端证据：在 6.28 记录的同一匿名身份、
同一分集和同一签名对照中，只有新版播放画像与字段 21=312 同时使用时取得
完整模型。手机游客播放原因、各剧集账号授权范围及安装包端首帧/连续观看结果
仍未证实。

## 可实施改进与停止条件

本分支只采用不扩大媒体访问能力、不更改官方请求行为的改进，状态如下：

- **6.29 诊断版本范围**：普通用户提示使用有证据支持的分类；未经证实的空响应
  不显示“签名失败”或“设备鉴权异常”推断，兼容转码不展示 FFmpeg stderr。
- 在线取源、媒体读取、解码和首帧阶段记录脱敏状态及实际
  来源；未知状态码不跨 IPC。UI 不记录/展示 URL、query、签名、Cookie、设备 ID
  或内容密钥。
- 保持官网公开页的身份、公开访问和预览校验；不将取源/媒体字节/ffprobe 单项
  成功标为完整播放成功。
- 暂不创建 `AndroidGuestPlaybackProvider`，不改设备注册字段、UA、签名和 App
  请求顺序，不复用 v0.7.34 代码。若官方流程要求本机无法合法获得的设备证明、
  应用完整性凭据或账号授权，停止该路径并说明限制。

本分支离线回归覆盖脱敏、终端来源错误保留诊断、播放器媒体/解码/首帧状态推进和
安全文案；这些用例使用 fixture，不模拟或代替官方 Android App、真实 CDN 媒体或
Windows 安装包播放。

完成用户要求的五剧手机/电脑对照、完整游客初始化确认、Windows 安装包实际播放、
首帧/声音（静音验收）、连播、切集、清晰度和恢复验收，仍需连接可运行官方 App
的合法 Android 设备及 Windows 安装包实机环境。6.29 仅便于用户提供该实测反馈；
模型取得、媒体地址、媒体字节、媒体解码、首帧和连续观看分别记录，不可互相替代。
