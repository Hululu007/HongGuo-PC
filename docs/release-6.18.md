# 红果短剧 6.18

2026-11-20 17:26（北京时间）正式发布。内部版本 `6.18.0`，标签 `v6.18`，冻结源码 `967d5ab3f4c9352c1eec0bf418b206fb631b2aa6`，仅面向 Windows x64。由 [PR #19](https://github.com/yuchen0x1/HongGuo-PC/pull/19) 合并。 [GitHub Release](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.18) 已标记为不可变；本回执为发布后的文档补充，不移动标签或更换已发布资产。

## 更新内容与限制

- 修复 Windows 加密 HLS 临时密钥路径，避免反斜杠被清单解析误处理。
- 西饭、河马和采集源在符合重试条件时，可有限重取当前分集地址；明确 HTTP 401/403/429 拒绝时停止恢复。
- 修复默认关闭的采集源仍可由旧记录访问，以及重复同名分集可能误匹配备用线路的问题。
- **红果完整分集播放尚未恢复。**本版解决的是客户端可复现的 HLS、本地访问门禁、匹配与有限恢复问题；红果播放接口仍可能返回空信息，不能据此宣称完整分集已经可播放。公开片段和其他来源成功也不构成完整分集验收。

## 正式发行资产

| 文件 | 大小 | SHA-256 | Authenticode |
|---|---:|---|---|
| `hongguo-downloader-6.18-win-x64-setup.exe` | 146,494,837 字节 | `392b80270ed3c4fc550b99dd8b5a2417961b0d320761312bd4fb26d04597c47f` | `NotSigned` |
| `latest.yml` | 380 字节 | `3003cac151d4830fbe4e8a76f11a926042fdd924768024e04104bad9f57f4d90` | 不适用 |

普通用户发布资产仅为以上安装器与更新清单；GitHub 自动生成的源代码快照为平台系统产物。没有发布便携包、blockmap、测试媒体、私有诊断文件或凭据。`latest.yml` 指向唯一的 6.18 Windows x64 安装器；其版本、大小及 SHA-512 与候选安装包逐字节生成及校验一致。

## 验证与发布回执

- 合并冻结提交：`967d5ab3f4c9352c1eec0bf418b206fb631b2aa6`；远端 `main` 与 `v6.18` 剥离后的标签提交均核对为该 SHA。标签对象 `425432cc84fb104775558482541a3af15ef6eaf3`。
- [标签源码 Test 44708000102](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44708000102) 成功，完整本地回归、真实媒体工具测试、React 构建、生产依赖检查与 SBOM 证据步骤通过。
- [Windows x64 候选 44707999928](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44707999928) 的 `media` 与 `windows` 作业成功。候选验证回执 `passed: true`、`crossVersionUpgradeTested: true`；隔离环境新装、启动、同版重装和真实 `1.80.0 → 6.18.0` NSIS 安装器升级均通过，保留设置、观看记录、本地存储和已存在下载。候选安装 EXE 为 `NotSigned`。
- [发布工作流 44710555826](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44710555826) 在 `main` 使用上述 Test/Windows 运行及冻结 SHA；创建并成功公开 Release。它的最后一步在 Actions runner 对 `latest.yml` 的公开 URL 探测收到 HTTP 403，因此该运行结论是失败，不能写成整条流水线成功。随后核对发现 GitHub 已将 v6.18 发布为非草稿、非预发行、不可变的最新正式版，且只含两个预期用户资产；GitHub Release API 给出的文件大小和 SHA-256 均与公开下载文件相符。
- 从未认证的公开 Release URL 实际下载的完整安装器（146,494,837 字节）及 `latest.yml`（380 字节）已在本机重新计算 SHA-256，与 GitHub Release API 完全一致；安装器 URL 的 Range GET 返回 HTTP 206。`scripts/verify-release-assets.cjs` 对这两份公开下载文件与候选 `installer-result.json` 的逐字节清单和收据比对通过。公开清单版本 `6.18.0`、安装文件名、大小、SHA-512 与 Release 中安装器一致。
- 该 Windows CI 是隔离虚拟机回归，不代替用户实体电脑、GPU/HEVC 驱动或长时播放测试；真实素材回归为静音且使用隔离测试资料，发布资产中不含测试媒体。未将公开预览或有限解码结果表述为红果完整分集成功。

## 发布产物静态暴露面审计

目标为从公开安装器提取的 Windows x64 应用目录，未执行安装器或提取出的应用。审计脚本：`reverse-engineering-exposure-audit` 的 `exposure_scan.py`，Electron 画像。评分 **24/100（D）**；仅为相对静态信号，不能当成整体安全证明。检查统计 90 个文件、9 个已扫描 PE、0 个按 Web 画像单独扫描的 bundle。扫描器单文件上限 96 MiB，246,692,352 字节的主 Electron EXE 因超过上限未进入目录扫描；对该 EXE 另行人工解析了 PE debug/fuse 目录及签名状态，因此没有把它说成已由目录扫描完整检查。

### 一、发现清单

| 严重度 | 发现 | 证据及影响 |
|---|---|---|
| 高 | Electron 进程 fuse 加固未启用 | 主 EXE fuse wire 中 `RunAsNode`、`EnableNodeOptionsEnvironmentVariable`、`EnableNodeCliInspectArguments` 为 enabled；`EnableEmbeddedAsarIntegrityValidation`、`OnlyLoadAppFromAsar` 为 disabled，`GrantFileProtocolExtraPrivileges` 为 enabled。降低调试参数、环境变量注入及应用目录替换等路径的门槛。 |
| 高 | 应用源码及测试文件被打入安装器 | 解包后的 `resources/app.asar` 清单有 696 项，包含 `main.js`、`preload.js`、`src/native` 源码及 23 个 `*.test.cjs` 测试文件。普通用户可提取阅读测试用例和实现；ASAR 不是代码保密容器。凭据规则扫描没有命中已知密钥模式，但这是静态扫描，不是凭据绝对不存在的证明。 |
| 高（范围经核对缩小） | 57 个依赖 source map | 实际 ASAR 目录清单中 57 个 `.map` 均位于 `node_modules`；本产品 `main.js`、`src/native` 与 `dist-react/assets` 下未发现独立 `.map` 文件。属于第三方依赖映射，但仍增加其还原便利性；扫描器示例中的通用 map 引用不等于产品源码 map。 |
| 中（依赖调试标识） | PE CodeView/PDB 路径 | 扫描器在 7 个随包 PE 上记录 CodeView 相关命中；人工核对示例中的 `D3DCompiler_47.pdb`、`dxcompiler.dll.pdb` 与 `C:\__w\1\b\build\x64\DXC\Release\bin\Symbols.pri\dxil.pdb` 属于微软图形编译依赖/通用 CI 路径，不是本仓库用户路径或凭据。 |
| 高（已知分发边界） | 安装包未 Authenticode 签名 | 本次安装 EXE `Get-AuthenticodeSignature` 为 `NotSigned`，与当前没有 Windows 签名证书的发行规则一致；这意味着无法为用户提供 Authenticode 发布者身份/本地签名验证，不是本次文件摘要不匹配。若 bundled DLL 缺少自身签名，是按文件的依赖级信号，不能与外层安装器摘要验证混为一谈。 |

### 二、逐项证据与修复

- **Electron fuse（高优先级）**：主可执行文件的 fuse wire 明确报告上述状态。下一版评估在 `electron-builder` `electronFuses` 中禁用 `RunAsNode`、`EnableNodeOptionsEnvironmentVariable`、`EnableNodeCliInspectArguments`、`GrantFileProtocolExtraPrivileges`，启用 ASAR 完整性校验与 `OnlyLoadAppFromAsar`；再以最终 Windows 安装器提取结果跑真实启动、更新、文件协议与媒体回归。不要在不可变 v6.18 上原地改文件或移动标签。
- **ASAR 与测试源码（高优先级）**：应用包中包含主进程源码、`src/native` 源码以及 23 个 `*.test.cjs` 测试文件。下一版修订 `package.json` 的 `build.files`，排除 `src/native/**/*.test.cjs` 等测试文件，并在候选构建后门禁检查 ASAR 清单。ASAR 不能保护 JS 源码；没有服务端边界的交付代码应视为可被读取。不要用字符串混淆替代凭据隔离。
- **依赖 map（中优先级）**：57 个 map 全部来自 `node_modules`。在确认打包许可和运行时兼容后，通过生产依赖修剪或构建文件过滤排除调试 map，再对新产物重新列出 ASAR 清单；不把依赖 map 误报成产品自行生成的 source map。
- **PE-PDB/签名（中优先级）**：对可控的原生构建配置发布版本剥离调试目录或设置非个人化 PDB 替代路径；保留第三方组件的完整许可证与可追溯版本。若后续取得签名证书，使用 Authenticode 签署最终发行 EXE 并加可信时间戳，再按签名及 SHA-256 重走发布验证；签名证书不会让 JS 或客户端逻辑保密。
- **扫描器命中复核**：`CLR-ASM` 只因原生 `d3dcompiler_47.dll` 某字节偏移出现 `BSJB` 被启发式命中；PE CLR Runtime Header 为 `(0, 0)`，因此不是已确认的 .NET IL 程序集，属误报。`LEAK-INTRANET` 是正常 Electron 开发用 loopback/Vite 字符串（127.0.0.1、localhost:5173），不含用户内网地址或秘密。`PE-SIGN` 逐文件提示第三方二进制缺 Authenticode，不意味着外层安装器签名状态未知；该状态已实测为 `NotSigned`。`PE-CFG` 低严重度命中部分媒体/辅助依赖，不是本应用 JS 逻辑的直接证据。

### 三、客户端无法解决的问题

本次凭据扫描没有匹配到脚本定义的硬编码云令牌、私钥或数据库连接串规则；这只是静态扫描未命中，不构成运行时或所有凭据来源均不存在的证明。任何需要保密的长期密钥、授权最终判定或上游风控秘密都不应放进可下载客户端：静态二进制/ASAR 均可被分析。若产品拥有此类业务逻辑，应迁移到服务端并使用短期、限权凭据；当前发行没有加入新服务端，也没有声称防破解。

### 四、修复顺序

1. **P1**：为下一版完成 Electron fuse 加固并以正式打包产物验证启动、媒体、更新和 ASAR 完整性；检查并排除发布包中的测试源码。
2. **P1**：在发布 CI 添加 Electron fuse 与 ASAR 文件清单门禁，source map 检查按产品源码与依赖分类，避免只通过前端目录扫描而遗漏安装器内容。
3. **P2**：去除依赖调试 map，减少可控 PE 调试路径；按实际证书可用性评估安装器 Authenticode 签名。
4. **持续**：不把秘密或授权真相放在客户端；限制与测试回归都在新版本、可验证的远端候选上处理。以上发现保留为已发布 v6.18 的事实，不能通过文档修订把不可变资产描述成已加固。
