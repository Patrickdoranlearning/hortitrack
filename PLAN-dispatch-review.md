# Dispatch/Picking Module Review

**Review Date**: 2026-02-01
**Reviewer**: module-reviewer (via Jimmy coordination)
**Thoroughness Level**: Very Thorough
**Status**: Complete - Findings Documented

---

## Executive Summary

The dispatch/picking module has a **well-designed architecture** for stock management with proper separation between order placement and picking. However, there are several **gaps in the multi-batch selection UI** and some **subtle issues** with how stock changes propagate during the picking workflow.

### Key Business Rules (As Specified)

| Operation | Stock Level | Expected Behavior |
|-----------|-------------|-------------------|
| **Placing Orders** | PRODUCT level | Aggregate availability across all linked batches |
| **Picking Orders** | BATCH level | Deduct from specific batches selected during pick |

### Compliance Assessment

| Rule | Status | Notes |
|------|--------|-------|
| Orders use product-level availability | COMPLIANT | `getProductsWithBatches()` aggregates across batches |
| Picking deducts from specific batches | COMPLIANT | `pick_item_atomic()` RPC deducts from `picked_batch_id` |
| Multi-batch selection for picking | PARTIAL | UI supports substitution but not multi-batch per item |
| Stock reservation on order | COMPLIANT | `batch_allocations` + triggers update `reserved_quantity` |

---

## 1. Order Placement (Product-Level Stock)

### Current State: WORKING AS EXPECTED

#### Data Flow
```
Order Creation
     |
     v
getProductsWithBatches() --> Aggregates stock across:
     |                        - product_batches (explicit links)
     |                        - match_families (auto-link by family)
     |                        - match_genera (auto-link by genus)
     v
ProductWithBatches.netAvailableStock =
     availableStock - orderReserved - groupReserved
     |
     v
create_order_with_allocations() --> Creates order + allocations
     |
     v
Triggers update batches.reserved_quantity
```

#### Key Files
- `/src/server/sales/products-with-batches.ts` - Product availability with batch aggregation
- `/src/server/sales/allocation.ts` - FEFO allocation algorithm
- `/supabase/migrations/20260128200000_order_rpc_product_id.sql` - Order creation RPC

#### Findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| O1 | Product-level availability correctly aggregates batch stock | Info | OK |
| O2 | Order reservations properly reduce `netAvailableStock` | Info | OK |
| O3 | Group reservations (product groups) are tracked separately | Info | OK |
| O4 | Customer batch reservations are validated during allocation | Info | OK |
| O5 | Orders without explicit batch allocations still reserve at product level | Info | OK |

---

## 2. Picking Process (Batch-Level Stock)

### Current State: MOSTLY WORKING, WITH UI GAPS

#### Data Flow
```
Pick List Created (from order)
     |
     v
pick_items populated with:
  - original_batch_id (from batch_allocations, if any)
  - target_qty (from order_item.quantity)
     |
     v
Picker executes pick:
  - handlePickItem() --> PATCH /api/picking/[id]/items
     |
     v
pick_item_atomic() RPC:
  1. Updates pick_items.picked_qty, picked_batch_id, status
  2. Deducts from batches.quantity (BATCH LEVEL)
  3. Logs batch_events (PICKED)
  4. Updates batch_allocations status to 'picked'
```

#### Key Files
- `/src/server/sales/picking.ts` - Pick list CRUD and item management
- `/src/app/dispatch/picking/[pickListId]/PickingWorkflowClient.tsx` - Picking UI
- `/src/components/sales/PickItemCard.tsx` - Individual pick item card
- `/src/components/sales/BatchSubstitutionDialog.tsx` - Batch substitution modal
- `/supabase/migrations/20260121100000_atomic_stock_operations.sql` - Atomic pick operations

#### Findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| P1 | `pick_item_atomic()` correctly deducts from specific batch | Info | OK |
| P2 | Batch substitution works for swapping to different batch | Info | OK |
| P3 | Short picks handled correctly (picks partial, marks short) | Info | OK |
| P4 | Batch events logged for traceability | Info | OK |
| P5 | **Multi-batch selection per item NOT supported** | Medium | GAP |
| P6 | QC rejection properly restores batch quantities | Info | OK |
| P7 | Order voiding releases unpicked allocations | Info | OK |

---

## 3. Multi-Batch Selection Analysis

