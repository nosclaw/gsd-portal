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

## Workspace (WS)

A Workspace is a fully isolated development environment in GSD Portal:

```
┌─────────────────────────────────────┐
│           GSD Workspace (WS)         │
│                                     │
│  • /home/{username}/                │
│  • Independent Provider API Key     │
│  • Independent GSD Agent instance   │
│                                     │
│  After /gsd auto, autonomously:     │
│  • Codes in Git Worktree            │
│  • Tests → commit → push → PR      │
│  • Auto-fixes per review feedback   │
└─────────────────────────────────────┘
```

---

## Roles

| Role | Count | Responsibility |
|------|-------|---------------|
| **Project Lead** | 1 human | Provide PRD.md, confirm planning output, final release |
| **Planning WS** | 1 | Phase 0: tech selection, generate config, split tasks, Git init |
| **Tech Manager WS** | 1 | PR review, conflict resolution, merge to main, acceptance |
| **Dev WS 1~N** | N | Each completes one milestone end-to-end |

> Total: N+1 workspaces. Planning WS can reuse Dev WS1.

### How Roles Are Injected

GSD's native PREFERENCES.md does not have a `Role` field. The correct approach:

**Project-level PREFERENCES.md** (shared by all WSs, in the Git repo):
```yaml
mode: auto
always_use_skills:
  - standards
  - review
  - test
git:
  worktree: true
  branch_protection: main
  merge_method: pr_only
  auto_push: true
  auto_pr: true
custom_instructions:
  - All code must be real business logic — no mock/stub
  - Follow engineering standards from ~/.gsd/standards/
```

**Roles are defined via Milestone Context files.** Each WS reads its assigned context file, which contains that WS's role, branch, and task list. No separate Role mechanism needed — the context file IS the instruction.

**Portal orchestrator injection:** When launching a WS, the Portal writes the corresponding context file path into the workspace-level `~/.gsd/preferences.md`:

```yaml
custom_instructions:
  - Read milestones/m1-user-module-context.md and execute per its instructions
```

Tech Manager WS workspace-level preferences:
```yaml
custom_instructions:
  - You are the Tech Manager, do not write business code
  - Continuously monitor all open PRs
  - Review code quality then merge to main
  - Verify against PRD.md acceptance criteria item by item
```

---

## Dependency Coordination Mechanism

When WS3's M3 depends on WS1's M1, how is WS3 notified?

### Option 1: Git Polling (zero dependencies, works immediately)

**Git itself is the notification mechanism.** After WS3 starts `/gsd auto`:

1. Checks if main branch contains M1 code (`git log main` or check for specific files)
2. If not merged → wait and poll periodically
3. After M1 merges to main → WS3 detects the change → pulls latest main → starts M3

Declared in the context file:
```markdown
## Dependencies
- Depends on M1 (feat/user-module)
- Pre-start check: main branch contains src/modules/user/ directory
- If dependency not ready, check main branch every 60 seconds
```

### Option 2: GSD Extension — Agent Mailbox (requires development)

GSD's extension system supports custom tools, commands, and event hooks. An `agent-mailbox` extension could be built:

```
~/.gsd/agent/extensions/agent-mailbox/
├── extension-manifest.json
├── index.js
└── mailbox/                    # Shared message directory
    ├── ws1-inbox.jsonl
    ├── ws2-inbox.jsonl
    └── ws3-inbox.jsonl
```

**Extension-provided tools:**
- `mailbox_send(to, message)` — Tech Manager sends "M1_MERGED" to WS3
- `mailbox_check()` — Agent checks its inbox
- `mailbox_wait(condition)` — Block until specific message arrives

**Extension-provided hooks:**
- `session_start` — Check inbox on startup
- `turn_end` — Check for new messages after each turn

**No related unmerged PRs found in the GSD official repository.** This is a new feature area.

### Recommendation

Use Option 1 (Git polling) first — zero dependencies, aligns with "Git is the only collaboration channel." Option 2 as future optimization.

---

## Automated Flow

```
            PRD.md + Workspace count N
                    │
        ┌───────────▼───────────┐
        │  Planning WS          │
        │  /gsd auto            │
        │                       │
        │  • Tech selection     │
        │  • Generate PREFS.md  │
        │  • Milestone + Slice  │
        │  • Milestone Context  │
        │  • Git initialization │
        │  • WS assignment table│
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │  Project Lead confirms │  ← Only human checkpoint
        └───────────┬───────────┘
                    │
  ┌─────────────────┼──────────────────┐
  ▼                                    ▼
┌──────────┐                 ┌──────────────────┐
│ WS1      │                 │ Tech Manager WS  │
│ /gsd auto│                 │ /gsd auto        │
│          │                 │                  │
│ M0 → PR  │──── PR ───────▶│ Review → Merge   │
└────┬─────┘                 │                  │
     │ After M0 merges       │                  │
┌────┼────┐                  │                  │
▼    ▼    ▼                  │                  │
WS1  WS2  WSN                │                  │
/gsd /gsd /gsd              │                  │
auto auto auto              │                  │
 │    │    │                  │                  │
 └PR──┴PR──┴──── PR ───────▶│ Review → Merge   │
                              │ Resolve conflicts│
                              │ Acceptance report│
                              └──────────────────┘
```

---

## Phase 0: Automated Planning

A standard `/gsd auto` session — no special skills or extensions needed.

### Output 1: Tech Stack Selection

| Priority | Principle | Example |
|----------|-----------|---------|
| 1 | **Prefer latest, most popular tech** | bun > pnpm > yarn > npm |
| 2 | **Choose higher performance** | Bun runtime > Node.js |
| 3 | **Choose better developer experience** | Next.js > CRA, Nuxt > Vue CLI |
| 4 | **Choose type-safe options** | TypeScript > JavaScript |
| 5 | **Follow PRD when explicitly specified** | PRD requires Python → use Python |

