# GSD 团队自动化开发最佳实践

基于 PRD 文档，使用多工作空间全自动并行开发。

适用于所有编程语言和项目类型。

---

## 核心理念

```
唯一的人工输入是 PRD.md 和工作空间数量。
完全使用 GSD 原生机制 — 里程碑系统、并行编排器、worktree 隔离。
每个工作空间运行 /gsd auto 后完全自主工作。
```

---

## GSD 原生机制概览

本最佳实践完全基于 GSD 已有的原生能力，不需要自定义文件格式或额外 skill。

| GSD 原生机制 | 我们如何使用 |
|-------------|-------------|
| **里程碑系统** | Phase 0 通过 GSD 原生讨论流程创建里程碑和 Slice |
| **`{MID}-CONTEXT.md`** | GSD 自动生成，包含目标、验收标准、技术约束 |
| **`{MID}-ROADMAP.md`** | GSD 自动生成 Slice 列表和执行计划 |
| **`{SID}-PLAN.md`** | GSD 自动拆分每个 Slice 为具体任务 |
| **并行编排器** | `parallel.enabled: true` 实现多 worker 并行开发 |
| **Worktree 隔离** | 每个 worker 在独立 worktree 中工作 |
| **`GSD_MILESTONE_LOCK`** | 每个 worker 锁定到一个里程碑 |
| **`custom_instructions`** | 追加模式，不覆盖系统默认行为 |
| **`.gsd/KNOWLEDGE.md`** | 项目知识注入，自动进入每个 agent prompt |
| **`pre_dispatch_hooks`** | 在任务执行前注入额外指令 |
| **`post_unit_hooks`** | 任务完成后触发检查（如依赖检测） |

### GSD 原生里程碑生命周期

```
讨论 → CONTEXT-DRAFT.md
     → {MID}-CONTEXT.md（目标、验收标准、约束）
     → {MID}-RESEARCH.md（可选，可跳过）
     → {MID}-ROADMAP.md（Slice 列表 + 执行计划）
     → 每个 Slice:
         → {SID}-RESEARCH.md（可选）
         → {SID}-PLAN.md（任务列表）
         → tasks/T01-PLAN.md, T02-PLAN.md...（具体任务）
         → 执行 → T01-SUMMARY.md...
         → {SID}-SUMMARY.md
     → {MID}-VALIDATION.md
     → {MID}-SUMMARY.md
```

所有文件在 `~/.gsd/projects/{hash}/milestones/M00N/` 中自动管理。
**不要**在项目根目录创建自定义的 milestone 文件。

---

## 工作空间（WS）

一个 WS 是 GSD Portal 中完全隔离的开发环境：

```
┌─────────────────────────────────────┐
│           GSD Workspace (WS)         │
│                                     │
│  • /home/{username}/                │
│  • 独立 Provider API Key            │
│  • 独立 GSD Agent 实例              │
│  • 独立 ~/.gsd/projects/ 状态       │
│                                     │
│  /gsd auto 后自主完成：              │
│  • GSD 原生里程碑流程               │
│  • 在 worktree 中编码               │
│  • 测试 → commit → push → PR       │
└─────────────────────────────────────┘
```

---

## 角色

| 角色 | 数量 | 职责 |
|------|------|------|
| **项目负责人** | 1 人类 | 提供 PRD.md、确认规划输出、最终发布 |
| **规划 WS** | 1 | Phase 0：技术选型、生成配置、通过 GSD 讨论流程创建里程碑 |
| **Tech Manager WS** | 1 | PR 审查、冲突解决、合并到 main、验收 |
| **开发 WS 1~N** | N | 各自负责一个里程碑（`GSD_MILESTONE_LOCK`） |

> 总共 N+1 个工作空间。规划 WS 可复用开发 WS1。

---

## 配置方式

### 项目级 `.gsd/PREFERENCES.md`（所有 WS 共享）

```yaml
mode: auto
always_use_skills:
  - standards
  - review
  - test
parallel:
  enabled: true
  max_workers: 3                    # = 开发 WS 数量
  merge_strategy: per-milestone
  auto_merge: confirm
git:
  worktree: true
  branch_protection: main
  merge_method: pr_only
  auto_push: true
  auto_pr: true
phases:
  skip_research: true               # 跳过研究阶段，加速执行
  reassess_after_slice: true        # 每个 Slice 完成后重新评估
custom_instructions:
  - 所有代码必须是真实业务逻辑，禁止 mock/stub
  - 遵循 ~/.gsd/standards/ 中的工程规范
```

