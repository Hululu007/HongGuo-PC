# 开源竞品与相关技术对标

研究日期：2026-11-16（Asia/Shanghai）
研究数量：16 个开源项目。
研究方式：读取项目主页/README、仓库目录、可访问的核心源码文件或源码目录、许可证文件入口，并读取 `commits/HEAD.atom` 的最近提交。所有结论只采用可观察证据；本轮没有复制代码或引入第三方实现。

## 1. 证据边界

- 主要证据来自各项目 GitHub 仓库、原始 README、源码文件和提交 Atom：例如 yt-dlp 的 `yt_dlp/__init__.py`、aria2 的 `src/DownloadEngine.cc`、Jellyfin 的 `Jellyfin.Server/Program.cs`、mpv 的 `player/main.c`、VLC 的 `src/libvlc.c`、rclone 的 `fs/operations/operations.go`、Syncthing 的 `cmd/syncthing/main.go`、Sonarr/Radarr 的下载服务和 electron-builder 的 `packages/app-builder-lib/src/packager.ts`。
- 最近提交时间按 2026-11-16 抓取时观察到的仓库 HEAD Atom 记录填写；这反映仓库活动，不等同于“最近 Release 已发布”。
- GitHub 匿名 API 在本轮返回 403 rate limit，因此 Issues、PR、Release 资产和依赖告警没有统一 API 快照。报告对这部分标为“待人工复核”，没有把 README 宣称当作已验证运行结果。

## 2. 项目清单

