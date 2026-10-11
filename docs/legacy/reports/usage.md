> 历史档案：本文件是旧项目文档的脱敏副本。旧状态、通过项、提议和实现说明不代表新项目状态或验收；当前决定以新开发设计为准。旧私有证据及机器路径没有公开复制。

# 宇宙知识库技能包 v2

十个职责独立的技能：cosmos-plan、cosmos-create、cosmos-project、cosmos-learn、cosmos-life、cosmos-tasks、cosmos-evolve、cosmos-amytis、cosmos-files、cosmos-check。可明确指定技能，也可描述需求，由支持 Agent Skills 的宿主按描述选择。

默认写入流程：理解需求，按需读取实际模型与模板，生成具体预览，说明文件、属性、内容、关联与影响，结束本轮等待用户批准；批准后执行并复检。只读咨询直接回答。当前宿主根据完整对话处理批准、取消与范围变化，不再读取某厂商日志或要求额外来源回执。

## 安装、环境与发现

只安装 Actions 验证的同一候选。build-info.json 记录提交、runId、attempt、协议版本与逐文件 SHA256。Windows install.ps1 默认把共同执行器与十个技能放到用户级 .agents 目录，所有状态与备份在库外；同名冲突停止。

每个交付技能自带相对 references 和 scripts/cosmos.mjs。公共参考资料在源码维护一份，Actions 按各技能所需内容分发。脚本需要 Node.js 22+ 和已安装的共同执行器；通过 --config、COSMOS_CONFIG 或安装器生成的 scripts/connection.json 取得绑定配置。更换机器时重新提供配置，不依赖 SKILL.md 中的机器路径。

已配置 MCP 时直接使用 cosmos_* 工具；没有 MCP 时可运行本技能相对入口。配置缺失仍可咨询，但不能执行。配置含 vaultRoot、boundVaultRoot、installRoot、stateRoot、cliPath 与业务代码指纹；它不是账户或模型配置。

维护入口支持官方已知发现路径与自定义 AdditionalSkillsRoot。Claude 使用 .claude/skills 链接，Codex 使用共同 .agents/skills，Grok 使用 .grok/skills 链接；OpenCode、Pi 的共同目录兼容性与实际发现分开记录。新 Agent 只需能发现技能并调用终端或 MCP，不需要加入执行器白名单。用户当前账号、模型、后端与权限配置保持原样。

## v2 执行

cosmos_prepare 一次返回此次所需字段、合法目录、动作和所选模板。新技能用 cosmos_plan(output=summary) 返回摘要、planId、planHash 与库外完整正文入口；省略 output 保留旧 full previews。cosmos_plan_read 按原编号读回摘要或完整内容，支持中断继续，不重新填文。展示副本改动不会进入执行计划，指纹不一致会停止执行。用户批准后调用 cosmos_apply {planId,planHash,approved:true}。approved=true 是调用方声明，执行器不宣称独立核验真人批准；工具权限仍由宿主管理。删除、公开或新增文件范围改变时由 Agent 重新说明。

规则、受影响文件、实际关联、所用模板与相关目录会检查；无关笔记和无关模板变化不使方案失效。任务日期明确写入预览，跨日继续保留原日期。创建正文通过实际模板的动态 content 组装，属性由原有引擎和插件 API 校验。新成果保持 draft，project/area 指向真实实体，tags 原生、route 独立。

cosmos_publish_preview 返回 previewId、previewHash。上传、恢复和撤稿分别确认对应范围；cosmos_publish_apply 接受同一指纹和 approved=true。主动刷新部署单独调用 cosmos_publish_refresh，上传成功不等于上线。详见 references/tools.md 与 references/amytis.md。

## CLI 与 MCP

```sh
node scripts/cosmos.mjs --config <库外配置> cosmos_context
node scripts/cosmos.mjs --config <库外配置> cosmos_plan --input -
```

Windows 默认使用库外 UTF-8 JSON 参数文件；BOM 可接受。标准输入需要明确设置 PowerShell 的 OutputEncoding 与 Console.OutputEncoding 为 UTF-8，具体示例见 references/tools.md；不要使用默认编码的中文管道。CLI 默认紧凑 JSON，--pretty 用于人工排查。stdio MCP 使用共同 cosmos.mjs --config <库外配置> --mcp；不用在知识库新增 MCP 配置。

实际写入仍需已启用的 Obsidian CLI 与运行中的绑定库。缺少 CLI、TaskNotes 或周期插件能力时返回明确错误，不直接写 YAML 模拟业务操作。

## 更新与故障

运行候选内 update.ps1：先核对包指纹、已安装资源与用户修改，保存库外更新快照，再写入并读回。同版本重复应用不改文件。保留连接配置、后端账户与权限、旧方案、回执和锁；旧 v1 方案不自动升级执行。

SCOPE_MISMATCH：编号或指纹不属于展示方案；STALE_PLAN：相关输入变化，重新预览；PLAN_TAMPERED：保存方案不符指纹；LEGACY_PLAN：历史记录只读，重新预览当前需求。NAME_CONFLICT/EMPTY_TARGET_CONFLICT 不覆盖已有文件。RESULT_UNCERTAIN 或缺失回执先按 operationId 查询，禁止自动重跑或清锁。部分失败报告已完成项，再单独规划剩余范围。

本轮构建和自动测试全部在 GitHub Actions。真实 Claude、真实 Codex、合成 Obsidian 后端与本机实测分别记账；未经验证的其他宿主不标通过。详细迁移与验收见库外 docs/skills-v2-refactor.md 和 docs/skills-v2-acceptance.md。
