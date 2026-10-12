# 全部调研结果索引

这些文件保存本次重建之前与本次设计使用的研究结论。历史结论与当前决策分别记录，避免删掉失败证据或把旧通过项当作新验收。

| 研究结果 | 范围与当前用途 |
| --- | --- |
| [Obsidian CLI 与高度相似项目](obsidian-cli-projects-20261011.md) | 深读 9 个直接相关项目的关键源码，筛查 2 个项目；保存发现、局限和当时结论 |
| [Blinko、Notion 与宿主工具设计](business-tools-20261011.md) | 面向业务接口、共享服务、参数校验与权限边界；MCP 是例子，不是新架构前提 |
| [技能规范与执行职责](skill-standards-20261011.md) | Agent Skills、OpenAI、Claude 与本地 skill-creator 规范，短正文与代码职责 |
| [旧系统故障和性能研究](legacy-findings-20261011.md) | 真实会话慢的证据、旧测试局限、源码与安装基线区别 |
| [历史报告档案](../legacy/reports/) | 旧仓库全部 docs 文档的脱敏副本；历史上下文，不代表新架构或新验收 |
| [旧实现逐项继承分析](../design/reuse-audit.md) | 结合研究与旧源码的采用/重写/舍弃决定 |
| [独立发行最终验收](accepted-release-d7ca68a-20261012.md) | 已安装候选、十技能 30 场景、功能及原生证据来源 |
| [旧技能退役报告](../retirement-report-20261012.md) | 本地退役与旧远程删除全部完成 |

研究方法：官方文档、第一方仓库文档、关键源码、必要测试源码与只读本地核对。没有安装参考项目，没有在生产库执行测试操作。测试源码阅读只证明其设计覆盖，不证明本次运行通过。

公开保存的是研究结果、主要来源、设计选择和脱敏历史报告；不复制第三方整库、完整网页或私人原始会话。第三方项目的源码链接可能变化，实施时须固定所采用版本与许可证。旧远程仓库未来删除后，档案仍保存结论；关键旧验收证据在退役前另行迁存。

当前决策以 [development-design.md](../development-design.md) 为准。相似项目报告中“保留旧引擎加业务 CLI”的建议形成于用户要求独立重建之前，已经被新仓库/新架构及逐项继承审查取代。

## 主要来源清单

- [Obsidian 官方 CLI](https://obsidian.md/help/cli)、[官方技能](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md)。
- [TaskNotes CLI](https://github.com/callumalpass/tasknotes/blob/main/docs/obsidian-cli.md)、[运行时 API](https://github.com/callumalpass/tasknotes/blob/main/docs/javascript-api.md)、[任务服务](https://github.com/callumalpass/tasknotes/blob/main/src/services/task-service/TaskCreationService.ts)。
- [TaskNotes Workflows 引擎](https://github.com/callumalpass/tasknotes-workflows/blob/main/src/workflowEngine.ts)、[步骤注册表](https://github.com/callumalpass/tasknotes-workflows/blob/main/src/stepRegistry.ts)。
- [Obsidian Copilot 工具层](https://github.com/logancyang/obsidian-copilot/blob/master/src/tools/ObsidianCliTools.ts)、[CLI 客户端](https://github.com/logancyang/obsidian-copilot/blob/master/src/services/obsidianCli/ObsidianCliClient.ts)、[测试](https://github.com/logancyang/obsidian-copilot/blob/master/src/services/obsidianCli/ObsidianCliClient.test.ts)。
- [Claudian 权限适配器](https://github.com/YishenTu/claudian/blob/main/src/providers/acp/ACPPermissionAdapter.ts)。
- [Obsidian VFS 路径检查](https://github.com/otaviof/obsidian-vfs/blob/main/packages/core/src/path-security.ts)、[CLI 队列适配](https://github.com/otaviof/obsidian-vfs/blob/main/packages/core/src/obsidian-cli.ts)。
- [Storks CLI runner](https://github.com/Storks/obsidian-mcp/blob/master/src/obsidian_mcp/runner.py)、[ZethicTech CLI](https://github.com/ZethicTech/obsidian-mcp/blob/main/src/cli.ts)、[相关测试](https://github.com/ZethicTech/obsidian-mcp/blob/main/src/__tests__/security.test.ts)。
- [sooneocean 业务命令](https://github.com/sooneocean/obsidian-agent/blob/main/src/commands/note.mjs)、[模板引擎](https://github.com/sooneocean/obsidian-agent/blob/main/src/templates.mjs)。
- [Blinko MCP 适配](https://github.com/blinkospace/blinko/blob/main/server/routerExpress/mcp.ts)、[业务工具](https://github.com/blinkospace/blinko/blob/main/server/aiServer/tools/createBlinko.ts)。
- [Notion 工程说明](https://www.notion.com/en-gb/blog/notions-hosted-mcp-server-an-inside-look)。
- [VS Code MCP 管理](https://code.visualstudio.com/docs/agent-customization/mcp-servers)、[MCP 文件系统实现](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)。
- [Agent Skills 规范](https://agentskills.io/specification)、[脚本指南](https://agentskills.io/skill-creation/using-scripts)、[OpenAI 技能文档](https://learn.chatgpt.com/docs/build-skills)、[OpenAI 技能构建](https://developers.openai.com/plugins/build/skills)、[Claude 技能文档](https://code.claude.com/docs/en/skills)。
