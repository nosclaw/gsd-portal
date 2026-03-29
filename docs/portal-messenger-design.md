# Portal Messenger — 跨工作空间实时通信与编排系统

GSD Portal 的 WebSocket 消息中枢，实现跨机器、跨部署的工作空间通信、进度汇报、依赖协调和全自动 Agent 编排。

---

## 背景

GSD 生态中**没有任何跨 Agent 通信机制**。当多个工作空间分布在不同机器甚至不同部署实例时，需要：

1. **进度汇报** — 所有 WS 在开始、进度更新、完成时向 Tech Manager 汇报
2. **依赖协调** — 上游里程碑合并后实时通知下游 WS
3. **全自动编排** — 规划完成后自动创建 WS、分配角色、启动 Agent

### 现有生态

| 项目 | Stars | 方案 | 局限 |
|------|-------|------|------|
| **23blocks-OS/ai-maestro** | 571 | Peer mesh + AMP 协议 + Dashboard | 架构复杂，无中心节点 |
| **mainion-ai/agent-mailbox** | — | MCP 原生，HTTP+SQLite，4 个 tools | 单机，无跨机器支持 |
| **lleontor705/agent-mailbox** | — | SQLite，DLQ，visibility timeout | 单机，文件锁并发问题 |
| **gsd-build/context-packet** | 12 | DAG 上下文传递，MCP server | 无实时通信 |

---

## 架构

### 单部署模式

所有 WS 在同一台服务器上，连接到本地 Portal：

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────────┐
│  WS1    │  │  WS2    │  │  WS3    │  │ Tech Manager   │
│  Agent  │  │  Agent  │  │  Agent  │  │ WS Agent       │
└────┬────┘  └────┬────┘  └────┬────┘  └────────┬───────┘
     │ WS         │ WS         │ WS              │ WS
     └────────────┼────────────┴─────────────────┘
                  │
         ┌────────▼────────┐
         │   GSD Portal    │
         │   WebSocket Hub │
         └─────────────────┘
```

### 多部署模式（跨机器）

Portal 部署在多台服务器上，每台管理本地的 WS。Portal 实例之间通过 **Hub 联邦** 互通。

```
  机器 A                          机器 B                        机器 C
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ WS1    WS2       │  │ WS3    WS4       │  │ Tech Manager WS  │
│ Agent  Agent     │  │ Agent  Agent     │  │ Agent            │
└──┬───────┬───────┘  └──┬───────┬───────┘  └────────┬─────────┘
   │       │              │       │                    │
┌──▼───────▼───┐     ┌───▼───────▼───┐     ┌─────────▼─────────┐
│ Portal A     │     │ Portal B      │     │ Portal C           │
│ (Worker)     │     │ (Worker)      │     │ (Worker)           │
└──────┬───────┘     └───────┬───────┘     └─────────┬─────────┘
       │ WebSocket           │ WebSocket              │ WebSocket
       └─────────────────────┼────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Portal Hub    │
                    │   (协调中心)     │
                    │                 │
                    │  • 跨部署路由    │
                    │  • 全局连接表    │
                    │  • 消息中继      │
                    │  • 进度聚合      │
                    │  • 编排指令分发  │
                    └─────────────────┘
```

### Hub 联邦设计

**角色分工：**

| 角色 | 职责 |
|------|------|
| **Portal Hub** | 全局协调中心。维护所有 Worker 的连接、全局 WS 注册表、跨部署消息路由 |
| **Portal Worker** | 本地 WS 管理。管理本机 WS 生命周期，接收 Hub 的编排指令，上行汇报本地 WS 状态 |

**通信流程：**

```
WS1 (机器 A) 发消息给 WS3 (机器 B)：

WS1 → Portal A (Worker) → Portal Hub → Portal B (Worker) → WS3
```

**Hub 选举：**
- 默认第一个启动的 Portal 实例为 Hub
- 或者通过环境变量 `PORTAL_ROLE=hub` 显式指定
- Worker 通过 `PORTAL_HUB_URL` 连接到 Hub

**Worker 注册：**

```typescript
// Worker 启动时连接 Hub
interface WorkerRegistration {
  workerId: string;           // Portal 实例 ID
  hubUrl: string;             // Hub 的 WebSocket 地址
  localWorkspaces: string[];  // 本机管理的 WS 列表
  capacity: number;           // 可用 WS 容量
}
```

**全局连接表（Hub 维护）：**

```typescript
interface GlobalRegistry {
  workers: Map<string, {
    workerId: string;
    socket: WebSocket;
    workspaces: string[];     // 该 Worker 管理的 WS ID 列表
    capacity: number;
    lastHeartbeat: number;
  }>;

