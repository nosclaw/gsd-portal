# GSD 团队自动化开发最佳实践

基于 PRD 文档，使用多人类开发者 + 多 GSD AI Agent 团队实现全自动化并行开发的完整实践指南。

适用于所有编程语言和项目类型。

---

## 1. 核心理念

```
目标：人类只需执行 /gsd auto，AI Agent 团队全自动完成开发、提交、协作、合并。
```

| 原则 | 说明 |
|------|------|
| **PRD 是唯一人工输入** | 技术选型、PREFERENCES.md、里程碑拆解全部由 GSD 自动生成 |
| **Git 是唯一协作通道** | 所有协作通过 commit → push → PR → review → merge 完成 |
| **main 分支受保护** | 只能通过 PR 合并，不允许直接 push |
| **Git Worktree 并行隔离** | 每个开发者在独立 worktree 中工作，零冲突 |
| **依赖前置，并行最大化** | 有依赖的模块先完成，独立模块全部并行 |
| **Tech Manager 负责集成** | 一个专职 GSD AI Agent 负责 PR 审查、冲突解决、合并、验收 |

---

## 2. 团队角色模型

```
┌─────────────────────────────────────────────────────────────┐
│                    项目负责人（人类）                          │
│  - 提供 PRD.md                                               │
│  - 告知开发者人数 N                                           │
│  - 审核 Phase 0 输出（技术选型 + 里程碑）                      │
│  - 最终发布决策                                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                                   ▼
┌───────────────┐                  ┌──────────────────────────┐
│ Tech Manager  │                  │    开发者 × N             │
│ (GSD AI Agent)│                  │    (人类 + GSD AI Agent)  │
│               │                  │                          │
│ 职责：         │                  │  每人一台电脑              │
│ • PR Review   │◄── PR ──────────│  执行 /gsd auto           │
│ • 冲突解决     │                  │  全自动开发               │
│ • 合并到 main  │                  │  自动 commit + push       │
│ • 验收审查     │                  │  自动创建 PR              │
│ • CI 状态监控  │                  │                          │
│ • 依赖协调     │                  │                          │
└───────────────┘                  └──────────────────────────┘
```

### Tech Manager（技术经理）

这是一个专职的 GSD AI Agent，**不负责写业务代码**，只负责集成和协调：

| 职责 | 具体操作 |
|------|----------|
| **PR Review** | 审查每个开发者提交的 PR，检查代码质量、规范符合度 |
| **冲突解决** | 当多个 PR 存在合并冲突时，负责解决 |
| **合并到 main** | 审查通过后将 PR 合并到受保护的 main 分支 |
| **验收审查** | 对照 PRD.md 验收标准逐条检查 |
| **依赖协调** | 监控依赖模块的完成状态，通知下游开发者可以开始 |
| **CI 监控** | 检查 CI/CD 状态，修复集成问题 |
| **发布准备** | 所有 PR 合并后，执行最终集成测试和发布准备 |

Tech Manager 的 PREFERENCES.md 配置：

```markdown
## Role
你是技术经理（Tech Manager），负责代码集成和团队协调。
你不写业务代码，只负责：PR 审查、冲突解决、合并、验收。

## always_use_skills
- review
- standards
- github

## custom_instructions
- 持续监控所有开放的 PR
- 审查代码质量、安全性、规范符合度
- 解决合并冲突时保留两方的意图
- 合并前确保 CI 通过
- 对照 PRD.md 验收标准逐条检查
- 发现问题时在 PR 中评论，要求修改
```

---

## 3. GSD 配置层级

GSD 使用三层配置体系：

### 第一层：全局配置（`~/.gsd/`）

```
~/.gsd/
├── preferences.md              # 全局偏好（模式、模型、默认 skills）
├── standards/                  # 工程规范
├── agent/
│   ├── auth.json               # API 密钥
│   ├── settings.json           # Provider、模型、思考深度
│   └── skills/                 # 已安装的 skills
└── projects/                   # 每个项目的状态（GSD 自动管理）
    └── {HASH_ID}/
        ├── gsd.db              # 项目状态数据库
        ├── PROJECT.md          # 项目摘要
        ├── STATE.md            # 当前状态
        ├── DECISIONS.md        # 技术决策
        ├── KNOWLEDGE.md        # 项目知识
        ├── preferences.md      # 项目级偏好
        ├── milestones/         # 里程碑
        │   └── M001/
        │       ├── CONTEXT.md
        │       └── DECISIONS.md
        └── activity/           # 会话日志
```

