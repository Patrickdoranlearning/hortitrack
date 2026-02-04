# Agent Optimization Guide

Best practices for writing effective subagent prompts.

---

## Understanding Agent Context (CRITICAL)

### How Context Works

```
┌─────────────────────────────────────────────────────────────────┐
│                 PARENT CONVERSATION                              │
│  • Full message history                                         │
│  • All files read                                               │
│  • All tool results                                             │
│  • User preferences learned                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Task tool invoked
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AGENT CONTEXT (FRESH!)                          │
│  Only contains:                                                 │
│  1. Agent system prompt (.claude/agents/X.md)                  │
│  2. The Task prompt parameter                                   │
│  3. What agent discovers via tools                             │
│                                                                 │
│  Does NOT contain:                                              │
│  ✗ Parent conversation history                                 │
│  ✗ Files parent already read                                   │
│  ✗ Previous agent findings                                     │
│  ✗ User's original request wording                            │
└─────────────────────────────────────────────────────────────────┘
```

### Implications

| Scenario | What Agent Knows |
|----------|------------------|
| Jimmy invokes feature-builder | Only the Task prompt + feature-builder.md |
| Two parallel agents | Each isolated, no shared memory |
| Sequential agents | Each starts fresh (unless explicitly passed context) |
| Resumed agent | Keeps its own history (via `resume` parameter) |

### The Context Problem

```
Bad invocation:
Task(prompt="Fix the bug we discussed")
Agent: "What bug? What did we discuss? I have no context!"

Good invocation:
Task(prompt="""
Fix the auth bug in CustomerForm.tsx:42

**Bug**: getCurrentUser returns null after session refresh
**Root Cause**: Session not awaited properly
**Files Involved**:
- src/components/customers/CustomerForm.tsx (line 42)
- src/lib/auth.ts (getUser function)

**Fix Required**: Add await to session check

**Related Code Already Read**:
[paste the relevant code snippet]
""")
Agent: "I have everything I need to work autonomously!"
```

---

## Context Injection Patterns

### Pattern 1: Embed Context in System Prompt

Put project-specific knowledge IN the agent .md file so it's always available:

```markdown
## HortiTrack-Specific Context

### Module Map
| Module | Path | Purpose |
|--------|------|---------|
| Production | src/app/production/ | Batch management |
| Sales | src/app/sales/ | Orders, customers |

### Auth Pattern (REQUIRED)
\`\`\`typescript
const user = await getCurrentUser()
if (!user) redirect('/auth/login')
\`\`\`

### Database Tables
- batches, orders, customers, invoices...
```

This context is ALWAYS available because it's part of the agent definition.

### Pattern 2: Jimmy Passes Rich Context

Jimmy should construct detailed prompts:

```markdown
## Jimmy's Context Injection Template

When invoking an agent, include:

1. **Task Summary**: What needs to be done
2. **Files Involved**: Specific paths and line numbers
3. **Code Snippets**: Relevant code already read
4. **Constraints**: What NOT to change
5. **Expected Output**: What success looks like
6. **Related Context**: What other agents found

Example:
\`\`\`
Task: Implement batch creation form

**Files to Modify**:
- src/app/production/batches/new/page.tsx (create)
- src/actions/batches.ts (add createBatch action)

**Existing Patterns to Follow**:
[Code snippet from similar form]

**Schema Context** (from data-engineer):
Table: batches
Columns: id, plant_variety_id, quantity, location_id, org_id

**Constraints**:
- Must include org_id scoping
- Follow existing form patterns in src/components/forms/

**Expected Output**:
- Working form component
- Server action with validation
- Success/error handling
\`\`\`
```

### Pattern 3: Structured Handoff Between Agents

When agents run sequentially, pass findings explicitly:

```markdown
## Agent A completes, outputs:
{
  "findings": [...],
  "files_examined": [...],
  "recommendations": [...]
}

## Jimmy reads output, invokes Agent B:
Task(prompt="""
Continue from Agent A's findings:

**Previous Agent Output**:
- Found auth issue in routes.ts:42
- Recommended adding middleware

**Your Task**: Implement the recommended fix

**Files to Modify**: routes.ts

**Code Context**:
[paste relevant code from Agent A's examination]
""")
```

### Pattern 4: Parallel Agents with Shared Input

For turbo mode, give each parallel agent the SAME rich context:

```markdown
## Turbo Review Example

All three agents receive the same context block:

**Module Under Review**: Sales/Orders
**Files**: [list of all files]
**Recent Changes**: [git diff summary]
**Known Issues**: [any context from earlier]

Then each agent focuses on their specialty:
- module-reviewer: Code quality focus
- security-auditor: Security focus
- code-quality-pragmatist: Complexity focus
```

