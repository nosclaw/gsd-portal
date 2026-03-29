# GSD 团队自动化开发最佳实践

基于 PRD 文档，使用多工作空间全自动并行开发。

适用于所有编程语言和项目类型。

---

## 核心理念

```
唯一的人工输入是 PRD.md 和工作空间数量。
其余一切 — 技术选型、任务拆分、Git 配置、编码、提交、协作、合并 — 全部自动化。
每个工作空间运行 /gsd auto 后完全自主工作，无需人类监督。
```

---

## 工作空间

一个**工作空间**（Workspace）是 GSD Portal 中的一个完全隔离的开发环境：

- 独立的 home 目录（`/home/{username}/`）
- 独立的 Provider API Key（如 OpenRouter API Key）
- 独立的 GSD Agent 实例
- 通过 `/gsd auto` 完全自主运行

```
┌─────────────────────────────────────┐
│        GSD Workspace                 │
│                                     │
│  隔离环境：                          │
│  • /home/{username}/                │
│  • 独立 Provider API Key            │
│  • 独立 GSD Agent 实例              │
│                                     │
│  运行 /gsd auto 后自主完成：         │
│  • 在 Git Worktree 中编码           │
│  • 运行测试                         │
│  • commit + push                    │
│  • 创建 PR                          │
│  • 根据 review 意见自动修复          │
└─────────────────────────────────────┘
```

---

## 角色

| 角色 | 数量 | 职责 | 如何实现 |
|------|------|------|----------|
| **项目负责人** | 1 | 提供 PRD.md、确认规划输出、最终发布 | 人工操作 |
| **规划工作空间** | 1 | Phase 0：技术选型、生成配置、拆分任务、Git 初始化 | `/gsd auto`，Role = 技术架构师 |
| **Tech Manager 工作空间** | 1 | PR 审查、冲突解决、合并到 main、验收 | `/gsd auto`，Role = 技术经理 |
| **开发工作空间 1~N** | N | 各自完成一个里程碑的全部实现 | `/gsd auto`，Role = 开发者 |

> **总共需要 N+1 个工作空间：** N 个开发 + 1 个 Tech Manager。
> 规划工作空间可复用开发工作空间 1。

### 通过 PREFERENCES.md 的 Role 区分角色

每个工作空间的行为由项目根目录的 `PREFERENCES.md` 中的 Role 定义决定。GSD 原生读取这个文件，不需要额外的 skill。

**规划工作空间的 Role（Phase 0）：**

```markdown
## Role
你是技术架构师，负责项目初始化规划。
读取 PRD.md，完成技术选型、任务拆分、Git 配置。
不写业务代码。
```

**Tech Manager 工作空间的 Role：**

```markdown
## Role
你是技术经理（Tech Manager），负责代码集成和团队协调。
不写业务代码。职责：
- 持续监控所有开放的 PR
- 审查代码质量、安全性、规范符合度
- 解决合并冲突，保留双方意图
- 合并到受保护的 main 分支
- 对照 PRD.md 验收标准逐条检查
- 所有模块合并后输出验收报告
```

**开发工作空间的 Role：**

```markdown
## Role
你是开发者，负责实现分配给你的里程碑。
读取对应的 milestone context 文件，按 Slice 顺序逐个实现。
在分配的分支上工作，完成后创建 PR。
```

---

## Git Worktree 模式

在 `PREFERENCES.md` 中声明，GSD 原生支持：

```markdown
## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true
```

---

## 自动化流程

```
               PRD.md + 工作空间数量 N
                       │
           ┌───────────▼───────────┐
           │  规划工作空间           │
           │  /gsd auto            │
           │  Role: 技术架构师      │
           │                       │
           │  • 技术选型            │
           │  • 生成 PREFERENCES.md │
           │  • 里程碑 + Slice 拆分 │
           │  • Milestone Context  │
           │  • Git 初始化          │
           │  • 工作空间分配表      │
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  项目负责人确认         │  ← 唯一的人工检查点
           └───────────┬───────────┘
                       │
     ┌─────────────────┼──────────────────┐
     ▼                                    ▼
┌────────────┐                  ┌──────────────────┐
│ WS 1       │                  │ Tech Manager WS  │
│ /gsd auto  │                  │ /gsd auto        │
│            │                  │                  │
│ M0 依赖层  │                  │ 持续运行：        │
│ → PR       │──── PR ────────▶│ 审查 → 合并       │
└──────┬─────┘                  │                  │
       │ M0 合并后               │                  │
┌──────┼──────┐                 │                  │
▼      ▼      ▼                 │                  │
WS 1  WS 2  WS N               │                  │
/gsd  /gsd  /gsd               │                  │
auto  auto  auto               │                  │
 │     │     │                  │                  │
 └─PR──┴─PR──┴──── PR ───────▶│ 审查 → 合并       │
                                │ 冲突解决           │
                                │ 验收报告           │
                                └──────────────────┘
```

---

## Phase 0：自动规划

Phase 0 就是一个普通的 `/gsd auto` 会话，不需要特殊 skill。规划工作空间读取 PRD.md 后自动完成以下产出：

### 产出 1：技术选型

遵循选型优先级：

| 优先级 | 原则 | 示例 |
|--------|------|------|
| 1 | **优先最新、最流行的技术** | bun > pnpm > yarn > npm |
| 2 | **选择性能更好的方案** | Bun runtime > Node.js |
| 3 | **选择开发体验更好的框架** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **选择类型安全的方案** | TypeScript > JavaScript |
| 5 | **PRD 有明确指定时，遵循 PRD** | PRD 要求 Python → 用 Python |

### 产出 2：PREFERENCES.md

写入项目根目录，包含 Role、skills 配置、git_workflow 等。

