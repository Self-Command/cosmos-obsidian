---
name: cosmos-learn
description: 在宇宙知识库从问题和资源组织研读、认知、假设、课题与检验，或整理书籍研读。区分来源与个人判断。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

资源保存来源；研读记录具体片段、解释和疑问；认知写自己的判断及适用边界；假设与检验分别写待验证主张和实际证据。收藏不等于理解，计划验证不等于已完成验证。原文引用注明位置，推断标清依据，缺少页码、实验或结果时说明未知。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。实体 id：研读 `study`、认知 `knowledge`、假设 `hypothesis`、课题 `topic`、检验 `validation`。创建用 `draft open --input <库外 UTF-8 JSON>`，指定 entity 和 name；分类仅在用户已选定时指定。书籍研读使用 `{"entity":"study","name":"本次书籍研读","variant":"bookStudy","attributes":{"source":"book"}}`，书名、作者、页码和阅读情况写入正文；不另补 format 或猜测状态。

已给完整笔记路径时用 `query notes --input <JSON>`，输入 `{"path":"实际路径.md","includeBody":true}`；title 只用于标题检索，不填完整路径。基于已有实体创建关联文件，用 `query actions --input <JSON>`，输入 `{"path":"实际路径.md"}`。按返回的动作 id 打开草稿：`{"action":"entity.evolve","path":"实际路径.md","transition":"返回的动作 id","name":"关联文件名"}`。代码保留来源并创建来源链接；不需要在没有目标时查询全局动作。

`--input` 接收文件路径或 `-`，不接收内联 JSON 参数。PowerShell 标准输入示例，起止标记各占一行：

```powershell
@'
{"entity":"study","name":"本次书籍研读","variant":"bookStudy","attributes":{"source":"book"}}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input -
```

取得草稿后，把实际模板 `contentContract.fields` 的各章节填成 `{"fields":{"实际字段 id":"完整 Markdown"}}`，保留表头、标签和 skeleton 中的固定内容，执行 `draft preview --draft <draftId> --input <正文 JSON>`。不要为同一份草稿再次打开模板；校验错误在原 draft 上修正正文。非 repeat 字段不添加章节标题，模板的其他固定章节由代码拼接。多份文件组合只生成一次 `change preview`，不额外建立不需要的课题或项目。

展示来源、判断边界、实际关系和 `preview.link` 实际全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`，自动复检。取消或中断沿用原 ID；结果不确定先 `execution verify`，不重复写入。
