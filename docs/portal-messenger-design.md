# Portal Messenger — 跨工作空间实时通信系统

GSD Portal 的 WebSocket 消息中枢，实现跨机器工作空间之间的进度汇报、依赖协调和团队通信。

---

## 背景

GSD 生态中**没有任何跨 Agent 通信机制**。当多个工作空间分布在不同机器上时，需要：

1. **进度汇报** — 所有 WS 在开始、进度更新、完成时向 Tech Manager 汇报
2. **依赖协调** — WS3 依赖 WS1 的 M1 时，M1 合并后实时通知 WS3
3. **Review 反馈** — Tech Manager 审查 PR 后通知开发 WS 修复

### 现有生态

| 项目 | Stars | 方案 | 局限 |
|------|-------|------|------|
| **23blocks-OS/ai-maestro** | 571 | Peer mesh + AMP 协议 + Dashboard | 架构复杂，无中心节点 |
| **mainion-ai/agent-mailbox** | — | MCP 原生，HTTP+SQLite，4 个 tools | 单机，无跨机器支持 |
| **lleontor705/agent-mailbox** | — | SQLite，DLQ，visibility timeout | 单机，文件锁并发问题 |
| **gsd-build/context-packet** | 12 | DAG 上下文传递，MCP server | 无实时通信 |

---

## 架构

**GSD Portal 已经是所有 WS 的管理中心。** 不需要 peer mesh 或独立服务 — Portal 天然就是消息枢纽。

```
  跨机器                        跨机器
┌─────────┐  ┌─────────┐  ┌─────────┐
│  WS1    │  │  WS2    │  │  WS3    │
│  Agent  │  │  Agent  │  │  Agent  │
│(机器 A) │  │(机器 B) │  │(机器 C) │
└────┬────┘  └────┬────┘  └────┬────┘
     │ WebSocket   │ WebSocket  │ WebSocket
     └─────────────┼────────────┘
                   │
          ┌────────▼────────┐
          │   GSD Portal    │
          │   WebSocket Hub │
          │   (服务器)       │
          │                 │
          │  • 身份认证      │
          │  • 消息路由      │
          │  • 进度聚合      │
          │  • 依赖状态监控  │
          │  • 消息持久化    │
          │  • 断线重连恢复  │
          │  • Dashboard 数据│
          └────────┬────────┘
                   │ WebSocket
          ┌────────▼────────┐
          │ Tech Manager WS │
          │ Agent           │
          │ (任意机器)       │
          └─────────────────┘
```

**为什么用 Portal 而不是独立服务：**
- Portal 已经管理所有 WS 的生命周期
- Portal 已经有 WS 的身份信息（用户、角色、端口）
- Portal 已经有 SQLite 数据库可以持久化消息
- Portal 已经有 Cloudflare Tunnel 配置，跨机器可达
- 不需要额外部署任何服务

---

## 系统组成

Portal Messenger 由两部分组成：

### 1. Portal 端：WebSocket Hub（服务端）

Portal 新增 WebSocket 端点，负责消息路由和持久化。

### 2. GSD 扩展：portal-messenger（客户端）

每个 WS 安装的 GSD 扩展，通过 WebSocket 连接到 Portal。

---

## Portal 端设计

### WebSocket 端点

```
路径: /api/ws/agent
协议: WebSocket (ws:// 或 wss://)
认证: URL 参数 ?wsId={id}&token={token}
```

### 连接管理

```typescript
// app/api/ws/agent/route.ts

interface AgentConnection {
  wsId: string;          // 工作空间 ID（ws1, ws2, tech-manager）
  username: string;      // Portal 用户名
  socket: WebSocket;     // WebSocket 连接实例
  connectedAt: number;   // 连接时间
  lastHeartbeat: number; // 最后心跳时间
}

// 连接池 — 所有活跃的 Agent 连接
const connections = new Map<string, AgentConnection>();
```

### 消息格式

