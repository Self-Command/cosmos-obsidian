---
name: cosmos-life
description: 在宇宙知识库组织现实方向、领域、对象、事务、经历和游记，或创建日周月季年记录。一次旅行无需项目。
compatibility: Node 24、已绑定的 Obsidian CLI；周期记录需要 Periodic Notes。
---

方向写长期指向，领域写持续职责，对象写具体人事物，事务写待处理的现实事项；经历和游记保存已发生的现场。一次记录不强制立项目。游记按真实行程写景象、行动和当时感受，费用与未提供的信息说明未知原因；照片使用实际附件。日周月季年按各自时间尺度记录，不复制同一份总结。

使用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。长正文先 `draft open --input <库外 UTF-8 JSON>`，例如 `{"category":"游记","name":"山城雨后的一天","attributes":{"date":"2026-10-10"}}`。周期用 `{"action":"journal.create","period":"day","date":"2026-10-10"}`；period 可为 day/week/month/quarter/year。代码选择当前模板。

按返回 `contentContract.fields` 的 id 填写 `{"fields":{"id":"完整 Markdown"}}`；保留字段的表头、标签和固定查询，具体内容遵循 guidance。只写这些章节的正文，代码负责总标题和属性。随后 `draft preview --draft <draftId> --input <正文 JSON>`。

展示实际目录、正文要点和 `preview.path` 全文链接。用户审阅并批准后一次 `review commit --review <reviewId> --confirm`；取消用 `review cancel`。中断后用原 review/execution ID 查询和复检，沿用已有批准，避免重复落盘。
