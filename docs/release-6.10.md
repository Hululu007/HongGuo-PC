# 红果短剧 6.10

状态：发行候选（内部版本 `6.10.0`，目标标签 `v6.10`）。本轮修复 GitHub Issue #4「红果播放源一直报错」。正式 Release 的提交、CI 回执、资产摘要和公开时间在发布流水线完成后补记。仅 Windows x64。

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

- PASS：`node scripts/check-app-source-recovery.cjs`（17/17）。
- PASS：`node scripts/check-app-source.cjs`（14/14）。
- PASS：`node scripts/check-source-recovery.cjs`、`node --check src/native/app-source.js`、`node scripts/check-release-version.cjs`、`git diff --check`。
- PASS：实时取源诊断使用官方公开播放页，系列 `7704683516834892825`、分集 `7704685770241477657`；App 当前接口返回 `OK`、1080p、2 个候选地址。诊断未记录签名媒体地址或身份凭据。
- 待发布：源码 Test、Windows x64 release candidate、候选安装器验收和公开 Release 资产核对由标签推送后的 GitHub Actions 完成。

## 真实素材与边界

- 按项目规则，完整媒体测试只使用从红果官网随机选择并真实下载的素材，独立保存于本轮测试目录，全程静音，不使用彩条或测试图。
- 本轮实时诊断确认的是官方公开分集取源恢复；公开网页可能只提供预览，不能替代完整分集的 GUI 播放、画中画、连播、自动删除或真实客户端跨版本安装验收。
- 本机没有可用的 `ffmpeg`/`ffprobe`，因此本地 `npm test` 的真实解码检查需由 GitHub Actions 安装媒体工具后完成；不得把该环境限制写成代码测试通过。
