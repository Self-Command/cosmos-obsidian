> 历史档案：本文件是旧项目文档的脱敏副本。旧状态、通过项、提议和实现说明不代表新项目状态或验收；当前决定以新开发设计为准。旧私有证据及机器路径没有公开复制。

# 用户级技能发现维护 v2

技能业务接口不按厂商判断能力。发现入口是安装便利功能，不是执行授权或兼容白名单。

共同来源为用户级 .agents/skills/cosmos-*。maintain-providers.ps1 的 Check 模式只读；Apply 先检查全部目标，再创建缺失目录链接，不覆盖同名用户文件。默认处理 Claude .claude/skills 与 Grok .grok/skills；Codex 使用 .agents/skills。OpenCode 与 Pi 的共同目录支持依据其官方文档，实际加载另列验收。

使用 AdditionalSkillsRoot 可登记任何新的宿主技能目录，无需修改执行器。目录必须在知识库外，不允许父目录重定向到未核验位置；既有独立副本存在时停止并报告。连接维护只添加 Cosmos MCP 配置段，保留模型、账户、权限及其他服务器的原始字节。已有同名且不同启动命令的连接停止，不覆盖用户设置。

默认连接为 AgentHome/.codex/config.toml 的 mcp_servers.cosmos 与 AgentHome/.claude.json 的 mcpServers.cosmos。可用 CodexConfigRoot、ClaudeConfigPath 指定当前宿主配置；Claudian 发现检查须用其实际 CodexPath、知识库工作目录及相同环境。ProbeCodex 启动真实 App Server，通过 mcpServerStatus/list 查询工具；CheckRuntime 只调用原有 Obsidian 服务的 capabilities。未执行对应实测时报告 unverified，文件存在不会标记发现成功。

维护报告分别返回 skillsReady、mcpConfigured、mcpDiscovered、runtimeReady 的 status（pass/fail/unverified）与 reason；不再返回单一 ready。Check 不改连接配置或入口；Apply 全部预检后创建缺失入口与连接，在库外保存连接快照并读回，重复维护零变更。

McpManifest 指向库外 JSON 清单，可指定任意宿主，无厂商白名单：`{"targets":[{"id":"my-host","format":"json","path":"绝对库外路径","keys":["mcpServers","cosmos"]}]}`。TOML 格式用 format=toml 与 table=mcp_servers.cosmos。JSON 仅插入指定节点；不支持的复杂 TOML 形式保守报告格式冲突，要求显式迁移，不能重写整个配置。

每个技能包携带自己的相对资源。共同执行器的配置通过参数或 COSMOS_CONFIG 指定，安装器可生成本机 scripts/connection.json；它不进入公开源码，不包含凭据。同一提交重复维护不增加变更。

官方发现依据：[Codex](http[本机路径已脱敏])、[Claude](http[本机路径已脱敏])、[Grok](http[本机路径已脱敏])、[OpenCode](http[本机路径已脱敏])、[Pi](http[本机路径已脱敏])。工具是否实际可用由当前宿主的终端、文件、MCP 及 Obsidian 能力决定。
