---
name: cosmos-check
description: 在宇宙知识库查找笔记、处理同名候选、读取指定正文；只读检查属性、路径、关系、合法动作和原执行结果。按标题查找并阅读已有笔记时使用。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

本正文已由宿主加载时，直接调用下述入口，不再调用 Skill 或读取本文件。以用户给出的范围为边界。检查结果区分原有问题和本次变更；没有变更前证据时只能报告当前观察，不能声称由本次操作导致。检查不自动修复。

使用 `node "<本技能实际目录>/scripts/cosmos.mjs"`。`query notes --input <库外 UTF-8 JSON>` 按 path/title/entity/folder 筛选，需要正文时加 includeBody；`query actions` 查询精确路径的当前动作和归档资格。需要环境诊断时用 `inspect capabilities`，不为每次查询反复探测。

已知标题时直接查询，Bash 输入示例：

```bash
node "<本技能实际目录>/scripts/cosmos.mjs" query notes --input - <<'JSON'
{"title":"用户指定的标题","includeBody":true}
JSON
```

PowerShell 输入示例：

```powershell
@'
{"title":"用户指定的标题","includeBody":true}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" query notes --input -
```

两个起止标记分别独占一行。同名时展示返回的最小候选并等用户选定路径，读取精确文件用 `{"path":"用户选定的库内路径.md","includeBody":true}`。需要命令格式时用 `help query notes`，不扫描技能目录或阅读实现。

复检原执行用 `execution status --execution <executionId>` 或 `execution verify --execution <executionId>`；读取原预览用 `review show --review <reviewId>`。这些命令不派发业务变更。报告文件链接直接采用返回的 absolutePath；path 是知识库内部路径，不能拼接当前工作区来猜测成品位置。说明差异、仍未确认的结果及必要下一步；若用户要求修复，再生成可审阅的 change preview。