| 项目 / 许可证 | 最近观察到的提交（UTC） | 读取的源码/目录证据 | 对 HongGuo-PC 的可借鉴点 | 采用决定 |
|---|---|---|---|---|
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) · Unlicense | `fcfd814` · 2026-11-15 · post-live stream 修复 | `README.md`、`yt_dlp/__init__.py`、下载器/提取器目录 | 提取器插件边界、来源变化时的快速修复、错误分类 | 借鉴“来源适配器 + 明确错误”思想，不移植代码 |
| [aria2](https://github.com/aria2/aria2) · GPL-2.0+ | `9e72735` · 2026-06-25 · 依赖更新合并 | `README.rst`、`src/DownloadEngine.cc` | 任务队列、并发、RPC 和断点续传的长期运行模型 | 保持现有队列；后续评估可观测队列指标 |
| [qBittorrent](https://github.com/qbittorrent/qBittorrent) · GPL-2.0+ | `015fc30` · 2026-11-15 · Qt 兼容修复 | `README.md`、仓库 `src/`、`COPYING` | 任务列表批量操作、状态过滤、长任务 UI | 已有下载管理可继续吸收批量筛选和可见失败原因 |
| [Motrix](https://github.com/agalwood/Motrix) · MIT | `c601dcf` · 2026-11-16 · 自定义访问密码 | `README.md`、`src/main/index.js`、`LICENSE` | 简洁下载器的信息密度、服务访问保护 | 只借鉴信息层级；不引入其 Electron 依赖链 |
| [Streamlink](https://github.com/streamlink/streamlink) · BSD-2-Clause | `5896d42` · 2026-11-14 · Python 文档依赖更新 | `README.md`、`src/`、`LICENSE` | 流媒体插件协议、来源降级和错误可读性 | 采用来源失败分类；不复制插件代码 |
| [Jellyfin](https://github.com/jellyfin/jellyfin) · GPL-2.0 | `2953ed6` · 2026-11-14 · 翻译更新 | `README.md`、`Jellyfin.Server/Program.cs`、服务器目录 | 媒体库元数据、扫描/刷新、服务与 UI 分层 | 采用“媒体身份与资料分离”原则，保留本地单机定位 |
| [mpv](https://github.com/mpv-player/mpv) · GPL-2.0 | `543a8c2` · 2026-11-15 · MinGW 依赖更新 | `README.md`、`player/main.c` | 播放器状态机、硬件/软件解码分层、脚本扩展 | 继续保持主进程媒体控制；不替换 Electron 播放链 |
| [VLC](https://github.com/videolan/vlc) · GPL-2.0+ | `493793a` · 2026-11-16 · MP4 demux 回退 | `README.md`、`src/libvlc.c` | 容错播放、输入/解码/输出分层 | 借鉴错误恢复和媒体能力提示 |
| [Kodi](https://github.com/xbmc/xbmc) · GPL-2.0+ | `a7f8f4a` · 2026-11-16 · DTS 修复合并 | `README.md`、`xbmc/` 目录、`LICENSE.md` | 观看记录、媒体扫描、插件生态 | 借鉴资料索引与观看状态；不引入 Kodi 插件模型 |
| [rclone](https://github.com/rclone/rclone) · MIT | `b0ef5f6` · 2026-11-12 · 关闭自动 remote usage 检查 | `README.md`、`fs/operations/operations.go` | 文件系统抽象、远端不可用时的错误与重试 | 借鉴 NAS/远端失败可诊断性；保留本地路径校验 |
| [Syncthing](https://github.com/syncthing/syncthing) · MPL-2.0 | `b0df103` · 2026-11-16 · 文档/翻译维护 | `README.md`、`cmd/syncthing/main.go`、`LICENSE` | 状态面板、冲突/恢复、可观测性和隐私边界 | 借鉴脱敏诊断和状态摘要；不引入同步协议 |
| [Sonarr](https://github.com/Sonarr/Sonarr) · GPL-3.0 | `c018578` · 2026-11-03 · 数据库迁移日志脱敏修复 | `README.md`、`src/NzbDrone.Core/Download/DownloadService.cs` | 自动追更、失败重试、日志不泄漏数据库密码 | 借鉴追更状态和日志脱敏；本项目继续使用红果身份规则 |
| [Radarr](https://github.com/Radarr/Radarr) · GPL-3.0 | `19edd43` · 2026-11-15 · 翻译更新 | `README.md`、`src/NzbDrone.Core/Download/DownloadService.cs` | 任务状态、可重复导入和媒体资料维护 | 借鉴任务状态可解释性；不复制服务端架构 |
| [Bazarr](https://github.com/morpheus65535/bazarr) · GPL-3.0 | `bfe4593` · 2026-10-11 · 外部调度调整 | `README.md`、`bazarr/app/app.py` | 辅助资料任务、失败项重试和独立调度 | 借鉴资料任务失败展示；不引入 GPL 代码 |
| [Prowlarr](https://github.com/Prowlarr/Prowlarr) · GPL-3.0 | `847d487` · 2026-11-15 · 翻译更新 | `README.md`、`src/`、`LICENSE` | 多索引来源管理、来源健康状态和统一配置 | 借鉴来源健康/启停状态；保持 HongGuo 现有来源契约 |
| [electron-builder](https://github.com/electron-userland/electron-builder) · MIT | `b5a4e64` · 2026-11-11 · 文档与 schema 修复 | `README.md`、`packages/app-builder-lib/src/packager.ts` | 构建目标、工件命名、更新元数据和平台分离 | 继续使用现有 electron-builder；修复只在本项目配置内完成 |

## 3. 维度对比

| 维度 | 领先项目的可验证做法 | HongGuo-PC 现状 | 差距与取舍 |
|---|---|---|---|
| 核心功能 | yt-dlp/Streamlink 的来源适配；Jellyfin/Kodi 的媒体资料索引；Sonarr/Radarr 的追更 | 红果取源、多个来源、下载/播放/NAS/追更已经形成闭环 | HongGuo 的优势是针对红果短剧的完整单机闭环；继续加强来源失败分类和更新资料 |
| UX/UI | Motrix、qBittorrent 的队列状态密度；Jellyfin/Kodi 的媒体库层级 | Cyber HUD 桌面布局、发现/下载/播放器分区、设置搜索和批量操作 | 仍可加强错误聚合、任务筛选和诊断入口；避免照搬 Web 媒体库的复杂层级 |
| 播放稳定性 | mpv/VLC 的解码回退和错误提示 | HLS 缓存、兼容转码、清晰度有界尝试、切集首帧保护 | 需要更多真实机器/编码器数据；不能仅凭单元测试宣称兼容所有编码 |
| 架构 | aria2/rclone 的任务/文件系统抽象；Jellyfin 的服务层 | 主进程仍集中在 `main.js`，但 IPC 与 native 模块已有边界 | 适合小步拆分，不能为追求“架构像竞品”而改写数据格式 |
| 性能 | qBittorrent/aria2 的并发队列；Syncthing 的后台状态模型 | 并发下载、队列、缓存和退避已存在 | 缺少稳定的启动/内存/长任务基准；列为 P2 |
| 安全 | Sonarr 日志脱敏修复；Syncthing 的隐私边界；electron-builder 的固定工件流程 | IPC 信任、CSP、代理密码安全存储、更新源固定、路径校验 | 新增诊断报告进一步省略密码、媒体地址和本地路径；代码签名仍待发布环境 |
| 稳定性 | Sonarr/Radarr 的失败状态、重试与迁移检查；VLC/mpv 的输入容错 | 下载失败分类、自动/手动重试、存储回滚、更新安装阻塞 | 可继续增加可视化诊断和长任务恢复证据 |
| 工程生态 | electron-builder 的跨平台工件；各项目的 CI/贡献指南 | Windows x64 CI 候选、`latest.yml` 校验、真实媒体检查 | 匿名 GitHub API 限流阻碍本轮统一抓取 Issues/PR；发布仍需签名和干净机 |

## 4. 许可证与移植决策

- 本轮没有复制代码，也没有新增竞品依赖。
- GPL/AGPL 项目只作为行为和架构参考；不把其源码片段或派生实现直接放入本项目。
- MIT/BSD/Unlicense 项目的许可证并不自动解决 API、商标、媒体内容和维护成本问题；若未来引入代码，必须单独保留版权和 NOTICE，并通过依赖审查。
- electron-builder、现有 FFmpeg/x264 许可和项目 GPL-3.0 之间的边界继续由 `NOTICE`、`THIRD-PARTY-NOTICES.md` 和发行目录维护。

## 5. 最值得借鉴的结论

1. **来源适配器**：把每个来源的响应/访问失败映射为稳定的错误类别，减少 UI 只显示“失败”。
2. **任务可解释性**：任务列表同时展示状态、下一次重试、质量降级和目标路径冲突原因。
3. **媒体资料分离**：视频身份、剧集资料和观看进度分开存储，避免资料刷新覆盖用户进度。
4. **诊断脱敏**：导出能帮助维护者定位环境问题的摘要，但不包含密码、签名 URL 或绝对路径。
5. **发行证据链**：候选构建、`latest.yml`、安装器、提交 SHA 和真实安装回归必须分开记录。

以上结论已进入 `UPGRADE_ROADMAP.md`；只有本轮实际改动的诊断导出和更新资产识别标记为完成，其余保持规划状态。

## 2026-11-18 增补调研

本轮对照 40 个项目。39 个项目取得公开仓库、最近提交、源码树、许可、Issue 与正式发行元数据，另 1 个只能核对公开发布页。直接对照集中在红果短剧桌面、移动和 TV 客户端，邻近项目覆盖通用下载、播放、媒体库和工程。Gitee、GitLab 和社区线索用于补充发现。对功能、分发和许可的判断采用仓库源码、README 及官方技术文档。

在 GitHub 记录 Star/Fork 快照、30/90/180 天默认分支提交计数、稳定发行与当前提交的源码路径。Issue 链接为当次开放讨论样本，计数和样本不代表社区高频需求。项目声明的功能和支持范围以各自文档为准。许可证列为 GitHub 的 SPDX 检测，`NOASSERTION` 需按上游许可文本复核。采用决策均为设计参考，未引入第三方实现或素材。

| 项目 | 关系 | Star / Fork | 许可 | 近 30/90/180 天提交 | 稳定发行 | 源码与可吸收点 | Issue 样本 |
|---|---|---:|---|---:|---|---|---|
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | 引擎 | 208,828 / 18,425 | Unlicense | 37/71/224 | [2026.10.26](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26) | [yt_dlp/downloader](https://github.com/yt-dlp/yt-dlp/tree/2d596f4882a2d6e6414836bccd9fd3fb1e1534a2/yt_dlp/downloader)。来源按提取器与下载器分工，补稳定错误类别和协议测试 | [公开样本](https://github.com/yt-dlp/yt-dlp/issues/6539) |
| [agalwood/Motrix](https://github.com/agalwood/Motrix) | 邻近 | 58,489 / 5,163 | NOASSERTION | 84/346/400 | [v2.4.3](https://github.com/agalwood/Motrix/releases/tag/v2.4.3) | [src](https://github.com/agalwood/Motrix/tree/6ca7b0deb40f48d9edd70e57e56019e8dc3aaafd/src)。桌面任务紧凑布局，把重试与进度集中在任务行 | [公开样本](https://github.com/agalwood/Motrix/issues/2111) |
| [aria2/aria2](https://github.com/aria2/aria2) | 引擎 | 43,552 / 3,962 | GPL-2.0 | 0/0/2 | [release-1.37.0](https://github.com/aria2/aria2/releases/tag/release-1.37.0) | [src](https://github.com/aria2/aria2/tree/9e7273583f83e881e3ec067b523ba88724088d2f/src)。队列、断点能力与 RPC 边界可指导下载状态拆分 | [公开样本](https://github.com/aria2/aria2/issues/153) |
| [qbittorrent/qBittorrent](https://github.com/qbittorrent/qBittorrent) | 邻近 | 41,717 / 4,994 | NOASSERTION | 59/140/312 | [release-5.3.0](https://github.com/qbittorrent/qBittorrent/releases/tag/release-5.3.0) | [src](https://github.com/qbittorrent/qBittorrent/tree/d9aae7f7a4f696274e03c735e2c5869da1ea0bf7/src)。筛选、状态列与批量任务组合，参考下载视图密度 | [公开样本](https://github.com/qbittorrent/qBittorrent/issues/12616) |
| [streamlink/streamlink](https://github.com/streamlink/streamlink) | 引擎 | 11,954 / 1,213 | BSD-2-Clause | 41/160/279 | [8.6.3](https://github.com/streamlink/streamlink/releases/tag/8.6.3) | [src/streamlink](https://github.com/streamlink/streamlink/tree/5896d42b0066295d6305c39df0d36f9feb27e483/src/streamlink)。流插件与传输分层，来源故障可按层定位 | [公开样本](https://github.com/streamlink/streamlink/issues/6075) |
| [jellyfin/jellyfin](https://github.com/jellyfin/jellyfin) | 邻近 | 59,493 / 5,829 | GPL-2.0 | 57/426/1222 | [v12.4](https://github.com/jellyfin/jellyfin/releases/tag/v12.4) | [Jellyfin.Api](https://github.com/jellyfin/jellyfin/tree/07bcec2e1f4e835bc3a667c856dd444ec46b4611/Jellyfin.Api)。元数据和观看状态分开，服务化需要独立部署 | [公开样本](https://github.com/jellyfin/jellyfin/issues/15101) |
| [mpv-player/mpv](https://github.com/mpv-player/mpv) | 引擎 | 38,179 / 3,673 | NOASSERTION | 329/625/866 | [v0.42.0](https://github.com/mpv-player/mpv/releases/tag/v0.42.0) | [video](https://github.com/mpv-player/mpv/tree/f92afa75cdb06e077a9ecd9a9ec2eb36b16327c2/video)。解码和视频输出拆分，补真实设备兼容矩阵 | [公开样本](https://github.com/mpv-player/mpv/issues/8705) |
| [videolan/vlc](https://github.com/videolan/vlc) | 邻近 | 20,500 / 6,453 | GPL-2.0 | 376/1194/2646 | 未取到稳定版 | [modules](https://github.com/videolan/vlc/tree/c48b46e97f99abbbca622110684da65ab2a22688/modules)。读取输入、解复用和输出能力，参考解码失败提示 | — |
| [xbmc/xbmc](https://github.com/xbmc/xbmc) | 邻近 | 21,508 / 6,677 | NOASSERTION | 905/2314/3352 | [21.3-Omega](https://github.com/xbmc/xbmc/releases/tag/21.3-Omega) | [xbmc](https://github.com/xbmc/xbmc/tree/114d0f2df28e16281c95f5e9e6e9d4926ddcbea8/xbmc)。本地资料索引与多平台前端，移植成本大 | [公开样本](https://github.com/xbmc/xbmc/issues/23957) |
| [rclone/rclone](https://github.com/rclone/rclone) | 引擎 | 61,086 / 5,719 | MIT | 200/638/1047 | [v1.76.0](https://github.com/rclone/rclone/releases/tag/v1.76.0) | [backend](https://github.com/rclone/rclone/tree/a6779f3d79e0dfb71d08149f0ba35ba5568daab6/backend)。远端存储错误与后端模型，指导 NAS 状态和挂载恢复 | [公开样本](https://github.com/rclone/rclone/issues/87) |
| [syncthing/syncthing](https://github.com/syncthing/syncthing) | 引擎 | 90,557 / 5,609 | MPL-2.0 | 9/42/127 | [v2.1.7](https://github.com/syncthing/syncthing/releases/tag/v2.1.7) | [gui](https://github.com/syncthing/syncthing/tree/b0df1033fe2a788cd4f4e606dbb27199eefaf340/gui)。后台任务、状态和冲突反馈，参考脱敏诊断 | [公开样本](https://github.com/syncthing/syncthing/issues/3388) |
| [Sonarr/Sonarr](https://github.com/Sonarr/Sonarr) | 邻近 | 17,757 / 2,090 | GPL-3.0 | 135/369/507 | [v4.0.20.3014](https://github.com/Sonarr/Sonarr/releases/tag/v4.0.20.3014) | [src/NzbDrone.Core/Download](https://github.com/Sonarr/Sonarr/tree/51a2412af235197ce15d7d4a17c053a8e2c26609/src/NzbDrone.Core/Download)。任务历史与追更导入，参考幂等状态 | [公开样本](https://github.com/Sonarr/Sonarr/issues/314) |
| [Radarr/Radarr](https://github.com/Radarr/Radarr) | 邻近 | 14,813 / 1,264 | GPL-3.0 | 61/155/194 | [v7.0.3.10918](https://github.com/Radarr/Radarr/releases/tag/v7.0.3.10918) | [src/NzbDrone.Core/Download](https://github.com/Radarr/Radarr/tree/c482b3262e2aeedbd11d5491310060193ecd8967/src/NzbDrone.Core/Download)。下载与媒体入库分工，参考任务恢复 | [公开样本](https://github.com/Radarr/Radarr/issues/153) |
| [morpheus65535/bazarr](https://github.com/morpheus65535/bazarr) | 邻近 | 4,429 / 447 | GPL-3.0 | 0/76/270 | [v1.6.2](https://github.com/morpheus65535/bazarr/releases/tag/v1.6.2) | [bazarr](https://github.com/morpheus65535/bazarr/tree/bfe4593b04caa16eb4a09c2a233777b0bd7723b6/bazarr)。资料任务与队列分开，参考错误提示和重试边界 | [公开样本](https://github.com/morpheus65535/bazarr/issues/3557) |
| [Prowlarr/Prowlarr](https://github.com/Prowlarr/Prowlarr) | 邻近 | 7,613 / 435 | GPL-3.0 | 42/83/135 | [v3.0.2.5780](https://github.com/Prowlarr/Prowlarr/releases/tag/v3.0.2.5780) | [src](https://github.com/Prowlarr/Prowlarr/tree/c7926e55033470e584434ffbb872bdbe05a4e56c/src)。索引来源统一设置，参考来源健康状态 | [公开样本](https://github.com/Prowlarr/Prowlarr/issues/2635) |
| [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | 工程 | 14,720 / 1,902 | MIT | 191/341/549 | [electron-updater@6.8.12](https://github.com/electron-userland/electron-builder/releases/tag/electron-updater%406.8.12) | [packages/electron-updater](https://github.com/electron-userland/electron-builder/tree/cecf43a601fe4a3c769398fdc7bc278c57292515/packages/electron-updater)。复用现有 GitHub/NSIS 更新和用户确认，校验工件与实际测试字节绑定 | [公开样本](https://github.com/electron-userland/electron-builder/issues/9665) |
| [jely2002/youtube-dl-gui](https://github.com/jely2002/youtube-dl-gui) | 邻近 | 9,733 / 697 | AGPL-3.0 | 0/0/42 | [app-v3.2.1](https://github.com/jely2002/youtube-dl-gui/releases/tag/app-v3.2.1) | [src-tauri](https://github.com/jely2002/youtube-dl-gui/tree/c402ee39c0eabab68934c48f8b787ff37a1577b0/src-tauri)。跨桌面 Tauri 文件能力和外部工具引导，参考轻量队列 | [公开样本](https://github.com/jely2002/youtube-dl-gui/issues/717) |
| [Tyrrrz/YoutubeDownloader](https://github.com/Tyrrrz/YoutubeDownloader) | 邻近 | 16,755 / 2,113 | MIT | 19/30/46 | [1.17.1](https://github.com/Tyrrrz/YoutubeDownloader/releases/tag/1.17.1) | [YoutubeDownloader.Core](https://github.com/Tyrrrz/YoutubeDownloader/tree/a419ef2be70392e57d31bd5103f1d6d0d20b3919/YoutubeDownloader.Core)。共享核心与桌面外壳分开，参考批次与结果提示 | [公开样本](https://github.com/Tyrrrz/YoutubeDownloader/issues/550) |
| [mhogomchungu/media-downloader](https://github.com/mhogomchungu/media-downloader) | 邻近 | 5,134 / 345 | GPL-2.0 | 27/121/173 | [5.6.8](https://github.com/mhogomchungu/media-downloader/releases/tag/5.6.8) | [extensions](https://github.com/mhogomchungu/media-downloader/tree/5b3fac0dfd6af3e70efc8155a40d2d1dafe608f3/extensions)。桌面核心和引擎扩展解耦，参考来源契约 | [公开样本](https://github.com/mhogomchungu/media-downloader/issues/700) |
| [xiaoyaocz/dart_simple_live](https://github.com/xiaoyaocz/dart_simple_live) | 邻近 | 16,247 / 3,225 | GPL-3.0 | 0/0/0 | 未取到稳定版 | [simple_live_core](https://github.com/xiaoyaocz/dart_simple_live/tree/ba828e6783b176ea5709fcd09f0eb01dfaceeb51/simple_live_core)。移动、TV、CLI 独立入口与共享服务，评估真实平台产品成本 | — |
| [iina/iina](https://github.com/iina/iina) | 邻近 | 47,157 / 2,995 | GPL-3.0 | 58/183/375 | [v1.5.1](https://github.com/iina/iina/releases/tag/v1.5.1) | [iina](https://github.com/iina/iina/tree/171334e137357285de63128ce5322a9b9b0f9e75/iina)。macOS 原生菜单、文件和交互，支撑原生维护成本判断 | [公开样本](https://github.com/iina/iina/issues/63) |
| [electron/electron](https://github.com/electron/electron) | 工程 | 123,971 / 17,954 | MIT | 196/719/1034 | [v45.3.4](https://github.com/electron/electron/releases/tag/v45.3.4) | [docs](https://github.com/electron/electron/tree/5f06911480000de0224bbc5b37d28cfed2ecfc39/docs)。窗口、进程隔离与发行说明，沿用既有 Electron 契约 | [公开样本](https://github.com/electron/electron/issues/673) |
| [videojs/video.js](https://github.com/videojs/video.js) | 引擎 | 40,216 / 7,502 | NOASSERTION | 117/638/951 | [video.js@10.5.0](https://github.com/videojs/video.js/releases/tag/video.js%4010.5.0) | [packages](https://github.com/videojs/video.js/tree/e9da7b8af6a5e2c7e6fdb62761a283d9d3477a09/packages)。Web 控件、键盘及可访问性，参考播放器回归 | [公开样本](https://github.com/videojs/video.js/issues/7887) |
| [shaka-project/shaka-player](https://github.com/shaka-project/shaka-player) | 引擎 | 8,283 / 1,628 | Apache-2.0 | 166/341/534 | [v5.3.5](https://github.com/shaka-project/shaka-player/releases/tag/v5.3.5) | [lib](https://github.com/shaka-project/shaka-player/tree/8ee7915bb6e182c5a19eb1a02b16cfc6a9cb4f21/lib)。分段媒体状态与错误处理，评估 Web 播放范围 | [公开样本](https://github.com/shaka-project/shaka-player/issues/1330) |
| [video-dev/hls.js](https://github.com/video-dev/hls.js) | 引擎 | 17,061 / 2,783 | NOASSERTION | 61/148/293 | [v1.7.4](https://github.com/video-dev/hls.js/releases/tag/v1.7.4) | [src](https://github.com/video-dev/hls.js/tree/c4637e53bbd4d1d0838d5b1e954ab1fc7af355bb/src)。HLS 缓冲及错误状态有界恢复，参考状态和诊断 | [公开样本](https://github.com/video-dev/hls.js/issues/6482) |
| [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | 引擎 | 17,970 / 1,127 | MIT | 0/0/0 | [v12.15](https://github.com/ffmpegwasm/ffmpeg.wasm/releases/tag/v12.15) | [packages](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/f876f907c7e9b9bf51d4ed0b913a855a63ae63fc/packages)。浏览器可做部分离线封装，空间和运行生命周期需验证 | [公开样本](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/61) |
| [puemos/hls-downloader](https://github.com/puemos/hls-downloader) | 邻近 | 2,770 / 309 | MIT | 15/20/27 | [v5.6.0](https://github.com/puemos/hls-downloader/releases/tag/v5.6.0) | [src](https://github.com/puemos/hls-downloader/tree/21ba8008a545843b9b34ff709614133873dc59a7/src)。浏览器下载以页面媒体为入口，需独立权限与缓存管理 | [公开样本](https://github.com/puemos/hls-downloader/issues/23) |
| [axel-download-accelerator/axel](https://github.com/axel-download-accelerator/axel) | 引擎 | 3,431 / 310 | GPL-2.0 | 0/7/38 | [v2.17.14](https://github.com/axel-download-accelerator/axel/releases/tag/v2.17.14) | [src](https://github.com/axel-download-accelerator/axel/tree/dc10ba0c8f8d804c1568df5dba3cdd6fa89572b1/src)。多连接传输，参考吞吐指标和限流 | [公开样本](https://github.com/axel-download-accelerator/axel/issues/233) |
| [persepolisdm/persepolis](https://github.com/persepolisdm/persepolis) | 邻近 | 7,500 / 712 | GPL-3.0 | 0/0/0 | [5.2.0](https://github.com/persepolisdm/persepolis/releases/tag/5.2.0) | [persepolis](https://github.com/persepolisdm/persepolis/tree/109e95261fa2827bf7bf1b24173328d90235a53e/persepolis)。跨桌面排队与调度，参考速度、状态和用户反馈 | [公开样本](https://github.com/persepolisdm/persepolis/issues/703) |
| [JunkFood02/Seal](https://github.com/JunkFood02/Seal) | 邻近 | 30,786 / 1,572 | GPL-3.0 | 0/2/5 | [v1.13.1](https://github.com/JunkFood02/Seal/releases/tag/v1.13.1) | [app](https://github.com/JunkFood02/Seal/tree/7677f61a20fda4210e84215fef9e9b51d25daa47/app)。Android 以分享菜单与后台下载为主，不能复刻现有三栏桌面 | [公开样本](https://github.com/JunkFood02/Seal/issues/1161) |
| [TeamNewPipe/NewPipe](https://github.com/TeamNewPipe/NewPipe) | 邻近 | 40,796 / 4,004 | GPL-3.0 | 80/166/292 | [v0.29.3](https://github.com/TeamNewPipe/NewPipe/releases/tag/v0.29.3) | [app](https://github.com/TeamNewPipe/NewPipe/tree/853917509100416d2179b9eb1f438436479afed4/app)。移动播放、下载路径及队列独立设计，参考大屏与离线任务 | [公开样本](https://github.com/TeamNewPipe/NewPipe/issues/539) |
| [jackotom/hongguo-drama](https://github.com/jackotom/hongguo-drama) | 上游 | 2,200 / 357 | GPL-3.0 | 238/303/303 | [v7.6](https://github.com/jackotom/hongguo-drama/releases/tag/v7.6) | [src](https://github.com/jackotom/hongguo-drama/tree/c33ab40743583222c9ff6bc3fa6a50f1da5b2b06/src)。同类产品保留三端和 Android 代码，比较桌面功能与共享边界 | [公开样本](https://github.com/jackotom/hongguo-drama/issues/170) |
| [aemeath01/hongguo-desktop](https://github.com/aemeath01/hongguo-desktop) | 直接 | 5 / 2 | MIT | 0/4/4 | [v0.1.10](https://github.com/aemeath01/hongguo-desktop/releases/tag/v0.1.10) | [src-tauri](https://github.com/aemeath01/hongguo-desktop/tree/40552a03af08e942d336554a9b8bf2153a8d7e64/src-tauri)。播放器和下载导航可更少跳转，参考 Windows 分发 | [公开样本](https://github.com/aemeath01/hongguo-desktop/issues/4) |
| [yangbin1322/hongguo-player](https://github.com/yangbin1322/hongguo-player) | 直接 | 4,202 / 217 | 未识别 | 8/20/20 | [v1.2.29](https://github.com/yangbin1322/hongguo-player/releases/tag/v1.2.29) | [docs](https://github.com/yangbin1322/hongguo-player/tree/ceca0fb74838685a39ff7a7b3ba346036db807aa/docs)。公开交互及 GitHub 自动更新；源码证据有限，仅对比文档 | [公开样本](https://github.com/yangbin1322/hongguo-player/issues/248) |
| [zfdang/hongguo-open-player](https://github.com/zfdang/hongguo-open-player) | 直接 | 300 / 43 | AGPL-3.0 | 161/161/161 | [v1.12.3](https://github.com/zfdang/hongguo-open-player/releases/tag/v1.12.3) | [src](https://github.com/zfdang/hongguo-open-player/tree/f57df9c0d980c272714d270bd7065d55fd197de1/src)。剧集、相邻季与播放队列导航，参考快捷切季 | [公开样本](https://github.com/zfdang/hongguo-open-player/issues/105) |
| [a312354805/hongguo-desktop](https://github.com/a312354805/hongguo-desktop) | 直接 | 26 / 3 | GPL-3.0 | 17/17/17 | [v1.1.45](https://github.com/a312354805/hongguo-desktop/releases/tag/v1.1.45) | [tv-redesign](https://github.com/a312354805/hongguo-desktop/tree/dfad8e72645296dc5272a9ba7ba069676b6bf9d7/tv-redesign)。遥控器焦点、电视观看和触控分开适配 | — |
| [bainano/HongGuo-PC](https://github.com/bainano/HongGuo-PC/releases) | 直接 | — | 未核实 | — | 发布页 | 公开渠道文档用于比较 ARM64 分发。仓库 API 当次未返回，保留证据链接 | — |
| [Xanerix/guoapp](https://github.com/Xanerix/guoapp) | 直接 | 1,950 / 275 | GPL-3.0 | 335/418/418 | [app-v2.0.1-113](https://github.com/Xanerix/guoapp/releases/tag/app-v2.0.1-113) | [lib](https://github.com/Xanerix/guoapp/tree/3b16654c1e1a124c408498c75611cf25811f2857/lib)。Flutter 跨端与分离原生目录，说明需要移动权限和交互矩阵 | [公开样本](https://github.com/Xanerix/guoapp/issues/176) |
| [lhljpt-web/hongguo-manju-desktop](https://github.com/lhljpt-web/hongguo-manju-desktop) | 直接 | 16 / 4 | GPL-3.0 | 30/38/38 | [v0.1.6](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.1.6) | [src](https://github.com/lhljpt-web/hongguo-manju-desktop/tree/33fe48286d1af9c1b15c88186794503089217d68/src)。聚焦漫剧、连播和缓存，比较桌面播放信息密度 | [公开样本](https://github.com/lhljpt-web/hongguo-manju-desktop/issues/1) |
| [dddmiku/hongguo-desktop-releases](https://github.com/dddmiku/hongguo-desktop-releases) | 直接 | 42 / 4 | 未识别 | 7/52/52 | [v1.9.15](https://github.com/dddmiku/hongguo-desktop-releases/releases/tag/v1.9.15) | [docs](https://github.com/dddmiku/hongguo-desktop-releases/tree/cac07b3ad54b105076577f9ed089a7ada9cfadd7/docs)。历史产品迁移公告，参考不同终端的发布渠道告知 | [公开样本](https://github.com/dddmiku/hongguo-desktop-releases/issues/4) |

### 产品差距与实施决定

| 维度 | 研究对象及启发 | HongGuo-PC 与本轮决定 |
|---|---|---|
| 发行完整性 | electron-builder 将清单与实际安装包绑定。GitHub 不可变发行锁定资产并提供发行证明 | 实施。将候选安装回执中的 EXE SHA-256、`latest.yml` 的 SHA-512、GitHub 草稿摘要、发布后下载入口串起来。保留客户端兼容的两段标签和两项资产 |
| 更新交互 | 红果桌面同类客户端将更新入口置于窗口可达位置；Motrix 和 Persepolis 以任务进度和速率作为反馈 | 实施。保留原软件更新窗，新增当前版本、速率和带有跨重启期限的稍后提醒 |
| 桌面播放 | IINA 重视系统级交互；mpv/VLC 将解码能力明确放在播放链上；红果系客户端普遍提供续播、选集和相邻季导航 | 已有倍速、断点、快捷键、窗口、选集和画中画。本轮验证主界面；后续用 GPU 和真实媒体矩阵扩展兼容性证据 |
| 下载队列 | aria2 和 qBittorrent 能显示可恢复性、失败态与批量操作；Jellyfin 的媒体资料与观看状态独立 | 已有任务落盘、按剧操作与观看记录。将磁盘预检、来源错误分类和备份恢复保留在 A/B 类待办，依赖兼容基线与数据恢复测试 |
| 移动与 TV | Flutter 同类项目拥有独立原生目录。Seal、NewPipe 和 TV 客户端分别使用系统分享、触控与遥控器焦点 | 独立迁移的主要成本在授权、权限、真实设备和更新分发。归 C/D，后续根据明确需求重评 |
| Web 与 NAS | HLS 插件和 ffmpeg.wasm 能在浏览器实现有限下载。rclone、Jellyfin 分别证明存储抽象和服务模型有各自的权限边界 | 保留现有本地单机与已挂载 NAS 交付。另建服务或浏览器宿主的成本与功能缺口见平台评估 |

依赖演进关注 Electron 45 和 electron-updater 6.8.12 的上游发行，以及 Vite 构建工具传递依赖的漏洞修复。升级需要独立确认 Windows 最低版本、安装链、真实媒体和回滚条件。项目逐项决定见 [升级路线图](UPGRADE_ROADMAP.md)，平台决策见 [支持范围](docs/platform-assessment.md)。竞品快照每月复查，大版本前再对重点仓库做源码和 UX 深查。

参考 [Electron 上游](https://github.com/electron/electron/releases)、[electron-builder 上游](https://github.com/electron-userland/electron-builder/releases)、[GitHub 不可变发行](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)。
