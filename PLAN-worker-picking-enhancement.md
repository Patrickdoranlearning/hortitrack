# PLAN: Worker App Picking Enhancement

**Feature**: Enhanced mobile picking interface with multi-batch support and trolley workflow
**Status**: Complete (Phases 1-4 Done)
**Created**: 2026-02-01
**Author**: planner agent (via Jimmy exploration)
**Complexity**: L (Large - 4 phases)
**Estimated Sessions**: 4-6

---

## Pre-Flight Check

| Check | Status | Notes |
|-------|--------|-------|
| Existing PLAN.md | Separate file (PLAN-worker-picking-enhancement.md) | No conflicts |
| Related plans | PLAN-worker-app.md (COMPLETE), PLAN-worker-nav-restructure.md (Ready) | Worker app foundation exists |
| Worker picking routes | Exist at `/worker/picking/*` | Foundation in place |
| Main app picking | Full wizard at `/dispatch/picking/*` | Rich components to adapt |
| Database schema | `pick_items`, `pick_lists` tables | May need `pick_item_batches` for multi-batch |

---

## 1. Executive Summary

### Problem Statement

The current Worker App picking interface is functional but lacks the rich features needed for efficient nursery picking operations:

1. **Single-batch limitation**: Workers cannot pick smaller amounts from multiple batches to fulfill a single line item - a common scenario when stock is spread across batches
2. **No trolley workflow**: The main app has a full trolley step (assignment, progress tracking, staging), but the worker app jumps straight to "Complete Picking"
3. **Basic batch selection**: The current `PickItemDialog` only shows a list of batches; no barcode scanning, no variety search, no confirmation flow
4. **Missing visual polish**: No product images, no trolley progress bar, no "SCAN TO CONFIRM" interaction

### Proposed Solution

Bring the main app's PickingWizard functionality to the worker app in a mobile-optimized form, with the addition of multi-batch picking support:

1. **Enhanced Pick Flow**: Adapt `PickingStepPick.tsx` patterns for mobile with scan-first workflow
2. **Multi-Batch Picking**: Allow splitting a line item across multiple batches with quantity tracking
3. **Trolley Assignment**: Add trolley step with progress bar, staging confirmation
4. **Batch Selection Methods**: Scan barcode, type batch number, search by variety

### Mockup Reference Requirements

Based on the user's mockup:
- Order header: "Order #5542 (Smith Garden Ctr)"
- Trolley progress: "Loading onto Trolley: T-122" with 65% progress bar
- Pick items showing: product image, name with size, location, pick progress (e.g., "20/20"), checkmark when complete
- "SCAN TO CFRM" button for pending items
- "FINISH & STAGE TROLLEY" action button

---

## 2. Current State Analysis

### Worker App Picking (Current)

**Files**:
```
src/app/(worker)/worker/picking/page.tsx           # Pick queue list
src/app/(worker)/worker/picking/[pickListId]/page.tsx  # Pick execution
src/components/worker/picking/PickItemDialog.tsx   # Item pick dialog
src/app/api/worker/picking/route.ts               # Queue API
```

**Capabilities**:
- View assigned/available picking tasks
- Start a pick list (auto-claims if unassigned)
- Pick items one-by-one with dialog
- Confirm full quantity, partial (short), or substitute batch
- Complete pick list when all items done

**Limitations**:
- No multi-batch picking (single batch per line item)
- No trolley assignment step
- Basic batch selection (dropdown list only)
- No scan confirmation workflow
- No product images
- No progress visualization per trolley

### Main App Picking (Reference)

**Files**:
```
src/components/dispatch/PickingWizard.tsx          # Full wizard
src/components/dispatch/PickingStepStart.tsx       # Start step
src/components/dispatch/PickingStepLabels.tsx      # Print labels
src/components/dispatch/PickingStepPick.tsx        # Pick items
src/components/dispatch/PickingStepQC.tsx          # Quality check
src/components/dispatch/PickingStepTrolley.tsx     # Trolley assignment
src/components/dispatch/PickingStepComplete.tsx    # Completion
src/stores/use-picking-wizard-store.ts             # Zustand store
```

**Capabilities**:
- Full wizard flow: Start -> Labels -> Pick -> QC -> Trolley -> Complete
- Scan batch barcode or manual entry
- Batch search by variety/location
- Substitution with reason tracking
- QC checklist before completion
- Trolley type selection (Tag 6, Danish, Dutch, etc.)
- Trolley count with shelf tracking
- Optional trolley number recording

