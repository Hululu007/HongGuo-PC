# 项目状态（自主维护视图）

更新时间：2026-11-21（北京时间）。

| 项目 | 状态 |
|---|---|
| 当前正式版 | 6.24（`v6.24`，2026-11-21 10:37）；冻结源码 `de045a7d5a3e33f5b7991ea77aabc8542574d704`，回执见 [release-6.24](docs/release-6.24.md) |
| 平台 | 仅 Windows x64（NSIS 安装 EXE + `latest.yml`）；EXE 未签名 |
| 源码回归 | 标签 Test、Windows 候选与发布工作流全绿；候选含安装、重装与真实 1.80 升级回执，`npm test` 单元 + 110 平台检查通过 |
| 依赖安全 | 标签 Test 依赖审计通过；Dependabot 开放告警 0（发布当日复核） |
| 数据与播放 | `data.json.bak` 验证镜像恢复已上线；红果完整分集取源经 video_tab 阶梯恢复（真实剧集验证 OK） |
| 上游风险 | 红果完整分集播放已恢复（AT-04 销号）；持续观察上游接口变化 |
| 架构 | Electron 44 + React 18 + Vite 6 + Node 22.12+；主进程仍集中在较大 `main.js`，拆分按既有 IPC 契约渐进进行 |

架构、构建与测试入口详见 [项目审计](PROJECT_AUDIT.md)、[维护看板](docs/maintenance.md) 与 [贡献指南](CONTRIBUTING.md)。
