---
name: cosmos-amytis
description: 在宇宙知识库创作或登记 Amytis 中英文文章、认知、随笔、专题、系列、书籍和章节，生成公开副本、上传、恢复或撤稿。
compatibility: Node 24、已绑定的 Obsidian CLI、库内发布服务与受控 Enveloppe。
---

写作给读者一个明确问题、具体展开和有边界的结论。公开许可逐篇确认；专题按主题组织，系列按阅读顺序组织，书籍按大纲组织章节。链接和成员身份不代表其他笔记获得公开许可。本地业务状态、公开许可与网站上线分别说明；稳定身份和网址不随本地改名改变。

用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。原创写作用 `draft open`，action=writing.create，values 明确 language、kind、slug、date、title、permission、scope；按当前模板字段填文再 `draft preview`。需要发布输入结构时用 `help publish preview`；已存在内容的登记或公开副本用 `publish preview` 的 register/copy。

先展示本地内容的完整预览；上传另用 `query publication` 选择准确身份，以 `publish preview` 的 upload 生成全部远端正文、附件、成员和网址预览。只读复检用 `execution verify`；清单保存失败按返回 recovery 生成原批次 recover 预览，保留原分支与提交。

每次展示实际公开范围、警告和 `preview.path` 全文链接。用户审阅批准相应范围后用一次 `publish commit --review <reviewId> --confirm`。上传、PR 合并、部署和页面核验分别报告；未闭合批次用 resume/refresh 的新预览，未知结果先查询原执行，不能重新上传。
