# Blinko、Notion 与宿主工具的设计研究

2026-10-11；第一轮研究结果在此保存。用户明确说明 MCP 只是例子，本地已有 Obsidian CLI；因此这些项目用于分析职责和接口设计，不作为必须引入 MCP 的理由。

## Blinko

MCP 适配层登记既有 Mastra 工具及其 Zod 输入定义，用当前已验证会话的认证信息补入执行上下文；不同传输共用这些业务工具。createBlinko 工具再调用应用的 notes.upsert，数据操作属于现有业务服务。[适配源码](https://github.com/blinkospace/blinko/blob/main/server/routerExpress/mcp.ts)、[创建工具](https://github.com/blinkospace/blinko/blob/main/server/aiServer/tools/createBlinko.ts)

可借鉴：公开输入定义与业务能力绑定，调用入口不重复实现数据逻辑，认证上下文来自代码。不能将该实现一概称为安全完备：所读创建工具的类型默认处理、日志内容、caller 身份等仍有自身取舍，未进行全面安全审计。本项目不继承认证代码、日志策略或 Blinko 数据模型。

## Notion

Notion 官方工程说明回顾了最初 API 与 MCP 工具一对一映射的上下文开销，随后使用更适合代理的创建/更新页面接口与 Markdown，同时保留部分既有 API 工具。接口定义通过 OpenAPI 转 Zod 的生成管线维护。[官方说明](https://www.notion.com/en-gb/blog/notions-hosted-mcp-server-an-inside-look)

可借鉴：模型提交业务意图/内容，服务隐藏 ID、结构和多次内部调用；共享定义生成工具描述。这里是从其第一方工程说明推导的本地设计建议，不代表能直接获得或复制 Notion 托管服务内部代码。

## VS Code 与文件系统工具

VS Code 的工具启用、服务器信任与调用批准属于宿主交互机制，不由服务器描述文字自动实现。[官方文档](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

MCP 文件系统参考实现将允许目录、真实路径与服务启动放在代码中；业务操作还需要相应路径验证。参考入口独立解析环境，模块导入不启动服务，便于测试。[入口源码](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/index.ts)

可借鉴：执行入口和允许范围由代码检查，权限与业务校验分层。文件系统服务器没有 Cosmos 的类型、生命周期或发布语义；开放通用文件工具也不能替代它们。

## 保存的共同结论

1. 协议只是入口，可靠性来自输入定义、服务代码、状态管理和宿主权限。
2. 业务接口应减少模型拼接低层参数与步骤；对 Cosmos 优先是本地 CLI。
3. 确定性规则移入代码，提示词保留语义理解、写作与最少调用引导。
4. 没有宿主范围限制时，普通脚本无法阻止模型通过其他工具绕过入口；不要把描述或 annotations 当强制隔离。

这些原则进入新设计，但具体模块从新架构实现，旧执行器不得整包搬迁。