### 第二层：工作空间（Portal 模式下 GSD 自动创建）

```
/home/{username}/.gsd/
├── web-preferences.json
└── agent/
    ├── auth.json
    └── settings.json
```

### 第三层：项目配置（项目根目录 — 最高优先级）

```
project/
├── PRD.md                      # 唯一的人工输入
├── PREFERENCES.md              # GSD Phase 0 自动生成
└── src/                        # 源代码
```

### 配置优先级

```
项目 PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
```

---

## 4. 完整工作流

### Phase 0：自动化规划（单 Agent）

项目负责人提供 PRD.md 和开发者人数，GSD 自动完成所有规划：

```
读取 PRD.md，执行 Phase 0 初始化。

开发者人数：3（不含 Tech Manager）

1. 分析需求，输出技术选型方案（语言、框架、数据库、部署方式），说明选型理由
2. 基于选型结果，自动生成 PREFERENCES.md（skills 配置、项目约束等）
3. 根据 3 名开发者的并行能力，将需求拆分为可并行的独立模块：
   - 识别模块间依赖关系
   - 有依赖的模块标记为 Phase 2a（先完成）和 Phase 2b（依赖就绪后开始）
   - 无依赖的模块全部安排为并行
   - 每个模块分配给一个开发者
4. 输出任务分配表：开发者编号 → 模块 → 分支名 → 任务列表
5. 初始化 Git 仓库：
   - 创建 main 分支保护规则
   - 为每个开发者创建 feature 分支

约束：
- 所有代码必须是真实业务逻辑，禁止 mock/stub
- 遵循 ~/.gsd/standards/ 中的工程规范
- 并行任务数量 = 开发者人数，最大化并行度
```

**Phase 0 自动输出示例：**

```
=== 任务分配表 ===

依赖层（Phase 2a — 必须先完成）：
  开发者 1 → 共享基础层
    分支: feat/foundation
    任务: 项目初始化、共享类型、数据库 schema、基础组件

并行层（Phase 2b — 依赖层完成后全部并行）：
  开发者 1 → 用户模块
    分支: feat/user-module
    任务: 注册/登录、用户管理、权限控制

  开发者 2 → 支付模块
    分支: feat/payment-module
    任务: 订单创建、支付集成、账单管理

  开发者 3 → 管理后台
    分支: feat/admin-module
    任务: 数据报表、系统设置、审计日志
```

### Phase 1：骨架搭建 + 依赖层（单 Agent）

由一个开发者执行 `/gsd auto`，完成项目骨架和共享依赖层：

```
读取 PRD.md 和 PREFERENCES.md。
你是开发者 1，负责 Phase 1 + Phase 2a（依赖层）。

1. 初始化项目（按技术选型）
2. 配置 lint、类型检查、git hooks、CI
3. 创建共享类型定义和基础组件
4. 创建数据库 schema 和 migration
5. 完成所有被其他模块依赖的基础代码

工作方式：
- 在 feat/foundation 分支上工作
- 每个任务完成后 commit + push
- 全部完成后创建 PR
- 等待 Tech Manager 合并到 main 后通知其他开发者开始
```

### Phase 2：并行开发（多 Agent，Git Worktree）

依赖层合并到 main 后，所有开发者**同时开始**各自的模块：

**每个开发者的电脑上：**

```bash
# 克隆项目（如果还没有）
git clone <repo-url>
cd project

# 使用 Git Worktree 创建独立工作目录
git worktree add ../project-feat-user-module feat/user-module

# 进入 worktree 目录
cd ../project-feat-user-module

# 启动 GSD 全自动模式
gsd auto
```

**每个 GSD Agent 收到的指令（由 PREFERENCES.md + 里程碑自动决定）：**

