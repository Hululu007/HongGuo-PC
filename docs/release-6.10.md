# 红果短剧 6.10

状态：已正式发布（内部版本 `6.10.0`，标签 `v6.10`）。本轮修复 GitHub Issue #4「红果播放源一直报错」。冻结提交 `e0b4232f17b2fed9d10f7a6bdf4d53a7a70d2659`；于 2026-11-16 01:22:56（Asia/Shanghai）公开。仅 Windows x64。[GitHub Release v6.10](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.10)。

## 本轮修复

- 播放取源优先使用当前 `reading/bookapi/video_tab/multi_video_model/v1/` 接口，按当前 App 播放器协议生成请求签名。
- 当前接口返回空响应时自动轮换匿名设备身份并重试两个官方接口主机；仍失败时保留一次受控的旧接口回退。
- 保持分集身份、画质选择、加密密钥和媒体地址的现有校验，不把网页预览或错误分集当成完整 App 片源。
- 增加当前接口签名、空响应恢复、旧接口回退、错误分类和实时诊断覆盖。

## 发行形态

- 只发布 `hongguo-downloader-6.10-win-x64-setup.exe` 与由最终 EXE 生成的 `latest.yml`。
- Windows 安装版继续使用固定 GitHub 更新源和 SHA-512 校验；当前未配置代码签名证书。
- 不改写历史标签、历史安装包或正式用户资料。

## 验证与回执

- PASS：`node scripts/check-app-source-recovery.cjs`（17/17）、`node scripts/check-app-source.cjs`（14/14）、`node scripts/check-source-recovery.cjs`（17/17）、`node --test src/native/app-source-inline-fallback.test.cjs`（31/31）。
- PASS：`node scripts/check-release-version.cjs`、`node --check src/native/app-source.js`、`git diff --check`；本地 `npm test` 其余项目通过，真实解码项因本机没有 FFmpeg/ffprobe 未计入通过。
- PASS：[源码 Test 43739724378](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43739724378)，与冻结提交一致；GitHub Actions 安装 FFmpeg/ffprobe 后完整 `npm test` 通过。
- PASS：[Windows x64 release candidate 43739724346](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43739724346)，与冻结提交一致；真实素材解码、匹配的 FFmpeg/x264 对应源码、新装、启动、重装及真实 1.80 → 6.10.0 手动 NSIS 升级资料保留通过。
- PASS：[正式发布 43740746859](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43740746859)，校验标签、两项 CI 的提交、最终 EXE 大小及 SHA-512 后公开 Release。
- PASS：实时取源诊断使用官方公开播放页，系列 `7704683516834892825`、分集 `7704685770241477657`；App 当前接口返回 `OK`、1080p、2 个候选地址。诊断未记录签名媒体地址或身份凭据。

## 真实素材与边界

- 按项目规则，完整媒体测试只使用从红果官网随机选择并真实下载的素材，独立保存于本轮测试目录，全程静音，不使用彩条或测试图。
- 本轮实时诊断确认的是官方公开分集取源恢复；公开网页可能只提供预览，不能替代完整分集的 GUI 播放、画中画、连播、自动删除或真实客户端跨版本安装验收。
- 本机没有可用的 `ffmpeg`/`ffprobe`，因此本地 `npm test` 的真实解码检查未计入本地通过；GitHub Actions 已安装媒体工具并完成对应检查。

## 公开资产

- `hongguo-downloader-6.10-win-x64-setup.exe`：146,475,837 字节；SHA-256 `750c8f903735e1f7be58e7c590107b7ee2c975bcd072271a0cd49ad5513198c5`。
- `latest.yml`：380 字节；SHA-256 `2fdeef97ebf2f5da4c2b98d07848a68f0a8806c32f6a5d771c398b365db39b8f`。
- 元数据安装包 SHA-512：`H3XN1hlJkpyCzOzZ11boQD7gdPyhhXgzaWzGoBirAAuEbmViWBKOu+4h7lF5ej8yumIujk5W/p1FKGMY0lu1jQ==`，与候选最终 EXE 字节相符。
- 公开 Release 只包含安装 EXE 与 `latest.yml`；安装包未配置代码签名，GPL FFmpeg/x264 对应源码随安装目录附带。
