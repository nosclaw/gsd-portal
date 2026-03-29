# GSD Team Automated Development Best Practices

Fully automated parallel development using multiple human developers + multiple GSD AI Agent teams, driven by a single PRD document.

Applicable to all programming languages and project types.

---

## Core Philosophy

```
The only human inputs are PRD.md and the number of developers.
Everything else — tech selection, task splitting, Git setup, coding,
committing, collaboration, merging — is fully automated.
```

---

## Role Definitions

Every project has three types of roles. Human developers and GSD AI Agents are explicitly distinct identities.

### Role Overview

| # | Role | Identity | Responsibility | Runs |
|---|------|----------|---------------|------|
| — | **Project Lead** | Human | Provide PRD.md, confirm Phase 0 output, final release decision | Manual |
| — | **Tech Manager** | GSD AI Agent | PR review, conflict resolution, merge to main, acceptance, dependency coordination | `/gsd auto` |
| 1 | **Human Developer A** | Human | Launch `/gsd auto` on Machine A, supervise Agent A | Launch then observe |
| 1 | **GSD Agent A** | AI Agent | Auto-complete all coding, testing, commits, PR for Module A in worktree | `/gsd auto` |
| 2 | **Human Developer B** | Human | Launch `/gsd auto` on Machine B, supervise Agent B | Launch then observe |
| 2 | **GSD Agent B** | AI Agent | Auto-complete all coding, testing, commits, PR for Module B in worktree | `/gsd auto` |
| N | **...** | ... | ... | ... |

### Human Developer vs GSD AI Agent

```
┌────────────────────────────────────────┐
│         Human Developer (Machine A)     │
│                                        │
│  Responsibilities:                     │
│  • Clone repository                    │
│  • Launch /gsd auto                    │
│  • Supervise Agent work quality        │
│  • Intervene manually when needed      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │       GSD AI Agent A             │  │
│  │                                  │  │
│  │  Responsibilities:               │  │
│  │  • Auto-code in Git Worktree    │  │
│  │  • Run tests                     │  │
│  │  • commit + push                 │  │
│  │  • Create PR                     │  │
│  │  • Auto-fix per review feedback  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

Each machine = 1 human developer + 1 GSD AI Agent, forming a **development unit**.

### Tech Manager

A standalone GSD AI Agent that **does not write business code** — only handles integration and coordination.
Defined by the [`tech-manager` skill](./skills/tech-manager/SKILL.md):
- Continuously monitors all open PRs
- Reviews code quality, security, and standards compliance
- Resolves merge conflicts, preserving intent from both sides
- Merges to the protected main branch
- Verifies against PRD.md acceptance criteria item by item
- Outputs acceptance report after all modules merge

---

## Git Worktree Mode

All development units **must** use Git Worktree mode. This is enforced in `PREFERENCES.md`:

```markdown
## git_workflow
- mode: worktree
- branch_protection: main
- merge_method: pr_only
- auto_push: true
- auto_pr: true
```

### What Worktree Mode Means

When a GSD Agent starts via `/gsd auto`, it automatically:
1. Creates a Git Worktree from the main repo (isolated working directory)
2. Works on the assigned feature branch
3. Does not affect the main branch or other worktrees
4. Creates PR when done — never merges directly

### Why Worktree is Mandatory

- **Zero conflicts**: Each Agent works in a physically isolated directory, no branch switching issues
- **True parallelism**: N Agents code simultaneously in N separate directories
- **Safety**: Agents cannot affect the main branch; all changes must go through PR

---

## Automated Flow

```
                        PRD.md + Human developer count N
                                │
                    ┌───────────▼───────────┐
                    │   /team-kickoff       │  ← GSD Skill (auto)
                    │                       │
                    │  • Tech selection     │
                    │    (latest tech)      │
                    │  • Generate PREFS.md  │
                    │  • Dependency-aware   │
                    │    task splitting     │
                    │  • Git worktree cfg   │
                    │  • Role assignment    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Project Lead reviews  │  ← Only human checkpoint
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼──────────────────┐
              ▼                                    ▼
    ┌──────────────────┐                 ┌──────────────────┐
    │  Machine A        │                 │  Tech Manager    │
    │  Human Dev A      │                 │  (GSD AI Agent)  │
    │  └─ GSD Agent A  │                 │  /gsd auto       │
    │     /gsd auto    │                 │                  │
    │                  │                 │  Continuous:     │
    │  Phase 2a:       │                 │                  │
    │  Dep layer → PR  │──── PR ────────▶│  Review → Merge  │
    └────────┬─────────┘                 │                  │
             │ After dep layer merges    │                  │
    ┌────────┼────────┐                  │                  │
    ▼        ▼        ▼                  │                  │
  Mach A   Mach B   Mach N              │                  │
  Human A  Human B  Human N             │                  │
  Agent A  Agent B  Agent N             │                  │
  /gsd     /gsd     /gsd               │                  │
  auto     auto     auto               │                  │
    │        │        │                  │                  │
    └── PR ──┴── PR ──┴──── PR ────────▶│  Review → Merge  │
                                         │  Resolve conflicts│
                                         │  Acceptance report│
                                         └──────────────────┘