### Database Schema

**pick_items table** (current):
```sql
id UUID PRIMARY KEY,
pick_list_id UUID REFERENCES pick_lists(id),
order_item_id UUID REFERENCES order_items(id),
target_qty INTEGER NOT NULL,
picked_qty INTEGER DEFAULT 0,
status VARCHAR(20), -- 'pending', 'picked', 'short', 'substituted'
original_batch_id UUID REFERENCES batches(id),
picked_batch_id UUID REFERENCES batches(id),
substitution_reason TEXT,
notes TEXT,
picked_at TIMESTAMPTZ,
picked_by UUID REFERENCES profiles(id)
```

**Limitation**: Single `picked_batch_id` means one batch per line item.

---

## 3. Requirements

### Functional Requirements

| ID | Requirement | Priority | Size | Notes |
|----|-------------|----------|------|-------|
| FR-1 | Pick items from multiple batches for single line item | P0 | L | Core enhancement |
| FR-2 | Scan batch barcode to select/confirm batch | P0 | M | Existing scanner integration |
| FR-3 | Type batch number manually | P0 | S | Fallback for damaged barcodes |
| FR-4 | Search batches by variety name | P1 | M | Convenience feature |
| FR-5 | Show pick progress per item (e.g., "15/20") | P0 | S | UX improvement |
| FR-6 | Add trolley assignment step | P0 | M | Matches main app |
| FR-7 | Show trolley progress bar | P0 | S | Per mockup |
| FR-8 | "FINISH & STAGE TROLLEY" action | P0 | S | Clear completion action |
| FR-9 | Display batch location prominently | P0 | S | Help workers find stock |
| FR-10 | Product images in pick list | P2 | M | Nice-to-have polish |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Touch targets | Minimum 48x48px |
| NFR-2 | Scan response time | < 500ms from scan to confirmation |
| NFR-3 | Offline resilience | Graceful degradation with queued actions |
| NFR-4 | Page load | < 2s initial load |

### Assumptions

- Workers have reliable (though potentially slow) network in polytunnels
- Batch barcodes follow existing `ht:batch:<number>` format
- Product images, if added, can be loaded lazily
- Trolley types match main app configuration (attribute_options)

---

## 4. Technical Design

### Architecture Decision: Multi-Batch Picking

**Option A: Junction Table (Recommended)**
```sql
CREATE TABLE pick_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_item_id UUID REFERENCES pick_items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id),
  quantity INTEGER NOT NULL,
  picked_at TIMESTAMPTZ DEFAULT now(),
  picked_by UUID REFERENCES profiles(id),
  UNIQUE(pick_item_id, batch_id)
);
```

**Pros**:
- Clean relational model
- Full audit trail per batch
- Easy to query total picked across batches
- No changes to `pick_items` table structure

**Cons**:
- More complex queries (join required)
- Need migration

**Option B: JSON Array in pick_items**
```sql
ALTER TABLE pick_items
ADD COLUMN picked_batches JSONB DEFAULT '[]';
-- Format: [{ "batchId": "uuid", "quantity": 10, "pickedAt": "..." }, ...]
```

**Pros**:
- Simpler migration
- All data in one row

**Cons**:
- Harder to query/aggregate
- No referential integrity
- Less audit-friendly

**Decision**: Option A - Junction table provides better data integrity and query flexibility.

### Component Structure

```
src/components/worker/picking/
  WorkerPickingWizard.tsx        # New: Mobile wizard wrapper
  PickingHeader.tsx              # New: Order header with trolley progress
  PickingItemList.tsx            # New: Scrollable pick list
  PickingItemCard.tsx            # New: Individual item with multi-batch
  PickingBatchSelector.tsx       # New: Scan/search/manual batch selection
  PickingTrolleyStep.tsx         # New: Trolley assignment (mobile)
  PickingConfirmation.tsx        # New: Final staging confirmation

  # Existing (to enhance)
  PickItemDialog.tsx             # Enhance for multi-batch
```

### State Management

Extend or adapt `use-picking-wizard-store.ts` for worker app:

