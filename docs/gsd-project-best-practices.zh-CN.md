# GSD 新项目最佳实践：从 PRD 到团队交付

基于 PRD 文档，使用多人类开发者 + 多 GSD Agent 团队协作完成项目的完整实践指南。

---

## 1. GSD 配置层级体系

GSD 使用**三层配置体系**，理解这个体系是开始任何项目的前提。

### 第一层：全局配置（`~/.gsd/`）— 系统级默认值

```
~/.gsd/
├── preferences.md              # 全局偏好（模式、模型、默认 skills）
├── web-preferences.json        # Web UI 根目录锁定
├── defaults.json               # 系统默认值
├── port-registry.json          # 全局端口分配（>= 50000）
├── standards/                  # 工程规范（STANDARDS.md 等）
│
├── agent/                      # Agent 运行时配置
│   ├── auth.json               # API 密钥（OpenRouter、GitHub 等）
│   ├── settings.json           # Provider、模型、思考深度
│   ├── extensions/             # Agent 扩展
│   └── skills/                 # 已安装的 skills（从 skillshare 软链接）
│
└── projects/                   # 每个项目的状态（GSD 自动管理）
    └── {HASH_ID}/
        ├── gsd.db              # SQLite 数据库（项目状态）
        ├── PROJECT.md          # 项目摘要（自动生成）
        ├── STATE.md            # 当前状态（自动生成）
        ├── DECISIONS.md        # 技术决策日志
        ├── KNOWLEDGE.md        # 累积的项目知识
        ├── CONTEXT.md          # 自动生成的上下文
        ├── REQUIREMENTS.md     # 需求追踪
        ├── preferences.md      # 项目级 GSD 偏好
        ├── metrics.json        # 项目指标 & skill 遥测
        ├── milestones/         # 里程碑目录
        │   └── M001/
        │       ├── CONTEXT.md  # 里程碑上下文
        │       └── DECISIONS.md
        ├── activity/           # 会话活动日志（JSONL）
        ├── journal/            # 每日日志
        └── runtime/            # 运行时状态
```

### 第二层：工作空间（工作空间内的 `~/.gsd/`）— 用户级覆盖

当 GSD Portal 启动工作空间时，编排器会创建：

```
/home/{username}/.gsd/
├── web-preferences.json        # 锁定 devRoot 到此工作空间
└── agent/
    ├── auth.json               # 用户的 API 密钥（三层优先级：用户 > 管理员 > 默认）
    └── settings.json           # 用户的 agent 设置
```

### 第三层：项目配置（项目根目录）— 项目级行为

```
project/
├── PRD.md                      # 产品需求文档（你提供的唯一输入）
├── PREFERENCES.md              # 项目级 GSD 行为配置（由 GSD 自动生成）
├── CLAUDE.md                   # 项目级 Claude 指令（可选）
└── src/                        # 源代码
```

> **注意：** `MILESTONES.md`、`CONTEXT.md`、`DECISIONS.md`、`STATE.md` 等文件由 GSD 自动生成
> 到 `~/.gsd/projects/{HASH}/` 中 — 它们存在于 GSD 的内部状态里，不在你的项目仓库中。
> GSD 会在跨会话工作时自动读取和更新这些文件。

### 配置优先级

```
项目 PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
    （最高优先级）              （项目状态）                           （全局默认）
```

---

## 2. 正确的启动流程

### 核心原则：PRD 是唯一人工输入，其余全部由 GSD 自动化生成

```
人工准备          GSD Phase 0            人工审核           GSD Phase 1+
──────────       ──────────────         ──────────         ──────────────
PRD.md     →     技术选型               确认/调整      →   按里程碑实现
                 PREFERENCES.md 生成     团队分工安排        多 Agent 并行
                 里程碑拆解
```

### Step 1：人工准备 — 只需提供 PRD.md

在空项目目录中放入 `PRD.md`，这是你需要提供的**唯一文件**。不需要手动创建 `PREFERENCES.md`、`.gsd/` 或任何配置文件。

### Step 2：启动 GSD — Phase 0 自动化

打开 GSD，发送以下启动指令：

