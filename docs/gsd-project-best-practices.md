# GSD Team Automated Development Best Practices

Fully automated parallel development using multiple GSD Workspaces, driven by a single PRD document.

Applicable to all programming languages and project types.

---

## Core Philosophy

```
The only human inputs are PRD.md and the number of workspaces.
Everything else — tech selection, task splitting, Git setup, coding,
committing, collaboration, merging — is fully automated.
Each workspace runs /gsd auto and works fully autonomously with no human supervision.
```

---

## Workspace

A **Workspace** is a fully isolated development environment in GSD Portal:

- Independent home directory (`/home/{username}/`)
- Independent Provider API Key (e.g., OpenRouter API Key)
- Independent GSD Agent instance
- Runs fully autonomously via `/gsd auto`

```
┌─────────────────────────────────────┐
│        GSD Workspace                 │
│                                     │
│  Isolated environment:              │
│  • /home/{username}/                │
│  • Independent Provider API Key     │
│  • Independent GSD Agent instance   │
│                                     │
│  After /gsd auto, autonomously:     │
│  • Codes in Git Worktree            │
│  • Runs tests                       │
│  • commit + push                    │
│  • Creates PR                       │
│  • Auto-fixes per review feedback   │
└─────────────────────────────────────┘
```

---

## Roles

| Role | Count | Responsibility | How |
|------|-------|---------------|-----|
| **Project Lead** | 1 | Provide PRD.md, confirm planning output, final release | Manual |
| **Planning Workspace** | 1 | Phase 0: tech selection, generate config, split tasks, Git init | `/gsd auto`, Role = Tech Architect |
| **Tech Manager Workspace** | 1 | PR review, conflict resolution, merge to main, acceptance | `/gsd auto`, Role = Tech Manager |
| **Dev Workspace 1~N** | N | Each completes one milestone end-to-end | `/gsd auto`, Role = Developer |

> **Total Workspaces needed: N+1** — N for development, 1 for Tech Manager.
> The Planning Workspace can reuse Dev Workspace 1.

### Roles via PREFERENCES.md

Each workspace's behavior is determined by the `Role` definition in `PREFERENCES.md`. GSD natively reads this file — no special skills needed.

**Planning Workspace Role (Phase 0):**

```markdown
## Role
You are a Tech Architect responsible for project initialization planning.
Read PRD.md, perform tech selection, task splitting, and Git configuration.
Do not write business code.
```

**Tech Manager Workspace Role:**

```markdown
## Role
You are the Tech Manager, responsible for code integration and coordination.
Do not write business code. Your responsibilities:
- Continuously monitor all open PRs
- Review code quality, security, and standards compliance
- Resolve merge conflicts, preserving intent from both sides
- Merge to the protected main branch
- Verify against PRD.md acceptance criteria item by item
- Output acceptance report after all modules merge
```

**Dev Workspace Role:**

```markdown
## Role
You are a developer responsible for implementing your assigned milestone.
Read the corresponding milestone context file, implement slices in order.
Work on your assigned branch, create PR when done.
```

---

## Git Worktree Mode

Declared in `PREFERENCES.md`, natively supported by GSD:

```markdown
## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true
```

---

## Automated Flow

```
               PRD.md + Workspace count N
                       │
           ┌───────────▼───────────┐
           │  Planning Workspace   │
           │  /gsd auto            │
           │  Role: Tech Architect │
           │                       │
           │  • Tech selection     │
           │  • Generate PREFS.md  │
           │  • Milestone + Slice  │
           │  • Milestone Context  │
           │  • Git initialization │
           │  • Assignment table   │
           └───────────┬───────────┘
                       │
           ┌───────────▼───────────┐
           │  Project Lead confirms │  ← Only human checkpoint
           └───────────┬───────────┘
                       │
     ┌─────────────────┼──────────────────┐
     ▼                                    ▼
┌────────────┐                  ┌──────────────────┐
│ WS 1       │                  │ Tech Manager WS  │
│ /gsd auto  │                  │ /gsd auto        │
│            │                  │                  │
│ M0 dep     │                  │ Continuous:      │
│ layer → PR │──── PR ────────▶│ Review → Merge   │
└──────┬─────┘                  │                  │
       │ After M0 merges        │                  │
┌──────┼──────┐                 │                  │
▼      ▼      ▼                 │                  │
WS 1  WS 2  WS N               │                  │
/gsd  /gsd  /gsd               │                  │
auto  auto  auto               │                  │
 │     │     │                  │                  │
 └─PR──┴─PR──┴──── PR ───────▶│ Review → Merge   │
                                │ Resolve conflicts│
                                │ Acceptance report│
                                └──────────────────┘
```

---

## Phase 0: Automated Planning

Phase 0 is a standard `/gsd auto` session — no special skills needed. The Planning Workspace reads PRD.md and produces:

### Output 1: Tech Stack Selection

Following these priorities:

| Priority | Principle | Example |
|----------|-----------|---------|
| 1 | **Prefer latest, most popular tech** | bun > pnpm > yarn > npm |
| 2 | **Choose higher performance** | Bun runtime > Node.js |
| 3 | **Choose better developer experience** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **Choose type-safe options** | TypeScript > JavaScript |
| 5 | **Follow PRD when explicitly specified** | PRD requires Python → use Python |

### Output 2: PREFERENCES.md

Written to project root, including Role, skills config, git_workflow, etc.

### Output 3: Milestone Context Files

Generated under `milestones/` in the project root, one context file per milestone:

