# 红果短剧 6.32 发行记录

状态：已正式发布。2026-11-25 05:55:34 UTC／13:55:34（北京时间），标签 `v6.32`，内部版本 `6.32.0`；GitHub Release 已公开且不可变。仅支持 Windows x64。

标签 `v6.32` 绑定冻结源码 `2bdcaacc872e5b838ad323c90c9e06ee24eb422b`；源码 Test、Windows x64 候选及正式发布均通过。后续验收脚本与回执文档提交不改变该标签和已发布安装包。

## 本轮范围

- 应用内更新先尝试 GitHub 官方安装包；连接失败、超时或持续低速时，在有界重试内尝试 GH-Proxy，最后再试一次官方线路。
- GH-Proxy 使用 `.org`、`.com` 两个同服务端点；进入完整下载前做限时、限量 Range 探测，按本次运行中的速度与失败历史排序，并对重复失败端点暂时冷却。
- 断点记录绑定公开版本、文件名、大小和 SHA-256。切换线路或下一次操作可以复用仍匹配的部分下载；无效 Range、错长文件或摘要不符时拒绝结果并清理对应部分文件。
- 最终安装包及可复用缓存必须通过官方大小、Release SHA-256 和 `latest.yml` SHA-512 校验后才可安装。
- 更新窗口显示 GitHub 官方／GH-Proxy 线路，保留取消下载、稍后安装及打开发布页手动下载。
- 首次启动默认浅色、已有主题偏好、播放取源、剧集下载与本地资料格式沿用 6.31。

## 信任与隐私边界

- 正式版本发现、Release API 及 `latest.yml` 始终只从官方 GitHub 获取；第三方只能下载已确认身份的本仓库公开安装 EXE。
- 第三方请求不携带 GitHub 令牌、Cookie、登录态、用户配置的代理密码或本地资料；只允许 HTTPS 和受限的官方／已知服务重定向主机。
- `.org`、`.com` 是同一供应商的两个端点；目前没有经过验证的独立供应商备用线路，不能称为跨供应商容灾。
- 新版本加速逻辑随 6.32 安装包生效，不会改写已经发布的旧客户端。每次正式发行仍须保留安装 EXE 与 `latest.yml`，以供旧版收到更新提示并使用其原有下载行为。

## 验证

离线模拟验证和真实联网校验分别记录，不能互相替代；源码 Test、Windows 候选、正式发布和旧版更新各自登记结果。

