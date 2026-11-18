# 红果短剧 6.16

2026-11-18 22:26（北京时间）正式发布。内部版本 `6.16.0`，标签 `v6.16`，冻结源码 `1150eeea92d9d3fe7930281798909f56333a7fd5`。GitHub Release 已设为不可变。

## 更新内容

- 更新窗口显示当前版本及实时下载速度。
- 选择“稍后提醒”后，同一新版 24 小时内不再自动弹出。用户仍可手动检查更新。
- 加固候选安装回执、依赖与 SBOM 验证、GitHub 发布资产校验和 Windows 来源代码哈希检查。

## 发行资产

| 文件 | 大小 | SHA-256 | Authenticode |
|---|---:|---|---|
| `hongguo-downloader-6.16-win-x64-setup.exe` | 146,494,219 字节 | `f784b298af00c08b39afe783b27d2a33d641889122e9a7c4d9d4fca0c144c730` | `NotSigned` |
| `latest.yml` | 380 字节 | `1a6b1d8e8ace7fac1c939060c8da8cab53088795a15b170d3a489473de2ebd0b` | 不适用 |

公开 Release 仅包含上述两项资产，GitHub 自动生成的源码快照保留。最终资产摘要由 GitHub 公开 Release 接口复核。

## 验证

- [源码 Test](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44320851684) 成功；单元、平台、构建审计和 CycloneDX SBOM 步骤完成。
- [Windows x64 候选](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44320851773) 的 `media`、`windows` 和 `test` 工作成功。
- 候选回执确认安装器是 x64 NSIS，安装、同版本重装及真实 `1.80.0` 安装器升级至 `6.16.0` 成功，并保留设置、观看记录、本地存储和已有下载。安装器 Authenticode 状态为 `NotSigned`。
- 媒体解码检查在隔离临时目录随机获取红果官网公开预览素材并静音执行。它只证明公开预览可解码，不代表完整分集、听感、GPU 硬件兼容或实体机长时播放验收。
- [正式发布流水线](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44324185428) 成功；复核冻结提交、候选回执、安装 EXE SHA-256、`latest.yml` SHA-512、公开资产集合、GitHub 资产摘要和下载入口。
- [README 同步工作流](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44324367246) 成功。

## 尚未验证

本次发行尚未完成 `electron-updater` 从旧版应用内检查、下载、安装、重启并保留资料的端到端验收。1.80.0 到 6.16.0 的 NSIS 手动安装器升级不是应用内更新器验收。验证脚本及工作流在独立代码提交进入 `main` 后运行，结果将追加记录。Windows 当前也没有 Authenticode 签名身份，不能保证消除 SmartScreen 未知发布者提示。

其余项目审计、竞品样本、平台支持矩阵和 44 项升级候选见 [项目审计](../PROJECT_AUDIT.md)、[竞品研究](../COMPETITOR_ANALYSIS.md)、[平台评估](platform-assessment.md) 与 [升级路线图](../UPGRADE_ROADMAP.md)。
