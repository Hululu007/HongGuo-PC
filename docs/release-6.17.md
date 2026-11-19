# 红果短剧 6.17

2026-11-19 21:16:31（北京时间）正式发布。内部版本 `6.17.0`，标签 `v6.17`，冻结源码 `53b85f76b9951f6e23f2c15689283247b087ae44`，仅面向 Windows x64。[GitHub Release](https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.17) 已设为不可变；发行后文档提交不移动标签或替换安装包。

## 更新内容

- 改进 App 播放接口空响应后的恢复：继续尝试当前 V5 接口，交替官方主、备主机，时间允许时更新匿名播放设备身份并重新签名，不再在该恢复路径降级到 legacy 接口。
- 模型请求最多五次，初次设备注册后的重试及 fallback 总预算为 20 秒。明确拒绝、取消以及原有分集和媒体校验边界保持有效。

修复经 [PR #16](https://github.com/yuchen0x1/HongGuo-PC/pull/16) 检查后合并；未纳入分支治理或依赖升级。排查依据与局限见 [修复记录](fix-app-source-empty-response.md)。本版不承诺消除上游空响应，也不以此前小样本估计宣传成功率。

## 正式发行资产

| 文件 | 大小 | SHA-256 | Authenticode |
|---|---:|---|---|
| `hongguo-downloader-6.17-win-x64-setup.exe` | 146,494,389 字节 | `e5744e31a67cc70995a4f87dec147566167591b1beff8c541a2381a210ed6b86` | `NotSigned` |
| `latest.yml` | 380 字节 | `1de52c3004486161b014c46314e4a641ebc7095c1ac84b53b7127632ebf726fd` | 不适用 |

公开附件仅上述两项，保留 GitHub 自动生成的源码快照。安装器摘要与隔离安装回执及 GitHub 公开资产摘要一致。公开 `latest.yml` 已下载核对大小、SHA-256、版本、唯一安装包文件名、大小和内部 SHA-512 一致性；发布流水线另对实际安装包重新计算 SHA-512，逐字节核对清单。

清单中的安装包 SHA-512（Base64）：

```text
vlDiubNyKUAVwp6TGNbtQpk/h1OIpYivEcmCHtJwLkTVvHy/w+cnTmvGx4RcMeu059aQJjfJaxi3lWqLJ7PRMg==
```

## 验证与发行回执

- 本地定向检查：`check-app-source.cjs` 14/14、`check-app-source-recovery.cjs`、`check-app-source-v5.cjs` 通过。
- 本地完整 `npm test`：主单元测试 284/284、全部 105 组平台检查通过；版本检查覆盖 3136 组组合，Vite 前端构建与 `git diff --check` 通过。Windows 无权限创建符号链接的分支按测试既有逻辑跳过，不能视为该分支已验收。
- [标签源码 Test 44528594084](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44528594084) 成功，绑定冻结提交与 `push/v6.17`；完整回归、真实解码、前端构建、生产依赖审计和依赖/SBOM 工件步骤通过。生产依赖审计报告 0 vulnerabilities，不等同于全部构建依赖或远端 Dependabot 告警为零。
- [Windows x64 候选 44528594465](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44528594465) 的 `media` 与 `windows` 作业成功，绑定同一冻结提交与标签。FFmpeg/x264 从配套源码构建，并核对对应源码清单与实际媒体二进制。
- 候选 `installer-result.json` 为 `passed: true`、`crossVersionUpgradeTested: true`。新装、启动、同版本重装以及真实 SHA-256 固定的 `1.80.0 → 6.17.0` NSIS 安装器升级成功，保留设置、观看记录、本地存储和已有下载；安装器为 `NotSigned`。
- [发布流水线 44531693912](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44531693912) 成功，验证成功 tag CI 的仓库、提交与工作流来源，绑定安装回执，核对 EXE SHA-256、清单 SHA-512、两项草稿/公开资产摘要与集合。公开清单比较、安装包 HEAD 和 latest 版本入口检查均通过。
- 本机发行后复核确认 Release 标题、模板正文、latest 指向、不可变状态、标签提交、两项资产大小及摘要，以及实际下载的公开清单。完整安装 EXE 未在本机重新下载；本机直接访问安装包 HEAD 曾遇连接重置及超时，不能据此宣称本机网络下载已通过。入口的成功证据来自上述发布流水线。

## 随机真实素材回执

所有素材均从红果官网随机选取并真实下载，使用独立临时目录，全程不播放音频；测试完成后由测试清理。下列均为公开片段，可能仅为预览，不代表完整分集验收。

| 环境 | 素材 | 分集 ID | 字节 | SHA-256 |
|---|---|---|---:|---|
| 本机，20:41 | 《少夫人来自东北3》第 1 集 | `7706514645208534041` | 1,272,953 | `3913476b931c0f4a54d424f9a2d41060222618e9a7355d642c464084223168d3` |
| 标签源码 CI，20:57 | 《妻子背叛当天，我重掌大权》第 1 集 | `7701616849288432665` | 794,145 | `a9d54b00ff749b0cd76af6fa8692428ee7e354938c4919428026c343ae280c68` |
| Windows 候选，21:11 | 《温柔以待，终有回甘》第 1 集 | `7703824211655019582` | 857,948 | `e9ea8a7cd09e070bad4b95ac1712244210a81c8eb55015aed84391f18ca535f4` |

以上时间均为 2026-11-19 北京时间。来源页依次为：

- https://hongguoduanju.com/player/7706512650816982040
- https://hongguoduanju.com/player/7701614841315740696
- https://hongguoduanju.com/player/7703822281448901656

本地媒体工具来自 6.16 候选运行 `44320851773` 的 `windows-media` 工件，已按配套清单核对 FFmpeg/ffprobe SHA-256，仅用于隔离验证。6.17 正式包使用本版候选自行构建并验证的媒体工具。本轮未替换本机正式安装或操作正式资料。

## 验证边界

- 初始设备注册预算与队列等待不包含在后续 20 秒模型阶段内。
- 本轮未验收实体机 GUI 长时播放、画中画、连播、看完自动删除和 GPU 硬件兼容；静音解码不能替代这些验收。
- 安装包无 Windows Authenticode 签名身份，不能保证消除 SmartScreen 未知发布者提示。
- 1.80.0 到 6.17.0 的手动安装器升级不等同于应用内更新器跨版本端到端验收；后者仍单独记录。