```
读取 PRD.md 和 PREFERENCES.md。
你是开发者 2，负责支付模块（feat/payment-module）。

任务列表：
1. 订单创建 API 和页面
2. 支付网关集成
3. 账单管理

工作方式：
- 在 feat/payment-module 分支上工作
- 每个任务完成后 commit + push
- 跑通所有相关测试
- 全部完成后创建 PR 到 main
- PR 由 Tech Manager 审查和合并
```

### Phase 3：Tech Manager 集成

Tech Manager Agent 持续运行，负责所有集成工作：

```
你是 Tech Manager。持续执行以下工作循环：

1. 检查所有开放的 PR
2. 对每个 PR 执行：
   a. /review — 代码质量审查
   b. 检查 CI 状态
   c. 对照 PRD.md 验收标准逐条检查
   d. 如有问题，在 PR 中评论要求修改
   e. 如无问题，合并到 main
3. 如果合并产生冲突：
   a. 分析冲突原因
   b. 解决冲突，保留双方意图
   c. 提交合并结果
4. 所有模块合并完成后：
   a. 运行完整测试套件
   b. 对照 PRD.md 所有验收标准最终确认
   c. 输出验收报告
```

---

## 5. Git 工作流

### 分支策略

```
main (受保护)
  │
  ├── feat/foundation          ← 开发者 1（Phase 2a，依赖层）
  │
  ├── feat/user-module         ← 开发者 1（Phase 2b，并行）
  ├── feat/payment-module      ← 开发者 2（Phase 2b，并行）
  └── feat/admin-module        ← 开发者 3（Phase 2b，并行）
```

### Main 分支保护规则

- 禁止直接 push 到 main
- 合并必须通过 PR
- PR 必须经过 Tech Manager 审查
- CI 必须通过
- 不允许 force push

### Git Worktree 并行开发

每个开发者使用 Git Worktree 在独立目录中工作，避免分支切换带来的文件冲突：

```bash
# 项目根目录结构
~/projects/
├── my-project/                    # 主仓库（main 分支）
├── my-project-feat-user/          # Worktree（feat/user-module）
├── my-project-feat-payment/       # Worktree（feat/payment-module）
└── my-project-feat-admin/         # Worktree（feat/admin-module）
```

```bash
# 创建 worktree
git worktree add ../my-project-feat-user feat/user-module

# 完成后清理 worktree
git worktree remove ../my-project-feat-user
```

### Agent 自动 Git 操作

每个 GSD Agent 在 `/gsd auto` 模式下自动执行：

```
1. 在分配的分支上工作
2. 每完成一个功能点 → git add + commit（清晰的 commit message）
3. 定期 push 到远端
4. 所有任务完成 → 创建 PR 到 main
5. 如果 Tech Manager 在 PR 中留了修改意见 → 自动修复并更新 PR
```

---

## 6. 依赖感知的任务拆分

### 拆分原则

```
                    ┌──────────────┐
                    │  Phase 2a    │
                    │  依赖层       │    ← 必须先完成
                    │  (1 个开发者)  │
                    └──────┬───────┘
                           │ 合并到 main
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Phase 2b │    │ Phase 2b │    │ Phase 2b │
    │ 模块 A   │    │ 模块 B   │    │ 模块 C   │    ← 全部并行
    │ 开发者 1  │    │ 开发者 2  │    │ 开发者 3  │
    └──────────┘    └──────────┘    └──────────┘
```

### 拆分规则

1. **识别共享依赖** — 被多个模块依赖的代码（类型定义、数据库 schema、基础组件、工具函数）归入依赖层
2. **依赖层先行** — 依赖层由一个开发者优先完成并合并到 main
3. **并行任务数 = 开发者人数** — 将独立模块拆分为恰好等于开发者人数的并行任务
4. **模块边界清晰** — 每个模块有独立的目录、路由、API，不与其他模块的代码交叉
5. **接口契约先定** — 依赖层定义好模块间的接口（类型、API schema），各模块按契约实现

### 不同项目类型的拆分示例