### 项目级 `.gsd/KNOWLEDGE.md`（项目知识，自动注入 prompt）

```markdown
# 项目知识

## 技术选型
- 语言：TypeScript
- 运行时：Bun
- 框架：Next.js 15
- 数据库：PostgreSQL + Drizzle ORM
- 包管理器：bun

## 模块边界
- 每个里程碑对应独立目录：src/modules/{module-name}/
- 共享代码在 src/shared/
- 不允许跨模块直接修改其他模块的文件
- 模块间通过 src/shared/ 定义的接口契约交互

## 编码约束
- API 响应格式：{ data, error: { code, message } }
- 数据库操作使用事务包装多表写入
- 所有 API 路由需要单元测试
```

### 工作空间级 `~/.gsd/preferences.md`（Portal 编排器注入）

Tech Manager WS：
```yaml
custom_instructions:
  - 你是技术经理，不写业务代码
  - 持续监控所有开放的 PR
  - 审查代码质量后合并到 main
  - 对照 PRD.md 验收标准逐条检查
```

开发 WS：
```yaml
# 不需要额外注入 — GSD 原生里程碑系统
# 通过 GSD_MILESTONE_LOCK 自动锁定到对应里程碑
```

---

## 工作空间启动流程

新工作空间启动时是完全空的。需要理解一个关键事实：

> **GSD 里程碑文件是本地的。** `~/.gsd/projects/{hash}/milestones/` 只存在于创建它的 WS 中，不会通过 Git 传递给其他 WS。

因此，每个 WS 需要通过 GSD 原生讨论流程**各自创建自己的里程碑**。规划 WS 的产出通过 Git 仓库中的共享文件（PREFERENCES.md、KNOWLEDGE.md、PLAN.md）引导其他 WS 快速对齐。

### 完整启动链路

```
Phase 0 规划 WS 的产出（提交到 Git 仓库）：
─────────────────────────────────────────
project/
├── PRD.md                              # 原始需求
├── PLAN.md                             # 里程碑拆分 + WS 分配表（新增）
├── .gsd/
│   ├── PREFERENCES.md                  # 项目配置（parallel、git、skills）
│   └── KNOWLEDGE.md                    # 技术选型、模块边界、编码约束
└── src/                                # M0 依赖层代码（骨架 / 共享类型）
```

### PLAN.md — 团队工作蓝图

这是规划 WS 产出的**核心共享文件**，提交在 Git 仓库中。每个新 WS 启动后，GSD 读取此文件了解自己的任务分配：

```markdown
# 项目执行计划

## WS 分配

### Tech Manager WS
- 角色：技术经理，不写业务代码
- 职责：PR 审查、冲突解决、合并到 main、验收

### WS1 → M0 项目基础层（Phase 2a，先完成）
- 分支：feat/foundation
- 目标：项目初始化、共享类型、DB schema、基础组件、认证中间件
- 验收标准：
  - src/shared/ 包含完整的类型定义和公共工具
  - DB migration 可正常执行
  - 基础 API 框架可运行

### WS1 → M1 用户管理模块（Phase 2b，M0 后并行）
- 分支：feat/user-module
- 目标：用户注册/登录、列表、编辑、权限
- 依赖：M0
- 验收标准：
  - CRUD API 完整
  - 权限控制生效
  - 测试覆盖

### WS2 → M2 支付模块（Phase 2b，M0 后并行）
- 分支：feat/payment-module
- 目标：订单、支付集成、账单
- 依赖：M0
- 验收标准：
  - 订单创建和支付流程完整
  - 测试覆盖

### WS3 → M3 管理后台（Phase 2b，M1 合并后开始）
- 分支：feat/admin-module
- 目标：报表、设置、审计
- 依赖：M0, M1
- 验收标准：
  - 报表数据准确
  - 审计日志完整
  - 测试覆盖
```

### 每个 WS 的启动步骤

