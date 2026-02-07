# Drift Report: 2026-02-07

## Overall Health: IMPROVED

**Context**: This report analyzes uncommitted changes from the module-review-fixes session (PLAN-module-review-fixes-2026-02-07.md) that addressed 44 issues across 4 modules. 34 files changed, +1131 / -437 lines.

---

## Pattern Consistency

### Logging: TWO competing utilities (Drift Concern)

| Logger | Import | Used by | Modules |
|--------|--------|---------|---------|
| `@/lib/log` | `logError`, `logWarning`, `logInfo` | 24 server files | batches, sales, materials, production, tasks |
| `@/server/utils/logger` | `logger.dispatch.info()` etc. | 12 server files | dispatch, security, http, allocation |

**Finding**: The session converted ~40 `console.error/log` calls to `logError/logWarning` from `@/lib/log`. However, `board-actions.ts` (dispatch module) still uses `logger` from `@/server/utils/logger` alongside the new `logError` calls in sibling files.

**Impact**: Medium. Both utilities ultimately call `console.*` under the hood, but `@/server/utils/logger` adds module context, JSON formatting in production, and structured error objects. `@/lib/log` is simpler but less informative in production.

**Recommendation**: Converge on `@/server/utils/logger` as the canonical structured logger. `@/lib/log` should be a thin re-export or deprecated.

### Auth Patterns: CONSISTENT after changes

| Pattern | Files | Usage |
|---------|-------|-------|
| `getUserAndOrg()` | 35 server files | Primary auth + org context extraction |
| `createClient()` (raw) | 19 server files | Some still use raw client (mostly unchanged files) |

**Finding**: The session correctly replaced 15 `createClient()` calls with `getUserAndOrg()` in `board-actions.ts` and added `getUserAndOrg()` to `queries.server.ts`. This is the right direction.

**Remaining gap**: 19 server files still use raw `createClient()` without explicit `getUserAndOrg()`. Some are legitimate (e.g., `supabaseAdmin.ts`, `supabaseBrowser.ts`, `auth/org.ts`), but files like `batches/service.ts`, `batches/flags.ts`, `batches/lookup.ts` still use `createClient()` directly.

### Type Safety: SIGNIFICANTLY IMPROVED

| Concern | Before | After |
|---------|--------|-------|
| `as any` in src/server/ | ~64 | ~34 (47% reduction) |
| `as any` in src/app/ | ~195 | ~195 (unchanged -- outside scope) |
| Typed row interfaces | 0 (in picking.ts) | 15 new interfaces in picking.ts |
| RPC result types | 0 (in allocation-actions.ts) | 9 new interfaces in allocation-actions.ts |

**Finding**: The session added ~24 new typed interfaces to replace `as any` casts. The `as unknown as TypedInterface` pattern is used consistently as the bridge between Supabase's loose return types and strict TypeScript.

**Remaining `as any` in changed files**:
- `src/server/dispatch/board-actions.ts` lines 64, 82: `{ assigned_user_id: pickerId } as any` -- justified because `assigned_user_id` column may not exist in the schema yet (guarded by error code `42703` check).
- `src/server/batches/route.ts` line 68: `new Date(v as any)` -- pre-existing, minor.

### Data Fetching: CONSISTENT

All server-side data fetching uses Supabase client (either `createClient()` or `getUserAndOrg().supabase`). No instances of raw `fetch()` or `axios` found in the changed files. Consistent pattern maintained.

### Error Handling: CONSISTENT after changes

All changed files follow the pattern:
1. Supabase query with `.error` check
2. `logError()`/`logWarning()` with structured metadata
3. Either throw or return error object

One improvement: `removeBatchPick` now properly hard-fails on `restoreError` instead of logging and continuing (was a data integrity bug).

---

## Dead Code Removed

| Item | File | Description |
|------|------|-------------|
| Dead code in `removeBatchPick` | `src/server/sales/picking.ts` | Removed non-functional `supabase.rpc("increment_quantity")` call inside a `.update()` that would never work |
| `roundToTwo` duplicate #1 | `src/app/sales/actions.ts` | Removed local definition, now imports from `@/lib/utils` |
| `roundToTwo` duplicate #2 | `src/app/sales/orders/[orderId]/actions.ts` | Removed local definition, now imports from `@/lib/utils` |
| `dispatch_email_sent_at` false flag | `src/app/sales/actions.ts` | Removed setting of `dispatch_email_sent_at` timestamp and fake "email sent" event |
| `console.log` debug stmts | `src/app/sales/products/groups/ProductGroupsClient.tsx` | 3 debug `console.log` statements removed |
| Unused `Supplier` import | `src/server/sales/queries.server.ts` | Removed unused type import |

