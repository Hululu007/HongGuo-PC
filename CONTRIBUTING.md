# 贡献指南

使用 Node.js 22.12+，运行 `npm ci`、`npm run build:react`。开发启动用 `npm run dev`。调试桌面功能时使用独立的 Electron 用户数据和下载目录。

从 `main` 创建主题分支，在 PR 中填写兼容性、迁移、更新机制和验证影响。合并前查看 Test、Dependency review 和适用的 CodeQL 检查。发生冲突时合并最新 `main`，重跑受影响检查，保持旧配置和任务记录可读。紧急修复也走源码验证、Windows 候选和新版本标签。

`npm test` 包含 Node 单元检查、主进程和界面回归脚本。FFmpeg、ffprobe 和 libx264 用于真实媒体解码检查，完整 Windows 安装验收在隔离 Actions Runner 执行。涉及播放、画中画、连播或自动删除时，按 [项目规则](AGENTS.md) 从红果随机选材与真实下载，全程静音并记录边界。

提交用户可见改动时更新 [更新记录](docs/releases/release-notes.md)。发行见 [发布指南](docs/RELEASING.md)。报告安全问题请查看 [安全政策](SECURITY.md)。