```
读取 PRD.md，执行 Phase 0 初始化：

1. 分析需求，输出技术选型方案（框架、数据库、部署方式），说明选型理由
2. 基于选型结果，自动生成 PREFERENCES.md，包含：
   - Role 定义
   - always_use_skills（必须使用的 skills）
   - prefer_skills（优先使用的 skills）
   - skill_rules（条件触发规则）
   - custom_instructions（项目约束）
3. 将需求拆分为 3-5 个里程碑（M1-M5），每个里程碑可独立验收
4. 每个里程碑标注：任务清单、预估复杂度、可并行的任务、依赖关系

约束：
- 所有代码必须是真实业务逻辑，禁止 mock/stub
- 遵循 ~/.gsd/standards/ 中的工程规范
```

GSD 会自动完成：
- 读取 PRD → 分析需求 → 确定技术栈
- 根据技术栈选择合适的 skills（例如选了 React 就加 `react-best-practices`）
- 生成 `PREFERENCES.md` 到项目根目录
- 在 `~/.gsd/projects/{hash}/milestones/` 中创建里程碑结构

### Step 3：人工审核

技术选型和里程碑拆解完成后，**人工审核并确认**：
- 技术选型是否合理
- PREFERENCES.md 中的 skills 配置是否需要调整
- 里程碑划分是否合理，是否需要合并或拆分
- 哪些里程碑可以并行，哪些有依赖关系

审核通过后进入实现阶段。

---

## 3. 多人 + 多 Agent 团队协作模型

实际项目由**多个人类开发者**和**多个 GSD Agent 工作空间**共同完成。

### 角色分工

```
┌─────────────────────────────────────────────────────┐
│                   项目负责人（人类）                    │
│  - 提供 PRD.md                                       │
│  - 审核技术选型 & 里程碑                               │
│  - 分配任务到团队成员                                  │
│  - Code Review & 合并决策                             │
└──────────────────────┬──────────────────────────────┘
                       │ 分配里程碑 / 模块
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ 开发者 A  │ │ 开发者 B  │ │ 开发者 C  │
   │ (人类)    │ │ (人类)    │ │ (人类)    │
   │          │ │          │ │          │
   │ GSD      │ │ GSD      │ │ GSD      │
   │ Agent A  │ │ Agent B  │ │ Agent C  │
   └──────────┘ └──────────┘ └──────────┘
       M1            M2           M3
    用户模块       支付模块      管理后台
```

### 协作原则

| 原则 | 说明 |
|------|------|
| **按里程碑 / 模块分工** | 每个开发者 + GSD Agent 负责一个独立里程碑或功能模块 |
| **共享同一份 PREFERENCES.md** | 所有 Agent 使用相同的项目配置，确保代码风格和规范一致 |
| **共享同一份 PRD.md** | 每个 Agent 都能读到完整需求上下文，避免实现偏差 |
| **Git 分支隔离** | 每个开发者在自己的分支上工作，通过 PR 合并到主干 |
| **人类负责集成** | 模块间的接口对接、冲突解决、最终合并由人类决策 |

### 任务分配指令模板

项目负责人确认里程碑后，给每个开发者分配任务：

**给开发者 A（负责 M1）：**
```
在 GSD 中打开项目，发送：

读取 PRD.md 和 PREFERENCES.md。
你负责实现 M1（用户模块）。

M1 包含以下任务：
1. 用户注册 / 登录 API
2. 用户列表页面
3. 用户详情编辑

创建分支 feat/m1-user-module，逐个任务实现。
每个任务完成后 commit。全部完成后创建 PR。

约束：
- 遵循 PREFERENCES.md 中的所有规则
- 与其他模块的接口按 PRD 中定义的数据结构实现
- 不要修改其他模块的代码
```

### 并行开发的关键文件

当多个 Agent 并行工作时，需要提前约定共享契约：

```
project/
├── PRD.md                # 所有 Agent 共读的需求文档
├── PREFERENCES.md        # 所有 Agent 共用的行为配置
├── src/
│   ├── lib/types.ts      # 共享类型定义（优先由 Phase 0 生成骨架）
│   ├── lib/api-client.ts # 共享 API 客户端接口
│   └── ...
```

> **提示：** Phase 1 骨架搭建阶段应由**一个 Agent 完成**，生成项目基础结构和共享类型定义后，
> 再分配给多个 Agent 并行实现各自的里程碑。

---

## 4. 分阶段执行流程

