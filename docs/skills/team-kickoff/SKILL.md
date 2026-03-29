---
name: team-kickoff
description: "Automated team project initialization from PRD. Reads PRD.md, performs tech selection (preferring latest/hottest tech), generates PREFERENCES.md with git worktree mode, splits work into dependency-aware parallel modules based on human developer count, assigns milestones and slices to each development unit (human + agent pair), sets up Git branches with main protection, and outputs a role assignment table. Use when starting a new team project, initializing from PRD, or setting up multi-developer parallel workflows."
metadata:
  author: nosclaw
  version: "2.0.0"
---

# Team Kickoff

Fully automated project initialization for multi-developer + multi-GSD-Agent team development.

## When to Use

- Starting a new project from a PRD document
- Setting up a multi-developer parallel development workflow
- Need to split work across N human developers with dependency awareness

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

Select the optimal tech stack following these priorities:

| Priority | Principle | Example |
|----------|-----------|---------|
| 1 | **Prefer latest, most popular tech** | bun > pnpm > yarn > npm |
| 2 | **Choose higher performance** | Bun runtime > Node.js (when compatible) |
| 3 | **Choose better developer experience** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **Choose type-safe options** | TypeScript > JavaScript, Rust > C |
| 5 | **Follow PRD when explicitly specified** | PRD requires Python → use Python |

Select for each category:
- Programming language(s)
- Framework(s)
- Database(s)
- Package manager (prefer bun, then pnpm)
- Testing framework
- Deployment method

Output a brief rationale for each choice.

### Step 3: Generate PREFERENCES.md

Write `PREFERENCES.md` to the project root. Must include `git_workflow` section:

```markdown
# Project: [Name from PRD]

## Role
[Role description derived from project type]

## always_use_skills
[Selected based on tech stack]

## prefer_skills
[Selected based on tech stack]

## skill_rules
[Conditional rules based on project type]

## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true

## custom_instructions
[Project-specific constraints derived from PRD]
- All code must be real business logic — no mock/stub/dummy implementations
- Follow engineering standards from ~/.gsd/standards/
```

**Skill selection logic:**
- React/Next.js → `react-best-practices`, `ui-ux-pro-max`
- React Native → `react-native-best-practices`, `react-native-skills`
- Vue/Nuxt → `ui-ux-pro-max`
- Python → `best-practices`
- Go/Rust/Java → `best-practices`
- Any web project → `standards`, `1k-code-quality`
- Any project → `review`, `test`

### Step 4: Dependency-Aware Task Splitting

Split requirements into modules based on N human developers.

**Concepts:**
- **Development Unit** = 1 human developer + 1 GSD AI Agent (they share a machine)
- **Milestone (M)** = A major module assigned to one development unit
- **Slice (S)** = A discrete task within a milestone

**Splitting process:**

1. **Identify shared dependencies** — Code needed by multiple modules:
   - Type definitions / interfaces / contracts
   - Database schema / migrations
   - Base components / shared utilities
   - Authentication / middleware
   - API client / network layer
   - Configuration system

2. **Create dependency layer** (M0, Phase 2a):
   - All shared dependencies go here
   - Assigned to Development Unit 1
   - Must complete and merge before parallel work begins
   - Split into slices: S0.1, S0.2, S0.3...

3. **Create parallel modules** (M1~MN, Phase 2b):
   - Split remaining features into exactly N independent milestones
   - Each milestone has its own directory, routes, APIs
   - No cross-module code edits allowed
   - Assign one milestone per development unit
   - Each milestone split into slices: S1.1, S1.2... / S2.1, S2.2...

4. **Handle complex dependencies**:
   - If Module A depends on Module B (not just shared layer), sequence them
   - Mark as Phase 2b-1 (first) and Phase 2b-2 (after)
   - Maximize parallelism: only sequence what truly requires it

### Step 5: Role Assignment Table

Output a structured role assignment table with explicit milestone and slice assignments:

