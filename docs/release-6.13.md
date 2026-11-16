# 红果短剧 6.13

状态：发行准备（内部版本 `6.13.0`，目标标签 `v6.13`）。正式发行只面向 Windows x64，公开资产只包含安装 EXE 与 `latest.yml`；本文件会在 GitHub Actions 和公开 Release 校验完成后补充冻结提交、运行编号与资产摘要。

## 本轮更新

- 侧栏账号入口改为“登录账号”，页面用两个来源卡片区分红果账号和河马账号。
- 红果账号继续使用现有网页扫码、官网登录、加密会话和 APP 观看记录流程。
- 河马账号卡片提供河马官方平台入口，明确当前没有可复用的网页二维码授权接口，不放置不能实际完成登录的二维码。
- 说明河马前几集公开、后续集数可能受看点、VIP、广告或购买权益限制；红果账号登录不会替代河马权益，也不会绕过锁集。
- 外部链接安全白名单加入 `www.kuaikaw.cn`，仍拒绝凭据 URL、自定义协议和其他主机。

## 发行形态

- 只发布 `hongguo-downloader-6.13-win-x64-setup.exe` 与由最终 EXE 生成的 `latest.yml`。
- 不发布便携包、blockmap 或普通源码 ZIP；GPL FFmpeg/x264 对应源码随安装目录附带。
- 安装包继续未配置代码签名；正式发布由标签、源码 Test、Windows x64 candidate 和发布工作流共同校验。

## 本地验证

- PASS：`node scripts/check-settings-picture-in-picture.cjs`
- PASS：`node --test src/native/external-links.test.cjs`
- PASS：`node scripts/check-hema.cjs`
- PASS：`node --test src/native/account-session.test.cjs`
- PASS：`node src/components/check-ui-state.cjs`
- PASS：`node scripts/check-source-routing.cjs`
- PASS：`node scripts/check-source-integration.cjs`
- PASS：`git diff --check`
- BLOCKED：本机 `npm run build:react` 受工作区原有的 `build/icon.ico` 与 `build/icon.png` 删除状态影响；未恢复或覆盖这些用户现有删除项。干净 CI 工作区仍需完成 React 构建、真实媒体工具、安装器和 Windows x64 验收。

## 发行边界

- 未接入河马账号会话、权益查询或官方 App 的播放协议，因此本轮不承诺河马登录后自动解锁全集。
- 真实红果视频 GUI 验收仍需使用独立目录中的随机真实下载素材，全程静音，不用彩条或测试图替代。
- Windows 安装、升级、签名与线上 Release 资产以对应 GitHub Actions 回执和公开 Release 页面为准。
