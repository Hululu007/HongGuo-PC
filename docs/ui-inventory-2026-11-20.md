# 界面实体与覆盖清单

审计日期：2026-11-20。对象：当前 Windows x64 / 6.18.0 工作区。此文件是用户要求的完整界面实体索引，不是“所有状态通过”清单。修复与最终测试结果见 [八部分报告](ui-ux-audit-2026-11-20.md)。

## 计数和覆盖口径

- **10 个顶层页面**：按 `src/App.jsx` 的 MENU 页面 ID 计数；两主题共 20 个页面组合，不是 20 个页面。
- **35 个 UI 组件源模块**：App 加组件目录的 34 个 UI 源文件；同文件多个导出只算一次；不含 icons、Hook、模型、工具、挂载入口和测试。
- **13 个渲染器 dialog 结构**：8 个模态、5 个非模态；同一确认模板的不同文案不重复计数。
- **3 个主要菜单/操作展开器**：页面切换、工具栏更多、下载管理更多。播放器四类浮层已计入 dialog，不重复相加。
- **3 处 Toast 实现**：Browse、Player、DownloadManager；不是三个独立共享组件。
- **4 类常规可见应用窗口**：主窗口、来源浏览窗口、官方登录窗口、应用自带浮动播放器；系统 PiP、隐身宿主和系统对话框另列。
- **R**：真实隔离 Electron 窗口已呈现/测量对应界面；不表示该实体的全部业务状态通过。**C**：源码/纯代码回归覆盖；**U**：本轮没有完成对应真实状态验收。最终截图及运行结果以 after/evidence.json 为准。

## 全局技术与资源

| 项目 | 实际实现/源位置 |
| --- | --- |
| 平台 | 正式维护 Windows x64；macOS 历史实现保留但不作为本轮验收平台 |
| 桌面与渲染器 | Electron 44.9.1，React 18，Vite 6.4.5；`main.js`、`preload.js`、`src/main.jsx` |
| UI/CSS | 自定义 CSS、原生表单控件，无 MUI/Ant Design/Tailwind 等组件库依赖 |
| 主题 | `src/theme.js` 的 system/light/dark 偏好；`src/index.css` 的默认浅色与 `[data-theme="dark"]` 映射 |
| 路由 | App 内页面 ID 导航和 `visited` 容器；不是 React Router 的 URL 路由 |
| 共享样式 | `src/index.css`；组件同名 CSS；设置子模块复用 Settings.css，部分页脚模块复用 Player.css |
| 图标 | `src/components/icons.jsx` 内联 SVG 为主，部分窗口控件内联 SVG；品牌图在 build 资源中 |
| 字体 | `--font-ui` 系统字体栈，含 PingFang SC、Microsoft YaHei；不是下载网络字体的换肤方案 |
| 媒体第三方库 | anime4k-webgpu 用于画质增强，不是通用 UI 组件库；相关 canvas 不是统计图表 |
| 运行/构建 | `npm run dev`、`npm start`；渲染器 `npm run build:react`；Windows 安装包 `npm run build:installer`。本轮没有发行安装包 |

## 十个页面

共同主题资源：`src/index.css`、`src/theme.js`、图标模块；下表另外列出组件依赖。覆盖 R 仅指截图/窗口布局范围。

| 页面 | 实现与主要组件 | 主要功能 | 确认问题/改造状态 | 覆盖与边界 |
| --- | --- | --- | --- | --- |
| 发现短剧 `browse` | Browse.jsx/CSS、SeasonSwitcher | 来源/线路/分类、完结筛选、分页、详情、收藏与选集 | 修复小屏选择器、收藏键盘冒泡/透明焦点、相关角标对比度 | R；远端失败和加载等另有 C，未穷举全部来源状态 |
| 热播推荐 `feed` | DramaFeed.jsx/CSS、RandomDrama | 真实榜单、来源片单、随机推荐 | 修复小屏来源栏；沿用榜单/分页业务 | R；真实随机播放不在本轮媒体验收范围 |
| 搜索与下载 `download` | HongguoDownload、SearchPanel、SeasonSwitcher | 搜索/链接解析、选集、清晰度、下载 | 修复浅色活动模式、选项卡键盘语义、搜索 `#` 保留 | R/C；实际提交下载没有包含在截图审计内 |
| 我的剧库 `player` | Player、PlayerControls、CommunityPanel、SequelFinder、CastPanel、NasDownload、VideoEnhancement、弹幕模块 | 本地/在线播放、剧库管理、合并和播放辅助功能 | 修复浮层、状态文字、Toast、确认焦点及相关对比度 | R/C；完整分集、投屏/NAS、PiP/自动删除为 U |
| 观看记录 `history` | WatchHistory、historyGroups | 本机观看进度、多季分组、更新、批量移除 | 修复批删模态键盘及确认后稳定焦点 | R/C；真实删除状态与读屏为 U |
| 收藏与上新 `calendar` | ReleaseCalendar | 本机收藏、公开开播信息、打开播放 | 使用共享令牌；没有仅为改造而重排页面 | R/C；实际播放与完整远端数据为 U |
| 下载管理 `manager` | DownloadManager、共享确认框样式 | 任务队列、分页、批量操作、合并、扫描目录 | 修复进度语义、菜单布局/焦点、扫描错误反馈、确认焦点 | R/C；真实删除/合并与文件操作为 U |
| 登录账号 `account` | AccountManagement | 红果二维码/网页登录、账号和最近观看；河马说明 | 修复来源 tablist、键盘导航、活动文字颜色 | R/C；真实登录与已登录记录为 U；河马明确待接入 |
| 更新日志 `announcements` | App、UpdateCheckSettings、ReleaseNotesList | 检查更新设置、逐版本日志和缓存回退 | 修复长日志和链接断行 | R/C；更新下载/安装不是本轮验收 |
| 设置 `settings` | Settings、AppearanceSettings、ShortcutSettings、BossKeySettings、BuiltinSources、CustomSources | 外观/来源/播放/下载/网络/资料与诊断 | 修复 locale 保存、部分翻译标注、小屏长内容、控制边界 | R/C；系统原生目录/保存对话框和真实代理保存为 U |