### Pattern 5: Self-Contained Agent Prompts

Agents should be able to work with ZERO parent context by embedding everything they need:

```markdown
## Self-Contained Agent Design

Agent system prompt should include:
1. Complete project context (tables, patterns, conventions)
2. Tool usage instructions (what to grep/glob)
3. Discovery phase (agent finds what it needs)
4. Output format (structured, parseable)

This way, even with minimal Task prompt, agent can discover context itself.
```

---

## Jimmy's Context Injection Protocol

Jimmy should ALWAYS construct Task prompts with:

```markdown
## Context Block Template

**Task**: [Clear description]
**Type**: [Feature/Bug/Review/Schema]
**Priority**: [P0/P1/P2]

**Files Involved**:
- [path:lines] - [why relevant]

**Code Context**:
\`\`\`typescript
// Relevant code snippets
\`\`\`

**Schema Context** (if applicable):
- Tables: [list]
- Relationships: [describe]

**Previous Agent Findings** (if any):
- [Agent]: [finding]

**User's Original Request**:
> [Quote the user's words]

**Constraints**:
- [What NOT to do]

**Success Criteria**:
- [How we know it's done]
```

---

## The 9 Elements of a High-Performance Agent

### 1. Clear Role Identity
Tell the agent WHO they are, not just what they do.

**Weak:**
```markdown
You audit security issues.
```

**Strong:**
```markdown
You are **SecBot**, a senior security engineer with 10 years of experience
auditing production systems. You think like an attacker but act like a defender.
You are paranoid by design - you assume every input is malicious until proven safe.
```

---

### 2. Tool Usage Instructions
Agents don't know which tools to use unless you tell them. Be explicit.

**Weak:**
```markdown
Check the codebase for issues.
```

**Strong:**
```markdown
## Required Tool Usage

**Discovery Phase** (do ALL of these):
1. Use `Grep` to find all auth patterns:
   - `grep -r "createClient" --include="*.ts"` → Find Supabase clients
   - `grep -r "getUser|getSession" --include="*.ts"` → Find auth checks
   - `grep -r "service_role" --include="*.ts"` → Find dangerous keys

2. Use `Glob` to identify attack surface:
   - `glob "src/app/api/**/*.ts"` → All API routes
   - `glob "src/actions/**/*.ts"` → All server actions

3. Use `Read` to examine each file found
```

---

### 3. Structured Output Format
Give a template so Jimmy can parse results consistently.

**Weak:**
```markdown
Report any issues found.
```

**Strong:**
```markdown
## Output Format (ALWAYS use this structure)

```json
{
  "status": "pass" | "fail" | "warning",
  "critical_count": 0,
  "high_count": 0,
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "file": "src/app/api/orders/route.ts",
      "line": 42,
      "issue": "Missing auth check on POST handler",
      "risk": "Any user can create orders for any org",
      "fix": "Add `const user = await getUser(request)` at line 40",
      "code_before": "export async function POST(req) {",
      "code_after": "export async function POST(req) {\n  const user = await getUser(req)\n  if (!user) return unauthorized()"
    }
  ],
  "summary": "2 critical issues require immediate attention"
}
```

If status is "fail", Jimmy should NOT proceed to merge.
```

---

### 4. Good vs Bad Examples
Show the agent what success looks like.

**Weak:**
```markdown
Find security issues.
```

**Strong:**
```markdown
## Examples

### Good Finding (Actionable)
**Issue**: Missing auth in API route
**File**: src/app/api/orders/route.ts:15
**Risk**: Unauthenticated users can access order data
**Fix**: Add auth check before data access
```typescript
// Before (vulnerable)
export async function GET(req: Request) {
  const orders = await db.query('SELECT * FROM orders')
  return Response.json(orders)
}

// After (secure)
export async function GET(req: Request) {
  const user = await getUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  const orders = await db.query('SELECT * FROM orders WHERE org_id = $1', [user.org_id])
  return Response.json(orders)
}
```

### Bad Finding (Vague, unhelpful)
**Issue**: Code looks insecure
**File**: somewhere
**Fix**: Make it more secure

This is useless. Be specific.
```

---

### 5. Project-Specific Context
Embed domain knowledge so the agent understands YOUR codebase.

**Weak:**
```markdown
Check for security issues in the code.
```

**Strong:**
```markdown
## HortiTrack-Specific Security Context

**Multi-Tenancy Model**:
- All data is scoped by `org_id`
- RLS policies MUST filter by org_id
- Cross-org data leakage is a CRITICAL severity

**Auth Pattern** (must be followed):
```typescript
// Server action pattern
const user = await getCurrentUser()
if (!user) redirect('/auth/login')
const orgId = user.org_id // Always scope queries by this

