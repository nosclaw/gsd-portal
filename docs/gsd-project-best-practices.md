# GSD Team Automated Development Best Practices

Fully automated parallel development using multiple GSD Workspaces, driven by a single PRD document.

Applicable to all programming languages and project types.

---

## Core Philosophy

```
The only human inputs are PRD.md and the number of workspaces.
Built entirely on GSD native mechanisms — milestone system, parallel orchestrator, worktree isolation.
Each workspace runs /gsd auto and works fully autonomously.
```

---

## GSD Native Mechanisms Overview

This best practice is built entirely on GSD's existing native capabilities — no custom file formats or additional skills required.

| GSD Native Mechanism | How We Use It |
|---------------------|---------------|
| **Milestone system** | Phase 0 creates milestones via GSD's native discussion flow |
| **`{MID}-CONTEXT.md`** | Auto-generated: goals, acceptance criteria, constraints |
| **`{MID}-ROADMAP.md`** | Auto-generated: slice list and execution plan |
| **`{SID}-PLAN.md`** | Auto-generated: task breakdown per slice |
| **Parallel orchestrator** | `parallel.enabled: true` for multi-worker parallel dev |
| **Worktree isolation** | Each worker runs in an isolated worktree |
| **`GSD_MILESTONE_LOCK`** | Each worker locked to one milestone |
| **`custom_instructions`** | Append mode — does not override system defaults |
| **`.gsd/KNOWLEDGE.md`** | Project knowledge auto-injected into every agent prompt |
| **`pre_dispatch_hooks`** | Inject instructions before task execution |
| **`post_unit_hooks`** | Trigger checks after task completion (e.g., dependency detection) |

### GSD Native Milestone Lifecycle

```
Discussion → CONTEXT-DRAFT.md
           → {MID}-CONTEXT.md (goals, acceptance criteria, constraints)
           → {MID}-RESEARCH.md (optional, skippable)
           → {MID}-ROADMAP.md (slice list + execution plan)
           → Per slice:
               → {SID}-RESEARCH.md (optional)
               → {SID}-PLAN.md (task list)
               → tasks/T01-PLAN.md, T02-PLAN.md... (concrete tasks)
               → Execution → T01-SUMMARY.md...
               → {SID}-SUMMARY.md
           → {MID}-VALIDATION.md
           → {MID}-SUMMARY.md
```

All files are auto-managed in `~/.gsd/projects/{hash}/milestones/M00N/`.
**Do not** create custom milestone files in the project root.

---

## Workspace (WS)

A WS is a fully isolated development environment in GSD Portal:

```
┌─────────────────────────────────────┐
│           GSD Workspace (WS)         │
│                                     │
│  • /home/{username}/                │
│  • Independent Provider API Key     │
│  • Independent GSD Agent instance   │
│  • Independent ~/.gsd/projects/     │
│                                     │
│  After /gsd auto, autonomously:     │
│  • GSD native milestone flow        │
│  • Codes in worktree                │
│  • Tests → commit → push → PR      │
└─────────────────────────────────────┘
```

---

## Roles

| Role | Count | Responsibility |
|------|-------|---------------|
| **Project Lead** | 1 human | Provide PRD.md, confirm planning output, final release |
| **Planning WS** | 1 | Phase 0: tech selection, generate config, create milestones via GSD discussion flow |
| **Tech Manager WS** | 1 | PR review, conflict resolution, merge to main, acceptance |
| **Dev WS 1~N** | N | Each locked to one milestone (`GSD_MILESTONE_LOCK`) |

> Total: N+1 workspaces. Planning WS can reuse Dev WS1.

---

## Configuration

### Project-level `.gsd/PREFERENCES.md` (shared by all WSs)

```yaml
mode: auto
always_use_skills:
  - standards
  - review
  - test
parallel:
  enabled: true
  max_workers: 3                    # = dev WS count
  merge_strategy: per-milestone
  auto_merge: confirm
git:
  worktree: true
  branch_protection: main
  merge_method: pr_only
  auto_push: true
  auto_pr: true
phases:
  skip_research: true               # Skip research phase for speed
  reassess_after_slice: true        # Reassess roadmap after each slice
custom_instructions:
  - All code must be real business logic — no mock/stub
  - Follow engineering standards from ~/.gsd/standards/
```

### Project-level `.gsd/KNOWLEDGE.md` (auto-injected into every prompt)