### P0: CRITICAL GAP - No Multi-Batch Selection UI

**Problem**: When a single order item (e.g., "500 x Lavender 2L") spans multiple batches, the current UI only allows:
1. Picking the **full quantity** from the originally allocated batch
2. **Substituting** to a different single batch
3. Marking as **short**

**There is no way to split a pick across multiple batches.**

#### Current UI Flow
```
PickItemCard
     |
     +-- "Pick All (500)" --> Uses original_batch_id or picked_batch_id
     |
     +-- "More" --> Expand options
           |
           +-- Custom quantity (picks partial from SAME batch)
           +-- "Substitute Batch" --> Opens BatchSubstitutionDialog
                                      (selects ONE replacement batch)
           +-- "Mark Short"
```

#### What's Missing
```
Needed: "Pick from Multiple Batches" option
     |
     v
Opens MultiBatchPickDialog:
  - List all available batches for this product/variety
  - Allow user to enter qty from each batch
  - Sum must equal target_qty (or mark as short)
  - Creates multiple batch deductions in one transaction
```

### Backend Impact

The `pick_item_atomic()` RPC handles **one batch** per call:
```sql
-- Current: deducts p_picked_qty from ONE batch
UPDATE public.batches
SET quantity = quantity - p_picked_qty
WHERE id = v_effective_batch_id
```

For multi-batch picking, we would need:
1. A new RPC: `pick_item_multi_batch(p_pick_item_id, p_batch_picks: jsonb)`
2. Loop through batch picks, deducting each
3. Sum total picked for the pick_item
4. Create multiple batch_allocations with status='picked'

---

## 4. Stock Integrity Verification

### Invariant: Available = Total - Allocated - Dispatched

| Check | SQL Expression | Status |
|-------|----------------|--------|
| Batch available | `batches.quantity - batches.reserved_quantity` | OK |
| Product available | `SUM(batch.quantity - batch.reserved_quantity) for linked batches` | OK |
| Allocation sync | Triggers on `batch_allocations` update `reserved_quantity` | OK |

### Edge Case Testing Needed

| Scenario | Expected | Current | Status |
|----------|----------|---------|--------|
| Concurrent picks from same batch | Should fail second if insufficient | Tested via `FOR UPDATE` lock | OK |
| Pick more than allocated | Should fail | Validates `quantity >= p_picked_qty` | OK |
| Delete order item | Should release allocations | Cascade trigger exists | OK |
| Void order | Should release unpicked allocations | `void_order_with_allocations()` | OK |
| Pick from substituted batch | Should create new allocation | Handled in RPC | OK |

---

## 5. UI/UX Assessment

### Main HortiTrack App (Not Worker App)

| Area | Assessment | Notes |
|------|------------|-------|
| Pick list dashboard | Good | Shows progress, team assignment |
| Pick item cards | Good | Clear status, quantity, location |
| Quick pick button | Good | One-tap for full quantity |
| Substitution dialog | Good | Shows available batches with location/quantity |
| Print labels | Good | Integrated into pick flow |
| Multi-batch selection | **MISSING** | No way to split across batches |

### Worker App

The worker app (`/src/app/(worker)/worker/picking/`) appears to be in development with similar limitations.

---

## 6. Priority Recommendations

### P0: Critical - Must Fix Before Production

| ID | Issue | Effort | Recommendation |
|----|-------|--------|----------------|
| P0-1 | Multi-batch picking not supported | Large | Build `MultiBatchPickDialog` component + `pick_item_multi_batch()` RPC |

### P1: Important - Should Fix Soon

| ID | Issue | Effort | Recommendation |
|----|-------|--------|----------------|
| P1-1 | No visual indicator when item spans multiple batches | Small | Add badge "Multi-batch" when `SUM(available) < target_qty` for any single batch |
| P1-2 | Batch substitution doesn't show which batch was originally allocated | Small | Display original batch in substitution dialog |
| P1-3 | No audit trail for WHY picker chose a specific batch | Small | Add optional "pick notes" field |

### P2: Nice to Have

| ID | Issue | Effort | Recommendation |
|----|-------|--------|----------------|
| P2-1 | Bulk picking mode (pick same product across multiple orders) | Medium | Exists at `/dispatch/bulk-picking/` but may need review |
| P2-2 | Scan-to-pick workflow | Medium | Validate batch barcode matches expected/substituted |
| P2-3 | Location-optimized picking order | Medium | Sort pick items by location zone |