// API route pattern
const session = await getServerSession(authOptions)
if (!session) return unauthorized()
```

**Known Danger Zones**:
- `src/lib/supabase/admin.ts` - Uses service_role key, NEVER import in client
- `src/app/api/webhooks/*` - External webhooks, verify signatures
- Any file touching `invoices`, `payments` - Financial data, extra scrutiny
```

---

### 6. Constraints (Anti-Patterns)
Tell the agent what NOT to do.

```markdown
## Constraints

**NEVER**:
- Skip files because they "look fine"
- Assume auth is handled elsewhere without verifying
- Mark as "pass" if you couldn't check something
- Suggest removing RLS policies
- Recommend disabling security for convenience

**ALWAYS**:
- Check the ENTIRE flow, not just individual files
- Verify RLS policies match the claimed behavior
- Flag uncertainty as "needs review" not "pass"
- Include line numbers in all findings
```

---

### 7. Handoff Protocol
How does the agent communicate results to Jimmy?

```markdown
## Handoff to Jimmy

After completing audit, provide a **decision block**:

```markdown
## Security Audit Decision

**Verdict**: PASS / FAIL / CONDITIONAL

**If FAIL**:
- Block merge until [list critical issues] resolved
- Route to: `feature-builder` for fixes

**If CONDITIONAL**:
- Can proceed with: [list acceptable risks]
- Must address before production: [list items]

**If PASS**:
- Safe to proceed to next pipeline stage
```

Jimmy reads this block to decide routing.
```

---

### 8. Success Criteria
How does the agent know it's done?

```markdown
## Completion Checklist

Before reporting results, verify:

- [ ] All API routes examined (count: X)
- [ ] All server actions examined (count: X)
- [ ] All Supabase queries checked for RLS
- [ ] Auth flow traced end-to-end
- [ ] No service_role key in client code
- [ ] Input validation present on all forms
- [ ] Findings include file:line references

If any box unchecked, continue auditing.
```

---

### 9. Escalation Rules
When should the agent stop and ask for help?

```markdown
## Escalation Rules

**STOP and ask Jimmy** if:
- You find a critical vulnerability (data breach risk)
- You're unsure if something is intentional
- The codebase structure is unfamiliar
- Auth patterns are inconsistent across files

**Auto-escalate to `ultrathink-debugger`** if:
- Complex auth flow with multiple handoffs
- RLS policy behavior is unclear
- Suspected but unconfirmed vulnerability

**Never proceed silently** when uncertain.
```

---

## Quick Template for New Agents

```markdown
---
name: agent-name
description: One-line description
capabilities: comma, separated, list
outputs: what-it-produces
---

# [Agent Name]: The [Role Title]

You are **[Name]**, [identity + expertise + personality].

---

## Core Philosophy
1. [Principle 1]
2. [Principle 2]
3. [Principle 3]

---

## When Invoked
Jimmy routes to you when:
- [Trigger 1]
- [Trigger 2]

You do NOT:
- [Anti-responsibility 1]
- [Anti-responsibility 2]

---

## Required Tool Usage

**Phase 1: Discovery**
```
Use Grep: [patterns]
Use Glob: [patterns]
```

**Phase 2: Analysis**
```
Use Read: [what to examine]
```

---

## Output Format

[Structured template with JSON/Markdown]

---

## Project-Specific Context

[Domain knowledge embedded]

---

## Examples

### Good Output
[Example]

### Bad Output
[Anti-example]

---

## Constraints

**NEVER**: [list]
**ALWAYS**: [list]

---

## Handoff Protocol

[How to report to Jimmy]

---

## Completion Checklist

- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

## Escalation Rules

**STOP** if: [conditions]
**Ask** if: [conditions]

---

*[Closing philosophy statement]*
```

---

## Optimization Checklist

Before deploying an agent, verify:

| Element | Present? | Quality |
|---------|----------|---------|
| Role identity | [ ] | Clear personality and expertise? |
| Tool usage | [ ] | Explicit Grep/Glob/Read instructions? |
| Output format | [ ] | Structured, parseable template? |
| Examples | [ ] | Good AND bad examples? |
| Project context | [ ] | Domain-specific knowledge? |
| Constraints | [ ] | Clear NEVER/ALWAYS rules? |
| Handoff protocol | [ ] | Jimmy can parse the decision? |
| Success criteria | [ ] | Agent knows when done? |
| Escalation rules | [ ] | Agent knows when to stop? |

Score: X/9 elements present

**Target**: 7+ for critical agents, 5+ for utility agents
