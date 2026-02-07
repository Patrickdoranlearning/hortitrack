# Jimmy Quick Commands (Opus 4.6)

## Quick Start
```
jimmy build [X]        # Build a feature (auto-detects scope)
jimmy fix [X]          # Fix a bug (--urgent for hotfix)
jimmy plan [X]         # Plan a feature (--dual for competing plans)
jimmy review           # Code review (auto-scales depth)
jimmy ship             # Full ship pipeline
jimmy audit            # Full codebase audit
jimmy status           # Where am I?
jimmy continue         # Resume from STATUS.md
jimmy wrap up          # End session properly
```

**Rule**: Complex feature? Use `plan --dual`. Simple task? Use `build` or `fix`. Jimmy auto-detects scope.

---

## Plan-First Development

**Every non-trivial task should have a plan.** Plans live in `.claude/plans/`.

### Plan Location
```
.claude/plans/              # Active plans
.claude/plans/completed/    # Completed plans (archived)
```

### When to Use What

| Complexity | Command | Creates |
|------------|---------|---------|
| Complex feature | `jimmy plan [X] --dual` | Full plan with alternatives |
| Standard feature | `jimmy plan [X]` | Full plan |
| Simple feature | `jimmy build [X]` | Mini plan |
| Complex bug | `jimmy fix [X]` | Mini plan |
| Simple bug | `jimmy fix [X]` | No plan |

### Dual-Plan (RECOMMENDED for Complex Features)

```bash
jimmy dual-plan [feature]
jimmy dual-plan [feature] --perspectives "MVP speed" "proper architecture"
```

**What it does:**
1. Runs TWO planners (Opus) in parallel with different perspectives
2. Each creates a complete plan
3. Jimmy evaluates and synthesizes the best approach
4. Results in a superior plan that considers alternatives

---

## Core Commands

### `jimmy build [X]` — Build a Feature
**Replaces**: `new`, `add`, `change`, `feature`
**Auto-detects scope** from description — no need to pick the right command.

```
context-scout → [plan if complex] → [data-engineer if DB] → feature-builder → verifier → tester → validator
```

**Agents**: 4-8 depending on scope
**Example**: `jimmy build customer-portal`

### `jimmy fix [X]` — Fix a Bug
**Replaces**: `fix`, `hotfix`, `bugfix`
**Auto-detects severity.** Add `--urgent` for production hotfixes.

```
context-scout → [Jimmy debug if complex] → feature-builder → verifier → tester → validator
```

**Agents**: 3-5
**Example**: `jimmy fix batch-quantity-not-updating`
**Example**: `jimmy fix auth-session-expiring --urgent`

### `jimmy review` — Code Review
**Replaces**: `check`, `audit` (for code), `turbo review`, `quality`
**Auto-scales** from quick (2 agents) to thorough (3 agents) based on scope.
**Use `--wide`** for holistic 1M-context review → Opus sharpening (large changesets, plan validation).

```
Standard: (reviewer + security-auditor) parallel [+ module-reviewer for thorough]
Wide:     context-scout (aggressive) → reviewer (Sonnet 1M) → Jimmy (Opus sharpens)
```

**Agents**: 2-3 (standard), 2 + Opus pass (wide)
**Example**: `jimmy review`
**Example**: `jimmy review --wide` (10+ files changed, or validating a plan)

### `jimmy plan [X]` — Plan a Feature
**Replaces**: `plan`, `turbo plan`, `journey`
**Use `--dual`** for competing plans (RECOMMENDED for complex features).

```
context-scout → planner → PLAN.md
```

**Agents**: 2-3
**Example**: `jimmy plan customer-analytics`
**Example**: `jimmy plan reports --dual --perspectives "charts" "tables"`

### `jimmy ship` — Ship Pipeline
**Replaces**: `ready`, `ship`, `release`
**Full validation before merge.** Use `--wide` to add holistic review for large releases.

```
Standard: verifier → (reviewer + security-auditor) parallel → validator
Wide:     verifier → Wide Review Pipeline → (security-auditor) → validator
```

**Agents**: 4 (standard), 4 + Opus pass (wide)
**Example**: `jimmy ship`
**Example**: `jimmy ship --wide` (large release with many changes)

### `jimmy audit` — Full Codebase Audit
**Maximum parallel review coverage + codebase health.**

```
(reviewer + security-auditor + validator + drift-detector) ALL parallel
```

**Agents**: 4 (all parallel!)
**Example**: `jimmy audit`

---

## Managing Commands

| Command | Action |
|---------|--------|
| `jimmy status` | Session summary |
| `jimmy pending` | Uncommitted changes, failing tests, TODOs |
| `jimmy wrap up` | validator → Jimmy syncs STATUS.md |
| `jimmy continue` | Resume from STATUS.md |

---

## Special Commands

