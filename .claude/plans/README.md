# Plans Directory

This folder contains all implementation plans for HortiTrack/CanopyB2B development.

## Structure

```
.claude/plans/
├── README.md                    # This file
├── PLAN.md                      # Current active plan (if any)
├── PLAN-[feature-name].md       # Named plans for specific features
├── MINI-[task-name].md          # Lightweight plans for smaller tasks
└── completed/                   # Archive of completed plans
    ├── PLAN-[feature]-DONE.md
    └── MINI-[task]-DONE.md
```

## Plan Types

### Full Plans (`PLAN-*.md`)
For features requiring:
- Multiple phases
- Database changes
- 3+ sessions of work
- Multiple agents

Created by: `jimmy plan [X]`, `jimmy turbo plan [X]`, `jimmy dual-plan [X]`

### Mini Plans (`MINI-*.md`)
For smaller tasks requiring:
- Tracking progress
- 1-2 sessions of work
- Clear scope

Created by: `jimmy new [X]`, `jimmy add [X]`, `jimmy bugfix [X]`

## Workflow

### Creating Plans
```
jimmy plan [feature]           # Standard plan
jimmy turbo plan [feature]     # Fast plan with parallel explores
jimmy dual-plan [feature]      # Two competing plans (RECOMMENDED for complex features)
```

### Working with Plans
```
jimmy execute PLAN-[name].md   # Start executing a plan
jimmy plan status              # Check progress
jimmy plan status --all        # See all plans
```

### Completing Plans
When a plan is complete:
1. Jimmy marks status as "Complete"
2. Plan is moved to `completed/` folder
3. Filename gets `-DONE` suffix

```
# Automatic on completion:
mv PLAN-customer-portal.md completed/PLAN-customer-portal-DONE.md
```

## Plan-First Development

**Every non-trivial task should have a plan.**

Why:
- Tracks progress across sessions
- Prevents scope creep
- Enables handoff via STATUS.md
- Documents decisions made
- Shows what's been done vs. what's left

### When to Create Plans

| Task Type | Plan Type | Command |
|-----------|-----------|---------|
| New feature (complex) | Full | `jimmy dual-plan [X]` |
| New feature (simple) | Mini | `jimmy new [X]` |
| Bug fix (complex) | Mini | `jimmy bugfix [X]` |
| Bug fix (simple) | None | `jimmy fix [X]` |
| Schema change | Full | `jimmy schema [X]` |
| Refactoring | Full | `jimmy plan [X]` |

### Dual-Plan (Recommended for Complex Features)

For any feature where the approach isn't obvious, use dual-plan:

```
jimmy dual-plan [feature]
jimmy dual-plan [feature] --perspectives "MVP speed" "proper architecture"
```

This runs two planners in parallel with different perspectives, then synthesizes the best approach. Results in better plans because:
- Forces consideration of alternatives
- Surfaces trade-offs explicitly
- Avoids tunnel vision
- Documents why chosen approach was selected

## Active Plans Quick Reference

To see all active plans:
```bash
ls -la .claude/plans/*.md
```

To see completed plans:
```bash
ls -la .claude/plans/completed/
```

## Plan Template Reference

See `.claude/agents/planner.md` for the full plan template.

Key sections:
- Overview & Problem Statement
- Requirements (P0/P1/P2)
- Technical Design (with Mermaid diagrams)
- Implementation Phases
- Risks & Mitigations
- Definition of Done
- Handoff Notes
