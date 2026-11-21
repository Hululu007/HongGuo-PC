# 红果短剧 6.24 发行说明

状态：远程已公开，发布工作流全流程成功（含末步公开入口探测）。公开版本 `6.24`，内部版本 `6.24.0`，标签 `v6.24`，冻结源码 `de045a7d5a3e33f5b7991ea77aabc8542574d704`。GitHub 记录的发布时间为 2026-11-21 02:37:24 UTC（北京时间 10:37:24）。上一正式版本为 6.23。仅支持 Windows x64。

发布入口：<https://github.com/yuchen0x1/HongGuo-PC/releases/tag/v6.24>。

## 发布与验证回执

| 项目 | 结果 |
|---|---|
| 主线冻结 | `de045a7d5a3e33f5b7991ea77aabc8542574d704` 已推送到 `main`（`7d270c0..de045a7`） |
| 标签源码 Test | [44855635995](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44855635995) 成功；`push`、`v6.24`、同一冻结 SHA |
| Windows x64 候选 | [44855636055](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44855636055) 成功；含 110 项平台检查、FFmpeg/x264 对应源码与媒体摘要校验、x64 NSIS 隔离安装、重装和真实 1.80.0 → 6.24.0 安装器升级资料保留 |
| 安装回执 | `passed: true`、`crossVersionUpgradeTested: true`；Authenticode 为 `NotSigned` |
| 发布工作流 | [44856863451](https://github.com/yuchen0x1/HongGuo-PC/actions/runs/44856863451) **全流程成功**，含最后的公开入口探测（6.18/6.21/6.23 曾在此失败，本轮通过） |
| 公开状态（独立核验） | API 返回 `v6.24`、非草稿、非预发布、`immutable: true`；`/releases/latest` 已指向 `v6.24` |
| 公开资产核验 | 匿名下载公开 `latest.yml` SHA-256 与 GitHub 资产 digest 一致；公开安装器 HEAD 302→200、Content-Length 与候选一致 |
| 签名 | `NotSigned` |

## 正式资产

候选工件 ID：`14688345520`（`windows-release-candidate`）、`14688171451`（`windows-verification`）、`14687566878`（`windows-media`）。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `hongguo-downloader-6.24-win-x64-setup.exe` | 146,466,902 | `7cbcef9affc03cb3dc0a0819860fe4a2dad12c8c7e553bbd1c30cd156f6ab7ff` |
| `latest.yml` | 380 | `3a408f79c9c9007000159c4eb185ff2d581984b86511e8bc6d9d96f2c5eb2b0c` |

`latest.yml` 声明版本 `6.24.0`、相同安装器文件名和 `146466902` 字节，SHA-512 为：

```text
jZ4zq9u1z2MGaZAY3hOSVVxHz/BBMpE/Z58UbSSZSuCKJC57cc8eFt4p1BQn0F6XyIA/MabE1Uof7rf7v/+57w==
```

## 本轮范围：修复红果完整分集取源（上游 AT-04 闭环）

1. App 接口返回 HTTP 200 空响应时，取源在轮次内按固定阶梯恢复：当前 V5 POST → 备用官方主机（`sinfonlinea`）同请求 → 签名 `GET /reading/bookapi/video_tab/multi_video_model/v1/`。只有 `EMPTY_RESPONSE` 推进阶梯；明确拒绝（HTTP 403/429）与业务拒绝仍立即停止。
2. `signPlaybackV5` 新增无正文模式（`body: null`，对空缓冲取 MD5 分支、省略 `x-ss-stub`），沿用既有 N3urda/hongguoTV 18c37c2 移植的 V5 签名算法。路由与参数对照上游 `jackotom/hongguo-drama` 7.7（issue #130，提交 `92df757ed`）移植，其文档注明参数结构参考 GPL-3.0-only 的 `tsukiyo-zero/hongguoTV` tabVideoModel；本项目保留同一 GPL-3.0 许可链并在此致谢上述贡献者。
3. 整轮阶梯失败后才换新匿名播放设备身份再试，总体 20 秒、单请求 12 秒预算不变；轮次内不再提前轮换身份。
4. 响应解析兼容 `video_tab` 的 `data.video_model_data[vid].video_model`（模型对象或 JSON 字符串、数组/对象形式 `video_list`），始终只匹配请求的分集编号，并保留既有的画质、地址域名、加密元数据与备用片源身份/时长校验。
5. 回归：`scripts/check-app-source-recovery.cjs` 新增阶梯序列、`video_tab` GET 请求形态（无 POST 正文、无摘要头、版本字段 `7.4.3.32`、空 `from_video_id`）、字符串/数组模型与邻居分集不匹配等断言；`scripts/check-app-source.cjs` 的空响应用例按「阶梯内先恢复、整轮失败才轮换身份」更新。版本回归扩至 6.24（3969 版本对）。

## 真实取源验证（只读诊断，未下载媒体，全程静音）

修复前后对照（`scripts/diagnose-playback.cjs`，北京时间 2026-11-21）：

| 剧名 | 修复前（10:01–10:03） | 修复后（10:14–10:16） |
|---|---|---|
| 嫌疑人的秘密2藏金生死线（7706404415887903806，用户报告） | App/api 均 `EMPTY_RESPONSE` | `sourceAvailable: true`（OK，1.2s） |
| 她那么骄（7701652979782257689） | App/api 均 `EMPTY_RESPONSE` | `sourceAvailable: true`（OK，1.2s） |
| 妻子背叛当天，我重掌大权（随机 7701614841315740696） | — | `sourceAvailable: true`（OK，1.0s） |

网页路由仍只提供预览（`PREVIEW_ONLY`），客户端继续拒绝把预览当完整片源。

## 安装与已知限制

- Windows x64 用户可下载本版安装 EXE 覆盖安装，或由既有安装版应用内更新；安装器跨版本升级不等于真实应用内更新器端到端验收。
- Windows EXE 仍未签名。实体 GPU/HEVC、长时播放、真实 NAS、真实应用内更新器跨版本链路未在本轮验收。
- 本轮真实验证限于取源成功与元数据校验，未下载完整分集媒体或实机播放；CI 的真实媒体回归仍为公开片段解码，全程静音。
