# 自定义标题栏（Windows 无边框窗口）

状态：已实现并真机验收（2026-11-04）。macOS 维持 `hiddenInset` 原生交通灯，不渲染本组件。

## 品牌图标（2026-11-04 更新）

应用统一使用 `hongguo_drama_icon.ico`（16–256px 多尺寸 32bpp）：

- `build/icon.ico`：统一图标来源，供 electron-builder `win.icon`（安装包/EXE 图标）、BrowserWindow `icon`（窗口/任务栏，dev 与打包均从 asar 内读取，已加入 builder `files`）及 Vite 静态导入使用。标题栏品牌区（`.titlebar-logo`，24px 圆角 + 红色光晕）与侧栏 logo（`.logo`）直接复用该文件。
- 启动页 SplashScreen 的动效 logo 维持原设计，未替换。
- 测试桩 `check-ui-state.cjs` 的模块加载器已支持 `.ico/.png/...` 静态资源导入（返回相对路径充当 URL）。

## 结构

- `main.js`：Windows 下 `frame: false`；注册 `window-is-maximized` / `window-minimize` / `window-toggle-maximize` / `window-close` IPC；`maximize/unmaximize/enter-full-screen/leave-full-screen/restore` 事件经 `window-maximize-changed` / `window-fullscreen-changed` 推送渲染端。
- `preload.js`：暴露上述四个调用与两个事件订阅。
- `src/components/TitleBar.jsx` + `TitleBar.css`：品牌区（圆角渐变图标 + 应用名 + 细微红色光效）、独立拖动层、三个控制按钮（悬停过渡、最大化/还原图标旋转切换、关闭悬停红色警示）。入场仅 opacity 淡入；光影为低频 transform 动画并尊重 `prefers-reduced-motion`。
- `App.jsx`：非 macOS 渲染 TitleBar；`app-shell` 承载标题栏与 `app-layout`，最大化时按实测溢出量补偿内边距（CSS 变量，量不到时回退 8px），窗口全屏时隐藏标题栏。
- `src/index.css` 末尾追加 `.app-shell` 外壳规则。

## 本机实测得出的两条硬约束（改此组件前必读）

1. **拖动区不能依赖「drag 父级 + no-drag 子级」的嵌套抵扣**。本机（Windows、DPR 1.25、Electron 44）实测：`.titlebar` 整体 drag 时，按钮的 no-drag 计算样式正确但系统命中仍把按钮当 caption（按住按钮会拖动窗口、点击被吞）。解法是**几何隔离**：独立的 `.titlebar-drag` 兄弟层承担 drag，`inset: 0 138px 0 0`（右侧让出 3×46px 按钮区），拖动层与按钮零重叠，不再依赖区域抵扣。
2. **紧随鼠标事件的窗口状态变更会被 Windows 吞掉**。最小化/最大化/还原若在 click 处理器里同步调用，主进程日志显示 `win.maximize()` 已执行但窗口不动；统一延迟 120ms 再调 IPC 即稳定。改按钮行为时保留这个延迟。

## 行为

- 拖动：标题栏空白区与品牌区（`pointer-events: none` 落到拖动层）。
- 双击空白区：最大化 / 还原（显式 `onDoubleClick`，带同一延迟）。
- 按钮：真实 button 元素，键盘可达（Tab + Enter 已验证），aria-label 完整。
- 最大化补偿：渲染端按 `outerWidth/Height - screen.availWidth/Height` 实测溢出设置 `--titlebar-comp-x/y`；本机 Electron 44 最大化正好等于工作区，实测溢出为 0，不补偿；旧系统若溢出则自动生效。
- 关闭按钮（2026-11-21 起，Windows）：默认收进系统托盘后台运行而非退出。主进程 `close` 事件按 `src/native/close-to-tray.js` 的 `resolveCloseAction` 分支——`quitReady`（before-quit 就绪）或 `isQuitting`（托盘「退出应用」）放行销毁；否则 `close_to_tray !== false` 时 `hide()` 并首次弹一次托盘气泡，设置关闭该选项时回退直接退出。托盘菜单：显示主窗口 / 退出应用；单击托盘图标恢复窗口（与 `activate` 共用 `revealMainWindow`，含老板键/隐身小窗恢复）。设置页新增「窗口」卡片承载该开关（`close_to_tray`，保存后生效）。

## 验收记录（计算机实测）

启动渲染 ✓；拖动移动窗口 ✓；双击最大化 ✓；最大化像素级确认（2560×1540 满屏、还原图标切换、布局正常、关闭按钮完整可见）✓；还原 ✓；鼠标最小化 ✓；关闭退出 ✓；悬停反馈 ✓；暗色主题融合 ✓。边缘缩放：合成拖拽无法命中 2–3px 缩放热区，未能自动化验证，`frame:false` 默认保留 WS_THICKFRAME，需真机鼠标确认（多显示器同理）。

## 回归

`check-ui-state.cjs`「custom title bar wires window controls and follows maximize state changes」覆盖渲染、三个按钮的 IPC 调用（含延迟，测试推进桩定时器 130ms）与最大化状态跟随；`check-renderer-security.cjs` 的窗口事件桩补了 `webContents.isDestroyed`。`scripts/check-close-to-tray.cjs` 覆盖关闭决策分支（默认收托盘、quitReady/isQuitting 放行、关闭选项回退退出、macOS 维持原行为）、main.js 托盘装配与设置页开关的静态核验；`scripts/check-settings-search.cjs` 的可见分类计数随「窗口」卡片更新为 13。

## 托盘验收边界

`scripts/check-close-to-tray.cjs` 为决策与装配静态核验；托盘图标的真实显示、单击恢复、右键菜单退出、下载中收托盘不中断，需真机 GUI 验收（Electron Tray 无法在无头检查中观察）。