```typescript
interface PortalMessage {
  id: string;              // 消息唯一 ID（UUID）
  from: string;            // 发送方 WS ID（Portal 自动填充）
  to: string;              // 目标：ws1, ws2, tech-manager, broadcast
  type: MessageType;       // 消息类型
  data: Record<string, unknown>;  // 消息负载
  ts: number;              // 时间戳（Portal 自动填充）
  ack?: boolean;           // 是否需要确认
}

type MessageType =
  | "PROGRESS"             // 进度汇报
  | "DEPENDENCY_READY"     // 依赖就绪通知
  | "REVIEW_REQUEST"       // PR 审查请求
  | "REVIEW_FEEDBACK"      // PR 审查反馈
  | "MILESTONE_COMPLETE"   // 里程碑验收通过
  | "QUESTION"             // 需要协调的问题
  | "HEARTBEAT"            // 心跳
  | "ACK";                 // 消息确认
```

### 消息路由逻辑

```typescript
function routeMessage(msg: PortalMessage) {
  if (msg.to === "broadcast") {
    // 发送给所有连接的 WS（除了发送方）
    for (const [id, conn] of connections) {
      if (id !== msg.from) conn.socket.send(JSON.stringify(msg));
    }
  } else {
    // 发送给指定 WS
    const target = connections.get(msg.to);
    if (target) {
      target.socket.send(JSON.stringify(msg));
    } else {
      // 目标离线 → 持久化到数据库，待重连后投递
      persistMessage(msg);
    }
  }
}
```

### 消息持久化

离线消息存入 SQLite，WS 重连后投递：

```sql
CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  from_ws TEXT NOT NULL,
  to_ws TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,          -- JSON
  ts INTEGER NOT NULL,
  delivered INTEGER DEFAULT 0, -- 0=未投递, 1=已投递
  acked INTEGER DEFAULT 0,     -- 0=未确认, 1=已确认
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_agent_messages_to_delivered ON agent_messages(to_ws, delivered);
```

### 重连投递

```typescript
function onAgentConnect(wsId: string, socket: WebSocket) {
  // 投递所有未送达的消息
  const pending = db.query(
    "SELECT * FROM agent_messages WHERE to_ws = ? AND delivered = 0 ORDER BY ts",
    [wsId]
  );
  for (const msg of pending) {
    socket.send(msg.data);
    db.run("UPDATE agent_messages SET delivered = 1 WHERE id = ?", [msg.id]);
  }
}
```

### 心跳机制

```
客户端每 30 秒发送 HEARTBEAT
服务端 90 秒未收到心跳 → 标记 WS 离线
服务端 5 秒回复 HEARTBEAT 的 ACK
```

### 进度聚合

Portal 维护所有 WS 的实时进度状态，供 Dashboard 展示：

```typescript
interface WorkspaceProgress {
  wsId: string;
  milestone: string;
  status: string;
  progress: number;       // 0-100
  currentSlice: string;
  lastUpdate: number;
  isOnline: boolean;
}

// 收到 PROGRESS 消息时更新
const progressMap = new Map<string, WorkspaceProgress>();
```

---

## GSD 扩展设计

### 文件结构

```
~/.gsd/agent/extensions/portal-messenger/
├── extension-manifest.json
├── index.js
└── README.md
```

### extension-manifest.json

```json
{
  "id": "portal-messenger",
  "name": "Portal Messenger",
  "version": "1.0.0",
  "description": "Cross-workspace real-time messaging via GSD Portal WebSocket hub. Enables progress reporting, dependency coordination, and team communication across machines.",
  "tier": "custom",
  "requires": {
    "platform": ">=2.29.0"
  },
  "provides": {
    "tools": [
      "portal_send",
      "portal_wait",
      "portal_report_progress"
    ],
    "hooks": [
      "session_start",
      "session_shutdown"
    ]
  }
}
```

### index.js

