> 历史档案：本文件是旧项目文档的脱敏副本。旧状态、通过项、提议和实现说明不代表新项目状态或验收；当前决定以新开发设计为准。旧私有证据及机器路径没有公开复制。

# 宇宙执行协议 v2

## 预览与执行

本地方案字段为 version=2、planId、createdAt、vaultIdentity、rules、dependencies、expected、operations、previews、summary、planHash、state。planHash 对规范排序的不可变业务字段计算 SHA256，运行状态、回执和确认时间不进入指纹。

普通写入需求只授权读取和生成方案。预览结果的 workflow 标明 plan-review、present-plan-and-wait、requestIsApproval=false、requiresUserReply=true；Agent 展示后结束本轮。用户后续对已展示范围的批准进入执行阶段。同范围已有批准可继续，用户明确要求跳过本次方案审批时遵循其授权；不能将普通行动请求视为自动跳过。流程提示不承担宿主权限或独立身份验证。

cosmos_apply 输入仅为 {planId,planHash,approved:true}。拒绝缺少确认、错误指纹、保存内容篡改、历史 v1、无资格动作、类型/目录/关系错误、同名冲突、相关输入变化。批准记录包含 kind=caller-confirmation、humanApprovalIndependentlyVerified=false、范围指纹与时间。没有厂商字段或会话 UUID。

发布预览使用 version=2、previewId、previewHash，包含操作类别、网站身份、规则和公开副本。上传、恢复、撤稿以对应编号+指纹+approved 确认，不能交换操作类型；联网上线刷新单独声明确认。发布结果不确定保留记录和锁，不重复提交。

## 依赖与时间

范围依赖包含受影响文件、真实关联、已选择目录、所用模板、相关 TaskNotes 设置和需要更新的入链。执行前再次按当前模型生成预览并比对，不把无关全库笔记指纹当门禁。创建时间用于稳定比较，记录日期与任务计划日期在预览中明确冻结；实际写入时间仍由业务引擎记录。

## 入口

MCP 与 CLI 调用同一 createService。CLI 可用 --config 或 COSMOS_CONFIG，支持 --input - 读取 UTF-8 JSON、参数文件或内联对象。技能 scripts/cosmos.mjs 只负责定位共同执行器；连接缺失时返回环境说明，不直接写笔记。stdio MCP 无日志混入 stdout。

## 历史与恢复

旧协议记录只读保留，既有 operationId 可查询。新接口不自动重放 v1 请求，也不把 v1 approvalRef 解释成 v2 确认。执行完成重复查询复用回执；running、partial、failed、uncertain 要先检查后另行规划剩余项。缺失回执不能从文件存在推断成功；不自动删空文件、清锁或恢复覆盖。
