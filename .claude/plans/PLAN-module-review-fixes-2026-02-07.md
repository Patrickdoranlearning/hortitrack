# Module-by-Module Review Fix Plan

**Date**: 2026-02-07
**Review Scope**: Trolley Logic, Pre-Pricing, Stock Allocation, Product Groups vs Aliases, Stock Movements
**Status**: AWAITING IMPLEMENTATION
**Verdict**: NOT READY for production -- 10 critical/high bugs found across 4 modules

---

## Executive Summary

4 parallel deep reviews analyzed ~60 files and ~15,000+ lines of server logic. The reviews found:

- **10 CRITICAL/HIGH bugs** requiring immediate fixes
- **18 MEDIUM issues** (standards violations, edge cases)
- **8 LOW issues** (code quality, minor inconsistencies)

The most severe issues are:
1. **Cross-tenant data access** in dispatch board-actions (15 functions with zero org_id filtering)
2. **Broken batch quantity restore** when undoing picks (dead code + missing audit trail)
3. **Silent query failures** in product group availability (querying non-existent columns)
4. **Allocation race conditions** and orphaned allocations when editing orders

---

## Phase 1: CRITICAL Security Fixes (Cross-Tenant Data Access)

**Priority**: P0 -- Must fix before any deployment
**Estimated scope**: 3 files, ~50 lines changed

### Fix 1.1: Add org_id filtering to ALL dispatch board-actions

**File**: `src/server/dispatch/board-actions.ts`
**Problem**: All 15 exported functions use `createClient()` with ZERO org_id filtering. Any authenticated user can manipulate dispatch data across organizations. `deleteLoad`, `dispatchLoad`, `recallLoad` use `supabaseAdmin` bypassing RLS entirely.

**Fix**:
- Import `getUserAndOrg()` from `@/server/auth/org`
- Replace all `createClient()` calls with `getUserAndOrg()` + `createClient()`
- Add `.eq("org_id", orgId)` to every query
- Replace `supabaseAdmin` usage with org-scoped client, or add org_id verification before admin calls
- Functions to fix: `assignOrder`, `unassignOrder`, `moveOrderToLoad`, `createLoad`, `updateLoad`, `deleteLoad`, `reorderLoads`, `removeOrderFromLoad`, `updateDeliveryDate`, `dispatchOrders`, `dispatchLoad`, `recallLoad`, `updateLoadStatus`, `createDeliveryRunAndAssign`, `addOrderToDeliveryRun`

### Fix 1.2: Add org_id filtering to sales queries

**File**: `src/server/sales/queries.server.ts`
**Problem**: `listOrders()`, `getCustomers()`, `getOrderById()` have no org_id filtering.

**Fix**:
- Add `getUserAndOrg()` to each function
- Add `.eq("org_id", orgId)` to all queries

### Fix 1.3: Add org_id filtering to batch history/stock movements

**Files**: `src/server/batches/history.ts`, `src/server/batches/stock-movements.ts`
**Problem**: Both use `getSupabaseAdmin()` and query by batch ID only -- cross-tenant exposure.

**Fix**:
- Either use authenticated client (respects RLS) OR add `.eq("org_id", orgId)` to all queries
- Accept `orgId` parameter and verify batch belongs to org before returning data

### Fix 1.4: Add org_id guard to `restore_batch_quantity` RPC

**File**: Migration SQL (new migration needed)
**Problem**: RPC accepts any batch ID with no org check, uses SECURITY DEFINER.

**Fix**: Add `org_id` parameter and WHERE clause, or rely on RLS by using SECURITY INVOKER.

### Fix 1.5: Add auth to `archiveBatch`

**File**: `src/server/batches/archive.ts`
**Problem**: Uses `getSupabaseAdmin()` with no org_id filter.

**Fix**: Accept orgId parameter, add `.eq("org_id", orgId)` to update query.

---

## Phase 2: CRITICAL Data Integrity Fixes (Stock Quantity Bugs)

**Priority**: P0 -- Causes cumulative stock drift
**Estimated scope**: 3 files, ~80 lines changed