  // wsId → workerId 映射，用于跨部署路由
  wsToWorker: Map<string, string>;
}
```

**消息路由：**

```typescript
function routeMessage(msg: PortalMessage) {
  const targetWorker = globalRegistry.wsToWorker.get(msg.to);

  if (msg.to === "broadcast") {
    // 广播给所有 Worker，每个 Worker 再转发给本地 WS
    for (const [id, worker] of globalRegistry.workers) {
      worker.socket.send(JSON.stringify(msg));
    }
  } else if (targetWorker === localWorkerId) {
    // 目标在本地，直接投递
    deliverToLocalWS(msg);
  } else if (targetWorker) {
    // 目标在其他 Worker，中继转发
    globalRegistry.workers.get(targetWorker).socket.send(JSON.stringify(msg));
  } else {
    // 目标不在线，持久化
    persistMessage(msg);
  }
}
```

### 环境变量

| 变量 | 角色 | 说明 | 示例 |
|------|------|------|------|
| `PORTAL_ROLE` | Portal | `hub` 或 `worker`，默认 `standalone`（单部署） | `hub` |
| `PORTAL_HUB_URL` | Worker | Hub 的 WebSocket 地址 | `wss://portal-hub.nosclaw.com/api/ws/federation` |
| `PORTAL_WORKER_ID` | Worker | 本实例标识 | `worker-machine-a` |
| `PORTAL_WORKER_SECRET` | Worker | Worker 间认证密钥 | `sk-...` |

### 单部署自动降级

当 `PORTAL_ROLE` 未设置或为 `standalone` 时，Portal 同时扮演 Hub 和 Worker 角色，所有消息本地路由，无需联邦。现有单机部署零改动即可工作。

---

## 全自动 Agent 编排

Phase 0 规划完成后，Portal 自动完成从**创建 WS 到 Agent 开始工作**的全流程，无需人工干预。

### 编排流程

```
项目负责人确认 PLAN.md
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Portal 自动编排（Orchestration Engine）                │
│                                                       │
│  1. 解析 PLAN.md → 提取 WS 分配表                      │
│  2. 为每个 WS 分配到有容量的 Worker（跨部署时）          │
│  3. 向各 Worker 发送 PROVISION 指令                     │
│  4. Worker 收到后：                                    │
│     a. 创建 WS（用户、home 目录、API key）              │
│     b. 克隆 Git 仓库                                   │
│     c. 安装 portal-messenger 扩展                      │
│     d. 写入 WS 级 preferences（角色 + 里程碑分配）       │
│     e. 设置环境变量（PORTAL_WS_ID, GSD_MILESTONE 等）   │
│     f. 启动 /gsd auto                                 │
│  5. Agent 上线后自动连接 Portal WebSocket                │
│  6. Agent 汇报 PROGRESS: "started"                     │
│  7. 编排完成 — 所有 Agent 自主运行                       │
└───────────────────────────────────────────────────────┘
```

### 编排消息类型

在原有消息类型基础上新增：

| 类型 | 发送方 | 接收方 | 说明 |
|------|--------|--------|------|
| `PROVISION` | Hub | Worker | 指令 Worker 创建 WS 并启动 Agent |
| `PROVISION_ACK` | Worker | Hub | WS 创建成功，Agent 已启动 |
| `DEPROVISION` | Hub | Worker | 指令 Worker 销毁 WS |
| `WORKER_STATUS` | Worker | Hub | Worker 状态汇报（容量、负载） |

### PROVISION 指令

Hub 发送给 Worker，指示创建并启动一个 WS：

```json
{
  "type": "PROVISION",
  "to": "worker-machine-a",
  "data": {
    "wsId": "ws1",
    "username": "dev-ws1",
    "gitRepo": "https://github.com/org/project.git",
    "gitBranch": "feat/user-module",
    "milestone": "M1",
    "role": "developer",
    "preferences": {
      "custom_instructions": [
        "读取 PLAN.md，你是 WS1",
        "你负责 M1 用户管理模块",
        "在 feat/user-module 分支上工作",
        "依赖 M0，M0 未合并前不要开始编码"
      ]
    },
    "providerKey": "sk-or-...",
    "autoStart": true
  }
}
```

### Worker 处理 PROVISION