## 35 个 UI 源模块

以下文件均在 `src/components/`，App 例外。该表同时记录独立功能模块，不能把它们另加到页面数量。

| 模块 | 所属实体/用途 | 入口或前置条件 |
| --- | --- | --- |
| `src/App.jsx` | 导航外壳、工具栏更多、更新日志组合页 | 主渲染器 |
| AccountManagement | 账号来源、扫码与账号记录 | 账号页；已登录内容需真实登录 |
| AppUpdateNotice | 非模态更新通知、进度、安装/错误 | 非预览且更新状态要求显示 |
| AppearanceSettings | 主题、界面缩放、海报大小 | 设置外观分区 |
| Backdrop | 全局背景装饰层 | App 挂载 |
| BossKeySettings | 全局老板键录入/保存/注册反馈 | 播放快捷键分区 |
| Browse | 发现目录、卡片与详情抽屉 | 发现页；详情需真实目录项 |
| BuiltinSources | 内置来源启停 | 设置来源分区 |
| CastPanel | DLNA 设备扫描与投屏控制 | 当前集可用、页脚可见，需局域网设备 |
| CommandPalette | 全局搜索/命令面板 | 搜索按钮或 Ctrl/Cmd+K |
| CommentDanmaku | 当前集评论弹幕与设置控件 | 已选来源与分集；设置由播放控件打开 |
| CommunityPanel | 公开剧评/评论、本机收藏/小红心、分享 | 红果数字剧号；评论展开才加载 |
| CustomSources | 自定义 CMS 来源、测试/保存/行内删除确认 | 设置自定义来源分区 |
| DownloadManager | 队列、任务、扫描、合并与确认框 | 下载管理页 |
| DramaFeed | 热播来源片单及榜单 | 热播页 |
| ErrorBoundary | 渲染错误降级、重新加载 | 子组件渲染抛错；专项 C |
| HongguoDownload | 搜索/输入模式与解析选集 | 搜索与下载页 |
| NasDownload | 选择 NAS 目录并提交导出 | 当前剧号、系统已挂载目录 |
| OfficialDanmaku | 时间轴弹幕 | 当前来源/分集支持且设置启用 |
| PageMenu | 播放器竖屏页面菜单 | 播放器＋竖屏 |
| Player | 剧库、视频舞台与管理 | 本地剧库或播放目标；空库/有剧集不同 |
| PlayerControls | 进度/音量/倍速、选集/清晰度/更多/PiP | 播放舞台与可用能力 |
| RandomDrama | 来源片池随机推荐 | 热播页“摇一摇”模式 |
| ReleaseCalendar | 本机收藏/上新 | 收藏与上新页 |
| ReleaseNotesList | 版本日志、加载/缓存/重试 | 更新日志页 |
| SearchPanel | 搜索历史、来源搜索、结果与分页 | 搜索与下载页搜索模式 |
| SeasonSwitcher | 同系列其他季 | 查到其他季才显示 |
| SequelFinder | 查找下一季、部分结果与失败重试 | 当前剧集、页脚可见、用户手动展开 |
| Settings | 设置定位、表单、保存、代理模态 | 设置页 |
| ShortcutSettings | 播放快捷键、冲突和恢复默认 | 设置播放快捷键分区 |
| SplashScreen | 启动进度、超时/跳过 | 启动会话；不是独立 Electron 窗口 |
| TitleBar | Windows 自定义标题栏、窗口控制、链接 | 非 macOS |
| UpdateCheckSettings | 更新开关和手动检查 | 更新日志页非预览状态 |
| VideoEnhancement | 锐化/Anime4K 控件与处理层 | 更多播放选项；需媒体和运行能力 |
| WatchHistory | 本机观看记录、更新检查和移除 | 观看记录页 |

## 对话框、菜单与行内面板

