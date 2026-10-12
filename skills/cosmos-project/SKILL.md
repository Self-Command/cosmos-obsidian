---
name: cosmos-project
description: 在宇宙知识库组织构想、项目、关联任务和交付成果；处理项目立项、范围、材料与验收。
compatibility: Node 24、已绑定的 Obsidian CLI；任务需要 TaskNotes。
---

本正文已由宿主加载时，直接调用下述入口，不再调用 Skill 或读取本文件。构想承载创造意图；项目承诺可交付的结果。先写目标、范围、完成标准和验收方式，再组织里程碑、任务和真实依据。没有已交付结果时说明尚未交付，不能把过程材料写成完成成果。资料留在各自职责目录，通过 project 关联；项目不指向自己，领域只关联实际持续职责。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。新项目先 `draft open --input <库外 UTF-8 JSON>`，例如 `{"entity":"project","name":"周末课程","relations":{"area":"实际领域的精确路径"}}`；没有领域就省略 relations。从构想推进先 `query actions` 确认当前动作，再用相应 `entity.evolve` 草稿。

按返回字段和 guidance 写实质内容，保留表头与标签；未知信息在单元格说明原因，没有日期可写“尚未排期”，不留空单元格。用 `draft preview --draft <draftId> --input <正文 JSON>`，输入为 `{"fields":{"实际字段id":"Markdown正文"}}`。项目及任务等多个文件用一个 `change preview` 方案：`{"actions":[{"action":"entity.create","entity":"project","name":"项目名","content":{"fields":{"实际字段id":"Markdown正文"}}},{"action":"task.create","title":"任务名","relations":{"project":"项目名"},"details":"具体行动和完成标准"}]}`。正文填满 draft open 返回的实际字段，任务关系由代码解析，不必另加载任务技能。用标准输入或库外 UTF-8 JSON；需要其他动作格式时读取 `help change preview`。

展示精确文件组合、关系、正文要点和 `preview.link` 实际全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`；它自动复检。部分失败说明已完成和余项，查询原执行，不能重复创建整个组合。
