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

### Planning
- Use `/plan` for architecture and design work
- Output plans to `PLAN.md` with P0/P1/P2 priorities
- Track progress in `REVIEW-STATUS.md`

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
| `PLAN.md` | Current production readiness plan |
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
- `ultrathink-debugger` - Deep debugging with systematic root cause analysis (uses Opus)
- `karen` - Reality check: validates actual vs claimed completion status
- `task-completion-validator` - Verifies features actually work end-to-end
- `code-quality-pragmatist` - Identifies over-engineering, promotes simplicity
- `ui-comprehensive-tester` - Thorough UI testing and validation

### Jimmy Quick Commands
```
jimmy quick fix      # Fix → verifier only
jimmy fix this       # Medic Pipeline (debug → fix → verify)
jimmy build [X]      # Feature Flow Pipeline
jimmy schema [X]     # Schema Pipeline (mandatory for DB)
jimmy plan [X]       # Route to planner → produces PLAN.md
jimmy execute PLAN.md           # Execute plan (standard mode)
jimmy execute PLAN.md --mode X  # Execute with specific mode
jimmy plan status    # Show plan progress
jimmy review         # module-reviewer → security-auditor
jimmy pre-merge      # Shield Pipeline
jimmy ship it        # Shield Pipeline → sync
jimmy status         # Session state summary
jimmy wrap up        # validator → karen → sync
jimmy paranoid [X]   # Full audit mode
```

### Usage Examples
```
# Plan a complex feature (creates PLAN.md)
Ask: "jimmy plan customer-reporting-dashboard"

# Execute the plan
Ask: "jimmy execute PLAN.md"

# Deep debugging a tricky issue
Ask: "Use the ultrathink-debugger to investigate why orders aren't saving"

# Reality check on claimed completion
Ask: "Use karen to assess the actual state of the auth implementation"

# Validate a feature is truly complete
Ask: "Use task-completion-validator to verify the batch creation feature"

# Review for over-engineering
Ask: "Use code-quality-pragmatist to review the inventory module"

# Systematic UI testing
Ask: "Use ui-comprehensive-tester to test the sales order wizard"

# Use Jimmy to coordinate
Ask: "jimmy build new-trials-feature"
Ask: "jimmy schema add-customer-notes"
Ask: "jimmy pre-merge"
```
