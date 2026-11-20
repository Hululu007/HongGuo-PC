# 6.20 发行说明

状态：已正式发布。公开版本 `6.20`，内部版本 `6.20.0`，标签 `v6.20`（注解标签对象 `b2945ba174e2b664b0dd9be3212e383a7effeb3e`），冻结源码 `1606a28c25abee61cd15d6c22b6bc0ba5fef1161`（PR #22 合并提交）。发布时间 2026-11-21 03:01（北京时间）。上一正式版为 6.19（内部 `6.19.0`，2026-11-21 01:02，标签 `v6.19`）。仅支持 Windows x64；正式资产为 NSIS 安装 EXE 与 `latest.yml`。

## 发布回执

| 项目 | 结果 |
|---|---|
| PR | [#22](https://github.com/yuchen0x1/HongGuo-PC/pull/22)（CodeQL、Dependency review、javascript、Test×2 全部通过后以 merge commit 合并） |
| 标签源码 Test | run 44796108130 成功（v6.20，提交 `1606a28`） |
| Windows x64 候选 | run 44796108261 成功；含单元/平台检查、FFmpeg 对应源码绑定校验、隔离安装、重装与真实 1.80 安装器升级回执 |
| 发布流水线 | run 44798090478 全流程成功，含草稿校验、资产 SHA-256 绑定、公开及公开入口探测 |
| 公开资产 | `hongguo-downloader-6.20-win-x64-setup.exe`（146,462,386 字节，SHA-256 `0dc9ffcbc3b4f06eac109c5029a9c00002e61eb3acb1ff6cae2c77a5e5a612cd`）；`latest.yml`（380 字节，SHA-256 `4df3c75da06bac6011d2baff5da3e3d909855a9c6c308c0c1c6309010e545109`）；`/releases/latest` 返回 `v6.20` |
| 合并后 main Test / CodeQL | run 44796042769 / 44796042748 成功 |
| 签名状态 | EXE 未签名（Windows 无证书，按发行规则明确标注） |

发布入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.20>。

## 本轮范围

本地文件边界安全修复（P1）：

1. **文字导出临时文件安全**（`src/native/text-export.js`）：JSON 导出改为本进程独占创建的随机临时文件（`wx` + 随机名），写完按文件身份核验后原子改名；不再使用可预测的 `<目标>.tmp` 固定名。目标文件、目标目录在读取前后及异步等待后都按设备号/文件号/大小/修改时间核验；目录被换成符号链接、目标被换成链接或非普通文件时保留原文件并按失败统计。
2. **删除下载内容边界校验**（`main.js`）：`delete-task`、`delete-tasks`、`delete-series-files`、`delete-all-downloaded`、`delete-episode-file`、`cleanup-watched-episode` 在异步等待前快照候选文件及其真实父目录身份（含"不存在"状态），等待后与删除前逐一复核；目录被 junction/符号链接替换、最终文件被替换或出现新文件时拒绝删除并保留文件与任务记录。目录扫描不再跟随链接文件，未登记目录里的 junction 直接判为扫描失败。
3. **旧记录兼容**：带持久化目录身份的旧任务仍按其身份校验（下载根通过别名挂载的场景不受影响）；目录扫描对旧档案中无效分集编号只跳过名称匹配，不拖垮整剧；`hongguo-download-batch` 在触碰队列前统一校验并生成全部文件名，含无效分集编号的提交整体拒绝，不再部分入队。
4. **单集删除记录保留**：边界或占用警告导致删除未完成时，`delete-episode-file` 不再清理任务记录（此前可能在报错的同时丢掉记录）。

## 回归与验收

- 新增回归：`scripts/check-deletion-boundary.cjs`（19 例：六类删除入口的 junction 拒绝/保留、异步等待后目录与文件替换、批次预校验、分集编号校验）与 `src/native/text-export-safety.test.cjs`（8 例：预置 `.tmp` 硬链接不改写、外来临时目录不阻塞不清理、目标/目录竞争保留、批次级目录绑定）。
- 既有回归：`check-download-safety.cjs`、`check-episode-file-ownership.cjs`、`check-nas-export.cjs`、`check-download-delete-feedback.cjs` 全部通过；发行提交本地 `npm test` 316 项单元 + 108 组平台检查 0 失败，`vite` 构建通过，版本比较回归扩展到 6.20（3481 组）；CI（Test 44796108130、Windows 候选 44796108261）在冻结提交复验通过。
- 本轮不涉及播放取源逻辑，不重复真实素材播放验收；未覆盖实体机 GUI、真实 SMB/NAS 挂载与应用内更新器跨版本链路，边界沿用 [6.19 说明](release-6.19.md)。

## 已知限制

- CodeQL 在 6.19 引入的界面审计脚本 `scripts/check-ui-theme.cjs` 报告 3 个中危 `js/bad-code-sanitization`（#28–#30）：测试工具用模板串拼装 renderer 代码。该脚本不随安装包分发、不在运行时执行外部输入；本轮不做无法本地验证的改写，留待后续以静态代码表重构并用 CI CodeQL 复核。
- 文字导出/删除的快照校验不能防御与检查窗口同毫秒、同大小的原位内容替换（无原子锁可用的本地竞态窗口）；已将主要窗口（异步等待期）纳入核验。
- Windows EXE 仍未做 Authenticode 签名；红果完整分集播放仍受上游空响应影响，状态同 6.19。