```javascript
const WebSocket = require("ws");

module.exports = function portalMessenger(pi) {
  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  const waitFilters = new Map();  // type → callback

  const PORTAL_URL = process.env.PORTAL_WS_URL || "ws://localhost:29000/api/ws/agent";
  const WS_ID = process.env.PORTAL_WS_ID;
  const WS_TOKEN = process.env.PORTAL_WS_TOKEN;
  const MILESTONE = process.env.GSD_MILESTONE || "unknown";

  // ── 连接管理 ──

  function connect() {
    if (!WS_ID || !WS_TOKEN) {
      console.log("[portal-messenger] PORTAL_WS_ID or PORTAL_WS_TOKEN not set, skipping.");
      return;
    }

    ws = new WebSocket(`${PORTAL_URL}?wsId=${WS_ID}&token=${WS_TOKEN}`);

    ws.on("open", () => {
      console.log(`[portal-messenger] Connected to Portal as ${WS_ID}`);
      startHeartbeat();
      // 自动汇报：连接成功
      sendRaw({ type: "PROGRESS", to: "tech-manager", data: { status: "connected", milestone: MILESTONE } });
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);

        // 心跳 ACK 不需要通知 Agent
        if (msg.type === "HEARTBEAT" || msg.type === "ACK") return;

        // 将消息注入 Agent context
        pi.sendMessage({
          customType: `portal-${msg.type.toLowerCase()}`,
          content: formatMessageForAgent(msg),
          display: true
        }, {
          triggerTurn: true,
          deliverAs: "followUp"
        });
      } catch (err) {
        console.error("[portal-messenger] Failed to parse message:", err);
      }
    });

    ws.on("close", () => {
      console.log("[portal-messenger] Disconnected from Portal, reconnecting in 5s...");
      stopHeartbeat();
      reconnectTimer = setTimeout(connect, 5000);
    });

    ws.on("error", (err) => {
      console.error("[portal-messenger] WebSocket error:", err.message);
    });
  }

  function sendRaw(msg) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      sendRaw({ type: "HEARTBEAT" });
    }, 30000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }

  function formatMessageForAgent(msg) {
    const lines = [`[Portal] ${msg.from} → ${msg.type}`];
    if (msg.data) {
      for (const [k, v] of Object.entries(msg.data)) {
        lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    }
    return lines.join("\n");
  }

  // ── Hooks ──

  pi.on("session_start", () => {
    connect();
  });

  pi.on("session_shutdown", () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopHeartbeat();
    if (ws?.readyState === WebSocket.OPEN) {
      sendRaw({ type: "PROGRESS", to: "tech-manager", data: { status: "shutdown", milestone: MILESTONE } });
      ws.close();
    }
  });

  // ── Tools ──

  pi.registerTool("portal_send", {
    description: "Send a message to another workspace or Tech Manager via Portal WebSocket hub. Use for dependency notifications, questions, or coordination.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Target workspace: ws1, ws2, tech-manager, or broadcast" },
        type: { type: "string", description: "Message type: DEPENDENCY_READY, QUESTION, REVIEW_REQUEST, MILESTONE_COMPLETE" },
        data: { type: "object", description: "Message payload (any JSON object)" }
      },
      required: ["to", "type"]
    },
    execute: async ({ to, type, data = {} }) => {
      const sent = sendRaw({ to, type, data });
      return sent ? { sent: true } : { sent: false, error: "Not connected to Portal" };
    }
  });

  pi.registerTool("portal_report_progress", {
    description: "Report current work progress to Tech Manager. Call this when starting work, completing a slice, creating a PR, or finishing review fixes.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Current status description, e.g. 'S1.2 complete', 'PR created'" },
        milestone: { type: "string", description: "Milestone identifier, e.g. 'M1'" },
        progress: { type: "number", description: "Completion percentage 0-100" },
        slice: { type: "string", description: "Current slice identifier, e.g. 'S1.2'" }
      },
      required: ["status"]
    },
    execute: async ({ status, milestone = MILESTONE, progress = 0, slice }) => {
      const sent = sendRaw({
        to: "tech-manager",
        type: "PROGRESS",
        data: { status, milestone, progress, slice }
      });
      return sent ? { reported: true } : { reported: false, error: "Not connected to Portal" };
    }
  });

  pi.registerTool("portal_wait", {
    description: "Register interest in a message type. Returns immediately. You will receive a follow-up notification when a matching message arrives via WebSocket.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Message type to wait for, e.g. DEPENDENCY_READY" }
      },
      required: ["type"]
    },
    execute: async ({ type }) => {
      // WebSocket on("message") handler already registered in session_start.
      // All incoming messages are delivered to Agent via pi.sendMessage.
      // This tool is a semantic signal — the Agent acknowledges it's waiting.
      return {
        waiting: true,
        type,
        note: "You will be notified automatically when a matching message arrives."
      };
    }
  });
};
```

---

## 消息类型详细定义

### PROGRESS — 进度汇报

所有开发 WS 在关键节点发送：

