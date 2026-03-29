# GSD 团队自动化开发最佳实践

基于 PRD 文档，使用多人类开发者 + 多 GSD AI Agent 团队实现全自动化并行开发。

适用于所有编程语言和项目类型。

---

## 核心理念

```
唯一的人工输入是 PRD.md 和开发者人数。
其余一切 — 技术选型、任务拆分、Git 配置、编码、提交、协作、合并 — 全部自动化。
```

---

## 角色定义

### 开发单元

一个**开发单元** = 一个 **GSD Workspace**（独立工作环境）。

每个 Workspace 是完全隔离的：
- 独立的 home 目录（`/home/{username}/`）
- 独立的 Provider API Key（如 OpenRouter API Key）
- 独立的 GSD Agent 实例
- 由一个人类开发者负责监督

```
┌─────────────────────────────────────────┐
│          GSD Workspace                   │
│          （一个开发单元）                   │
│                                         │
│  独立环境：                               │
│  • /home/{username}/                     │
│  • 独立 OpenRouter API Key               │
│  • 独立 GSD Agent 实例                    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │        GSD AI Agent               │  │
│  │                                   │  │
│  │  • 在 Git Worktree 中自动编码      │  │
│  │  • 运行测试                        │  │
│  │  • commit + push                  │  │
│  │  • 创建 PR                        │  │
│  │  • 根据 review 意见自动修复        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  监督者：人类开发者 A                      │
│  • 启动 /gsd auto                       │
│  • 观察进度，必要时干预                    │
└─────────────────────────────────────────┘
```

### 角色总览

| 角色 | 身份 | 数量 | 职责 |
|------|------|------|------|
| **项目负责人** | 人类 | 1 | 提供 PRD.md、确认 Phase 0 输出、最终发布决策 |
| **Tech Manager** | GSD AI Agent（独立 Workspace） | 1 | PR 审查、冲突解决、合并到 main、验收审查 |
| **开发单元** | GSD Workspace（含 Agent + 人类监督者） | N | 每个单元负责一个里程碑的全部实现 |

> **总共需要 N+1 个 GSD Workspace：** N 个用于开发单元，1 个用于 Tech Manager。

### Tech Manager

独立的 GSD Workspace，运行专职集成 Agent，**不写业务代码**。
职责由 [`tech-manager` skill](./skills/tech-manager/SKILL.md) 定义：
- 持续监控所有开放的 PR
- 审查代码质量、安全性、规范符合度
- 解决合并冲突，保留双方意图
- 合并到受保护的 main 分支
- 对照 PRD.md 验收标准逐条检查
- 所有模块合并后输出验收报告

---

## Git Worktree 模式

所有开发单元**必须**使用 Git Worktree 模式。在 `PREFERENCES.md` 中声明：

```markdown
## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true
```

GSD Agent 在 `/gsd auto` 启动时自动：
1. 从主仓库创建 Git Worktree（独立工作目录）
2. 在分配的 feature 分支上工作
3. 不影响 main 分支和其他 Workspace 的 worktree
4. 完成后自动创建 PR，不直接合并

---

## 自动化流程

```
                   PRD.md + 开发单元数量 N
                           │
               ┌───────────▼───────────┐
               │    /team-kickoff      │  ← GSD Skill 自动执行
               │                       │
               │  • 技术选型（最新技术） │
               │  • 生成 PREFERENCES.md │
               │  • 里程碑 + Slice 拆分 │
               │  • 开发单元分配        │
               │  • Git worktree 配置   │
               └───────────┬───────────┘
                            │
               ┌───────────▼───────────┐
               │  项目负责人审核确认     │  ← 唯一的人工检查点
               └───────────┬───────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                                     ▼
┌──────────────────┐                 ┌───────────────────┐
│  Workspace 1     │                 │  Tech Manager     │
│  (开发单元 1)     │                 │  Workspace        │
│  Agent 1         │                 │  /gsd auto        │
│  /gsd auto       │                 │                   │
│                  │                 │  持续运行：         │
│  M0 依赖层 → PR  │──── PR ───────▶│  审查 → 合并       │
└────────┬─────────┘                 │                   │
         │ M0 合并后                  │                   │
┌────────┼────────┐                  │                   │
▼        ▼        ▼                  │                   │
WS 1    WS 2    WS N                │                   │
Agent1  Agent2  AgentN               │                   │
/gsd    /gsd    /gsd                │                   │
auto    auto    auto                │                   │
  │       │       │                  │                   │
  └─ PR ──┴─ PR ──┴──── PR ───────▶│  审查 → 合并       │
                                     │  冲突解决           │
                                     │  验收报告           │
                                     └───────────────────┘
```

---

## 里程碑与 Slice 自动拆分

