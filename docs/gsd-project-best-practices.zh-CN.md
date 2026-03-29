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

## 工作空间（Workspace）

一个工作空间是 GSD Portal 中完全隔离的开发环境：

```
┌─────────────────────────────────────┐
│           GSD Workspace (WS)         │
│                                     │
│  • /home/{username}/                │
│  • 独立 Provider API Key            │
│  • 独立 GSD Agent 实例              │
│                                     │
│  /gsd auto 后自主完成：              │
│  • 在 Git Worktree 中编码           │
│  • 运行测试 → commit → push → PR   │
│  • 根据 review 意见自动修复          │
└─────────────────────────────────────┘
```

---

## 角色

| 角色 | 数量 | 职责 |
|------|------|------|
| **项目负责人** | 1 人类 | 提供 PRD.md、确认规划输出、最终发布 |
| **规划 WS** | 1 | Phase 0：技术选型、生成配置、拆分任务、Git 初始化 |
| **Tech Manager WS** | 1 | PR 审查、冲突解决、合并到 main、验收 |
| **开发 WS 1~N** | N | 各自完成一个里程碑的全部实现 |

> 总共 N+1 个工作空间。规划 WS 可复用开发 WS1。

### 角色如何注入

GSD 原生 PREFERENCES.md 没有 `Role` 字段。正确做法：

**项目级 PREFERENCES.md**（所有 WS 共享，在 Git 仓库中）：
```yaml
mode: auto
always_use_skills:
  - standards
  - review
  - test
git:
  worktree: true
  branch_protection: main
  merge_method: pr_only
  auto_push: true
  auto_pr: true
custom_instructions:
  - 所有代码必须是真实业务逻辑，禁止 mock/stub
  - 遵循 ~/.gsd/standards/ 中的工程规范
```

**角色通过 Milestone Context 文件定义。** 每个 WS 读取自己对应的 context 文件，文件中包含该 WS 的角色、分支、任务列表。不需要额外的 Role 机制 — context 文件本身就是指令。

**Portal 编排器注入方式：** 启动 WS 时，Portal 将该 WS 对应的 context 文件路径写入工作空间级的 `~/.gsd/preferences.md`：

```yaml
custom_instructions:
  - 读取 milestones/m1-user-module-context.md，按其中的指令执行
```

Tech Manager WS 的工作空间级 preferences：
```yaml
custom_instructions:
  - 你是技术经理，不写业务代码
  - 持续监控所有开放的 PR
  - 审查代码质量后合并到 main
  - 对照 PRD.md 验收标准逐条检查
```

---

## 依赖协调机制

当 WS3 的 M3 依赖 WS1 的 M1 时，如何通知？

### 方案 1：Git 轮询（零依赖，立即可用）

**Git 本身就是通知机制。** WS3 启动 `/gsd auto` 后：

1. 检查 main 分支是否已包含 M1 的代码（`git log main --grep="M1"` 或检查特定文件）
2. 如果未合并 → 等待并定期轮询
3. M1 合并到 main 后 → WS3 检测到变化 → 拉取最新 main → 开始 M3

在 context 文件中声明：
```markdown
## 依赖
- 依赖 M1（feat/user-module）
- 启动前检查：main 分支是否包含 src/modules/user/ 目录
- 如果依赖未就绪，每 60 秒检查一次 main 分支
```

### 方案 2：GSD 扩展 — Agent Mailbox（需要开发）

GSD 的扩展系统支持自定义 tools、commands、event hooks。可以开发一个 `agent-mailbox` 扩展：

```
~/.gsd/agent/extensions/agent-mailbox/
├── extension-manifest.json
├── index.js
└── mailbox/                    # 共享消息目录
    ├── ws1-inbox.jsonl
    ├── ws2-inbox.jsonl
    └── ws3-inbox.jsonl
```

**扩展提供的 tools：**
- `mailbox_send(to, message)` — Tech Manager 发送 "M1_MERGED" 给 WS3
- `mailbox_check()` — Agent 检查自己的收件箱
- `mailbox_wait(condition)` — 阻塞等待特定消息