### Fix 2.1: Fix `removeBatchPick` broken quantity restore

**File**: `src/server/sales/picking.ts` (lines 1220-1265)
**Problem**: Dead code on lines 1221-1224 (nested `supabase.rpc()` inside `.update()`) that cannot work. Error is never checked. Then fallback RPC `restore_batch_quantity` only warns on failure but proceeds to delete the pick record regardless. Stock leaks.

**Fix**:
- Remove the dead code block (lines 1221-1226)
- Make the `restore_batch_quantity` RPC call a hard failure (return error, do NOT proceed to delete)
- Add a batch_events record (PICK_REVERSED or PICK_UNDONE) when restoring quantity
- Wrap the entire operation in a single RPC for atomicity

### Fix 2.2: Fix `archiveBatch` to zero quantity and log event

**File**: `src/server/batches/archive.ts`
**Problem**: Sets status to "Archived" but leaves quantity untouched. No batch event created. Stock vanishes silently.

**Fix**:
- Read current quantity before archiving
- Set `quantity = 0` in the update
- Insert a `batch_events` record with type ARCHIVE/LOSS recording the remaining quantity
- Accept and log the user ID and reason

### Fix 2.3: Fix stock movement running balance calculation

**File**: `src/server/batches/stock-movements.ts` (lines 452-499)
**Problem**: Allocation-sourced movements are appended after the event loop with running balances computed from the final state, then the entire array is re-sorted. Running balances are now wrong.

**Fix**: After the final sort on line 499, recalculate all `runningBalance` values in a single pass from top to bottom.

---

## Phase 3: CRITICAL Query Failures (Silent Data Errors)

**Priority**: P0 -- Product group availability returns wrong data
**Estimated scope**: 1 file, ~20 lines changed

### Fix 3.1: Fix `order_items.org_id` queries (column doesn't exist)

**File**: `src/server/sales/product-groups-with-availability.ts` (lines 287, 295)
**Problem**: Queries `.eq('org_id', orgId)` on `order_items` table which has no `org_id` column. Silently returns empty results, making all reservation calculations = 0.

**Fix**: Change to `.eq('orders.org_id', orgId)` (filter through the joined `orders` table, matching the pattern in `products-with-batches.ts` line 325).

### Fix 3.2: Fix `products.default_price_ex_vat` query (column doesn't exist)

**File**: `src/server/sales/product-groups-with-availability.ts` (lines 193-200)
**Problem**: Queries `products.default_price_ex_vat` which doesn't exist. All product group prices show as null.

**Fix**: Query `product_prices` joined to `price_lists` (matching the pattern in `products-with-batches.ts` lines 277-301).

---

## Phase 4: HIGH -- Order/Allocation Integrity

**Priority**: P1 -- Causes inventory drift over time
**Estimated scope**: 4 files, ~100 lines changed

### Fix 4.1: Release allocations when deleting order items

**File**: `src/app/sales/orders/[orderId]/actions.ts` (lines 266-333)
**Problem**: Deleting an order item does NOT release associated allocations. Stock remains permanently locked.

**Fix**: Before deleting the order item, query `allocation_ledger` for matching `order_item_id` and cancel those allocations.

### Fix 4.2: Adjust allocations when order item quantity changes

**File**: `src/app/sales/orders/[orderId]/actions.ts` (lines 182-264)
**Problem**: Changing order item quantity does not adjust allocations. If reduced from 100 to 50, 100 units stay reserved.

**Fix**: After updating quantity, check if allocated > new quantity, and release the excess.

### Fix 4.3: Enforce status transitions in dispatch board-actions

**File**: `src/server/dispatch/board-actions.ts`
**Problem**: Multiple functions update order status without checking valid transitions. `removeOrderFromLoad` sets `packed -> confirmed` (backwards transition not in status machine). `dispatchOrders` sets status to `packed` without checking current status.

**Fix**: Import `canTransition()` from `src/server/sales/status.ts` and validate before every status update.

### Fix 4.4: Fix price fallback to zero

**File**: `src/app/sales/actions.ts` (line 172)
**Problem**: `const unitPrice = line.unitPrice ?? priceFromList ?? 0` -- orders can be created with $0 price.

