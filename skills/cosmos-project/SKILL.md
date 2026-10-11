---
name: cosmos-project
description: 在宇宙知识库组织构想、项目、关联任务和交付成果；处理项目立项、范围、材料与验收。
compatibility: Node 24、已绑定的 Obsidian CLI；任务需要 TaskNotes。
---

构想承载创造意图；项目承诺可交付的结果。先写目标、范围、完成标准和验收方式，再组织里程碑、任务和真实依据。没有已交付结果时说明尚未交付，不能把过程材料写成完成成果。资料留在各自职责目录，通过 project 关联；项目不指向自己，领域只关联实际持续职责。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。新项目先 `draft open --input <库外 UTF-8 JSON>`，例如 `{"entity":"project","name":"周末课程","relations":{"area":"实际领域的精确路径"}}`；没有领域就省略 relations。从构想推进先 `query actions` 确认当前动作，再用相应 `entity.evolve` 草稿。

按返回字段和 guidance 写实质内容，用 `draft preview --draft <draftId> --input <正文 JSON>`。项目及任务等多个文件用一个 `change preview` 方案，actions 分别包含 entity.create/task.create 与已填正文；新项目关系由代码解析。需要字段时按命令读取 `help change preview`。

展示精确文件组合、关系、正文要点和 `preview.path` 全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`；它自动复检。部分失败说明已完成和余项，查询原执行，不能重复创建整个组合。
