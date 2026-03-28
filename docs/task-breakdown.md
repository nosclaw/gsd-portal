# GSD Portal Task Breakdown

## 0. 文档信息
- 版本：v1.0
- 状态：Draft for Planning Review
- 输入文档：[PRD](../PRD.md)、[系统设计](./system-design.md)、[数据设计](./data-design.md)、[前端 UI 规范](./frontend-ui-spec.md)、[部署设计](./deployment-design.md)

## 1. 使用说明
本文件用于把需求和设计转成研发可执行 backlog。这里不做绝对工期承诺，只给出建议交付顺序、依赖关系和验收基线。

## 2. MVP 交付目标
MVP 完成后，应满足以下结果：
1. Root Admin 可以初始化系统并创建首个租户。
2. Tenant Admin 可以审批成员。
3. `APPROVED` 用户可以登录、启动自己的工作空间并进入 GSD。
4. GSD access token 可以通过 refresh token 无感续期。
5. 管理员能查看关键审计记录。
6. 平台支持单机 Docker Compose 官方部署。
7. Portal 前端使用 HeroUI，并在核心页面上对齐 `ui/design.png` 的设计方向。

## 3. 建议 Epic
| Epic ID | Epic | 目标 |
| --- | --- | --- |
| `EPIC-01` | Foundation | 建立项目基础设施、环境配置、日志和健康检查 |
| `EPIC-02` | Identity & Tenant | 完成 Root Admin、租户、用户、审批与登录 |
| `EPIC-03` | Workspace Runtime | 完成工作空间启动、停止、状态维护和空闲回收基础能力 |
| `EPIC-04` | GSD Session | 完成 GSD 会话桥接、refresh token 续期和重连机制 |
| `EPIC-05` | Admin & Audit | 完成后台管理页面和审计日志 |
| `EPIC-06` | Docker Compose Delivery | 完成官方部署方案、env 管理、卷挂载和健康检查 |
| `EPIC-07` | Portal Frontend UX | 使用 HeroUI 实现 Portal 前端界面，并对齐设计参考稿 |

## 4. MVP Backlog

### 4.1 `EPIC-01 Foundation`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-001` | 初始化 Next.js + TypeScript + Drizzle + HeroUI 基础工程结构 | 无 | 可本地启动，HeroUI Provider 与基础主题可用 |
| `MVP-002` | 建立统一环境变量加载与校验模块 | `MVP-001` | 缺少关键 env 时应用拒绝启动 |
| `MVP-003` | 建立统一日志模块与 request id 机制 | `MVP-001` | API、Orchestrator、Session Broker 日志具备统一上下文 |
| `MVP-004` | 实现 `/api/health/live` 与 `/api/health/ready` | `MVP-001` | Docker Compose 可直接依赖健康检查 |
| `MVP-004A` | 建立 HeroUI 主题、基础 design tokens 和通用布局容器 | `MVP-001` | 登录页、后台页、工作空间页可共享统一外观基础 |

### 4.2 `EPIC-02 Identity & Tenant`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-005` | 实现 Root Admin 初始化流程 | `MVP-002` | 系统首次部署后可安全创建 Root Admin，且不可重复抢占 |
| `MVP-006` | 实现 `tenants`、`users`、`invites` 表与 migration | `MVP-001` | 核心表可迁移成功 |
| `MVP-007` | 实现用户名密码登录与 Portal Session | `MVP-006` | `APPROVED` 用户可登录 |
| `MVP-008` | 实现注册、审批、拒绝、停用接口 | `MVP-006` | 不同状态下的权限与返回符合 PRD |
| `MVP-009` | 实现 Root Admin / Tenant Admin 权限守卫 | `MVP-007` | 越权访问被服务端拦截 |

### 4.3 `EPIC-03 Workspace Runtime`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-010` | 实现 `workspace_instances` 表与状态机 | `MVP-006` | 状态流转可持久化 |
| `MVP-011` | 实现端口分配器与唯一性校验 | `MVP-010` | 活跃工作空间端口不冲突 |
| `MVP-012` | 实现工作目录初始化与 `dev-env/setup.sh` 执行 | `MVP-010` | 首次启动可完成基础环境准备 |
| `MVP-013` | 实现 GSD 进程启动、停止、重启与健康检查 | `MVP-011`, `MVP-012` | 用户可控制工作空间生命周期 |
| `MVP-014` | 实现宿主机重启后的状态修正逻辑 | `MVP-013` | Portal 不会长期显示脏状态 |

### 4.4 `EPIC-04 GSD Session`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-015` | 实现 `workspace_sessions` 表与 token 加密存储 | `MVP-006` | refresh token 不以明文保存 |
| `MVP-016` | 实现 GSD 会话交换与初次连接 | `MVP-013`, `MVP-015` | 用户可从 Portal 进入 GSD |
| `MVP-017` | 实现 access token 提前续期与 refresh token 轮转支持 | `MVP-016` | 活跃用户不会因 token 自然过期而断线 |
| `MVP-018` | 实现续期失败重试与“重新连接”机制 | `MVP-017` | 会话失效时可重连，不必重建工作空间 |
| `MVP-019` | 实现用户停用/登出/停止工作空间时的会话撤销 | `MVP-017`, `MVP-008` | GSD Session 可被立即失效 |

