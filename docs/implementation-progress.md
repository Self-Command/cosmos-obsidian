# 实施记录

用户于 2026-10-11 明确批准开发设计 1.0 及实施计划，开发已启动。单代理执行，旧技能及安装保持冻结。

## D1：基础与原生可行性

- 独立 TypeScript 工程；Node 24.21.0、AJV、remark/unified、YAML、Vitest、esbuild 版本固定。
- 已编写闭合输入校验、名称/路径边界、库绑定、原子状态存储、不可变预览校验、执行锁及无 shell 的 Obsidian 请求/回执适配器。
- Actions 一次构建候选，Linux/Windows 下载同一候选核验，运行基础边界测试。
- 原生 job 从官方来源安装 Obsidian 1.14.4 与 TaskNotes 4.13.8，在临时合成库验证真实 CLI、API 版本及能力。生产库不参与测试。
- 阶段门禁按已实现能力运行，不表示发行通过。旧技能不能删除。

### Actions 证据

- 初始 run `38152694607` 发现根级忽略规则误排除 `src/state`，已修复。
- run `38153248359`：构建/Linux 通过；Windows 路径断言需按真实规范路径核对；Obsidian 已运行但测试库尚未启用 TaskNotes。两项已修复。
- run [`38153803734`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38153803734)，候选 `de948f4f51208a6895c15566d04d6984d1507a69`：build、两平台 foundation、真实 native、D1 gate 全部 success。基础用例 19 个/平台；原生 TaskNotes 4.13.8 API v1 与读写/重复能力已核验。
- 上述是 D1 可行性与基础证据，不代表任务写入、业务覆盖或最终发行已通过。

代码全部重新实现；未移植旧源码片段。继承不变式的逐项记录见 `design/reuse-audit.md`。

## D2：任务完整流程

