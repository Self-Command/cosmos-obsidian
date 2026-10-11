# 技能规范与代码职责研究

2026-10-11。此处保存官方依据和本地 skill-creator 的使用结果，不把格式合规当成行为合格。

[Agent Skills 规范](https://agentskills.io/specification)将名称/描述、正文与按需资源分开。`scripts` 提供可执行机制，`references` 提供当前任务需要的详细资料。[脚本指南](https://agentskills.io/skill-creation/using-scripts)支持明确帮助、输入输出和依赖处理。

[OpenAI 技能文档](https://learn.chatgpt.com/docs/build-skills)与[技能构建说明](https://developers.openai.com/plugins/build/skills)描述技能目录和所需资源。新技能使用必要的脚本入口；按需资源服务具体业务，不重复整套机器契约。自动发现保持，除非用户明确要求只手动调用。

[Claude 技能文档](https://code.claude.com/docs/en/skills)供兼容性核对；宿主专有字段和权限不能被当作跨后端通用授权。共同内容、宿主发现入口与实际执行分离。

本轮使用本地 `skill-creator`：确定性脚本适合重复的机械逻辑；SKILL.md 保留目的、非显然的业务语义及必要路由；详细资料按需加载。其复杂技能评估建议以有授权的独立验证为条件。本项目用户规则禁止子代理，故不委派；采用 GitHub Actions 的真实宿主盲测。

对旧实现的具体改进结论：

- 不再在每份正文附加完整调用契约，不要求反复读取相同技能。
- 规则是否接受输入由注册表/Schema/领域代码判断，正文不维护第二份约束表。
- 内容质量仍需要语义写作要求；不能为“短提示”把游记、研读、认知等具体写作责任删掉。
- 帮助与错误信息要足够可操作，使模型不必读取执行器源码排查普通输入错误。
- 验证实际用户请求、产物和回合耗时；frontmatter 验证只是必要检查之一。

新设计保留十技能职责名称，重写正文与执行方式。设计阶段还没有生成这些技能，也没有运行新脚本的验证。
