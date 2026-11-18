# 安全政策

安全修复面向最新正式的 Windows x64 安装版。历史标签、资产和回执用于追溯。请使用 [GitHub 私密安全报告](https://github.com/yuchen0x1/HongGuo-PC/security/advisories/new)，附应用版本、影响范围和脱敏证据。请从报告中移除账号、代理凭据、签名媒体链接及个人路径。

公开发布走候选构建、安装验收、摘要验证及受限发布环境。GitHub HTTPS、安装包摘要、发行锁定与 Windows Authenticode 是各自独立的验证。当前签名状态和实际更新验证范围见 [更新指南](docs/AUTO_UPDATE.md)。

仓库通过 Dependabot、Secret Scanning、推送保护、Dependency Review 和 CodeQL 接收安全信号。优先核实可随安装包分发或可由应用输入触发的风险。构建依赖报告与 CycloneDX 清单保留在 Test 工作流工件中，供维护者复核。