---

## 7. Schema Observations

### Tables Involved

| Table | Purpose | RLS | Notes |
|-------|---------|-----|-------|
| `batches` | Stock tracking | Yes | `quantity`, `reserved_quantity` |
| `batch_allocations` | Order-batch links | Yes | Triggers sync `reserved_quantity` |
| `orders` | Order header | Yes | Status enum includes picking states |
| `order_items` | Order lines | Yes | Links to `product_id`, `sku_id` |
| `pick_lists` | Pick session | Yes | Links to order, team assignment |
| `pick_items` | Pick line items | Yes | `target_qty`, `picked_qty`, `picked_batch_id` |
| `pick_list_events` | Audit trail | Yes | Event log for picks |
| `batch_events` | Batch audit trail | Yes | PICKED events logged |

### Triggers

| Trigger | On | Function | Purpose |
|---------|-----|----------|---------|
| `trg_sync_reserved_quantity_insert` | `batch_allocations` INSERT | `sync_reserved_quantity()` | Increment `reserved_quantity` |
| `trg_sync_reserved_quantity_delete` | `batch_allocations` DELETE | `sync_reserved_quantity()` | Decrement `reserved_quantity` |
| `trg_sync_reserved_quantity_update` | `batch_allocations` UPDATE | `sync_reserved_quantity()` | Adjust on batch change |
| `trg_cleanup_order_item_allocations` | `order_items` DELETE | `cleanup_order_item_allocations()` | Cascade delete allocations |

---

## 8. Test Scenarios (Manual Testing Checklist)

### Order Placement Tests
- [ ] Create order with product that has multiple batches - verify aggregate availability shown
- [ ] Create order that exceeds single batch capacity - verify allocations span batches
- [ ] Create order for customer with reserved batch - verify only their batches available
- [ ] Void order - verify allocations released

### Picking Tests
- [ ] Start pick list - verify order moves to "picking" status
- [ ] Pick full quantity from allocated batch - verify batch deducted
- [ ] Pick partial quantity - verify marked as "short"
- [ ] Substitute batch - verify new batch deducted, old allocation released
- [ ] Complete pick list - verify order moves to "ready_for_dispatch"
- [ ] QC reject pick list - verify batch quantities restored

### Multi-Batch Tests (Currently Not Possible)
- [ ] *BLOCKED* - Need multi-batch UI to test

---

## 9. Code Quality Notes

### Strengths
- Atomic RPC operations prevent race conditions
- Good use of `FOR UPDATE` locks for concurrency
- Comprehensive event logging
- Clean separation of concerns (picking.ts, allocation.ts)

### Areas for Improvement
- Some `console.log` statements in production code (should use logger)
- Type casting with `any` in some places
- Complex joins could benefit from views

---

## 10. Next Steps

1. **Prioritize P0-1**: Design and implement multi-batch picking
   - Create UI mockup
   - Design RPC function
   - Route to `data-engineer` for schema/RPC work
   - Route to `feature-builder` for UI

2. **Manual Testing**: Execute test scenarios above for current functionality

3. **Security Review**: Route to `security-auditor` for RLS policy review on picking tables

---

## Appendix: Key Code Locations

```
Order Placement:
  /src/app/sales/actions.ts                          # createOrder server action
  /src/server/sales/products-with-batches.ts         # Product availability
  /src/server/sales/allocation.ts                    # FEFO allocation
  /supabase/migrations/20260128200000_*.sql          # create_order_with_allocations RPC

Picking:
  /src/server/sales/picking.ts                       # Pick list CRUD
  /src/app/api/picking/**                            # Picking API routes
  /src/app/dispatch/picking/[pickListId]/**          # Picking UI
  /src/components/sales/PickItemCard.tsx             # Pick item component
  /src/components/sales/BatchSubstitutionDialog.tsx  # Substitution dialog
  /supabase/migrations/20260121100000_*.sql          # pick_item_atomic RPC

Stock Management:
  /supabase/migrations/20251205120000_*.sql          # Reserved quantity sync triggers
  /src/server/sales/inventory.ts                     # getSaleableBatches
```

---

**Review Complete**

*This document was generated by the module-reviewer agent as part of a thorough dispatch/picking module review. Findings should be validated through manual testing before implementing fixes.*
