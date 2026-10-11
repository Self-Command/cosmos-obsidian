---
name: cosmos-create
description: 在宇宙知识库按当前模板创建普通实体或已登记分类的笔记。任务、周期记录和网站发布采用各自业务入口。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

明确笔记承担的职责，优先使用用户指定的已登记分类；缺少影响类型或事实的重要信息时询问。正文提供可回看的判断、依据和具体内容，未知信息说明原因。

入口：`node "<本技能实际目录>/scripts/cosmos.mjs"`。用 `draft open --input <库外 UTF-8 JSON>` 提交名称、entity 或 category、必要 attributes/relations/tags。例如 `{"category":"速记","name":"会议中的想法"}`。不知道当前登记值时用 `query model` 获取所需类别；不用遍历全库模板。

按 `contentContract.fields` 返回的字段 id、guidance 和结构填写 `{"fields":{"id":"完整 Markdown"}}`，再用 `draft preview --draft <draftId> --input <正文 JSON>`。已有完整字段内容可直接 `entity preview`。

展示目标、正文要点和 `preview.path` 全文链接。用户审阅并批准后一次 `review commit --review <reviewId> --confirm`，自动执行与复检；取消用 `review cancel`。原结果不确定时用原 `executionId` 查询 `execution verify`，不用新方案重发。