---

## Multi-Tenancy (org_id) Analysis

### Functions Now Protected

| File | Functions with org_id added | Severity of gap |
|------|---------------------------|-----------------|
| `src/server/dispatch/board-actions.ts` | 15 functions (all) | CRITICAL -- was using raw `createClient()` with no org scoping |
| `src/server/sales/queries.server.ts` | `listOrders`, `getOrderById`, `getCustomers` | HIGH -- order/customer listing had no org filter |
| `src/server/batches/archive.ts` | `archiveBatch` | HIGH -- could archive any org's batch |
| `src/server/batches/stock-movements.ts` | `buildStockMovements` | MEDIUM -- optional orgId param |
| `src/server/batches/history.ts` | `buildBatchHistory` | MEDIUM -- optional orgId param |
| `src/server/sales/product-groups-with-availability.ts` | Fixed `org_id` filter on `order_items` (was filtering on wrong table) | HIGH -- was silently returning wrong data |

### Functions With Optional org_id (Not Yet Called With It)

**This is a follow-up concern**. These functions accept orgId but callers do not pass it yet:

| Function | File | Callers that skip orgId |
|----------|------|------------------------|
| `buildBatchHistory(rootId, orgId?)` | `src/server/batches/history.ts` | 3 callers in API routes -- none pass orgId |
| `buildStockMovements(batchId, orgId?)` | `src/server/batches/stock-movements.ts` | 2 callers in API routes -- none pass orgId |

**Impact**: These functions are behind API routes that likely have their own auth guards, so the risk is lower. But the orgId check should ideally be mandatory or callers should be updated to pass it.

### org_id Filter Bug Fix

`src/server/sales/product-groups-with-availability.ts` had `.eq('org_id', orgId)` on `order_items` which is incorrect -- `order_items` does not have an `org_id` column. Fixed to `.eq('orders.org_id', orgId)` using the joined `orders` table. This was a **silent query failure** that could return no data or wrong data.

---

## Security Posture

### Improvements

1. **org_id enforcement on admin client**: `deleteLoad` and other dispatch functions that use `supabaseAdmin` now scope queries by `org_id`. Previously, admin client bypassed RLS with no application-level scoping.

2. **Status transition guards**: `removeOrderFromLoad`, `dispatchOrders` now use `canTransition()` from `@/server/sales/status` instead of blindly setting status via `.eq("status", "packed")`. Prevents invalid state transitions.

3. **Zod body validation**: Archive API route now validates request body with `BodySchema`.

4. **Atomic default toggle**: Price list default toggle now performs insert/update first, then unsets old default. Prevents leaving org with no default price list if the insert fails.

### Remaining Concerns

1. **Batch history/stock-movements API routes**: As noted above, these routes call functions without org_id verification. They rely on their own auth guards but could leak cross-tenant batch data if those guards are insufficient.

2. **`assigned_user_id` as any**: The `pick_lists.assigned_user_id` column access uses `as any` cast, suggesting the column may not be in the generated types yet. This should be resolved by regenerating Supabase types.

---

## New Tech Debt Introduced

| Item | File | Severity | Description |
|------|------|----------|-------------|
| `as unknown as` pattern (20 instances) | `src/server/sales/picking.ts` | LOW | While better than `as any`, the `as unknown as InterfaceType` pattern bypasses TypeScript's type checker entirely. If the Supabase query changes shape, these casts silently produce wrong types at runtime. Proper fix: generate accurate Supabase types. |
| Duplicate logging utilities | `@/lib/log` vs `@/server/utils/logger` | MEDIUM | Two logging approaches coexist. Session exacerbated by adding `logError` imports to ~20 files while dispatch module uses `logger.*`. |
| Optional orgId parameters | `history.ts`, `stock-movements.ts` | LOW | Parameters exist but are unused by callers, creating false sense of security. |
| `quantity` variable shadowing | `src/app/sales/orders/[orderId]/actions.ts` line 478 | LOW | Uses `quantity` from function param but references `item.quantity` for comparison; could be clearer. |

---

## Business Logic Correctness

### Changes That Improve Correctness

