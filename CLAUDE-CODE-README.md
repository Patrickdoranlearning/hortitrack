# Claude Code Setup for HortiTrack / CanopyB2B

## Quick Start

Copy these files to your project root:

```
your-project/
├── CLAUDE.md                ← Main instructions (Claude reads this automatically)
├── .claude/
│   └── agents/
│       ├── module-reviewer.md
│       ├── data-engineer.md
│       ├── security-auditor.md
│       ├── feature-builder.md
│       ├── verifier.md
│       ├── reviewer.md
│       └── sync.md
├── STATUS.md                ← Session context handoff
└── REVIEW-STATUS.md         ← Module review progress
```

---

## How to Use

### Planning / Architecture
```
/plan Create a production readiness plan for HortiTrack. 
Map all modules, identify risks, suggest review order.
Output to PLAN.md
```

### Module Review
```
/agent module-reviewer

Review the Auth module. Give me:
1. Code audit results
2. Manual testing checklist
3. Issues found
```

### After Testing
```
Test results:
- ✅ Login works
- ❌ Password reset shows no error message

Fix these issues.
```

### Security Audit
```
/agent security-auditor

Scan the entire codebase for security issues.
Focus on auth, RLS, and input validation.
```

### End of Session
```
/agent sync

Update STATUS.md with our progress.
```

---

## Starting a New Session

```
Read STATUS.md and REVIEW-STATUS.md. 
Pick up where we left off.
```

---

## Available Agents

| Agent | Use For |
|-------|---------|
| `module-reviewer` | Systematic module-by-module review |
| `data-engineer` | Schema, migrations, RLS, queries |
| `security-auditor` | Security vulnerability scanning |
| `feature-builder` | Build features end-to-end |
| `verifier` | Run tests until green |
| `reviewer` | Code review before merge |
| `sync` | Save context between sessions |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project standards (auto-read by Claude) |
| `PLAN.md` | Production readiness plan |
| `REVIEW-STATUS.md` | Module review tracker |
| `STATUS.md` | Session handoff notes |