```markdown
# Project Knowledge

## Tech Stack
- Language: TypeScript
- Runtime: Bun
- Framework: Next.js 15
- Database: PostgreSQL + Drizzle ORM
- Package manager: bun

## Module Boundaries
- Each milestone maps to an independent directory: src/modules/{module-name}/
- Shared code lives in src/shared/
- No cross-module direct file modifications
- Inter-module interaction through src/shared/ interface contracts

## Coding Constraints
- API response format: { data, error: { code, message } }
- Database operations use transactions for multi-table writes
- All API routes require unit tests
```

### Workspace-level `~/.gsd/preferences.md` (injected by Portal orchestrator)

Tech Manager WS:
```yaml
custom_instructions:
  - You are the Tech Manager, do not write business code
  - Continuously monitor all open PRs
  - Review code quality then merge to main
  - Verify against PRD.md acceptance criteria item by item
```

Dev WSs:
```yaml
custom_instructions:
  - Read PLAN.md, you are WS2
  - You are responsible for M2 Payment module
  - Work on feat/payment-module branch
  - Depends on M0 — do not start coding until M0 is merged to main
```

---

## Workspace Bootstrap

New workspaces start completely empty. A critical fact:

> **GSD milestone files are local.** `~/.gsd/projects/{hash}/milestones/` only exists in the WS that created it. It does not transfer via Git.

Therefore, each WS creates its own milestones through GSD's native discussion flow. The Planning WS's output is shared via Git repo files (PREFERENCES.md, KNOWLEDGE.md, PLAN.md) that guide other WSs to quickly align.

### Complete Bootstrap Chain

```
Phase 0 Planning WS output (committed to Git):
─────────────────────────────────────────
project/
├── PRD.md                              # Original requirements
├── PLAN.md                             # Milestone split + WS assignments (new)
├── .gsd/
│   ├── PREFERENCES.md                  # Project config (parallel, git, skills)
│   └── KNOWLEDGE.md                    # Tech stack, module boundaries, constraints
└── src/                                # M0 dep layer code (skeleton / shared types)
```

### PLAN.md — Team Work Blueprint

This is the **core shared file** from the Planning WS, committed in the Git repo. Each new WS reads this to understand its assignment:

```markdown
# Project Execution Plan

## WS Assignments

### Tech Manager WS
- Role: Tech Manager, does not write business code
- Responsibilities: PR review, conflict resolution, merge to main, acceptance

### WS1 → M0 Project Foundation (Phase 2a, complete first)
- Branch: feat/foundation
- Goal: Project init, shared types, DB schema, base components, auth middleware
- Acceptance Criteria:
  - src/shared/ contains complete type definitions and utilities
  - DB migrations run successfully
  - Base API framework is runnable

### WS1 → M1 User Management (Phase 2b, parallel after M0)
- Branch: feat/user-module
- Goal: Registration/login, user list, editing, permissions
- Depends on: M0
- Acceptance Criteria:
  - Complete CRUD API
  - Permissions enforced
  - Test coverage

### WS2 → M2 Payment (Phase 2b, parallel after M0)
- Branch: feat/payment-module
- Goal: Orders, payment integration, billing
- Depends on: M0
- Acceptance Criteria:
  - Complete order creation and payment flow
  - Test coverage

### WS3 → M3 Admin Panel (Phase 2b, starts after M1 merges)
- Branch: feat/admin-module
- Goal: Reports, settings, audit
- Depends on: M0, M1
- Acceptance Criteria:
  - Accurate report data
  - Complete audit log
  - Test coverage
```

### Each WS Bootstrap Steps

