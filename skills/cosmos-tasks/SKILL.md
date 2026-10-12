---
name: cosmos-tasks
description: 在宇宙知识库查询或创建 TaskNotes 任务，修改计划与截止日期、优先级、完成状态和重复实例。
compatibility: Node 24、已绑定的 Obsidian CLI 与 TaskNotes。
---

本正文已由宿主加载时，直接调用下述入口，不再调用 Skill 或读取本文件。把行动标题、计划开始、明确截止和预计时长分开；预计时长不推导截止。项目代表本次交付，领域代表长期职责，关系只使用实际对应实体。没有归属时省略 relations；有归属时写成 `"relations":{"project":"项目名","area":"领域名"}`，仅填已指定的键，不填 null 或顶层 project/domain。

入口是本 SKILL.md 同目录的 `scripts/cosmos.mjs`，自动使用独立安装绑定。材料齐全时把 UTF-8 JSON 直接交给一次 `task preview --input -`，例如 Bash：

```bash
node "<本技能实际目录>/scripts/cosmos.mjs" task preview --input - <<'JSON'
{"title":"补交驾校费用","schedule":{"relativeDays":1,"time":"10:30","timeZone":"Asia/Shanghai"},"estimateMinutes":60,"priority":{"rank":"highest"},"details":"携带缴费通知，核对金额，付款后保存收据。"}
JSON
```

PowerShell 的开始标记后换行，结束标记必须独占下一行，不能接在 JSON 的 `}` 后面：

```powershell
@'
{"title":"补交驾校费用","schedule":{"relativeDays":1,"time":"10:30","timeZone":"Asia/Shanghai"},"estimateMinutes":60,"priority":{"rank":"highest"},"details":"携带缴费通知，核对金额，付款后保存收据。"}
'@ | node "<本技能实际目录>/scripts/cosmos.mjs" task preview --input -
```

已有库外 UTF-8 JSON 文件可用 `--input <文件>`。当前任务模板、字段映射与规则由 task preview 读取、校验并固定。模型直接把事实交给该入口，不需要扫描目录、阅读脚本/绑定配置或再读已经加载的本正文；以结构化返回的属性与正文展示结果。

按本次事实填写；普通优先级可省略。未指定目录中的状态名时省略 status，代码读取当前 TaskNotes 默认值；展示预览返回的实际状态，不猜测 todo 等值。用户明确指定其他状态时才从当前目录选择。relativeDays 的基准默认为预览时指定时区的今天，代码一次换算并保存；明确历史基准可填 baseDate。查询用 `query tasks --input <JSON>`；更新与实例操作用 `change preview`，需要格式时用 `help change preview` 获取该命令的实际 Schema。实例和整个系列的选择不清楚时先澄清。

成功后根据返回的 summary 展示实际日期、关系、正文要点和 `preview.path` 全文链接，并结束当前回复，等待用户审阅该具体预览后的确认。创建请求只授权准备方案；不能把它或模型自己的“现在提交”当作预览批准。这是用户已确定的知识库写入流程。收到对该预览的确认后运行一次 `review commit --review <reviewId> --confirm`，它已经执行并复检，steps 的 absolutePath 可直接链接成品。取消用 `review cancel`；中断或结果不确定用原 `executionId` 查询 `execution status/verify`，沿用已有批准，不重建任务。