```json
{
  "to": "tech-manager",
  "type": "PROGRESS",
  "data": {
    "status": "S1.2 complete",
    "milestone": "M1",
    "progress": 50,
    "slice": "S1.2"
  }
}
```

**汇报时机：**
| 时机 | status | progress |
|------|--------|----------|
| 开始工作 | `"started"` | 0 |
| 完成 Slice | `"S1.2 complete"` | 按比例计算 |
| 创建 PR | `"PR created"` | 100 |
| 修复 review 反馈 | `"review fixes applied"` | 100 |
| 会话结束 | `"shutdown"` | — |

### DEPENDENCY_READY — 依赖就绪通知

Tech Manager 合并上游里程碑后发送给下游 WS：

```json
{
  "to": "ws3",
  "type": "DEPENDENCY_READY",
  "data": {
    "milestone": "M1",
    "branch": "main",
    "mergedAt": 1711700000000
  }
}
```

### REVIEW_REQUEST — PR 审查请求

开发 WS 创建 PR 后发送：

```json
{
  "to": "tech-manager",
  "type": "REVIEW_REQUEST",
  "data": {
    "milestone": "M1",
    "prNumber": 42,
    "prUrl": "https://github.com/org/repo/pull/42",
    "branch": "feat/user-module"
  }
}
```

### REVIEW_FEEDBACK — 审查反馈

Tech Manager 审查 PR 后发送给开发 WS：

```json
{
  "to": "ws1",
  "type": "REVIEW_FEEDBACK",
  "data": {
    "milestone": "M1",
    "prNumber": 42,
    "status": "changes_requested",
    "comments": ["Fix type safety in user API", "Add error handling for edge case"]
  }
}
```

### MILESTONE_COMPLETE — 里程碑完成

Tech Manager 验收通过后广播：

```json
{
  "to": "broadcast",
  "type": "MILESTONE_COMPLETE",
  "data": {
    "milestone": "M1",
    "completedBy": "ws1",
    "verifiedAt": 1711700000000
  }
}
```

### QUESTION — 协调问题

任意 WS 遇到需要协调的问题时发送：

```json
{
  "to": "tech-manager",
  "type": "QUESTION",
  "data": {
    "milestone": "M2",
    "question": "M0 shared types missing PaymentStatus enum, should I add it?",
    "context": "Need this for order status tracking in S2.1"
  }
}
```

---

## 环境变量

Portal 编排器在启动 WS 时注入以下环境变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORTAL_WS_URL` | Portal WebSocket 端点 | `wss://gsd-portal-staging.nosclaw.com/api/ws/agent` |
| `PORTAL_WS_ID` | 工作空间标识符 | `ws1`, `ws2`, `tech-manager` |
| `PORTAL_WS_TOKEN` | 认证 token | `eyJ...` |
| `GSD_MILESTONE` | 分配的里程碑 | `M1` |

---

## 安装方式

### 自动安装（Portal 编排器）

Portal 在创建 WS 时自动将扩展文件复制到 `~/.gsd/agent/extensions/portal-messenger/`，并在 `registry.json` 中启用。

### 手动安装

```bash
# 复制扩展到 GSD 扩展目录
cp -r portal-messenger ~/.gsd/agent/extensions/

# 在 registry.json 中启用（或重启 GSD 自动检测）
```

---

## 安全性

| 关注点 | 措施 |
|--------|------|
| **认证** | WebSocket 连接使用 token 认证，token 由 Portal 编排器生成 |
| **授权** | Portal 验证 WS ID 与 token 匹配，防止冒充 |
| **传输加密** | 生产环境使用 wss:// (TLS) |
| **消息验证** | Portal 自动填充 `from` 字段，客户端无法伪造发送方 |
| **速率限制** | Portal 端限制每个 WS 的消息频率，防止刷屏 |

---

## 未来扩展

| 功能 | 描述 |
|------|------|
| **Dashboard 集成** | Portal Admin Dashboard 展示所有 WS 实时进度 |
| **消息历史** | 所有消息持久化到 SQLite，可查询历史 |
| **Webhook 通知** | 关键事件（里程碑完成、验收失败）推送到 Slack/Discord |
| **多项目隔离** | 消息按项目 ID 隔离，不同项目的 WS 互不可见 |
| **Agent 能力发现** | WS 上线时广播自己的 skills 列表，Tech Manager 可动态调度 |