**Fix**: Add validation that rejects or warns on zero-price lines unless explicitly overridden.

### Fix 4.5: Make default price list toggle atomic

**File**: `src/server/sales/price-lists.server.ts` (lines 174-201)
**Problem**: Unsets all defaults, then creates new default. If insert fails, org has NO default price list.

**Fix**: Wrap in a single RPC/transaction.

---

## Phase 5: HIGH -- Audit Trail Gaps

**Priority**: P1 -- Breaks traceability
**Estimated scope**: 2 files, ~40 lines changed

### Fix 5.1: Add batch events for `createPropagationBatch`

**File**: `src/server/batches/service.ts` (lines 164-269)
**Problem**: No PROPAGATE or CREATE batch event when creating propagation batches.

**Fix**: Insert a `batch_events` record after successful batch creation.

### Fix 5.2: Add batch events for `createCheckinBatch`

**File**: `src/server/batches/service.ts` (lines 294-380)
**Problem**: No CHECK_IN batch event when creating checkin batches.

**Fix**: Insert a `batch_events` record after successful batch creation.

### Fix 5.3: Verify `complete_pick_list` RPC exists

**File**: `src/server/sales/picking.ts` (line 900)
**Problem**: Calls `supabase.rpc('complete_pick_list', ...)` but no migration creates this function.

**Fix**: Either create the RPC via migration, or update the code to use an alternative completion path.

---

## Phase 6: HIGH -- Availability Calculation Fixes

**Priority**: P1 -- Causes incorrect stock display
**Estimated scope**: 2 files, ~30 lines changed

### Fix 6.1: Fix group reservation double-counting per product

**File**: `src/server/sales/products-with-batches.ts` (lines 415-425, 592)
**Problem**: Each product's `netAvailableStock` is reduced by the FULL group reservation amount, not its proportional share. If 5 products share a group with 100 reserved, each shows 100 reserved instead of ~20.

**Fix**: Divide group reservation by the number of member products in that group (proportional share).

### Fix 6.2: Fix FEFO bypass with preferred batches/grades

**File**: `src/server/sales/allocation.ts` (lines 66-102)
**Problem**: When `preferredBatchNumbers` or `gradePreference` is specified, the FEFO sort is skipped entirely.

**Fix**: Sort both `preferred` and `others` arrays by FEFO before concatenating.

### Fix 6.3: Remove duplicate dispatch logic

**File**: `src/server/dispatch/queries.server.ts` (lines 386-441)
**Problem**: `updateDeliveryRun` has inline dispatch logic that duplicates the `dispatch_load` RPC. Two code paths for the same operation.

**Fix**: Remove inline dispatch logic from `updateDeliveryRun`, route all dispatch through the `dispatch_load` RPC.

---

## Phase 7: MEDIUM -- Standards & Code Quality

**Priority**: P2 -- Standards violations
**Estimated scope**: ~15 files, ~100 lines changed

### Fix 7.1: Replace all `console.error`/`console.log` with structured logger

**Files**: ~15 files across `src/server/sales/`, `src/server/batches/`, `src/server/dispatch/`, `src/app/b2b/`
**Count**: ~40 instances

### Fix 7.2: Remove `as any` type assertions

**Files**: `picking.ts` (~14 instances), `inventory.ts` (~3), `allocation-actions.ts` (~8), `stock-movements.ts` (~3), `flags.ts` (~2)
**Count**: ~30 instances

### Fix 7.3: Remove `console.log` debug statements from ProductGroupsClient.tsx

**File**: `src/app/sales/products/groups/ProductGroupsClient.tsx` (lines 204, 223, 225)

### Fix 7.4: Fix delivery run number race condition

**File**: `src/server/dispatch/queries.server.ts` (lines 324-338)
**Problem**: Run number generation reads latest number then increments -- race condition on concurrent creates.
**Fix**: Use database sequence or unique constraint.

### Fix 7.5: Make reorder operations atomic

