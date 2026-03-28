# GSD Portal Frontend UI Spec

## 0. 文档信息
- 版本：v1.0
- 状态：Draft for Design / Frontend Review
- 输入文档：[PRD](../PRD.md)、[系统设计](./system-design.md)
- 设计参考稿：[ui/design.png](../ui/design.png)

## 1. 目标
本规范用于约束 Portal 前端的组件体系、页面风格和设计落地方式，避免实现阶段出现以下问题：
1. 同时混用多套 UI 组件库，导致视觉与交互不一致。
2. 页面实现偏离设计稿，只剩“功能对了，界面不像”。
3. 登录、工作空间、管理员后台各自为政，缺少统一的产品感。

## 2. 技术选型
| 项目 | 选择 |
| --- | --- |
| UI 组件库 | HeroUI（GitHub: `heroui-inc/heroui`） |
| 样式基础 | Tailwind CSS |
| 图标策略 | 优先使用 HeroUI 兼容图标体系或统一图标来源 |
| 页面框架 | Next.js App Router |

约束：
1. HeroUI 是 Portal 唯一的基础 UI 组件库。
2. 可以封装 HeroUI 组件，但不应并行引入另一套通用组件系统。
3. 所有主题变量、圆角、阴影、状态色优先通过统一主题配置控制。

## 3. 设计稿使用原则
`ui/design.png` 是当前 Portal UI 的主要视觉参考。实现时应优先遵守以下内容：
1. 页面整体信息架构和分区方式。
2. 顶部区域、侧边导航、主内容区之间的层级关系。
3. 卡片容器、列表、操作按钮、状态标签的视觉语言。
4. 关键路径页面的交互重心，例如登录、启动工作空间、审批、查看状态。

说明：
1. 本规范不把设计稿机械转译为像素级规则，但关键页面的第一屏结构不应偏离原稿。
2. 若设计稿与 HeroUI 默认样式有冲突，以“封装组件 + 主题扩展”方式解决。

## 4. 页面级规范

### 4.1 登录与注册页
1. 视觉重心应集中在核心表单区，避免管理后台式密集布局。
2. 表单输入、主按钮、错误提示统一使用 HeroUI 表单组件。
3. 审批中、被拒绝、会话失效等状态页应沿用同一套空状态结构。

### 4.2 工作空间控制台
1. 第一屏必须明确展示当前工作空间状态。
2. 主操作应围绕 `启动`、`停止`、`重启`、`重新连接` 四类动作组织。
3. 状态提示、错误反馈、续期失败提示应具备高辨识度。
4. GSD 入口按钮必须是高优先级主操作。

### 4.3 管理员后台
1. 用户列表、审批记录、审计日志应以表格或列表卡片为主。
2. 用户状态需要通过统一的状态标签表现，例如 `PENDING`、`APPROVED`、`SUSPENDED`。
3. 高风险操作，如停用、强制停止，应采用二次确认交互。

## 5. HeroUI 组件映射建议
| 场景 | HeroUI 建议组件 |
| --- | --- |
| 顶部导航 | `Navbar` |
| 侧边导航 | `Listbox` / `Tabs` / 自定义封装 |
| 页面卡片 | `Card` |
| 主按钮/次按钮 | `Button` |
| 表单输入 | `Input`, `Textarea`, `Select` |
| 状态标签 | `Chip` |
| 数据列表 | `Table` |
| 弹窗确认 | `Modal` |
| 通知反馈 | `Toast` 或统一通知封装 |
| 加载与骨架 | `Spinner`, `Skeleton` |

## 6. 推荐组件分层
```text
components/
  app-shell/
    app-shell.tsx
    sidebar.tsx
    topbar.tsx
  workspace/
    workspace-status-card.tsx
    workspace-action-panel.tsx
    reconnect-banner.tsx
  admin/
    user-table.tsx
    approval-actions.tsx
    audit-log-table.tsx
  shared/
    status-chip.tsx
    empty-state.tsx
    page-header.tsx
    confirm-dialog.tsx
```

## 7. 视觉一致性要求
1. 相同含义的状态必须使用同一颜色和同一 `Chip` 封装。
2. 页面区块间距、卡片圆角、阴影层级不应在不同页面随机变化。
3. 空状态、错误状态、加载状态必须复用统一模式。
4. 所有列表操作按钮的位置和优先级要保持一致。

## 8. 响应式要求
1. MVP 优先保证桌面端和常见笔记本宽度下的可用性。
2. 小屏场景可以降级，但不得导致核心操作不可达。
3. 导航与主要控制区在中等宽度下应保持清晰分区。

## 9. 交付要求
1. 每个关键页面至少提供一个可评审的静态 UI 版本，再接业务逻辑。
2. 前端 PR 需说明该页面对应的 HeroUI 组件选型。
3. 如果页面实现明显偏离 `ui/design.png`，需在 PR 中明确说明原因。

## 10. 待确认事项
1. 是否需要定义品牌色、字体和图标的固定 token。
2. `ui/design.png` 是否代表单一页面，还是多页面共享的设计语言。
3. 是否需要在 V1 引入深色模式，还是先只做单一主题。
