# 应用内自动更新

本文档描述 `main` 当前源码中的更新链路。它不改写历史发行记录：已发布的 v6.7 安装包仍然只有“检查并打开 GitHub 下载页”，因为该安装包是在自动下载/安装 IPC 接回之前构建的；v6.8 Windows x64 安装包已由冻结提交和公开 Release 资产验证，具备本文档所述能力。v6.16 已通过隔离环境下的 NSIS 安装、重装和 1.80 安装器升级验收，资料保留正常。后续 v6.30 → v6.31 与 v6.31 → v6.32 的真实应用内更新已分别在隔离 Windows 环境通过提醒、检查、下载、安装与自动启动；设置和 localStorage 保留通过显式重开各自相同的隔离 profile 验证，详细边界见下文。

## 方案选择

本项目是 Electron + React，正式发行目标是 Windows x64 NSIS 安装版。比较过的成熟方案如下：

| 方案 | 适配性 | 取舍 |
|---|---|---|
| electron-builder + electron-updater | 最高；项目已经依赖 `electron-updater@6.8.11`，发布元数据就是 GitHub Release 的 `latest.yml` | 依赖 NSIS 安装版；便携版不能安全覆盖自身；Windows 未签名时 SmartScreen 仍会提示未知发布者 |
| Velopack | 更新体验和回滚能力强，适合重新设计安装/发布模型 | 需要替换当前 electron-builder/NSIS 产物与 CI，迁移成本大，不能复用现有 v6.x `latest.yml` 兼容链路 |
| Squirrel.Windows | Electron 生态中成熟，支持 delta/安装更新 | 需要迁移安装包和 Release 资产命名，和当前 NSIS、历史客户端及 `latest.yml` 不兼容 |

因此本项目沿用 electron-builder/electron-updater，而不是引入第二套安装器。更新源固定为 `yuchen0x1/HongGuo-PC`，渲染进程不能传入 URL。

## 能力边界

- 正式 Windows x64 NSIS 安装版：支持检查、用户点击下载、真实下载进度、electron-updater SHA-512 校验、用户点击重启安装。
- 开发版、预览版、便携版、非 Windows：保留手动 GitHub 发布页回退，不尝试覆盖当前运行文件。
- 6.16 候选已通过实际 NSIS 安装器从 1.80.0 升级并保留设置、观看记录、本地存储和已有下载。该结果不代替 `electron-updater` 应用内升级链路验收。
- 自动检查默认开启，启动后和运行期间每 6 小时检查一次；检查失败不阻塞启动。
- 下载不自动安装；关闭提醒不会取消下载。用户点击“取消下载”才取消。
- 安装前会阻止仍有下载、合并、转码、在线准备、设置保存或维护操作的情况，避免退出时丢数据。
- 自 6.9 起，任务删除、看完清理、缓存清理、文字导出及取消后的在线任务收尾统一纳入等待；安装开始后拒绝新的维护操作。
- 下载或摘要失败保留当前安装并拒绝无效安装包；安装器启动失败时当前应用继续运行，合法已校验下载可重试。尚未真实验收安装器运行中故障后的自动回滚。
- 安装包采用 GitHub 官方线路优先；满足可信校验元数据条件时，官方线路失败、超时或持续低速后有限切换 GH-Proxy，经资格测试的备用端点仍失败时有限回到官方线路重试。普通用户无需配置线路。
- 用户显式启用“强制直连”时不切换到 GH-Proxy；不添加未经验证的其他镜像站。

## 校验与签名

`latest.yml` 中的文件大小和 SHA-512 必须由最终 EXE 字节生成。electron-updater 在下载阶段依据该元数据校验摘要，摘要不匹配时不会进入可安装状态。

智能下载只代理本仓库公开 Release 安装包，不代理 Release 查询或 `latest.yml`。新候选的官方 `latest.yml` 文件项同时记录 SHA-256（electron-updater 的 `sha2` 字段）、SHA-512 和文件大小；下载前校验 Release 标签、版本、安装包名及清单字段，新下载和 electron-updater 复用的已缓存安装包均检查精确大小和两种摘要，任何不匹配都禁止安装。GitHub Release API 的 asset SHA-256/大小可用时还会交叉核对；API 查询回退为仅标签时，可使用官方 `latest.yml` 的文件名、大小和 SHA-256，仍不信任代理清单。若可信元数据没有 SHA-256，则保持原有 GitHub 官方线路及 SHA-512 校验，但不启用 GH-Proxy。