```typescript
interface WorkerPickingState {
  // Pick list data
  pickList: PickList | null;
  items: WorkerPickItem[];

  // Current picking state
  currentItemId: string | null;
  batchSelections: Record<string, BatchSelection[]>; // itemId -> batch picks

  // Trolley state
  trolleyInfo: TrolleyInfo;
  trolleyProgress: number; // 0-100

  // UI state
  step: 'picking' | 'trolley' | 'staging';
  scannerOpen: boolean;
  isSubmitting: boolean;
}

interface BatchSelection {
  batchId: string;
  batchNumber: string;
  quantity: number;
  location?: string;
}
```

### API Changes

**New/Modified Endpoints**:

```typescript
// POST /api/picking/[pickListId]/items/[itemId]/batches
// Add a batch pick to an item (multi-batch support)
{
  batchId: string;
  quantity: number;
}

// GET /api/picking/[pickListId]/items/[itemId]/picks
// Get all batch picks for an item
// Response: { picks: BatchSelection[] }

// DELETE /api/picking/[pickListId]/items/[itemId]/batches/[pickId]
// Remove a batch pick (undo)
```

**RPC Enhancement**:

```sql
-- New RPC for atomic multi-batch pick
CREATE OR REPLACE FUNCTION pick_item_multi_batch(
  p_org_id UUID,
  p_pick_item_id UUID,
  p_batches JSONB, -- [{ "batchId": "uuid", "quantity": 10 }, ...]
  p_user_id UUID
) RETURNS JSONB AS $$
-- Implementation: Insert into pick_item_batches, update pick_items.picked_qty
$$;
```

### Database Migration

```sql
-- Migration: add_pick_item_batches_table

-- 1. Create junction table
CREATE TABLE pick_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  pick_item_id UUID NOT NULL REFERENCES pick_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  picked_at TIMESTAMPTZ DEFAULT now(),
  picked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pick_item_id, batch_id)
);

-- 2. Add RLS
ALTER TABLE pick_item_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON pick_item_batches
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

-- 3. Add indexes
CREATE INDEX idx_pick_item_batches_pick_item ON pick_item_batches(pick_item_id);
CREATE INDEX idx_pick_item_batches_batch ON pick_item_batches(batch_id);

-- 4. Migrate existing picks (one-time data migration)
INSERT INTO pick_item_batches (org_id, pick_item_id, batch_id, quantity, picked_at, picked_by)
SELECT
  pl.org_id,
  pi.id,
  pi.picked_batch_id,
  pi.picked_qty,
  pi.picked_at,
  pi.picked_by
FROM pick_items pi
JOIN pick_lists pl ON pi.pick_list_id = pl.id
WHERE pi.picked_batch_id IS NOT NULL AND pi.picked_qty > 0;
```

---

## 5. UI/UX Design

### Pick List View (Enhanced)

```
+------------------------------------------+
|  [<]  Order #5542 (Smith Garden Ctr)     |
+------------------------------------------+
|  Loading onto Trolley: T-122             |
|  [=========>                    ] 65%    |
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  | [IMG] Hydrangea 'Annabelle' 5L     |  |
|  |       Bed 2                        |  |
|  |       [==========] 20/20  [check]  |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | [IMG] Lavandula 'Hidcote' 9cm      |  |
|  |       Tunnel 4                     |  |
|  |       [====>     ] 8/15            |  |
|  |                                    |  |
|  |       [  SCAN TO CFRM  ]           |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | [IMG] Rosemary 'Miss Jessop' 3L    |  |
|  |       Yard B                       |  |
|  |       [          ] 0/25            |  |
|  |                                    |  |
|  |       [  SCAN TO CFRM  ]           |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|        [ FINISH & STAGE TROLLEY ]        |
+------------------------------------------+
```

### Batch Selection Flow (Multi-Batch)

```
+------------------------------------------+
|  Select Batch for:                       |
|  Lavandula 'Hidcote' 9cm                 |
|  Need: 15  |  Picked: 8                  |
+------------------------------------------+
|                                          |
|  [  Scan Batch Barcode  ]   <- Primary   |
|                                          |
|  -------- or --------                    |
|                                          |
|  Type batch number:                      |
|  [________________________]              |
|                                          |
|  -------- or --------                    |
|                                          |
|  Search by variety:                      |
|  [___________] [Search]                  |
|                                          |
|  Available Batches:                      |
|  +----------------------------------+    |
|  | B2024-0892 | Tunnel 4 | 50 avail |   |
|  | [  Pick 7  ] <- Tap to add       |   |
|  +----------------------------------+    |
|  | B2024-0893 | Yard B   | 12 avail |   |
|  | [  Pick 12 ]                     |   |
|  +----------------------------------+    |
|                                          |
|  Currently Picked from:                  |
|  - B2024-0890: 5 units                   |
|  - B2024-0891: 3 units                   |
|                                          |
+------------------------------------------+
|  Remaining: 7   [ Done with Item ]       |
+------------------------------------------+
```