### Output 2: PREFERENCES.md

Written to project root, shared by all WSs. Contains skills, git workflow, custom_instructions.

### Output 3: Milestone Context Files

```
milestones/
├── m0-foundation-context.md
├── m1-user-module-context.md
├── m2-payment-module-context.md
├── m3-admin-module-context.md
└── tech-manager-context.md
```

Each context file = complete work instructions for that WS:

```markdown
# M1 — User Management Module

## Assignment
- Workspace: WS1
- Branch: feat/user-module

## Objective
Requirements summary for this module, extracted from PRD.md.

## Dependencies
- Depends on M0 (feat/foundation) — must be merged to main
- Pre-start check: main branch contains src/shared/ directory

## Slice List

### S1.1 User Registration / Login API
- Implementation: POST /api/auth/register, POST /api/auth/login
- Acceptance Criteria:
  - Registration returns 201 + user ID
  - Passwords hashed with bcrypt
  - Login returns JWT token
- Dependencies: M0 auth middleware + user type definitions

### S1.2 User List Page + Search/Filter
- Implementation: GET /api/users (paginated), frontend list page
- Acceptance Criteria:
  - Search by username, email
  - Response: { data: [], total, page, perPage }
- Dependencies: M0 shared table component + API client

### S1.3 User Detail Editing + Permissions
- Implementation: PUT /api/users/:id, frontend edit form
- Acceptance Criteria:
  - Only ADMIN can edit other users
  - Returns 200 + updated user
- Dependencies: M0 permission utilities

### S1.4 Tests
- Acceptance Criteria: 100% API route coverage + permission boundary tests

## Module Boundaries
- Only modify files under src/modules/user/
- Use M0 shared types and components without modifying them

## Workflow
- Work in feat/user-module branch worktree
- commit + push after each Slice
- Create PR to main when all Slices complete
- Auto-fix per Tech Manager review feedback
```

**Tech Manager context file:**

```markdown
# Tech Manager

## Role
Tech Manager — does not write business code.

## Responsibilities
- Continuously monitor all open PRs
- Review code quality, security, standards compliance
- Resolve merge conflicts, preserving intent from both sides
- Merge to protected main branch
- Merge in dependency order (M0 → M1/M2 → M3 that depends on M1)
- Verify against PRD.md acceptance criteria item by item
- Output acceptance report after all modules merge

## Merge Priority
1. M0 (dependency layer) — highest priority
2. Independent parallel modules (M1, M2) — by PR submission order
3. Dependent modules (M3 depends on M1) — merge after upstream is merged
```

### Output 4: WS Assignment Table

```
=== WS Assignment Table ===

Tech Manager WS → milestones/tech-manager-context.md
  Responsibilities: PR review, conflict resolution, merge, acceptance

───────────────────────────────────────
  Dependency Layer (must complete first)
───────────────────────────────────────

  WS1 → M0 Project Foundation
    Branch: feat/foundation
    Context: milestones/m0-foundation-context.md
    Slices: S0.1~S0.5

───────────────────────────────────────
  Parallel Layer (all start after M0 merges)
───────────────────────────────────────

  WS1 → M1 User Management
    Branch: feat/user-module
    Context: milestones/m1-user-module-context.md
    Slices: S1.1~S1.4

  WS2 → M2 Payment
    Branch: feat/payment-module
    Context: milestones/m2-payment-module-context.md
    Slices: S2.1~S2.4

  WS3 → M3 Admin Panel (depends on M1)
    Branch: feat/admin-module
    Context: milestones/m3-admin-module-context.md
    Slices: S3.1~S3.4
    Note: starts after M1 merges
```

### Output 5: Git Initialization

Main branch protection + create feature branches.

---

## Dependency-Aware Splitting

```
            ┌─────────────┐
            │  M0 Dep Layer│  ← Must complete first
            │  WS1         │
            └──────┬──────┘
                   │ PR → Tech Manager merges
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 Users │ │ M2 Pay   │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ After M1 merges         │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 Admin │  ← Waits for M1
                         │ WS3      │
                         └──────────┘
```

**Splitting rules:**
- Shared dependencies → M0 (types, schema, base components, middleware)
- Parallel module count = WS count N
- Each module = milestone (M1, M2...) = multiple slices (S1.1, S1.2...)
- Each slice includes: implementation, acceptance criteria, dependencies
- Each module has its own directory — no cross-module edits

**Dependency detection (Git polling):**
- WS3 starts, checks if main contains M1 code
- Not ready → poll `git fetch && git log main` every 60 seconds
- M1 merged → pull main → start M3

---

## GSD Configuration Hierarchy

```
Project PREFERENCES.md (Git repo, shared by all WSs)
  > ~/.gsd/preferences.md (WS-level, Portal orchestrator injects context path)
    > ~/.gsd/projects/{hash}/preferences.md (GSD auto-managed)
```

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
2. Planning WS → /gsd auto → auto-generates:
   • Tech stack selection
   • PREFERENCES.md
   • milestones/ directory (context file per milestone + tech-manager)
   • WS assignment table
   • Git initialization
3. Project Lead → confirm
4. Portal orchestrator → inject context path into each WS
5. WS1 → /gsd auto → M0 dep layer → PR
6. Tech Manager WS → /gsd auto → review → merge M0
7. WS1~N → each /gsd auto → parallel dev (dependent WSs auto-poll) → PR
8. Tech Manager → review → resolve conflicts → merge → acceptance report
9. Project Lead → confirm → release
```
