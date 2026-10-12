---
name: cosmos-life
description: 在宇宙知识库撰写或创建游记、旅行记录和现实经历；也组织方向、领域、对象、事务及日周月季年记录。用户明确游记分类或提供完整旅行材料时使用。
compatibility: Node 24、已绑定的 Obsidian CLI；周期记录需要 Periodic Notes。
---

本正文已由宿主加载时，直接调用下述入口，不再调用 Skill 或读取本文件。游记日期放在 attributes.date，采用材料中实际发生的日期。方向写长期指向，领域写持续职责，对象写具体人事物，事务写待处理的现实事项；经历和游记保存已发生的现场。一次记录不强制立项目。游记逐项保留已给出的时间、路线、停留、距离、费用、行动与感受，按真实行程写景象、行动和当时感受；未提供的信息说明未知原因，照片使用实际附件。日周月季年按各自时间尺度记录，不复制同一份总结。

入口是本 SKILL.md 同目录的 `scripts/cosmos.mjs`。长正文先 `draft open --input -`，例如 Bash：

```bash
node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input - <<'JSON'
{"category":"游记","name":"山城雨后的一天","tags":["旅行"],"attributes":{"date":"2026-10-10"}}
JSON
```

PowerShell 输入的起止标记分别在独立行，结束标记不能紧接 JSON 的 `}`：

```powershell
@'
{"category":"游记","name":"山城雨后的一天","tags":["旅行"],"attributes":{"date":"2026-10-10"}}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input -
```

已有库外 UTF-8 JSON 文件可用 `--input <文件>`。tags 是顶层列表；无项目或领域时省略 relations，有实际归属才填顶层对象 `"relations":{"project":"项目名","area":"领域名"}`，仅保留已指定的键，不能填数组、null 或顶层 project/domain。状态省略时采用当前默认值。实际实体 id：方向 direction、领域 area、对象 object、事务 routine、经历 record；分类仅用登记的目录名称，例如交流记录 `{"entity":"record","category":"交流","name":"一次交流","attributes":{"date":"2026-10-09"}}`，对象 `{"entity":"object","name":"收纳盒"}`，事务 `{"entity":"routine","name":"每周整理"}`。不要把中文实体名当作 category。

周期用 `{"action":"journal.create","period":"day","date":"2026-10-10"}`；period 可为 day/week/month/quarter/year。draft open 读取当前模板并返回写作结构，模板中的其他固定章节由代码拼接，非 repeat 字段不添加章节标题。

按返回 `contentContract.fields` 的 id 填写 `{"fields":{"id":"完整 Markdown"}}`；保留字段的表头、标签和固定查询，具体内容遵循 guidance。只写这些章节的正文，代码负责总标题和属性。后续完整参数在返回的 `next.arguments`，正文 JSON 符合 `next.inputSchema`，继续通过标准输入交给 `draft preview --draft <draftId> --input -`。PowerShell 中两个命令均先写 `@'` 并换行，再放 JSON，最后用独占一行的 `'@` 接管道给 node。

多份记录一起审阅时，分别 `draft open` 获取字段后直接用一个 `change preview --input <JSON>`，不另生成各单文件的 draft preview。示例：`{"actions":[{"action":"journal.create","period":"day","date":"2024-04-03","content":{"fields":{"实际字段id":"日记正文"}}},{"action":"journal.create","period":"week","date":"2024-04-03","content":{"fields":{"实际字段id":"周记正文"}}}]}`。对象与事务用同样组合形式，action=entity.create 并分别指定 entity。每次预览调用按顺序执行，返回一个包含全部文件的审阅方案。

长正文或多个 actions 优先保存为库外 UTF-8 JSON 文件，再通过 `--input <文件>` 提交；用 JSON 序列化生成嵌套对象，不手工拼接结束括号。遇到“输入需要 UTF-8 JSON”时，也可能是 JSON 语法错误：先对该输入文件调用 `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('JSON valid')" "实际输入文件"`，按返回的位置修正引号或括号，再重试预览。仅反复转码无法修复语法；不读取执行器源码或重复打开已有模板。

根据返回的 summary 展示实际目录、正文要点和 `preview.link` 实际全文链接，并结束当前回复，等待用户审阅该具体预览后的确认。创建请求只授权准备方案；不能把它或模型自己的“现在提交”当作预览批准。这是用户已确定的知识库写入流程。收到对该预览的确认后一次 `review commit --review <reviewId> --confirm`，它已执行并读回复检，返回 steps 的 absolutePath 可直接链接成品。取消用 `review cancel`。中断后用原 review/execution ID 查询和复检，沿用已有批准，避免重复落盘。
