# Multi-Batch Picking Implementation Plan

**Feature**: Multi-Batch Picking for Order Fulfillment
**Created**: 2026-02-01
**Completed**: 2026-02-01
**Status**: Complete
**Priority**: P0 (Critical gap identified in dispatch review)

---

## Executive Summary

When picking orders, users cannot currently split a pick across multiple batches. If no single batch has enough stock to fulfill an order line, pickers must either mark it short or use workarounds. This plan addresses that gap with a complete multi-batch picking solution.

---

## Business Context

### Current Behavior
1. **Placing Orders** = PRODUCT level stock (aggregate across batches) - WORKING
2. **Picking Orders** = BATCH level stock, but **single batch per line only** - GAP

### Problem Statement
- Order line: "500 x Lavender 2L"
- Batch A: 300 available
- Batch B: 250 available
- **Current UI**: Can only pick from ONE batch (must pick 300 from A, mark 200 short)
- **Needed**: Pick 300 from A + 200 from B = 500 complete

### User Story
> As a picker, when an order item requires more stock than any single batch can provide, I need to be able to pick from multiple batches to fulfill the full quantity.

---

## Architecture Decisions

### Decision 1: Storage Model
**Chosen: Junction Table (`pick_item_batches`)**

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A. Junction table | Clean normalization, easy queries, auditable | Extra table | **SELECTED** |
| B. JSONB column | Simple schema | Hard to query, report, index | Rejected |
| C. Split pick_item rows | Reuses existing model | Breaks 1:1 order_item relationship | Rejected |

**Rationale**: A junction table provides:
- Clear audit trail per batch pick
- Easy aggregation queries
- Proper foreign key constraints
- Support for undo/partial operations

### Decision 2: Primary Batch Storage
**Chosen: Keep `picked_batch_id` on `pick_items` for backward compatibility**

- Single-batch picks: Use existing `picked_batch_id` column
- Multi-batch picks: Set `picked_batch_id = NULL`, use `pick_item_batches` junction table
- Query logic: Check junction table first, fall back to `picked_batch_id`

### Decision 3: RPC vs Multiple API Calls
**Chosen: Single atomic RPC (`pick_item_multi_batch`)**

- All batch deductions in one transaction
- Either all succeed or all rollback
- Prevents partial state on failure

---

## Database Schema

### New Table: `pick_item_batches`

```sql
CREATE TABLE public.pick_item_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  pick_item_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  picked_at timestamptz NOT NULL DEFAULT now(),
  picked_by uuid,

  CONSTRAINT pick_item_batches_pkey PRIMARY KEY (id),
  CONSTRAINT pick_item_batches_org_fkey FOREIGN KEY (org_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT pick_item_batches_pick_item_fkey FOREIGN KEY (pick_item_id)
    REFERENCES public.pick_items(id) ON DELETE CASCADE,
  CONSTRAINT pick_item_batches_batch_fkey FOREIGN KEY (batch_id)
    REFERENCES public.batches(id) ON DELETE RESTRICT,
  CONSTRAINT pick_item_batches_user_fkey FOREIGN KEY (picked_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pick_item_batches_unique UNIQUE (pick_item_id, batch_id)
);

CREATE INDEX idx_pick_item_batches_pick_item ON public.pick_item_batches(pick_item_id);
CREATE INDEX idx_pick_item_batches_batch ON public.pick_item_batches(batch_id);
```

### New RPC: `pick_item_multi_batch`

```sql
CREATE OR REPLACE FUNCTION public.pick_item_multi_batch(
  p_org_id uuid,
  p_pick_item_id uuid,
  p_batches jsonb,  -- Array of {batchId, quantity}
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation details in Phase 1
$$;
```

### RPC Behavior
1. Validate pick item exists and belongs to org
2. Validate each batch belongs to correct product/variety
3. Lock all batches with `FOR UPDATE`
4. Deduct quantity from each batch atomically
5. Insert rows into `pick_item_batches`
6. Update `pick_items` with total picked_qty and status
7. Create `batch_allocations` with status='picked' for each
8. Log `batch_events` for each deduction
9. Log `pick_list_events` for the pick

---

## API Design

### Endpoint: `POST /api/picking/[pickListId]/items/[itemId]/multi-batch`

**Request Body:**
```typescript
{
  batches: Array<{
    batchId: string;
    quantity: number;
  }>;
  notes?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  error?: string;
  pickedQty?: number;
  status?: 'picked' | 'short';
  batchPicks?: Array<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    location?: string;
  }>;
}
```

### Endpoint Updates

| Endpoint | Change |
|----------|--------|
| `GET /api/picking/[pickListId]/items` | Include `batchPicks[]` in response |
| `GET /api/picking/[pickListId]/items/[itemId]/batches` | No change needed |

---

## UI Components

