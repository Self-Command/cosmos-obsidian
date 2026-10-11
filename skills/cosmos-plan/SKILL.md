---
name: cosmos-plan
description: 将自然语言需求组织为宇宙知识库的最小文件组合和关系，解释选型与顺序；需要落地时生成实际预览。
compatibility: Node 24、已绑定的 Obsidian CLI；纯咨询可以直接回答。
---

先理解职责和用户真正要留下的内容，优先复用已有实体。一次行动用任务，一次旅行用游记；有明确交付才立项目。资源、研读、个人认知和实际检验分别承担来源、理解、判断与证据职责。只咨询时解释建议，不写文件。

执行入口是 `node "<本技能实际目录>/scripts/cosmos.mjs"`。材料齐全的单任务直接 `task preview --input <库外 UTF-8 JSON>`，输入 title、schedule={relativeDays,time,timeZone}、estimateMinutes、priority={rank:"highest"}、details 等实际业务数据。名称不带时间冒号，时长不推导截止。

长正文用 `draft open`，指定名称与已登记 category/entity，按返回 `contentContract.fields` 写 `{"fields":{"id":"完整 Markdown"}}`，随后 `draft preview --draft <draftId> --input <正文 JSON>`。多个文件用一次 `change preview`；仅必要格式查询用 `help <命令>`，类型不清时用 `query model`。不串读十个技能或整套模板。

展示最小文件组合、实际属性与关系、正文要点和 `preview.path` 全文链接。用户审阅批准后一次 `review commit --review <reviewId> --confirm`，自动执行与复检。已有批准在中断后仍沿用；取消用 `review cancel`，未知结果用原 execution ID 查询，避免重复写入。
