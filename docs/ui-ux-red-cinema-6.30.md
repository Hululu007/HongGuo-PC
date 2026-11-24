# RED CINEMA UI/UX 改造报告

版本目标：6.30（内部 `6.30.0`），仅 Windows x64。
改造分支：`codex/ui-ux-red-cinema`。
改造日期：2026-11-24 至 2026-11-25（北京时间）。
## 改造范围

本轮只改变视觉、布局、可访问交互反馈和检查夹具安全性，保留现有 React 页面结构、Electron 窗口管理、路由、播放器、来源解析、搜索、下载队列、NAS、本地剧库、账号、观看记录、设置持久化和自动更新协议。

### 页面与组件

- 全局框架：`src/index.css`、`src/components/TitleBar.css`、`src/components/splash.css`
- 发现与推荐：`Browse.css`、`DramaFeed.css`、`RandomDrama.css`
- 搜索与下载：`HongguoDownload.css`、`DownloadManager.css`
- 播放器：`Player.css`、`PlayerControls.css`
- 资料与账户：`WatchHistory.css`、`ReleaseCalendar.css`、`AccountManagement.css`
- 设置与更新：`Settings.css`、`AppUpdateNotice.css`

主要变化包括统一 RED CINEMA 设计 Token、浅色/深色主题、桌面间距与层级、卡片和状态反馈、标题栏与侧栏、窄窗口响应式、缩放下的锚点布局、日历工具栏换行和播放器外围控件层级。未修改 JSX、IPC 契约、数据接口或播放器/下载核心。

## 功能保留核对

| 能力 | 结果 |
| --- | --- |
| 页面路由和侧栏入口 | 保留；静态 UI 状态检查通过 |
| 播放、切集、播放进度和播放器浮层 | 保留；播放器专项回归通过 |
| 多来源搜索、发现分页和筛选 | 保留；来源/目录/分页回归通过 |
| 下载队列、暂停/重试/删除和进度 | 保留；下载管理专项回归通过 |
| NAS 导出和本地剧库 | 保留；NAS 与本地资料回归通过 |
| 观看记录、收藏与上新 | 保留；历史/日历/收藏回归通过 |
| 账号、设置持久化和网络代理 | 保留；设置搜索与代理专项回归通过 |
| 应用内更新提示、下载、校验和安装边界 | 保留；更新器专项回归通过 |

## 验证结果

- `npm test`：325 个单元测试、112 项平台检查通过。
- `npm run build:react`：生产构建通过。
- `node scripts/check-release-version.cjs`：4,761 组版本比较及版本/锁文件/工件命名检查通过。
- `node scripts/check-window-layout.cjs`、`check-ui-theme-tokens.cjs`、`check-renderer-security.cjs`、`check-share-security.cjs`、`check-backend-lifecycle.cjs`：全部通过。
- `npm audit --package-lock-only --json`：当前锁文件 0 个漏洞。
- 真实 Electron UI 审计：改造后 20/20 页面、80 张截图、0 视口溢出、0 媒体启动，全程静音；改造前基线记录了 73 个视口溢出观察。

截图和测量证据：

- 改造前：`docs/screenshots/ui-audit-2026-11-20/before/evidence.json`
- 改造后：`docs/screenshots/ui-audit-2026-11-20/after/evidence.json`
- 评分与对比：`docs/screenshots/ui-audit-2026-11-20/scorecard.json`
- 颜色审计：`docs/screenshots/ui-audit-2026-11-20/color-audit.json`
- 媒体来源与静音限制：`docs/screenshots/ui-audit-2026-11-20/media-provenance.json`

截图审计使用独立临时资料目录、独立下载目录、自动更新关闭和音频静音；没有触碰正式用户资料，也没有把彩条或合成视频当作媒体验收素材。

## 发布边界

本地构建不等同于公开安装包。Windows x64 候选工作流仍必须完成安装、重装、资料保留和旧版本升级检查；公开 Release 只能包含 `hongguo-downloader-6.30-win-x64-setup.exe` 与对应 `latest.yml`。本轮未宣称真实完整分集播放、长时连续观看、画中画、连播、自动删除、物理系统 DPI、多显示器或读屏器验收通过。