| 检查 | 当前回执 | 结论边界 |
|---|---|---|
| 下载路由离线回归 | 24 个场景通过 | 覆盖回退、超时、低速、续传、错误 Range／长度／摘要、敏感头过滤及取消；模拟结果不证明真实吞吐量 |
| 安装器集成回归 | 合法缓存、缓存大小不符、内容被替换、错误路径及旧版兼容场景通过 | 验证下载完成后的复核与拒绝行为；不代表实际安装器升级成功 |
| 版本比较 | 5,041 个版本对、等价版本、非法版本及未公开版本检查通过，含 6.31 → 6.32 | 源码门禁不能替代真实旧客户端收到更新提醒 |
| 本地 Electron 真实联网 | 4 项均通过：官方完整下载、注入官方连接失败后从 `.org` 下载、再注入 `.org` 失败后从 `.com` 下载、官方实际流中断后续传 | 连接失败由测试显式注入；探测、安装包字节及摘要来自真实公开线路，未执行安装器 |
| 真实中断及续传 | 实际保存 2,106,990 字节；后续请求 `bytes=2106990-`，官方返回 HTTP 206 与 `bytes 2106990-146272774/146272775`，完整大小及双摘要匹配 | 用户端显式取消真实官方流，再实际发起 Range 续传；不把模拟续传写成真实通过 |
| React 构建与默认主题 | `npm run build:react` 通过；全新独立 Electron 资料执行 `--default-theme` 检查通过，主题为浅色且无已保存偏好 | 首次启动默认值保持 6.31 行为，不改写已有主题偏好 |
| 完整源码回归 | 本地 `npm test` 退出码 0：326 项单元测试及 112 项平台检查通过；标签源码 Test [45554988493](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45554988493) 通过 `npm ci`、`npm test`、React 构建与生产依赖审计 | 标签 Test 绑定冻结源码 `2bdcaacc872e5b838ad323c90c9e06ee24eb422b`，不替代 Windows 安装候选 |
| 完整依赖审计 | 本地锁文件全量审计退出码 0；标签 Test 的完整依赖报告 `npm-audit.json` 中 info、low、moderate、high、critical、total 均为 0 | 依赖审计是采集时快照；安全页告警与未合并依赖升级分别记录在[维护看板](maintenance.md) |
| Windows x64 候选 | [45554988520](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45554988520) 全流程通过；`installer-result.json` 的 `passed`、`crossVersionUpgradeTested` 均为 `true` | 新安装、同版本重装、真实 SHA-256 固定的 1.80 安装器升级通过；设置、观看记录、localStorage 和已有下载保留；不等同应用内更新器跨版本验收 |
| 历史 v6.30 → v6.31 应用内更新 | [45555597265](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45555597265) 通过：启动可见提醒、官方版本发现、下载接受、NSIS Next／Finish、原安装路径自动启动新版 EXE，PE 版本为 `6.31.0.0` | 设置与 localStorage 在显式重开同一隔离 profile 后验证保留；自动 shell 重启没有传入测试用 `--user-data-dir`，不声称自动重启沿用了该 profile |
| v6.31 → v6.32 应用内更新 | [45557133216](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45557133216) 通过；`windows-live-update.json` 为 `from=v6.31`、`to=v6.32`、`passed=true`、`installedVersion=6.32.0.0` | 实测启动提醒、正式版本发现、真实下载接受、NSIS 安装及原路径自动启动；设置与 localStorage 保留经显式重开同一隔离 profile 确认 |
| 发布与公开资产 | 发布 [45556801896](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45556801896)、README 同步 [45556936208](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45556936208) 均通过 | GitHub API 确认 `published_at=2026-11-25T05:55:34Z`、`immutable=true`，公开用户资产仅为安装 EXE 与 `latest.yml` |

真实下载校验脚本为 `node scripts/verify-update-download-network.cjs v6.31`，配套手动工作流为 **Verify real update download routes**。脚本使用独立临时 Electron 资料与下载目录，不创建播放窗口、不播放媒体、不执行下载的安装器；运行回执位于 `dist/update-download-network.json`。本地完整回执已检查不含令牌、Cookie、签名地址或本地绝对路径，归档为 [update-download-network-2026-11-25.json](verification/update-download-network-2026-11-25.json)，临时资料与下载目录已删除。

本地联网验收于 `2026-11-25T05:30:45.591Z` 开始、`2026-11-25T05:31:35.808Z` 结束（北京时间 13:30:45.591 至 13:31:35.808），总耗时 50.217 秒，累计接收正文 585,222,172 字节。环境为 Windows、Electron 44.9.1、Node 24.22.0，使用真实 `ElectronHttpExecutor`／`electron.net` 和隔离会话的系统代理配置；未记录代理地址或凭据。这是本机线路的正确性验收，不代表中国大陆下载速度。

四项最终安装包均为公开 v6.31 的 `hongguo-downloader-6.31-win-x64-setup.exe`，大小 146,272,775 字节，SHA-256 `a8e601df0db39d2c998bd830bbc3c066c6ab8e501cf2318647a5aaed29ed9b17`，SHA-512 `rCyA8Vhj2/UbL3VGdl+AFRW6zhmB1apjgl5oOVnDPV5HOfTq2QdI8NwRefs46vPjNs+44W3Hb3bMzx2KIF00vA==`，分别与官方 Release API 和官方 `latest.yml` 匹配。两个 GH-Proxy 端点均实际返回 65,536 字节的 HTTP 206 探测响应，再完成真实整包下载。

