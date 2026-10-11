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

## D5：写作与发布（最终恢复候选验证中）

- 已核对当前库内发布服务、适配器、传输与 Enveloppe 7.8.2 受控接口。沿用当前身份、范围、成员/大纲及批次语义。
- 创建独立公开合成测试远端 `Self-Command/cosmos-obsidian-publication-fixture`。当前只有说明文件；正式 Amytis 内容未复制、未上传、未变更。
- 后续测试只包含合成内容，保存真实上传、PR 合并、部署和页面验证证据，并明确请求/网址映射边界。D5 实现与验收尚未完成。
- run [`38161665689`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38161665689)，候选 `7eabf41562f0e596080aefdb4e8621d43091f225`：build、双平台、native、publication、stage-gate 全部通过。真实发布 16 个场景通过：中英文写作/副本/系列、取消/漂移、真实上传前 PR 创建失败、原分支恢复合并、部署/页面戳与目录收据、改名保留网址、撤稿后的真实页面 404。
- run [`38162441137`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38162441137)，候选 `c80345f8f365e4219c3607b7d591fc458c806316`：全形态 publication 21 场景、build、双平台通过；包含认知、随笔、专题、书籍和章节。native 单项失败：实际变更已成功，最终回执替换被 Windows 临时 EPERM 拒绝。保存原诊断，门禁未通过；新候选对仅状态文件替换增加最多 300ms 重试，不重发业务操作。
- 新增库外远端派发日志及 recover：清单保存失败后核验原分支全部批准字节，单独审阅恢复并沿用原 branch/commit；复检为 GET-only。run 38162726734 与最新 38162844398 正在验证，不提前宣称闭合。
- 当前合成渲染配置 blob `a047d5732bbe9c791626165d880d2b298474d56e`，其余固定渲染契约来自 `d8099a39aa63f9dddace3fb2c32ce72daa6cae37`；页面读取只在测试环境映射 `/cosmos-obsidian-publication-fixture/amytis/*`。所有实际 PR 为合成内容。
