# 实施记录

用户于 2026-10-11 明确批准开发设计 1.0 及实施计划，开发已启动。单代理执行，旧技能及安装保持冻结。

## D1：基础与原生可行性

- 独立 TypeScript 工程；Node 24.21.0、AJV、remark/unified、YAML、Vitest、esbuild 版本固定。
- 已编写闭合输入校验、名称/路径边界、库绑定、原子状态存储、不可变预览校验、执行锁及无 shell 的 Obsidian 请求/回执适配器。
- Actions 一次构建候选，Linux/Windows 下载同一候选核验，运行基础边界测试。
- 原生 job 从官方来源安装 Obsidian 1.14.4 与 TaskNotes 4.13.8，在临时合成库验证真实 CLI、API 版本及能力。生产库不参与测试。
- 当前门禁仅表示 D1，不表示发行通过。D2–D7 尚未完成，旧技能不能删除。

### Actions 证据

- 初始 run `38152694607` 发现根级忽略规则误排除 `src/state`，已修复。
- run `38153248359`：构建/Linux 通过；Windows 路径断言需按真实规范路径核对；Obsidian 已运行但测试库尚未启用 TaskNotes。两项已修复。
- run [`38153803734`](https://github.com/Self-Command/cosmos-obsidian/actions/runs/38153803734)，候选 `de948f4f51208a6895c15566d04d6984d1507a69`：build、两平台 foundation、真实 native、D1 gate 全部 success。基础用例 19 个/平台；原生 TaskNotes 4.13.8 API v1 与读写/重复能力已核验。
- 上述是 D1 可行性与基础证据，不代表任务写入、业务覆盖或最终发行已通过。

代码全部重新实现；未移植旧源码片段。继承不变式的逐项记录见 `design/reuse-audit.md`。