```
┌────────────────────────────────────────────────────────┐
│ Portal orchestrator (when creating WS):                │
│                                                        │
│  1. Create workspace /home/{username}/                 │
│  2. Configure .gsd/agent/auth.json (Provider API Key)  │
│  3. Clone Git repo into workspace                      │
│  4. Write workspace-level ~/.gsd/preferences.md:       │
│     ┌──────────────────────────────────────────┐       │
│     │ custom_instructions:                      │       │
│     │   - Read PLAN.md, you are WS2             │       │
│     │   - You are responsible for M2 Payment    │       │
│     │   - Work on feat/payment-module branch    │       │
│     │   - Depends on M0, don't start until      │       │
│     │     M0 is merged to main                  │       │
│     └──────────────────────────────────────────┘       │
│  5. Launch /gsd auto                                   │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ GSD Agent autonomously:                                │
│                                                        │
│  1. Read .gsd/PREFERENCES.md + .gsd/KNOWLEDGE.md       │
│  2. Read ~/.gsd/preferences.md (workspace-level)       │
│  3. Read PLAN.md, find assignment (WS2 → M2)           │
│  4. Read PRD.md sections relevant to M2                │
│  5. Enter GSD discussion flow, create own milestone:   │
│     → M001-CONTEXT.md (based on M2 definition)        │
│     → M001-ROADMAP.md (slice breakdown)                │
│  6. Check dependency: is M0 merged to main?            │
│     → No: wait (Git polling or Mailbox)                │
│     → Yes: git checkout feat/payment-module            │
│  7. Execute: Slice → Task → code → test → commit      │
│  8. All done → create PR to main                       │
└────────────────────────────────────────────────────────┘
```

### Tech Manager WS Bootstrap

```
Portal orchestrator writes workspace-level preferences:
  custom_instructions:
    - Read PLAN.md, you are the Tech Manager
    - Do not write business code
    - Continuously monitor all open PRs
    - Review code quality then merge to main
    - Verify against PLAN.md acceptance criteria
    - Merge in dependency order: M0 → M1/M2 → M3

GSD Agent after startup:
  1. Reads PLAN.md, understands all milestones and dependencies
  2. Enters continuous monitoring loop
  3. Does not create its own milestones — only reviews and merges
```

---

## Automated Flow

```
            PRD.md + WS count N
                    │
        ┌───────────▼───────────┐
        │  Planning WS          │
        │  /gsd auto            │
        │                       │
        │  GSD native flow:     │
        │  • Tech selection     │
        │  • PREFERENCES.md     │
        │  • KNOWLEDGE.md       │
        │  • N+1 milestones:    │
        │    M0 dep layer       │
        │    M1~MN parallel     │
        │  • Git initialization │
        │  • WS assignment table│
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │  Project Lead confirms │
        └───────────┬───────────┘
                    │
  ┌─────────────────┼──────────────────┐
  ▼                                    ▼
┌──────────┐                 ┌──────────────────┐
│ WS1      │                 │ Tech Manager WS  │
│ /gsd auto│                 │ /gsd auto        │
│ LOCK=M0  │                 │                  │
│          │                 │ Continuous:      │
│ M0 → PR  │──── PR ───────▶│ Review → Merge   │
└────┬─────┘                 │                  │
     │ After M0 merges       │                  │
┌────┼────┐                  │                  │
▼    ▼    ▼                  │                  │
WS1  WS2  WSN                │                  │
LOCK LOCK LOCK               │                  │
=M1  =M2  =MN               │                  │
/gsd /gsd /gsd              │                  │
auto auto auto              │                  │
 │    │    │                  │                  │
 └PR──┴PR──┴──── PR ───────▶│ Review → Merge   │
                              │ Resolve conflicts│
                              │ Acceptance report│
                              └──────────────────┘
```

### Phase 0: Automated Planning

Uses GSD's native **discussion flow**. The Planning WS starts `/gsd auto` then:

1. GSD enters discussion phase, reads PRD.md
2. Performs tech stack selection
3. Generates and commits to Git repo:
   - `.gsd/PREFERENCES.md` — project config
   - `.gsd/KNOWLEDGE.md` — tech stack + module boundaries + constraints
   - `PLAN.md` — milestone split + WS assignments + acceptance criteria
   - M0 dependency layer code skeleton (src/shared/ etc.)
4. Creates Git branches (feat/foundation, feat/user-module...)

**Tech selection priorities:**

| Priority | Principle | Example |
|----------|-----------|---------|
| 1 | Latest and most popular | bun > pnpm > npm |
| 2 | Higher performance | Bun > Node.js |
| 3 | Better developer experience | Next.js > CRA |
| 4 | Type-safe | TypeScript > JavaScript |
| 5 | Follow PRD when explicit | PRD requires Python → Python |

### Slice Assignment

In GSD's native milestone system, slices are defined in `{MID}-ROADMAP.md`. Within a single WS, GSD executes slices sequentially (or in parallel via `reactive_execution`).

For assigning slices to different WSs: GSD does not natively support cross-agent slice assignment. **The recommended approach: promote slices that need parallel development into independent milestones**, then lock each WS to a different milestone.

---

