# Plan A: Picking Redesign — Software Engineer Perspective

> Focus: Fix bugs, data integrity, clean architecture, type safety

## Problem Analysis

### Bug 1: `batches_reserved_not_exceeding_quantity` Constraint Violation
- **Root cause**: `pick_item_multi_batch()` deducts from `batches.quantity` (line 122-126) but never adjusts `reserved_quantity`
- When `quantity` drops below `reserved_quantity`, the CHECK constraint `reserved_quantity <= quantity` fires
- The function restores quantity on re-pick (line 60-70) but never touches `reserved_quantity` either
- **Fix**: Decrement `reserved_quantity` alongside `quantity` when picking, and restore it when clearing picks

### Bug 2: `pick_item_status` Type Mismatch
- **Root cause**: `v_final_status` declared as `text` (line 27) but `pick_items.status` is `pick_item_status` enum
- PostgreSQL won't always implicitly cast text → enum in UPDATE assignments
- **Fix**: Cast explicitly: `status = v_final_status::pick_item_status`

### UX Problem: Too Complex
- Current picking has 6 buttons per item (Scan, Manual, MultiBatch, Confirm, Substitute, Short)
- Multi-batch is hidden behind a Layers icon — not discoverable
- The "Scan" tab in BatchPicker doesn't match the mental model of "pick"
- No one-batch-at-a-time confirmation flow

## Architecture

### New Component: `PickingFlow` (replaces inner logic of PickingStepPick)
```
PickingStepPick
  └── For each pending item:
        └── PickItemCard (collapsed) — tap to expand
              └── PickingFlow (the new unified flow)
                    ├── Tab 1: "Pick" (primary) — scan datamatrix / tap batch from list
                    │   └── On match → QuantityConfirm inline → confirm → loop
                    └── Tab 2: "Search" (secondary) — search all batches
                          └── On select → QuantityConfirm inline → confirm → loop
```

### Data Flow: One Batch at a Time
```
1. User taps item → PickingFlow opens inline
2. Camera auto-starts (or user taps batch from list)
3. Scan/select → system shows: "Batch X found — How many?" with target remaining
4. User enters quantity → taps Confirm
5. API call: individual batch pick saved immediately
6. If remaining > 0: loop back to step 2 ("Scan next batch")
7. If remaining = 0: auto-close, mark picked
8. User can tap "Short" at any time to close with partial
```

### API Strategy: Incremental vs Bulk
Two approaches:
- **Option A**: Keep bulk `pick_item_multi_batch` — accumulate batches client-side, submit all at once
- **Option B**: New `pick_item_single_batch` RPC — submit one batch at a time, server accumulates

**Recommendation: Option A** (keep bulk) because:
- Already built and mostly working (just needs bug fixes)
- Simpler transaction model (one transaction for all batches)
- We just change the UX to feel like one-at-a-time while actually submitting bulk on final confirm
- No new migration needed beyond bug fixes

## Implementation Steps

### Phase 1: Fix Critical Bugs (Migration)
1. New migration: fix `pick_item_multi_batch` function
   - Cast `v_final_status::pick_item_status` on the UPDATE
   - Handle `reserved_quantity` decrement: `reserved_quantity = GREATEST(0, reserved_quantity - v_batch_input.quantity)`
   - Handle `reserved_quantity` restore on re-pick cleanup

### Phase 2: Simplify PickingStepPick
2. Strip down item cards: remove Scan/Manual/MultiBatch/Confirm buttons
3. Each pending item becomes a tappable card that opens the pick flow
4. Completed items stay as-is (read-only status cards)

### Phase 3: Rebuild BatchPicker → PickingFlow
5. Rename tabs: "Pick" (primary, replaces "Scan") + "Search" (secondary, replaces "Search")
6. Remove "Available" and "Type" tabs — merge useful features into the two remaining tabs
7. "Pick" tab:
   - Camera scanner always ready at top
   - Below scanner: list of available batches (same as old "Available" tab)
   - Tapping a batch from list = same as scanning it
8. One-at-a-time flow:
   - On scan/select: show quantity prompt inline (not new dialog)
   - Pre-fill with `Math.min(remaining, batchAvailable)`
   - Confirm adds to accumulated list, shows running total
   - "Pick" button at bottom shows running count
9. "Search" tab:
   - Full text search across all batches
   - Same one-at-a-time flow on selection

### Phase 4: Polish
10. Keep "Short" and "Substitute" as secondary actions (collapsed in a "More" menu)
11. Auto-advance to next pending item after completing one
12. Haptic feedback on scan success/failure

## Files to Modify
- `supabase/migrations/YYYYMMDD_fix_pick_item_multi_batch.sql` (NEW)
- `src/components/dispatch/PickingStepPick.tsx` (major rewrite)
- `src/components/picking/BatchPicker.tsx` (major rewrite → becomes PickingFlow)
- `src/components/sales/MultiBatchPickDialog.tsx` (can be removed, wrapper no longer needed)

## Risk Assessment
- **Migration risk**: LOW — only fixing cast and reserved_quantity logic
- **UI risk**: MEDIUM — significant UX change, but the flow is simpler
- **Data risk**: LOW — same underlying `pick_item_multi_batch` RPC, just with fixes
