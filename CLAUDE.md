# HortiTrack / CanopyB2B Development Guidelines

> This file provides Claude Code with project context and standards.

## Project Overview

- **HortiTrack**: Nursery management system (50+ polytunnels, 200+ plant varieties)
- **CanopyB2B**: B2B horticultural marketplace for Ireland/UK
- **Stack**: Next.js, TypeScript, Supabase, Tailwind

---

## Production Standards

### Error Handling
- No `console.log` in production code - use structured logging
- All async functions need try/catch with user-facing error states
- API routes must return appropriate HTTP status codes
- Database operations need transaction handling where appropriate

### Type Safety
- Zero `any` types - use strict TypeScript interfaces
- All API boundaries validated with Zod schemas
- Database queries must be typed (Supabase generated types)
- Props and function parameters must have explicit types

### Security
- Check auth on ALL server actions and API routes
- Validate and sanitize all user inputs
- No hardcoded secrets - use environment variables
- Row Level Security (RLS) policies for all Supabase tables

### Database / Supabase
- Every table MUST have RLS enabled
- Use parameterized queries only - no string concatenation
- Handle `.error` on every Supabase query
- Use `.single()` when expecting one row
- Include proper indexes for frequently queried columns

### React / Next.js
- No memory leaks in useEffect - cleanup subscriptions
- Loading and error states for all async operations
- Proper Suspense boundaries for streaming
- Avoid N+1 query patterns - batch where possible

---

## Workflow

### Plan-First Development (CRITICAL)
**Every non-trivial task should have a plan.** Plans prevent lost context.

- Plans live in `.claude/plans/`
- Completed plans archived to `.claude/plans/completed/`
- Use `jimmy dual-plan [X]` for complex features (RECOMMENDED)
- Use `jimmy plan [X]` for standard features
- Even smaller tasks get mini-plans via `jimmy build [X]` or `jimmy fix [X]`

### Dual-Plan (Recommended for Complex Features)
```
jimmy dual-plan [feature]
jimmy dual-plan [feature] --perspectives "MVP speed" "proper architecture"
```
Runs two planners with different perspectives, then synthesizes the best approach.

### Module Reviews
- One module at a time
- Code audit → Manual testing → Fix issues → Re-test
- Update `REVIEW-STATUS.md` after each module

### Context Handoff
- Update `STATUS.md` at end of each session
- Reference `STATUS.md` at start of new sessions

---

## Key Files

| File | Purpose |
|------|---------|
| `FEATURES.md` | Source of truth for feature behavior (tester validates against this) |
| `.claude/plans/` | All active implementation plans |
| `.claude/plans/completed/` | Archive of completed plans |
| `REVIEW-STATUS.md` | Module review progress tracker |
| `STATUS.md` | Session context handoff |
| `.claude/agents/` | Specialized agent definitions |
| `.claude/reports/` | Persistent agent reports (drift, security, test) — enables trend tracking |

---

## Custom Agents (12 Agents — Opus 4.6 Architecture)

Available agents in `.claude/agents/`:

### Coordinator
- `jimmy` (Opus) - Lead coordinator, deep debugging, session sync
  - Routes tasks to specialized agents
  - Handles complex debugging directly (no separate debugger)
  - Manages session sync inline (no separate sync agent)
  - Guards database schema via `data-engineer`
  - See `.claude/jimmy-commands.md` for quick commands

### Planning & Context
- `planner` (Opus) - Architecture & implementation planning, writes to PLAN.md
- `context-scout` (Haiku) - Fast context gathering before other agents start work

### Building
- `data-engineer` - Schema, migrations, RLS, queries
- `feature-builder` - Build features end-to-end
- `verifier` - Run tests until green

### Reviewing
- `reviewer` - Code review + quality pragmatism. `--wide` mode: Sonnet 1M context overview → Opus sharpening
- `module-reviewer` - Systematic module review with manual testing checkpoints
- `security-auditor` - Security vulnerability scanning, RLS audit

### Validating
- `tester` - Feature & UI testing against FEATURES.md specifications
- `validator` - Reality check + completion validation + scope creep detection
- `drift-detector` - Architectural consistency & tech debt radar

### Jimmy Quick Commands

6 core commands (Jimmy auto-detects scope — no need to pick the right variant):

```
# === CORE ===
jimmy build [X]      # Build a feature (auto-detects scope)
jimmy fix [X]        # Fix a bug (--urgent for hotfix)
jimmy plan [X]       # Plan a feature (--dual for competing plans)
jimmy review         # Code review (auto-scales depth, --wide for 1M context)
jimmy ship           # Full ship pipeline (--wide for holistic review)
jimmy audit          # Full codebase audit (4 agents parallel)

# === MANAGING ===
jimmy status         # Session summary
jimmy pending        # Uncommitted changes, TODOs
jimmy wrap up        # Validate → sync STATUS.md
jimmy continue       # Resume from STATUS.md

# === SPECIAL ===
jimmy auto [task]    # Auto-detect workflow from description
jimmy schema [X]     # DB changes (paranoid mode)
jimmy debug [X]      # Deep investigation (Opus)
jimmy test [X]       # Validate against FEATURES.md
jimmy drift          # Codebase health check
jimmy paranoid [X]   # Maximum caution mode
jimmy execute PLAN.md           # Run the plan
jimmy execute PLAN.md --mode X  # thorough | paranoid
```

### Usage Examples
```
# Build a feature (Jimmy auto-detects scope)
jimmy build customer-portal

# Fix a bug (auto-detects severity)
jimmy fix order-total-not-calculating

# Urgent production fix
jimmy fix auth-session-expired --urgent

# Full audit + codebase health
jimmy audit

# Holistic review (Sonnet 1M context → Opus sharpening)
jimmy review --wide

# Ship it
jimmy ship
jimmy ship --wide                # Large release with holistic review

# Let Jimmy figure out what to do
jimmy auto: users can't see their order history

# Deep debugging (Opus-powered)
jimmy debug intermittent-order-failures

# Database changes (always paranoid mode)
jimmy schema add-customer-notes

# Two competing plans (recommended for complex features)
jimmy dual-plan reports --perspectives "MVP speed" "proper architecture"

# Codebase health check
jimmy drift
```
