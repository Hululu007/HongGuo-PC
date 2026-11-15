# 红果短剧 6.11

状态：准备发布（内部版本 `6.11.0`，标签 `v6.11`）。本轮增加 Windows 标题栏 QQ 群入口；仅 Windows x64。

## 本轮更新

- Windows 自定义标题栏新增“QQ群”按钮，显示群名提示“冷漠网络科技交流群①”。
- 点击按钮通过现有 `open-external-url` 安全通道打开 QQ 加群页：`https://qm.qq.com/q/tGVzo8p2Ba`。
- 标题栏拖动区域调整为避开新增按钮，最小化、最大化和关闭仍保持原有独立点击行为。

## 验证边界

- PASS：`node src/components/check-ui-state.cjs "custom title bar"`，确认 QQ 群按钮存在并打开固定邀请页，窗口控制仍各调用一次。
- PASS：`node scripts/check-renderer-security.cjs`，确认外部链接仍经安全 IPC 通道。
- BLOCKED：本机 `npm run build:react` 因工作区已有的 `build/icon.ico` 删除状态无法解析资源；未恢复或覆盖该用户现有删除项。干净 checkout 的 CI 构建仍是发布前置验证。

## 发行形态

- 只发布 Windows x64 安装 EXE 与对应 `latest.yml`。
- 不发布便携包、blockmap 或普通源码 ZIP；不改写历史 v6.10 资产。
