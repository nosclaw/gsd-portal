---
name: team-kickoff
description: "Automated team project initialization from PRD. Reads PRD.md, performs tech selection, generates PREFERENCES.md, splits work into dependency-aware parallel modules based on developer count, sets up Git branches with main protection, and outputs a role assignment table. Use when starting a new team project, initializing from PRD, or setting up multi-developer parallel workflows."
metadata:
  author: nosclaw
  version: "1.0.0"
---

# Team Kickoff

Fully automated project initialization for multi-developer + multi-GSD-Agent team development.

## When to Use

- Starting a new project from a PRD document
- Setting up a multi-developer parallel development workflow
- Need to split work across N developers with dependency awareness
- Want to auto-generate PREFERENCES.md based on tech stack selection

## Input Requirements

Before invoking this skill, the project root must contain:
- `PRD.md` — Product requirements document

The user must specify:
- Number of human developers (N)

## Execution Flow

### Step 1: Analyze PRD

Read `PRD.md` thoroughly. Extract:
- Core product requirements and features
- Non-functional requirements (performance, security, scale)
- Acceptance criteria for each feature
- Any explicit tech preferences mentioned

### Step 2: Tech Stack Selection

Based on the PRD analysis, select the optimal tech stack:
- Programming language(s)
- Framework(s)
- Database(s)
- Deployment method
- Package manager
- Testing framework

Output a brief rationale for each choice. Consider:
- Requirements fit (real-time → WebSocket-capable frameworks, etc.)
- Ecosystem maturity and community support
- Team scalability
- Deployment constraints mentioned in PRD

### Step 3: Generate PREFERENCES.md

Write `PREFERENCES.md` to the project root with:

```markdown
# Project: [Name from PRD]

## Role
[Role description derived from project type]

## always_use_skills
[Selected based on tech stack — e.g., standards, 1k-code-quality]

## prefer_skills
[Selected based on tech stack — e.g., react-best-practices for React projects]

## skill_rules
[Conditional rules based on project type]

## custom_instructions
[Project-specific constraints derived from PRD]
```

Skill selection logic:
- React/Next.js → `react-best-practices`, `ui-ux-pro-max`
- React Native → `react-native-best-practices`, `react-native-skills`
- Vue/Nuxt → `ui-ux-pro-max`
- Python → `best-practices`
- Go/Rust/Java → `best-practices`
- Any web project → `standards`, `1k-code-quality`
- Any project → `review`, `test`

### Step 4: Dependency-Aware Task Splitting

Split requirements into modules based on N developers:

1. **Identify shared dependencies** — Code needed by multiple modules:
   - Type definitions / interfaces / contracts
   - Database schema / migrations
   - Base components / shared utilities
   - Authentication / middleware
   - API client / network layer
   - Configuration system

2. **Create dependency layer** (Phase 2a):
   - All shared dependencies go here
   - Assigned to Developer 1
   - Must complete and merge before parallel work begins

3. **Create parallel modules** (Phase 2b):
   - Split remaining features into exactly N independent modules
   - Each module has its own directory, routes, APIs
   - No cross-module code edits allowed
   - Assign one module per developer

4. **Handle complex dependencies**:
   - If Module A depends on Module B (not just shared layer), sequence them
   - Mark as Phase 2b-1 (first) and Phase 2b-2 (after)
   - Maximize parallelism: only sequence what truly requires it

### Step 5: Role Assignment

Define all roles for the project:

| Role | Type | Responsibility |
|------|------|---------------|
| Project Lead | Human | PRD, review Phase 0 output, final release |
| Tech Manager | GSD AI Agent | PR review, merge, conflicts, acceptance |
| Developer 1 | Human + GSD Agent | Dependency layer + Module A |
| Developer 2 | Human + GSD Agent | Module B |
| Developer N | Human + GSD Agent | Module N |

### Step 6: Git Setup

Initialize the Git repository for team collaboration:

1. Initialize repo (if not already)
2. Create initial commit with PRD.md and PREFERENCES.md
3. Configure main branch protection:
   - No direct push
   - Require PR for merge
   - Require review approval
4. Create feature branches:
   - `feat/foundation` (dependency layer)
   - `feat/{module-name}` (one per parallel module)

### Step 7: Output Summary

Present the complete plan to the user for review:

```
=== Team Kickoff Complete ===

Tech Stack: [summary]
Developers: N
Roles: [table]

Dependency Layer (Phase 2a):
  Developer 1 → feat/foundation → [task list]

Parallel Modules (Phase 2b):
  Developer 1 → feat/[module] → [task list]
  Developer 2 → feat/[module] → [task list]
  ...

Next Steps:
1. Review and confirm this plan
2. Developer 1: run /gsd auto to complete dependency layer
3. After merge: all developers run /gsd auto on their assigned modules
4. Tech Manager: run /gsd auto to monitor PRs and handle integration
```

## Splitting Examples by Project Type

**Web Frontend (React / Vue / Angular / Svelte / Next.js / Nuxt):**
```
Dependency: Project init, routing, shared components, API client, state skeleton
Parallel:   By page/feature module (users, orders, settings, reports...)
```

**Backend Services (Node.js / Python / Go / Rust / Java / C#):**
```
Dependency: Project init, DB schema, middleware, shared utilities
Parallel:   By domain/service (auth, billing, notification, analytics...)
```

**Mobile Apps (React Native / Flutter / Swift / Kotlin):**
```
Dependency: Project init, navigation, design system, network layer
Parallel:   By feature module (home, profile, messaging, search...)
```

**Full-Stack Projects:**
```
Dependency: Monorepo init, shared types, database, API schema
Parallel:   Frontend + Backend + Infrastructure (or vertical slices)
```

**CLI / Libraries:**
```
Dependency: Project init, core interfaces, config system
Parallel:   By subcommand/module
```

**Microservices:**
```
Dependency: Shared proto/schema definitions, CI templates, deploy configs
Parallel:   Each service is naturally independent
```

**Data Engineering (Python / Scala / SQL):**
```
Dependency: Pipeline framework, shared connectors, schema registry
Parallel:   By pipeline/ETL stage
```

**Infrastructure (Terraform / Pulumi / Docker):**
```
Dependency: Provider configs, shared modules, networking
Parallel:   By resource group/environment
```