## Progress Reporting & Dependency Coordination

All WSs report to Tech Manager at **start, progress updates, and completion**. Cross-machine WSs communicate in real-time via Portal WebSocket Hub.

For the full design, see **[Portal Messenger Design Document](./portal-messenger-design.md)**.

### Core Architecture

```
  WS1 ──┐               ┌── Tech Manager WS
  WS2 ──┤── WebSocket ──┤
  WS3 ──┘  (cross-machine) └── Dashboard
                │
         GSD Portal
         WebSocket Hub
```

Portal is already the central hub for all WSs — the natural message router. No peer mesh or standalone service needed.

### GSD Extension: portal-messenger

Auto-installed in each WS, connects to Portal via WebSocket, provides 3 tools:

| Tool | Purpose |
|------|---------|
| `portal_send` | Send message to specific WS or Tech Manager |
| `portal_wait` | Non-blocking wait (auto-notified via WebSocket) |
| `portal_report_progress` | Report progress (started → slice done → PR created) |

### Message Types

| Type | Direction | Trigger |
|------|-----------|---------|
| `PROGRESS` | Dev WS → Tech Manager | Start, Slice complete, PR created |
| `DEPENDENCY_READY` | Tech Manager → Waiting WS | Upstream milestone merged |
| `REVIEW_REQUEST` | Dev WS → Tech Manager | PR created |
| `REVIEW_FEEDBACK` | Tech Manager → Dev WS | PR has change requests |
| `MILESTONE_COMPLETE` | Tech Manager → broadcast | Acceptance passed |
| `QUESTION` | Any WS → Tech Manager | Needs coordination |

### Progress Reporting Rules

Declared in `.gsd/KNOWLEDGE.md`:

```markdown
## Progress Reporting
All WSs must call portal_report_progress at these points:
- When starting work (status: "started")
- When each Slice completes (status: "S1.2 done", progress: 50)
- When PR is created (status: "PR created", progress: 100)
- When review fixes are applied (status: "review fixes applied")
```

---

## Dependency-Aware Splitting

```
            ┌─────────────┐
            │  M0 Dep Layer│
            │  WS1         │
            └──────┬──────┘
                   │ PR + portal_report_progress
                   ▼
            ┌─────────────┐
            │ Tech Manager│  Merge M0 → portal_send(DEPENDENCY_READY)
            │ WS          │           → broadcast to all waiting WSs
            └──────┬──────┘
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 Users │ │ M2 Pay   │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ portal_send             │
     │ (DEPENDENCY_READY)      │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 Admin │  ← Real-time WebSocket notification
                         │ WS3      │
                         └──────────┘
```

**Splitting rules:**
- Shared dependencies → M0 (types, schema, base components, middleware)
- Parallel module count = WS count N
- If slices within a milestone need different WSs → promote to independent milestones
- Each module has its own directory — no cross-module edits
- M0 defines interface contracts

---

## Applicability

| Project Type | M0 Dependency Layer | Parallel Split Strategy |
|-------------|---------------------|----------------------|
| Web Frontend | Routing, shared components, API client | By page/feature module |
| Web Backend | DB schema, middleware, utilities | By domain/service |
| Full-Stack | Monorepo, shared types, API schema | Vertical slices or layer separation |
| Mobile | Navigation, design system, network layer | By feature module |
| Desktop | Window framework, IPC | By feature module |
| CLI / Library | Core interfaces, config system | By subcommand/module |
| Microservices | Proto/schema, CI templates | Natural service boundaries |
| Data Engineering | Pipeline framework | By pipeline stage |
| Infrastructure | Provider configs | By resource group/environment |

---

## Quick Reference

```
1. Project Lead → PRD.md + WS count N
2. Planning WS → /gsd auto:
   • Tech selection → .gsd/PREFERENCES.md + .gsd/KNOWLEDGE.md
   • Milestone split + WS assignments → PLAN.md
   • M0 code skeleton + Git branches
   • All committed to Git repo
3. Project Lead → confirm PLAN.md
4. Portal orchestrator → create N+1 WSs:
   • Clone repo + write WS-level preferences (WS number + assignment) + /gsd auto
5. Each dev WS automatically:
   • Read PLAN.md → GSD discussion flow creates own milestone → check deps → code → PR
6. Tech Manager WS automatically:
   • Monitor PRs → review → merge → acceptance report
7. Project Lead → confirm → release
```
