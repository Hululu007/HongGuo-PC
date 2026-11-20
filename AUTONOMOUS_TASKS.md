# 自主开发待办清单

来源：自主维护轮（2026-11-21 起）。优先级沿用 P0–P4。

## 进行中 / 待办

| 编号 | 优先级 | 任务 | 说明 |
|---|---|---|---|
| AT-01 | P3 | 重构 `scripts/check-ui-theme.cjs` 的动态代码拼装 | 消除 CodeQL #28–#30（js/bad-code-sanitization）：把按 id/label 拼接的 renderer 片段改为静态代码表 + Node 侧比对，或数据经非代码通道传入；以 PR CI 的 CodeQL 结果验证后合并 |
| AT-02 | P2 | 文字导出批量 fsync 移出主线程 / 按父目录分组减少重复 realpath | 现为每 JSON 同步 fsync、每候选重复 lstat/realpath；收益为大量分集导出时的主进程延迟，需保持原子性与安全边界 |
| AT-03 | P1 | 真实应用内更新器跨版本链路验收 | 历史边界（docs/AUTO_UPDATE.md）始终单独验收，未纳入常规发布 |
| AT-04 | P1 | 红果完整分集播放恢复跟进 | 上游 App 接口空响应；恢复以官方接口实际行为为准，不得把预览当完整分集验收 |
| AT-05 | P2 | EV-003/004/005/006/008（路线图未完成项） | 存储 `.bak` 恢复、下载前磁盘预检、任务健康快照、来源错误分类、日志脱敏，见 [UPGRADE_ROADMAP.md](UPGRADE_ROADMAP.md) |
| AT-06 | P1 | Windows Authenticode 发布链（EV-010） | 需要证书与 Secrets，非纯代码任务 |

## 已完成

| 轮次 | 内容 |
|---|---|
| 2026-11-21（6.20 候选） | 文字导出与删除下载内容的本地文件边界加固 + 27 例新回归，见 [AUTONOMOUS_CHANGELOG.md](AUTONOMOUS_CHANGELOG.md) |