```typescript
async function handleProvision(msg: ProvisionMessage) {
  const { wsId, username, gitRepo, gitBranch, milestone, role, preferences, providerKey } = msg.data;

  // 1. 创建 WS 用户和 home 目录
  await createWorkspace(username);

  // 2. 配置 GSD agent
  await writeAuthJson(username, providerKey);
  await writeSettingsJson(username);

  // 3. 克隆仓库
  await cloneRepo(username, gitRepo);

  // 4. 安装 portal-messenger 扩展
  await installExtension(username, "portal-messenger");

  // 5. 写入 WS 级 preferences
  await writePreferences(username, preferences);

  // 6. 设置环境变量
  const env = {
    PORTAL_WS_URL: hubUrl,
    PORTAL_WS_ID: wsId,
    PORTAL_WS_TOKEN: generateToken(wsId),
    GSD_MILESTONE: milestone,
  };

  // 7. 启动 /gsd auto
  if (msg.data.autoStart) {
    await launchGsdAuto(username, env);
  }

  // 8. 回复 Hub
  sendToHub({ type: "PROVISION_ACK", data: { wsId, status: "running" } });
}
```

### 一键启动全团队

项目负责人在 Portal Dashboard 上确认 PLAN.md 后，点击"启动团队"：

```
1. Portal 解析 PLAN.md
2. 识别 N 个开发 WS + 1 个 Tech Manager WS
3. 分配到各 Worker（按容量负载均衡）
4. 并行发送 PROVISION 指令
5. 各 Worker 创建 WS + 启动 /gsd auto
6. Agent 上线 → 连接 WebSocket → 汇报 "started"
7. Dashboard 实时显示所有 Agent 状态
8. 全团队自动进入工作状态
```

**从确认 PLAN.md 到所有 Agent 开始工作，全自动，零人工操作。**

---

## 系统组成

### 1. Portal Hub（协调中心）

全局消息路由、编排指令分发、进度聚合。单部署时 Hub 和 Worker 合一。

### 2. Portal Worker（本地管理）

管理本机 WS 生命周期，执行 PROVISION/DEPROVISION 指令。

### 3. GSD 扩展：portal-messenger（客户端）

每个 WS 安装，通过 WebSocket 连接到 Portal。

---

## Portal 端设计

### WebSocket 端点

| 端点 | 用途 | 认证 |
|------|------|------|
| `/api/ws/agent` | Agent 连接（WS ↔ Portal） | `?wsId={id}&token={token}` |
| `/api/ws/federation` | Worker 连接（Worker ↔ Hub） | `?workerId={id}&secret={secret}` |

### 消息格式

```typescript
interface PortalMessage {
  id: string;                          // UUID
  from: string;                        // 发送方（Portal 自动填充）
  to: string;                          // ws1, tech-manager, broadcast, worker-xxx
  type: MessageType;
  data: Record<string, unknown>;
  ts: number;                          // 时间戳（Portal 自动填充）
  projectId?: string;                  // 项目隔离（多项目时）
}

type MessageType =
  // Agent 消息
  | "PROGRESS"
  | "DEPENDENCY_READY"
  | "REVIEW_REQUEST"
  | "REVIEW_FEEDBACK"
  | "MILESTONE_COMPLETE"
  | "QUESTION"
  | "HEARTBEAT"
  | "ACK"
  // 编排消息
  | "PROVISION"
  | "PROVISION_ACK"
  | "DEPROVISION"
  | "WORKER_STATUS";
```

### 消息持久化

```sql
CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  from_ws TEXT NOT NULL,
  to_ws TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,          -- JSON
  ts INTEGER NOT NULL,
  delivered INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_to ON agent_messages(to_ws, delivered);
CREATE INDEX idx_messages_project ON agent_messages(project_id, ts);
```

### 心跳机制

```
Agent → Portal:   每 30 秒 HEARTBEAT
Worker → Hub:     每 30 秒 WORKER_STATUS（含容量、活跃 WS 数）
超时 90 秒:        标记离线
```

### 进度聚合

