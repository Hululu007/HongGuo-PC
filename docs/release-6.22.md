# 红果短剧 6.22 发行说明

状态：远程已公开，公开入口、资产摘要和更新清单已独立核对。公开版本 `6.22`，内部版本 `6.22.0`，标签 `v6.22`（注解标签对象 `c176ae200dc4246b627aa2a3fc85e50e5f13ed39`），冻结源码 `ee342c9adf3b2b22116b423fe1dc1285534f87ce`。GitHub 记录的发布时间为 2026-11-20 23:24:27 UTC（北京时间 2026-11-21 07:24:27）。上一正式版本为 6.21。仅支持 Windows x64。

发布入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.22>。

## 发布与验证回执

| 项目 | 结果 |
|---|---|
| 主线冻结 | `ee342c9adf3b2b22116b423fe1dc1285534f87ce` 已推送到 `main`；后续 README 同步提交不改变该冻结提交、标签或已发布资产 |
| main Test | [44833907760](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44833907760) 成功 |
| main CodeQL | [44833907850](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44833907850) 成功；保留 Node.js 20 弃用提示，但未导致失败 |
| 标签源码 Test | [44834314357](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44834314357) 成功；`push`、`v6.22` 与冻结 SHA 一致 |
| Windows x64 候选 | [44834314452](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44834314452) 成功；媒体工具对应源码校验、110 项平台检查、x64 NSIS 安装/启动、同版本重装和真实 1.80.0 → 6.22.0 安装器升级资料保留均通过 |
| 正式发布工作流 | [44836461596](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44836461596) 成功；标签、两次 CI、候选工件、安装回执、草稿资产、公开更新清单和公开安装器入口均通过 |
| 公开状态 | Release API 返回 `v6.22`、非草稿、非预发布、`immutable: true`；`/releases/latest` 已指向 `v6.22` |
| 普通资产 | 恰好为安装 EXE 与 `latest.yml` 两项；GitHub 自动生成的源码快照属于平台系统产物，不列为普通下载资产 |
| 签名 | 安装回执明确为 `NotSigned`；构建日志中的 `signtool.exe` 不能当作 Authenticode 签名成功证据 |

## 正式资产

以下是 Windows 候选工件经 `scripts/verify-release-assets.cjs` 核对后公开的正式资产，不是本机开发构建摘要。候选工件 ID 为 `14679135005`（`windows-release-candidate`），安装回执工件 ID 为 `14678560620`（`windows-verification`）；媒体工具工件 ID 为 `14678645028`（`windows-media`）。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `hongguo-downloader-6.22-win-x64-setup.exe` | 146,463,658 | `1f51770c089c4929403b6643b1b6709c4c0364e59f083fd6140fc9992faeecf4` |
| `latest.yml` | 380 | `acfeff105c2b0d2d368d4a2c05c003abdf9137ba37422b63b4dbd02e6671afe5` |

`latest.yml` 声明的安装器大小为 `146463658`，SHA-512 为：

```text
nIlwo1srxQOuKY8gNT2kFn+zNnRxxZzq3yD50rVK2mQ9/3Lvl48SQaJDkVA5lO4LxUspm5Pe+7vy/VURn6jbZw==
```

清单中的版本为 `6.22.0`，文件名为 `hongguo-downloader-6.22-win-x64-setup.exe`。公开下载的 `latest.yml` 与候选清单逐字节相同，公开安装器的 HEAD 检查通过。

## 本轮范围

1. 打包应用不再信任继承的 `VITE_DEV_SERVER_URL`；即使生产进程继承该变量，也回退到内置 `file://` 页面。
2. 开发模式只接受 HTTP loopback renderer 地址：允许 `localhost`、`127.0.0.1` 和 `[::1]`，拒绝 HTTPS、远程主机、局域网地址、凭据、非根路径、query、hash 与超长输入。
3. 窗口加载、媒体访问和 renderer IPC 使用同一个过滤结果，避免不同安全边界接受不同 renderer 来源。
4. 增加开发地址和 renderer 文件 URL 的正向/负向回归，继续覆盖 file URL 编码等价、query、编码分隔符、Windows 驱动器隔离、主 frame 和导航边界。
5. 统一 6.22.0 内部版本、6.22 公开标签和 Windows 安装器文件名；不改变本地资料 schema、公开 IPC 或安装升级方式。

## 构建、安装与许可证回执

- 候选媒体 job [136626739673](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44834314452) 生成 Windows x64 FFmpeg、FFprobe 和完整对应源码；x264 源码包摘要校验为 OK。
- Windows job 在首次执行媒体二进制前检查对应源码归档可解包、包含 `WINDOWS-SHA256SUMS.txt`，并确认归档清单与 `ffmpeg.exe`、`ffprobe.exe` 实际摘要一致；不匹配即失败。
- `installer-result.json` 的 `passed` 为 `true`，`crossVersionUpgradeTested` 为 `true`；安装器回执明确标记 `authenticode: NotSigned`。
- 隔离安装、启动、同版本重装及真实 SHA-256 固定的 `1.80.0` 安装器升级到 `6.22.0` 通过；设置、观看记录、localStorage 和已有下载资料保留。
- 没有替换本机正式安装，也没有把候选工件之外的本地构建包上传到 Release。

## 真实媒体与未测边界

本轮 CI 和发行回执没有执行完整红果分集的 GUI 播放验收，也没有把静态解码、离线控件检查或安装器冒烟写成真实播放通过。测试全程不播放音频；没有将登录凭据、测试媒体文件或带签名媒体地址写入仓库。红果完整分集播放仍受上游接口空响应影响。

以下项目本轮未标为实机通过：

- 画中画、自动连播、看完自动删除和完整官方分集播放；
- 实体 GPU/HEVC 解码矩阵与长时间播放稳定性；
- 真实 SMB/NAS 挂载及其删除边界；
- 真实应用内更新器跨版本下载、SHA-512 校验、退出和重启安装链路；
- Windows 实体机和不同安全软件环境下的 SmartScreen/未签名安装体验。

候选通过、CodeQL 通过和依赖审计通过不等于上述项目已验收。后续真实媒体测试必须从红果随机选择并实际下载素材，使用独立测试资料和下载目录，全程静音，并仅清理本轮测试下载。

## 已知限制与后续优先项

- Windows 安装 EXE 当前没有 Authenticode 证书，首次运行可能出现 SmartScreen 提示。
- Vite 大 chunk、主进程职责聚合和部分 npm/Action 弃用提示仍是维护项；本轮没有声称启动、内存或帧率提升。
- 后续优先补齐代码签名链和 Electron fuse，统一下载任务状态机，增加磁盘空间预检、JSON `.bak` 恢复、FFmpeg 总时限/watchdog、日志媒体地址脱敏、任务健康快照和退出恢复回执，并继续进行真实 GUI、媒体、NAS 与应用内更新验收。
