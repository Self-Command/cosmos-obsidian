> 历史档案：本文件是旧项目文档的脱敏副本。旧状态、通过项、提议和实现说明不代表新项目状态或验收；当前决定以新开发设计为准。旧私有证据及机器路径没有公开复制。

# 调用链与上下文迁移（0.3.0，协议仍为 v2）

旧 context/template/plan 接口的完整输出保留。新工作流：prepare 获取本次所需规则和递归模板指南 → plan 显式 output=summary → 用户批准 → apply → check。单任务、单篇游记在材料齐全时四次业务调用。默认直接展示已有摘要和 previewPath 全文链接，然后等待批准；展示链接无需另读全文。仅用户要求全文或中断后原结果不可用时才调用 plan_read；额外检索与这种明确需要的原方案读取另计。

prepare 同时校验明确属性并返回已保存的 name/values/patch，避免把无效属性延后到正文写完才发现。任务优先级接受实际值、唯一标签及 `{rank:"highest"|"lowest"}` 的明确选择，按当前设置唯一解析，拒绝并列、空选项及猜测名称；选项/字段映射变化使准备凭据失效。plan 只接收 planInput 骨架填写后的参数，结果字段仍严格拒绝；技能要求失败后不得编造预览编号或链接。

任务相对日期可在 scheduled/due 使用 `{relativeDays,time,timeZone}`，今天/明天/后天分别用 0/1/2，time 为可选 HH:mm，时区必须明确。prepare 按当前服务端时钟和指定 IANA 时区换算为具体 ISO 日期或含偏移的日期时间并保存；跨午夜规划、批准或恢复沿用原日期。非法时区、日期/时间或夏令时不存在/重复的当地时间拒绝，要求明确 ISO 时间。旧绝对字符串兼容；运行时只接受计划中已确定的字符串，不再次换算。

planInput.content.fields 由选中模板的递归指南生成具体输入结构，包含标题、正文空值、固定表格单元格及嵌套分组。模型沿骨架填实际材料，不再重新组装不同类型的字段。空值提交仍失败，完整 Schema 留在服务端；prepare 不另返回第二份 blankContent 或完整 Schema。公共调用 Schema 明确常用属性名称，普通分类创建推荐省略 entity，由实际分类唯一解析；显式错误类型继续拒绝。

成功 apply 单文件返回由实际 changedFiles 生成的 checkInput，作为复检的整个输入直接沿用；多文件返回 checkCalls（tool/arguments），逐项调用。避免把数组另外包成 inputs，或猜路径、混入运行时检查。相对路径及原有文件保护保持；不确定结果仍查询 operationId。

check 可在明确需要时一并接收 path 和 operationId，执行文件审计，并核对回执编号、完成状态、changedFiles 范围和 outputHashes 实际字节。回执缺失、目标不属于该操作或内容变化都不会报告通过，不重复派发或清锁；runtime=true 仍必须单独调用。正常流程继续直接使用 apply.checkInput。

plan 返回 applyInput，包含原 planId/planHash 和 approved=false。宿主取得有效批准后只改变该布尔值；CLI 可从成功结果的 JSON 提取骨架，避免重抄长指纹。服务端继续以原编号、原指纹和 approved=true 校验，返回参数骨架不代表用户已批准。

新 summary 的 applyInput.planHash 使用 `{fromFile:"confirmations/整数.json"}`。短引用是保存输入的选择器，不是缩短的指纹；服务端在本库外状态目录解析它。文件保存原 planId、完整 64 位 SHA256 和 approved=false；服务端核对本方案的原引用、路径、字节指纹及编号，再把完整 SHA256 交给原 v2 精确比较。引用与原方案/完整指纹另用全部 256 位 HMAC 签名绑定，私有 32 字节密钥以独占原子方式首次生成并保存在外部 stateRoot/confirmation.key，不进入包、工具返回或报告。即使计划和确认文件被一起编辑并重算公开 SHA，签名仍拒绝。密钥缺失/损坏时不重建、不重新签名、不执行；恢复外部状态必须保留原密钥。它认证保存输入的原始绑定，不是独立真人批准证明。

确认文件按独占创建分配编号，多个 CLI/MCP 并发规划不覆盖；独立 confirmations 目录保留原 plans 目录枚举约定。MCP 原样复用短对象，不能拼绝对路径或重复抄长编号；CLI 仍提取 /applyInput 后加 --approved。文件缺失、编辑、跨方案引用或无效签名均在派发前拒绝。planHash 顶层及旧 full 的 applyInput 仍为原字符串；已有八项分组与完整字符串兼容，任意一位变化或非法分组仍拒绝。历史无签名方案沿用原完整指纹/分组，不自动升级或执行。

CLI 新增 --save-result（新库外 UTF-8 文件）、--select（JSON Pointer 提取对象）、--content-file（已准备规划的独立正文文件）和 --approved（支持确认声明的工具）。模板正文先保存为库外 UTF-8/BOM {fields} JSON，规划直接从原准备结果选取 /planInput 并合并该正文，不手动回写准备结果，不改变编号、名称或属性；完整字段及模板仍严格校验。多操作传同顺序数组，不填项用 null；非模板操作不使用此选项。旧填写并保存 planInput 的方式继续兼容。普通流程逐步保存并选取 /planInput、/applyInput、/checkInput，不由模型重新拼参数；原 --input、标准输入及完整 JSON 调用保留。保存不会覆盖已有文件，选择缺失字段或在非确认工具使用确认旗标均拒绝，参数提取不放宽业务输入。MCP 继续原样提交对象。

