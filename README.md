# Cosmos Obsidian

面向 Obsidian 宇宙知识库的代码优先技能系统。业务 CLI 管理规则、模板、预览、执行与复检；技能提供精简的任务引导和内容写作要求。执行使用已有 Obsidian 官方 CLI 及插件原生服务。

当前状态：**独立发行已验收并安装，十技能各三个场景通过，旧本地文件已清理。旧远程仓库删除仍缺 GitHub `delete_repo` 权限。**

- [已安装候选与完整验收](docs/research/accepted-release-d7ca68a-20261012.md)：候选 `d7ca68a`、30 场景、原生与安装证据，以及汇总任务依赖修复的独立记录。
- [旧技能退役结果](docs/retirement-report-20261012.md)：本地清理和唯一剩余项。

- [完整开发文档](docs/development-design.md)：审阅入口、需求、架构决策、开发阶段及完成标准。
- [接口与状态契约](docs/design/contracts.md)：业务命令、数据、预览、执行及错误。
- [业务模型契约](docs/design/business-model.md)：18 类实体、现有合法动作、关系与模板边界。
- [旧实现继承审查](docs/design/reuse-audit.md)：逐项分析，避免整包照搬。
- [测试与发布验收](docs/design/verification.md)：GitHub Actions、真实模型、原生运行时及十技能多场景验收。
- [迁移和旧技能退役](docs/design/migration-retirement.md)：冻结、切换、删除条件和精确范围。
- [全部调研索引](docs/research/README.md)：官方依据、相似项目和历史研究结果。
- [项目当前状态](docs/project-state.md)。
- [实施记录](docs/implementation-progress.md)：阶段交付、验证与未完成事项。

旧仓库已按用户决定冻结。该项目从新 Git 历史与独立工作区开始；旧代码只有在完成审查后才可选择继承。