### Trolley Assignment Step

```
+------------------------------------------+
|  [<]  Assign Trolley                     |
+------------------------------------------+
|                                          |
|  Order #5542 - Smith Garden Centre       |
|  60 units across 3 items                 |
|                                          |
|  Trolley Number (scan or type):          |
|  [  T-122  ]  [Scan QR]                  |
|                                          |
|  Trolley Type:                           |
|  [v] Tag 6 (Yellow)                      |
|                                          |
|  Shelves Used:                           |
|  [ - ]   4   [ + ]                       |
|                                          |
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  |  Ready to stage!                   |  |
|  |                                    |  |
|  |  60 units on trolley T-122         |  |
|  |  Delivery: Tomorrow, 9am           |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|      [ FINISH & STAGE TROLLEY ]          |
+------------------------------------------+
```

---

## 6. Implementation Phases

### Phase 1: Database & API Foundation (P0)
**Estimated: 1 session**
**Agent**: `data-engineer`

| # | Task | Size | Depends On | Acceptance Criteria |
|---|------|------|------------|---------------------|
| 1.1 | Create `pick_item_batches` table | M | - | Table exists with RLS, indexes |
| 1.2 | Create migration for existing data | S | 1.1 | Existing picks migrated to new table |
| 1.3 | Create `pick_item_multi_batch` RPC | M | 1.1 | RPC handles multi-batch inserts atomically |
| 1.4 | Update `getPickItems` to include batch picks | S | 1.1 | Returns `batchPicks: []` per item |
| 1.5 | Add API endpoints for batch picks | M | 1.4 | POST, GET, DELETE for item batches |

**Phase 1 Complete When**:
- [x] Migration runs without errors
- [x] Existing pick data preserved in new table
- [x] RPC correctly handles multi-batch picks
- [x] API returns batch picks with pick items

### Phase 2: Enhanced Pick Flow UI (P0)
**Estimated: 2 sessions**
**Agent**: `feature-builder`

| # | Task | Size | Depends On | Acceptance Criteria |
|---|------|------|------------|---------------------|
| 2.1 | Create `WorkerPickingWizard.tsx` shell | M | Phase 1 | Wizard renders with header, list, footer |
| 2.2 | Create `PickingItemCard.tsx` with progress | M | 2.1 | Shows item with picked/target, status badge |
| 2.3 | Create `PickingBatchSelector.tsx` | L | 2.2 | Scan, manual, search all work |
| 2.4 | Integrate scanner for batch confirmation | M | 2.3 | Scan decodes batch, adds to picks |
| 2.5 | Add multi-batch display in item card | M | 2.3 | Shows "Picked from: B123 (5), B124 (3)" |
| 2.6 | Update pick completion logic | M | 2.5 | Item complete when picked_qty >= target_qty |

**Phase 2 Complete When**:
- [x] Workers can scan batch to pick
- [x] Workers can type batch number
- [x] Workers can search by variety
- [x] Multiple batches shown per item
- [x] Progress bar updates correctly

### Phase 3: Trolley Step (P0)
**Estimated: 1 session**
**Agent**: `feature-builder`

| # | Task | Size | Depends On | Acceptance Criteria |
|---|------|------|------------|---------------------|
| 3.1 | Create `PickingTrolleyStep.tsx` (mobile) | M | Phase 2 | Mobile-optimized trolley UI |
| 3.2 | Add trolley progress bar to header | S | 3.1 | Shows "Loading onto Trolley: T-XXX" |
| 3.3 | Trolley number scan/entry | M | 3.1 | Scan or type trolley ID |
| 3.4 | "FINISH & STAGE TROLLEY" action | M | 3.3 | Completes pick list, updates order status |
| 3.5 | Integrate with existing trolley types | S | 3.1 | Uses attribute_options for trolley types |

