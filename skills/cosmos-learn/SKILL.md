---
name: cosmos-learn
description: 在宇宙知识库从问题和资源组织研读、认知、假设、课题与检验，或整理书籍研读。区分来源与个人判断。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

资源保存来源；研读记录具体片段、解释和疑问；认知写自己的判断及适用边界；假设与检验分别写待验证主张和实际证据。收藏不等于理解，计划验证不等于已完成验证。原文引用注明位置，推断标清依据，缺少页码、实验或结果时说明未知。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。创建用 `draft open --input <库外 UTF-8 JSON>`，明确 entity/category、name 和真实来源属性；书籍研读使用 entity=study、variant=bookStudy。基于已有实体创建关联研读/认知/检验时先 `query actions`，按返回的当前合法动作打开草稿。

把实际模板 `contentContract.fields` 的各章节填成 `{"fields":{"id":"完整 Markdown"}}`，保留表头、标签和查询，执行 `draft preview --draft <draftId> --input <正文 JSON>`。多份关联文件用一次 `change preview`，不额外建立不需要的课题或项目。

展示来源、判断边界、实际关系和 `preview.path` 全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`，自动复检。取消或中断沿用原 ID；结果不确定先 `execution verify`，不重复写入。