### New Component: `MultiBatchPickDialog`

**Location**: `/src/components/sales/MultiBatchPickDialog.tsx`

**Props:**
```typescript
interface MultiBatchPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickListId: string;
  pickItem: PickItem;
  availableBatches: AvailableBatch[];
  onConfirm: (batches: BatchPick[]) => Promise<void>;
  isSubmitting: boolean;
}
```

**UI Layout:**
```
+------------------------------------------+
|  Pick from Multiple Batches              |
+------------------------------------------+
|  Lavender anglais 2L                     |
|  Need: 500 units                         |
+------------------------------------------+
|  AVAILABLE BATCHES                       |
|  +--------------------------------------+|
|  | [x] LAV-2024-001    |  300  | T1    ||
|  |     Location: PH1                   ||
|  |     [  250  ] / 300 available       ||
|  +--------------------------------------+|
|  | [x] LAV-2024-002    |  250  | T2    ||
|  |     Location: PH3                   ||
|  |     [  250  ] / 250 available       ||
|  +--------------------------------------+|
|  | [ ] LAV-2024-003    |   50  | T2    ||
|  |     Location: PH3                   ||
|  |     [    0  ] / 50 available        ||
|  +--------------------------------------+|
+------------------------------------------+
|  SUMMARY                                 |
|  Total Selected: 500 / 500 needed   [=] |
+------------------------------------------+
|        [Cancel]        [Confirm Pick]    |
+------------------------------------------+
```

**Behaviors:**
1. Pre-select batches using FEFO (oldest first)
2. Auto-fill quantities to meet target
3. Show running total as user adjusts
4. Validate sum <= target (allow short picks)
5. Disable "Confirm" if no quantity selected
6. Show warning if total < target (short pick)

### Updated Component: `PickItemCard`

**Changes:**
1. Add "Pick from Multiple Batches" option in expanded menu
2. Show multi-batch indicator badge when `item.batchPicks.length > 1`
3. Display breakdown popover on click showing which batches were used

```typescript
// New indicator in PickItemCard
{item.batchPicks && item.batchPicks.length > 1 && (
  <Popover>
    <PopoverTrigger asChild>
      <Badge variant="outline" className="cursor-pointer">
        {item.batchPicks.length} batches
      </Badge>
    </PopoverTrigger>
    <PopoverContent className="w-64">
      <div className="space-y-2">
        {item.batchPicks.map(bp => (
          <div key={bp.id} className="flex justify-between text-sm">
            <span className="font-mono">{bp.batchNumber}</span>
            <span>{bp.quantity}</span>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
)}
```

### Worker App Component: `MultiBatchPickSheet`

**Location**: `/src/components/worker/picking/MultiBatchPickSheet.tsx`

Mobile-optimized version using Sheet instead of Dialog:
- Full-height swipe-up sheet
- Large touch targets (48px min)
- Stepper controls for quantity
- Haptic feedback on selection

---

## Implementation Phases

### Phase 1: Database Foundation (data-engineer)
**Estimated: 1 session**

#### P0 Tasks
1. Create migration for `pick_item_batches` table
2. Create `pick_item_multi_batch` RPC function
3. Create `restore_batch_quantity` helper RPC (for undo)
4. Add RLS policies for `pick_item_batches`
5. Update `getPickItems` to join `pick_item_batches`

#### Acceptance Criteria
- [ ] Table created with proper constraints
- [ ] RPC successfully deducts from multiple batches atomically
- [ ] RPC rolls back on any failure
- [ ] Existing single-batch picking still works

### Phase 2: API Layer (feature-builder)
**Estimated: 0.5 sessions**

#### P0 Tasks
1. Add `POST /api/picking/[pickListId]/items/[itemId]/multi-batch` endpoint
2. Update items GET to include `batchPicks[]`
3. Add Zod validation schema

#### Acceptance Criteria
- [ ] New endpoint accepts array of batch picks
- [ ] Returns updated pick item state
- [ ] Proper error handling for insufficient stock

### Phase 3: Desktop UI (feature-builder)
**Estimated: 1 session**

#### P0 Tasks
1. Create `MultiBatchPickDialog` component
2. Update `PickItemCard` with multi-batch indicator
3. Add "Pick from Multiple Batches" menu option
4. Add batch breakdown popover

#### P1 Tasks
1. Auto-suggest optimal batch selection (FEFO)
2. Keyboard navigation support
3. Batch filter/search in dialog

#### Acceptance Criteria
- [ ] Dialog opens with available batches
- [ ] User can enter quantities for multiple batches
- [ ] Running total updates in real-time
- [ ] Confirmation shows summary
- [ ] Card shows multi-batch indicator after pick

### Phase 4: Worker App UI (feature-builder)
**Estimated: 1 session**

