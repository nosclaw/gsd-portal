# GSD Portal Docs

## 文档索引

本目录用于把 [PRD](../PRD.md) 向下拆解为可执行的研发文档，避免产品需求、系统设计、部署方案和任务排期混在一个文件中。

### 建议阅读顺序
1. [PRD](../PRD.md)
2. [系统设计](./system-design.md)
3. [数据设计](./data-design.md)
4. [前端 UI 规范](./frontend-ui-spec.md)
5. [部署设计](./deployment-design.md)
6. [研发任务拆解](./task-breakdown.md)

### 文档说明
- [PRD](../PRD.md)：定义问题、目标、范围、需求、指标和版本边界。
- [系统设计](./system-design.md)：定义模块边界、运行时架构、会话续期、编排流程和 API 面。
- [数据设计](./data-design.md)：定义核心实体、表结构、状态机、索引和数据保留策略。
- [前端 UI 规范](./frontend-ui-spec.md)：定义 HeroUI 使用方式、设计稿参考边界、页面结构与组件映射。
- [部署设计](./deployment-design.md)：定义 Docker Compose 自托管方式、多环境配置、持久化、健康检查与升级回滚。
- [研发任务拆解](./task-breakdown.md)：将 MVP/V1 拆成 Epic、Story、依赖、交付物和验收标准。

### 使用方式
- 产品评审：先看 `PRD.md`
- 技术评审：再看系统设计、数据设计与前端 UI 规范
- 运维评审：补看部署设计
- 排期评审：最后使用任务拆解文档作为 backlog 基线
