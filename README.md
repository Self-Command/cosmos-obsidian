# Cosmos Obsidian

[![Production distribution](https://github.com/Self-Command/cosmos-obsidian/actions/workflows/distribution.yml/badge.svg)](https://github.com/Self-Command/cosmos-obsidian/actions/workflows/distribution.yml)
[![Release](https://img.shields.io/github/v/release/Self-Command/cosmos-obsidian)](https://github.com/Self-Command/cosmos-obsidian/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-green.svg)](release.json)

**将自然语言请求转为可审阅、可执行、可复检的 Obsidian 知识库操作。**

Cosmos Obsidian 提供十个 Agent Skills 和独立业务运行时，覆盖任务、项目、学习、生活记录、文件维护及内容发布。技能负责理解需求和组织内容；代码读取当前知识库的规则与模板，固定完整预览，通过 Obsidian CLI 调用应用内原生服务，并保存执行回执。

项目按独立配置绑定知识库，安装目录与运行状态放在库外。发行包包含预构建程序及所需 Node 依赖，无需执行 `npm install`；AI 宿主、Obsidian 和相关插件由使用者提供。

> 当前发行面向采用 **Cosmos 模型 v3** 的知识库。配置支持不同用户和库路径，但完整业务需要兼容的规则、模板及库内服务。发行包不包含个人笔记，也不提供空白知识库的一键初始化。安装前请检查[运行要求](#运行要求)。

[下载 Release](https://github.com/Self-Command/cosmos-obsidian/releases/latest) · [配置参考](docs/configuration.md) · [命令参考](docs/commands.md) · [更新记录](CHANGELOG.md) · [问题反馈](https://github.com/Self-Command/cosmos-obsidian/issues)

## 目录

- [功能与工作方式](#功能与工作方式)
- [十个技能](#十个技能)
- [运行要求](#运行要求)
- [快速安装](#快速安装)
- [日常使用](#日常使用)
- [目录与数据](#目录与数据)
- [升级与恢复](#升级与恢复)
- [故障处理](#故障处理)
- [验证与发行来源](#验证与发行来源)
- [参与与支持](#参与与支持)
- [许可证](#许可证)

## 功能与工作方式

| 能力 | 使用结果 |
| --- | --- |
| TaskNotes 任务 | 创建与查询任务，修改计划、截止、优先级和完成状态，处理单个重复实例 |
| 规则与模板 | 从已绑定知识库读取实体、字段、合法目录和当前正文模板 |
| 项目与学习 | 组织构想、项目、任务、成果，以及资源、研读、认知、假设和检验 |
| 生活记录 | 创建游记、现实经历、对象、事务及日、周、月、季、年记录 |
| 文件与生命周期 | 限定范围修改正文和关系，改名、同阶段移动、回收及合法推进 |
| Amytis 发布 | 中英文写作、身份登记、公开副本、上传、批次恢复、状态刷新和撤稿 |
| 审阅与复检 | 固定预览、依赖校验、明确确认、执行回执和实际结果读回 |
| 安装管理 | 暂存独立发行、预览发现入口、备份原入口、切换及中断恢复 |

```mermaid
flowchart LR
    A[用户请求] --> B[技能理解需求]
    B --> C[CLI 读取规则与模板]
    C --> D[生成完整预览]
    D --> E[用户审阅确认]
    E --> F[Obsidian 原生执行]
    F --> G[回执与结果读回]
```

预览阶段不会写入业务笔记，但会在库外保存草稿、预览和方案。提交时核对笔记、模板、规则及相关环境是否仍与预览一致；发生变化时拒绝执行原方案。执行超时或回执不完整时，系统保留原执行身份，供后续查询和复检。

同一库的写入使用锁与执行记录管理。跨文件、跨插件的操作不提供统一事务回滚；部分完成时应根据原回执核清已发生的变更。Amytis 的本地登记、上传、PR 合并、部署和页面版本分别核验。

## 十个技能

| 技能 | 主要职责 | 请求示例 |
| --- | --- | --- |
| [cosmos-plan](runtime/skills/cosmos-plan/SKILL.md) | 将需求组织为最小文件组合和关系 | “这件事适合建任务还是项目？” |
| [cosmos-create](runtime/skills/cosmos-create/SKILL.md) | 创建速记、资源、假设，澄清普通笔记分类 | “把这个链接记为资源。” |
| [cosmos-project](runtime/skills/cosmos-project/SKILL.md) | 构想、项目、关联任务和成果 | “为这次交付建立项目和任务。” |
| [cosmos-learn](runtime/skills/cosmos-learn/SKILL.md) | 研读、认知、课题与检验 | “整理这本书的研读，区分来源与我的判断。” |
| [cosmos-life](runtime/skills/cosmos-life/SKILL.md) | 旅行、现实经历与周期记录 | “按这些材料写一篇游记。” |
| [cosmos-tasks](runtime/skills/cosmos-tasks/SKILL.md) | TaskNotes 任务和重复实例 | “明天十点半核对清单，预计四十五分钟。” |
| [cosmos-evolve](runtime/skills/cosmos-evolve/SKILL.md) | 合法生命周期、补齐正文、关联文件与归档资格 | “检查这个构想能否推进为项目。” |
| [cosmos-amytis](runtime/skills/cosmos-amytis/SKILL.md) | 创作、登记及发布内容 | “从这篇笔记建立一份公开副本，先给我预览。” |
| [cosmos-files](runtime/skills/cosmos-files/SKILL.md) | 范围内修改、关系、改名、移动与回收 | “替换这一段，并保留其余正文。” |
| [cosmos-check](runtime/skills/cosmos-check/SKILL.md) | 查找、阅读及只读检查 | “找出同名笔记，让我选择后再读取。” |

宿主可依据描述自动选择技能，也可由用户明确指定技能。发现目录中的十个入口需要指向完整发行包中的技能目录；每个执行入口会读取同一发行中的 CLI 与安装连接信息，因此不要只复制 `SKILL.md`。

## 运行要求

| 组件 | 要求与验证范围 |
| --- | --- |
| Node.js | **24.x**；原候选使用 24.21.0 构建和验证 |
| AI 宿主 | 能发现 Agent Skills，并执行本地 Node 命令；原技能场景使用 Codex / Claude 宿主验证 |
| Obsidian | 桌面应用已运行、目标库已打开，官方 CLI 可用并支持 `eval`；原生验证使用 1.14.4 |
| Cosmos 规则 | 模型 JSON `version: 3`，包含实体、公共字段、合法动作及目录定义 |
| 模板 | 已存在且与规则兼容；周期与任务模板需符合各自插件的当前配置 |
| 库内业务服务 | `schema.scriptFolder/lib/system-engine.cjs` 提供当前业务服务契约 |
| TaskNotes | 任务操作需要 runtime API v1 和相应能力；已验证版本为 4.13.8 |
| Periodic Notes | 周期记录需要插件和已启用的对应周期配置；已验证版本为 0.0.17 |
| Amytis 发布环境 | 发布操作需要库内发布服务、网站契约及受控 Enveloppe 7.8.2 bridge v1；详见[配置参考](docs/configuration.md#amytis-发布要求) |

插件需求按操作检查。只读查询或其他业务不等于需要先开通网站发布，但目标操作缺少原生能力时会返回明确错误。规则和服务的位置通过绑定和规则内容确定，README 中的路径均为示例，需要替换为实际路径。

**平台范围：** Windows 与 Linux 已通过原候选功能及安装检查；真实 Obsidian 集成验收在 Windows 完成。macOS 未完成本项目的原生验收。Linux 使用者仍需自行确认本机 Obsidian CLI 和插件环境可用。

## 快速安装

以下以 Windows PowerShell 为例。所有路径由使用者选择；安装根目录、绑定配置和运行状态应位于业务知识库之外。

### 1. 下载与校验

在 [Releases](https://github.com/Self-Command/cosmos-obsidian/releases/latest) 下载 `cosmos-obsidian-v0.1.0.zip` 和 `SHA256SUMS.txt`。比较 ZIP 的 SHA256 与清单对应行：

```powershell
Get-FileHash -LiteralPath ./cosmos-obsidian-v0.1.0.zip -Algorithm SHA256
Expand-Archive -LiteralPath ./cosmos-obsidian-v0.1.0.zip -DestinationPath ./cosmos-download
Set-Location ./cosmos-download/cosmos-obsidian-v0.1.0
node ./scripts/verify-release.mjs
```

校验成功返回 `ok: true`、版本、原候选 SHA 和文件数量。Linux 可下载 `.tar.gz`，使用 `sha256sum` 比较校验值，再用 `tar -xzf` 解压。仓库默认分支也提供相同载荷，可直接克隆；本版本无需构建。

### 2. 准备库绑定

```powershell
New-Item -ItemType Directory -Force -Path C:/CosmosData | Out-Null
Copy-Item -LiteralPath ./examples/binding.windows.example.json -Destination C:/CosmosData/binding.json
```

编辑 `C:/CosmosData/binding.json`，将以下路径替换为本机实际值：

```json
{
  "version": 1,
  "vaultPath": "C:/Knowledge/Cosmos",
  "vaultName": "Cosmos",
  "cliPath": "C:/Apps/Obsidian/Obsidian.com",
  "stateRoot": "C:/CosmosData/state",
  "schemaPath": "宇宙/演化/规则/系统规则.json",
  "templateFolder": "宇宙/创世/模板",
  "timeoutMs": 15000
}
```

`vaultName` 必须与 Obsidian 中实际库名一致。`vaultPath`、`cliPath`、`stateRoot` 使用绝对路径；`schemaPath` 与 `templateFolder` 是库内相对路径。示例规则文件名不是运行时默认值，需要指定已存在的模型 v3 规则文件。完整字段说明见[配置参考](docs/configuration.md)。

### 3. 暂存发行并预览安装

```powershell
$installRoot = 'C:/CosmosData/install'
$binding = 'C:/CosmosData/binding.json'
$staged = node ./runtime/install.mjs stage --root $installRoot --config $binding | ConvertFrom-Json
if (!$staged.ok) { throw '暂存失败，请检查返回错误。' }

$skillDirectory = Join-Path $env:USERPROFILE '.agents/skills'
ConvertTo-Json -InputObject @($skillDirectory) |
    Set-Content -LiteralPath C:/CosmosData/destinations.json -Encoding utf8

$plan = node ./runtime/install.mjs plan --root $installRoot --destinations C:/CosmosData/destinations.json | ConvertFrom-Json
if (!$plan.ok) { throw '安装预览失败，请检查返回错误。' }
Get-Content -LiteralPath $plan.preview
```

Codex 的用户技能位置为 `~/.agents/skills`，仓库技能位置为 `.agents/skills`，并支持发现链接指向的技能目录。这里采用用户位置；其他宿主应填写其实际发现目录。依据见 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)。

`destinations.json` 是绝对目录路径组成的 JSON 数组，可登记多个宿主目录。安装预览列出十个技能的目标、原入口状态和恢复位置；同名旧入口会先备份，再创建指向暂存发行的目录链接。

### 4. 确认切换并检查

阅读安装预览并确认目标正确后，在同一 PowerShell 会话执行：

```powershell
node ./runtime/install.mjs switch --root $installRoot --installation $plan.installationId --confirm
node ./runtime/install.mjs status --root $installRoot --installation $plan.installationId
node "$($staged.release)/cosmos.mjs" inspect capabilities --config $binding --pretty
node "$($staged.release)/cosmos.mjs" query model --config $binding --pretty
```

安装完成状态为 `complete`。能力查询应返回目标库和对应插件信息；模型查询应返回当前实体目录。安装器校验发行与配置，不会自动安装插件、规则或库内业务服务，也不修改 AI 账号配置。

Codex 通常会自动发现技能变更；如果列表未更新，重启宿主后检查。开始新的业务请求时，先生成具体预览，再审阅确认写入。

### Linux 安装

使用 [POSIX 绑定示例](examples/binding.posix.example.json)，将路径替换为实际环境。安装器的 `stage → plan → switch → status` 命令与 Windows 相同，发现目录填写绝对路径，例如 `/home/your-user/.agents/skills`。Windows 使用 junction，其他平台使用目录符号链接；目标文件系统需支持对应链接类型。

## 日常使用

安装后可直接对 AI 宿主发出业务请求，例如：

> 明天十点半核对项目验收清单，预计四十五分钟。先给我完整预览。

技能返回真实的日期、属性、正文要点与完整预览链接。确认该预览后，宿主提交同一 `reviewId`，执行后返回实际文件路径和读回结果。请求中的预计时长不会被推断为截止时间；未明确指定的状态与优先级使用当前插件默认值。

也可直接调用 CLI。以下命令从下载目录运行，配置沿用快速安装示例：

```powershell
# 读取命令与输入 Schema，不需要连接知识库
node ./runtime/cosmos.mjs help task preview --pretty

# 查询已有笔记或任务
node ./runtime/cosmos.mjs query notes --input ./examples/query-notes.json --config C:/CosmosData/binding.json --pretty
node ./runtime/cosmos.mjs query tasks --input ./examples/query-tasks.json --config C:/CosmosData/binding.json --pretty

# 生成完整任务预览；此步骤不会创建业务笔记
node ./runtime/cosmos.mjs task preview --input ./examples/task.json --config C:/CosmosData/binding.json --pretty
```

预览返回 `reviewId`、`summary` 和 `preview.link`。读完预览后，将下面的 `r-...` 替换为该次返回的真实 ID：

```powershell
node ./runtime/cosmos.mjs review show --review r-... --config C:/CosmosData/binding.json --pretty
node ./runtime/cosmos.mjs review commit --review r-... --confirm --config C:/CosmosData/binding.json --pretty
```

提交已经包含执行和复检。放弃尚未派发的预览可用 `review cancel`；派发后的取消不能撤销已发生的操作。需要处理不确定结果时，使用原 `executionId`：

```powershell
node ./runtime/cosmos.mjs execution status --execution e-... --config C:/CosmosData/binding.json --pretty
node ./runtime/cosmos.mjs execution verify --execution e-... --config C:/CosmosData/binding.json --pretty
```

实体写作用 `draft open` 读取当前模板字段，再用 `draft preview` 填写正文。文件修改、关系和生命周期用 `change preview`。Amytis 登记与上传用 `publish preview`，审阅后的提交用 `publish commit`。具体命令、字段及状态见[命令参考](docs/commands.md)。

## 目录与数据

```text
cosmos-obsidian/
├── runtime/
│   ├── cosmos.mjs             业务 CLI
│   ├── cosmos-runtime.cjs     Obsidian 应用内运行时
│   ├── install.mjs            安装器
│   ├── skills/                十个技能及各自的执行入口
│   ├── manifest.json          原候选身份及逐文件 SHA256
│   ├── dependencies.json      原构建依赖清单
│   └── licenses/              第三方许可证
├── docs/                      配置、命令和运行说明
├── examples/                  非个人化配置与输入示例
├── scripts/verify-release.mjs 发行完整性校验
├── release.json               版本与验收来源
├── CHANGELOG.md
├── LICENSE
└── README.md
```

仓库另保留 GitHub Actions 发行校验配置与仓库协作规则。源码、测试夹具、开发报告和临时材料不在当前生产目录；原源码和开发记录可通过[原候选 Git 历史](https://github.com/Self-Command/cosmos-obsidian/tree/d7ca68a26eb0d13fb253a891873c56b23420659d)查看。

安装后，`<安装根目录>/releases/<sourceSha>` 保存固定发行，`installation/` 保存切换方案，发行内的 `connection.json` 记录绑定文件位置。`stateRoot` 保存草稿、预览、审阅、请求、回执、执行与锁。绑定、发现目录配置和运行状态属于使用者的本地数据，不应提交到公开仓库。

CLI 和安装器本身不要求 AI API 密钥。AI 宿主可能将请求材料发送给其模型服务；Amytis 上传还会访问配置的 GitHub 仓库和网站。外部发布凭据保留在对应插件或宿主配置中。

## 升级与恢复

升级时下载新发行并核对校验值，复用当前绑定，重新执行 `stage` 和 `plan`。审阅新安装方案后 `switch --confirm`，随后检查 `status` 和运行能力。每个发行按原源码 SHA 独立保存，旧入口通过该次安装方案备份。

安装中断且状态为 `switching` 或 `partial` 时，可按**原安装方案 ID**恢复：

```powershell
node ./runtime/install.mjs recover --root C:/CosmosData/install --installation i-... --confirm
```

`recover` 只处理未完成的安装切换，不是已完成版本的通用降级命令。计划阶段的配置或目标发生变化时，应重新生成安装计划；业务提交结果不确定时，则先查询原执行。恢复命令不会删除业务笔记。

需要回到旧发行时，若旧目录完整且仍绑定同一库，可将旧目录作为 `--package` 再次暂存并生成新的切换方案。停用时，仅移除经核实属于本安装的技能发现链接；保留备份和运行状态，直到不再需要恢复或审计。

## 故障处理

| 错误或现象 | 检查与下一步 |
| --- | --- |
| `CONFIG_MISSING` | 检查绑定文件是否存在、是否为 UTF-8 JSON；使用 `--config` 指定实际文件 |
| `WRONG_VAULT` | 核对真实库路径、库名以及当前 Obsidian 打开的库 |
| `CAPABILITY_MISSING` | 检查 CLI、目标插件 API、当前模型、模板及库内服务；发布还需核对 bridge 和网站契约 |
| `PACKAGE_INVALID` | 重新下载并校验完整发行；运行时目录不能混入额外文件或个人配置 |
| `TARGET_AMBIGUOUS` | 从返回候选中选择准确的库内路径，再提交输入 |
| `REVIEW_STALE` | 笔记、模板、规则或环境已改变；读取当前内容，生成新预览再确认 |
| `REVIEW_TAMPERED` | 原方案或预览指纹不一致；不要编辑方案 JSON 来绕过检查 |
| `RESULT_UNCERTAIN` / `uncertain` | 保留原执行 ID，先调用 `execution status` / `execution verify` 核清结果 |
| `INSTALL_LOCKED` / `partial` | 读取原安装状态；对未完成方案使用 `recover`，不要另开一次切换抢锁 |
| 技能未出现 | 核对发现目录和链接目标，确认完整发行仍在；必要时重启 AI 宿主 |

CLI 默认返回 JSON，可用 `--pretty` 格式化。退出码 `0` 表示成功，`2` 为通常的输入或规则错误，`3` 为环境或能力错误，`4` 为执行或验证错误，`5` 为结果不确定；应结合 `error.code` 和执行状态处理，不能只根据非零退出码重发写入。

更多排查与运行边界见[运行说明](docs/operations.md)。

## 验证与发行来源

本发行的可执行文件与技能沿用候选 `d7ca68a26eb0d13fb253a891873c56b23420659d`。原 manifest SHA256 为 `8e48ce71fea82852f791cee09919a4ebccb4fc3c4cc3b481e1cecbe5573e89d7`，包含 **123 个登记文件**，另有 manifest 本身。`release.json` 登记其运行与证据来源，`runtime/manifest.json` 保留原始逐文件指纹。

原候选通过以下验证：

- Windows / Linux 各 96 项功能检查及独立安装检查。
- 十个技能各三个不同场景，共 30 个；核对实际预览、审阅确认、执行、读回和恢复。未变化技能的部分报告按原始字节和完整依赖一致性证明复用。
- 真实隔离 Obsidian 中：任务 9 项、草稿与实体 4 项、业务 36 项、发布 23 项。
- 发布验证使用合成远端，覆盖上传、批次恢复、部署、页面读回和撤稿。

[原候选验收运行](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38229786099)的来源检查通过，但最后汇总任务曾因缺少 `yaml` 依赖失败。[后续原候选汇总复核](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38232747805)安装依赖后重新核对原候选字节和全部原始报告，18 组汇总检查通过，返回 `releaseReady: true`。这两次运行的角色与原失败记录均保留。

当前[生产发行工作流](https://github.com/Self-Command/cosmos-obsidian/actions/workflows/distribution.yml)负责双平台文件指纹、CLI / 安装器 / 十技能入口、文档链接和配置 JSON 校验，并生成 ZIP、tar.gz 及校验清单。它验证发行整理与包装，没有重跑或替代原候选业务与模型场景。

## 参与与支持

使用问题、缺陷和改进建议通过 [GitHub Issues](https://github.com/Self-Command/cosmos-obsidian/issues)提交。报告中建议提供发行版本、操作系统、Node 与 Obsidian / 插件版本、脱敏后的命令、`error.code` 和必要状态；不要上传凭据、完整知识库或私人会话。

文档和发行校验改进可提交 Pull Request。运行时修改需要从[原候选源码](https://github.com/Self-Command/cosmos-obsidian/tree/d7ca68a26eb0d13fb253a891873c56b23420659d)开始，重新构建并验证受影响业务后形成新候选；不要直接修改预构建 bundle 或 manifest 来伪装成既有候选。

项目目前为 0.x，由维护者按实际反馈维护，未提供商业 SLA。版本变化见 [CHANGELOG](CHANGELOG.md)，使用时建议固定 Release 版本及校验值。

## 许可证

项目代码、技能和文档采用 [MIT License](LICENSE)。第三方依赖保留各自授权，详见 [licenses](runtime/licenses) 和 [dependencies.json](runtime/dependencies.json)。依赖清单保留原构建环境的完整记录，其中包含开发依赖；该清单不要求使用者重新安装这些依赖。
