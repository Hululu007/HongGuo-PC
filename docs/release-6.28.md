# 红果短剧 6.28 发行说明

状态：源码发行目标 `6.28.0`，公开版本 `6.28`，标签 `v6.28`。上一正式版本为 6.27。仅支持 Windows x64。

## 本轮范围：修复红果在线播放（「播放接口空响应」）

现象：6.27 安装版在「我的剧库」「发现」「搜索与下载」等处在线播放红果分集时，取源失败并提示 `App：播放接口空响应，可能是签名或设备鉴权问题`，播放器停在 `0:00 / 0:00`。

### 根因（本机实测，2026-11-24）

红果 App 播放模型接口开始拒绝旧的请求画像，返回 HTTP 200 且正文为空。同一匿名身份、同一分集、同一签名实现下的单变量对照：

| 请求画像 | 端点 | 结果 |
| --- | --- | --- |
| 7.4.3.32 / `version_code=74332` | `player/v1` | 200，0 字节 |
| 7.4.3.32，仅改 Medusa 字段 21=312 | `player/v1` | 200，0 字节 |
| 7.4.5.32 / `version_code=74532`，仅换端点 | `preload/v1` | 200，0 字节 |
| 7.4.5.32 + Medusa 字段 21=312 | `preload/v1`（`dr_scene=preload`、`device_level=2`） | 200，约 22 KB 完整模型 |

即新版 App 请求画像与 Medusa 明文字段 21 必须同时生效，任一项单独更改仍是空响应。该结论与上游红果 TV 0.16.14（issue #102）记录的 `field21=312` 一致；其内部 SDK 含义仍未确认，本仓库只按可复现报文对齐。

### 修复内容

1. 播放模型请求改用 7.4.5.32 画像：`version_code`/`update_version_code`/`manifest_version_code=74532`、`version_name=7.4.5.32`、`channel=update_64`、`device_type=25053RT47C`、`os_version=16` 等，与已注册匿名身份一起签名。
2. 播放模型端点改为 `/novel/player/multi_video_model/preload/v1`，默认主机 `reading.snssdk.com`；空响应阶梯第二跳改为官方 `api5-normal-sinfonlineb.fqnovel.com` 同路径。
3. 请求体按当前画像发送 `dr_scene=preload`、`biz_param.device_level=2`，其余字段不变。
4. Medusa 明文 wire 字段 21 由 `377` 改为 `312`；V5 签名算法、载体、ticket 选择与 Helios/Khronos 均未改动。
5. `video_tab` 无正文 GET 恢复阶梯同步使用上述画像与 UA，避免阶梯后两级继续被旧画像拒绝。

### 未改变的行为

- 匿名注册、身份轮换、空响应阶梯（POST → 备用主机 → `video_tab` GET）、有界重试与总预算保持原样。
- 明确拒绝（HTTP 403/429）、业务拒绝、取消与超时仍立即停止，不进入恢复阶梯。
- 片源地址白名单、加密密钥解析、Codec 过滤、清晰度降级规则、本地资料格式与安装升级方式均未改动。
- 下载、NAS、弹幕、账号与观看记录逻辑未涉及。

## 回归与真实验收

- `node scripts/check-app-source.cjs`：14/14 通过（新画像、`preload` 端点、`dr_scene`/`device_level`、空响应阶梯与备用主机断言）。
- `node scripts/check-app-source-v5.cjs`、`node scripts/check-app-source-recovery.cjs`：通过（端点、画像、`video_tab` 画像与 UA）。
- `npm test`：Node 单元测试与 112 项平台检查全部通过，其中真实媒体解码组 27/27（随机红果官网公开片段 + FFmpeg/ffprobe）。
- 真实取源与播放验收，随机选取、全程静音、独立临时目录、仅删除本轮素材：

| 剧集 | 分集 | 取源 | 媒体 | 解码 |
| --- | --- | --- | --- | --- |
| 《她那么骄》`7701652979782257689` | 第 3 集 | App 1080P HEVC，约 3.3 秒 | HTTP 200，3,917,738 字节，解密后 HEVC 1080×1920 25fps + AAC | 前 90 帧与整集静音解码干净 |
| 《我的婆婆我罩着2：一致对外》`7706890951175719961` | 第 3 集 | App 1080P HEVC，约 4.7 秒 | HTTP 200，14,340,232 字节，解密后 HEVC 1080×1920 30fps + AAC | 前 90 帧与整集静音解码干净 |
| 《女儿受辱，龙头老爹他横扫无敌》`7707136537850301465` | 第 1 集 | App 1080P HEVC，约 1.4 秒 | HTTP 200，20,392,261 字节，MP4 容器 HEVC + AAC | 解密后容器与流信息完整 |
| 《嫌疑人的秘密2藏金生死线》`7706404415887903806` | 第 3 集 | App 1080P HEVC，约 1.0 秒 | HTTP 206，2,621,440 字节 | ffprobe 识别 HEVC 1080×1920 + AAC |

未在本轮执行安装包级 GUI 长时播放、画中画、连播与看完自动删除验收；这些仍需真机安装包验证。

## 兼容性

- 公开版本/标签/下载文件名保持两段式：`6.28`、`v6.28`、`hongguo-downloader-6.28-win-x64-setup.exe`。
- 普通用户资产仍只有安装 EXE 与 `latest.yml`；不发布便携包、blockmap、源码 ZIP 或 hash 清单。
- 旧版客户端应用内更新流程不变。

## 验收边界与已知限制

- 取源依赖红果 App 接口与其服务端策略；本轮只修复可复现的客户端请求画像缺陷，不保证第三方接口长期可用。
- 上游若再次更换画像或签名常量，可能重新出现空响应；届时须按同一方法（单变量报文对照）确认，不得凭猜测改签名。
- 未记录任何登录凭据、匿名身份值、签名值或带签名的媒体地址。

## 相关文档

- 历史播放修复：[fix-app-source-empty-response.md](fix-app-source-empty-response.md)、[source-stability-2026-11-20.md](source-stability-2026-11-20.md)
- 发行流程：[RELEASING.md](RELEASING.md)
- 自主待办与变更：[AUTONOMOUS_TASKS.md](../AUTONOMOUS_TASKS.md)、[AUTONOMOUS_CHANGELOG.md](../AUTONOMOUS_CHANGELOG.md)