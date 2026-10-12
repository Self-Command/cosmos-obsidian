---
name: cosmos-project
description: 在宇宙知识库组织构想、项目、关联任务和交付成果；处理项目立项、范围、材料与验收。
compatibility: Node 24、已绑定的 Obsidian CLI；任务需要 TaskNotes。
---

本正文已由宿主加载时，直接调用下述入口。实体 id：仅保存创造意图的构想是 `idea`；承诺可交付结果的项目是 `project`；已交付作品是 `output`。构想使用自己的模板，不因技能名含 project 就创建项目。没有已交付结果时说明尚未交付，不能把过程材料写成完成成果。资料留在各自职责目录，通过 project 关联；项目不指向自己，领域只关联实际持续职责。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。创建先 `draft open --input <库外 UTF-8 JSON>`：构想 `{"entity":"idea","name":"交换旧书的想法"}`；项目 `{"entity":"project","name":"周末课程"}`；关联成果 `{"entity":"output","name":"内部讨论方案","relations":{"project":"实际项目的精确路径.md"}}`。仅在改变已有文件的生命周期时查询 `query actions --input <JSON>`，输入必须是 `{"path":"已有文件的精确路径.md"}`；它不提供全局动作列表。需要来源正文时直接在本入口调用 `query notes`，不必加载其他技能。

`--input` 接收文件路径或 `-`，不接收内联 JSON 参数。PowerShell 标准输入示例，起止标记各占一行：

```powershell
@'
{"entity":"project","name":"周末课程"}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input -
```

任务无日期时省略 schedule/due，普通优先级省略 priority，没有归属时省略 relations；未提供的可选值不填 null。

按返回字段和 guidance 写实质内容，保留 skeleton 中的表头、标签和固定内容；模板的其他固定章节由代码拼接，不重复写入字段。非 repeat 字段不添加章节标题。未知信息在单元格说明原因，没有日期可写“尚未排期”，不留空单元格。

单文件用 `draft preview --draft <draftId> --input <正文 JSON>`，输入为 `{"fields":{"实际字段id":"Markdown正文"}}`。项目及任务的组合在 `draft open` 取得字段后，直接生成一个 `change preview`，不另生成单文件 draft preview：`{"actions":[{"action":"entity.create","entity":"project","name":"项目名","content":{"fields":{"实际字段id":"Markdown正文"}}},{"action":"task.create","title":"任务名","relations":{"project":"项目名"},"details":"具体行动和完成标准"}]}`。正文填满实际字段；任务关系由代码解析，不必另加载任务技能。需要其他动作格式时读取 `help change preview`。

展示精确文件组合、关系、正文要点和 `preview.link` 实际全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`；它自动复检。部分失败说明已完成和余项，查询原执行，不能重复创建整个组合。
