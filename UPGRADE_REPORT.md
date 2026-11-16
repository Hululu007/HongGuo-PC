# 项目自主升级报告

报告日期：2026-11-16（Asia/Shanghai）
当前发行目标：`6.13.0` / `v6.13`。
状态：账号入口与河马权益说明已完成，并随 `v6.13` 正式发布；真实媒体 GUI 和线上安装仍按项目规则单独验收。

## A. 研究结果

- 实际研究：16 个开源项目，超过要求的 15 个。
- 重点参考：yt-dlp、Streamlink（来源适配和错误分类）、aria2/qBittorrent（队列和并发）、Jellyfin/Kodi（资料与观看状态）、mpv/VLC（解码回退）、rclone/Syncthing（远端与诊断）、Sonarr/Radarr/Bazarr/Prowlarr（追更、任务历史和来源管理）、electron-builder（发行工件和更新元数据）。
- 研究证据、提交时间、源码入口、许可证边界和限流限制见 [`COMPETITOR_ANALYSIS.md`](COMPETITOR_ANALYSIS.md)。
- 没有复制竞品代码，没有新增竞品运行时依赖。GPL/MPL/BSD/MIT/Unlicense 项目均只作为行为或架构参考。

## B. 升级数量和状态

路线图共登记 44 个独立升级点，覆盖核心功能、新功能、UI/UX、架构、性能、稳定性、安全、自动化和发布。

| 状态 | EV 编号 | 数量 | 证据 |
|---|---|---:|---|
| 已完成 | EV-001、EV-002、EV-009 | 3 | 诊断模块/IPC/UI/测试；更新资产识别和回归检查；外链主机 allowlist 和安全回归 |
| 部分完成 | 无 | 0 | 本轮没有把未完成的规划项标成部分完成 |
| 未完成 | EV-003–EV-044（排除 EV-001/002/009） | 41 | 已写入路线图，等待后续批次、外部证书或独立验收环境 |

未完成原因主要是：需要数据迁移设计、Windows/FFmpeg/真实 NAS 验收、签名证书、长期性能基线，或属于必须分批进行的主进程拆分。它们不是“建议已完成”。

## C. 本轮代码修改

新增：

- `src/native/diagnostics.js`：生成 schema v1 的脱敏诊断摘要，包含版本、运行时、任务状态、存储目录健康、代理模式、媒体工具和更新状态。
- `src/native/diagnostics.test.cjs`：验证秘密、媒体地址和本地路径不会进入报告，并覆盖不存在目录。
- `src/native/external-links.js`、`src/native/external-links.test.cjs`：限制产品外链到 GitHub 和 QQ 群主机，并拒绝凭据/自定义协议。
- `CHANGELOG.md`、`PROJECT_AUDIT.md`、`COMPETITOR_ANALYSIS.md`、`UPGRADE_ROADMAP.md`、本报告。

修改：

- `main.js`：注册 `get-diagnostics` 与 `export-diagnostics` IPC；导出使用保存对话框和受限 JSON 文件写入。
- `preload.js`：暴露最小化的诊断读取/导出 API。
- `src/components/Settings.jsx`：在配置位置区域加入“导出诊断信息”入口和成功/失败反馈。
- `src/native/app-update.js`：识别 Windows x64 安装 EXE 与 `latest.yml`，避免资产顺序影响安装包大小展示；对非字符串 tag 做安全归一化。
- `src/components/AppUpdateNotice.jsx`：优先使用识别出的安装器大小。
- `scripts/check-app-update.cjs`：增加源码 ZIP 排在前面的资产顺序回归。
- `scripts/check-renderer-security.cjs`：更新受允许主机的安全回归样例。
- `README.md`：补充诊断导出和升级档案入口。

未删除现有功能、未更改数据 schema、未恢复或覆盖工作区中用户已有的构建资源删除项。

## D. 测试与验证