| Command | Action |
|---------|--------|
| `jimmy auto [task]` | Auto-detect workflow from description |
| `jimmy schema [X]` | DB changes: paranoid mode mandatory |
| `jimmy paranoid [X]` | Maximum caution: approval gates on every step |
| `jimmy test [X]` | tester validates against FEATURES.md |
| `jimmy drift` | Run drift-detector for codebase health |
| `jimmy debug [X]` | Jimmy does deep investigation directly (Opus) |
| `jimmy execute PLAN.md` | Execute a plan (`--mode standard|thorough|paranoid`) |

---

## Schema Changes — Always Paranoid

```bash
jimmy schema add-customer-notes
```

```
data-engineer → APPROVAL GATE → security-auditor → APPROVAL GATE → verifier → types
```

**Example**: `jimmy schema add-delivery-tracking`

---

## Execution Modes

| Mode | Applied By | Adds |
|------|------------|------|
| `lightweight` | typo fixes | Minimal validation |
| `standard` | `build`, `fix`, `ship` | Full pipeline |
| `thorough` | `build` (complex), `fix` (no tests) | + validator + module-reviewer |
| `paranoid` | `schema`, `paranoid [X]` | + approval gates + all reviewers |

### Auto-Applied Mode Triggers

| Code Area | Auto Mode |
|-----------|-----------|
| `auth`, `rls`, `policies` | `thorough` minimum |
| `schema`, `migrations` | `paranoid` always |
| `payments`, `invoices` | `thorough` minimum |
| New feature | `standard` |
| Bug fix | `standard` |
| Typo/copy | `lightweight` |

---

## Agent Roster (12 Agents)

| Agent | Model | Purpose |
|-------|-------|---------|
| **jimmy** | Opus | Orchestration, deep debugging, session sync |
| **planner** | Opus | Architecture & planning |
| **context-scout** | Haiku | Fast context gathering |
| **data-engineer** | Sonnet | Schema, migrations, RLS |
| **feature-builder** | Sonnet | Full-stack implementation |
| **verifier** | Sonnet | Run tests until green |
| **reviewer** | Sonnet | Code review + quality pragmatism |
| **module-reviewer** | Sonnet | Systematic module review |
| **security-auditor** | Sonnet | Security & RLS audit |
| **tester** | Sonnet | Feature & UI testing |
| **validator** | Sonnet | Reality check + completion validation |
| **drift-detector** | Sonnet | Codebase health & consistency |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│                JIMMY QUICK REFERENCE                  │
├─────────────────────────────────────────────────────┤
│ CORE                                                 │
│   jimmy build [X]        Build a feature             │
│   jimmy fix [X]          Fix a bug (--urgent)        │
│   jimmy plan [X]         Plan (--dual for two plans) │
│   jimmy review           Code review (--wide)        │
│   jimmy ship             Ship pipeline (--wide)      │
│   jimmy audit            Full codebase audit         │
├─────────────────────────────────────────────────────┤
│ MANAGING                                             │
│   jimmy status           Where are we?               │
│   jimmy pending          What's left?                │
│   jimmy wrap up          End session                 │
│   jimmy continue         Resume work                 │
├─────────────────────────────────────────────────────┤
│ SPECIAL                                              │
│   jimmy auto [task]      Auto-detect workflow        │
│   jimmy schema [X]       DB changes (paranoid)       │
│   jimmy paranoid [X]     Maximum caution             │
│   jimmy test [X]         Test against FEATURES.md    │
│   jimmy drift            Codebase health check       │
│   jimmy debug [X]        Deep investigation (Opus)   │
│   jimmy execute PLAN.md  Run a plan                  │
└─────────────────────────────────────────────────────┘
```

---

## Examples

```bash
# === BUILDING ===
jimmy build customer-portal         # Full feature lifecycle
jimmy build batch-export-button     # Quick addition (auto-detected)
jimmy build reporting-dashboard     # Complex (auto-plans first)

# === FIXING ===
jimmy fix batch-quantity-bug        # Standard fix
jimmy fix auth-expired --urgent     # Urgent production fix
jimmy debug intermittent-failures   # Deep investigation (Opus)

# === REVIEWING ===
jimmy review                        # Quick parallel review
jimmy review --wide                 # Holistic 1M context → Opus sharpening
jimmy audit                         # Full audit + health check

# === SHIPPING ===
jimmy ship                          # Full ship pipeline
jimmy ship --wide                   # Ship with holistic review

# === PLANNING ===
jimmy plan customer-analytics       # Standard planning
jimmy plan reports --dual           # Two competing plans
jimmy dual-plan reports --perspectives "charts" "tables"

# === MANAGING ===
jimmy status                        # Where are we?
jimmy pending                       # What's left?
jimmy wrap up                       # End session
jimmy continue                      # Resume work

# === SPECIAL ===
jimmy auto: users can't see order history
jimmy schema add-delivery-tracking
jimmy paranoid auth-refactor
jimmy drift                         # Codebase health
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

- `.claude/agents/jimmy.md` — Full Jimmy documentation
- `.claude/agents/` — All agent definitions
- `PLAN.md` — Current implementation plan
- `STATUS.md` — Session context