**Phase 3 Complete When**:
- [x] Trolley step appears after all items picked
- [x] Progress bar shows during picking
- [x] Trolley number can be scanned or typed
- [x] Completion updates pick list and order status

### Phase 4: Polish & Testing (P1)
**Estimated: 1 session**
**Agent**: `feature-builder` + `verifier`

| # | Task | Size | Depends On | Acceptance Criteria |
|---|------|------|------------|---------------------|
| 4.1 | Add product images (lazy loaded) | M | Phase 3 | Images show in pick cards |
| 4.2 | Add haptic feedback on scan | S | Phase 3 | Vibration on successful scan |
| 4.3 | Offline handling improvements | M | Phase 3 | Queued actions with visual indicator |
| 4.4 | Test all flows end-to-end | M | 4.3 | All happy paths work |
| 4.5 | Test edge cases (short, substitute) | M | 4.4 | Edge cases handled gracefully |
| 4.6 | Mobile viewport testing | S | 4.5 | Works on 375px viewport |

**Phase 4 Complete When**:
- [ ] Product images load (if available)
- [ ] Haptic feedback on scan success
- [ ] Offline indicator shows
- [ ] All test scenarios pass
- [ ] Touch targets verified >= 48px

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Multi-batch adds complexity to pick reconciliation | Medium | Medium | Clear UI showing batch breakdown, total validation |
| Migration breaks existing pick data | Low | High | Test migration on staging first, backup data |
| Scanner unreliable in polytunnels | Medium | Medium | Manual entry always available, batch search fallback |
| Performance with many batch picks | Low | Low | Paginate if > 50 items, lazy load images |
| Workers confused by new flow | Medium | Medium | Keep single-batch path simple, progressive disclosure |

---

## 8. Definition of Done

### Feature Complete
- [x] Workers can pick items from multiple batches
- [x] All three batch selection methods work (scan, type, search)
- [x] Trolley assignment step with progress visualization
- [x] "FINISH & STAGE TROLLEY" completes the workflow
- [x] Pick progress shows correctly (e.g., "15/20")
- [x] Location displayed prominently per item

### Quality Gates
- [x] TypeScript strict mode passes (for picking files)
- [x] No console errors in production
- [ ] Mobile viewport tested (375px minimum) - requires manual testing
- [x] Touch targets >= 48px (min-h-[48px] classes used)
- [x] RLS policies on new tables
- [x] Migration tested on staging (Supabase applied)

---

## 9. Handoff Notes

### Jimmy Command
```
jimmy execute PLAN-worker-picking-enhancement.md --mode thorough
```

### Mode Recommendation
**thorough** - This involves database schema changes (multi-batch table) and significant UI changes affecting core picking workflow.

### DB Work Required
**Yes** - `data-engineer` must run Phase 1 first:
- Create `pick_item_batches` table
- Data migration for existing picks
- New RPC for multi-batch operations

### Critical Dependencies
- Existing `pick_items` and `pick_lists` tables (verified)
- Existing scanner integration in main app (verified)
- Existing trolley type attribute options (verified)
- Worker app picking routes exist (verified)

### First Task
Start with Phase 1, Task 1.1 - Create `pick_item_batches` table.
**Agent**: `data-engineer`

### Agent Routing
- Phase 1: `data-engineer` for schema/migration/RPC
- Phase 2-4: `feature-builder` for UI work
- After Phase 1: `security-auditor` for RLS review
- After each phase: `verifier` for tests
- Before merge: `karen` for reality check

### Key Files to Reference
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepPick.tsx` - Main app pick UI
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepTrolley.tsx` - Main app trolley UI
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/(worker)/worker/picking/[pickListId]/page.tsx` - Current worker pick page
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/sales/picking.ts` - Pick list service
- `/Users/patrickdoran/Hortitrack/hortitrack/src/stores/use-picking-wizard-store.ts` - Wizard state management

### Key Patterns to Follow
- Use existing `ScannerClient` for barcode scanning
- Use existing `useAttributeOptions` for trolley types
- Follow mobile patterns from worker app (48px touch targets, safe area padding)
- Use existing toast patterns for feedback

---

*Plan created by planner agent via Jimmy exploration. Ready for execution via `jimmy execute PLAN-worker-picking-enhancement.md --mode thorough`*