Phase 0 中 `/team-kickoff` skill 会自动生成完整的里程碑和 Slice 结构。

### 拆分产物

对于每个里程碑，自动生成：

```
~/.gsd/projects/{hash}/milestones/
├── M000/                              # 依赖层
│   ├── CONTEXT.md                     # 里程碑上下文、目标、验收标准
│   └── DECISIONS.md                   # 技术决策记录
├── M001/                              # 并行模块 1
│   ├── CONTEXT.md
│   └── DECISIONS.md
├── M002/                              # 并行模块 2
│   ├── CONTEXT.md
│   └── DECISIONS.md
└── M003/                              # 并行模块 3
    ├── CONTEXT.md
    └── DECISIONS.md
```

### CONTEXT.md 内容结构

每个里程碑的 CONTEXT.md 包含 Agent 自动开发所需的全部信息：

```markdown
# M1 — 用户管理模块

## 分配
- 开发单元：Workspace 1
- GSD Agent：Agent 1
- 人类监督者：开发者 A
- 分支：feat/user-module

## 目标
从 PRD.md 提取的本模块需求摘要。

## Slice 列表

### S1.1 用户注册 / 登录 API
- 实现内容：POST /api/auth/register, POST /api/auth/login
- 验收标准：
  - 注册成功返回 201 + 用户 ID
  - 密码使用 bcrypt 哈希
  - 登录返回 JWT token
- 依赖：M0 的认证中间件和用户类型定义

### S1.2 用户列表页 + 搜索过滤
- 实现内容：GET /api/users (分页), 前端列表页
- 验收标准：
  - 支持按用户名、邮箱搜索
  - 分页参数：page, perPage
  - 响应格式：{ data: [], total, page, perPage }
- 依赖：M0 的共享表格组件和 API client

### S1.3 用户详情编辑 + 权限控制
- 实现内容：PUT /api/users/:id, 前端编辑表单
- 验收标准：
  - 只有 ADMIN 角色可以编辑其他用户
  - 编辑成功返回 200 + 更新后的用户
  - 表单验证：必填字段、邮箱格式
- 依赖：M0 的权限检查工具

### S1.4 测试
- 实现内容：单元测试 + 集成测试
- 验收标准：
  - API 路由 100% 覆盖
  - 权限边界测试（非 ADMIN 尝试编辑）

## 模块边界
- 本模块只修改 src/modules/user/ 目录下的文件
- 使用 M0 定义的共享类型和组件，不修改它们
- 与其他模块通过 M0 定义的接口契约交互

## 技术约束
- 遵循 PREFERENCES.md 中的所有规则
- 使用 M0 中定义的 API 响应格式
- 数据库操作使用 M0 中配置的 ORM
```

### 完整分配表示例（3 个开发单元）

```
=== 里程碑与开发单元分配表 ===

Tech Manager Workspace（GSD AI Agent，独立运行）
  职责：PR 审查、冲突解决、合并、验收
  分支：在 main 上操作

─────────────────────────────────────────────────────
  依赖层（Phase 2a — 必须先完成）
─────────────────────────────────────────────────────

  Workspace 1 → 里程碑 M0（项目基础层）
    GSD Agent: Agent 1
    人类监督者: 开发者 A
    分支: feat/foundation
    Slice:
      S0.1 项目初始化 + 工具链配置
      S0.2 共享类型定义 + 数据库 schema + migration
      S0.3 基础组件库 + 公共工具函数
      S0.4 认证中间件 + API client + 错误处理
      S0.5 CI 配置 + lint + 测试框架

─────────────────────────────────────────────────────
  并行层（Phase 2b — M0 合并后全部同时开始）
─────────────────────────────────────────────────────

  Workspace 1 → 里程碑 M1（用户管理模块）
    GSD Agent: Agent 1
    人类监督者: 开发者 A
    分支: feat/user-module
    Slice:
      S1.1 用户注册 / 登录 API
      S1.2 用户列表页 + 搜索过滤
      S1.3 用户详情编辑 + 权限控制
      S1.4 单元测试 + 集成测试

  Workspace 2 → 里程碑 M2（支付模块）
    GSD Agent: Agent 2
    人类监督者: 开发者 B
    分支: feat/payment-module
    Slice:
      S2.1 订单创建 API + 数据模型
      S2.2 支付网关集成（Stripe / 支付宝）
      S2.3 账单管理页面 + 退款流程
      S2.4 单元测试 + 集成测试

  Workspace 3 → 里程碑 M3（管理后台模块）
    GSD Agent: Agent 3
    人类监督者: 开发者 C
    分支: feat/admin-module
    Slice:
      S3.1 数据报表 API + 图表可视化
      S3.2 系统设置页面
      S3.3 审计日志 + 操作记录
      S3.4 单元测试 + 集成测试
```