### 4.5 `EPIC-05 Admin & Audit`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-020` | 实现 `audit_logs` 表与日志写入中间层 | `MVP-006`, `MVP-003` | 审计事件可统一落库 |
| `MVP-021` | 实现管理员用户列表与审批后台 | `MVP-008` | Tenant Admin 可完成基础审批操作 |
| `MVP-022` | 实现工作空间状态列表与基础日志视图 | `MVP-013`, `MVP-020` | 管理员能定位工作空间问题 |

### 4.6 `EPIC-06 Docker Compose Delivery`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-023` | 编写基础 Dockerfile 与应用启动脚本 | `MVP-001` | 应用可容器化运行 |
| `MVP-024` | 编写 `compose.base.yml` 与 `compose.local.yml` | `MVP-023`, `MVP-004` | 本地可通过 Compose 拉起 |
| `MVP-025` | 配置持久化卷、工作空间目录挂载与 SQLite 路径 | `MVP-024`, `MVP-013` | 重建容器后数据与工作目录保留 |
| `MVP-026` | 接入 `proxy` 服务并验证 WebSocket/反向代理链路 | `MVP-024`, `MVP-016` | 用户可从统一入口进入 Portal 和 GSD |
| `MVP-027` | 输出部署文档、初始化步骤与 smoke check | `MVP-024`, `MVP-026` | 非研发人员可按文档完成标准部署 |

### 4.7 `EPIC-07 Portal Frontend UX`
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `MVP-028` | 输出前端 UI 规范并确认 HeroUI 组件映射 | `MVP-004A` | 登录、工作空间、审批、审计列表都有明确组件选型 |
| `MVP-029` | 实现 Portal App Shell、导航和页面骨架 | `MVP-004A` | 核心页面具备统一布局、导航与主操作区 |
| `MVP-030` | 使用 HeroUI 实现登录/注册/审批结果页面 | `MVP-007`, `MVP-028` | 公共页面可直接交付评审，风格与设计参考稿一致 |
| `MVP-031` | 使用 HeroUI 实现工作空间控制台页面 | `MVP-013`, `MVP-016`, `MVP-029` | 启动、停止、重连、错误提示在单页内完成 |
| `MVP-032` | 使用 HeroUI 实现管理员后台列表与操作页 | `MVP-021`, `MVP-022`, `MVP-029` | 用户列表、审批、审计表格与状态标签具备统一视觉语言 |

## 5. V1 Backlog
| Story ID | 任务 | 依赖 | 验收标准 |
| --- | --- | --- | --- |
| `V1-001` | 实现空闲回收策略与后台配置化 | `MVP-013` | 默认 60 分钟空闲后自动停止 |
| `V1-002` | 实现多环境 Compose 配置 | `MVP-024` | `local/staging/production` 隔离明确 |
| `V1-003` | 增强部署健康检查与 smoke automation | `MVP-027` | 部署后能自动验证关键链路 |
| `V1-004` | 实现管理员强制停止与异常恢复工具 | `MVP-022` | 管理员可处理僵尸工作空间 |
| `V1-005` | 增加基础容量监控与指标看板 | `MVP-020` | 关键指标可视化或可导出 |
| `V1-006` | 增加备份/回滚脚本 | `MVP-027` | 升级失败可按文档回退 |

## 6. 建议实施顺序
1. 先完成 `EPIC-01` 与 `EPIC-02`，把身份和权限边界立住。
2. 再完成 `EPIC-03`，让工作空间能可靠启动与停止。
3. 接着完成 `EPIC-04`，解决 GSD 进入与长连接续期问题。
4. 然后完成 `EPIC-05`，补管理员控制面和审计闭环。
5. 再完成 `EPIC-07`，把关键用户路径真正做成可评审的 Portal UI。
6. 最后完成 `EPIC-06`，形成可交付的官方部署方式。

## 7. 测试基线
| 类型 | 覆盖点 |
| --- | --- |
| 单元测试 | 状态机、端口分配、权限守卫、续期策略 |
| 集成测试 | 注册审批、工作空间启动、会话刷新、停用用户 |
| 端到端测试 | 登录 -> 启动工作空间 -> 进入 GSD -> 续期 -> 登出；管理员审批与审计查看 |
| 部署验证 | Docker Compose 启动、健康检查、数据持久化、容器重启恢复 |

## 8. Definition of Done
1. 代码、migration、配置和文档同时提交。
2. 对应 Story 的验收标准可复现通过。
3. 审计日志、安全边界和错误提示没有被遗漏。
4. 涉及 Docker Compose 的改动必须同步更新部署文档。

## 9. 风险提醒
1. `MVP-017` 和 `MVP-018` 是高风险路径，必须尽早联调 GSD token 刷新机制。
2. `MVP-013` 与 `MVP-026` 依赖实际的 GSD 运行与反向代理链路，建议尽早打通最小闭环。
3. `MVP-024` 到 `MVP-027` 不应拖到最后一周，否则容易出现“功能完成但无法交付”的假完成状态。
4. `MVP-029` 到 `MVP-032` 如果没有尽早对齐 `ui/design.png`，后期容易出现“功能能用但界面返工”的问题。
