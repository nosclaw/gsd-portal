import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    settings TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    status TEXT NOT NULL DEFAULT 'PENDING',
    tenant_id INTEGER REFERENCES tenants(id),
    joined_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  `CREATE TABLE IF NOT EXISTS workspace_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    port INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'STOPPED',
    pid INTEGER,
    last_heartbeat INTEGER,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    result TEXT NOT NULL,
    metadata TEXT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  )`
];

export async function ensureSchema(db: any) {
  for (const stmt of SCHEMA_SQL) {
    await db.run(sql.raw(stmt));
  }
  logger.info("Database schema ensured.", { operation: "ensureSchema" });
}

export async function seedIfEmpty(db: any) {
  const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM tenants`));
  const count = result?.[0]?.count ?? result?.rows?.[0]?.count ?? 0;

  if (Number(count) > 0) {
    return;
  }

  logger.info("Empty database detected, seeding initial data.", { operation: "seedIfEmpty" });

  // Use dynamic import to avoid bundling bcryptjs issues
  const bcrypt = await import("bcryptjs");

  await db.run(sql.raw(
    `INSERT INTO tenants (name, status, settings) VALUES ('Nosclaw Team', 'ACTIVE', '{"allow_registration":true,"idle_timeout_minutes":60}')`
  ));

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('admin', 'admin@nosclaw.com', '${hashedPassword}', 'Root Admin', 'ROOT_ADMIN', 'APPROVED', 1, ${Math.floor(Date.now() / 1000)})`
  ));

  await db.run(sql.raw(
    `INSERT INTO audit_logs (actor, action, resource, result, timestamp)
     VALUES ('system', 'SYSTEM_INITIALIZED', 'platform', 'SUCCESS', ${Math.floor(Date.now() / 1000)})`
  ));

  logger.info("Database seeded with default tenant and root admin.", { operation: "seedIfEmpty" });
}
