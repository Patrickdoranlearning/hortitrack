# Jimmy Quick Commands

## Quick Start (Essential Commands)
```
jimmy dual-plan [X]    # Best for complex features - two perspectives
jimmy plan [X]         # Standard planning
jimmy new [X]          # Build feature with mini-plan
jimmy fix [X]          # Fix a bug
jimmy check            # Quick code review
jimmy audit            # Full security + quality review
jimmy ready            # Pre-merge validation
jimmy ship             # Complete ship pipeline
jimmy status           # Where am I?
jimmy continue         # Resume from STATUS.md
jimmy wrap up          # End session properly
```
**Rule**: Complex feature? Use `dual-plan`. Simple task? Use `new` or `fix`.

---

Quick reference for the Jimmy coordinator agent.

---

## ⚠️ Plan-First Development

**Every non-trivial task should have a plan.** Plans prevent lost context.

### Plan Location
```
.claude/plans/              # Active plans
.claude/plans/completed/    # Completed plans (archived)
```

### When to Use What

| Complexity | Command | Creates |
|------------|---------|---------|
| Complex feature | `jimmy dual-plan [X]` ⭐ | Full plan with alternatives |
| Standard feature | `jimmy plan [X]` | Full plan |
| Simple feature | `jimmy new [X]` | Mini plan |
| Complex bug | `jimmy bugfix [X]` | Mini plan |
| Simple bug | `jimmy fix [X]` | No plan |

### ⭐ Dual-Plan (RECOMMENDED for Complex Features)

**The most powerful planning technique.** Use for any feature where the approach isn't obvious.

```bash
jimmy dual-plan [feature]
jimmy dual-plan [feature] --perspectives "MVP speed" "proper architecture"
```

**What it does:**
1. Runs TWO planners in parallel with different perspectives
2. Each creates a complete plan
3. Jimmy evaluates and synthesizes the best approach
4. Results in a superior plan that considers alternatives

**Why it's powerful:**
- Forces consideration of alternatives
- Surfaces trade-offs explicitly
- Avoids tunnel vision
- Documents why chosen approach was selected
- Results in better architectural decisions

**Default perspective pairs:**
| Feature Type | Perspective A | Perspective B |
|--------------|---------------|---------------|
| New feature | MVP / Quick wins | Extensible architecture |
| Performance | Client-side | Server-side |
| Data feature | Minimal schema | Proper modeling |
| UI feature | Simple components | Reusable library |

### Plan Management

```bash
jimmy plan status          # Show current plan progress
jimmy plan status --all    # Show all active plans
jimmy execute PLAN-[X].md  # Execute a specific plan
jimmy continue             # Resume work on current plan
```

---

## Command Philosophy

Commands are organized by **intent** — what you're trying to accomplish:

| Intent | Commands |
|--------|----------|
| **Building** | `new`, `add`, `change`, `feature` |
| **Fixing** | `fix`, `hotfix`, `debug`, `bugfix` |
| **Reviewing** | `check`, `audit`, `quality` |
| **Shipping** | `ready`, `ship`, `release` |
| **Planning** | `plan`, `dual-plan`, `journey` |
| **Managing** | `status`, `pending`, `wrap up` |

---

## 🚀 Building Commands

### `jimmy new [feature]` — Full Feature Pipeline
**Best for**: Brand new features that need planning

```
turbo plan → [data-engineer if DB] → feature-builder → verifier → tester-tim → turbo review
```

**Agents involved**: 6-8 (with parallel phases)
**Example**: `jimmy new customer-portal`

### `jimmy add [feature]` — Quick Addition Pipeline
**Best for**: Adding to existing functionality (no planning needed)

```
[data-engineer if DB] → feature-builder → verifier → tester-tim
```

**Agents involved**: 3-4
**Example**: `jimmy add export-button-to-reports`

### `jimmy change [feature]` — Modification Pipeline
**Best for**: Changing existing behavior

```
explore (understand current) → feature-builder → verifier → tester-tim → turbo review
```

**Agents involved**: 5-6
**Example**: `jimmy change order-status-flow`

---

## 🔧 Fixing Commands

### `jimmy fix [issue]` — Standard Bug Fix
**Best for**: Normal bugs with clear reproduction

