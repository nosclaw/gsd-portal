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

## 进度汇报与依赖协调

所有 WS 在**开始工作、进度更新、完成**时都需要向 Tech Manager 汇报。跨机器的 WS 之间需要实时通信。

### 现有生态调研

| 项目 | Stars | 方案 | 适用性 |
|------|-------|------|--------|
| **23blocks-OS/ai-maestro** | 571 | Peer mesh + AMP 协议 + Dashboard | 最完整，但架构复杂（无中心） |
| **mainion-ai/agent-mailbox** | — | MCP 原生，HTTP+SQLite，4 个 tools | 清晰简洁，单机 |
| **lleontor705/agent-mailbox** | — | SQLite，DLQ，visibility timeout，broadcast | 生产级特性，单机 |
| **gsd-build/context-packet** | 12 | DAG 上下文传递，MCP server | GSD 官方，无实时通信 |

**GSD 生态中没有任何跨 Agent 通信机制。** 这是全新的功能领域。

### 推荐方案：Portal WebSocket Hub

**我们已经有 GSD Portal 作为所有 WS 的管理中心。** 不需要 peer mesh 或独立服务 — Portal 天然就是消息枢纽。

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  WS1    │  │  WS2    │  │  WS3    │
│  Agent  │  │  Agent  │  │  Agent  │
└────┬────┘  └────┬────┘  └────┬────┘
     │ WS         │ WS         │ WS
     └────────────┼────────────┘
                  │
         ┌────────▼────────┐
         │   GSD Portal    │
         │   WebSocket Hub │
         │                 │
         │  • 消息路由      │
         │  • 进度聚合      │
         │  • 依赖监控      │
         │  • 状态广播      │
         └────────┬────────┘
                  │ WS
         ┌────────▼────────┐
         │ Tech Manager WS │
         │ Agent           │
         └─────────────────┘
```

**为什么用 Portal 而不是独立服务：**
- Portal 已经管理所有 WS 的生命周期
- Portal 已经有 WS 的身份信息（用户、角色、端口）
- Portal 已经有数据库可以持久化消息
- 不需要额外部署任何服务

### GSD 扩展：Portal Messenger

每个 WS 安装一个 GSD 扩展，通过 WebSocket 连接到 Portal：

**extension-manifest.json：**
```json
{
  "id": "portal-messenger",
  "name": "Portal Messenger",
  "version": "1.0.0",
  "description": "Cross-workspace messaging via GSD Portal WebSocket hub",
  "tier": "custom",
  "provides": {
    "tools": ["portal_send", "portal_wait", "portal_report_progress"],
    "hooks": ["session_start", "session_shutdown"]
  }
}
```

**扩展提供的 tools：**

| Tool | 用途 | 调用示例 |
|------|------|---------|
| `portal_send` | 向指定 WS 或 Tech Manager 发消息 | `portal_send({ to: "ws3", type: "DEPENDENCY_READY", data: { milestone: "M1" } })` |
| `portal_wait` | 非阻塞等待特定消息（后台轮询） | `portal_wait({ type: "DEPENDENCY_READY", from: "tech-manager" })` |
| `portal_report_progress` | 汇报当前进度给 Tech Manager | `portal_report_progress({ status: "S1.2 完成", milestone: "M1", progress: 50 })` |

**扩展工作流程：**

```javascript
module.exports = function portalMessenger(pi) {
  let ws;  // WebSocket connection

  // session_start: 连接 Portal + 汇报开始工作
  pi.on("session_start", async () => {
    const portalUrl = process.env.PORTAL_WS_URL || "ws://localhost:29000/api/ws/agent";
    const wsId = process.env.PORTAL_WS_ID;
    const token = process.env.PORTAL_WS_TOKEN;

    ws = new WebSocket(`${portalUrl}?wsId=${wsId}&token=${token}`);

    ws.on("message", (data) => {
      const msg = JSON.parse(data);
      // 收到消息时注入 Agent context
      pi.sendMessage({
        customType: `portal-${msg.type}`,
        content: `[Portal 消息] ${msg.from}: ${msg.type} — ${JSON.stringify(msg.data)}`,
        display: true
      }, { triggerTurn: true, deliverAs: "followUp" });
    });

    // 汇报：开始工作
    ws.send(JSON.stringify({
      type: "PROGRESS",
      data: { status: "started", milestone: process.env.GSD_MILESTONE }
    }));
  });

  // 发送消息
  pi.registerTool("portal_send", {
    description: "Send a message to another workspace via Portal",
    parameters: {
      to: { type: "string", description: "Target: ws1, ws2, tech-manager, or broadcast" },
      type: { type: "string", description: "Message type: DEPENDENCY_READY, PROGRESS, QUESTION, etc." },
      data: { type: "object", description: "Message payload" }
    },
    execute: async ({ to, type, data }) => {
      ws.send(JSON.stringify({ to, type, data }));
      return { sent: true };
    }
  });

  // 汇报进度
  pi.registerTool("portal_report_progress", {
    description: "Report current progress to Tech Manager",
    parameters: {
      status: { type: "string" },
      milestone: { type: "string" },
      progress: { type: "number", description: "0-100 percentage" }
    },
    execute: async ({ status, milestone, progress }) => {
      ws.send(JSON.stringify({
        to: "tech-manager",
        type: "PROGRESS",
        data: { status, milestone, progress }
      }));
      return { reported: true };
    }
  });

  // 非阻塞等待
  pi.registerTool("portal_wait", {
    description: "Register interest in a message type. Returns immediately. You will be notified via follow-up when the message arrives.",
    parameters: {
      type: { type: "string", description: "Message type to wait for" }
    },
    execute: async ({ type }) => {
      // WebSocket on("message") 已经在 session_start 中注册
      // 收到匹配消息时会自动通过 pi.sendMessage 通知 Agent
      return { waiting: true, type, note: "You will be notified when the message arrives." };
    }
  });

  // session_shutdown: 汇报结束 + 断开连接
  pi.on("session_shutdown", () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "PROGRESS",
        data: { status: "shutdown", milestone: process.env.GSD_MILESTONE }
      }));
      ws.close();
    }
  });
};
```

### Portal 端 WebSocket API

Portal 新增 WebSocket 端点 `/api/ws/agent`：

```
消息格式：
{
  from: "ws1",                    // 发送方（Portal 自动填充）
  to: "ws3" | "tech-manager" | "broadcast",
  type: "DEPENDENCY_READY" | "PROGRESS" | "QUESTION" | "REVIEW_REQUEST",
  data: { ... },
  ts: 1711700000000
}

