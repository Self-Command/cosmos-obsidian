# 配置参考

## 绑定文件

业务 CLI 的配置优先级为 `--config <文件>`、`COSMOS_CONFIG` 环境变量、当前用户的 `~/.cosmos-obsidian/binding.json`。通过安装器发现的技能入口还会读取发行中的 `connection.json`；没有显式配置或环境变量时，自动使用安装时记录的绑定文件。

绑定文件是 UTF-8 JSON，只接受以下字段：

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `version` | 是 | 固定为 `1` |
| `vaultPath` | 是 | 业务库绝对路径，必须已存在；运行时校验真实位置 |
| `vaultName` | 是 | Obsidian 中的实际库名，和真实路径一起构成绑定身份 |
| `cliPath` | 是 | 官方 Obsidian CLI 可执行文件的绝对路径，必须已存在 |
| `stateRoot` | 是 | 库外状态目录绝对路径；可由运行时创建，不能位于库内或包含库目录 |
| `schemaPath` | 是 | 已存在的模型 v3 JSON 文件的库内相对路径 |
| `templateFolder` | 否 | 库内模板目录；省略时使用 `宇宙/创世/模板` |
| `timeoutMs` | 否 | CLI 等待时限，默认 `15000`，允许整数 `1000` 到 `120000` |

库内路径使用 `/`，不能带绝对路径、空路径段或 `..`。绑定不接受未知字段，也不接受模型密钥或发布令牌。路径中的空格在命令行使用引号。

示例见 [Windows](../examples/binding.windows.example.json) 和 [POSIX](../examples/binding.posix.example.json)。示例路径不代表本机存在对应文件，应逐项替换；POSIX 示例的 CLI 路径同样需要替换为本机真实入口。

## 模型与模板要求

此版本读取既有 Cosmos 模型 v3，不会初始化或迁移知识库。模型至少需要以下结构：

- `version: 3`、`entities`、`common` 与 `actions`。
- 各实体的合法目录、属性、默认值与正文映射，以及适用的分类登记。
- 与当前模板正文兼容的模板配置、版本标识和周期定义。
- `scriptFolder` 指向包含当前业务服务的库内脚本目录。

实际任务操作还读取 TaskNotes 当前字段映射、任务识别方式、默认值、目录和状态 / 优先级目录，不接受未登记的猜测值。周期记录读取 Periodic Notes 当前配置与相应模板。

运行 `query model` 查看实际可用实体；按笔记精确路径运行 `query actions` 查看当前合法动作。模板字段由 `draft open` 返回，不应自行推测固定字段数量或把程序模板直接当作静态正文执行。

模型及服务的参考接口可从[原候选源码](https://github.com/Self-Command/cosmos-obsidian/tree/d7ca68a26eb0d13fb253a891873c56b23420659d/src)查看。原测试夹具不是面向空白库的一键安装包。

## 库内业务服务

运行时从 `<schema.scriptFolder>/lib/system-engine.cjs` 加载业务工厂，并要求返回对象提供：

```text
availableActions
archiveEligibility
executeAction
normalizeValues
supplementBody
bodySections
```

规则、模板和库内服务会进入预览的依赖校验。替换这些文件后，旧预览可能过期，应读取当前状态并生成新预览。

## Amytis 发布要求

`cosmos-amytis` 使用当前库内发布体系。此发行没有通用网站初始化器，配置一个 GitHub 仓库名也不足以建立发布环境。

当前适配要求：

- 受控 Enveloppe 插件 `obsidian-mkdocs-publisher`，版本 `7.8.2`。
- 已加载 bridge v1、插件加载指纹和补丁登记指纹一致。
- `宇宙/演化/变更/amytis-implementation.json` 存在且与实际插件一致。
- `<schema.scriptFolder>/lib/` 下的 `publish-adapter.cjs`、`publish-transport.cjs`、`publish-service.cjs` 和 `publish-contract.json`。
- 发布契约 `version: 1`，其中的插件、转换配置及网站代码契约符合运行时核验要求。
- 插件中已配置发布目标及访问凭据，网站能够完成对应内容的构建和部署。

使用 `inspect capabilities` 查看当前发布插件版本、bridge 与加载身份；`query publication` 读取公开候选和持久化批次。发布登记与公开副本只改变本地文件，上传需要独立生成并确认发布预览。

公开副本默认只提取来源中已标记的公开范围。`permission`、`scope`、语言、内容类型和稳定 slug 都在预览中明确；成员关系不会自动给其他笔记公开许可。

网站地址、仓库和访问凭据属于使用者的插件及库内发布契约。发行程序会核验该契约，并不通过绑定文件接受任意新增网站后端。

## 安装发现目录

`install.mjs plan --destinations <JSON文件>` 接收绝对目录数组，例如：

```json
["C:/Users/your-user/.agents/skills"]
```

每个目录会得到十个独立技能入口。同一次方案中的目录不能重复、互相包含或与业务库 / 发行目录重叠。原入口先备份，切换后再核对链接目标；出现并发变化时拒绝继续。

同一安装根目录按候选 SHA 保存发行，因此相同候选不能在该目录改绑另一个库。为不同知识库使用不同安装根目录、配置和状态目录；同一 AI 宿主中的同名技能还需要明确区分发现范围。

## 可选诊断

设置 `COSMOS_TRACE=1` 可在 `stateRoot/metrics.jsonl` 保存命令、耗时、请求次数、相关 ID 与结果状态。此设置不是安装前提，也不负责上传遥测。使用者应按本地数据管理策略保存这些记录。

返回的 `absolutePath` 可直接用于打开实际文件；`path` 是知识库内部路径，不应拼接当前项目工作区来猜测文件位置。