```
explore (find root cause) → feature-builder (fix) → verifier → tester-tim (regression)
```

**Agents involved**: 4
**Example**: `jimmy fix batch-quantity-not-updating`

### `jimmy hotfix [issue]` — Urgent Fix Pipeline
**Best for**: Production issues, needs speed

```
feature-builder (fix) → verifier → (security-auditor + karen) parallel → sync
```

**Agents involved**: 4 (parallel where possible)
**Example**: `jimmy hotfix auth-session-expiring`

### `jimmy debug [issue]` — Deep Investigation
**Best for**: Complex bugs, unclear cause

```
ultrathink-debugger → (explore + security-auditor) parallel → report findings
```

**Agents involved**: 3 (parallel investigation)
**Example**: `jimmy debug intermittent-order-failures`

---

## 🔍 Reviewing Commands

### `jimmy check` — Quick Quality Check
**Best for**: Fast feedback during development

```
(module-reviewer + code-quality-pragmatist) parallel
```

**Agents involved**: 2 (parallel)
**Example**: `jimmy check`

### `jimmy audit` — Full Security & Quality Audit
**Best for**: Before major releases, sensitive changes

```
(module-reviewer + security-auditor + code-quality-pragmatist + karen) ALL parallel
```

**Agents involved**: 4 (all parallel!)
**Example**: `jimmy audit`

### `jimmy quality [module]` — Module Deep Dive
**Best for**: Reviewing a specific module thoroughly

```
module-reviewer (focused) → security-auditor → code-quality-pragmatist → tester-tim
```

**Agents involved**: 4
**Example**: `jimmy quality sales/orders`

---

## 📦 Shipping Commands

### `jimmy ready` — Pre-Merge Validation
**Best for**: Before creating PR

```
verifier → (module-reviewer + security-auditor + karen) parallel
```

**Agents involved**: 4 (parallel after verifier)
**Example**: `jimmy ready`

### `jimmy ship` — Complete Ship Pipeline
**Best for**: Ready to merge and deploy

```
verifier → (module-reviewer + security-auditor + code-quality-pragmatist) parallel → karen → sync
```

**Agents involved**: 5 (with parallel phase)
**Example**: `jimmy ship`

### `jimmy release` — Full Release Pipeline
**Best for**: Major releases, version bumps

```
tester-tim (full regression) → (ALL reviewers) parallel → karen → task-completion-validator → sync
```

**Agents involved**: 6 (maximum validation)
**Example**: `jimmy release`

---

## 📋 Planning Commands

### `jimmy plan [feature]` — Standard Planning
```
explore → planner → PLAN.md
```

### `jimmy turbo plan [feature]` — Fast Multi-Angle Planning
```
(explore-DB + explore-UI + explore-API) parallel → planner → PLAN.md
```

### `jimmy dual-plan [feature]` — Competitive Planning
```
(planner-A + planner-B) parallel → evaluate → synthesize → PLAN.md
```

### `jimmy dual-plan [feature] --perspectives "X" "Y"` — Directed Competitive Planning
```
(planner with perspective X + planner with perspective Y) parallel → compare → select/merge
```

### `jimmy journey` — User Journey to Plan
```
user describes journey → planner parses → asks questions → PLAN.md
```

### `jimmy execute PLAN.md` — Execute Plan
```
Read plan → route tasks to agents per plan → track progress
```

### `jimmy execute PLAN.md --mode [standard|thorough|paranoid]`

---

## 📊 Managing Commands

### `jimmy status` — Session Summary
Shows: current goal, progress, files changed, blockers

### `jimmy pending` — Outstanding Work
Shows: uncommitted changes, failing tests, TODOs, open issues

### `jimmy wrap up` — End Session
```
(task-completion-validator + karen) parallel → sync
```

### `jimmy continue` — Resume Work
Reads STATUS.md, picks up where left off

### `jimmy plan status` — Plan Progress
Shows: current phase, tasks complete, remaining work

---

## ⚡ Turbo Commands (Maximum Parallelism)

| Command | Parallel Agents | Use Case |
|---------|-----------------|----------|
| `jimmy turbo plan [X]` | 3 explores → planner | Fast context gathering |
| `jimmy turbo review` | reviewer + security + quality | Quick full review |
| `jimmy turbo pre-merge` | verifier → (reviewer + security + karen) | Fast ship validation |
| `jimmy turbo wrap up` | (validator + karen) → sync | Fast session close |