| # | 对话框结构 | 实现位置 | 类型/前置条件 | 本轮证据范围 |
| --- | --- | --- | --- | --- |
| 1 | 剧集详情 | Browse.jsx `.browse-drawer` | 模态；真实目录卡片 | R：双主题、真实选集/海报 |
| 2 | 全局搜索 | CommandPalette.jsx | 模态；搜索入口 | R：双主题、初焦点/Tab/Escape/恢复；C：输入法/结果操作 |
| 3 | 网络代理设置 | Settings.jsx `.proxy-modal` | 模态；配置代理 | R：双主题；键盘闭环以最终 evidence 为准 |
| 4 | 播放器合并导出 | Player.jsx `.player-confirm` | 模态；至少一集真实完整下载才可用 | C；真实完整分集状态 U |
| 5 | 播放器通用确认 | Player.jsx `.player-confirm` | 模态；自动删除启用/单剧文件删除/永久移除剧库/全部文件删除 | C；真实破坏性业务变体 U |
| 6 | 下载管理合并 | DownloadManager.jsx `.player-confirm` | 模态；有对应剧库记录 | C；真实合并状态 U |
| 7 | 下载任务删除 | DownloadManager.jsx `.player-confirm` | 模态；已有任务，可选删本地文件 | C；真实任务确认状态 U |
| 8 | 观看记录批量移除 | WatchHistory.jsx `.history-confirm` | 模态；已有选中记录 | C：成功/失败/安全焦点契约；真实状态 U |
| 9 | 软件更新提醒 | AppUpdateNotice.jsx | 非模态；更新状态驱动 | C；真实新版下载/安装 U |
| 10 | 播放器选集 | PlayerControls.jsx | 非模态；剧集列表 | R：双主题展开/高度/关闭 |
| 11 | 播放清晰度 | PlayerControls.jsx | 非模态；来源提供画质能力 | R：双主题展开/高度/关闭 |
| 12 | 更多播放选项 | PlayerControls.jsx | 非模态；倍速/画面/增强等 | R：双主题展开；增强实际效果 U |
| 13 | 弹幕设置 | CommentDanmaku.jsx | 非模态；设置入口启用 | R：双主题展开；真实弹幕播放 U |

主要菜单：PageMenu 的 menu/menuitem；App 的工具栏普通控件组；DownloadManager 的原生 details/summary。后两者关闭焦点已纳入代码回归，真实窗口结果以最终 JSON 为准。未发现应用自定义右键菜单或 Tooltip 组件；普通 `title` 提示由 Chromium/系统呈现，不计作已统一换肤的自定义浮层。

其他行内展开：播放器剧库选择/管理面板、竖屏选集、播放错误/兼容处理遮罩、倍速提示、Community 评论、SequelFinder、CastPanel 设备区、自定义来源删除确认。它们不增加页面/dialog 数。Toast 分别在 Browse/Player/DownloadManager 内，系统追剧通知与应用更新通知不是同一实体。

设置包含 11 个定位分区和语言卡：外观、画中画、快捷键/老板键、播放与缓存、弹幕、下载、网络代理、追剧提醒、来源、配置位置/诊断等；实际分组/定位锚点以 Settings.jsx 为准，不将每个字段计作页面。

## 独立窗口、系统界面和不适用项

| 实体 | 真实实现/入口 | 边界 |
| --- | --- | --- |
| 主窗口 | `main.js`：Windows BrowserWindow；macOS BaseWindow＋WebContentsView | R 覆盖 Windows，macOS U |
| 来源浏览窗口 | `main.js`：目录/搜索的来源网页入口 | 独立远端 BrowserWindow；不继承应用 CSS；U |
| 红果官方登录窗口 | `main.js`、AccountManagement 的“使用官网登录” | 专用会话；不采集凭据，不认证官网内部主题；U |
| 应用自带浮动播放器 | useFloatingPlayer.js、native/floating-player-window.js | 外观同步 C，真实播放/跨屏 U |
| 系统原生 PiP | Player.jsx / Chromium API | 系统管理控件，真实播放 U |
| 隐身小窗 | useStealthWindow、native/stealth-window.js | 同一渲染器迁移/缩窗，不是独立业务页；纯代码 C，真实跨桌面 U |
| 后台嗅探窗口 | `main.js` 的 sniffWindow | 非用户可见，不算页面 |
| 目录/保存对话框 | 下载目录、NAS 目录、导出诊断 | OS 原生，U；不通过应用 CSS 强改 |
| 系统错误/通知 | 代理启动回退、启动/退出失败、追剧通知 | 需真实系统条件，不伪造通过；U |
| macOS 应用菜单/关于 | `main.js` 平台菜单 | 本轮平台不适用 |
| 图表/代码编辑器 | 未发现对应产品界面和依赖 | 不适用；SVG 图表图标和视频 canvas 不计作图表 |
| 内嵌网页 | 未发现产品 webview/iframe/BrowserView 页面 | 独立网站窗口与 macOS WebContentsView 另列 |

不能为展开上述确认框而把假文件、假 completed 分集或假账号记录冒充真实业务。组件测试允许使用明确标注的内存 fixture，但其结果不得升级为真实下载/播放/删除/读屏验收。
