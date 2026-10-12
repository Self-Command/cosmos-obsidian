---
name: cosmos-amytis
description: 在宇宙知识库创作或登记 Amytis 中英文文章、认知、随笔、专题、系列、书籍和章节，生成公开副本、上传、恢复或撤稿。
compatibility: Node 24、已绑定的 Obsidian CLI、库内发布服务与受控 Enveloppe。
---

本正文已由宿主加载时，直接调用本技能目录下的 scripts/cosmos.mjs。它已连接实际知识库；当前工作区不是笔记库，不扫描当前目录、安装目录或实现代码，也不重复读取本技能。精确笔记路径通过本入口的 `query notes --input <JSON>` 读取，输入 `{"path":"实际库内路径.md","includeBody":true}`；只有标题时用 title 查询，同名等用户选定。

写作给读者一个明确问题、具体展开和有边界的结论。公开许可逐篇确认；专题按主题组织，系列按阅读顺序组织，书籍按大纲组织章节。链接和成员身份不代表其他笔记获得公开许可。本地业务状态、公开许可与网站上线分别说明；稳定身份和网址不随本地改名改变。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。原创写作用 `draft open`，action=writing.create，values 明确 language、kind、slug、date、title、permission、scope；按当前模板字段填文再 `draft preview`。需要发布输入结构时用 `help publish preview`；已存在内容的登记或公开副本用 `publish preview` 的 register/copy。

`--input` 接收文件路径或 `-`，不接收内联 JSON 参数。PowerShell 标准输入示例，所有值按本次材料填写，起止标记各占一行：

```powershell
@'
{"action":"writing.create","name":"停留之后","values":{"language":"zh","kind":"post","slug":"after-a-pause","date":"2026-10-10","title":"停留之后","permission":true,"scope":"marked"}}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" draft open --input -
```

draft open 返回当前模板的 contentContract.fields；按实际字段 id 填写 `{"fields":{"实际字段id":"完整 Markdown 正文"}}`，保留 skeleton 的标签、表头和固定内容，非 repeat 字段不添加章节标题。用返回的 draftId 执行 `draft preview --draft <draftId> --input <正文 JSON>`；固定公开标记与其他模板结构由代码生成，不重新开草稿或另查实现。

独立公开副本直接用 `publish preview --input <JSON>`：`{"action":"copy","path":"来源实际路径.md","name":"副本名称","values":{"language":"zh","kind":"post","slug":"本次唯一slug","date":"本次展示日期","title":"副本标题","permission":true,"scope":"marked"}}`。代码读取来源并仅提取已有公开标记区间，来源保持不变；不从工作区找来源或手动拼公开正文。已有内容登记用 action=register、path 和同样的 values，不指定 name。

先展示本地内容的完整预览；上传另用 `query publication` 选择准确身份，以 `publish preview` 的 upload 生成全部远端正文、附件、成员和网址预览。只读复检用 `execution verify`；清单保存失败按返回 recovery 生成原批次 recover 预览，保留原分支与提交。

上传输入 `{"action":"upload","ids":["query publication 返回的准确身份"]}`。每个 review-ready 结果直接展示预览并结束当前答复，等待审阅确认；取消用 `review cancel --review <reviewId>`。只创建本地内容时不生成上传方案。

每次展示实际公开范围、警告和 `preview.link` 实际全文链接。用户审阅批准相应范围后用一次 `publish commit --review <reviewId> --confirm`。上传、PR 合并、部署和页面核验分别报告；未闭合批次用 resume/refresh 的新预览，未知结果先查询原执行，不能重新上传。
