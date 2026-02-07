# Module Review Report: 2026-02-07

**Reviewer**: Jimmy (4 parallel module-reviewer agents)
**Scope**: Trolley Logic, Pre-Pricing, Stock Allocation, Product Groups, Stock Movements
**Files Reviewed**: ~60 files, ~15,000+ lines
**Verdict**: NOT READY for production

---

## Issues Summary

| Severity | Count | Examples |
|----------|-------|---------|
| CRITICAL | 7 | Cross-tenant access in board-actions, broken batch restore, non-existent column queries |
| HIGH | 11 | Orphaned allocations, missing batch events, FEFO bypass, race conditions |
| MEDIUM | 18 | console.error usage, `as any` types, N+1 queries, naming inconsistencies |
| LOW | 8 | Duplicate utilities, legacy prototype code, date validation |
| **TOTAL** | **44** | |

---

## Module Verdicts

### 1. Trolley Logic / Dispatch / Sales Orders -- RED
- 15 functions in `board-actions.ts` with zero org_id filtering (cross-tenant)
- Status transitions not enforced (can set "packed" from any state)
- Broken batch quantity restore on pick undo
- Race condition in delivery run number generation

### 2. Pre-Pricing / Stock Allocation -- RED
- Allocation race condition (no DB-level locking)
- Price fallback silently defaults to zero
- Two allocation systems running in parallel (potential double-allocation)
- Three different availability calculation paths that disagree

### 3. Product Groups vs Product Aliases -- RED
- `order_items.org_id` column doesn't exist (silent query failure)
- `products.default_price_ex_vat` column doesn't exist (null prices)
- Group reservation double-counting for multi-group products
- B2B orders cannot use product groups (design gap)

### 4. Stock Movements -- RED
- `archiveBatch` doesn't zero quantity or create events (stock vanishes)
- `removeBatchPick` has dead code and missing audit trail
- Running balance calculation corrupted after sort
- No batch events for propagation/checkin creation

---

## Top 10 Must-Fix Items

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | Cross-tenant access in dispatch board-actions | `board-actions.ts` | Any user can manipulate any org's data |
| 2 | Broken `removeBatchPick` quantity restore | `picking.ts:1220` | Permanent stock leak on undo |
| 3 | `order_items.org_id` query on non-existent column | `product-groups-with-availability.ts:287` | Group reservations always = 0 |
| 4 | `products.default_price_ex_vat` non-existent column | `product-groups-with-availability.ts:193` | Product group prices always null |
| 5 | `archiveBatch` doesn't zero quantity | `archive.ts:3` | Stock vanishes with no audit trail |
| 6 | No batch events for propagation/checkin batches | `service.ts:164,294` | Incomplete audit trail |
| 7 | Orphaned allocations on order item delete | `orders/[orderId]/actions.ts:266` | Stock permanently locked |
| 8 | Allocations not adjusted on quantity change | `orders/[orderId]/actions.ts:182` | Over/under-reservation |
| 9 | Group reservation double-counting | `products-with-batches.ts:415` | Artificially low availability |
| 10 | FEFO bypass with grade/batch preferences | `allocation.ts:66-102` | Wrong allocation order |

---

## Fix Plan

See: `.claude/plans/PLAN-module-review-fixes-2026-02-07.md`

8 phases, prioritized from P0 (security) through P3 (cleanup).
Phases 1-3 are blocking for deployment.

---

*Report generated: 2026-02-07T12:25:00Z*