```
=== Role Assignment Table ===

Tech Manager (GSD AI Agent, runs independently)
  └─ Responsibilities: PR review, conflict resolution, merge, acceptance

Dependency Layer Phase 2a (must complete first):
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 1                                             │
  │   Human Developer: [name/letter]                               │
  │   GSD Agent: Agent [name/letter]                               │
  │   Branch: feat/foundation                                      │
  │   Milestone: M0 — [description]                                │
  │   Slices:                                                      │
  │     S0.1 [task description]                                    │
  │     S0.2 [task description]                                    │
  │     ...                                                        │
  └────────────────────────────────────────────────────────────────┘

Parallel Layer Phase 2b (all start after M0 merges):
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 1                                             │
  │   Human Developer: [name/letter]                               │
  │   GSD Agent: Agent [name/letter]                               │
  │   Branch: feat/[module-name]                                   │
  │   Milestone: M1 — [description]                                │
  │   Slices:                                                      │
  │     S1.1 [task description]                                    │
  │     S1.2 [task description]                                    │
  │     ...                                                        │
  └────────────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 2                                             │
  │   ...                                                          │
  └────────────────────────────────────────────────────────────────┘
```

### Step 6: Git Setup

Initialize the Git repository for team collaboration:

1. Initialize repo (if not already)
2. Create initial commit with PRD.md and PREFERENCES.md
3. Configure main branch protection:
   - No direct push
   - Require PR for merge
   - Require review approval
   - No force push
4. Create feature branches:
   - `feat/foundation` (dependency layer)
   - `feat/{module-name}` (one per parallel module)

### Step 7: Output Summary

Present the complete plan to the user for review:

```
=== Team Kickoff Complete ===

Tech Stack: [summary with rationale]
Human Developers: N
Development Units: N (each = 1 human + 1 GSD Agent)
Git Workflow: worktree mode, main protected, PR-only merge

[Role Assignment Table from Step 5]

Next Steps:
1. Project Lead: review and confirm this plan
2. Machine A: Human Dev A runs /gsd auto → Agent A completes M0 (dep layer) → PR
3. Tech Manager: /gsd auto → reviews and merges M0 to main
4. Machine A~N: All Human Devs run /gsd auto → each Agent works on assigned milestone → PR
5. Tech Manager: reviews each PR → resolves conflicts → merges → acceptance report
```

## Splitting Examples by Project Type

**Web Frontend (React / Vue / Angular / Svelte / Next.js / Nuxt):**
```
M0 Dependency: Project init, routing, shared components, API client, state skeleton
M1~MN Parallel: By page/feature module (users, orders, settings, reports...)
```

**Backend Services (Node.js / Python / Go / Rust / Java / C#):**
```
M0 Dependency: Project init, DB schema, middleware, shared utilities
M1~MN Parallel: By domain/service (auth, billing, notification, analytics...)
```

**Mobile Apps (React Native / Flutter / Swift / Kotlin):**
```
M0 Dependency: Project init, navigation, design system, network layer
M1~MN Parallel: By feature module (home, profile, messaging, search...)
```

**Full-Stack Projects:**
```
M0 Dependency: Monorepo init, shared types, database, API schema
M1~MN Parallel: Frontend + Backend + Infrastructure (or vertical slices)
```

**CLI / Libraries:**
```
M0 Dependency: Project init, core interfaces, config system
M1~MN Parallel: By subcommand/module
```

**Microservices:**
```
M0 Dependency: Shared proto/schema definitions, CI templates, deploy configs
M1~MN Parallel: Each service is naturally independent
```

**Data Engineering (Python / Scala / SQL):**
```
M0 Dependency: Pipeline framework, shared connectors, schema registry
M1~MN Parallel: By pipeline/ETL stage
```

**Infrastructure (Terraform / Pulumi / Docker):**
```
M0 Dependency: Provider configs, shared modules, networking
M1~MN Parallel: By resource group/environment
```