| 检查 | 状态 | 说明 |
|---|---|---|
| `node --test src/native/diagnostics.test.cjs` | PASS | 2/2；脱敏和目录健康检查 |
| `node --test src/native/external-links.test.cjs` | PASS | 1/1；允许主机、凭据 URL 和自定义协议边界 |
| `node scripts/check-app-update.cjs` | PASS | 更新源、版本、资产顺序、回退和安全边界 |
| `node scripts/check-app-update-installer.cjs` | PASS | 更新安装器状态机、取消和安装阻塞 |
| `node scripts/check-renderer-security.cjs` | PASS | IPC/frame/CSP/外部链接边界 |
| `node --check main.js preload.js src/native/app-update.js src/native/diagnostics.js` | PASS | 修改后的 Node 模块语法检查 |
| `git diff --check` | PASS | 无空白错误；Git 仅提示现有文件换行风格 |
| `npm test` | PARTIAL | 283 个 Node 单元测试通过；聚合检查仅 `scripts/check-download-quality-integration.cjs` 的本地真实解码检查失败，原因是当前环境缺少 FFmpeg/ffprobe/libx264；不能把该项标成 PASS |
| `npm run build:react` | BLOCKED | 当前工作区已有 `build/icon.ico`/`build/icon.png` 删除状态，Vite 无法解析 `../build/icon.ico`；未恢复或覆盖用户改动 |
| Windows x64 安装/升级 | BLOCKED/待 CI 或独立机器 | 本轮没有签名证书、干净安装机或用户授权的真实安装动作 |
| 真实红果视频 GUI 验收 | BLOCKED/待独立测试资料 | 必须使用随机真实下载、独立目录、全程静音；不能用彩条视频替代 |

Windows 安装/升级和真实红果视频 GUI 验收仍需独立环境；本报告没有用源码单测替代这些边界。

## G. 6.12 发布回执

- 冻结提交：`94428015796c4617cbd79bb9765f769e6e00d21e`，标签 `v6.12`。
- 源码 Test：`43880690833`；Windows x64 candidate：`43880690797`；正式发布：`43882392109`。
- 公开资产只包含 Windows x64 安装 EXE 与 `latest.yml`；正式资产摘要和大小见 [`docs/release-6.12.md`](docs/release-6.12.md)。

## H. 6.13 发布回执

- 冻结提交：`5f861357f6f4f2f837a60a21249c4494c1f11e58`，标签 `v6.13`。
- 源码 Test：`43890514332`；标签 Test：`43891064791`；Windows x64 candidate：`43891064771`；正式发布：`43893165137`。
- 公开资产只包含 Windows x64 安装 EXE 与 `latest.yml`；正式资产摘要和限制见 [`docs/release-6.13.md`](docs/release-6.13.md)。

## E. 升级前后状态

升级前：

- 核心下载、播放、追更、NAS、更新和安全边界已经成熟，但故障诊断需要人工拼接信息。
- 更新提示可能把 Release 第一项非安装器资产当作安装包大小。
- 路线图、竞品证据和 EV 状态尚未集中到根目录。

升级后：

- 设置页能生成脱敏诊断文件，降低提交日志时泄露密码、签名 URL 和本地路径的风险。
- 更新提示按安装器命名识别资产，保留 `latest.yml` 关系信息。
- 根目录已有审计、竞品研究、44 项路线图、变更记录和本报告；未完成项带有具体原因和验收标准。

## F. 遗留问题与下一步

1. 先做 EV-003/004/006/008/009：存储备份、磁盘预检、来源错误码、日志脱敏和外链策略。
2. 在独立 Windows x64 机器用真实红果下载资料完成静音播放、画中画、连播和自动删除回归。
3. 在有证书的发布环境补 Authenticode；没有证书时继续明确 unsigned 状态。
4. 以迁移 fixture 和 IPC 合约为前置，再拆分 `main.js`，避免影响已发布 6.x 数据。
5. 重新抓取竞品 Issues/PR/Release 动态；GitHub 匿名 API 限流解除前，不能声称已完成统一社区趋势审查。
