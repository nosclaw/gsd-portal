# GSD Team Automated Development Best Practices

Fully automated parallel development using multiple human developers + multiple GSD AI Agent teams, driven by a single PRD document.

Applicable to all programming languages and project types.

---

## Core Philosophy

```
The only human inputs are PRD.md and the number of development units.
Everything else — tech selection, task splitting, Git setup, coding,
committing, collaboration, merging — is fully automated.
```

---

## Role Definitions

### Development Unit

A **development unit** = one **GSD Workspace** (isolated working environment).

Each Workspace is fully isolated:
- Independent home directory (`/home/{username}/`)
- Independent Provider API Key (e.g., OpenRouter API Key)
- Independent GSD Agent instance
- Supervised by one human developer

```
┌─────────────────────────────────────────┐
│          GSD Workspace                   │
│          (one development unit)          │
│                                         │
│  Isolated environment:                  │
│  • /home/{username}/                     │
│  • Independent OpenRouter API Key        │
│  • Independent GSD Agent instance        │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │        GSD AI Agent               │  │
│  │                                   │  │
│  │  • Auto-code in Git Worktree     │  │
│  │  • Run tests                      │  │
│  │  • commit + push                  │  │
│  │  • Create PR                      │  │
│  │  • Auto-fix per review feedback   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Supervisor: Human Developer A          │
│  • Launch /gsd auto                     │
│  • Observe progress, intervene if needed│
└─────────────────────────────────────────┘
```

### Role Overview

| Role | Identity | Count | Responsibility |
|------|----------|-------|---------------|
| **Project Lead** | Human | 1 | Provide PRD.md, confirm Phase 0 output, final release decision |
| **Tech Manager** | GSD AI Agent (dedicated Workspace) | 1 | PR review, conflict resolution, merge to main, acceptance |
| **Development Unit** | GSD Workspace (Agent + human supervisor) | N | Each unit owns one milestone end-to-end |

> **Total Workspaces needed: N+1** — N for development units, 1 for Tech Manager.

### Tech Manager

A dedicated GSD Workspace running an integration-only Agent that **does not write business code**.
Defined by the [`tech-manager` skill](./skills/tech-manager/SKILL.md):
- Continuously monitors all open PRs
- Reviews code quality, security, and standards compliance
- Resolves merge conflicts, preserving intent from both sides
- Merges to the protected main branch
- Verifies against PRD.md acceptance criteria item by item
- Outputs acceptance report after all modules merge

---

## Git Worktree Mode

All development units **must** use Git Worktree mode. Declared in `PREFERENCES.md`:

```markdown
## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true
```

When a GSD Agent starts via `/gsd auto`, it automatically:
1. Creates a Git Worktree from the main repo (isolated working directory)
2. Works on the assigned feature branch
3. Does not affect the main branch or other Workspaces' worktrees
4. Creates PR when done — never merges directly

---

## Automated Flow

```
                   PRD.md + Development unit count N
                           │
               ┌───────────▼───────────┐
               │    /team-kickoff      │  ← GSD Skill (auto)
               │                       │
               │  • Tech selection     │
               │    (latest tech)      │
               │  • Generate PREFS.md  │
               │  • Milestone + Slice  │
               │    breakdown          │
               │  • Unit assignment    │
               │  • Git worktree cfg   │
               └───────────┬───────────┘
                            │
               ┌───────────▼───────────┐
               │  Project Lead reviews  │  ← Only human checkpoint
               └───────────┬───────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                                     ▼
┌──────────────────┐                 ┌───────────────────┐
│  Workspace 1     │                 │  Tech Manager     │
│  (Dev Unit 1)    │                 │  Workspace        │
│  Agent 1         │                 │  /gsd auto        │
│  /gsd auto       │                 │                   │
│                  │                 │  Continuous:      │
│  M0 dep layer    │                 │                   │
│  → PR            │──── PR ───────▶│  Review → Merge   │
└────────┬─────────┘                 │                   │
         │ After M0 merges           │                   │
┌────────┼────────┐                  │                   │
▼        ▼        ▼                  │                   │
WS 1    WS 2    WS N                │                   │
Agent1  Agent2  AgentN               │                   │
/gsd    /gsd    /gsd                │                   │
auto    auto    auto                │                   │
  │       │       │                  │                   │
  └─ PR ──┴─ PR ──┴──── PR ───────▶│  Review → Merge   │
                                     │  Resolve conflicts│
                                     │  Acceptance report│
                                     └───────────────────┘
```

