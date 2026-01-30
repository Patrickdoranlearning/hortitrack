# Jimmy Quick Commands

Quick reference for the Jimmy coordinator agent.

---

## Core Commands

| Command | What It Does |
|---------|--------------|
| `jimmy quick fix` | Direct fix → `verifier` only |
| `jimmy fix this` | Medic Pipeline (debug → fix → verify) |
| `jimmy build [X]` | Feature Flow Pipeline |
| `jimmy schema [X]` | Schema Pipeline (mandatory for DB changes) |
| `jimmy review` | `module-reviewer` → `security-auditor` |
| `jimmy pre-merge` | Shield Pipeline |
| `jimmy ship it` | Shield Pipeline → `sync` |
| `jimmy status` | Session state summary |
| `jimmy pending` | List uncommitted changes, failing tests, TODOs |
| `jimmy wrap up` | `task-completion-validator` → `karen` → `sync` |
| `jimmy paranoid [X]` | Full audit mode for critical changes |
| `jimmy help` | Show this command list |

## Planning Commands

| Command | What It Does |
|---------|--------------|
| `jimmy plan [X]` | Route to `planner` → produces PLAN.md |
| `jimmy journey` | Describe a user journey → planner parses and plans |
| `jimmy execute PLAN.md` | Execute plan with standard mode |
| `jimmy execute PLAN.md --mode thorough` | Execute with thorough mode |
| `jimmy execute PLAN.md --mode paranoid` | Execute with paranoid mode |
| `jimmy execute PLAN-[name].md` | Execute a specific named plan |
| `jimmy plan status` | Show progress against current PLAN.md |
| `jimmy plan status --all` | Show all plans and their status |

---

## Execution Modes

| Mode | When to Use | Process Level |
|------|-------------|---------------|
| `lightweight` | Typos, copy changes | Fix + verifier |
| `standard` | Normal features, bugs | Full pipeline |
| `thorough` | Pre-release, risky | + karen + module-reviewer |
| `paranoid` | Schema, auth, payments | + security-auditor + approval gates |

---

## Mode Triggers

| Code Area | Minimum Mode |
|-----------|--------------|
| `auth`, `rls`, `policies` | `thorough` |
| `schema`, `migrations` | `paranoid` |
| `payments`, `invoices`, `pricing` | `thorough` |
| New feature | `standard` |
| Bug fix with tests | `standard` |
| Bug fix without tests | `thorough` |
| Typo/copy change | `lightweight` |

---

## Pipeline Reference

| Pipeline | Steps |
|----------|-------|
| **Planning** | planner → PLAN.md → jimmy execute |
| **Feature Flow** | [data-engineer] → feature-builder → verifier → validator |
| **Schema** | data-engineer → security-auditor → verifier → regen types |
| **Medic** | [debugger] → fix → verifier → [ui-tester] |
| **Shield** | verifier → module-reviewer → security-auditor → karen |
| **Full Review** | module-reviewer → security-auditor → verifier → validator → karen → sync |
| **Paranoid** | Each step has approval gate |

---

## Auto-Invoke Triggers

| Event | Jimmy Auto-Invokes |
|-------|-------------------|
| Feature complete | `task-completion-validator` |
| Bug fix applied | `verifier` |
| Schema change | `security-auditor` |
| User says "done" | `karen` |
| Session ending | `sync` |
| `verifier` fails 3x | `ultrathink-debugger` |

---

## Examples

```
# Fix a simple typo
jimmy quick fix

# Build a new batch management feature
jimmy build batch-management

# Add a new database table
jimmy schema add-trials-table

# Plan a complex new feature
jimmy plan customer-portal

# Describe a user journey (planner will ask follow-up questions)
jimmy journey
# Then describe: "As a grower, I scan a batch, see its history, update status..."

# Execute the plan you created
jimmy execute PLAN.md

# Execute with extra validation
jimmy execute PLAN.md --mode thorough

# Check plan progress
jimmy plan status

# Before merging a PR
jimmy pre-merge

# End of session
jimmy wrap up

# Critical auth changes
jimmy paranoid auth-refactor
```

---

## Stop Conditions

Jimmy will **HALT** if:
- RLS would expose data across orgs
- Migration deletes production data
- Auth bypass detected
- Breaking API change without versioning

---

See `.claude/agents/jimmy.md` for full documentation.
