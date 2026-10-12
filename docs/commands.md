# 命令参考

业务入口为 `node runtime/cosmos.mjs`。所有输入结构以当前程序返回的 Schema 为准：

```text
node runtime/cosmos.mjs help --pretty
node runtime/cosmos.mjs help change preview --pretty
node runtime/cosmos.mjs help publish preview --pretty
```

帮助命令不需要绑定或运行中的 Obsidian。业务命令使用 `--config` 或安装连接中的绑定。

## 命令目录

| 命令 | 输入 / 标识 | 作用 |
| --- | --- | --- |
| `inspect capabilities` | 无 | 读取实际库、插件版本及运行时能力 |
| `query model` | 可选 `--input` | 读取模型，可按 `entity` / `category` 过滤 |
| `query notes` | `--input` | 按 `path`、`title`、`entity`、`folder` 查询，支持 `includeBody`、`limit` |
| `query tasks` | `--input` | 按 `title`、`status`、`folder`、`project` 查询 TaskNotes 任务 |
| `query actions` | `--input`，其中 `path` 必填 | 读取精确笔记的合法动作和归档资格 |
| `query publication` | 无 | 读取公开候选与当前持久化批次 |
| `task preview` | `--input` | 生成新任务的完整属性、正文和执行方案 |
| `entity preview` | `--input` | 用完整内容生成实体预览 |
| `draft open` | `--input` | 固定实体、周期、生命周期或写作所需的当前模板契约 |
| `draft preview` | `--draft`、`--input` | 为原草稿填写正文并生成不可变预览 |
| `change preview` | `--input` | 生成任务、实体、关系、正文、文件或生命周期组合变更 |
| `publish preview` | `--input` | 生成登记、副本、上传、恢复、刷新或撤稿预览 |
| `review show` | `--review` | 读取原完整预览 |
| `review commit` | `--review`、`--confirm` | 提交已审阅的原方案，执行并复检 |
| `publish commit` | `--review`、`--confirm` | 提交已审阅的原发布方案 |
| `review cancel` | `--review` | 取消尚未派发的方案 |
| `execution status` | `--execution` | 查询原执行状态，不派发新业务操作 |
| `execution verify` | `--execution` | 查询原回执并读回实际结果，不重发原操作 |

`--json` 为 JSON 输出标志，JSON 本来就是默认格式；`--pretty` 用于格式化输出。输入文件采用 UTF-8 JSON，也可通过 `--input -` 从标准输入读取。`--input` 后不能直接粘贴 JSON 字符串。

## 输入示例

PowerShell 标准输入：

```powershell
@'
{"title":"项目验收","includeBody":true,"limit":10}
'@ | node ./runtime/cosmos.mjs query notes --input - --config C:/CosmosData/binding.json --pretty
```

Bash 标准输入：

```bash
node ./runtime/cosmos.mjs query notes --input - --config /home/your-user/.cosmos-obsidian/binding.json --pretty <<'JSON'
{"title":"项目验收","includeBody":true,"limit":10}
JSON
```

同名候选需要选定后再用准确 `path` 查询，不能默认采用第一个结果。关系目标也必须唯一且符合目标实体类型。

新任务顶层字段为 `title`、`status`、`schedule`、`due`、`estimateMinutes`、`priority`、`relations`、`tags`、`contexts`、`recurrence`、`details`。`title` 必填；日期结构包含 `timeZone`，可用 `date` 或 `relativeDays`，相对日期在预览时计算并保存。预计时长不推导截止。

普通任务省略 `status`，使用当前插件默认值；关系仅填写已指定的键，例如 `{"relations":{"project":"项目名称"}}`。更新动作放在 `change preview` 的 `actions` 数组中，例如：

```json
{
  "actions": [
    {"action": "task.complete", "path": "实际任务目录/任务名称.md"}
  ]
}
```

重复实例完成使用 `task.instance.complete`，跳过使用 `task.instance.skip`，同时指定原任务 `path`、准确 `date` 和 `completed: true`。`completed: false` 撤销对应完成或跳过标记；同一文件的多个动作需按实际支持范围分成相继审阅的方案。

实体与写作正文通过 `draft open` 返回的 `contentContract.fields` 组织，随后用 `{"fields":{"实际字段id":"Markdown正文"}}` 交给 `draft preview`。保留模板契约中的固定内容，不重新推测字段 ID。

## 安装器

入口为 `node runtime/install.mjs`。从完整发行的 `runtime/` 目录读取载荷，`--package` 可改为另一个完整载荷目录。

| 命令 | 必要参数 | 作用 |
| --- | --- | --- |
| `help` | 无 | 输出安装命令 |
| `stage` | `--root ROOT --config BINDING` | 校验载荷和绑定，暂存到独立发行目录 |
| `plan` | `--root ROOT --destinations JSON_FILE` | 生成入口切换方案和全文预览 |
| `switch` | `--root ROOT --installation ID --confirm` | 按原安装方案备份并切换发现入口 |
| `status` | `--root ROOT --installation ID` | 读取原安装方案状态与备份位置 |
| `recover` | `--root ROOT --installation ID --confirm` | 恢复状态为 `switching` / `partial` 的未完成切换 |

业务 `reviewId`、`executionId`、`draftId` 与安装 `installationId` 是不同标识。复制程序实际返回的完整 ID，不使用文档中的 `r-...`、`e-...` 或 `i-...` 作为真实值。