**扩展提供的 hooks：**
- `session_start` — 启动时检查收件箱
- `turn_end` — 每轮结束时检查新消息

**当前 GSD 官方仓库中没有发现相关的未合并 PR。** 这是一个全新的功能领域。

### 推荐

先用方案 1（Git 轮询），因为零依赖且符合 "Git 是唯一协作通道" 的原则。方案 2 作为未来优化。

---

## 自动化流程

```
            PRD.md + 工作空间数量 N
                    │
        ┌───────────▼───────────┐
        │  规划 WS               │
        │  /gsd auto            │
        │                       │
        │  • 技术选型            │
        │  • 生成 PREFERENCES.md │
        │  • 里程碑 + Slice 拆分 │
        │  • Milestone Context  │
        │  • Git 初始化          │
        │  • WS 分配表           │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │  项目负责人确认         │  ← 唯一的人工检查点
        └───────────┬───────────┘
                    │
  ┌─────────────────┼──────────────────┐
  ▼                                    ▼
┌──────────┐                 ┌──────────────────┐
│ WS1      │                 │ Tech Manager WS  │
│ /gsd auto│                 │ /gsd auto        │
│          │                 │                  │
│ M0 → PR  │──── PR ───────▶│ 审查 → 合并       │
└────┬─────┘                 │                  │
     │ M0 合并后              │                  │
┌────┼────┐                  │                  │
▼    ▼    ▼                  │                  │
WS1  WS2  WSN                │                  │
/gsd /gsd /gsd              │                  │
auto auto auto              │                  │
 │    │    │                  │                  │
 └PR──┴PR──┴──── PR ───────▶│ 审查 → 合并       │
                              │ 冲突解决           │
                              │ 验收报告           │
                              └──────────────────┘
```

---

## Phase 0：自动规划

普通的 `/gsd auto` 会话，不需要特殊 skill 或扩展。

### 产出 1：技术选型

| 优先级 | 原则 | 示例 |
|--------|------|------|
| 1 | **优先最新、最流行的技术** | bun > pnpm > yarn > npm |
| 2 | **选择性能更好的方案** | Bun runtime > Node.js |
| 3 | **选择开发体验更好的框架** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **选择类型安全的方案** | TypeScript > JavaScript |
| 5 | **PRD 有明确指定时，遵循 PRD** | PRD 要求 Python → 用 Python |

### 产出 2：PREFERENCES.md

写入项目根目录，所有 WS 共享。包含 skills、git workflow、custom_instructions。

### 产出 3：Milestone Context 文件

```
milestones/
├── m0-foundation-context.md
├── m1-user-module-context.md
├── m2-payment-module-context.md
├── m3-admin-module-context.md
└── tech-manager-context.md
```

每个 context 文件 = 该 WS 的完整工作指令：

```markdown
# M1 — 用户管理模块

## 分配
- 工作空间：WS1
- 分支：feat/user-module

## 目标
从 PRD.md 提取的本模块需求摘要。

## 依赖
- 依赖 M0（feat/foundation）— 必须已合并到 main
- 启动前检查：main 分支包含 src/shared/ 目录

## Slice 列表

### S1.1 用户注册 / 登录 API
- 实现：POST /api/auth/register, POST /api/auth/login
- 验收标准：
  - 注册返回 201 + 用户 ID
  - 密码 bcrypt 哈希
  - 登录返回 JWT token
- 依赖：M0 认证中间件 + 用户类型定义

### S1.2 用户列表页 + 搜索过滤
- 实现：GET /api/users (分页), 前端列表页
- 验收标准：
  - 支持按用户名、邮箱搜索
  - 响应：{ data: [], total, page, perPage }
- 依赖：M0 共享表格组件 + API client

### S1.3 用户详情编辑 + 权限控制
- 实现：PUT /api/users/:id, 前端编辑表单
- 验收标准：
  - 只有 ADMIN 可编辑其他用户
  - 返回 200 + 更新后的用户
- 依赖：M0 权限工具

### S1.4 测试
- 验收标准：API 路由 100% 覆盖 + 权限边界测试

## 模块边界
- 只修改 src/modules/user/ 目录
- 使用 M0 共享类型和组件，不修改它们

## 工作方式
- 在 feat/user-module 分支的 worktree 中工作
- 每个 Slice 完成后 commit + push
- 所有 Slice 完成后创建 PR 到 main
- 收到 Tech Manager 的修改意见后自动修复
```

