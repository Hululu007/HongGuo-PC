# 红果短剧 6.19

2026-11-21 01:02（北京时间）正式发布。内部版本 `6.19.0`，标签 `v6.19`，冻结源码 `affc03b01997d28d91e4880594cd54c32efd6059`（[PR #20](https://github.com/yuchen0x1/HongGuo-PC/pull/20) 合并提交），仅面向 Windows x64。[GitHub Release](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.19) 为非草稿、非预发行、不可变（isImmutable），仅含两个用户资产。本版内容为 [UI/UX 双主题审计与交互修复](ui-ux-audit-2026-11-20.md)（27 个确认问题全部修复，有界证据分 65→100），并按 6.18 暴露面审计建议从安装包排除 `src/native` 测试脚本。

## 更新内容

- 浅色/深色双主题修复：三级文字、主操作按钮、焦点环、状态角标、保留帧遮罩、Toast、选中状态文字等 28 组指定对比全部达标；深色 HUD 样式收紧作用域，浅色控件不再错用深色外观。
- 键盘与焦点：命令面板关闭回焦触发器、Ctrl+K 不穿透已有模态；确认对话框初始焦点落「取消」、提交后回稳定页面；输入法回车保护；发现页收藏键盘不再误开详情；折叠侧栏按钮补齐可访问名称。
- 反馈语义：播放器与下载管理提示区分成功/失败样式，失败提示使用错误样式与 alert 语义，下载扫描失败不再伪装成成功。
- 布局：约 420 宽竖屏与 125–200% 应用缩放下，来源选择器、管理菜单、长文字不再溢出或裁切；播放器四类浮层感知滚动端口不再被裁切。
- 其他：自带小窗播放器跟随主窗口主题与海报大小偏好；界面语言设置保存校验与区域语言标记；搜索词保留正文 `#`。
- 安装包不再包含 `src/native/**/*.test.cjs` 开发测试脚本。

## 正式发行资产

| 文件 | 大小 | SHA-256 | Authenticode |
|---|---:|---|---|
| `hongguo-downloader-6.19-win-x64-setup.exe` | 146,459,824 字节 | `03034ffab474f3561c30cbdafb8af29af050cc8b70446453c1088a2be14266c0` | `NotSigned` |
| `latest.yml` | 380 字节 | `aaea7012c41d6ebd046d9b9db632f46b7ff254bffce26be3b5c2c795b7dc75ff` | 不适用 |

普通用户发布资产仅为以上安装器与更新清单；GitHub 自动生成的源代码快照为平台系统产物。没有发布便携包、blockmap、测试媒体、私有诊断文件或凭据。`latest.yml` 指向唯一的 6.19 Windows x64 安装器，声明版本 `6.19.0`、文件名、大小及 SHA-512 `3eb9sDI2J5O/Iw9lLYefvXVg/yXpEmjTTINoEVbxZtdFF/Eiq1l0tjS8lnzcfMG9fxCgTmM6zGm+/K0wdKmDfA==`。

## 验证与发布回执

- 冻结提交 `affc03b01997d28d91e4880594cd54c32efd6059`；标签对象 `40326afdfb6d6dd2fbde8cd91e4b4fe9cc8150ba` 指向该提交。
- [标签源码 Test 44776931614](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44776931614) 成功（本地先经 `npm test` 单元 + 107 平台检查、3364 版本对回归）。
- [Windows x64 候选 44776931523](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44776931523) 的 `media` 与 `windows` 作业成功。候选回执 `passed: true`、`crossVersionUpgradeTested: true`：隔离新装、启动、同版重装资料保留，以及真实 `1.80.0 → 6.19.0` NSIS 升级（保留设置、观看记录、本地存储与已有下载）均通过；候选安装 EXE 为 `NotSigned`，捆绑对应 GPL FFmpeg/x264 源码文档。
- [发布工作流 44779252114](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44779252114) 在 `main` 使用上述 Test/Windows 运行及冻结 SHA，校验通过后公开 Release；其最终对公开 `latest.yml` 的探测在本轮成功（工作流整体结论 success，与 6.18 的 403 情况不同）。
- 公开资产核对：GitHub Release API 报告的安装器 `sha256:03034ffa…266c0`、大小 146,459,824 与候选回执逐字节一致；从未认证公开 URL 实际重新下载完整安装器（146,459,824 字节，因网络抖动按 4MB 分块断点续传完成）与 `latest.yml`（380 字节），本地重算 SHA-256/SHA-512 与候选回执、平台摘要及更新清单完全一致；安装器公开 URL 的 Range GET 返回 HTTP 206。
- [README 同步工作流 44779371196](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44779371196) 成功，`main` 上 README「最新更新」块已显示 v6.19；发版记录链接指向本文件。
- 发布后文档补充（本回执）不移动标签或更换已发布资产。

## 限制

- **红果完整分集播放尚未恢复**：播放接口仍可能返回空信息，本版不包含对上游空响应的修复声明；公开片段可解码不构成完整分集验收。
- 安装 EXE 未做 Authenticode 签名；6.18 暴露面审计中的 Electron fuse 加固仍在评估，本版未启用，已落实的仅为安装包排除测试脚本。
- 本地全量重下载校验在 2026-11-21 凌晨网络抖动下完成（整段下载多次被重置，改用分块续传）；这不影响资产本身，仅为网络环境记录。
- 该 Windows CI 是隔离虚拟机回归，不代替用户实体电脑、GPU/HEVC 驱动或长时播放测试；真实素材回归为静音且使用隔离测试资料。真实读屏器、物理多 DPI/多显示器、完整分集播放/连播/画中画/自动删除及真实登录不在本轮已验收范围。
