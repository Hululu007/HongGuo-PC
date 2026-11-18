# 红果短剧 6.15

2026-11-18 18:20（北京时间）正式发布。内部版本 `6.15.0`，标签 `v6.15`，冻结提交 `51cbbce57512ace9cd76abad2edf399e8ab3d87c`。[GitHub Release v6.15](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.15)

## 本轮变更

- 修复红果 App 播放模型接口切换后返回空响应的问题，使用当前 `player/v1` V5 gzip 请求和签名头。
- 兼容按 `1004` 视频平台和分集编号组织的播放模型响应，并保留一次有界旧接口回退。
- 播放设备注册支持取消传播；每次播放的请求正文、设备身份和回退尝试相互隔离。

## 本地验证

- `npm test` 通过，284 个单元测试和 104 项平台检查通过。FFmpeg/ffprobe 从本机已安装应用目录通过进程级 PATH 提供。
- `npm run build:react` 从与冻结提交一致的隔离源码副本执行通过。
- `node scripts/check-release-version.cjs` 通过 2,916 组版本比较及版本门禁。
- `node scripts/diagnose-playback.cjs 7706404415887903806` 返回 `sourceAvailable: true`、`code: OK`。网页接口仅返回预览，单独复核确认完整 HEVC 片源来自 App 接口。

## 真实素材播放验收

- 从红果 App 真人剧目录返回的 15 部剧中随机选取《嫌疑人的秘密2藏金生死线》（剧号 `7706404415887903806`）的第 1、2 集。
- 从冻结源码构建界面，用独立 Electron 用户资料和下载目录启动，开启进程静音。播放前将播放器设为静音、音量 0，停用测试实例的看完自动删除。每次播放约 10 秒后暂停并记录进度和画面帧数。
- 第 1 集先在线播放 10.08 秒，计数增加 256 帧，分辨率 1080×1920。
- 两集均通过 App 下载管理实际下载至隔离目录。`ffprobe` 确认均为 HEVC/AAC。第 1 集 20,107,792 字节，时长 151.93 秒。第 2 集 10,200,490 字节，时长 97.41 秒。
- 在 App 内播放已下载的第 2 集和第 1 集，分别持续 10.00 秒和 10.04 秒，画面帧计数分别增加 250 帧和 251 帧，分辨率均为 1080×1920。播放和暂停后均保持静音。

## 限制

- 本轮桌面实测覆盖短时在线播放、下载和本地播放。画中画、自动连播、自动删除、长时播放及从 6.14 发起的真实应用内更新未测。
- 本机正式安装继续使用原版本。工作区原有的 `build/*` 删除和 `promo/` 未跟踪目录未纳入发行提交。

## 发行范围

- Windows x64 NSIS 安装包与 `latest.yml`；安装包未做代码签名。
- 安装 EXE `hongguo-downloader-6.15-win-x64-setup.exe`，146,487,990 字节，SHA-256 `8436e336f0e0fb73b79682136b136789d126bd2c82cde9fd191428d7148fe826`。
- `latest.yml`，380 字节，SHA-256 `17d2f0e57459753bb44e1d8797d9ee22ff3737dffb9bb51efff37061e3c3d8c4`。
- 公开 `latest.yml` 中安装包的版本为 `6.15.0`，SHA-512（Base64）为 `3h1uhPvC4esWFSSJECdSJGsmHB0p8YnjOD9jlWd4ZulY9rRWKHG0np9wY1r6Wcq27Y9B0t+5+NGL7rfGsdULrQ==`。

## CI 与公开回执

- 源码和标签的 `npm test` 均通过。[源码 Test](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44281541221) · [标签 Test](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44281541694)
- Windows x64 候选通过源码和媒体工具检查、安装、重装、1.80 安装器升级。升级后保留设置、观看记录、本地存储和现有下载，包内 FFmpeg/x264 对应源码与内置二进制匹配。[Windows x64 候选](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44281546786)
- 发布工作流校验同一冻结提交、候选与安装包大小及 SHA-512 后公开 Release。GitHub 最新正式发布接口返回 `v6.15` 和上述两项资产。[发布流程](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44284289656)