```
milestones/
├── m0-foundation-context.md
├── m1-user-module-context.md
├── m2-payment-module-context.md
└── m3-admin-module-context.md
```

Each context file structure:

```markdown
# M1 — User Management Module

## Assignment
- Workspace: Workspace 1
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
  - Pagination: page, perPage
  - Response: { data: [], total, page, perPage }
- Dependencies: M0 shared table component and API client

### S1.3 User Detail Editing + Permissions
- Implementation: PUT /api/users/:id, frontend edit form
- Acceptance Criteria:
  - Only ADMIN role can edit other users
  - Returns 200 + updated user
- Dependencies: M0 permission utilities

### S1.4 Tests
- Acceptance Criteria:
  - 100% API route coverage
  - Permission boundary tests

## Module Boundaries
- Only modify files under src/modules/user/
- Use M0 shared types and components without modifying them
- Interact with other modules through M0 interface contracts
```

### Output 4: Workspace Assignment Table

```
=== Workspace Assignment Table ===

Tech Manager Workspace
  Role: Tech Manager
  Responsibilities: PR review, conflict resolution, merge, acceptance

─────────────────────────────────────────────────
  Dependency Layer (Phase 2a — must complete first)
─────────────────────────────────────────────────

  Workspace 1 → M0 Project Foundation
    Branch: feat/foundation
    Context: milestones/m0-foundation-context.md
    Slices:
      S0.1 Project init + toolchain config
      S0.2 Shared type definitions + DB schema
      S0.3 Base component library + shared utilities
      S0.4 Auth middleware + API client
      S0.5 CI config + lint + test framework

─────────────────────────────────────────────────
  Parallel Layer (Phase 2b — all start after M0 merges)
─────────────────────────────────────────────────

  Workspace 1 → M1 User Management
    Branch: feat/user-module
    Context: milestones/m1-user-module-context.md
    Slices:
      S1.1 User registration / login API
      S1.2 User list page + search/filter
      S1.3 User detail editing + permissions
      S1.4 Unit tests + integration tests

  Workspace 2 → M2 Payment
    Branch: feat/payment-module
    Context: milestones/m2-payment-module-context.md
    Slices:
      S2.1 Order creation API + data model
      S2.2 Payment gateway integration
      S2.3 Billing management pages
      S2.4 Unit tests + integration tests

  Workspace 3 → M3 Admin Panel
    Branch: feat/admin-module
    Context: milestones/m3-admin-module-context.md
    Slices:
      S3.1 Report API + chart visualizations
      S3.2 System settings page
      S3.3 Audit log
      S3.4 Unit tests + integration tests
```

### Output 5: Git Initialization

- Main branch protection (no direct push, PR-only merge)
- Create feature branches (feat/foundation, feat/user-module...)

---

## Dependency-Aware Splitting

```
               ┌────────────────────┐
               │  M0 Dependency     │    ← Must complete first
               │  Workspace 1       │
               └────────┬───────────┘
                        │ PR → Tech Manager merges to main
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ M1 Users  │ │ M2 Payment│ │ M3 Admin  │  ← All parallel
   │ WS 1      │ │ WS 2      │ │ WS 3      │
   └───────────┘ └───────────┘ └───────────┘
```

**Splitting rules:**
- Code depended on by multiple modules → M0 (types, schema, base components, middleware)
- Parallel module count = workspace count N
- Each module = one milestone (M1, M2...), each milestone = multiple slices (S1.1, S1.2...)
- Each slice includes: implementation scope, acceptance criteria, dependencies
- Each module has its own directory — no cross-module edits
- M0 defines interface contracts

### Multi-Level Dependencies

```
M0 dep layer → complete first
  │
  ├── M1 (no deps)      ← start immediately
  ├── M2 (no deps)      ← start immediately
  └── M3 (depends on M1) ← start after M1 merges
```

Tech Manager monitors dependency status — notifies Workspace 3 to start M3 after M1's PR merges.

---

## GSD Configuration Hierarchy

```
Project PREFERENCES.md  >  ~/.gsd/projects/{hash}/preferences.md  >  ~/.gsd/preferences.md
     (highest)                    (GSD auto-managed)                    (global default)
```

---

## Applicability

| Project Type | M0 Dependency Layer | Parallel Split Strategy |
|-------------|---------------------|----------------------|
| Web Frontend | Routing, shared components, API client, state skeleton | By page/feature module |
| Web Backend | DB schema, middleware, shared utilities | By domain/service |
| Full-Stack | Monorepo, shared types, API schema | Layer or vertical slices |
| Mobile | Navigation, design system, network layer | By feature module |
| Desktop | Window framework, IPC, shared state | By feature module |
| CLI / Library | Core interfaces, config system | By subcommand/module |
| Microservices | Proto/schema, CI templates | Natural service boundaries |
| Data Engineering | Pipeline framework, shared connectors | By pipeline stage |
| Infrastructure | Provider configs, shared modules | By resource group/environment |

---

## Quick Reference

```
1. Project Lead → PRD.md + workspace count N
2. Planning WS → /gsd auto → auto-generates:
   • Tech stack selection
   • PREFERENCES.md (with git worktree config)
   • milestones/ directory (one context file per milestone)
   • Workspace assignment table
   • Git initialization (main protection + feature branches)
3. Project Lead → confirm
4. Workspace 1 → /gsd auto → completes M0 dep layer → PR
5. Tech Manager WS → /gsd auto → review → merge M0
6. Workspace 1~N → each /gsd auto → parallel development → each PR
7. Tech Manager → review → resolve conflicts → merge → acceptance report
8. Project Lead → confirm → release
```
