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

## D3：内容与实体（实施中）

- 已编写基于当前模板的章节内容契约、表格/标签/固定查询保护、实质正文校验、动态分类与关系解析、库外持久草稿修订和普通实体创建。
- 当前业务规则和 38 份空模板经过隐私核对后作为公开测试夹具；运行时仍读取绑定库，发行包不包含该快照。
- 新 D3 Actions 包括当前文件/内联模板解析、长游记、书籍研读选择、取消、漂移及真实 Obsidian 落盘；尚待该候选通过。
