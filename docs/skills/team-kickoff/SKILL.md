---
name: team-kickoff
description: "Automated team project initialization from PRD. Reads PRD.md, performs tech selection (preferring latest/hottest tech like bun over npm), generates PREFERENCES.md with git worktree mode, splits work into dependency-aware milestones (M0~MN) and slices (S0.1~SN.x) with CONTEXT.md per milestone, assigns each milestone to a GSD Workspace (development unit = isolated env with own API key + Agent + human supervisor), sets up Git branches with main protection. Use when starting a new team project, initializing from PRD, or setting up multi-developer parallel workflows."
metadata:
  author: nosclaw
  version: "3.0.0"
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
- Number of development units N (each unit = 1 GSD Workspace with its own API key)

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

Split requirements into modules based on N development units.

**Concepts:**
- **Development Unit** = 1 GSD Workspace (isolated environment with its own Provider API Key, home directory, and GSD Agent instance, supervised by a human developer)
- **Milestone (M)** = A major module assigned to one development unit
- **Slice (S)** = A discrete task within a milestone, with implementation scope, acceptance criteria, and dependencies

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

### Step 5: Generate Milestone CONTEXT.md

For each milestone, generate a `CONTEXT.md` in `~/.gsd/projects/{hash}/milestones/M00N/`:

```markdown
# M1 — [Module Name]

## Assignment
- Development Unit: Workspace [N]
- GSD Agent: Agent [N]
- Human Supervisor: Developer [letter]
- Branch: feat/[module-name]

## Objective
[Requirements summary for this module, extracted from PRD.md]

## Slice List

### S1.1 [Slice Title]
- Implementation: [what to build — APIs, pages, components]
- Acceptance Criteria:
  - [criterion 1]
  - [criterion 2]
- Dependencies: [which M0 components this depends on]

### S1.2 [Slice Title]
...

## Module Boundaries
- This module only modifies files under [specific directory]
- Uses M0 shared types and components without modifying them
- Interacts with other modules through M0 interface contracts

## Technical Constraints
- Follow all rules in PREFERENCES.md
- Use M0 API response format
- Database operations use M0 configured ORM
```

### Step 6: Output Assignment Table

Output the complete assignment table:

```
=== Milestone & Development Unit Assignment Table ===

Tech Manager Workspace (GSD AI Agent, runs independently)
  Responsibilities: PR review, conflict resolution, merge, acceptance

─────────────────────────────────────────────────────
  Dependency Layer (Phase 2a — must complete first)
─────────────────────────────────────────────────────

  Workspace 1 → Milestone M0 ([description])
    GSD Agent: Agent 1
    Human Supervisor: Developer [letter]
    Branch: feat/foundation
    Slices:
      S0.1 [task]
      S0.2 [task]
      ...

─────────────────────────────────────────────────────
  Parallel Layer (Phase 2b — all start after M0 merges)
─────────────────────────────────────────────────────

  Workspace 1 → Milestone M1 ([description])
    GSD Agent: Agent 1
    Human Supervisor: Developer [letter]
    Branch: feat/[module]
    Slices:
      S1.1 [task]
      S1.2 [task]

  Workspace 2 → Milestone M2 ([description])
    GSD Agent: Agent 2
    Human Supervisor: Developer [letter]
    Branch: feat/[module]
    Slices:
      S2.1 [task]
      S2.2 [task]
```

### Step 7: Git Setup

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

### Step 8: Output Summary

Present the complete plan to the user for review:

```
=== Team Kickoff Complete ===

Tech Stack: [summary with rationale]
Development Units: N (each = 1 GSD Workspace with isolated API key + Agent)
Total Workspaces: N+1 (N dev units + 1 Tech Manager)
Git Workflow: worktree mode, main protected, PR-only merge

[Assignment Table from Step 6]

Next Steps:
1. Project Lead: review and confirm this plan
2. Workspace 1: Dev A runs /gsd auto → Agent 1 completes M0 (dep layer) → PR
3. Tech Manager WS: /gsd auto → reviews and merges M0 to main
4. Workspace 1~N: All devs run /gsd auto → each Agent works on assigned milestone → PR
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
