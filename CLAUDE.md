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

- `module-reviewer.md` - Systematic module review with testing
- `data-engineer.md` - Schema, migrations, RLS, queries
- `security-auditor.md` - Security vulnerability scanning
- `feature-builder.md` - Build features end-to-end
- `verifier.md` - Run tests until green
- `reviewer.md` - Code review before merge
- `sync.md` - Context management

Invoke with: `/agent [name] [task]`
