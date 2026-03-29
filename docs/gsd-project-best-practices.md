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

Every project consists of these roles:

| Role | Type | Responsibility | Runs |
|------|------|---------------|------|
| **Project Lead** | Human | Provide PRD.md, confirm Phase 0 output, final release decision | Manual |
| **Tech Manager** | GSD AI Agent | PR review, conflict resolution, merge to main, acceptance, dependency coordination | `/gsd auto` |
| **Developer 1~N** | Human + GSD AI Agent | Each owns one independent module end-to-end | `/gsd auto` |

### Tech Manager

A dedicated integration role that **does not write business code**. Defined by the [`tech-manager` skill](./skills/tech-manager/SKILL.md):
- Continuously monitors all open PRs
- Reviews code quality, security, and standards compliance
- Resolves merge conflicts, preserving intent from both sides
- Merges to the protected main branch
- Verifies against PRD.md acceptance criteria item by item
- Outputs acceptance report after all modules merge

### Developers

Each developer runs `/gsd auto` on their machine. The GSD Agent fully automates:
- Coding on the assigned branch
- Commit + push after each feature
- Creating PR to main when all tasks are done
- Auto-fixing when Tech Manager requests changes

---

## Automated Flow

```
                        PRD.md + Developer count N
                                │
                    ┌───────────▼───────────┐
                    │   /team-kickoff       │  ← GSD Skill (auto)
                    │                       │
                    │  • Tech selection     │
                    │  • Generate PREFS.md  │
                    │  • Dependency-aware   │
                    │    task splitting     │
                    │  • Git branches +    │
                    │    protection        │
                    │  • Role assignment   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Project Lead reviews  │  ← Only human checkpoint
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                                   ▼
    ┌──────────────────┐                ┌──────────────────┐
    │  Developer 1     │                │  Tech Manager    │
    │  /gsd auto       │                │  /gsd auto       │
    │                  │                │                  │
    │  Phase 2a:       │                │  Continuous:     │
    │  Dep layer → PR  │───── PR ──────▶│  Review → Merge  │
    └────────┬─────────┘                │                  │
             │ After dep layer merges   │                  │
    ┌────────┼────────┐                 │                  │
    ▼        ▼        ▼                 │                  │
  Dev 1    Dev 2    Dev N               │                  │
  /gsd     /gsd     /gsd               │                  │
  auto     auto     auto               │                  │
    │        │        │                 │                  │
    └── PR ──┴── PR ──┴───── PR ──────▶│  Review → Merge  │
                                        │  Resolve conflicts│
                                        │  Acceptance report│
                                        └──────────────────┘
```

### Phase 0: Automated Planning

Handled by the [`team-kickoff` skill](./skills/team-kickoff/SKILL.md). Inputs: PRD.md + developer count.

1. Analyze PRD → tech stack selection (language, framework, database, deployment)
2. Select appropriate skills based on stack → generate `PREFERENCES.md`
3. Dependency-aware splitting:
   - Shared dependencies (types, schema, base components) → **dependency layer** (1 developer first)
   - Independent modules split into N parts → **parallel layer** (N developers simultaneously)
4. Configure Git: main branch protection + create feature branches
5. Output role assignment table

### Phase 2a: Dependency Layer

Developer 1 runs `/gsd auto`, completes all shared foundation code, creates PR.
Tech Manager reviews and merges to main.

### Phase 2b: Parallel Development

All developers run `/gsd auto` **simultaneously**:
- GSD automatically uses Git Worktree for isolated working directories
- Each Agent codes only within its assigned branch and module
- Automatically creates PR when done

### Phase 3: Integration & Acceptance

Tech Manager runs continuously, automatically:
- Reviews each PR → merges → resolves conflicts
- Runs full test suite after all modules merge
- Verifies against PRD.md acceptance criteria, outputs acceptance report

---

## Dependency-Aware Splitting

```
                    ┌──────────────┐
                    │  Dependency  │    ← Must complete first
                    │  Layer       │
                    │  (Dev 1)     │
                    └──────┬───────┘
                           │ Merge to main
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Module A │    │ Module B │    │ Module C │    ← All parallel
    │ Dev 1    │    │ Dev 2    │    │ Dev 3    │
    └──────────┘    └──────────┘    └──────────┘
```

**Splitting rules:**
- Code depended on by multiple modules goes into the dependency layer (types, schema, base components, middleware)
- Parallel task count = developer count, maximizing parallelism
- Each module has its own directory, routes, APIs — no cross-module edits
- Dependency layer defines interface contracts; each module implements per contract

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
1. Project Lead → provide PRD.md + developer count
2. /team-kickoff → auto-generates everything (stack, PREFERENCES.md, split, Git)
3. Project Lead → confirm
4. Developer 1 → /gsd auto → dependency layer → PR
5. Tech Manager → /gsd auto → review → merge
6. All developers → /gsd auto → parallel development → PR
7. Tech Manager → review → resolve conflicts → merge → acceptance report
8. Project Lead → confirm → release
```