GH-Proxy 使用已核实的公开 Release 资产地址转换形式：`https://gh-proxy.org/https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}`，并使用已实测 Range 的 `gh-proxy.com` 同服务备用端点。两者属于同一服务，不构成独立供应商容灾；不加入未验证的第三方镜像。2026-11-25 核对的[服务文档](https://gh-proxy.com/docs/github-accelerator)声明支持 Release 资产、HTTP Range 与断点续传、没有人为文件大小上限，并由服务端调度内部节点。客户端仍逐项验证实际响应，不把服务声明当作下载成功。

每轮首先尝试官方地址，再按本次运行的真实吞吐历史、失败惩罚与冷却状态安排两个代理端点，最后至多重试一次官方地址。首次无历史时按 `.org`、`.com` 排序；代理完整下载前用至多 64 KiB 的真实 HTTP 请求验证响应范围和总大小，并测量吞吐。每个端点每轮仅一次完整尝试，失败采用有界退避；达到冷却条件的代理暂时跳过。默认连接/停滞超时为 30 秒，持续低于 96 KiB/s 的线路在预热与低速窗口后终止。线路全失败会保留当前安装并提示重试或手动下载。

请求限于 HTTPS，手动重定向需经过主机与端口白名单检查；官方线路的跨主机重定向会移除非通用请求头，且不能被重定向到任一代理。向加速服务发送请求时仅允许必要的通用下载头，禁用 Session Cookie，不发送 GitHub Token、Authorization、Cookie、用户 ID/分流标识或私人仓库信息。断点续传仅接受起始位置、`206`、`Content-Range`、总大小及响应长度相符的分段；若服务器忽略 Range，则从头安全重下。分段先写入更新缓存中的隔离临时文件，并由 sidecar 绑定版本、资产名、大小和 SHA-256；只有完整验证通过后才原子交给 electron-updater。临时分段绝不会标记为已下载或安装；校验失败及元数据不匹配时清除，线路短暂失败时仅作为下次 Range 续传输入。超过七天的其他版本分段目录只清理本模块拥有的固定文件，并保留符号链接、未知文件与当前版本分段。

当前仓库没有 Windows 代码签名证书，因此不能声称已完成 Authenticode 签名验证。electron-updater 会在 `app-update.yml` 存在发布者信息时执行内置签名校验；没有发布者信息时依赖 HTTPS、固定 GitHub 源、精确大小和可信清单摘要，不能等同发布者签名。正式配置证书后，必须在 GitHub Actions Secrets 中注入证书和密码，绝不把私钥提交到仓库。

## 发布流程

1. 在 `main` 完成代码、测试和版本检查，并在 `docs/releases/release-notes.md` 添加对应版本的更新说明；自 6.33 起使用用户指定的更新模板，正文从「版本概述」开始，包含适用的改进、兼容性、下载与安装、升级与数据及实际验证结果，删除空栏目和占位文字。标题为「红果短剧 vX.Y」，不在正文重复。
2. 创建 `vX.Y` 标签（包内版本为 `X.Y.0`）。
3. Windows x64 release candidate 工作流构建 NSIS EXE，运行单元/平台/安装验收，并从最终 EXE 生成 `latest.yml`。
4. 人工确认候选工件、提交 SHA、包大小、SHA-512、签名状态和许可证对应源码。
5. 手动运行 `Publish validated Windows release`，传入标签、候选工作流 run ID、源码 Test run ID 和期望提交 SHA。
6. 发布流水线从 `docs/releases/release-notes.md` 提取对应版本正文，保留模板栏目、表格和链接，兼容历史列表；缺少或重复版本、空正文或空模板栏目时停止发布。只上传安装 EXE 与 `latest.yml`，并在公开 Release 前再次核对版本、文件名、大小和 SHA-512。

应用内更新日志直接读取 Release 正文。正文中的验证结果仅写实际执行的范围与限制；详细测试命令、流水线回执和哈希保留在 `docs/release-X.Y.md`，安装方式与平台说明见 README。

旧版 v6.2–v6.6 安装版仍依赖 `latest.yml`，所以不得从后续 Release 删除该文件。

## 本地验证

不需要真实 Release 或安装权限即可运行。`npm test` 的解码检查需要联网随机下载红果官网公开素材，并需要 FFmpeg/libx264 和 ffprobe；其余隔离检查不播放视频：

```powershell
node scripts/check-app-update.cjs
node scripts/check-app-update-installer.cjs
node src/native/app-update-download.test.cjs
node scripts/check-app-update-proxy.cjs
node scripts/check-app-update-ui.cjs
npm test
```

隔离 fixture 应分别覆盖官方成功、官方超时/低速后代理成功、代理失败后官方重试、Range 续传、错误长度或摘要拒绝、取消、重定向和敏感头过滤。这些模拟不代表真实 GitHub 或 GH-Proxy 可用性，也不代表完成签名验证。

真实网络测试应与模拟测试分开记录：在独立临时目录从公开 Release 分别测试 GitHub 官方线路、GH-Proxy、慢速/超时切换、续传和线路回退，并核对下载文件大小及两种摘要。没有中国大陆网络环境时，不得声称已验证大陆速度或可用性；不得用真实测试下载替换正式安装器或操作用户数据。真实发布前还必须在干净 Windows x64 安装环境验证：旧版本资料保留、真实 Release 下载、SHA-512 与 `latest.yml` 相符、未签名 SmartScreen 提示（或签名证书状态）、安装失败后旧版本仍可用，以及应用重启后的版本号。

## 本轮网络实测（2026-11-24）

- 对象：公开 v6.8 Windows x64 安装包；独立系统临时目录；仅下载与校验，没有运行安装器或操作应用资料。
- GH-Proxy：单字节 Range 返回 HTTP 206；完整下载返回 HTTP 200，146,473,098 字节，约 428 秒。文件大小、GitHub Release API 的 SHA-256 `cafcfad3ff98f83a10033929ce57be5f5a46ea8ae026f6f927b175a6bf0ac6cd` 和官方 `latest.yml` 的 SHA-512 均匹配。
- GitHub 官方线路：单字节 Range 请求在 15 秒内未收到数据；后续完整下载尝试未完成且未作摘要验收，故不记为成功。
- 环境限制：这是当前工作环境的网络结果，不是中国大陆网络实测；不能据此宣称大陆速度或可用性。更新模拟中覆盖的超时、低速切换、回退、续传及校验失败属于独立模拟结果。

## 6.32 真实网络回归（2026-11-25）

`node scripts/verify-update-download-network.cjs v6.31` 使用真实 Electron 44.9.1 的 `ElectronHttpExecutor`、隔离 Session、临时资料和缓存目录，下载公开 v6.31 安装包但从不执行安装器。目标为 146,272,775 字节，官方 GitHub API SHA-256 为 `a8e601df0db39d2c998bd830bbc3c066c6ab8e501cf2318647a5aaed29ed9b17`，另用官方 `latest.yml` 的 SHA-512 校验。

| 场景 | 实际结果 | 证据边界 |
|---|---|---|
| 官方完整下载 | GitHub 跳转官方 CDN，HTTP 200，大小和双摘要匹配 | 没有注入故障 |
| 官方错误后 `.org` 下载 | `.org` 64 KiB Range 探测 HTTP 206，完整下载 HTTP 200，大小和双摘要匹配 | 官方连接错误为明确注入；代理字节来自真实网络 |
| 官方与 `.org` 均错误后 `.com` 下载 | `.com` 64 KiB Range 探测 HTTP 206，完整下载 HTTP 200，大小和双摘要匹配 | 前两条线路错误为明确注入；同服务备用端点为真实网络 |
| 官方中断后续传 | 真实流取消后保留 2,106,990 字节；下一次实际收到对应起点的 HTTP 206，最终大小和双摘要匹配 | 中断由客户端主动取消，不代表自然网络掉线 |

四项均通过，共 50.217 秒；总响应字节 585,222,172，低于脚本预算 593,479,708。没有窗口、媒体播放或安装器执行，临时资料已删除。API 元数据请求使用 API 专用验证凭据避免匿名限流；下载和代理请求不含该凭据。回执由脚本记录源码 SHA-256，以区分后续修改。可用 `verify-update-download.yml` 在 GitHub 托管 Windows 上复跑。

这些结果只说明当前环境网络正确性，不能据此宣称中国大陆速度或所有用户网络可用。连接超时、持续低速、错误大小和摘要等仍由独立模拟回归覆盖；安装、重启和资料保留由候选及应用内跨版本工作流另行验收。

应用内升级验证脚本 `scripts/verify-windows-live-update.cjs` 通过 `verify-live-update.yml` 在 GitHub 托管 Windows x64 runner 上运行。它从公开旧版安装器开始，以独立 `APPDATA` 和下载目录执行应用内检查、下载、安装、重启及资料保留验证。6.16 的这项工作流尚未执行，结果登记在对应发行回执中。

## 6.30 → 6.31 真实应用内更新（2026-11-25）

[工作流 45555597265](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45555597265) 及 `windows-live-update.json` 的 `passed: true` 确认：公开 v6.30 安装包经 SHA-256 校验后在独立临时目录安装并启动；旧版启动时实际显示 v6.31 更新提醒，发现稳定版，electron-updater 下载并接受安装包，验收程序操作 NSIS 的 Next／Finish，更新器退出旧应用并从原安装路径自动启动新版，已安装 EXE 的 PE 版本为 `6.31.0.0`。

验收随后显式以同一隔离 `--user-data-dir` 重开新版，确认版本、设置与 localStorage 标记保留。安装器的自动 shell 重启没有传递该测试参数，因此“自动启动成功”与“同一隔离 profile 的资料保留”分别成立，不把后者说成自动 shell 已沿用测试 profile。该次不验证正式用户资料、所有实体 Windows 环境或安装中途故障的自动回滚。

早期 `45548733764` 与 `45550443666` 已完成版本发现、下载和校验，但等待新版启动超时；第二次还确认启动提醒可见。这些失败回执继续保留在 [6.31 发行回执](release-6.31.md)，不因后续通过而改写。此处结果仅为 6.30 → 6.31。

## 6.31 → 6.32 真实应用内更新（2026-11-25）

6.32 正式公开后，[工作流 45557133216](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/45557133216) 独立验证通过：基线为经公开 SHA-256 校验的 v6.31 安装包；旧版启动时显示 v6.32 更新提醒，发现正式稳定版，electron-updater 真实下载并接受安装包，NSIS Next／Finish 完成，旧应用退出，新版从原安装路径自动启动。已安装 PE 版本为 `6.32.0.0`，`windows-live-update.json` 记录 `from=v6.31`、`to=v6.32`、`passed=true`。

随后显式重开同一隔离 profile，版本、设置和 localStorage 标记保留均通过；与 6.30 → 6.31 相同，自动 shell 重启没有携带测试用 `--user-data-dir`，因此不把资料保留结论写成自动 shell 沿用了该 profile。此结果不覆盖所有旧版本、实体 Windows 环境、用户代理组合或安装中途故障自动回滚，完整冻结源码、运行时间与资产摘要见 [6.32 发行回执](release-6.32.md)。

## 失败处理

发现新版与下载新版会访问不同的 GitHub 接口。若能看到版本信息但提示“更新下载或校验失败”，不能只凭这句提示断言安装包损坏。

2026-11-13 实机排查中，6.8 默认直连访问 GitHub 返回 `ERR_CONNECTION_RESET`，而本机已配置可用的 Windows 系统代理。通过「设置 → 网络代理 → 启用代理 → 跟随系统」并保存后，实际 6.8 已完成 6.9 的下载、SHA-512 校验和可安装状态确认；缓存文件与正式安装包摘要一致。未执行安装，也未清理观看记录或视频。明确选择直连的用户不应被程序静默切换代理。

- GitHub/API 不可访问：保留当前应用，显示重试和手动发布页入口。
- `latest.yml`、安装包或 SHA-512 不匹配：拒绝进入安装状态。
- 下载中断：对 Range 与 `Content-Range` 验证通过的资产分段从临时缓存续传；续传不受支持或校验失败时按有限线路序列重试，最终失败不会删除当前安装。
- 安装被忙碌任务阻止：保持已校验下载，完成任务后再次点击安装。
- 安装器启动失败：显示错误，当前版本继续运行，可再次尝试或手动下载。
- 便携版：不做应用内覆盖更新，用户需完整解压/运行新版或安装 NSIS 版。

## 已知限制

- v6.7 已发布二进制不包含本轮恢复的自动下载/安装代码；线上用户需安装包含当前 `main` 的 v6.8 新版本后才会获得新能力。
- Windows 当前未配置代码签名证书，不能消除 SmartScreen 的未知发布者警告。
- Windows 尚无代码签名证书，EXE 的 Authenticode 状态为 `NotSigned`。真实客户端应用内更新器升级验证应记录在对应发行回执中。