#### P0 Tasks
1. Create `MultiBatchPickSheet` component
2. Update `PickItemDialog` with multi-batch option
3. Add haptic feedback

#### P1 Tasks
1. Barcode scan to add batch
2. Quick-fill buttons

#### Acceptance Criteria
- [ ] Sheet opens from pick dialog
- [ ] Touch-friendly quantity inputs
- [ ] Works offline (queues action)

### Phase 5: Testing & Polish
**Estimated: 0.5 sessions**

#### P0 Tasks
1. Run `verifier` on all changes
2. Manual testing checklist
3. Security audit for new RPC

#### P1 Tasks
1. Add multi-batch test scenarios
2. Performance testing with many batches

---

## Type Updates

### `/src/types/picking.ts` (or in picking.ts)

```typescript
export interface BatchPick {
  id: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  location?: string;
  pickedAt?: string;
  pickedBy?: string;
}

export interface PickItem {
  // ... existing fields
  batchPicks?: BatchPick[];  // NEW
}

export interface MultiBatchPickInput {
  pickItemId: string;
  batches: Array<{
    batchId: string;
    quantity: number;
  }>;
  notes?: string;
}
```

---

## Testing Checklist

### Unit Tests
- [ ] RPC handles empty batches array
- [ ] RPC validates batch ownership
- [ ] RPC prevents over-picking from batch
- [ ] RPC handles concurrent picks (locking)

### Integration Tests
- [ ] Multi-batch pick creates junction rows
- [ ] Multi-batch pick deducts from all batches
- [ ] Multi-batch pick logs all events
- [ ] Single-batch picks still use existing flow

### Manual Tests
- [ ] Pick 500 from 2 batches (300 + 200)
- [ ] Short pick: target 500, pick 400 from 2 batches
- [ ] Cancel mid-dialog, verify no changes
- [ ] Pick, then view completed item shows breakdown
- [ ] Pick list completion with multi-batch items
- [ ] QC rejection restores all multi-batch quantities

### Worker App Tests
- [ ] Multi-batch sheet opens correctly
- [ ] Touch targets are >= 48px
- [ ] Offline queue works
- [ ] Sync applies multi-batch picks

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Concurrent picks deplete same batch | Medium | High | Use `FOR UPDATE` locks in RPC |
| UI confusion with two picking flows | Low | Medium | Clear visual distinction, training |
| Performance with many batches | Low | Low | Pagination, limit batch display |
| Offline sync conflicts | Medium | Medium | Last-write-wins with conflict notification |

---

## Rollback Plan

If issues discovered post-deploy:
1. Feature flag: `ENABLE_MULTI_BATCH_PICK=false`
2. Hide multi-batch UI option
3. RPC can remain (unused)
4. No migration rollback needed (additive only)

---

## Dependencies

- Existing `pick_item_atomic` RPC for reference
- Existing `BatchSubstitutionDialog` for UI patterns
- Existing `getAvailableBatchesForItem` function

---

## Handoff Notes for Jimmy

### Execution Mode
**Recommended: `standard`** - This is a new feature with clear scope, not touching auth or existing critical paths.

### Routing Order
1. **Phase 1**: `data-engineer` - Schema + RPC
2. **Phase 2-4**: `feature-builder` - API + UI
3. **Phase 5**: `verifier` + `security-auditor` (RLS review)

### DB Work Required
Yes - new table `pick_item_batches` and RPC `pick_item_multi_batch`

### Critical Dependencies
- Must complete Phase 1 before Phase 2
- Phase 3 & 4 can run in parallel after Phase 2

---

## Definition of Done

- [ ] Multi-batch picking works in main app
- [ ] Multi-batch picking works in worker app
- [ ] Existing single-batch flow unchanged
- [ ] All tests passing
- [ ] Security audit passed
- [ ] No console.log in production code
- [ ] TypeScript strict mode passing
- [ ] STATUS.md updated

---

## Appendix: Key File Locations

| Purpose | File Path |
|---------|-----------|
| Existing RPC | `/supabase/migrations/20260121100000_atomic_stock_operations.sql` |
| Picking server logic | `/src/server/sales/picking.ts` |
| Pick item API | `/src/app/api/picking/[pickListId]/items/route.ts` |
| Batch substitution API | `/src/app/api/picking/[pickListId]/items/[itemId]/batches/route.ts` |
| Desktop picking UI | `/src/app/dispatch/picking/[pickListId]/PickingWorkflowClient.tsx` |
| PickItemCard component | `/src/components/sales/PickItemCard.tsx` |
| BatchSubstitutionDialog | `/src/components/sales/BatchSubstitutionDialog.tsx` |
| Worker pick dialog | `/src/components/worker/picking/PickItemDialog.tsx` |

---

*Plan created by planner agent. Ready for `jimmy execute PLAN-multi-batch-picking.md`*
