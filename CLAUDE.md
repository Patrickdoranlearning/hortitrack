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
- Even smaller tasks get mini-plans via `jimmy new [X]` or `jimmy bugfix [X]`

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
| `FEATURES.md` | Source of truth for feature behavior (Tester Tim validates against this) |
| `.claude/plans/` | All active implementation plans |
| `.claude/plans/completed/` | Archive of completed plans |
| `REVIEW-STATUS.md` | Module review progress tracker |
| `STATUS.md` | Session context handoff |
| `.claude/agents/` | Specialized agent definitions |

---

## Custom Agents

Available agents in `.claude/agents/`:

### Coordinator
- `jimmy` - Lead coordinator & workflow architect
  - Routes tasks to specialized agents
  - Manages pipelines and execution modes
  - Guards database schema via `data-engineer`
  - See `.claude/jimmy-commands.md` for quick commands

### Core Workflow Agents
- `planner` - Architecture & implementation planning, writes to PLAN.md
- `module-reviewer` - Systematic module review with manual testing checkpoints
- `data-engineer` - Schema, migrations, RLS, queries
- `security-auditor` - Security vulnerability scanning
- `feature-builder` - Build features end-to-end
- `verifier` - Run tests until green
- `reviewer` - Code review before merge
- `sync` - Context management

### Quality & Validation Agents
- `tester-tim` - Feature validation against FEATURES.md specifications
- `ultrathink-debugger` - Deep debugging with systematic root cause analysis (uses Opus)
- `karen` - Reality check: validates actual vs claimed completion status
- `task-completion-validator` - Verifies features actually work end-to-end
- `code-quality-pragmatist` - Identifies over-engineering, promotes simplicity
- `ui-comprehensive-tester` - Thorough UI testing and validation

### Jimmy Quick Commands

Commands organized by intent:

```
# === BUILDING ===
jimmy new [X]        # Full feature: plan → build → test → review (5-6 agents)
jimmy add [X]        # Quick add: build → verify → test (3-4 agents)
jimmy feature [X]    # Complete lifecycle with max parallelism (8-10 agents)

# === FIXING ===
jimmy fix [X]        # Standard: explore → fix → verify → test
jimmy hotfix [X]     # Urgent: fix → verify → ship (parallel)
jimmy debug [X]      # Deep investigation: ultrathink + explore parallel
jimmy bugfix [X]     # Complete lifecycle: investigate → fix → validate

# === REVIEWING ===
jimmy check          # Quick: 2 reviewers parallel
jimmy audit          # Full: ALL 4 reviewers parallel
jimmy turbo review   # Fast: 3 reviewers parallel

# === SHIPPING ===
jimmy ready          # Pre-merge: verifier → 3 reviewers parallel
jimmy ship           # Full ship pipeline → sync
jimmy release        # Maximum validation for releases

# === PLANNING ===
jimmy plan [X]       # Explore → planner → PLAN.md
jimmy turbo plan [X] # 3 parallel explores → planner (faster!)
jimmy dual-plan [X]  # 2 competing plans → synthesize best
jimmy execute PLAN.md           # Run the plan
jimmy execute PLAN.md --mode X  # thorough | paranoid

# === MANAGING ===
jimmy status         # Session summary
jimmy pending        # Uncommitted changes, TODOs
jimmy wrap up        # Validate → sync
jimmy continue       # Resume from STATUS.md

# === SPECIAL ===
jimmy auto [task]    # Auto-detect workflow from description
jimmy schema [X]     # DB changes (paranoid mode)
jimmy test [X]       # Validate against FEATURES.md
jimmy paranoid [X]   # Maximum caution mode
```

### Usage Examples
```
# Complete feature lifecycle (8-10 agents, heavily parallelized)
jimmy feature customer-portal

# Quick addition to existing functionality
jimmy add export-button-to-reports

# Bug fix with full investigation
jimmy bugfix order-total-not-calculating

# Urgent production fix
jimmy hotfix auth-session-expired

# Full audit before release (4 reviewers in parallel)
jimmy audit

# Ready to ship
jimmy ship

# Let Jimmy figure out what to do
jimmy auto: users can't see their order history

# Deep debugging
jimmy debug intermittent-order-failures

# Database changes (always paranoid mode)
jimmy schema add-customer-notes

# Two competing plans
jimmy dual-plan reports --perspectives "MVP speed" "proper architecture"
```
