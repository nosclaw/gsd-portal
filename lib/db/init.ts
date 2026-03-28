import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
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
    joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
    git_username TEXT,
    git_email TEXT,
    github_pat TEXT
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
  `CREATE TABLE IF NOT EXISTS dev_env_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    commit_hash TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    branch TEXT NOT NULL,
    installed_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
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

// Migrations for existing databases — add columns that might not exist
const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN git_username TEXT",
  "ALTER TABLE users ADD COLUMN git_email TEXT",
  "ALTER TABLE users ADD COLUMN github_pat TEXT",
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`
];

export async function ensureSchema(db: LibSQLDatabase) {
  for (const stmt of SCHEMA_SQL) {
    await db.run(sql.raw(stmt));
  }
  // Run migrations (ignore "duplicate column" errors)
  for (const migration of MIGRATIONS) {
    try { await db.run(sql.raw(migration)); } catch {}
  }
  logger.info("Database schema ensured.", { operation: "ensureSchema" });
}

export async function seedIfEmpty(db: LibSQLDatabase) {
  const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM tenants`));
  const count = result?.[0]?.count ?? result?.rows?.[0]?.count ?? 0;

  if (Number(count) > 0) {
    return;
  }

  logger.info("Empty database detected, seeding initial data.", { operation: "seedIfEmpty" });

  // Use dynamic import to avoid bundling bcryptjs issues
  const bcrypt = await import("bcryptjs");

  await db.run(sql.raw(
    `INSERT INTO tenants (name, status, settings) VALUES ('GSD Team', 'ACTIVE', '{"allow_registration":true,"idle_timeout_minutes":60,"dev_env_repo":"https://github.com/nosclaw/dev-env.git","dev_env_branch":"main","dev_env_auto_init":true}')`
  ));

  const hashedPassword = await bcrypt.hash("admin123", 10);
  const memberPassword = await bcrypt.hash("member123", 10);
  const now = Math.floor(Date.now() / 1000);

  // Root Admin
  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('admin', 'admin@nosclaw.com', '${hashedPassword}', 'Root Admin', 'ROOT_ADMIN', 'APPROVED', 1, ${now})`
  ));

  // Tenant Admin — approved, can manage users
  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('avery', 'avery@nosclaw.com', '${memberPassword}', 'Avery Palmer', 'TENANT_ADMIN', 'APPROVED', 1, ${now - 86400})`
  ));

  // Member — approved, can use workspace
  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('lena', 'lena@nosclaw.com', '${memberPassword}', 'Lena Costa', 'MEMBER', 'APPROVED', 1, ${now - 172800})`
  ));

  // Member — pending approval
  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('mila', 'mila@nosclaw.com', '${memberPassword}', 'Mila Sato', 'MEMBER', 'PENDING', 1, ${now - 3600})`
  ));

  // Member — suspended
  await db.run(sql.raw(
    `INSERT INTO users (username, email, password, name, role, status, tenant_id, joined_at)
     VALUES ('noah', 'noah@nosclaw.com', '${memberPassword}', 'Noah Kim', 'MEMBER', 'SUSPENDED', 1, ${now - 604800})`
  ));

  await db.run(sql.raw(
    `INSERT INTO audit_logs (actor, action, resource, result, timestamp)
     VALUES ('system', 'SYSTEM_INITIALIZED', 'platform', 'SUCCESS', ${now})`
  ));

  await db.run(sql.raw(
    `INSERT INTO audit_logs (actor, action, resource, result, timestamp)
     VALUES ('admin', 'USER_APPROVED', 'user:avery', 'SUCCESS', ${now - 86400})`
  ));

  await db.run(sql.raw(
    `INSERT INTO audit_logs (actor, action, resource, result, timestamp)
     VALUES ('admin', 'USER_APPROVED', 'user:lena', 'SUCCESS', ${now - 172800})`
  ));

  await db.run(sql.raw(
    `INSERT INTO audit_logs (actor, action, resource, result, timestamp)
     VALUES ('avery', 'USER_SUSPENDED', 'user:noah', 'SUCCESS', ${now - 259200})`
  ));

  logger.info("Database seeded with default tenant, admin and sample users.", { operation: "seedIfEmpty" });
}