```

### Phase 0: Automated Planning

Handled by the [`team-kickoff` skill](./skills/team-kickoff/SKILL.md).

**Input:** PRD.md + human developer count N

**Auto-output:**

1. Tech stack selection (prefer latest, most popular technologies)
2. `PREFERENCES.md` (including git worktree mode configuration)
3. Role assignment table + milestone/slice assignments
4. Git repo initialization (main protection + feature branches)

**Role assignment table example (3 human developers):**

```
=== Role Assignment Table ===

Tech Manager (GSD AI Agent, runs independently)
  └─ Responsibilities: PR review, conflict resolution, merge, acceptance

Dependency Layer Phase 2a (must complete first):
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 1                                             │
  │   Human Developer: A                                           │
  │   GSD Agent: Agent A                                           │
  │   Branch: feat/foundation                                      │
  │   Milestone: M0 — Project Foundation                           │
  │   Slices:                                                      │
  │     S0.1 Project init + toolchain config                       │
  │     S0.2 Shared type definitions + DB schema                   │
  │     S0.3 Base components + shared utilities                    │
  │     S0.4 Auth middleware + API client                          │
  └────────────────────────────────────────────────────────────────┘

Parallel Layer Phase 2b (all start simultaneously after dep layer merges):
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 1                                             │
  │   Human Developer: A                                           │
  │   GSD Agent: Agent A                                           │
  │   Branch: feat/user-module                                     │
  │   Milestone: M1 — User Management                             │
  │   Slices:                                                      │
  │     S1.1 User registration / login API                         │
  │     S1.2 User list page + search/filter                        │
  │     S1.3 User detail editing + permissions                     │
  │     S1.4 Unit tests + integration tests                        │
  └────────────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 2                                             │
  │   Human Developer: B                                           │
  │   GSD Agent: Agent B                                           │
  │   Branch: feat/payment-module                                  │
  │   Milestone: M2 — Payment                                     │
  │   Slices:                                                      │
  │     S2.1 Order creation API + data model                       │
  │     S2.2 Payment gateway integration                           │
  │     S2.3 Billing management pages                              │
  │     S2.4 Unit tests + integration tests                        │
  └────────────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────────────┐
  │ Development Unit 3                                             │
  │   Human Developer: C                                           │
  │   GSD Agent: Agent C                                           │
  │   Branch: feat/admin-module                                    │
  │   Milestone: M3 — Admin Panel                                 │
  │   Slices:                                                      │
  │     S3.1 Report API + visualizations                           │
  │     S3.2 System settings page                                  │
  │     S3.3 Audit log                                             │
  │     S3.4 Unit tests + integration tests                        │
  └────────────────────────────────────────────────────────────────┘
```

### Phase 2a: Dependency Layer

Human Developer A launches `/gsd auto` on Machine A.
GSD Agent A auto-completes all shared foundation code in worktree, creates PR.
Tech Manager reviews and merges to main.

### Phase 2b: Parallel Development

After dependency layer merges, all human developers **simultaneously** launch `/gsd auto`:
- Each GSD Agent auto-creates a worktree, works in an isolated directory
- Each Agent codes only within its assigned branch and module
- Auto-creates PR when done

### Phase 3: Integration & Acceptance

Tech Manager runs continuously, automatically:
- Reviews each PR → merges → resolves conflicts
- Runs full test suite after all modules merge
- Verifies against PRD.md acceptance criteria, outputs acceptance report

---

## Dependency-Aware Splitting Rules

```
                    ┌──────────────────────┐
                    │  M0 Dependency Layer  │    ← Must complete first
                    │  Dev Unit 1           │
                    │  (Human A + Agent A)  │
                    └──────────┬───────────┘
                               │ PR → Tech Manager merges to main
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ M1 Users    │  │ M2 Payment  │  │ M3 Admin    │  ← All parallel
     │ Dev Unit 1  │  │ Dev Unit 2  │  │ Dev Unit 3  │
     │ HumanA+AgtA│  │ HumanB+AgtB│  │ HumanC+AgtC│
     └─────────────┘  └─────────────┘  └─────────────┘
```

**Splitting rules:**
- Code depended on by multiple modules → dependency layer (types, schema, base components, middleware)
- Parallel module count = human developer count N, maximizing parallelism
- Each module maps to a milestone (M1, M2, M3...), each milestone splits into slices (S1.1, S1.2...)
- Each module has its own directory, routes, APIs — no cross-module edits
- Dependency layer defines interface contracts; each module implements per contract

---

## Tech Selection Principles

Phase 0 tech selection follows these priorities:

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

| Project Type | Dependency Layer | Parallel Split Strategy |
|-------------|-----------------|----------------------|
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
1. Project Lead → provide PRD.md + human developer count N
2. /team-kickoff → auto-generates everything (stack, PREFERENCES.md, assignment table, Git)
3. Project Lead → confirm assignment table
4. Machine A: Human Dev A → /gsd auto → Agent A completes dep layer → PR
5. Tech Manager → /gsd auto → review → merge dep layer to main
6. Machine A~N: All Human Devs → /gsd auto → each Agent develops in parallel → each PR
7. Tech Manager → review each → resolve conflicts → merge → acceptance report
8. Project Lead → confirm acceptance → release
```