1. **FEFO sort applied universally** (`allocation.ts`): Previously, FEFO sort was only applied in the `else` branch (when no preferences). Now it's applied within preferred and non-preferred groups too. This ensures oldest stock ships first even when there's a grade preference.

2. **Group reservation proportional share** (`products-with-batches.ts`): Previously, each product in a group showed the FULL group reservation. Now it shows `ceil(groupReserved / memberCount)`. This prevents availability being understated.

3. **`getVarietiesWithBatches` accounts for reserved_quantity** (`products-with-batches.ts`): Batch availability now shows `quantity - reserved_quantity` instead of raw `quantity`. Prevents overselling.

4. **Running balance recalculation** (`stock-movements.ts`): After chronological sort, running balances are recalculated. Previously, balances from appended allocation entries were wrong.

5. **Allocation release on item delete/qty reduction** (`orders/[orderId]/actions.ts`): Deleting an order item or reducing quantity now releases associated allocations. Previously, allocated stock would be permanently locked.

6. **Delivery run number race condition** (`queries.server.ts`): Now uses retry loop with unique constraint check (code `23505`). Prevents duplicate run numbers under concurrent creation.

### Potential Regressions to Watch

1. **`canTransition` strictness**: The `NEXT` map in `status.ts` does not include `confirmed -> packed` directly (goes `confirmed -> picking -> packed`). If dispatch tries to set `packed` on a `confirmed` order, `canTransition` returns false and the status won't change. This could break the existing flow where `dispatchOrders` sets status to `packed` directly. **Needs manual testing**.

2. **`archiveBatch` now zeroes quantity**: Previously, archiving did not modify quantity. Now it sets `quantity: 0`. If any code reads archived batches and expects non-zero quantity, this could cause issues.

---

## File Organization

No new files created in wrong locations. All changes are to existing files in their correct module directories. The new `roundToTwo` utility was correctly placed in `@/lib/utils.ts`.

---

## Naming Consistency

No naming drift detected. Files follow existing conventions:
- Server modules: `kebab-case.ts` (e.g., `board-actions.ts`, `stock-movements.ts`)
- Types: PascalCase interfaces (e.g., `PickingTeamRow`, `SaleableBatchRpcRow`)
- Functions: camelCase (e.g., `buildStockMovements`, `allocateForProductLine`)

---

## Priority Actions

1. **Update `buildBatchHistory` and `buildStockMovements` callers to pass orgId** -- 5 API route callers currently skip org verification. This leaves partial security gaps. [MEDIUM]

2. **Consolidate logging utilities** -- Merge `@/lib/log` into `@/server/utils/logger` or vice versa. Having two logging approaches makes the codebase harder to audit. [MEDIUM]

3. **Verify `canTransition` paths in dispatch flow** -- The `confirmed -> packed` transition may not be valid per the status machine. Manual test: create an order, confirm it, then dispatch to a load. Verify status transitions work. [HIGH -- potential regression]

4. **Regenerate Supabase types** -- Would eliminate the need for ~20 `as unknown as` casts in picking.ts and make type mismatches compile-time errors. [LOW]

5. **Remaining `console.*` in unchanged server files** -- 51 occurrences across 21 server files not touched by this session. [LOW]

6. **Remaining `as any` in server code** -- 34 occurrences across 10 files not touched by this session (down from ~64). [LOW]

---

## Trends

This is the first drift report. Baseline metrics established:

| Metric | Value (2026-02-07) |
|--------|-------------------|
| `console.*` in src/server/ | 51 occurrences / 21 files |
| `console.*` in src/app/ | 647 occurrences / 216 files |
| `as any` in src/server/ | 34 occurrences / 10 files |
| `as any` in src/app/ | 195 occurrences / 59 files |
| Files using `@/lib/log` | 24 server files |
| Files using `@/server/utils/logger` | 12 server files |
| Files using `getUserAndOrg` | 35 server files |
| Files using raw `createClient` | 19 server files |
| Typed row interfaces (new) | 24 interfaces across 3 files |

**Previous report**: None (first drift report)

---

## Handoff to Jimmy

**Health**: Drifting -> IMPROVED (these changes significantly improve security posture and type safety)
**Health Impact of Changes**: IMPROVED
**Critical Issues**: 1 (canTransition regression risk in dispatch flow)
**Medium Issues**: 3 (unused orgId params, logging consolidation, batch history callers)
**Low Issues**: 3 (Supabase types regen, remaining console.*, remaining as any)
**Recommended Actions**: 6
**Next Check**: After dispatch flow manual testing and logging consolidation