技能以准备、完整填文、规划审批、执行复检的顺序给出操作步骤。CLI 默认将正文保存到独立文件，由 --content-file 合并进原准备结果，避免只在内存填文却漏写磁盘导致提交空骨架。文本所有状态均使用 value，缺失及不适用原因也放 value；reason 仅是表格的原因字段。输入 Schema 和原有保护未放宽。

一个 preparedOperationId 表示一个已绑定操作。同次规划重复携带同一编号、参数完整且完全一致时，按规范化对象指纹合并为一个操作，摘要及全文明确展示合并警告。相同编号的内容或属性不同则拒绝，不能默选一份。不同准备编号或旧完整操作仍受同名目标保护，不合并；执行也不因重复输入增加派发次数。

prepare 不带 content/body。工具发现、准备与规划从同一操作契约生成枚举及字段位置；无效结构在读取知识库前拒绝。CLI 帮助与各技能 scripts/invocation.json 返回同一精简调用契约；Actions 将接口说明和审批阶段说明生成到交付 SKILL.md，避免 CLI 客户端猜工具名或参数。prepare 同时返回 planInput 完整 JSON 骨架，output 位于 JSON 根对象。名称合法性从同一规则生成 Schema 并用于准备与规划；CLI --help cosmos_工具名 按需返回与 MCP 一致的工具 Schema。目录可用当前实体已登记分类的精确原名，服务端仅唯一匹配实际目录，歧义或无匹配仍拒绝；不匹配主题标签或同义词。普通创建在明确分类唯一对应实体时可以省略 entity，准备凭据保存实际实体；显式错误类型不会被自动纠正，任务/周期仍须专用操作。每项返回 preparedOperationId，服务端在库外保存所选操作、目录及模板版本；plan 默认传 `{preparedOperationId,content:{fields}}`，可补 name、values、patch、body，不能改已选目录或操作类型。计划解析时重新核验规则、所选模板和源文件；准备凭据跨进程保留，损坏、缺失、变化分别报错。旧完整操作和模板身份参数继续兼容。返回选定实体的 allowedValues、folders、statuses、合法 actions，以及任务选项；template 包含 templateId、templateHash、writingGuide 与递归 fields。共享 contentFormat 定义必填、状态、表格固定单元格和分组实例。服务端继续校验完整 JSON Schema，写作提示不裁剪。模板失效需重新 prepare。

plan(output=summary) 不返回正文，仅保留操作、属性/关系、内容章节要点、全部警告和 previewPath/previewHash。完整 Markdown 位于外部状态目录，由不可变计划生成，含最终属性及修改前后全文；预览被编辑时报告 PREVIEW_CHANGED，不把文件改动写入计划。plan_read 支持 summary/full，返回原 planId/planHash 与执行状态，不自动恢复或执行。历史 v2 计划未绑定预览文件时仍按旧协议校验；v1 仍不可直接执行。

配置统一解析 --config、COSMOS_CONFIG 和技能旁 connection.json；支持相对指针、UTF-8/BOM，拒绝缺失/循环和库内状态/安装目录。Windows 通过库外 UTF-8 JSON 文件传参，支持显式 UTF-8 标准输入；CLI 默认紧凑 JSON，--pretty 保留人工排查。错误 details 给字段、接受值和修正提示，技能无需读取实现源码。

目录/资源清单、属性索引、正文和模板编译分离。索引仅缓存路径、属性、size/mtime/ctime/内容指纹及引用，不保存正文；MCP 复用内存，CLI 复用外部索引。选中正文按需读取；模板编译以实际规则绑定与正文指纹为键。损坏缓存重建，文件新增/删除/修改刷新属性。执行前重新读取目标、关联文件、使用模板和插件设置的实际字节；运行时再次核验相关依赖。普通创建仅审计相关文件，改名/移动/回收及发布保留广泛审计，以记录链接更新。

维护报告拆为 skillsReady、mcpConfigured、mcpDiscovered、runtimeReady；均携带 pass/fail/unverified 与原因。只维护 Cosmos 配置段，连接配置保存外部快照、原位追加并读回；其他段字节保持不变。同名冲突先停止，不覆盖。真实 App Server 使用与 Claudian 相同的可执行文件、目录与环境查询 mcpServerStatus/list；实际 Claudian 对话加载仍单列未验证。

全部构建与自动测试在 GitHub Actions。CI 构建一次，各平台下载同一包；宿主评估校验 commit/runId，固定 gpt-6-luna/xhigh，不替换不可用模型。Windows PowerShell 5.1/7 逐字符传输、业务异常、缓存、完整正文一致性、真实 App Server 发现与宿主行为/计量分别留证。安装前保存快照，更新不改本地绑定、历史方案、回执或锁。本机验收仅发现工具及只读检查，不创建真实业务笔记。