---

## 🔄 Combined Workflow Commands

These combine multiple pipelines for common scenarios:

### `jimmy feature [X]` — Complete Feature Lifecycle
**The "I want everything" command**

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Planning (parallel explores)                           │
├─────────────────────────────────────────────────────────────────┤
│   explore-DB + explore-UI + explore-API → planner → PLAN.md    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: Build                                                  │
├─────────────────────────────────────────────────────────────────┤
│   [data-engineer if needed] → feature-builder → verifier        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Validate (parallel)                                    │
├─────────────────────────────────────────────────────────────────┤
│   tester-tim + (module-reviewer + security-auditor + quality)   │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: Finalize                                               │
├─────────────────────────────────────────────────────────────────┤
│   karen (reality check) → sync                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Total agents**: 8-10 (heavily parallelized)
**Example**: `jimmy feature inventory-tracking`

### `jimmy bugfix [X]` — Complete Bug Fix Lifecycle
**From investigation to verified fix**

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Investigate (parallel)                                 │
├─────────────────────────────────────────────────────────────────┤
│   explore + ultrathink-debugger                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: Fix                                                    │
├─────────────────────────────────────────────────────────────────┤
│   feature-builder → verifier                                    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Validate (parallel)                                    │
├─────────────────────────────────────────────────────────────────┤
│   tester-tim + security-auditor (if auth-related)              │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: Close                                                  │
├─────────────────────────────────────────────────────────────────┤
│   karen → sync                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Total agents**: 5-7
**Example**: `jimmy bugfix order-total-calculation`

### `jimmy schema [X]` — Database Change Pipeline
**Always paranoid mode for schema changes**

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Design                                                 │
├─────────────────────────────────────────────────────────────────┤
│   data-engineer → APPROVAL GATE                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: Security (parallel)                                    │
├─────────────────────────────────────────────────────────────────┤
│   security-auditor + code-quality-pragmatist → APPROVAL GATE    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Verify                                                 │
├─────────────────────────────────────────────────────────────────┤
│   verifier → regenerate types → sync                           │
└─────────────────────────────────────────────────────────────────┘
```

**Example**: `jimmy schema add-customer-notes`

---

## 🎯 Smart Commands

### `jimmy auto` — Auto-Detect Workflow
Jimmy analyzes the request and picks the appropriate workflow:

| If Jimmy detects... | Routes to... |
|---------------------|--------------|
| "new feature", "implement", "create" | `jimmy feature` |
| "bug", "fix", "broken", "not working" | `jimmy bugfix` |
| "schema", "table", "migration", "database" | `jimmy schema` |
| "review", "check", "audit" | `jimmy audit` |
| "plan", "how should", "design" | `jimmy turbo plan` |
| "ship", "merge", "deploy" | `jimmy ship` |

**Example**: `jimmy auto: the batch quantity isn't updating correctly after transplant`
→ Routes to `jimmy bugfix`

### `jimmy paranoid [X]` — Maximum Caution Mode
Every step has an approval gate, all reviewers involved:

```
[any pipeline] but with:
- APPROVAL GATE after each phase
- ALL reviewers run (parallel)
- security-auditor mandatory
- karen mandatory
- Manual testing checkpoints
```

---

## 📈 Command Comparison

| Scenario | Quick | Standard | Thorough |
|----------|-------|----------|----------|
| **New feature** | `add` | `new` | `feature` |
| **Bug fix** | `fix` | `bugfix` | `debug` → `bugfix` |
| **Review** | `check` | `turbo review` | `audit` |
| **Ship** | `ready` | `ship` | `release` |
| **Plan** | `plan` | `turbo plan` | `dual-plan` |

---

## Execution Modes

| Mode | Applied By | Adds |
|------|------------|------|
| `lightweight` | `quick fix`, `add` | Minimal validation |
| `standard` | `new`, `fix`, `ship` | Full pipeline |
| `thorough` | `feature`, `bugfix`, `release` | + karen + extra review |
| `paranoid` | `schema`, `paranoid [X]` | + approval gates + all reviewers |