```
┌────────────────────────────────────────────────────────┐
│ Portal 编排器自动完成（WS 创建时）：                      │
│                                                        │
│  1. 创建工作空间 /home/{username}/                       │
│  2. 配置 .gsd/agent/auth.json（Provider API Key）       │
│  3. 克隆 Git 仓库到工作空间                              │
│  4. 写入工作空间级 ~/.gsd/preferences.md：               │
│     ┌──────────────────────────────────────────┐       │
│     │ custom_instructions:                      │       │
│     │   - 读取 PLAN.md，你是 WS2                │       │
│     │   - 你负责 M2 支付模块                     │       │
│     │   - 在 feat/payment-module 分支上工作      │       │
│     │   - 依赖 M0，M0 未合并前不要开始编码        │       │
│     └──────────────────────────────────────────┘       │
│  5. 启动 /gsd auto                                     │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ GSD Agent 自主完成：                                     │
│                                                        │
│  1. 读取 .gsd/PREFERENCES.md + .gsd/KNOWLEDGE.md       │
│  2. 读取 ~/.gsd/preferences.md（工作空间级指令）          │
│  3. 读取 PLAN.md，找到自己的分配（WS2 → M2）            │
│  4. 读取 PRD.md 中 M2 相关的需求                        │
│  5. 进入 GSD 讨论流程，创建自己的里程碑：                 │
│     → M001-CONTEXT.md（基于 PLAN.md 中 M2 的定义）       │
│     → M001-ROADMAP.md（Slice 拆分）                     │
│  6. 检查依赖：M0 是否已合并到 main？                     │
│     → 否：等待（Git 轮询或 Mailbox）                     │
│     → 是：git checkout feat/payment-module               │
│  7. 开始执行：Slice → Task → 编码 → 测试 → commit       │
│  8. 全部完成 → 创建 PR 到 main                          │
└────────────────────────────────────────────────────────┘
```

### Tech Manager WS 的启动

```
Portal 编排器写入工作空间级 preferences：
  custom_instructions:
    - 读取 PLAN.md，你是 Tech Manager
    - 不写业务代码
    - 持续监控所有开放的 PR
    - 审查代码质量后合并到 main
    - 对照 PLAN.md 中的验收标准逐条检查
    - 按依赖顺序合并：M0 → M1/M2 → M3

GSD 启动后：
  1. 读取 PLAN.md，理解所有里程碑和依赖关系
  2. 进入持续监控循环
  3. 不创建自己的里程碑 — 只做 review 和 merge
```

---

## 自动化流程

```
            PRD.md + WS 数量 N
                    │
        ┌───────────▼───────────┐
        │  规划 WS               │
        │  /gsd auto            │
        │                       │
        │  GSD 原生讨论流程：     │
        │  • 技术选型             │
        │  • PREFERENCES.md      │
        │  • KNOWLEDGE.md        │
        │  • N+1 个里程碑：       │
        │    M0 依赖层            │
        │    M1~MN 并行模块       │
        │  • Git 初始化           │
        │  • WS 分配表            │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │  项目负责人确认         │
        └───────────┬───────────┘
                    │
  ┌─────────────────┼──────────────────┐
  ▼                                    ▼
┌──────────┐                 ┌──────────────────┐
│ WS1      │                 │ Tech Manager WS  │
│ /gsd auto│                 │ /gsd auto        │
│ LOCK=M0  │                 │                  │
│          │                 │ 持续运行：        │
│ M0 → PR  │──── PR ───────▶│ 审查 → 合并       │
└────┬─────┘                 │                  │
     │ M0 合并后              │                  │
┌────┼────┐                  │                  │
▼    ▼    ▼                  │                  │
WS1  WS2  WSN                │                  │
LOCK LOCK LOCK               │                  │
=M1  =M2  =MN               │                  │
/gsd /gsd /gsd              │                  │
auto auto auto              │                  │
 │    │    │                  │                  │
 └PR──┴PR──┴──── PR ───────▶│ 审查 → 合并       │
                              │ 冲突解决           │
                              │ 验收报告           │
                              └──────────────────┘
```

### Phase 0：自动规划

使用 GSD 原生的**讨论流程**。规划 WS 启动 `/gsd auto` 后：

1. GSD 进入讨论阶段，读取 PRD.md
2. 完成技术选型
3. 生成并提交到 Git 仓库：
   - `.gsd/PREFERENCES.md` — 项目配置
   - `.gsd/KNOWLEDGE.md` — 技术选型 + 模块边界 + 编码约束
   - `PLAN.md` — 里程碑拆分 + WS 分配表 + 验收标准
   - M0 依赖层的代码骨架（src/shared/ 等）
4. 创建 Git 分支（feat/foundation, feat/user-module...）

**技术选型优先级：**

| 优先级 | 原则 | 示例 |
|--------|------|------|
| 1 | 最新最流行 | bun > pnpm > npm |
| 2 | 性能更好 | Bun > Node.js |
| 3 | 开发体验更好 | Next.js > CRA |
| 4 | 类型安全 | TypeScript > JavaScript |
| 5 | PRD 明确指定时遵循 | PRD 要求 Python → Python |

