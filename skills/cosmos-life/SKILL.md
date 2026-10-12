---
name: cosmos-life
description: 在宇宙知识库组织现实方向、领域、对象、事务、经历和游记，或创建日周月季年记录。一次旅行无需项目。
compatibility: Node 24、已绑定的 Obsidian CLI；周期记录需要 Periodic Notes。
---

方向写长期指向，领域写持续职责，对象写具体人事物，事务写待处理的现实事项；经历和游记保存已发生的现场。一次记录不强制立项目。游记按真实行程写景象、行动和当时感受，费用与未提供的信息说明未知原因；照片使用实际附件。日周月季年按各自时间尺度记录，不复制同一份总结。

入口是本 SKILL.md 同目录的 `scripts/cosmos.mjs`。长正文先 `draft open --input -`，例如 Bash：

```bash
node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input - <<'JSON'
{"category":"游记","name":"山城雨后的一天","tags":["旅行"],"attributes":{"date":"2026-10-10"}}
JSON
```

PowerShell 用单引号 here-string `@' … '@` 管道输入；已有库外 UTF-8 JSON 文件可用 `--input <文件>`。tags 和 relations 在顶层，状态省略时采用当前默认值。周期用 `{"action":"journal.create","period":"day","date":"2026-10-10"}`；period 可为 day/week/month/quarter/year。draft open 读取当前模板并返回写作结构；直接调用该入口，无需扫描目录、阅读脚本/绑定配置或重读已经加载的本正文。

按返回 `contentContract.fields` 的 id 填写 `{"fields":{"id":"完整 Markdown"}}`；保留字段的表头、标签和固定查询，具体内容遵循 guidance。只写这些章节的正文，代码负责总标题和属性。随后用同样的标准输入方式运行 `draft preview --draft <draftId> --input -`。

根据返回的 summary 展示实际目录、正文要点和 `preview.path` 全文链接。用户审阅并批准后一次 `review commit --review <reviewId> --confirm`，它已执行并读回复检，返回 steps 的 absolutePath 可直接链接成品。取消用 `review cancel`。中断后用原 review/execution ID 查询和复检，沿用已有批准，避免重复落盘。