```
Phase 0              Phase 1             Phase 2              Phase 3
自动化规划            骨架搭建（单 Agent） 并行实现（多 Agent）   集成收尾
────────────         ────────────        ────────────         ────────────
PRD → 技术选型        项目脚手架          各里程碑并行开发       PR Review
→ PREFERENCES.md     路由 / 页面结构     每人负责一个模块       集成测试
→ 里程碑拆解          共享类型定义        独立分支              部署配置
                     基础组件            持续 commit           合并发布
```

### Phase 0：自动化规划（见 Step 2）

由 GSD 自动完成技术选型、生成 PREFERENCES.md、拆解里程碑。

### Phase 1：骨架搭建（单个 Agent）

**由一个开发者 + 一个 GSD Agent 完成**，生成所有 Agent 共享的基础结构：

```
读取 PRD.md 和 PREFERENCES.md，实现 Phase 1 骨架搭建：

1. 初始化项目（按技术选型）
2. 搭建目录结构
3. 配置 lint、TypeScript、git hooks
4. 创建共享类型定义（lib/types.ts）
5. 创建基础路由和页面壳
6. 创建共享组件骨架

完成后 commit 到 main 分支，这将作为所有开发者的起点。
```

### Phase 2：并行实现（多 Agent）

骨架就绪后，**多个开发者同时在各自的 GSD 工作空间中并行工作**：

- 每人从 main 拉取最新代码
- 创建自己的 feature 分支
- GSD Agent 读取 PRD.md + PREFERENCES.md，实现分配的里程碑
- 完成后创建 PR

### Phase 3：集成收尾

```
所有里程碑的 PR 已提交。执行集成：

1. /review — 逐个审查每个 PR
2. 解决 PR 之间的冲突
3. 合并到 main
4. /test — 运行完整测试套件
5. 对照 PRD.md 验收标准逐条检查
6. 部署配置
```

---

## 5. GSD 会话管理

### 新会话恢复上下文

GSD 会自动在 `~/.gsd/projects/{hash}/` 中维护项目状态（STATE.md、DECISIONS.md 等），
新会话开始时 GSD 能自动恢复上下文。但建议明确告知当前进度：

```
读取 PRD.md 和 PREFERENCES.md。

当前进度：M2 已完成，继续 M3。
上次完成到 [具体任务]，请从 [下一个任务] 开始。
```

### 里程碑完成时的质量检查

每个里程碑完成后，由负责的开发者在 GSD 中执行：

```
M[N] 实现完成。执行质量检查：

1. /review — 审查本里程碑所有变更
2. /test — 为新代码生成测试并运行
3. 对照 PRD.md 中 M[N] 的验收标准逐条确认
4. 列出所有偏差或待解决项
```

### 跨 Agent 同步

当多个 Agent 并行工作时，定期同步避免冲突：

```
拉取 main 分支最新代码到当前分支，解决可能的冲突。
检查 lib/types.ts 等共享文件是否有其他成员的更新，确保兼容。
```

---

## 6. 关键原则

| 原则 | 具体做法 |
|------|----------|
| **PRD 是唯一人工输入** | PREFERENCES.md、里程碑、技术选型全部由 GSD 自动生成 |
| **先规划后编码** | Phase 0 完成并经人工确认后才开始实现 |
| **骨架先行** | Phase 1 由单 Agent 完成共享基础结构，再分配并行任务 |
| **里程碑驱动** | 按 M1 → M2 → M3 推进，不要跨里程碑混合开发 |
| **分支隔离** | 每个开发者/Agent 在独立分支上工作 |
| **人类决策集成** | 模块间接口、冲突解决、PR 合并由人类负责 |
| **共享契约** | 所有 Agent 共用 PRD.md + PREFERENCES.md，确保一致性 |
| **复用 Skills** | 充分利用已安装的 skills，不重复造轮子 |
| **禁止 Mock** | 所有代码都是真实业务逻辑 |
| **小步提交** | 一个功能一个 commit，方便 review 和回滚 |

---

## 7. 完整流程速查

```
1. 人工：放入 PRD.md → 启动 GSD
2. GSD：读取 PRD → 技术选型 → 生成 PREFERENCES.md → 拆解里程碑
3. 人工：审核技术选型 + 里程碑 → 分配团队任务
4. Agent（单）：Phase 1 骨架搭建 → commit 到 main
5. Agent（多）：各自拉取 main → 创建 feature 分支 → 并行实现里程碑
6. 人工：Review PR → 解决冲突 → 合并 → 集成测试 → 发布
```
