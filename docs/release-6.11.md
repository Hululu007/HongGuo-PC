# 红果短剧 6.11

状态：已正式发布（内部版本 `6.11.0`，标签 `v6.11`）。冻结提交 `194e0ede2aabc4ccf7f08f697ea8bad4eddecd38`；于 2026-11-16 01:53:24（Asia/Shanghai）公开。仅 Windows x64。[GitHub Release v6.11](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.11)。

## 本轮更新

- Windows 自定义标题栏新增“QQ群”按钮，显示群名提示“冷漠网络科技交流群①”。
- 点击按钮通过现有 `open-external-url` 安全通道打开 QQ 加群页：`https://qm.qq.com/q/tGVzo8p2Ba`。
- 标题栏拖动区域调整为避开新增按钮，最小化、最大化和关闭仍保持原有独立点击行为。

## 验证边界

- PASS：`node src/components/check-ui-state.cjs "custom title bar"`，确认 QQ 群按钮存在并打开固定邀请页，窗口控制仍各调用一次。
- PASS：`node scripts/check-renderer-security.cjs`，确认外部链接仍经安全 IPC 通道。
- PASS：`node scripts/check-release-version.cjs` 与 `git diff --check`。
- PASS：[源码 Test 43742436781](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43742436781)，与冻结提交一致；GitHub Actions 安装 FFmpeg/ffprobe 后完整 `npm test` 通过。
- PASS：[Windows x64 release candidate 43742436834](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43742436834)，与冻结提交一致；源码回归、真实媒体工具、安装包构建、安装/重装、真实 1.80 → 6.11 升级资料保留及更新元数据组装通过。
- PASS：[正式发布 43743589769](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/43743589769)，校验标签、两项 CI 的提交、安装包与 `latest.yml` 后公开 Release。
- PARTIAL：本机 `npm test` 的真实解码检查因没有 FFmpeg/ffprobe 失败；本机 `npm run build:react` 受工作区已有的 `build/icon.ico` 删除状态影响，未恢复或覆盖该用户现有删除项；干净 checkout 的 CI 构建已通过。

## 发行形态

- 只发布 Windows x64 安装 EXE 与对应 `latest.yml`。
- 不发布便携包、blockmap 或普通源码 ZIP；不改写历史 v6.10 资产。

## 公开资产

- `hongguo-downloader-6.11-win-x64-setup.exe`：146,474,618 字节；SHA-256 `2f6664b1e62d26ef4eb3da97fc5f51713d3b179a53c8edfa4d0f0b3bc6d85f88`。
- `latest.yml`：380 字节；SHA-256 `eebb46d52fe96f27f6332641ef0450321e0dc8c33efbf150263bb7680828a472`。
- 元数据安装包 SHA-512：`aqL2wWcz1IJKCu6IoLTMPeZFAkmCE56vc6/oIpl6Iq4fXyYYWpmWZ888LCdJmOchZPvGc0b8rNFECyASc58dOg==`。
- 公开 Release 只包含安装 EXE 与 `latest.yml`；安装包未配置代码签名，GPL FFmpeg/x264 对应源码随安装目录附带。
