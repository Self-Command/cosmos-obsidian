---
name: cosmos-check
description: 只读检查宇宙知识库指定实体的属性、路径、关系、正文、当前合法动作或原执行结果，报告证据和观察边界。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

以用户给出的范围为边界。检查结果区分原有问题和本次变更；没有变更前证据时只能报告当前观察，不能声称由本次操作导致。检查不自动修复。

使用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。`query notes --input <库外 UTF-8 JSON>` 按 path/title/entity/folder 筛选，需要正文时加 includeBody；`query actions` 查询精确路径的当前动作和归档资格。需要环境诊断时用 `inspect capabilities`，不为每次查询反复探测。

复检原执行用 `execution status --execution <executionId>` 或 `execution verify --execution <executionId>`；读取原预览用 `review show --review <reviewId>`。这些命令不派发业务变更。报告实际文件链接、差异、仍未确认的结果及必要下一步；若用户要求修复，再生成可审阅的 change preview。