**Files**: `src/server/sales/picking.ts` (lines 958-968), `src/server/dispatch/board-actions.ts` (lines 300-326)
**Problem**: Sequential updates with no transaction -- partial failure leaves broken ordering.
**Fix**: Use single RPC/transaction for bulk reorder.

---

## Phase 8: LOW -- Cleanup & Edge Cases

**Priority**: P3
**Estimated scope**: ~5 files, ~30 lines changed

- Fix `getVarietiesWithBatches` to account for `reserved_quantity`
- Add `validFrom <= validTo` validation for price list creation
- Deduplicate `roundToTwo` utility function
- Fix `dispatchAndInvoice` false email sent logging
- Add location name to worker MOVE events payload
- Remove legacy `getSaleableProducts()` prototype code

---

## Cross-Cutting Concerns Identified

### Two Allocation Systems Running in Parallel
- **Legacy**: `allocateForProductLine()` in `allocation.ts` (in-memory FEFO)
- **Two-Tier**: `allocation-actions.ts` using `fn_confirm_order_with_allocations` + `fn_transition_to_batch_allocation`
- In `createOrder()`, BOTH systems are invoked, potentially creating duplicate allocations
- **Recommendation**: Audit the `create_order_with_allocations` RPC to understand if it handles Tier 1 allocation, then remove the duplicate call

### Three Different Availability Calculation Paths
1. `products-with-batches.ts`: `quantity - reserved_quantity - orderReserved - groupReserved`
2. `product-groups-with-availability.ts`: `quantity - reservedQuantity - specificReserved - genericReserved`
3. `allocation.ts` + `inventory.ts`: `quantity - reserved_quantity` (no order/group reservations)
- **Recommendation**: Create a single `getAvailableStock()` function as the single source of truth

---

## Implementation Order

```
Phase 1 (Security)     → Phase 2 (Stock Integrity) → Phase 3 (Query Fixes)
     ↓                          ↓                          ↓
Phase 4 (Order/Alloc)  → Phase 5 (Audit Trail)     → Phase 6 (Availability)
     ↓                          ↓                          ↓
Phase 7 (Standards)    → Phase 8 (Cleanup)          → DONE
```

Phases 1-3 are **blocking** -- no deployment until complete.
Phases 4-6 are **high priority** -- should be done in the same sprint.
Phases 7-8 are **cleanup** -- can be batched.

---

## Files Affected (Complete List)

| File | Phase(s) | Changes |
|------|----------|---------|
| `src/server/dispatch/board-actions.ts` | 1.1, 4.3 | Add org_id to 15 functions, enforce status transitions |
| `src/server/sales/queries.server.ts` | 1.2 | Add org_id to 3 functions |
| `src/server/batches/history.ts` | 1.3 | Add org_id filtering |
| `src/server/batches/stock-movements.ts` | 1.3, 2.3 | Add org_id filtering, fix running balance |
| `src/server/batches/archive.ts` | 1.5, 2.2 | Add auth + zero quantity + event |
| `src/server/sales/picking.ts` | 2.1, 5.3 | Fix removeBatchPick, verify complete_pick_list |
| `src/server/sales/product-groups-with-availability.ts` | 3.1, 3.2 | Fix non-existent column queries |
| `src/app/sales/orders/[orderId]/actions.ts` | 4.1, 4.2 | Release allocations on delete/edit |
| `src/app/sales/actions.ts` | 4.4 | Zero price validation |
| `src/server/sales/price-lists.server.ts` | 4.5 | Atomic default toggle |
| `src/server/batches/service.ts` | 5.1, 5.2 | Add batch events for creation |
| `src/server/sales/products-with-batches.ts` | 6.1 | Fix group reservation calculation |
| `src/server/sales/allocation.ts` | 6.2 | Fix FEFO sort bypass |
| `src/server/dispatch/queries.server.ts` | 6.3, 7.4 | Remove duplicate dispatch logic, fix race condition |
| New migration(s) | 1.4, 5.3 | Fix RPC org_id guard, create complete_pick_list |

---

*Generated by 4 parallel module-reviewer agents, 2026-02-07*
*Reviewed: ~60 files, ~15,000+ lines of server logic*