```typescript
interface WorkspaceProgress {
  wsId: string;
  milestone: string;
  status: string;
  progress: number;       // 0-100
  currentSlice: string;
  lastUpdate: number;
  isOnline: boolean;
  workerId: string;       // 所在 Worker
}
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
  "description": "Cross-workspace real-time messaging via GSD Portal WebSocket hub",
  "tier": "custom",
  "requires": { "platform": ">=2.29.0" },
  "provides": {
    "tools": ["portal_send", "portal_wait", "portal_report_progress"],
    "hooks": ["session_start", "session_shutdown"]
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

  const PORTAL_URL = process.env.PORTAL_WS_URL || "ws://localhost:29000/api/ws/agent";
  const WS_ID = process.env.PORTAL_WS_ID;
  const WS_TOKEN = process.env.PORTAL_WS_TOKEN;
  const MILESTONE = process.env.GSD_MILESTONE || "unknown";

  function connect() {
    if (!WS_ID || !WS_TOKEN) {
      console.log("[portal-messenger] PORTAL_WS_ID or PORTAL_WS_TOKEN not set, skipping.");
      return;
    }

    ws = new WebSocket(`${PORTAL_URL}?wsId=${WS_ID}&token=${WS_TOKEN}`);

    ws.on("open", () => {
      console.log(`[portal-messenger] Connected as ${WS_ID}`);
      startHeartbeat();
      sendRaw({ type: "PROGRESS", to: "tech-manager",
        data: { status: "connected", milestone: MILESTONE } });
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "HEARTBEAT" || msg.type === "ACK") return;

        pi.sendMessage({
          customType: `portal-${msg.type.toLowerCase()}`,
          content: formatMessage(msg),
          display: true
        }, { triggerTurn: true, deliverAs: "followUp" });
      } catch (err) {
        console.error("[portal-messenger] Parse error:", err);
      }
    });

    ws.on("close", () => {
      stopHeartbeat();
      reconnectTimer = setTimeout(connect, 5000);
    });

    ws.on("error", (err) => {
      console.error("[portal-messenger] Error:", err.message);
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
    heartbeatTimer = setInterval(() => sendRaw({ type: "HEARTBEAT" }), 30000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }

  function formatMessage(msg) {
    const lines = [`[Portal] ${msg.from} → ${msg.type}`];
    if (msg.data) {
      for (const [k, v] of Object.entries(msg.data)) {
        lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    }
    return lines.join("\n");
  }

  // ── Hooks ──

  pi.on("session_start", () => connect());

  pi.on("session_shutdown", () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopHeartbeat();
    if (ws?.readyState === WebSocket.OPEN) {
      sendRaw({ type: "PROGRESS", to: "tech-manager",
        data: { status: "shutdown", milestone: MILESTONE } });
      ws.close();
    }
  });

  // ── Tools ──

  pi.registerTool("portal_send", {
    description: "Send a message to another workspace or Tech Manager via Portal",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Target: ws1, ws2, tech-manager, broadcast" },
        type: { type: "string", description: "DEPENDENCY_READY, QUESTION, REVIEW_REQUEST, MILESTONE_COMPLETE" },
        data: { type: "object", description: "Message payload" }
      },
      required: ["to", "type"]
    },
    execute: async ({ to, type, data = {} }) => {
      const sent = sendRaw({ to, type, data });
      return sent ? { sent: true } : { sent: false, error: "Not connected" };
    }
  });

  pi.registerTool("portal_report_progress", {
    description: "Report progress to Tech Manager",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "e.g. 'S1.2 complete', 'PR created'" },
        milestone: { type: "string", description: "e.g. 'M1'" },
        progress: { type: "number", description: "0-100" },
        slice: { type: "string", description: "e.g. 'S1.2'" }
      },
      required: ["status"]
    },
    execute: async ({ status, milestone = MILESTONE, progress = 0, slice }) => {
      const sent = sendRaw({ to: "tech-manager", type: "PROGRESS",
        data: { status, milestone, progress, slice } });
      return sent ? { reported: true } : { reported: false, error: "Not connected" };
    }
  });

  pi.registerTool("portal_wait", {
    description: "Wait for a message type. Returns immediately; you'll be notified via follow-up when it arrives.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "e.g. DEPENDENCY_READY" }
      },
      required: ["type"]
    },
    execute: async ({ type }) => {
      return { waiting: true, type, note: "Auto-notified when message arrives." };
    }
  });
};
```

---

## 消息类型

### Agent 消息

| 类型 | 方向 | 触发时机 | 数据 |
|------|------|----------|------|
| `PROGRESS` | 开发 WS → Tech Manager | 开始、Slice 完成、PR 创建 | `{ status, milestone, progress, slice }` |
| `DEPENDENCY_READY` | Tech Manager → 等待方 WS | 上游里程碑合并后 | `{ milestone, branch, mergedAt }` |
| `REVIEW_REQUEST` | 开发 WS → Tech Manager | PR 创建后 | `{ milestone, prNumber, prUrl, branch }` |
| `REVIEW_FEEDBACK` | Tech Manager → 开发 WS | PR 有修改意见 | `{ milestone, prNumber, status, comments }` |
| `MILESTONE_COMPLETE` | Tech Manager → broadcast | 验收通过 | `{ milestone, completedBy, verifiedAt }` |
| `QUESTION` | 任意 WS → Tech Manager | 需要协调的问题 | `{ milestone, question, context }` |

