---
name: cosmos-files
description: 在明确范围内搜索、修改宇宙知识库正文与项目/领域关系，改名、同阶段移动或回收业务笔记。
compatibility: Node 24、已绑定的 Obsidian CLI。
---

按用户指定范围整理。名称相近时给最小候选，不选第一份；正文修改保留未涉及的内容。改名使用原生服务更新实际引用，移动不擅自改变生命周期。系统维护、附件批量清理和未知大范围回收需独立确定范围。

入口：`node "<本技能实际目录>/scripts/cosmos.mjs"`。用 `query notes --input <库外 UTF-8 JSON>` 指定 path/title/folder/entity，需要正文才加 includeBody。生成 `change preview`，例如 `{"actions":[{"action":"content.patch","path":"实际路径.md","find":"唯一原文片段","replace":"新的正文"}]}`；其他动作是 relations.patch、file.rename、file.move、file.recycle，按需用 `help change preview` 获取结构。

`--input` 接收文件路径或 `-`，不接收内联 JSON 参数。PowerShell 标准输入示例，替换为实际目标与唯一片段，起止标记各占一行：

```powershell
@'
{"actions":[{"action":"content.patch","path":"地球/地层/事件/整理记录.md","find":"盒子是蓝色。","replace":"盒子是绿色。"}]}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" change preview --input -
```

同一文件的不同动作分成相继审阅的方案，不在一个方案中重复安排同一路径。

展示精确目标、正文差异、引用变化及 `preview.link` 实际全文链接。用户审阅批准后一次 `review commit --review <reviewId> --confirm`，自动执行与复检。取消用 `review cancel`。结果不确定用原 `executionId` 查询 `execution verify`，不靠失败消息认定零变更。
