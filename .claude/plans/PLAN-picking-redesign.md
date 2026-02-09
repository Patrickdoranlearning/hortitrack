# PLAN: Picking Redesign — Synthesized

> Dual plan synthesis: Software Engineer (A) + Nursery Operative (B)
> See: `PLAN-picking-redesign-A.md` and `PLAN-picking-redesign-B.md`

## Summary

Redesign the picking step to be scan-first, one-batch-at-a-time, massively simple. Fix two critical database bugs that break batch picking entirely.

## Critical Bugs to Fix First

### Bug 1: `reserved_quantity` constraint violation
**File**: `pick_item_multi_batch` SQL function
**Error**: `batches_reserved_not_exceeding_quantity`
**Cause**: Function deducts `quantity` but never adjusts `reserved_quantity` → constraint `reserved_quantity <= quantity` fires
**Fix**: Add `reserved_quantity = GREATEST(0, reserved_quantity - qty)` to the deduct step, and restore on re-pick cleanup

### Bug 2: `pick_item_status` type casting
**File**: Same function
**Error**: `column "status" is of type pick_item_status but expression is of type text`
**Cause**: `v_final_status` declared as `text`, assigned to enum column without cast
**Fix**: `status = v_final_status::pick_item_status`

---

## UX Redesign

### Core Principle: Scan → Quantity → Confirm → Repeat

The entire pick flow for each item becomes:

```
1. Tap item card → Pick sheet opens
2. Two tabs: "Pick" (primary) | "Search" (fallback)
3. "Pick" tab has camera scanner at top + available batch list below
4. Scan datamatrix OR tap a batch from the list
5. Quantity confirmation overlay: "Batch X — How many?"
   Pre-filled: min(remaining, available)
6. Confirm → batch added to accumulated picks → "Scan next batch"
7. When total >= target → show "Done" → auto-submit all batches via existing bulk API
8. "Short" button always visible for partial picks
```

### What Gets Removed
- 4-tab layout (Available/Scan/Type/Search) → 2 tabs (Pick/Search)
- 6-button action bar per item → single "Tap to Pick"
- Half Shelf / Full Shelf / Custom buttons → simple +/- with number input
- Separate MultiBatchPickDialog wrapper → inline in PickingStepPick
- "Type" tab → merged into Search tab
- "Confirm Pick" button for pre-allocated batches → everything goes through same flow

### What Stays
- Same `pick_item_multi_batch` RPC (with bug fixes)
- Same API route (`PUT /api/picking/[pickListId]/items/[itemId]/batches`)
- Substitution flow (moved to secondary "More" menu)
- Haptic feedback
- Camera scanner (`ScannerClient`)

---

## Implementation Steps

### Step 1: Database Migration — Fix `pick_item_multi_batch`
Create new migration that replaces the function with:
- `v_final_status::pick_item_status` cast on UPDATE
- `reserved_quantity` adjustment during deduct and restore
- Proper handling for batches where reserved_quantity may already be 0

**New file**: `supabase/migrations/20260209_fix_pick_item_multi_batch.sql`

### Step 2: Rebuild BatchPicker → PickingFlow
Complete rewrite of `src/components/picking/BatchPicker.tsx`:

**New structure**:
```
PickingFlow (Sheet on mobile, Dialog on desktop)
  ├── Header: product name + progress bar + "X/Y picked"
  ├── Two tabs: "Pick" | "Search"
  ├── Pick tab:
  │   ├── Camera scanner (compact, always ready)
  │   ├── "— or tap a batch below —" divider
  │   └── Available batch list (simple cards, tap to select)
  ├── Search tab:
  │   ├── Search input
  │   └── Results list (same batch cards)
  ├── Quantity Confirmation (overlay when batch selected):
  │   ├── Batch info
  │   ├── Number input with +/- buttons (pre-filled)
  │   └── Cancel | Confirm buttons (BIG, 56px height)
  ├── Accumulated picks summary (badges)
  └── Footer: [Mark Short] [Done X/Y]
```

**Key behaviors**:
- On scan/tap: show quantity confirmation inline (not new dialog)
- Pre-fill quantity with `Math.min(remaining, batchAvailable)`
- After confirm: add to accumulated list, clear confirmation, ready for next scan
- "Done" button submits all accumulated batches via PUT endpoint
- Auto-close when target met (with brief "Complete!" flash)

### Step 3: Simplify PickingStepPick
Rewrite `src/components/dispatch/PickingStepPick.tsx`:

**Remove**:
- All the per-item action buttons (Scan, Manual, MultiBatch, Confirm)
- Separate Scanner dialog
- Separate Manual Entry dialog
- `MultiBatchPickDialog` import/usage

**Replace with**:
- Each pending item is a tappable card showing product, qty, location
- Tapping opens the new PickingFlow (sheet)
- PickingFlow handles everything — scan, search, quantity, confirm
- On complete, PickingFlow calls the bulk API, updates store, closes
- "Short" and "Substitute" are in a secondary actions row (smaller buttons)

### Step 4: Cleanup
- Remove `src/components/sales/MultiBatchPickDialog.tsx` (no longer needed)
- Update imports in any file that referenced MultiBatchPickDialog

---

## Files Modified

| File | Action | Risk |
|------|--------|------|
| `supabase/migrations/20260209_fix_pick_item_multi_batch.sql` | NEW | Low — bugfix only |
| `src/components/picking/BatchPicker.tsx` | REWRITE | Medium — new UX |
| `src/components/dispatch/PickingStepPick.tsx` | MAJOR EDIT | Medium — simplified |
| `src/components/sales/MultiBatchPickDialog.tsx` | DELETE | Low — wrapper removed |

## Design Decisions

1. **Keep bulk API, simulate one-at-a-time**: Accumulate picks client-side, submit all at once. Simpler than creating a new per-batch API. Avoids partial state in DB.

2. **Two tabs not four**: "Pick" (scan + list) and "Search" (full text). "Type" merged into Search. "Available" merged into Pick.

3. **Quantity confirmation as overlay, not new dialog**: Faster, no dialog-on-dialog nesting, keeps context visible.

4. **Short always visible**: Operatives need this escape hatch. One tap, always there.

5. **Auto-advance after completion**: When an item is fully picked, auto-scroll/highlight the next pending item.

6. **56px confirm buttons**: Nursery operatives wear gloves, screens are wet. Big targets matter.

## Success Criteria

- [ ] Picking a single batch from scan works end-to-end (no DB errors)
- [ ] Picking multiple batches in sequence works (scan → qty → confirm → scan → qty → confirm → done)
- [ ] Short pick works (pick some, mark short for the rest)
- [ ] Search fallback works when scanner can't read a label
- [ ] Progress bar updates in real-time as batches are confirmed
- [ ] Mobile-first: works on phone in landscape/portrait