### 编排消息

| 类型 | 方向 | 说明 | 数据 |
|------|------|------|------|
| `PROVISION` | Hub → Worker | 创建 WS 并启动 Agent | `{ wsId, username, gitRepo, milestone, role, preferences, providerKey, autoStart }` |
| `PROVISION_ACK` | Worker → Hub | WS 已创建 | `{ wsId, status }` |
| `DEPROVISION` | Hub → Worker | 销毁 WS | `{ wsId }` |
| `WORKER_STATUS` | Worker → Hub | 状态汇报 | `{ workspaces, capacity, load }` |

---

## 环境变量

### Agent（GSD 扩展使用）

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORTAL_WS_URL` | Portal WebSocket 端点 | `wss://portal.nosclaw.com/api/ws/agent` |
| `PORTAL_WS_ID` | 工作空间标识符 | `ws1`, `tech-manager` |
| `PORTAL_WS_TOKEN` | 认证 token | `eyJ...` |
| `GSD_MILESTONE` | 分配的里程碑 | `M1` |

### Portal 实例

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORTAL_ROLE` | `hub` / `worker` / `standalone`（默认） | `hub` |
| `PORTAL_HUB_URL` | Hub 的联邦端点（Worker 用） | `wss://portal-hub.nosclaw.com/api/ws/federation` |
| `PORTAL_WORKER_ID` | Worker 标识 | `worker-machine-a` |
| `PORTAL_WORKER_SECRET` | Worker 认证密钥 | `sk-...` |

---

## 安全性

| 关注点 | 措施 |
|--------|------|
| **Agent 认证** | WebSocket 连接使用 Portal 生成的 token |
| **Worker 认证** | Worker 使用共享密钥连接 Hub |
| **传输加密** | 生产环境 wss:// (TLS) |
| **消息验证** | Portal 自动填充 `from`，客户端无法伪造 |
| **速率限制** | 每个 WS 消息频率限制 |
| **项目隔离** | 多项目时消息按 `projectId` 隔离 |

---

## 安装

### Portal 自动编排（推荐）

PROVISION 指令自动完成：创建 WS → 安装扩展 → 注入环境变量 → 启动 `/gsd auto`。

### 手动安装

```bash
cp -r portal-messenger ~/.gsd/agent/extensions/
# 设置环境变量后重启 GSD
```

---

## 全流程自动化时序

```
项目负责人                    Portal Hub              Worker A/B/C           Agent 1~N
    │                            │                       │                      │
    │── 确认 PLAN.md ──────────▶│                       │                      │
    │                            │── PROVISION ────────▶│                      │
    │                            │   (ws1, M0, dev)      │── 创建 WS            │
    │                            │                       │── 克隆仓库            │
    │                            │                       │── 安装扩展            │
    │                            │                       │── 启动 /gsd auto ──▶│
    │                            │◀── PROVISION_ACK ────│                      │
    │                            │                       │                      │── 连接 WebSocket
    │                            │◀─────────────────────────────────────────────│── PROGRESS: started
    │                            │                       │                      │
    │                            │   ... Agent 自主工作 ...                      │── 编码、测试、commit
    │                            │                       │                      │
    │                            │◀─────────────────────────────────────────────│── PROGRESS: S0.1 done
    │                            │◀─────────────────────────────────────────────│── PROGRESS: PR created
    │                            │                       │                      │
    │                            │── REVIEW_FEEDBACK ──────────────────────────▶│── 自动修复
    │                            │── DEPENDENCY_READY ─────────────────────────▶│── 开始下一个里程碑
    │                            │                       │                      │
    │                            │── MILESTONE_COMPLETE (broadcast) ──────────▶│
    │                            │                       │                      │
    │◀── 验收报告 ──────────────│                       │                      │
    │                            │                       │                      │
    │── 确认发布 ──────────────▶│── DEPROVISION ──────▶│── 清理 WS             │
```

---

## 未来扩展

| 功能 | 描述 |
|------|------|
| **Dashboard 集成** | 实时显示所有 WS 进度、Agent 状态、消息流 |
| **自动扩缩容** | 根据负载自动在 Worker 间迁移 WS |
| **Webhook 通知** | 关键事件推送到 Slack/Discord/飞书 |
| **消息回放** | 查询历史消息，调试协调问题 |
| **Agent 能力发现** | WS 上线时广播 skills 列表，支持动态任务调度 |
| **多项目并行** | 同一 Portal 集群管理多个项目，消息按 projectId 隔离 |