- 已实现 task preview、任务查询、更新/清空日期、完成/重开、重复实例完成/跳过，以及不可变 review 提交、取消和 execution 读回恢复。
- 使用 TaskNotes 4.13.8 API v1 的实际映射、状态与优先级目录；计划固定当前日期、默认值、模板、相关关系和任务配置。
- JSON 持久化用 null 明确表示清空意图，应用内调用前转换为 TaskNotes 的 undefined。来源：[官方 runtime API](https://tasknotes.dev/obsidian/javascript-api/)及 4.13.8 `TaskNotesAPI.ts` 的 clearDue/clearScheduled 实现；未复制其源码。
- 结果不确定保留执行 ID 和锁，重复提交只读原 execution；本地结果保存失败也不能引发重发。
- 不暴露尚无法生成完整确定目标预览的 materializeOccurrence；原生能力探测与已实现动作清单分开。

### Actions 证据

- run [`38154834060`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38154834060)，候选 `2264b660385a08ccb513512ddfe6236214a3d362`：全部 D1/D2 jobs success；真实原生用例 5 个。
- 该候选 `cosmos.mjs` SHA256 `447f32cc5b4e1f08808eabc25aadc61859dd761a5d66028d89960b8ec86f6bd9`，runtime SHA256 `b106b4727932a8c3074e2cfafc7cb182ea9d8f6977bc5a164a636dae08cdef50`。
- run [`38155405309`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38155405309)，候选 `097909b6424eb4c8599bf0b1ab312bc34e70b139`：全部 jobs success；增加真实清空日期/查询/重开、原回执恢复与重复实例跳过。单元测试增加结果保存失败且不重发。
- 后续在 D6 的完整候选重新核验上述场景；阶段通过不替代发行、真实模型与迁移验收。

## D3：内容与实体

- 已编写基于当前模板的章节内容契约、表格/标签/固定查询保护、实质正文校验、动态分类与关系解析、库外持久草稿修订和普通实体创建。
- 当前业务规则和 38 份空模板经过隐私核对后作为公开测试夹具；运行时仍读取绑定库，发行包不包含该快照。
- run [`38156306481`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38156306481)，候选 `923a9fe3eddeb455beb0f3017dbb09c42b5e7d95`：build、两平台 foundation、真实 native 和 stage-gate 全部 success。
- 原生新增 4 个场景组：长游记修订/落盘/恢复、普通实体取消、草稿模板漂移、书籍研读实际模板选择；完整模板文件/内联模板契约和非法正文在双平台检查。
- 该候选 CLI SHA256 `def4d21ac826b2c79f7d500d8140818ef37c3091db38e5fccb72c05236a2474e`，runtime SHA256 `d7cd20595bb3a8afce99ce240784485daeec4ec641ed593152d56eda819ec091`。

## D4：业务扩展

- 统一批量方案可创建普通实体与 TaskNotes 任务，代码解析本方案中新建项目的关系。
- 当前合法生命周期、七天归档由保留的库内 system-engine 服务判定并执行；新代码绑定服务/来源/模板，保留原文顺序，填写实际缺少章节。
- 普通正文唯一片段修改、关系、改名、同阶段移动和系统回收使用 Obsidian 服务；改名范围包含实际入链并核验新目标。
- 日周月季年采用作者的 `obsidian-daily-notes-interface 0.9.5`，读取已装 Periodic Notes 设置，分别调用五个实际创建函数。兼容目标为当前 0.0.17；未修改用户插件。
- run [`38158626259`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38158626259)，候选 `58e50b5e41d842cbd0837289a7155711670973b1`：所有 jobs success，闭合五种实际日期接口。
- 最新 run [`38158807169`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38158807169)，候选 `e0512cee993ccba8b4f117d490cdeef5a8a77a1a`：build、两平台 foundation、native、stage-gate 全部 success。原生业务报告 34 个场景全部通过；此前任务/实体报告同一候选再次通过。
- 该候选 CLI SHA256 `f70c2b45e1dd796eb7f96a952617498ce650496865e4bcd43d6462d31aedeff2`，runtime SHA256 `4421b5d63229f815dcacf303a4774308bd84f6801c17453cd1c3afd6e46774d4`；下载包和原生报告已核对。
- 补充原生入链范围/改名后引用读回；运行时最终回执保存失败保留已派发进度，不能改为零写入失败证明。

## D5：写作与发布

- 已核对当前库内发布服务、适配器、传输与 Enveloppe 7.8.2 受控接口。沿用当前身份、范围、成员/大纲及批次语义。
- 创建独立公开合成测试远端 `Self-Command/cosmos-obsidian-publication-fixture`。当前只有说明文件；正式 Amytis 内容未复制、未上传、未变更。
- 后续测试只包含合成内容，保存真实上传、PR 合并、部署和页面验证证据，并明确请求/网址映射边界。D5 实现与验收尚未完成。
- run [`38161665689`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38161665689)，候选 `7eabf41562f0e596080aefdb4e8621d43091f225`：build、双平台、native、publication、stage-gate 全部通过。真实发布 16 个场景通过：中英文写作/副本/系列、取消/漂移、真实上传前 PR 创建失败、原分支恢复合并、部署/页面戳与目录收据、改名保留网址、撤稿后的真实页面 404。
- run [`38162441137`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38162441137)，候选 `c80345f8f365e4219c3607b7d591fc458c806316`：全形态 publication 21 场景、build、双平台通过；包含认知、随笔、专题、书籍和章节。native 单项失败：实际变更已成功，最终回执替换被 Windows 临时 EPERM 拒绝。保存原诊断，门禁未通过；新候选对仅状态文件替换增加最多 300ms 重试，不重发业务操作。
- 新增库外远端派发日志及 recover：清单保存失败后核验原分支全部批准字节，单独审阅恢复并沿用原 branch/commit；复检为 GET-only。run 38162726734 与最新 38162844398 正在验证，不提前宣称闭合。
- 当前合成渲染配置 blob `a047d5732bbe9c791626165d880d2b298474d56e`，其余固定渲染契约来自 `d8099a39aa63f9dddace3fb2c32ce72daa6cae37`；页面读取只在测试环境映射 `/cosmos-obsidian-publication-fixture/amytis/*`。所有实际 PR 为合成内容。
- 最终 run [`38163283368`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38163283368)，候选 `e5f95c7b7b1db73c715e4a72caed42fe8951837c`：build、双平台、native、publication、stage-gate 全部 success；原生业务 34 场景、发布 23 场景通过。异步有限替换兼容 Electron，初始请求用独占创建登记；不使用渲染线程禁止的 Atomics.wait。
- 真实 PR 11/12/13 分别完成原批次恢复、清单保存失败后原分支恢复、撤稿。对应部署 38163436832、38163533658、38163619803 均成功，并由 Actions 核验导出戳、附件、目录收据和最终页面 404。失败 run 38162726734 保留 GitHub 合并拒绝诊断；恢复先只读复检，再审阅原批次 resume，不重新上传。
- 已下载并核对候选：CLI SHA256 `ad94d37b8f037208e1d9f02302b3955317c0334b54c5ea6e80a3b1a5609653c7`，runtime `d502c70238eaac03d9315c4cf10cabb69fa64323765796ba30c7e27077cbcd0f`。D5 完成，发行/模型/迁移仍未完成，旧安装保持冻结。

## D6：技能与发行（实施中）

- 十技能重写将使用已实现的业务 CLI；动态章节和写作要求由 draft 返回，避免复制整套机器流程。
- 官方 Claude/Codex 宿主固定 gpt-6-luna / xhigh；测试使用隔离真实 Obsidian，不继承旧合成桌面 harness。自然发现、预载技能、批准/取消/恢复和三次独立会话速度均需保存证据。
- 发行包含可核验的十技能、单一运行时、独立暂存/切换安装器及来源清单；当前尚未切换用户安装。
- run [38165773831](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38165773831)，候选 `71248d95dfe0279e8b6e08845419691474cbfa4f`：build、双平台 foundation（59 用例/平台）、双平台 installation（10 技能入口/平台）、native 和 publication 全部 success。十入口在隐藏构建来源、无旧目录的临时安装仍运行；真实任务 8、实体 4、业务 34、发布 23 场景通过。该 push 未执行 behavior，不是发行通过。
- 同源码 smoke run [38174593104](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38174593104)：8 组模型检查均未通过。Codex 四组和 Claude 任务两组在首个预览前超时；Claude 游记两组真实生成/提交成功，但重复尝试或多余查询、响应回合超标。所有失败保存，不更换模型或放宽速度门槛。
- smoke 发现两项具体缺口：游记标签顶层格式示例不完整；手写 XML 预载没有触发官方原生加载。修正示例和普通创建职责边界；新 Codex 使用同一 0.162.1 官方 app-server 的 `skill` 输入，Claude 使用原生 slash 调用。新增歧义/多文件项目/合法生命周期/取消恢复与实际终端回执后宿主中断；新候选待 Actions 验证。
- 新发行汇总检查每层的 run/attempt、候选清单、报告实际用例、单样本速度及所有必需 job；missing/skipped/empty/smoke 均拒绝发行。D6 尚未闭合，旧安装保持冻结。
- smoke [38192148322](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38192148322) 暴露官方 app-server sandbox 枚举拼写错误；已按原生诊断修正。后续 [38192435862](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38192435862) 的 Codex 游记出现 gateway streaming 在 response.completed 前断开，保留基础设施失败。Claude 任务实际预览/提交成功，但相对日期缺省与额外加载/读回导致规划不合格。
- 新候选改为按预览时区的当前日期一次换算相对日期，返回实际固定属性/短正文或长文提纲，并直接支持既有 stdin 入口示例。原生技能附件使用官方发现清单中的实际路径；Claude 报告保存原生扩展的合成上下文，核对 slash 加载是否发生。调整不改变模型、响应计数或时间门槛，待 Actions 验证。
- run [38193572666](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38193572666)，候选 `cb6ad2cadab7e2f83076c65e80edb31d7412e724`：所有功能/发行/安装层通过；Codex 预载任务（规划32秒、提交14秒、各2响应）和 Claude 自然任务（29秒/15秒、各3响应）通过，Claude 四组完整流程通过。其余模型速度/探索项未通过；Codex 流程收到 gateway 502/invalid_prompt，不计为能力成功。
- 真实失败显示自然发现后读脚本、游记提交后为成品链接搜索工作区、普通创建的宽描述误选。技能明确代码负责当前模板与字段、缩小普通创建发现范围，结果新增实际知识库 absolutePath。测试标题移除宿主/激活标签，技术身份仍保留在报告；合成业务事实、所有技能发现和速度门槛保持。
- smoke [38197655335](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38197655335)，候选 `668c910ce1b3b95c239d3b71878d24ff29c8caa3`：Codex 自然游记通过（规划133秒、提交13秒）。任务自然会话在展示前自行提交，不满足“用户审阅预览后确认”；Claude 自然任务115秒、游记198秒超时限，预载仍重复加载。Codex 预载任务收到 serverOverloaded，预载游记收到 gateway 502/invalid_prompt，均保留失败。当前新候选明确技能已加载即直接调用业务入口，预览返回 awaiting-user-review 及待用户审阅说明；不改变批准后恢复规则、模型或门槛。该轮全部检查仍需重新通过。
- 后续 Codex 多文件项目将正文误填成 content 的直接字段；命令 help 对 content 仅声明 object，未披露实际 fields 格式。新增共享的 content.fields Schema，与现有渲染契约一致；项目技能给出实际批量结构，避免另加载任务技能。smoke [38199120185](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38199120185) 的两种 Codex 任务已遵守预览/人工确认，且无额外探索；规划113/101秒、自然提交79秒仍超限，实际 CLI 命令各不足1秒。Windows 基础层首次同步任务测试因冷启动超过5秒超时，保留失败，不降低模型速度门槛。
- smoke [38199712613](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38199712613) 的 Codex 自然任务通过（59秒/33秒）；预载任务把 PowerShell here-string 结束标记紧接 JSON，解析失败后多次探查环境，151秒/7响应失败。技能新增可直接照用的 PowerShell 示例及起止换行要求；当前业务事实、调用流程和门槛不变，旧失败报告保留。

- full [38200347484](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38200347484)，候选 91e80c2336efb50b33fb9826369361be4403ffba：功能、原生、发布、双平台安装已通过；两组 Codex 任务三样本均未完整达标。自然任务一例猜测 todo 状态，预载一例把 project/domain 填到顶层；技能补充实际默认值与 relations 结构。其余失败包含模型墙钟超限及网关断流，CLI 调用均小于 0.4 秒，不能据此宣布速度通过。下一轮模型 job 串行调度，减少同一网关的并发压力，固定模型、三独立会话、全部时间/响应门槛和失败记录保持。当前完整运行其余会话仍在执行，安装及退役尚未启动。

- 旧候选预载游记报告显示一次 PowerShell 起始标记紧接 JSON 导致多余工具回合、一次未传入正文、一次漏掉 --input。draft open 新增 next.arguments 和共享的 next.inputSchema，原生长游记测试实际使用返回参数；现实技能明确正文继续通过标准输入，并保留 PowerShell 换行要求。待下一同包完整 Actions 验收，本地未运行测试。

- 串行 full [38202235723](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38202235723)，候选 56384888c23e4f8156cbee343e0c7c6ec5cfb993：编译、双平台 foundation/installation、native/publication 已通过。Codex 自然任务 3/3 含一例通过（规划69秒/提交33秒），另两例为擅填 todo 后重试、规划91秒及提交网关502/invalid_prompt。已证实新说明确实加载；默认状态说明前移到入口首段，继续拒绝未知目录值，不添加猜测映射。该候选未满足发行门槛，全部失败保留。下一候选合并草稿参数修订后再验收。

- full [38203077695](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38203077695)，候选 `0940e9bab9448fb4e27c89820a7e8d950006a351`：全部功能/包/双平台安装通过，各 73 基础用例、原生任务9/实体4/业务34/发布23；八组速度检查中 Codex 预载游记、Claude 自然任务和预载游记整组通过。其余速度/状态/发现失败保留。Codex 流程已通过歧义与取消断言，但 project-plan 被控制器误用的 180 秒预算中断；Claude 四组功能通过，包含真实宿主中断和原回执恢复。最终发行 gate 为 `releaseReady:false`。已下载核对所有必需报告和候选清单，完整数据及人工正文发现见 [同候选记录](research/d6-candidate-0940e9-20261012.md)。
- 下一候选按该记录修正游记与只读查询发现、默认状态说明、实际库 absolutePath、缺失 JSON 输入的可修正错误和传统命令 --help。人工发现一篇游记漏掉 09:00 时间，内容 rubric 增加完整行程事实与回归；流程的无关探索也独立纳入门禁。复杂规划轮次恢复使用原定 240 秒操作预算，关键用例仍严格 90/150/60 秒、三独立会话、原模型/effort 和响应上限。新增实际原生零派发/路径检查；修订尚未通过新 Actions，不以旧功能 job 的 success 代替新标准。
- full [38208690601](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38208690601)，源码 `96a301550b5b97c9f665885a20aeb35bb52c24de`：新增帮助分支触发 TypeScript 的数组元素可能为空检查，build 失败，后续必需检查全部 skipped，未生成候选包。已将数组 includes 参数改为显式元素比较；保留失败结果，下一候选重新执行完整验收。

- 2026-10-12 用户要求十个技能均测试多个场景，随后明确以架构流程与实际结果为验收标准，避免过度严格及无止境重复。新增固定 30 场景矩阵，使用独立官方宿主与真实隔离库；耗时、响应数和额外读取仅诊断。补齐任务与普通创建的发现边界和输入字段、游记关系格式，CLI 返回实际 preview.link。详见 research/skill-acceptance-20261012.md；新候选尚待 Actions 完整执行，不能据此切换旧安装。

- 首轮 30 场景候选 64acc4946c4c047f5600df5748325b7704f21fc1 / run 38213272110 的编译、双平台功能/安装、原生与发布全部通过。cosmos-plan 单任务方案通过；纯咨询遇到首请求网关 502，复杂项目在输入格式纠错及夹具缺少登记分类目录后未完成。任务清空日期/修改时长/重开和取消恢复的实际产物正确；新断言误读查询摘要中未包含的时长，另将插件自动补入 DTSTART 的每日规则误判。人工读回发现跳过实例的 completed 被填 false，确实没有登记跳过日期，继续修复，不能仅按动作名称算通过。新增各技能直接可用的标准输入示例、夹具登记目录及实例 true/false 的实际含义；只有首请求、尚无任何工具执行的传输失败最多重试一次并保留原诊断，不重复部分执行。修订仍待 Actions，不改变已失败的旧报告。

- 架构验收 run 38215563361 / 2c68ce392c08310ad3939fe24b3ffaa9bfbedbae 的编译、双平台各78功能用例/各10技能安装、原生任务9/实体4/业务36及发布23通过。plan/tasks/create 各3场景通过；project构想误用project模板，组合重复预览、成果错误标题及无路径查询使两例未完成；learn关联认知通过，书籍研读与检验因属性猜测、完整路径用于title和缺少输入未完成。修订项目/学习技能的实体与输入说明，保留全部失败。按用户减少重复的要求实现可审计的未受影响技能证据沿用：运行时、场景、环境、发现与技能字节均相同且未加载改动技能，原报告身份和字节保留；新增拒绝非等价证据的检查。其余技能继续固定场景验收，当前修订待Actions。

- 架构流程复测 [38224640960](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38224640960)，源码 `62ddc1ec2407782f584b3d11a69879c959d05a34`：编译、双平台功能/安装、原生、真实合成远端发布全部通过；tasks/learn/evolve/files/amytis/check 各三个场景完整通过。plan 组合提前安排成果文件、project 在审阅前改稿被旧单预览断言挡住、life 日周 JSON 括号错误未恢复；create 前两场景通过，第三次网关拒绝。发行门禁拒绝，失败报告保留。收尾修订仅处理这些实际缺口及帮助路由名称的依赖识别，按原 30 场景范围验收；未受影响的完整报告必须经过原始来源依赖证明。详见 research/architecture-retest-62ddc1e-20261012.md。

## D6 完成与 D7 本地退役

2026-10-12，候选 `d7ca68a26eb0d13fb253a891873c56b23420659d` / [38229786099](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38229786099) 的编译、双平台各96功能/各10安装、真实原生任务9/实体4/业务36、发布23和十技能各3场景均通过。原汇总 job 漏装 yaml 而失败，保留该失败；补装依赖后 [38232747805](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38232747805) 检查18个来源job成功、原包全部哈希与原报告，原验证器18组通过，releaseReady:true，没有重跑模型场景。

已安装原候选，迁入11条不可执行历史审计；十入口与20个宿主链接核验通过。隐藏旧执行器时的真实只读查询通过后，精确清理12个旧目录及4个临时宿主配置副本，停止2个旧MCP进程。业务与其他技能保护核查通过，旧目录删除后新入口实际能力查询成功。旧checkout在安装前已由外部操作移除，报告明确区分。

远程 `Self-Command/obsidian-cosmos-skills` 的实际 DELETE 返回403，缺少delete_repo scope，旧远程仍归档存在。整个任务仅余这一步；最终验收见 research/accepted-release-d7ca68a-20261012.md，退役结果见 retirement-report-20261012.md。
