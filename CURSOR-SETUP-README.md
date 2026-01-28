# Cursor AI Setup for HortiTrack / CanopyB2B

## Quick Start

Copy these files to your project root:

```
your-project/
├── .cursor/
│   ├── rules/
│   │   ├── production.mdc    # Always-on production standards
│   │   ├── architect.mdc     # Planning mode behavior
│   │   └── supabase.mdc      # Database best practices
│   └── agents/
│       ├── feature-builder.md  # Build features end-to-end
│       ├── verifier.md         # Run tests until green
│       ├── security-auditor.md # Security audit
│       ├── reviewer.md         # Code review
│       └── sync.md             # Context management
├── .cursorignore             # Files to exclude from AI context
└── STATUS.md                 # Project memory between sessions
```

## How to Use

### Rules (Active Now)
Rules in `.cursor/rules/` work immediately:
- `production.mdc` - Applied to all source files automatically
- `architect.mdc` - Applied when touching PLAN.md, AUDIT.md, docs/
- `supabase.mdc` - Applied when touching database files

### Agents (When Bug is Fixed)
Custom agents in `.cursor/agents/` will work once Cursor fixes the Task tool bug.
For now, you can @ mention the files directly:
```
@.cursor/agents/reviewer.md Review the changes in src/api/orders.ts
```

## Recommended Workflow

### 1. Planning (Use Opus)
```
Switch to Plan Mode
Model: Claude 4.5 Opus (or GPT for comparison)
Enable MAX Mode for full codebase visibility

Prompt: "@Codebase Create an AUDIT.md for production readiness. 
Check security, error handling, and type safety."
```

### 2. Execution (Use faster model)
```
Switch to Agent Mode  
Model: Gemini 3 Flash or Composer

Prompt: "Fix the P0 issues from AUDIT.md, starting with auth"
```

### 3. Verification
```
Prompt: "Run npm test and npm run typecheck. Fix any failures."
```

### 4. Session End
```
Prompt: "Update STATUS.md with what we accomplished and next steps"
```

## Context Management

### Starting a New Session
```
@STATUS.md What's the current state? What should I focus on?
```

### If Context Gets Too Long
```
Summarize our progress and update STATUS.md, then I'll start fresh
```

### For Deep Audit (Use MAX Mode)
```
@Codebase Review the entire auth flow from login to protected routes.
Check for: missing auth checks, RLS gaps, token handling issues.
```

## Prompt Templates

### Production Audit
```
@Codebase Perform a production readiness audit. Check:
1. Security: auth, RLS, input validation
2. Error handling: try/catch, user feedback, edge cases
3. Type safety: any types, missing validation
4. Performance: N+1 queries, missing indexes

Output to AUDIT.md with P0/P1/P2 priority levels.
```

### Security-Focused Review
```
@Codebase Act as a security engineer. Review:
- All API routes for auth checks
- Supabase RLS policies
- Input validation on forms
- Hardcoded secrets or exposed env vars

Flag anything that could be exploited.
```

### Fix Loop
```
Run npm run typecheck && npm run lint && npm test
Fix any errors, then run again. 
Don't stop until everything passes.
```

## Notes

- **MAX Mode**: Use for audits and planning. Expensive but sees everything.
- **Standard Mode**: Use for focused feature work. Faster and cheaper.
- **Plan Mode**: For architecture and design. Outputs plans, not code.
- **Agent Mode**: For implementation. Edits files and runs commands.

## Troubleshooting

### "Agent won't use my custom subagent"
The Task tool for custom agents is currently bugged. Use @ mention instead:
```
@.cursor/agents/feature-builder.md Build the user settings page
```

### "Context too long / slow responses"
1. Make sure .cursorignore excludes node_modules, .next, etc.
2. Start a new chat and reference @STATUS.md
3. Use Standard Mode instead of MAX Mode for routine work
