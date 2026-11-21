# 红果短剧 6.23 发行说明

状态：远程已公开；发布工作流的最后一步公开入口探测失败须保留记录，不记为全流程成功。公开版本 `6.23`，内部版本 `6.23.0`，标签 `v6.23`（注解标签对象见仓库标签），冻结源码 `7a22cff46c7b48dee15383cb720d9813c69a9826`。GitHub 记录的发布时间为 2026-11-21 01:46:54 UTC（北京时间 09:46:54）。上一正式版本为 6.22。仅支持 Windows x64。

发布入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.23>。

## 发布与验证回执

| 项目 | 结果 |
|---|---|
| 主线冻结 | `7a22cff46c7b48dee15383cb720d9813c69a9826` 已推送到 `main`（`46b820e..7a22cff`） |
| 标签源码 Test | [44848529619](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44848529619) 成功；`push`、`v6.23`、同一冻结 SHA |
| Windows x64 候选 | [44848529618](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44848529618) 成功；含 110 项平台检查、FFmpeg/x264 对应源码与媒体摘要校验、x64 NSIS 隔离安装、重装和真实 1.80.0 → 6.23.0 安装器升级资料保留 |
| 安装回执 | `passed: true`、`crossVersionUpgradeTested: true`；Authenticode 为 `NotSigned` |
| 发布工作流 | [44852103766](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44852103766) **failure**：标签/CI/资产/安装回执校验与草稿转公开均成功，最后 `Confirm the public update feed and installer` 步骤 exit code 4 失败（与 6.18、6.21 的 runner 侧公开入口探测失败同类） |
| 公开状态（独立核验） | API 返回 `v6.23`、非草稿、非预发布、`immutable: true`；`/releases/latest` 已指向 `v6.23` |
| 公开资产核验 | 本机匿名下载公开 `latest.yml` 成功，SHA-256 与 GitHub 资产 digest 一致；候选与公开资产的一致性由发布工作流上传步骤的 digest 校验保证（校验失败即不公开）；公开安装器 HEAD 返回 302→200、Content-Length 与候选一致；GitHub 资产 digest 与候选安装回执 SHA-256 完全一致 |
| 签名 | `NotSigned`；不能将构建器 signing 日志当作签名成功 |

发布期间本地环境 GitHub 令牌临时失效（HTTP 401），发布与核验改用本机钥匙串同一账号凭据完成；该故障仅影响本地查询，不影响流水线。

## 正式资产

以下为 CI 候选经 `scripts/verify-release-assets.cjs` 核对后公开的正式资产。候选工件 ID：`14684338370`（`windows-release-candidate`）、`14684945852`（`windows-verification`）、`14684741282`（`windows-media`）。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `hongguo-downloader-6.23-win-x64-setup.exe` | 146,465,802 | `918b7269da762314209c2480d866e3be945dbe4ca5dd0a64bc8081532f0b97f6` |
| `latest.yml` | 380 | `2309567e8c0240ce16c81cc090a1e52a3b8310b14a691165923ff969de9b1d4e` |

`latest.yml` 声明版本 `6.23.0`、相同安装器文件名和 `146465802` 字节，SHA-512 为：

```text
TWsbi3CWVs+el86qcLZZf+Vv+wwPgn7xt24t0ZwsE29mwyRBz+yTrqmmyMJZel57xhYfTyjZ3caIlc1/Bd8X1g==
```

## 本轮范围

1. 数据文件（`data.json`）损坏后可受控恢复：每次成功保存把验证过的新文档镜像到 `data.json.bak`（内容未变时按指纹跳过）；读取失败且备份有效时，设置页「配置文件位置」出现「恢复数据备份」入口，两步确认后把备份写回，损坏原文件保留为 `data.json.corrupt-<时间戳>` 并要求重启加载。
2. 修复保存流程临时文件问题：不再覆盖或移走历史遗留的固定 `data.json.tmp`（保留作人工恢复），改为每次保存独占创建 `data.json.tmp-<进程>-<时间>-<随机>` 暂存文件；Windows 瞬时占用（EPERM/EBUSY/EACCES）导致改名失败时，复用已写好并 fsync 的暂存内容重试，不再重写整份数据。
3. 损坏来源保护：损坏文档不会覆盖有效备份；恢复前核对原文件自启动以来未变化，未明确确认不执行；恢复后的会话保持只读保护直到重启。
4. 主进程新增 `get-storage-recovery`、`restore-storage-backup` 受控 IPC（恢复排队在设置保存队列之后）；渲染器经设置页入口调用。
5. 回归：`scripts/check-store.cjs` 扩至 11 项（备份镜像、损坏不覆盖备份、两步恢复、恢复取消条件、遗留 `.tmp` 保护、改名重试复用暂存等），并适配 `check-backend-lifecycle`、`check-download-safety`、`check-main-window-state` 中依赖旧固定 `.tmp` 行为的用例；版本回归扩至 6.23（3844 版本对）。

没有改变资料格式语义或安装升级方式；`data.json.bak` 仅在既有数据文件旁新增。

## 构建与安装回执

- 候选媒体 job 从源码构建 Windows x64 FFmpeg/FFprobe 并校验对应源码归档与二进制摘要；首次执行媒体工具前核对 `WINDOWS-SHA256SUMS.txt`。
- Windows job 通过 110 项平台检查与单元测试；NSIS 安装、启动、同版本重装及真实 SHA-256 固定的 `1.80.0` 安装器升级到 `6.23.0` 均通过，设置、观看记录、localStorage 和已有下载资料保留。
- 没有替换本机正式安装，未上传候选之外的本机构建。

## 未测边界与已知限制

- 红果完整分集播放尚未恢复（上游空响应）；本轮 CI 真实媒体回归仍为公开片段解码，全程静音，不作为完整分集、画中画、连播或自动删除验收。
- 真实应用内更新器跨版本链路、真实 SMB/NAS 挂载、实体 GPU/HEVC、长时播放与物理多 DPI/多屏未在本轮验收。
- 备份恢复的实机验收限于 CI 隔离目录与单元/平台回归；真实用户目录中损坏 `data.json` 后经设置页恢复的全流程未在本轮实机演练。
- Windows EXE 仍未签名；发布工作流末步公开入口探测失败（exit 4）保留为记录，本机独立复核成功不回写 CI 结论。
- 崩溃遗留的独占暂存文件（`data.json.tmp-*`）暂无启动清理；数量受写入频率限制，留待后续任务健康快照一并处理。