**Tech Manager 的 context 文件：**

```markdown
# Tech Manager

## 角色
技术经理，不写业务代码。

## 职责
- 持续监控所有开放的 PR
- 审查代码质量、安全性、规范符合度
- 解决合并冲突，保留双方意图
- 合并到受保护的 main 分支
- 按依赖顺序合并（M0 → M1/M2 → 依赖 M1 的 M3）
- 对照 PRD.md 验收标准逐条检查
- 所有模块合并后输出验收报告

## 合并优先级
1. M0（依赖层）— 最高优先级
2. 无依赖的并行模块（M1, M2）— 按 PR 提交顺序
3. 有依赖的模块（M3 依赖 M1）— 确认上游已合并后再合并
```

### 产出 4：WS 分配表

```
=== WS 分配表 ===

Tech Manager WS → milestones/tech-manager-context.md
  职责：PR 审查、冲突解决、合并、验收

───────────────────────────────────────
  依赖层（必须先完成）
───────────────────────────────────────

  WS1 → M0 项目基础层
    分支: feat/foundation
    Context: milestones/m0-foundation-context.md
    Slice: S0.1~S0.5

───────────────────────────────────────
  并行层（M0 合并后全部启动）
───────────────────────────────────────

  WS1 → M1 用户管理
    分支: feat/user-module
    Context: milestones/m1-user-module-context.md
    Slice: S1.1~S1.4

  WS2 → M2 支付模块
    分支: feat/payment-module
    Context: milestones/m2-payment-module-context.md
    Slice: S2.1~S2.4

  WS3 → M3 管理后台（依赖 M1）
    分支: feat/admin-module
    Context: milestones/m3-admin-module-context.md
    Slice: S3.1~S3.4
    注意：M1 合并后才开始
```

### 产出 5：Git 初始化

main 分支保护 + 创建 feature 分支。

---

## 依赖感知拆分

```
            ┌─────────────┐
            │  M0 依赖层   │  ← 必须先完成
            │  WS1         │
            └──────┬──────┘
                   │ PR → Tech Manager 合并
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 用户  │ │ M2 支付  │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ M1 合并后               │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 管理  │  ← 等 M1 合并后开始
                         │ WS3      │
                         └──────────┘
```

**拆分规则：**
- 被多个模块依赖的代码 → M0（类型、schema、基础组件、中间件）
- 并行模块数 = WS 数量 N
- 每个模块 = 里程碑（M1, M2...） = 多个 Slice（S1.1, S1.2...）
- 每个 Slice 含：实现内容、验收标准、依赖
- 每个模块独立目录，不允许跨模块编辑

**依赖检测方式（Git 轮询）：**
- WS3 启动后检查 main 是否包含 M1 代码
- 未就绪 → 每 60 秒 `git fetch && git log main` 检查
- M1 合并 → 拉取 main → 开始 M3

---

## GSD 配置层级

```
项目 PREFERENCES.md（Git 仓库，所有 WS 共享）
  > ~/.gsd/preferences.md（WS 级，Portal 编排器注入 context 路径）
    > ~/.gsd/projects/{hash}/preferences.md（GSD 自动管理）
```

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
2. 规划 WS → /gsd auto → 自动生成：
   • 技术选型
   • PREFERENCES.md
   • milestones/ 目录（含每个里程碑 + Tech Manager 的 context 文件）
   • WS 分配表
   • Git 初始化
3. 项目负责人 → 确认
4. Portal 编排器 → 为每个 WS 注入对应的 context 路径
5. WS1 → /gsd auto → M0 依赖层 → PR
6. Tech Manager WS → /gsd auto → 审查 → 合并 M0
7. WS1~N → 各自 /gsd auto → 并行开发（有依赖的 WS 自动轮询等待）→ PR
8. Tech Manager → 审查 → 冲突解决 → 合并 → 验收报告
9. 项目负责人 → 确认 → 发布
```