### Mode Triggers (Auto-Applied)

| Code Area | Auto Mode |
|-----------|-----------|
| `auth`, `rls`, `policies` | `thorough` minimum |
| `schema`, `migrations` | `paranoid` always |
| `payments`, `invoices` | `thorough` minimum |
| New feature | `standard` |
| Bug fix | `standard` |
| Typo/copy | `lightweight` |

---

## Agent Participation by Command

| Command | Agents Used | Parallelism |
|---------|-------------|-------------|
| `quick fix` | 1-2 | None |
| `add` | 3-4 | Minimal |
| `check` | 2 | Full parallel |
| `fix` | 4 | Some |
| `new` | 5-6 | Some |
| `audit` | 4 | Full parallel |
| `feature` | 8-10 | Maximum |
| `bugfix` | 5-7 | High |
| `release` | 6+ | Maximum |
| `schema` | 4 | With gates |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                     JIMMY QUICK REFERENCE                        │
├─────────────────────────────────────────────────────────────────┤
│ BUILDING                           FIXING                        │
│   jimmy new [feature]                jimmy fix [issue]           │
│   jimmy add [feature]                jimmy hotfix [issue]        │
│   jimmy change [feature]             jimmy debug [issue]         │
│   jimmy feature [feature]            jimmy bugfix [issue]        │
├─────────────────────────────────────────────────────────────────┤
│ REVIEWING                          SHIPPING                      │
│   jimmy check                        jimmy ready                 │
│   jimmy audit                        jimmy ship                  │
│   jimmy quality [module]             jimmy release               │
│   jimmy turbo review                 jimmy turbo pre-merge       │
├─────────────────────────────────────────────────────────────────┤
│ PLANNING                           MANAGING                      │
│   jimmy plan [X]                     jimmy status                │
│   jimmy turbo plan [X]               jimmy pending               │
│   jimmy dual-plan [X]                jimmy wrap up               │
│   jimmy feature [X]                  jimmy continue              │
├─────────────────────────────────────────────────────────────────┤
│ SPECIAL                                                          │
│   jimmy auto [describe task]         Auto-detect workflow        │
│   jimmy schema [X]                   DB changes (paranoid)       │
│   jimmy paranoid [X]                 Maximum caution             │
│   jimmy journey                      User story → plan           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Examples

```bash
# === BUILDING ===
jimmy new customer-portal           # Full feature lifecycle
jimmy add batch-export-button       # Quick addition
jimmy change order-status-flow      # Modify existing
jimmy feature reporting-dashboard   # Complete with all validation

# === FIXING ===
jimmy fix batch-quantity-bug        # Standard fix
jimmy hotfix auth-expired           # Urgent production fix
jimmy debug intermittent-failures   # Deep investigation
jimmy bugfix order-calculation      # Complete fix lifecycle

# === REVIEWING ===
jimmy check                         # Quick parallel review
jimmy audit                         # Full security + quality audit
jimmy quality sales/orders          # Deep dive on specific module
jimmy turbo review                  # Fast comprehensive review

# === SHIPPING ===
jimmy ready                         # Pre-merge checks
jimmy ship                          # Full ship pipeline
jimmy release                       # Major release validation

# === PLANNING ===
jimmy plan customer-analytics       # Standard planning
jimmy turbo plan customer-analytics # Fast parallel exploration
jimmy dual-plan reports --perspectives "charts" "tables"
jimmy journey                       # Describe user story

# === MANAGING ===
jimmy status                        # Where are we?
jimmy pending                       # What's left?
jimmy wrap up                       # End session
jimmy continue                      # Resume work

# === SPECIAL ===
jimmy auto: users can't see their order history
jimmy schema add-delivery-tracking
jimmy paranoid auth-refactor
```

---

## Stop Conditions

Jimmy will **HALT** and alert if:
- RLS would expose data across orgs
- Migration deletes production data
- Auth bypass vulnerability detected
- Breaking API change without versioning
- Critical security issue found

---

## See Also

- `.claude/agents/jimmy.md` - Full Jimmy documentation
- `.claude/agent-optimization-guide.md` - Agent design patterns
- `PLAN.md` - Current implementation plan
- `STATUS.md` - Session context
