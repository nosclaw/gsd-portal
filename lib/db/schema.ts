import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUSPENDED
  settings: text("settings", { mode: "json" }).$type<{
    allow_registration?: boolean;
    idle_timeout_minutes?: number;
    dev_env_repo?: string;         // e.g. "https://github.com/nosclaw/dev-env.git"
    dev_env_branch?: string;       // e.g. "main"
    dev_env_auto_init?: boolean;   // auto-init on first workspace launch
    workspace_domain?: string;     // e.g. "gsd.example.com"
    port_range_start?: number;     // e.g. 30000
    port_range_end?: number;       // e.g. 39999
    default_model?: string;        // e.g. "arcee-ai/trinity-large-preview:free"
    default_thinking_level?: string; // e.g. "minimal", "off", "medium", "high"
    git_post_buffer?: number;      // http.postBuffer in bytes, default 5242880000
  }>()
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("MEMBER"), // ROOT_ADMIN, TENANT_ADMIN, MEMBER
  status: text("status").notNull().default("PENDING"), // INVITED, PENDING, APPROVED, REJECTED, SUSPENDED
  tenantId: integer("tenant_id").references(() => tenants.id),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().default(new Date()),
  gitUsername: text("git_username"),    // Git commit author name
  gitEmail: text("git_email"),         // Git commit author email
  githubPat: text("github_pat")        // GitHub Personal Access Token (encrypted)
});

export const workspaceInstances = sqliteTable("workspace_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  port: integer("port").notNull(),
  status: text("status").notNull().default("STOPPED"), // STOPPED, STARTING, RUNNING, STOPPING, ERROR, EXPIRED
  pid: integer("pid"),
  lastHeartbeat: integer("last_heartbeat", { mode: "timestamp" }),
  error: text("error")
});

export const workspaceSessions = sqliteTable("workspace_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull()
});

// Relations definitions for Drizzle relational query API (db.query.*)
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  workspaceInstances: many(workspaceInstances),
  workspaceSessions: many(workspaceSessions),
  devEnvVersions: many(devEnvVersions)
}));

export const workspaceInstancesRelations = relations(workspaceInstances, ({ one }) => ({
  user: one(users, { fields: [workspaceInstances.userId], references: [users.id] })
}));

export const workspaceSessionsRelations = relations(workspaceSessions, ({ one }) => ({
  user: one(users, { fields: [workspaceSessions.userId], references: [users.id] })
}));

export const devEnvVersions = sqliteTable("dev_env_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  commit: text("commit_hash").notNull(),      // git commit hash
  repoUrl: text("repo_url").notNull(),       // repo that was cloned
  branch: text("branch").notNull(),          // branch that was checked out
  installedAt: integer("installed_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const devEnvVersionsRelations = relations(devEnvVersions, ({ one }) => ({
  user: one(users, { fields: [devEnvVersions.userId], references: [users.id] })
}));

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(), // username or "system"
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  result: text("result").notNull(), // SUCCESS, FAILURE
  metadata: text("metadata", { mode: "json" }),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(new Date())
});
