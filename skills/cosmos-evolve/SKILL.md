---
name: cosmos-evolve
description: 在宇宙知识库按当前合法生命周期推进实体、补齐正文、创建关联文件或执行七天资格归档。
compatibility: Node 24、已绑定的 Obsidian CLI 与库内生命周期服务。
---

推进代表实际职责或阶段改变；补正文保留既有叙事顺序。区分同一文件推进和另建关联研读、认知、成果；完成、公开许可和网站上线各有自己的证据。归档须具备当前服务判定的资格，不后台自动推进。

入口：`node "<本技能实际目录>/scripts/cosmos.mjs"`。对精确目标执行 `query actions --input <库外 UTF-8 JSON>`，输入 `{"path":"实际相对路径.md"}`；必要时用 `query notes` 读取正文。使用返回的动作 id 作为 transition，不猜阶段名称。

需要正文时 `draft open` 输入 `{"action":"entity.evolve","path":"实际相对路径.md","transition":"当前动作 id"}`，按返回字段填正文再 `draft preview`。无需新增正文的动作可直接 `change preview`；具体 Schema 用 `help change preview` 获取。

展示原文件与新文件的关系、实际变化、资格说明和 `preview.link` 实际全文链接。审阅批准后一次 `review commit --review <reviewId> --confirm`。中断查询原 execution，沿用批准；部分完成不全范围回滚或重新推进。