### Slice 分配

GSD 原生的里程碑系统中，Slice 在 `{MID}-ROADMAP.md` 中定义。在单个 WS 内，GSD 按顺序执行 Slice。

如果需要将 Slice 分配给不同的 WS，使用 GSD 的**并行编排器**：
- `parallel.enabled: true` + `max_workers` 设置
- 每个 worker 通过 `GSD_MILESTONE_LOCK` 锁定里程碑
- 在同一里程碑内，`reactive_execution` 可实现任务级并行

对于跨 WS 的 Slice 分配（如 M1 的 S1.1 给 WS1，S1.2 给 WS2），
当前 GSD 原生不支持 Slice 级跨 Agent 分配。
推荐做法：**将需要并行的 Slice 拆分为独立里程碑**，让每个 WS 锁定不同的里程碑。

---

## 依赖协调机制

当 WS3 的 M3 依赖 WS1 的 M1 时，需要一种机制让 WS3 等待 M1 完成。

### 当前方案：`post_unit_hooks` + Git 检查

利用 GSD 原生的 `post_unit_hooks` 机制，在每个任务完成后检查依赖状态：

```yaml
# .gsd/PREFERENCES.md
post_unit_hooks:
  - name: check-dependency
    after: [execute-task]
    run: "git fetch origin main && git log origin/main --oneline | head -5"
```

WS3 的 context 中声明依赖，Agent 在开始工作前自动检查 main 是否已包含 M1 代码。

**局限性：**
- `post_unit_hooks` 的 `run` 命令返回值会进入 agent context，但无法阻塞执行
- Agent 需要自己判断是否应该等待
- 没有真正的"阻塞等待"机制

### 未来方案：Agent Mailbox 扩展

基于 GSD 扩展系统的能力，开发一个 `agent-mailbox` 扩展是完全可行的：

**扩展架构：**

```
~/.gsd/agent/extensions/agent-mailbox/
├── extension-manifest.json
├── index.js
└── shared/                     # 共享消息目录（所有 WS 可访问）
    └── mailbox.jsonl            # 消息队列
```

**extension-manifest.json：**
```json
{
  "id": "agent-mailbox",
  "name": "Agent Mailbox",
  "version": "1.0.0",
  "description": "Cross-workspace dependency coordination via shared message queue",
  "tier": "custom",
  "provides": {
    "tools": ["mailbox_send", "mailbox_wait", "mailbox_check"],
    "hooks": ["session_start"]
  }
}
```

**实现原理：**

```javascript
// index.js（简化）
module.exports = function agentMailbox(pi) {
  const MAILBOX_PATH = "/opt/shared/mailbox.jsonl";  // 所有 WS 共享的路径

  // 注册工具：发送消息
  pi.registerTool("mailbox_send", {
    description: "Send a message to another workspace",
    parameters: { to: "string", type: "string", data: "object" },
    execute: async ({ to, type, data }) => {
      const msg = JSON.stringify({ to, type, data, from: process.env.USER, ts: Date.now() });
      fs.appendFileSync(MAILBOX_PATH, msg + "\n");
      return { sent: true };
    }
  });

  // 注册工具：等待特定消息
  pi.registerTool("mailbox_wait", {
    description: "Wait for a specific message type",
    parameters: { type: "string", timeout_seconds: "number" },
    execute: async ({ type, timeout_seconds = 300 }) => {
      const deadline = Date.now() + timeout_seconds * 1000;
      while (Date.now() < deadline) {
        const messages = readMailbox().filter(m => m.to === process.env.USER && m.type === type);
        if (messages.length > 0) return { received: true, message: messages[0] };
        await sleep(10000);  // 每 10 秒检查一次
      }
      return { received: false, timeout: true };
    }
  });

  // session_start hook：启动时检查收件箱
  pi.on("session_start", async () => {
    const pending = readMailbox().filter(m => m.to === process.env.USER);
    if (pending.length > 0) {
      pi.sendMessage({
        customType: "mailbox-notification",
        content: `你有 ${pending.length} 条新消息：\n${pending.map(m => `- ${m.type}: ${JSON.stringify(m.data)}`).join("\n")}`,
        display: true
      }, { triggerTurn: false });
    }
  });
};
```

**使用方式：**

Tech Manager 合并 M1 后：
```
→ Agent 调用 mailbox_send({ to: "ws3", type: "DEPENDENCY_READY", data: { milestone: "M1" } })
```

