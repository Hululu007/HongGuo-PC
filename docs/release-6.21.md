# 红果短剧 6.21

2026-11-21 06:28（北京时间）正式发布。公开版本 `6.21`，内部版本 `6.21.0`，标签 `v6.21`，冻结源码 `83fb32ca6dfe3a8bd98217206cffdc87853d98ac`；仅支持 Windows x64。GitHub Release 为非草稿、非预发行且不可变，普通用户资产仅有 NSIS 安装 EXE 与 `latest.yml`。上一正式版为 6.20。

## 更新内容

- 下载管理增加剧名、任务名、文件名与状态筛选；把等待自动重试与最终失败／已停止分开显示。
- 批量选择可跨页和筛选保留；全选、停止、重试、删除只作用于当前筛选结果，批量重试失败保留选择并显示错误。
- 设置搜索实际过滤卡片，支持多词和宽字符匹配、Enter 定位、Esc 清除、可恢复的空结果；隐藏分类保留未保存草稿。
- 代理弹窗只提交代理设置，不意外提交其他草稿；保存成功但刷新失败时明确反馈，迟到的读取不会覆盖新修改。
- UI 验收脚本改用固定导航程序；Windows 构建在执行打包 FFmpeg 前验证对应源码档案及其内置媒体二进制摘要。
- 不更改本地资料格式和安装升级方式。红果完整分集播放仍受上游空响应影响，尚未恢复。

## 正式发行资产

| 文件 | 大小 | SHA-256 | Authenticode |
|---|---:|---|---|
| `hongguo-downloader-6.21-win-x64-setup.exe` | 146,463,504 字节 | `2d41eb91631193944a7ff07171a9a4ae96ec393ebf2eec75b2f8f7fa67ba39fd` | `NotSigned` |
| `latest.yml` | 380 字节 | `6d3d48e3df415132d1a9b4b2c77dff527daf78b3bbebac42c144221db5ba7c09` | 不适用 |

GitHub Release API 报告上述两项资产均已上传，普通下载资产数量为 2；GitHub 自动生成的源代码快照为平台系统产物。公开 `latest.yml` 声明 `6.21.0`、安装器文件名、146,463,504 字节及 SHA-512 `5f7e7f68cde13529bb87d5d5a421846c8fda7655747ae16399e55ef2d6d97ee8d7b772fb1fa9a9ac24021a7215b7ac34d208591c92862d59f5d0c0a7084837b5`。

## 验证与发布回执

- 标签 `v6.21` 指向冻结提交 `83fb32ca6dfe3a8bd98217206cffdc87853d98ac`；远程 `main` 与该提交一致。
- 标签源码 Test [44827042678](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827042678) 成功；同提交的 main Test 与 CodeQL [44827029356](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827029356) / [44827029274](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827029274) 成功。
- Windows x64 候选 [44827042693](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827042693) 的 media 与 windows 作业均成功：包含 110 项平台检查、React 构建、FFmpeg 对应源码档案校验、隔离安装、重装与真实 `1.80.0 → 6.21.0` 安装器升级及资料保留验证。
- 本地 `npm test`：单元测试及 110 项平台检查通过；`npm run build:react` 成功；生产依赖审计为 0 个漏洞。Vite 仍提示有较大的构建 chunk，属于后续性能优化项。
- 发布工作流 [44829105712](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44829105712) 校验标签、CI 来源、冻结 SHA、候选回执与资产摘要成功，完成草稿发布和资产上传；最后的公开入口探测因 GitHub runner 对 `latest.yml` 收到 HTTP 403 而失败，故该工作流结论为失败，不能记为全流程成功。
- 发布后独立核验：GitHub API 将 `v6.21` 标记为 latest，Release 为非草稿、非预发行、不可变且含两项目标资产；本机通过公开 URL 读取 380 字节 `latest.yml` 并确认 EXE 下载端点可访问。发布流水线末步的 runner 403 与本机探测结果不同，保留为网络／匿名访问差异，不据此宣称 runner 端探测成功。
- Windows EXE 未做 Authenticode 签名。CI 虚拟机结果不等于实体电脑、GPU／HEVC 或长时播放验收；真实红果完整分集播放、应用内更新器跨版本实机链路及 NAS 实际挂载仍不在本版已验证范围。

正式发行入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.21>。
