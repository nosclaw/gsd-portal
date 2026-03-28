# GSD Portal

HeroUI-powered Next.js portal for tenant approvals, workspace orchestration and GSD session continuity.

## Local development

```bash
bun install
bun run dev
```

The app runs on `http://localhost:3000` by default.

## Build

```bash
bun run build
bun run start
```

## Docker Compose

```bash
cd deploy
cp .env.example .env.local
docker compose --env-file .env.local -f compose.base.yml -f compose.local.yml up --build
docker compose --env-file .env.local -f compose.base.yml -f compose.local.yml down
```

The reverse-proxied portal is exposed on `http://localhost:29000`.

## Document map

- [PRD](./PRD.md)
- [Docs index](./docs/README.md)



## 账户 有，seed 脚本创建了以下测试账户：

  ┌────────────┬────────┬───────────┬──────────────────────────────────┐
  │    角色    │ 用户名 │   密码    │               状态               │
  ├────────────┼────────┼───────────┼──────────────────────────────────┤
  │ Root Admin │ admin  │ admin123  │ APPROVED (可直接登录)            │
  ├────────────┼────────┼───────────┼──────────────────────────────────┤
  │ Member     │ member │ member123 │ PENDING (需管理员审批后才能登录) │
  └────────────┴────────┴───────────┴──────────────────────────────────┘

  先用 admin / admin123 登录，然后可以在 Approvals 页面审批 member 账户。


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