---

## Milestone & Slice Auto-Breakdown

The `/team-kickoff` skill auto-generates the complete milestone and slice structure during Phase 0.

### Generated Artifacts

For each milestone, the following is auto-generated:

```
~/.gsd/projects/{hash}/milestones/
├── M000/                              # Dependency layer
│   ├── CONTEXT.md                     # Milestone context, goals, acceptance criteria
│   └── DECISIONS.md                   # Technical decisions log
├── M001/                              # Parallel module 1
│   ├── CONTEXT.md
│   └── DECISIONS.md
├── M002/                              # Parallel module 2
│   ├── CONTEXT.md
│   └── DECISIONS.md
└── M003/                              # Parallel module 3
    ├── CONTEXT.md
    └── DECISIONS.md
```

### CONTEXT.md Structure

Each milestone's CONTEXT.md contains everything the Agent needs for autonomous development:

```markdown
# M1 — User Management Module

## Assignment
- Development Unit: Workspace 1
- GSD Agent: Agent 1
- Human Supervisor: Developer A
- Branch: feat/user-module

## Objective
Requirements summary for this module, extracted from PRD.md.

## Slice List

### S1.1 User Registration / Login API
- Implementation: POST /api/auth/register, POST /api/auth/login
- Acceptance Criteria:
  - Registration returns 201 + user ID
  - Passwords hashed with bcrypt
  - Login returns JWT token
- Dependencies: M0 auth middleware and user type definitions

### S1.2 User List Page + Search/Filter
- Implementation: GET /api/users (paginated), frontend list page
- Acceptance Criteria:
  - Search by username, email
  - Pagination params: page, perPage
  - Response format: { data: [], total, page, perPage }
- Dependencies: M0 shared table component and API client

### S1.3 User Detail Editing + Permissions
- Implementation: PUT /api/users/:id, frontend edit form
- Acceptance Criteria:
  - Only ADMIN role can edit other users
  - Edit returns 200 + updated user
  - Form validation: required fields, email format
- Dependencies: M0 permission check utilities

### S1.4 Tests
- Implementation: Unit tests + integration tests
- Acceptance Criteria:
  - 100% API route coverage
  - Permission boundary tests (non-ADMIN attempt)

## Module Boundaries
- This module only modifies files under src/modules/user/
- Uses M0 shared types and components without modifying them
- Interacts with other modules through M0 interface contracts

## Technical Constraints
- Follow all rules in PREFERENCES.md
- Use M0 API response format
- Database operations use M0 configured ORM
```

### Full Assignment Table Example (3 Development Units)

```
=== Milestone & Development Unit Assignment Table ===

Tech Manager Workspace (GSD AI Agent, runs independently)
  Responsibilities: PR review, conflict resolution, merge, acceptance
  Branch: operates on main

─────────────────────────────────────────────────────
  Dependency Layer (Phase 2a — must complete first)
─────────────────────────────────────────────────────

  Workspace 1 → Milestone M0 (Project Foundation)
    GSD Agent: Agent 1
    Human Supervisor: Developer A
    Branch: feat/foundation
    Slices:
      S0.1 Project init + toolchain config
      S0.2 Shared type definitions + DB schema + migrations
      S0.3 Base component library + shared utilities
      S0.4 Auth middleware + API client + error handling
      S0.5 CI config + lint + test framework

─────────────────────────────────────────────────────
  Parallel Layer (Phase 2b — all start after M0 merges)
─────────────────────────────────────────────────────

  Workspace 1 → Milestone M1 (User Management)
    GSD Agent: Agent 1
    Human Supervisor: Developer A
    Branch: feat/user-module
    Slices:
      S1.1 User registration / login API
      S1.2 User list page + search/filter
      S1.3 User detail editing + permissions
      S1.4 Unit tests + integration tests

  Workspace 2 → Milestone M2 (Payment)
    GSD Agent: Agent 2
    Human Supervisor: Developer B
    Branch: feat/payment-module
    Slices:
      S2.1 Order creation API + data model
      S2.2 Payment gateway integration (Stripe / Alipay)
      S2.3 Billing management pages + refund flow
      S2.4 Unit tests + integration tests

  Workspace 3 → Milestone M3 (Admin Panel)
    GSD Agent: Agent 3
    Human Supervisor: Developer C
    Branch: feat/admin-module
    Slices:
      S3.1 Report API + chart visualizations
      S3.2 System settings page
      S3.3 Audit log + activity records
      S3.4 Unit tests + integration tests
```