**Web 应用（React / Vue / Angular / Svelte）：**
```
依赖层: 项目初始化、路由配置、共享组件、API client、状态管理骨架
并行层: 按页面/功能模块拆分（用户、订单、设置、报表...）
```

**后端服务（Node.js / Python / Go / Rust / Java）：**
```
依赖层: 项目初始化、数据库 schema、中间件、公共工具
并行层: 按 domain/service 拆分（auth、billing、notification、analytics...）
```

**移动应用（React Native / Flutter / Swift / Kotlin）：**
```
依赖层: 项目初始化、导航结构、设计系统、网络层
并行层: 按功能模块拆分（首页、个人中心、消息、搜索...）
```

**全栈项目：**
```
依赖层: monorepo 初始化、共享类型、数据库、API schema 定义
并行层: 前端 + 后端 + 基础设施 各自并行（或按功能垂直切分）
```

**CLI 工具 / 库：**
```
依赖层: 项目初始化、核心接口定义、配置系统
并行层: 按子命令/模块拆分
```

---

## 7. 全自动执行流程

### 端到端流程

```
1. 项目负责人 → 提供 PRD.md + 开发者人数 N
2. GSD Phase 0 → 技术选型 + PREFERENCES.md + 里程碑拆分 + 任务分配表
3. 项目负责人 → 审核确认
4. 开发者 1   → /gsd auto → 完成依赖层 → 创建 PR
5. Tech Manager → 审查 PR → 合并到 main
6. 开发者 1~N → 各自 git worktree → /gsd auto → 并行开发 → 各自创建 PR
7. Tech Manager → 逐个审查 PR → 解决冲突 → 合并 → 验收
8. 项目负责人 → 最终确认 → 发布
```

### 每个开发者的操作（只需 3 步）

```bash
# 1. 克隆项目
git clone <repo-url> && cd project

# 2. 创建 worktree（分支名从任务分配表获取）
git worktree add ../project-my-module feat/my-module

# 3. 启动全自动开发
cd ../project-my-module && gsd auto
```

之后完全由 GSD Agent 自动完成：编码 → 测试 → commit → push → 创建 PR。

---

## 8. 适用范围

本最佳实践适用于所有项目类型和编程语言：

| 类型 | 语言 / 框架 | 拆分方式 |
|------|-------------|----------|
| Web 前端 | React, Vue, Angular, Svelte, Next.js, Nuxt | 按页面/功能模块 |
| Web 后端 | Node.js, Python, Go, Rust, Java, C# | 按 domain/service |
| 全栈 | 任意前后端组合 | 按功能垂直切分或前后端分离 |
| 移动端 | React Native, Flutter, Swift, Kotlin | 按功能模块 |
| 桌面端 | Electron, Tauri, Qt | 按功能模块 |
| CLI / 库 | 任意语言 | 按子命令/模块 |
| 微服务 | 任意语言 | 天然按服务拆分 |
| 数据工程 | Python, Scala, SQL | 按 pipeline/ETL 阶段 |
| 基础设施 | Terraform, Pulumi, Docker | 按资源组/环境 |

核心原则不变：**依赖前置 → 并行最大化 → Git 协作 → Tech Manager 集成**。

---

## 9. 速查卡片

```
┌─────────────────────────────────────────────────────────┐
│                    GSD 团队自动化开发                      │
│                                                          │
│  输入: PRD.md + 开发者人数 N                              │
│                                                          │
│  Phase 0: GSD 自动 → 选型 + PREFERENCES.md + 任务分配     │
│  Phase 1: 开发者 1 → /gsd auto → 依赖层 → PR              │
│  集成:    Tech Manager → 审查 → 合并到 main               │
│  Phase 2: 开发者 1~N → git worktree → /gsd auto → PR     │
│  集成:    Tech Manager → 审查 → 冲突解决 → 合并 → 验收     │
│  发布:    项目负责人 → 最终确认 → 上线                      │
│                                                          │
│  每个开发者只需:                                           │
│    git clone → git worktree add → gsd auto               │
│                                                          │
│  所有协作通过 Git (commit → push → PR → merge)            │
└─────────────────────────────────────────────────────────┘
```
