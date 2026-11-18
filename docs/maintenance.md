# 维护看板

| 条目 | 核验入口 |
|---|---|
| 正式版本、安装 EXE、清单、SHA-256 | [GitHub 最新正式发行](https://github.com/yuchen0x1/HongGuo-PC/releases/latest) |
| 支持矩阵和兼容性 | [平台评估](platform-assessment.md) |
| 源码测试、渲染构建、完整依赖报告与 SBOM | [Test](https://github.com/yuchen0x1/HongGuo-PC/actions/workflows/test.yml) |
| 候选安装、重装、旧版升级与资料保留 | [Windows x64 候选](https://github.com/yuchen0x1/HongGuo-PC/actions/workflows/windows.yml) |
| 正式发布及入口校验 | [发布工作流](https://github.com/yuchen0x1/HongGuo-PC/actions/workflows/publish-windows-release.yml) |
| 依赖与源码安全 | [安全页](https://github.com/yuchen0x1/HongGuo-PC/security) |
| 用户反馈 | [Issue](https://github.com/yuchen0x1/HongGuo-PC/issues) |

每次版本迭代维护 [版本说明](releases/release-notes.md)、应用更新说明和对应安装回执。功能、更新、独立平台环境与已知限制分别登记，真实运行与自动检查都链接到证据。Windows 10 和 Windows 11 使用同一发布资产，单独记载实机测试结果。

每月复核依赖和 Action 更新、出包时间、最新 Release 的 EXE 与 `latest.yml` 是否成对、下载是否有效，以及高优先级故障和兼容性问题。发布大版本之前重新读取竞品的源码入口、最新稳定版本和公共 Issues，更新 [竞品研究](../COMPETITOR_ANALYSIS.md) 和 [升级清单](../UPGRADE_ROADMAP.md) 后决定本轮范围。

技术债重点为主进程职责聚合、JSON 资料恢复、上游来源变动、真实应用内跨版本更新、签名和硬件解码矩阵。发布回执区分安装器升级、应用内更新、Windows 代码签名、回滚和长期播放。