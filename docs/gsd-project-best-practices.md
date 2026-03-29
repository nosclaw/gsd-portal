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
# No extra injection needed — GSD native milestone system handles this
# via GSD_MILESTONE_LOCK environment variable
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

Uses GSD's native **discussion flow** (`showSmartEntry`). The Planning WS starts `/gsd auto` then:

1. GSD enters discussion phase, reads PRD.md
2. Creates milestones through the native flow:
   - Each milestone generates `{MID}-CONTEXT.md` (goals, acceptance criteria, constraints)
   - Then generates `{MID}-ROADMAP.md` (slice list)
3. Generates `.gsd/PREFERENCES.md` and `.gsd/KNOWLEDGE.md`
4. Outputs WS assignment table

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

## Dependency Coordination

When WS3's M3 depends on WS1's M1, a coordination mechanism is needed.

### Current: `post_unit_hooks` + Git Check

Use GSD's native `post_unit_hooks` to check dependency state after each task:

```yaml
# .gsd/PREFERENCES.md
post_unit_hooks:
  - name: check-dependency
    after: [execute-task]
    run: "git fetch origin main && git log origin/main --oneline | head -5"
```

WS3's context declares the dependency. The agent checks if main contains M1 code before starting.

**Limitations:**
- `post_unit_hooks` output enters agent context but cannot block execution
- Agent must self-judge whether to wait
- No true "blocking wait" mechanism

### Future: Agent Mailbox Extension

A GSD extension for cross-workspace dependency coordination is fully feasible:

**Architecture:**

```
~/.gsd/agent/extensions/agent-mailbox/
├── extension-manifest.json
├── index.js
└── shared/                     # Shared message directory (all WSs access)
    └── mailbox.jsonl
```

**extension-manifest.json:**
```json
{
  "id": "agent-mailbox",
  "name": "Agent Mailbox",
  "version": "1.0.0",
  "description": "Cross-workspace dependency coordination via shared message queue",
  "tier": "custom",
  "provides": {
    "tools": ["mailbox_send", "mailbox_wait", "mailbox_check"],
    "hooks": ["session_start"]
  }
}
```

**How it works:**

Tech Manager merges M1, then:
```
→ Calls mailbox_send({ to: "ws3", type: "DEPENDENCY_READY", data: { milestone: "M1" } })
```

WS3's agent on startup:
```
→ session_start hook checks inbox
→ Finds DEPENDENCY_READY message
→ Begins M3 execution
```

**Recommended: Non-blocking polling pattern:**

```javascript
// Background polling + inject message when ready
pi.on("session_start", () => {
  const interval = setInterval(async () => {
    const messages = readMailbox().filter(m => m.to === process.env.USER && !m.consumed);
    if (messages.length > 0) {
      markConsumed(messages);
      clearInterval(interval);
      pi.sendMessage({
        customType: "dependency-ready",
        content: `Dependencies ready: ${messages.map(m => m.data.milestone).join(", ")}. Starting work.`,
        display: true
      }, { triggerTurn: true, deliverAs: "followUp" });
    }
  }, 10000);  // Check every 10 seconds
});
```

**Feasibility assessment:**

| Aspect | Assessment |
|--------|-----------|
| Technical feasibility | ✅ Fully feasible — `pi.registerTool()` + `pi.sendMessage()` + `pi.on()` are existing APIs |
| Shared storage | ✅ All WSs can access shared path (e.g., `/opt/shared/` or `.gsd-mailbox/` in git repo) |
| Message reliability | ⚠️ JSONL append writes need file locking for concurrent write safety |
| Blocking wait | ⚠️ `mailbox_wait` blocks a tool call. Recommend non-blocking polling + `pi.sendMessage()` |
| Message cleanup | Needs periodic cleanup of consumed messages |

---

## Dependency-Aware Splitting

```
            ┌─────────────┐
            │  M0 Dep Layer│  ← Must complete first
            │  WS1 LOCK=M0│
            └──────┬──────┘
                   │ PR → Tech Manager merges
       ┌───────────┼───────────┐
       ▼           ▼           │
┌──────────┐ ┌──────────┐     │
│ M1 Users │ │ M2 Pay   │     │
│ WS1      │ │ WS2      │     │
└────┬─────┘ └──────────┘     │
     │ After M1 merges         │
     │ Tech Manager sends      │
     │ DEPENDENCY_READY         │
     └─────────────────────────▼
                         ┌──────────┐
                         │ M3 Admin │  ← mailbox_wait or Git check
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
   • GSD native discussion flow → create milestones (M0~MN)
   • Each milestone auto-generates CONTEXT.md + ROADMAP.md
   • Generate .gsd/PREFERENCES.md (parallel + git workflow)
   • Generate .gsd/KNOWLEDGE.md (tech stack + module boundaries)
   • Output WS assignment table (WS → milestone → GSD_MILESTONE_LOCK)
3. Project Lead → confirm
4. Portal orchestrator → set GSD_MILESTONE_LOCK env var per WS
5. WS1 (LOCK=M0) → /gsd auto → completes M0 → PR
6. Tech Manager WS → /gsd auto → review → merge M0
7. WS1~N → /gsd auto (each LOCK=M1~MN) → parallel dev → PR
   • Dependent WSs wait via Agent Mailbox or Git check
8. Tech Manager → review → resolve conflicts → merge → acceptance report
9. Project Lead → confirm → release
```
