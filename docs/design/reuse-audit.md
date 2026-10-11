# 旧实现继承审查

基线：旧源码 `37118c2365dcf353662509676736ebfe014e2986`；旧安装 `e196141ab4a76ff4ba3731000e470aa2cc02f3d7`。两者不同。此表为基于源码与现有证据的设计级审查，不是允许直接复制的许可。实际继承仍须登记具体函数/片段及新测试结果。

采用级别：**继承原则**、**审查后可移植小模块**、**重写**、**舍弃**、**库内环境服务保留**。新项目目前没有复制旧运行代码。

| 旧模块/机制 | 优点与依据 | 缺陷或依赖 | 决定与新落点 | 新验证 |
| --- | --- | --- | --- | --- |
| src/operations.mjs | 有闭合顶层词汇、字段职责和相对日期约束 | 仍是通用操作集合；values/patch 校验另散布；长 description 混入调用指导 | 继承字段职责，重写分动作注册表 | 每动作 Schema/领域校验一致；未知嵌套字段拒绝 |
| src/names.mjs | 集中名称约束 | 必须核对 Windows 保留名、长度、Unicode、冲突策略 | 审查后可移植独立算法 | 两平台路径和特殊名称用例，不只正则匹配 |
| src/task-fields.mjs | 根据真实设置映射字段、优先级和时间 | 需确认 API v1 和复发实例能力；不能只复制旧选项名单 | 继承转换语义，重写 TaskNotes capability adapter | 真实插件设置映射、跨日、重复任务及非法状态 |
| src/templates.mjs | Markdown AST、动态结构、固定表格与版本绑定 | f001 等字段 ID 增加抄写负担；解析策略变化会改变语义；需验证所有当前模板 | 继承 AST 与结构约束；审查后移植小算法，重写内容契约/草稿 API | 围栏/注释/嵌套/表格/公开区；当前模板与漂移 |
| src/preparation.mjs | 在写作前确定实体、目录和任务选项 | 准备结果暴露给模型并需外部串接 | 重写为工作流内部 draft preparation | 简单任务无需另调 prepare；长正文只返回必要字段 |
| src/prepared-operations.mjs | 将准备结果与操作、模板、来源绑定；变化拒绝 | 外部 preparedOperationId、patchKeys 与低层合并契约 | 继承不变式，重写内部草稿 revision | 偷换目录/模板/范围、过期和修订方案拒绝 |
| src/planner.mjs | 汇总方案及业务影响 | 与旧输入/上下文/模板格式耦合 | 重写纯 plan builder；不直接运行旧模块 | 确定性计划、完整差异、依赖范围及批量顺序 |
| src/dependencies.mjs | 只绑定相关依赖，减少无关变化失效 | 需审查依赖提取是否漏关系、目录或配置 | 继承范围原则，审查后移植哈希算法 | 相关改变拒绝、无关改变允许、并发目录冲突 |
| src/protocol.mjs / confirmation-input.mjs | 不可变计划、内容/范围指纹和历史协议区分 | 多种哈希形式、文件引用及旧兼容增加负担；不证明真人批准 | 重写单一内部指纹协议，不向模型暴露 | 篡改、错库、错误状态、重复提交和可信边界 |
| src/transport.mjs | argv、无 shell、实际库握手、异步回执；不确定不重发 | 每次探测和外置请求有成本；轮询/进程结束需新竞态分析 | 继承不确定处理；审查后移植最小进程/回执机制 | 实际 Windows CLI、退出与回执竞态、结果保存失败 |
| src/runtime.mjs | 使用 Obsidian FileManager/属性和 TaskNotes API；写后刷新 | 代理缓存、回执写入、补偿依赖旧协议；不要把源码整体搬过来 | 重写受控 dispatcher，逐动作审查原生调用 | 真实落盘、链接、缓存、周期与部分失败 |
| src/vault.mjs / config.mjs | 配置在库外，绑定身份，读取实际规则 | 扫描成本、公开配置和本机路径处理需重新界定 | 继承边界，重写最小 context 与缓存失效 | 库误选、路径越界、符号链接、配置版本、缓存失效 |
| src/service.mjs | CLI/MCP 共用 createService，方案和回执保存 | 业务逻辑、工具描述、流程提示和状态混在大文件；模型仍调四步 | 重写为 workflows 与 registry，不移植整体 | API 等价、只读与写入分离、代码内部完整流程 |
| src/cli.mjs / cli-arguments.mjs | UTF-8、stdin、输入文件、结果保存与异常检查 | JSON 指针、结果路径和正文合并仍交给模型 | 重写业务命令，状态文件只由代码管理 | stdin/文件同义、无私有路径入 stdout、特殊字符 |
| src/presentation.mjs | 摘要与完整 Markdown 预览 | 与旧 plan 结构耦合，需防摘要和执行内容不一致 | 继承展示原则，重写 view model | 预览字节与执行一致、实际路径、失败不展示虚构方案 |
| tools/skill-entry.mjs / connections.mjs | 标准入口与绑定管理 | 十套描述和副本维护成本，可能再次诱导探索 | 重写薄启动器，一个共享新发行运行时 | 十入口独立发现、一个执行器、没有旧绝对路径 |
| tools/install.ps1 / update.ps1 | 发行指纹、冲突拒绝、安装在库外、维护基线 | 旧 destination/stateRoot；恢复副本和宿主链接清理不足 | 重写事务式切换与 retirement ledger | 冲突/中断/恢复/重复安装、链接只解除自身 |
| tools/maintain-providers.ps1 | 集中发现入口与幂等核对 | 厂商配置结构变化，旧执行器/MCP 引用需精确处理 | 继承幂等与最小修改，重写 owned-links manifest | 原字节范围外配置不变；拒绝删整个技能目录 |
| tools/*session-eval* / session-metrics.mjs | 真实宿主、多轮取消/恢复、计量和指定模型 | harness 可能教模型预期流程；旧合成服务不能证明原生 | 继承场景/指标，重写盲测 harness | 新包自然发现、无额外流程教学、真实响应 ID |
| .github/workflows/* | 云端构建、双平台、候选复用 | 旧成功不等于新通过；测试分散且可能不同候选 | 重写一个候选清单和必需任务汇总门禁 | 缺失/skip/失败都阻止发行与退役 |
| 十个旧 SKILL.md | 业务分工和若干写作语义清楚 | 长调用规则、重复限制、步骤串接、依赖探查 | 名称和职责经分析保留，正文重写 | 发现准确、正文质量、额外探索零 |
| 旧厂商会话读取/授权来源证明方案 | 曾试图核对对话来源 | 不同宿主耦合、长参数、多轮漂移；本地写权限仍能绕过 | 舍弃通用执行依赖；真实宿主批准或独立可信桥接 | 不把 approved 标记说成真人证明 |
| 旧状态/锁/回执 | 保留失败现场、阻止重复派发 | 绑定旧协议与旧路径，直接删除风险未知 | 迁移审计或只读必要记录，过期计划不可执行 | 每个运行/不确定项清账，不恢复旧运行时 |
| 库内 system-engine/schema | 真实生命周期、目录与模板语义 | 是知识库服务而不是旧技能源文件；版本与契约需核验 | 库内环境服务保留，经新 adapter 调用 | actual schema、动作及正文推进语义通过 |
| 库内 publish-service/adapter | 身份、公开范围、批次及远端恢复 | 外部操作需隔离测试，库内版本不能盲信 | 库内环境服务保留，重写新 adapter | 测试远端状态、身份、失败恢复及公开副本 |

## 实际继承记录模板

每项在实施时追加：

```text
继承 ID：
旧提交与具体文件/函数：
采用范围：原则 / 算法 / 小段源码
为什么比重新实现更合适：
已识别问题及改造：
旧目录、协议、全局状态与插件内部依赖如何解除：
许可证/来源：
新文件与设计条款：
独立测试用例和 Actions run/SHA：
最终判断：采用 / 驳回
```

不得用“旧测试已通过”填写最终验证。此前 18 类实体、38 模板、审批和回执场景是测试需求来源；新发行包必须重新证明。

## D1 实际采用记录（2026-10-11）

本阶段未复制旧源码。下列只继承已审查的不变式；实现、类型与夹具均重新编写。

| ID | 旧来源/范围 | 采用理由与变化 | 新落点及验证 |
| --- | --- | --- | --- |
| I01 | 旧 config/vault 的库外状态和明确绑定原则 | 防止库内私有状态与错库；新配置独立，不接受旧路径或状态协议 | config、identity；双平台配置/路径/链接边界用例，待 Actions |
| I02 | 旧 protocol/dependencies 的不可变预览原则 | 绑定实际方案内容；新单一内部哈希，不向模型暴露 | state/store；改预览/改方案/错库拒绝用例，待 Actions |
| I03 | 旧 transport 的 argv、无 shell、外置数据和回执原则 | 避免内容成为代码；进程退出不等于写入终止 | adapters/obsidian、runtime/dispatcher；真实 Obsidian API 握手，待 Actions |
| I04 | 旧 state 的不确定执行保留锁原则 | 防止重复派发；新锁记录 execution ID，不按超时抢锁 | state/store；单库互斥及原锁保留测试，待 Actions |

## D2/D3 实际采用记录（2026-10-12）

| ID | 来源与范围 | 采用理由及改造 | 独立验证 |
| --- | --- | --- | --- |
| I05 | 旧 task-fields.mjs 的字段职责原则；不复制源码 | 日期/时长/优先级分别解析，实际 API 目录及配置由 TaskNotes 读取；不继承旧 prepare/plan 协议 | run 38154834060、38155405309 的新领域/状态及真实原生测试 |
| I06 | 旧 templates.mjs 的结构保护原则；不复制算法/源码 | 新 sections-v1 AST 契约；代码保留章节、固定标签/表格、查询和公开标记，输入只填当前草稿字段 | 新 content.test.ts 与 native/entities.mjs；D3 Actions 待核验 |
| I07 | 旧 prepared-operations.mjs 的漂移及修订原则；不复制源码 | 草稿保存在独立 Store，修改生成新 review，先废止旧 review，再保存修订，重启读取同一 draft ID | 新持久草稿与实际模板漂移测试；D3 Actions 待核验 |
| E01 | 当前库的 model v3 与 38 份空模板，作为环境契约夹具 | 明确模型职责和结构；排除用户笔记、发布身份、凭据、偏好及标签。不是旧技能执行代码，运行时读取实际绑定模板 | fixture README 记录隐私边界，当前模板文件/内联模板分类测试 |

D1 I01–I04 的新通过证据为 run 38153803734；后续任务候选在双平台再次核验。所有引用仅提供行为和环境契约；当前实现没有搬入旧运行模块。

D3 I06–I07 的独立通过证据为 run 38156306481、候选 923a9fe3eddeb455beb0f3017dbb09c42b5e7d95，包含双平台模板/草稿及真实原生用例。

## D4 环境服务与公开接口采用

| ID | 具体来源/范围 | 采用理由与边界 | 新验证 |
| --- | --- | --- | --- |
| E02 | 当前库 `system-engine.cjs` 工厂的 availableActions、archiveEligibility、executeAction、normalizeValues、supplementBody、templateFor、bodySections | 它是保留的库内业务服务，不是旧技能执行器。适配器固定模块名、指纹与契约；创建/推进后仅在预期中间正文一致时填入批准正文；原文顺序保留 | 新业务规划测试和 native/business.mjs，待 D4 Actions |
| E03 | E02 空环境服务夹具，SHA256 f485a8ea2952d98b0eb1a904a0980b13517d5975a8353ad435df2cfaa463315b | 隔离 CI 运行当前真实服务；代码未包含用户数据、凭据或旧技能状态。仅为环境输入，不进入发行包 | 原生当前动作与七天归档用例；变更影响关系须进入预览 |
| P01 | [作者官方日期接口](https://github.com/liamcain/obsidian-daily-notes-interface)，npm 0.9.5，MIT | 当前 Periodic Notes 0.0.17 未导出 create 方法；接口读取相同插件设置并提供五个历史日期创建函数。作为明确锁定依赖打包；不复制旧技能周期实现 | native 日/周/月/季/年历史日期各自实际路径和正文读回；待 Actions |

E02 的自动重名、创建时日期默认值及空模板不能直接作为批准方案：新适配器先拒绝冲突、要求真实事件日期并生成有内容的完整预览。服务本身不负责新 review 状态和用户批准。

run 38158295947 的 build/双平台通过；真实实体和生命周期已运行，日期库加载 `obsidian` 失败。外部 CLI dispatcher 不享有插件内 require 的模块注入，新 `periodic-host.ts` 只将日期库所需的 Vault/TFile/TFolder 绑定为实际应用对象的原生构造器；路径规范化保持纯数据，库的失败 Notice 转为结构化错误。五种作者创建函数仍使用真实 app.vault 创建。不能将此 host facade 作为完整 Obsidian API 或合成原生验收。

E02/E03/P01 独立验证闭合于 run 38158807169、候选 e0512cee993ccba8b4f117d490cdeef5a8a77a1a，34 个真实原生业务场景全部通过；双平台领域和状态场景同时通过。五个历史周期分别使用作者接口的 createDailyNote/createWeeklyNote/createMonthlyNote/createQuarterlyNote/createYearlyNote，入链改名另作实际 Obsidian 验证。

## D5 发布环境服务采用

| ID | 来源/具体范围 | 判断与改造 | 独立验证 |
| --- | --- | --- | --- |
| E04 | 当前库 publish-service.cjs（SHA256 75fb169bcaff22abd416a5c1c303989a28aba6292c77c3d7d7a961b8bba1ab54）、publish-adapter.cjs（50212e943c2a441782384447e834e955a1d9bbe6c833376e25a6fcbf826e4d3b）、publish-transport.cjs（807eba3d671b5fb6eedfd2976b64d9cd5f52ee45a1161d02cdc261559f713f3d）、publish-contract.json（9f4151f36be0fd53ad2a4a44c9f91efaa09605e3ee5bd0456e185c2ead544fb8） | 它们是保留的库内环境服务；不进入发行包。身份/语言、公开范围、成员与大纲、受控 Octokit 和批次恢复与当前网站契约一致。新适配器固定依赖与许可，正文/附件生成完整预览；ArrayBuffer 转字节列表后持久化。库内 register/create 的先写行为不能用于预览，新代码纯规划后在批准时执行。 | 新 publication.test.ts 与独立原生 publication job，尚未运行 |
| E05 | 当前 Enveloppe 7.8.2 受控 bridge v1（tests/fixtures/model-v3/services/enveloppe-amytis-bridge.cjs） | 保留现有受控客户端、加载指纹及配置政策；新验证器只容许 GET，阻止复检触发上传或恢复合并。凭据不写入方案或报告，仅读取公开政策值。 | 实际官方插件 + 当前 bridge；独立测试映射只重定向固定 owner/repo 和页面读取，注入一次 PR 创建前网络失败，尚待 Actions |
| P02 | 网站公开渲染源码 Self-Command/amytis，固定 d8099a39aa63f9dddace3fb2c32ce72daa6cae37 | 只复制代码、默认通用字体/图标与构建依赖到合成远端；排除生产 content/imports、site.config.ts、文档及测试内容。使用示例产生合成配置，实际 blob a047d5732bbe9c791626165d880d2b298474d56e，测试契约单独固定它；其余受保护 renderer blobs 保持原值。 | Self-Command/cosmos-obsidian-publication-fixture 的真实构建/Pages 部署；首轮发现二进制误按文本上传，已改为 base64 blobs，修复待重新验证 |

测试页面映射为 `/cosmos-obsidian-publication-fixture/amytis/*`，原始导出仍保留规范 `/amytis/*`；它验证真实渲染、版本戳、成员与附件，不代表正式站导航或生产部署。正式 Amytis 内容和配置未被修改。网络结果未知保留 execution 和批次，不按超时自动重新上传。

新适配器进一步修正库内传输在分支创建后才保存批次的缺口：每次远端变更前把有限路由/身份写入库外独立日志，响应保存失败仍有派发意图。清单保存失败时只读核验原分支所有批准字节，原执行闭合为失败后单独审阅 recover，沿用原分支/commit，不上传第二遍。日志不记录正文、附件字节或凭据。该算法全新实现，未复制旧 state 恢复代码。

同一方案的外部 Node 与 Obsidian Node 曾因 ICU 对中文键排序不同产生 REVIEW_TAMPERED；canonical 改为固定 UTF-16 键序，不再依赖 localeCompare。多语言/多形态原生测试负责跨实际宿主验证。发布身份/组织用投影指纹，正文仅绑定选中和实际依赖的源文件；无关公开正文变化保持方案可用。

E04/E05/P02 最终独立验证：run 38163283368、候选 e5f95c7b7b1db73c715e4a72caed42fe8951837c，23 个真实发布场景通过；包含中英文全形态、附件、PR/部署、取消、漂移、清单保存失败日志恢复和撤稿。测试映射边界保持如上；不代表正式 Amytis 的生产部署验收。