---

## Dependency-Aware Splitting Rules

```
                  ┌────────────────────────┐
                  │  M0 Dependency Layer    │    ← Must complete first
                  │  Workspace 1            │
                  │  Agent 1 + Dev A        │
                  └──────────┬─────────────┘
                             │ PR → Tech Manager merges to main
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │ M1 Users    │  │ M2 Payment  │  │ M3 Admin    │  ← All parallel
   │ WS 1        │  │ WS 2        │  │ WS 3        │
   │ Agent1+DevA │  │ Agent2+DevB │  │ Agent3+DevC │
   └─────────────┘  └─────────────┘  └─────────────┘
```

**Splitting rules:**
- Code depended on by multiple modules → M0 dependency layer (types, schema, base components, middleware)
- Parallel module count = development unit count N, maximizing parallelism
- Each module maps to a milestone (M1, M2, M3...), each milestone splits into slices (S1.1, S1.2...)
- Each slice includes: implementation scope, acceptance criteria, dependencies
- Each module has its own directory — no cross-module edits
- M0 defines interface contracts; each module implements per contract

### Multi-Level Dependencies

When parallel modules depend on each other:

```
M0 dependency layer → complete first
  │
  ├── M1 (no deps)              ← Phase 2b-1, start immediately
  ├── M2 (no deps)              ← Phase 2b-1, start immediately
  └── M3 (depends on M1 user API) ← Phase 2b-2, start after M1 merges
```

Tech Manager monitors dependency status — notifies Workspace 3 to start M3 after M1's PR merges.

---

## Tech Selection Principles

| Priority | Principle | Example |
|----------|-----------|---------|
| 1 | **Prefer latest, most popular tech** | bun > pnpm > yarn > npm |
| 2 | **Choose higher performance** | Bun runtime > Node.js (when compatible) |
| 3 | **Choose better developer experience** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **Choose type-safe options** | TypeScript > JavaScript, Rust > C |
| 5 | **Follow PRD when explicitly specified** | PRD requires Python → use Python |

---

## GSD Configuration Hierarchy

```
Project PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
     (highest)                    (project state, auto-managed)         (global default)
```

| Tier | Path | Managed By |
|------|------|-----------|
| Global | `~/.gsd/` | System defaults, API keys, installed skills |
| Project State | `~/.gsd/projects/{hash}/` | GSD auto-managed (milestones, state, decisions, knowledge) |
| Project Config | Project root `PREFERENCES.md` | Phase 0 auto-generated |

---

## Applicability

| Project Type | M0 Dependency Layer | Parallel Split Strategy |
|-------------|---------------------|----------------------|
| Web Frontend | Routing, shared components, API client, state skeleton | By page/feature module |
| Web Backend | DB schema, middleware, shared utilities | By domain/service |
| Full-Stack | Monorepo init, shared types, API schema | Layer separation or vertical slices |
| Mobile | Navigation, design system, network layer | By feature module |
| Desktop | Window framework, IPC, shared state | By feature module |
| CLI / Library | Core interfaces, config system | By subcommand/module |
| Microservices | Proto/schema definitions, CI templates | Natural service boundaries |
| Data Engineering | Pipeline framework, shared connectors | By pipeline stage |
| Infrastructure | Provider configs, shared modules | By resource group/environment |

---

## Quick Reference

```
1. Project Lead → provide PRD.md + development unit count N
2. /team-kickoff → auto-generates everything:
   • Tech stack selection
   • PREFERENCES.md (with git worktree config)
   • Milestones M0~MN + slices for each milestone
   • CONTEXT.md per milestone (goals, acceptance criteria, module boundaries)
   • Unit assignment table (Workspace → Agent → human supervisor → branch)
   • Git initialization (main protection + feature branches)
3. Project Lead → confirm assignment table
4. Workspace 1: Dev A → /gsd auto → Agent 1 completes M0 → PR
5. Tech Manager WS → /gsd auto → review → merge M0 to main
6. Workspace 1~N: All devs → /gsd auto → each Agent develops in parallel → each PR
7. Tech Manager → review each → resolve conflicts → merge → acceptance report
8. Project Lead → confirm acceptance → release
```
