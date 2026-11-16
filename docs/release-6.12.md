# 红果短剧 6.12

状态：已正式发布（内部版本 `6.12.0`，标签 `v6.12`）。冻结提交 `94428015796c4617cbd79bb9765f769e6e00d21e`；于 2026-11-16 22:08:08（Asia/Shanghai）公开。仅 Windows x64。[GitHub Release v6.12](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.12)。本轮不改写历史版本资产或正式用户资料。

## 本轮更新

- 设置页新增“导出诊断信息”，可导出版本、运行时、任务统计、存储状态、代理模式、媒体工具和更新状态。
- 诊断报告省略代理密码、签名媒体地址、Release 正文和本地绝对路径，并提供 schema 版本和存储健康摘要。
- 更新提示按命名识别 Windows x64 安装 EXE 与 `latest.yml`，源码快照排在前面时仍显示正确安装包大小。
- 产品外链限制到 `github.com` 与 `qm.qq.com`，拒绝自定义协议、凭据 URL 和其他主机。
- 根目录补充项目审计、竞品研究、升级路线图、故障排查和本轮验证报告。

## 发行形态

- 只发布 `hongguo-downloader-6.12-win-x64-setup.exe` 与由最终 EXE 生成的 `latest.yml`。
- 不发布便携包、blockmap 或普通源码 ZIP；GPL FFmpeg/x264 对应源码随安装目录附带。
- Windows 安装包继续未配置代码签名；正式发布由标签、源码 Test、Windows x64 candidate 和发布工作流共同校验。

## 验证与回执

- PASS：诊断模块、外链 allowlist、更新 IPC、更新安装器、renderer 安全回归、发行版本检查、Node 语法检查和 `git diff --check`。
- PARTIAL：本机 `npm test` 的其余测试通过，真实解码检查因当前环境没有 FFmpeg/ffprobe/libx264 未计入通过。
- BLOCKED：本机 `npm run build:react` 受工作区已有的 `build/icon.ico` 与 `build/icon.png` 删除状态影响；本轮未恢复或覆盖这些用户现有删除项。
- PASS：[源码 Test 43880690833](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43880690833)，与冻结提交一致；CI 安装 FFmpeg/ffprobe 后完整 `npm test` 通过。
- PASS：[Windows x64 release candidate 43880690797](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43880690797)，与冻结提交一致；真实媒体工具、React 构建、安装器、新装、重装、真实 1.80 升级资料保留和更新元数据组装通过。
- PASS：[正式发布 43882392109](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43882392109)，校验标签、两项 CI 的提交、安装包与 `latest.yml` 后公开 Release。
- Windows 安装、升级和真实红果 GUI 媒体验收仍受项目规则约束；测试必须使用随机真实下载素材、独立目录并全程静音，不使用彩条视频。

## 发布校验

- 发布工作流会验证 `v6.12` 标签、源码 Test、Windows x64 candidate 的提交 SHA 完全一致。
- candidate 必须只产出安装 EXE 与 `latest.yml`，并由 `latest.yml` 的大小、路径和 SHA-512 反向校验安装包。
- 公开 Release 的最终资产、运行编号和 SHA-256 以 GitHub Release 页面及对应 GitHub Actions 回执为准。

## 公开资产

- `hongguo-downloader-6.12-win-x64-setup.exe`：146,476,906 字节；SHA-256 `d917b21fcf73208fe91f3c90a78b663c6df86c1aab098ae788fae9464898cd47`。
- `latest.yml`：380 字节；SHA-256 `e3ef69a91dc01362ad888eaa4a340a8f9096d37cd2fdde196777ad07dc24b4f6`。
- 元数据安装包 SHA-512：`NBpOSfD5vxaDOYjWgYyteyJNOUBlPJYjV6AHgE4jsjSTX+kfNutjAnwYcyOy/qGxvEf0rDCKZzUhyf4iX+kExw==`，与 candidate 最终 EXE 字节相符。
- 公开 Release 只包含安装 EXE 与 `latest.yml`；安装包未配置代码签名，GPL FFmpeg/x264 对应源码随安装目录附带。