WS3 的 Agent 启动时：
```
→ session_start hook 检查收件箱
→ 发现 DEPENDENCY_READY 消息
→ 开始执行 M3
```

或者在 context 中声明等待：
```
→ Agent 调用 mailbox_wait({ type: "DEPENDENCY_READY", timeout_seconds: 3600 })
→ 阻塞等待，最多 1 小时
→ 收到消息后开始执行
```

**可行性评估：**

| 方面 | 评估 |
|------|------|
| 技术可行性 | ✅ 完全可行 — `pi.registerTool()` + `pi.sendMessage()` + `pi.on("session_start")` 都是已有 API |
| 共享存储 | ✅ 所有 WS 可访问共享路径（如 `/opt/shared/` 或 Git 仓库内的 `.gsd-mailbox/`） |
| 消息可靠性 | ⚠️ JSONL 文件追加写入，需要文件锁避免并发写入冲突 |
| 阻塞等待 | ⚠️ `mailbox_wait` 会占用一个 tool call，期间 Agent 被阻塞。建议改用 polling + `pi.sendMessage()` 非阻塞通知 |
| 消息清理 | 需要定期清理已处理的消息 |

**推荐改进：非阻塞轮询模式**

```javascript
// 不阻塞 Agent，而是后台轮询 + 注入消息
pi.on("session_start", () => {
  const interval = setInterval(async () => {
    const messages = readMailbox().filter(m => m.to === process.env.USER && !m.consumed);
    if (messages.length > 0) {
      markConsumed(messages);
      clearInterval(interval);
      pi.sendMessage({
        customType: "dependency-ready",
        content: `依赖已就绪：${messages.map(m => m.data.milestone).join(", ")}。可以开始工作了。`,
        display: true
      }, { triggerTurn: true, deliverAs: "followUp" });
    }
  }, 10000);  // 每 10 秒检查
});
```

---

## 依赖感知拆分

```
            ┌─────────────┐
            │  M0 依赖层   │  ← 必须先完成
            │  WS1 LOCK=M0│
            └──────┬──────┘
                   │ PR → Tech Manager 合并
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 用户  │ │ M2 支付  │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ M1 合并后               │
     │ Tech Manager 发送       │
     │ DEPENDENCY_READY        │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 管理  │  ← mailbox_wait 或 Git 检查
                         │ WS3      │
                         └──────────┘
```

**拆分规则：**
- 共享依赖 → M0（类型、schema、基础组件、中间件）
- 并行模块数 = WS 数量 N
- 如果同一里程碑内的 Slice 需要分配给不同 WS → 将 Slice 提升为独立里程碑
- 每个模块独立目录，不允许跨模块编辑
- M0 定义模块间的接口契约

---

## 适用范围

| 项目类型 | M0 依赖层 | 并行拆分方式 |
|----------|----------|-------------|
| Web 前端 | 路由、共享组件、API client | 按页面/功能模块 |
| Web 后端 | DB schema、中间件、工具 | 按 domain/service |
| 全栈 | monorepo、共享类型、API schema | 垂直切分或层分离 |
| 移动端 | 导航、设计系统、网络层 | 按功能模块 |
| 桌面端 | 窗口框架、IPC | 按功能模块 |
| CLI / 库 | 核心接口、配置 | 按子命令/模块 |
| 微服务 | proto/schema、CI 模板 | 天然按服务 |
| 数据工程 | pipeline 框架 | 按 pipeline 阶段 |
| 基础设施 | provider 配置 | 按资源组/环境 |

---

## 速查

```
1. 项目负责人 → PRD.md + WS 数量 N
2. 规划 WS → /gsd auto → 提交到 Git：
   • .gsd/PREFERENCES.md + .gsd/KNOWLEDGE.md
   • PLAN.md（里程碑拆分 + WS 分配 + 验收标准）
   • M0 代码骨架 + Git 分支
3. 项目负责人 → 确认 PLAN.md
4. Portal 编排器 → 创建 N+1 个 WS：
   • 克隆仓库 + 写入 WS 级 preferences（编号 + 分配）+ /gsd auto
5. 每个开发 WS 自动：
   • 读 PLAN.md → GSD 讨论流程创建自己的里程碑 → 检查依赖 → 编码 → PR
6. Tech Manager WS 自动：
   • 监控 PR → 审查 → 合并 → 验收报告
7. 项目负责人 → 确认 → 发布
```