Portal 职责：
• 认证 WS 连接（token 验证）
• 路由消息到目标 WS
• broadcast 消息发送给所有 WS
• 持久化消息到数据库（断线重连后可恢复）
• 聚合进度数据供 Dashboard 展示
```

### 消息类型

| 类型 | 发送方 | 接收方 | 触发时机 |
|------|--------|--------|----------|
| `PROGRESS` | 所有 WS | Tech Manager | 开始工作、完成 Slice、完成里程碑 |
| `DEPENDENCY_READY` | Tech Manager | 依赖方 WS | 上游里程碑合并到 main 后 |
| `REVIEW_REQUEST` | 开发 WS | Tech Manager | PR 创建后 |
| `REVIEW_FEEDBACK` | Tech Manager | 开发 WS | PR review 有修改意见 |
| `MILESTONE_COMPLETE` | Tech Manager | broadcast | 里程碑验收通过 |
| `QUESTION` | 任意 WS | Tech Manager | Agent 遇到需要协调的问题 |

### 进度汇报规则

在 `.gsd/KNOWLEDGE.md` 中声明：

```markdown
## 进度汇报
所有 WS 必须在以下时机调用 portal_report_progress：
- 开始工作时（status: "started"）
- 每个 Slice 完成时（status: "S1.2 完成", progress: 50）
- 创建 PR 时（status: "PR created", progress: 100）
- 收到 review 反馈修复完成时（status: "review fixes applied"）
```

---

## 依赖感知拆分

```
            ┌─────────────┐
            │  M0 依赖层   │
            │  WS1         │
            └──────┬──────┘
                   │ PR + portal_report_progress
                   ▼
            ┌─────────────┐
            │ Tech Manager│  合并 M0 → portal_send(DEPENDENCY_READY)
            │ WS          │           → broadcast 给所有等待的 WS
            └──────┬──────┘
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 用户  │ │ M2 支付  │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ portal_send             │
     │ (DEPENDENCY_READY)      │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 管理  │  ← WebSocket 实时收到通知
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
