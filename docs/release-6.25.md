# 红果短剧 6.25 发行说明

状态：远程已公开，发布工作流成功。公开版本 `6.25`，内部版本 `6.25.0`，标签 `v6.25`，冻结源码 `52b267b0058936b967d2d99eeb50f5edc47ffa9a`。GitHub 记录的发布时间为 2026-11-21 04:33:38 UTC（北京时间 12:33:38）。上一正式版本为 6.24。仅支持 Windows x64。

发布入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.25>。

## 发布与验证回执

| 项目 | 结果 |
|---|---|
| 主线冻结 | `52b267b0058936b967d2d99eeb50f5edc47ffa9a` 已推送到 `main`（`154acb1..52b267b`，提交说明 `release: 6.25 keep running in tray on close`） |
| 标签源码 Test | [44865673587](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44865673587) 成功；`push`、`v6.25`、同一冻结 SHA |
| Windows x64 候选 | [44865673598](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44865673598) 成功；含 111 项平台检查、FFmpeg/x264 对应源码与媒体摘要校验、x64 NSIS 隔离安装、重装和真实 1.80.0 → 6.25.0 安装器升级资料保留（`Windows NSIS smoke: PASS`） |
| 发布工作流 | [44866645422](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44866645422) 成功（47 秒），公开前校验仓库、标签、提交、工作流来源、安装回执与资产摘要 |
| 公开状态（独立核验） | API 返回 `v6.25`、非草稿、非预发布、`immutable: true`；`/releases/latest` 已指向 `v6.25` |
| 资产独立核验 | `latest.yml`：匿名入口瞬时超时，改经认证资产 API 逐字节下载（380 字节，SHA-256 与 GitHub 资产 digest 一致，声明版本/文件名/大小与 EXE 匹配）；安装 EXE：匿名公开 HEAD 302→200、Content-Length `146467517` 与资产一致，全量字节 SHA-256 核验见下节 |
| README 同步 | 「Sync release to README」[44866718017](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44866718017) 成功，`github-release:start` 块已指向 v6.25 |
| 签名 | `NotSigned`（EXE 未签名，见下） |

## 正式资产

候选工件 ID：`14692425802`（`windows-release-candidate`）、`14691783622`（`windows-verification`）、`14691209979`（`windows-media`）。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `hongguo-downloader-6.25-win-x64-setup.exe` | 146,467,517 | `05691b806f6eb61071ec10e98444324618d560e37171603d80c24045e15cc0d3` |
| `latest.yml` | 380 | `7b14e4004ff0abe8eebe0e989c090989ef35c3e3d331e78d497e92d69e8c1275` |

`latest.yml` 声明版本 `6.25.0`、相同安装器文件名和 `146467517` 字节，SHA-512 为：

```text
iFZ93cGv3/fpFDUiXxM02Pd9iuh23J/zx1EjoV52q8mz98UCemZi3PBYH+GCEIARQojW9MjlQJCqzCuk9jnq8Q==
```

## 本轮范围：关闭按钮收进系统托盘

1. 点右上角关闭按钮不再直接退出：主进程 `close` 事件按 `src/native/close-to-tray.js` 的 `resolveCloseAction` 决策——默认（`close_to_tray !== false`）`preventDefault` 后隐藏主窗口收进托盘，应用继续在后台运行，下载与维护任务不中断。
2. 首次收托盘弹一次性系统气泡（`tray.displayBalloon`）提示恢复与退出方式，之后不再打扰。
3. 托盘图标（复用 `build/icon.ico`）单击/双击恢复主窗口，右键菜单提供「显示主窗口」与「退出应用」；恢复路径 `revealMainWindow` 与二次启动（`activate`）共用，含老板键与隐身小窗恢复。托盘「退出应用」置 `isQuitting` 后走原有 `before-quit` 下载暂停、任务清理与 10 秒退出保护。
4. 设置页新增「窗口」分类与「关闭时最小化到系统托盘」开关（`close_to_tray`，默认开启，保存后生效）；关闭该选项恢复直接退出。macOS 保持关窗不退出应用的原行为。
5. 托盘在 `will-quit` 销毁；图标缺失或 Tray 不可用时仅降级为无托盘，不影响启动（真实启动路径回归覆盖）。

## 回归

- 新增 `scripts/check-close-to-tray.cjs`：关闭决策分支（默认收托盘、`quitReady`/`isQuitting` 放行、关闭选项回退退出、macOS 维持原行为）与 main.js 托盘装配、设置页开关的静态核验。
- `scripts/check-backend-lifecycle.cjs` 关闭契约测试更新为「默认收托盘不请求退出、关闭选项回退退出、quit 就绪后放行销毁」，窗口桩补 hide/show；21/21 通过。
- `scripts/check-settings-search.cjs` 可见分类计数 12 → 13；标题栏关闭按钮 IPC 契约不变（`check-ui-state.cjs`）。
- 版本回归扩至 6.25（4096 版本对）；全量 `npm test` 通过；生产依赖官方 registry 审计 0 漏洞。

## 验收边界与已知限制

- 托盘图标真实显示、单击恢复、右键菜单退出、下载中收托盘不中断：Electron Tray 无法在无头检查中观察，需真机 GUI 验收；本轮以静态装配核验 + 用户确认交互设计为准（用户于 2026-11-21 确认行为符合预期）。
- Windows x64 用户可下载本版安装 EXE 覆盖安装，或由既有安装版应用内更新；安装器跨版本升级不等于真实应用内更新器端到端验收。
- Windows EXE 未签名。实体 GPU/HEVC、长时播放、真实 NAS、真实应用内更新器跨版本链路未在本轮验收。