---

## 依赖感知拆分规则

```
                  ┌────────────────────────┐
                  │  M0 依赖层              │    ← 必须先完成
                  │  Workspace 1            │
                  │  Agent 1 + 开发者 A     │
                  └──────────┬─────────────┘
                             │ PR → Tech Manager 合并到 main
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │ M1 用户模块  │  │ M2 支付模块  │  │ M3 管理后台  │  ← 全部并行
   │ WS 1        │  │ WS 2        │  │ WS 3        │
   │ Agent1+DevA │  │ Agent2+DevB │  │ Agent3+DevC │
   └─────────────┘  └─────────────┘  └─────────────┘
```

**拆分规则：**
- 被多个模块依赖的代码归入 M0 依赖层（类型、schema、基础组件、中间件）
- 并行模块数 = 开发单元数量 N，最大化并行度
- 每个模块对应一个里程碑（M1, M2, M3...），每个里程碑拆分为多个 Slice（S1.1, S1.2...）
- 每个 Slice 包含：实现内容、验收标准、依赖说明
- 每个模块有独立的目录，不允许跨模块编辑
- M0 定义模块间的接口契约，各模块按契约实现

### 多级依赖处理

当并行模块之间也存在依赖时：

```
M0 依赖层 → 先完成
  │
  ├── M1（无依赖）         ← Phase 2b-1，立即开始
  ├── M2（无依赖）         ← Phase 2b-1，立即开始
  └── M3（依赖 M1 的用户 API）← Phase 2b-2，M1 合并后开始
```

Tech Manager 负责监控依赖状态，M1 的 PR 合并后通知 Workspace 3 开始 M3。

---

## 技术选型原则

| 优先级 | 原则 | 示例 |
|--------|------|------|
| 1 | **优先最新、最流行的技术** | bun > pnpm > yarn > npm |
| 2 | **选择性能更好的方案** | Bun runtime > Node.js（如果兼容） |
| 3 | **选择开发体验更好的框架** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **选择类型安全的方案** | TypeScript > JavaScript, Rust > C |
| 5 | **PRD 有明确指定时，遵循 PRD** | PRD 要求 Python → 用 Python |

---

## GSD 配置层级

```
项目 PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
    （最高优先级）              （项目状态，GSD 自动管理）            （全局默认）
```

| 层级 | 路径 | 管理方式 |
|------|------|----------|
| 全局 | `~/.gsd/` | 系统默认值、API 密钥、已安装 skills |
| 项目状态 | `~/.gsd/projects/{hash}/` | GSD 自动管理（里程碑、状态、决策、知识） |
| 项目配置 | 项目根目录 `PREFERENCES.md` | Phase 0 自动生成 |

---

## 适用范围

| 项目类型 | M0 依赖层 | 并行层拆分方式 |
|----------|----------|---------------|
| Web 前端 | 路由、共享组件、API client、状态骨架 | 按页面/功能模块 |
| Web 后端 | DB schema、中间件、公共工具 | 按 domain/service |
| 全栈 | monorepo 初始化、共享类型、API schema | 前后端分离或功能垂直切分 |
| 移动端 | 导航、设计系统、网络层 | 按功能模块 |
| 桌面端 | 窗口框架、IPC、共享状态 | 按功能模块 |
| CLI / 库 | 核心接口、配置系统 | 按子命令/模块 |
| 微服务 | proto/schema 定义、CI 模板 | 天然按服务拆分 |
| 数据工程 | pipeline 框架、共享连接器 | 按 pipeline 阶段 |
| 基础设施 | provider 配置、共享 module | 按资源组/环境 |

---

## 速查

```
1. 项目负责人 → 提供 PRD.md + 开发单元数量 N
2. /team-kickoff → 自动生成一切：
   • 技术选型
   • PREFERENCES.md（含 git worktree 配置）
   • 里程碑 M0~MN + 每个里程碑的 Slice 列表
   • 每个里程碑的 CONTEXT.md（目标、验收标准、模块边界）
   • 开发单元分配表（Workspace → Agent → 人类监督者 → 分支）
   • Git 初始化（main 保护 + feature 分支）
3. 项目负责人 → 确认分配表
4. Workspace 1: 开发者 A → /gsd auto → Agent 1 完成 M0 → PR
5. Tech Manager Workspace → /gsd auto → 审查 → 合并 M0 到 main
6. Workspace 1~N: 所有开发者 → /gsd auto → 各 Agent 并行开发 → 各自 PR
7. Tech Manager → 逐个审查 → 冲突解决 → 合并 → 验收报告
8. 项目负责人 → 确认验收 → 发布
```
