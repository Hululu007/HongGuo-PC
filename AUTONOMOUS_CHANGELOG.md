# 自主开发变更记录

## 2026-11-21 · 下载管理与设置边界（发行 6.21）

**巡检结论**：下载管理筛选和批量任务操作、设置卡片搜索与代理保存边界已进入 `main`，并绑定正式标签 `v6.21`。Windows 候选、源码 Test 和 main CodeQL 均通过；正式 Release 已公开且不可变。发布工作流最后的匿名公开入口探测因 runner 收到 HTTP 403 失败，但发布后的 GitHub API 与本机公开 URL 核验确认目标资产已公开；该差异已记录在 [6.21 回执](docs/release-6.21.md)，不将流水线记为全流程成功。

**代码变更**（随 `83fb32c` 进入 main）：

1. `src/components/DownloadManager.jsx`：筛选、状态分组、跨页选择和批量停止／重试／删除边界。
2. `src/components/Settings.jsx`：实际卡片过滤、多词匹配、键盘定位、草稿保留、代理字段隔离和迟到读取保护。
3. `scripts/check-ui-theme.cjs` 及设置／下载回归：使用固定导航程序，补充执行边界；Windows 首次使用 FFmpeg 前校验对应源码与二进制摘要。

**验证**：标签 Test [44827042678](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827042678)、Windows 候选 [44827042693](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827042693)、main CodeQL [44827029274](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44827029274) 成功；`npm test` 通过单元测试与 110 项平台检查，React 构建及生产依赖审计通过。研究了 6 个开源参考项目，结论见本轮交付报告。

**后续优先项**：限制生产环境对 `VITE_DEV_SERVER_URL` 的信任范围，补充负向回归；随后处理发布签名验收、Electron fuse、下载任务状态机和 GUI／真实媒体更新链路。

## 2026-11-21 · 文件边界安全加固（发行 6.20）

**巡检结论**：远程无开放 Issue/PR；Dependabot 0；官方 registry 生产依赖 audit 0；渲染构建产物逆向暴露面扫描 A（无 source map、无明文秘密）。发现 6.18 发布流水线末步公开入口探测 HTTP 403（资产已公开、下游 6.19 流水线全绿，判断为瞬时/限流类问题）；发现 6.19 引入 3 个 CodeQL 中危告警（测试脚本）；核心代码审查确认两处 P1 本地文件边界风险。

**代码变更**（PR → main，随 6.20 发布）：

1. `src/native/text-export.js`：随机独占临时文件、目录/文件身份核验（BigInt stat）、批次级目录绑定、链接拒绝。
2. `main.js`：删除入口快照目录+最终文件身份并在异步等待后复核；目录扫描拒绝链接目录/文件；批次预校验分集编号；单集删除失败保留记录；目录身份含 inode（JSON 安全字符串）；旧任务持久化身份优先。
3. 新回归 27 例 + 版本比较扩展到 6.20。

**验证**：新增回归全过；全量 `npm test` 通过（292 单元 / 106 平台，见 CI）；`npm run build:react` 通过。独立代码复核代理提出的 5 个 P1/P2 意见均已落实或评估采纳（批次预校验、文件身份快照、记录保留、批次绑定、旧身份兼容）。

**发布**：6.20（内部 6.20.0）已正式发布——PR #22 全部检查通过后合并（`1606a28`），标签 Test 44796108130 与 Windows 候选 44796108261（含安装/重装/1.80 升级）成功，发布流水线 44798090478 全流程成功（含公开入口探测，较 6.18 的 403 已消除）；公开资产恰好两项（安装 EXE 146,462,386 字节 + latest.yml 380 字节，SHA-256 见回执），`/releases/latest` 已指向 v6.20。回执见 [docs/release-6.20.md](docs/release-6.20.md) 与 [RELEASING.md](docs/RELEASING.md)。
