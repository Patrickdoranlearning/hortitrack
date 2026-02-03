# PLAN-dispatch-fix-A.md
# Perspective: Quick Pragmatic Fix

> **Philosophy**: Minimal changes to get things working. Reuse existing components. Ship fast, iterate later.

## Feature: Fix Dispatch Module Issues

**Status**: Ready
**Priority**: P0 - Production blocking
**Estimated Sessions**: 1-2
**Risk Level**: Low (reusing existing, tested code)

---

## Problem Statement

Desktop dispatch has three issues:
1. Label printing is broken (hardcoded PRINTER_HOST, no printer selection)
2. Multi-batch picking exists but isn't wired up
3. UX could be better (worker app has good patterns)

## Quick Fix Approach

**Core Principle**: The worker app already has working solutions. Desktop dispatch should reuse them, not reinvent.

---

## Phase 1: Fix Label Printing (30 mins)

### Task 1.1: Update PickingStepLabels to use the better API

**File**: `/src/components/dispatch/PickingStepLabels.tsx`

**Current Problem**:
- Calls `/api/sales/orders/[orderId]/labels/print` which requires `PRINTER_HOST` env var
- No printer selection, no template selection
- Plant labels don't work (API ignores `type: 'plant'`)

**Quick Fix**:
- Switch to calling `/api/labels/print-sale` (same API worker app uses)
- Add printer dropdown (fetch from `/api/printers`)
- Build label items from pick items

**Changes**:
```typescript
// Add state for printer
const [printers, setPrinters] = useState([]);
const [selectedPrinter, setSelectedPrinter] = useState("");

// Fetch printers on mount (same pattern as SaleLabelPrintSheet)
useEffect(() => {
  fetch("/api/printers").then(...)
}, []);

// Update handlePrintPriceLabels to use print-sale API
const handlePrintPriceLabels = async () => {
  for (const item of items) {
    await fetch("/api/labels/print-sale", {
      method: "POST",
      body: JSON.stringify({
        productTitle: item.productName,
        size: item.size,
        priceText: formatPrice(item.unitPrice),
        barcode: `PLU:${item.productName}|${item.size}`.slice(0, 40),
        printerId: selectedPrinter || undefined,
        copies: item.targetQty,
      }),
    });
  }
};
```

**Acceptance Criteria**:
- [ ] Printer dropdown shows available printers
- [ ] Print button sends to selected printer (or default)
- [ ] Labels print successfully
- [ ] Works without PRINTER_HOST env var

---

## Phase 2: Wire Up Multi-Batch Picking (45 mins)

### Task 2.1: Connect MultiBatchPickDialog to PickingStepPick

**Files**:
- `/src/components/dispatch/PickingStepPick.tsx`
- `/src/components/sales/MultiBatchPickDialog.tsx`

**Current State**:
- `MultiBatchPickDialog.tsx` exists with full multi-batch UI
- Backend API at `/api/picking/[pickListId]/items/[itemId]/batches` (PUT) works
- `PickingStepPick.tsx` doesn't use it

**Quick Fix**:
- Import and add `MultiBatchPickDialog` to `PickingStepPick`
- Add state to track which item is being picked
- Wire up the confirm handler to call PUT API

**Changes**:
```typescript
// Add import
import MultiBatchPickDialog from '@/components/sales/MultiBatchPickDialog';

// Add state
const [multiBatchItem, setMultiBatchItem] = useState<PickItem | null>(null);

// Add dialog with handler
<MultiBatchPickDialog
  open={!!multiBatchItem}
  onOpenChange={(open) => !open && setMultiBatchItem(null)}
  pickItemId={multiBatchItem?.id || ""}
  pickListId={pickList.id}
  productName={multiBatchItem?.productName || multiBatchItem?.plantVariety || ""}
  targetQty={multiBatchItem?.targetQty || 0}
  onConfirm={async (batches, notes) => {
    const res = await fetch(`/api/picking/${pickList.id}/items/${multiBatchItem!.id}/batches`, {
      method: 'PUT',
      body: JSON.stringify({ batches, notes }),
    });
    // Update local state on success
    const data = await res.json();
    if (data.success) {
      updateItem(multiBatchItem!.id, {
        status: data.status,
        pickedQty: data.pickedQty,
      });
      setMultiBatchItem(null);
    }
  }}
/>

// Update action buttons to include multi-batch option
<Button onClick={() => setMultiBatchItem(item)}>
  Multi-Batch
</Button>
```

**Acceptance Criteria**:
- [ ] "Multi-Batch" button appears on each pending item
- [ ] Dialog opens with available batches
- [ ] Can select multiple batches with quantities
- [ ] Confirm saves via PUT API
- [ ] Item status updates correctly

---

## Phase 3: Quick UX Polish (Optional - 30 mins)

### Task 3.1: Add shelf-based quick picks to MultiBatchPickDialog

**Low Priority** - The existing dialog already works. This is nice-to-have.

If time permits, borrow the "Half Shelf / Full Shelf / Custom" pattern from `PickingBatchSelector.tsx`.

**Acceptance Criteria**:
- [ ] (Optional) Quick pick buttons show per batch
- [ ] (Optional) Auto-fill FEFO button works

---

## Definition of Done

**Must Have**:
- [ ] Price labels print via printer selection (no env var required)
- [ ] Multi-batch picking works from desktop dispatch
- [ ] All existing functionality still works

**Nice to Have**:
- [ ] Shelf-based quick picks
- [ ] Plant label printing (separate ticket if needed)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing flow | Low | Medium | Test single-batch flow still works |
| API mismatch | Low | Low | Using same APIs as worker app |
| State sync issues | Medium | Low | Refresh pick list after changes |

---

## Files to Modify

| File | Change Type | Lines Est. |
|------|-------------|------------|
| `PickingStepLabels.tsx` | Modify | +50, -20 |
| `PickingStepPick.tsx` | Modify | +40, -5 |

**No new files needed** - reusing existing components.

---

## Handoff Notes for Jimmy

**Recommended Mode**: `standard`
**DB Work Required**: No
**Critical Dependencies**: None

**Agent Assignments**:
- Phase 1-2: `feature-builder`
- After each phase: `verifier`
- Final: `task-completion-validator`

**Key Decisions Made**:
- Reuse `/api/labels/print-sale` instead of fixing old API
- Reuse `MultiBatchPickDialog` instead of porting worker patterns
- Skip plant labels for now (can be separate ticket)
