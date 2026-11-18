# 平台可行性与支持范围

评估基线为 Windows 版 Electron 44、React、Node.js 主进程、固定的 preload IPC 桥、FFmpeg/x264、应用配置 JSON 与已挂载的本地文件系统。桌面核心闭环包括发现、搜索、账号、在线播放、下载、追更、观看记录、剧库、画中画、DLNA、NAS 导出及安装更新。平台判断覆盖功能、交互、权限、硬件、分发及维护条件。

| 候选 | 等级 | 核心功能、体验与权限 | 交付、长期更新与成本 |
|---|---|---|---|
| Windows 11 x64 | A | 已有原生窗口、键盘快捷键、托盘、通知、文件管理及本地解码交互。解码取决于 GPU 和驱动，可用 FFmpeg 兼容路径 | NSIS、Windows CI、GitHub 应用更新已存在。持续维护，单独记录真实实体机和签名验收 |
| Windows 10 x64 | A | 同一 Electron 与 NSIS 工件。需关注 Win10 系统生命周期、老驱动和 HEVC/视频增强能力 | 同一更新源；记录独立实机覆盖，避免把 Windows Server CI 当作 Win10 实机 |
| Windows ARM64 | C | Electron 有相应二进制。原生 FFmpeg/安装器、驱动和真实硬件回归需新资产 | 额外更新通道及验收矩阵，需求和硬件条件不足 |
| Linux 通用 | C | Node、React 和 FFmpeg 可复用。文件对话框、托盘、快捷键、DLNA、X11/Wayland 与安全存储需逐项验收 | AppImage、DEB、RPM、Flatpak 的更新与沙箱不同，维护成本高 |
| Ubuntu | C | 可作为 Linux 首选验证发行版。需实际测桌面、Wayland、编码及可移动存储 | 可选 DEB 或 AppImage，当前缺少正式验收矩阵 |
| Debian | C | Electron 可运行，旧系统库和硬件解码版本跨度较大 | 额外稳定版与依赖矩阵，暂缓维护 DEB |
| Fedora | C | Wayland、SELinux、媒体能力与托盘需要单独验证 | RPM/Flatpak 发行和更新需单独维护 |
| Arch Linux | C | 滚动发行持续变更系统库与桌面行为 | AUR 等分发需维护者和持续兼容测试 |
| macOS Intel | C | 历史构建可参考。Electron 44 从 macOS 13 起，Keychain、FFmpeg、Dock 与 Intel 硬件需要复验 | Developer ID、公证、Intel 真机、DMG 和签名更新链有持续成本 |
| macOS Apple Silicon | C | 历史原生构建可参考，仍须独立验收 ARM64 解码、Keychain 和窗口交互 | 缺少可持续签名、公证与硬件发布条件 |
| Android 手机 | C | 需重写触控 UI、系统分享、Media3 播放、后台下载、应用目录和安全凭据 | 需 APK/应用商店签名、渠道授权、真机矩阵及长期维护 |
| Android 平板 | C | 需额外支持多栏、旋转、分屏、焦点与本地文件权限 | 与 Android 共用签名渠道，另需大屏验收 |
| Android 折叠屏 | C | 折叠状态及配置切换会影响播放器和下载状态 | 需真实设备和窗口状态回归 |
| iOS | D | 现有主进程、FFmpeg 子进程、本地挂载和数据存储契约无法在当前方案中迁移 | 完整产品需要新架构、平台服务许可和 App Store 分发流程 |
| iPadOS | D | 继承 iOS 沙箱限制，还需独立多窗口与大屏设计 | 继承 iOS 的分发及长期签名门槛 |
| 桌面 Web | C | 发现页可独立设计；原生下载、账号隔离、FFmpeg、文件删除和 NAS 需要服务或本机桥 | 每用户隔离、服务凭据和运维成本超出本轮产品价值 |
| 移动 Web | C | 触控可重做，后台下载与长任务受生命周期限制 | 新服务、移动网络与存储验收成本高 |
| 响应式 Web | C | 可复用部分 UI 概念。渲染器依赖 Electron IPC，短剧核心需重建 API 契约 | 单独部署、缓存失效、回滚和授权需要运维 |
| PWA | D | Service Worker 缓存解决离线界面，无法覆盖原生 FFmpeg、文件路径权限和系统级后台队列 | 若范围改为仅浏览或资料管理，需重新立项 |
| Chrome 扩展 | D | 扩展下载与媒体权限无法提供原本的文件和编解码能力；Native Messaging 要再装宿主 | 双套安装与商店审核，不适合作为独立产品替代 |
| Edge 扩展 | D | 有同样宿主、媒体权限与生命周期约束 | 需单独商店、兼容测试和更新 |
| Firefox 扩展 | D | 额外存在 API 和签名差异，仍需本机宿主 | 需单独审核与更新链 |
| Docker | C | 可封装服务化的队列与探测，无法直接交付原来的托盘、窗口与 GPU 桌面体验 | 引入账户隔离、卷权限和镜像维护 |
| NAS | C | 当前客户端已可导出到系统已挂载的 NAS。原生 NAS 产品还需独立播放器服务与卷权限 | 多架构镜像、安全补丁和厂商渠道成本高 |
| 私有化服务器 | C | 队列和元数据可拆出，但账号、文件权限、视频处理必须按用户隔离 | 团队需承担安装、备份、迁移和更新支持 |
| 云服务器 | C | 下载和缓存从本地转为集中服务后，需核实权限、内容、隐私与带宽约束 | 产生持续的服务器运维和安全响应成本 |
| CLI | C | 诊断、构建和媒体检查已有内部脚本，完整业务 CLI 仍需可维护的 IPC 之外接口 | 独立用户需求尚未达到正式交付门槛 |

Windows 两个操作系统共用 x64 安装资产与业务核心。Linux 和 macOS 的技术可行性由同类项目支撑，移动端需独立应用，Web 扩展通常需要本地宿主。参考 [Electron 44](https://www.electronjs.org/blog/electron-44-0)、[Electron 平台变更](https://www.electronjs.org/docs/latest/breaking-changes) 与 [竞品证据](../COMPETITOR_ANALYSIS.md)。

跨平台扩展的前置条件是把下载状态、存储格式与 IPC 调用契约明确下来。现有 `src/native` 服务继续承载平台无关逻辑，`main.js` 负责 Electron 应用生命周期和系统能力，`preload.js` 是功能白名单，React 负责桌面交互。当前未引入服务器、共享用户数据库或额外平台构建目标。