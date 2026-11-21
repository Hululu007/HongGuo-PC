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

2026-11-21 的 6.22 已正式发布，重点是打包环境开发 renderer 来源过滤和负向回归。冻结源码 `ee342c9adf3b2b22116b423fe1dc1285534f87ce`，正式资产与完整验证回执见 [6.22 发行说明](release-6.22.md)。候选含 FFmpeg/x264 对应源码归档和媒体摘要匹配、x64 安装/重装与真实 1.80.0 → 6.22.0 升级资料保留；Windows EXE 仍未签名。红果完整分集播放、实体 GPU/HEVC、长时播放、真实 NAS 与真实应用内更新链路仍未在本轮完全验收。

2026-11-21 的 6.25 已正式发布，重点是关闭按钮收进系统托盘——点 × 默认收起窗口后台运行（下载不中断），托盘单击恢复、右键退出，设置页新增「窗口」分类开关，可改回直接退出。冻结源码 `52b267b0058936b967d2d99eeb50f5edc47ffa9a`，正式资产与验证边界见 [6.25 发行说明](release-6.25.md)。托盘真实显示/单击/右键待安装后真机验收。

2026-11-21 的 6.24 已正式发布，重点是红果完整分集取源的空响应恢复——空响应后按「V5 POST → 备用主机 → 签名 video_tab GET」阶梯恢复（对照上游 7.7 issue #130 移植并致谢其 GPL 来源链），真实剧集验证取源恢复，AT-04 销号。冻结源码 `de045a7d5a3e33f5b7991ea77aabc8542574d704`，正式资产与验证边界见 [6.24 发行说明](release-6.24.md)。发布工作流全流程成功（含末步公开入口探测）。

2026-11-21 的 6.23 已正式发布，重点是 `data.json` 验证镜像备份与设置页受控恢复（EV-003 完成），以及保存独占暂存文件修复（不再覆盖历史遗留 `.tmp`）。冻结源码 `7a22cff46c7b48dee15383cb720d9813c69a9826`，正式资产与验证边界见 [6.23 发行说明](release-6.23.md)。发布工作流末步公开入口探测再次失败，本机独立核验成功后如实分别记录。

技术债重点为主进程职责聚合、JSON 资料恢复、上游来源变动、真实应用内跨版本更新、签名和硬件解码矩阵。发布回执区分安装器升级、应用内更新、Windows 代码签名、回滚和长期播放。

2026-11-21 的 6.21 源码维护覆盖设置与下载任务筛选、设置提交边界和验收脚本安全；能力清单、六个开源项目的源码对照、P0–P3 下一轮任务及未测限制见 [维护记录](evolution-6.21.md)。候选、安装、公开资产摘要与发布末步 HTTP 403 的独立复核见 [6.21 发行回执](release-6.21.md)；不用本机开发构建冒充正式资产，也不将公开后的复核成功写成原发布工作流全程成功。