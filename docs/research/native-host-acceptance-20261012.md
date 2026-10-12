# 真实宿主验收接口核对

2026-10-12。按开发契约固定 gpt-6-luna / xhigh；未切换用户宿主设置。以下说明新 harness 的接口来源，不表示验收已通过。

[OpenAI 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)提供 JSONL 事件与持久 resume；[技能发现](https://learn.chatgpt.com/docs/build-skills)说明用户 .agents/skills 与符号链接发现。[GPT-6 Luna 模型页](https://developers.openai.com/api/docs/models/gpt-6-luna)列出 xhigh reasoning 支持。新 Codex 评估固定官方 codex-sdk/CLI 0.162.1，运行原生 executable，不以手写工具循环替代宿主。

[Claude 程序化模式](https://code.claude.com/docs/en/headless)说明 JSON/stream-json、会话恢复与中断行为；[技能发现](https://code.claude.com/docs/en/skills)说明 .claude/skills。新 Claude 评估固定官方 claude-agent-sdk 0.3.295 与对应平台运行包。两个 SDK 的 dependencies/optionalDependencies 通过 npm 官方 registry 核对，另生成新 lockfile；没有复用旧 lockfile。

每个样本使用新的隔离宿主目录、持久会话和独立库外状态，操作官方 Obsidian 1.14.4、TaskNotes 4.13.8；合成事实和后来批准由测试控制器提供。自然发现与预载正文分别记录，批准后开启新的 SDK 会话句柄 resume 原会话。模型凭据从既有测试网关按原账号来源写入新 CI secret，不修改本机账号、模型或权限。

计划分别测任务 ≤90 秒、游记 ≤150 秒；批准后执行/复检 ≤60 秒。三次独立样本均须满足，不能以中位数掩盖失败。完整报告保存 unique native response ID 数量、宿主调用、新业务命令、额外探索、CLI/实际执行/读回时间及准确批准正文。smoke 只验证配置与首个样本，不能替代 full 发行门槛。

内容机器检查只覆盖结构、明确事实、未编造图片及实际批准正文一致性；最终还需读取实际生成文本按内容 rubric 审阅，区分机器断言与文本质量判断。

## 首轮失败及原生激活修正

run 38174593104 的手写 `<skill>` XML 预载被模型再次读取或调用 Skill，不能据此宣称已加载条件成立。官方 codex-sdk 0.162.1 `UserInput` 仅支持文本/本地图片，不能表达 typed skill input；新 harness 改用同一官方 CLI 的 [app-server 协议](https://learn.chatgpt.com/docs/app-server)，先初始化、列出实际十技能，再通过 `turn/start` 的 `skill` item 让宿主注入正文。自然组只给原业务请求。每轮启动新的原生 server 并 resume 原持久线程，模型和权限设置保存在隔离目录，未修改用户设置。

Claude 预载组改用原生 `/cosmos-life` 或 `/cosmos-tasks` slash 输入，由宿主展开正文；不手写技能注入，不额外教学命令顺序。所有宿主调用、工具结果、实际响应 ID 仍记录。恢复测试用官方中断机制在实际终端回执后取消 turn；报告区分宿主中断和业务回执，不把模拟状态当原生执行。

首轮 Claude 游记分别约 67/78 秒，提交约 17/9 秒，但完整命令与响应门槛未满足，因此均失败。Codex 四组与 Claude 任务两组首轮超时，尚不能判断主要耗时来源。新增原生错误与 stderr 诊断，保持 gpt-6-luna/xhigh、90/150/60 秒和三次独立样本门槛。
