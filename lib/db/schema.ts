import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUSPENDED
  settings: text("settings", { mode: "json" }).$type<{
    allow_registration?: boolean;
    idle_timeout_minutes?: number;
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
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().default(new Date())
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
  workspaceSessions: many(workspaceSessions)
}));

export const workspaceInstancesRelations = relations(workspaceInstances, ({ one }) => ({
  user: one(users, { fields: [workspaceInstances.userId], references: [users.id] })
}));

export const workspaceSessionsRelations = relations(workspaceSessions, ({ one }) => ({
  user: one(users, { fields: [workspaceSessions.userId], references: [users.id] })
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