### 产出 3：Milestone Context 文件

在项目根目录的 `milestones/` 下，为每个里程碑生成 context 文件：

```
milestones/
├── m0-foundation-context.md
├── m1-user-module-context.md
├── m2-payment-module-context.md
└── m3-admin-module-context.md
```

每个 context 文件的结构：

```markdown
# M1 — 用户管理模块

## 分配
- 工作空间：Workspace 1
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
- 依赖：M0 的权限检查工具

### S1.4 测试
- 验收标准：
  - API 路由 100% 覆盖
  - 权限边界测试

## 模块边界
- 只修改 src/modules/user/ 目录下的文件
- 使用 M0 定义的共享类型和组件，不修改它们
- 与其他模块通过 M0 定义的接口契约交互
```

### 产出 4：工作空间分配表

```
=== 工作空间分配表 ===

Tech Manager 工作空间
  Role: 技术经理
  职责：PR 审查、冲突解决、合并、验收

─────────────────────────────────────────────────
  依赖层（Phase 2a — 必须先完成）
─────────────────────────────────────────────────

  Workspace 1 → M0 项目基础层
    分支: feat/foundation
    Context: milestones/m0-foundation-context.md
    Slice:
      S0.1 项目初始化 + 工具链配置
      S0.2 共享类型定义 + 数据库 schema
      S0.3 基础组件库 + 公共工具函数
      S0.4 认证中间件 + API client
      S0.5 CI 配置 + lint + 测试框架

─────────────────────────────────────────────────
  并行层（Phase 2b — M0 合并后全部同时启动）
─────────────────────────────────────────────────

  Workspace 1 → M1 用户管理模块
    分支: feat/user-module
    Context: milestones/m1-user-module-context.md
    Slice:
      S1.1 用户注册 / 登录 API
      S1.2 用户列表页 + 搜索过滤
      S1.3 用户详情编辑 + 权限控制
      S1.4 单元测试 + 集成测试

  Workspace 2 → M2 支付模块
    分支: feat/payment-module
    Context: milestones/m2-payment-module-context.md
    Slice:
      S2.1 订单创建 API + 数据模型
      S2.2 支付网关集成
      S2.3 账单管理页面
      S2.4 单元测试 + 集成测试

  Workspace 3 → M3 管理后台模块
    分支: feat/admin-module
    Context: milestones/m3-admin-module-context.md
    Slice:
      S3.1 数据报表 API + 图表可视化
      S3.2 系统设置页面
      S3.3 审计日志
      S3.4 单元测试 + 集成测试
```

### 产出 5：Git 初始化

- main 分支保护（禁止直接 push、只能 PR 合并）
- 创建 feature 分支（feat/foundation, feat/user-module...）

---

## 依赖感知拆分

```
               ┌────────────────────┐
               │  M0 依赖层          │    ← 必须先完成
               │  Workspace 1       │
               └────────┬───────────┘
                        │ PR → Tech Manager 合并到 main
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ M1 用户   │ │ M2 支付   │ │ M3 管理   │  ← 全部并行
   │ WS 1      │ │ WS 2      │ │ WS 3      │
   └───────────┘ └───────────┘ └───────────┘
```

**拆分规则：**
- 被多个模块依赖的代码归入 M0（类型、schema、基础组件、中间件）
- 并行模块数 = 工作空间数量 N
- 每个模块 = 一个里程碑（M1, M2...），每个里程碑 = 多个 Slice（S1.1, S1.2...）
- 每个 Slice 含：实现内容、验收标准、依赖说明
- 每个模块有独立目录，不允许跨模块编辑
- M0 定义模块间的接口契约

### 多级依赖

```
M0 依赖层 → 先完成
  │
  ├── M1（无依赖）      ← 立即开始
  ├── M2（无依赖）      ← 立即开始
  └── M3（依赖 M1）     ← M1 合并后开始
```

Tech Manager 监控依赖状态，M1 合并后通知 Workspace 3 开始 M3。

---

## GSD 配置层级

```
项目 PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
    （最高优先级）              （GSD 自动管理）                     （全局默认）
```

---

## 适用范围

| 项目类型 | M0 依赖层 | 并行拆分方式 |
|----------|----------|-------------|
| Web 前端 | 路由、共享组件、API client、状态骨架 | 按页面/功能模块 |
| Web 后端 | DB schema、中间件、公共工具 | 按 domain/service |
| 全栈 | monorepo、共享类型、API schema | 前后端分离或垂直切分 |
| 移动端 | 导航、设计系统、网络层 | 按功能模块 |
| 桌面端 | 窗口框架、IPC、共享状态 | 按功能模块 |
| CLI / 库 | 核心接口、配置系统 | 按子命令/模块 |
| 微服务 | proto/schema、CI 模板 | 天然按服务 |
| 数据工程 | pipeline 框架、共享连接器 | 按 pipeline 阶段 |
| 基础设施 | provider 配置、共享 module | 按资源组/环境 |

---

## 速查

```
1. 项目负责人 → PRD.md + 工作空间数量 N
2. 规划工作空间 → /gsd auto → 自动生成：
   • 技术选型
   • PREFERENCES.md（含 git worktree 配置）
   • milestones/ 目录（每个里程碑一个 context 文件）
   • 工作空间分配表
   • Git 初始化（main 保护 + feature 分支）
3. 项目负责人 → 确认
4. Workspace 1 → /gsd auto → 完成 M0 依赖层 → PR
5. Tech Manager WS → /gsd auto → 审查 → 合并 M0
6. Workspace 1~N → 各自 /gsd auto → 并行开发 → 各自 PR
7. Tech Manager → 审查 → 冲突解决 → 合并 → 验收报告
8. 项目负责人 → 确认 → 发布
```
