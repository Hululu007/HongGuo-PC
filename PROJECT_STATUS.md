# 项目状态（自主维护视图）

更新时间：2026-11-21（北京时间）。

| 项目 | 状态 |
|---|---|
| 当前正式版 | 6.22（`v6.22`，2026-11-21 07:24）；冻结源码 `ee342c9adf3b2b22116b423fe1dc1285534f87ce`，回执见 [release-6.22](docs/release-6.22.md) |
| 平台 | 仅 Windows x64（NSIS 安装 EXE + `latest.yml`）；EXE 未签名 |
| 源码回归 | 标签 Test、main Test、main CodeQL 与 Windows 候选全绿；候选含安装、重装与真实 1.80 升级回执 |
| 依赖安全 | 标签 Test 完整依赖审计通过；Dependabot 开放告警状态以 GitHub 安全页为准 |
| Code Scanning | main CodeQL 运行通过；开发 renderer 来源过滤与 renderer 文件 URL 回归通过 |
| 上游风险 | 红果完整分集播放仍受官方接口空响应影响（延续 6.19 状态） |
| 架构 | Electron 44 + React 18 + Vite 6 + Node 22.12+；主进程仍集中在较大 `main.js`，拆分按既有 IPC 契约渐进进行 |

架构、构建与测试入口详见 [项目审计](PROJECT_AUDIT.md)、[维护看板](docs/maintenance.md) 与 [贡献指南](CONTRIBUTING.md)。