归档回执 SHA-256 为 `a8adc715a925e6eac991fdfa10bd2dad01ad6d3ccdf4490db671bc301f068796`；其中记录的下载路由源码摘要 `773cc535371000a34ff35d2b5f99122e5792bb5e7e5d8efb257497dbb0de29af`、验收脚本摘要 `0d938fa73dd64e098060c5b1d29fddc1a9cbf107e34b93ade2f1a3c226e533ac` 与归档时工作树一致。该回执使用公开的 6.31 安装包验证下载路由实现；6.32 安装包的构建、发布与更新结果以本页各自回执为准。

## v6.31 → v6.32 真实应用内更新

验收工作流 [45557133216](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45557133216) 使用验收脚本提交 `535bc20f0b4c0fcd51b3fde8b3f06cf465a87dc1`，于 `2026-11-25T05:57:35Z` 创建、`05:58:50Z` 更新为成功（北京时间 13:57:35 至 13:58:50）。目标安装包仍绑定本页冻结源码，不因验收脚本后续提交而改变。

公开 v6.31 安装器先通过 SHA-256 校验并在独立临时环境安装启动；旧客户端启动时实际显示 v6.32 更新提醒，发现正式稳定版，electron-updater 真实下载并接受安装包，验收程序操作 NSIS Next／Finish，更新器退出旧应用并从原安装路径自动启动新版 EXE。已安装 PE 版本确认为 `6.32.0.0`。

随后显式使用同一隔离 `--user-data-dir` 重开新版，版本、设置与 localStorage 标记检查均通过。安装器自动 shell 重启没有传入该测试参数，因此自动启动和隔离 profile 资料保留分别记录，不将后者说成自动 shell 沿用了测试 profile。没有操作正式用户资料，也没有真实验收安装中途故障的自动回滚。

## 发行形态

- 标签 `v6.32`，内部版本 `6.32.0`，安装器文件名使用公开版本 `6.32`。
- 正式用户资产仅为 `hongguo-downloader-6.32-win-x64-setup.exe` 与对应 `latest.yml`；Windows 安装 EXE 未签名。
- 安装 EXE：146,279,644 字节，SHA-256 `2667ba753386fa53dff6672f2e2e9ba5739d1683accaa45bab6cea366f06898b`，Authenticode 状态 `NotSigned`。
- `latest.yml`：455 字节，SHA-256 `a3a6ff5cc235c7025744af585c37204d7fc2282c3a05b80537289a272e0e2620`，版本 `6.32.0`；`files[].sha2` 对应上述安装包 SHA-256，SHA-512 为 `c/cOMbzZy4/SRcN/TendaLzTlUN3U8L0ie7RV3YNRy3Tu1btiZ12A+CN0z2nqYsBm+R4fYRb/roJ8UtzFjIlgA==`。
- 清单 `releaseDate=2026-11-25T05:49:32.494Z` 为构建元数据时间，正式公开时间为 `2026-11-25T05:55:34Z`，两者分别记录。
- 版本、文件名、大小和双摘要对应同一冻结候选安装包；旧客户端提醒、下载、重启安装及资料保留继续按真实应用内更新回执单独核对。

## 限制

- 本机和 GitHub Actions 的可达性、Range 支持与摘要一致性都不能证明中国大陆真实下载速度；本版不作大陆吞吐量承诺。
- 当前第三方备用仅为 GH-Proxy，同一服务的两个域名可能同时不可用；服务可用性和限额随时可能变化，失败时保留官方重试及发布页入口。
- 网络校验不执行安装器，不能代替安装、重装、跨版本重启或资料保留验证。
- 网络或摘要失败会保留当前安装并禁止安装无效下载；本轮没有对安装器运行中故障进行真实回滚验收，不能宣称自动回滚已通过。
- v6.31 → v6.32 的通过结果来自 GitHub 托管 Windows 隔离环境，不能扩展为所有旧版本、实体电脑、代理环境或安装故障恢复均已通过。
- 本轮不涉及媒体播放验收；更新包联网测试不提供红果完整分集播放、画中画或自动删除的结论。
