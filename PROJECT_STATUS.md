# 项目状态（自主维护视图）

更新时间：2026-11-21（北京时间）。

| 项目 | 状态 |
|---|---|
| 当前正式版 | 6.21（`v6.21`，2026-11-21 06:28）；冻结源码 `83fb32ca6dfe3a8bd98217206cffdc87853d98ac`，回执见 [release-6.21](docs/release-6.21.md) |
| 平台 | 仅 Windows x64（NSIS 安装 EXE + `latest.yml`）；EXE 未签名 |
| 源码回归 | `npm test`：单元测试 + 110 平台检查全绿；Windows 候选安装、重装与真实 1.80 升级回执全绿 |
| 依赖安全 | 官方 registry `npm audit --omit=dev`：0 漏洞；Dependabot 开放告警 0 |
| Code Scanning | 当前 main CodeQL 运行通过；测试工具动态 renderer 代码已改为固定导航程序 |
| 上游风险 | 红果完整分集播放仍受官方接口空响应影响（延续 6.19 状态） |
| 架构 | Electron 44 + React 18 + Vite 6 + Node 22.12+；主进程仍集中在较大 `main.js`，拆分按既有 IPC 契约渐进进行 |

架构、构建与测试入口详见 [项目审计](PROJECT_AUDIT.md)、[维护看板](docs/maintenance.md) 与 [贡献指南](CONTRIBUTING.md)。
