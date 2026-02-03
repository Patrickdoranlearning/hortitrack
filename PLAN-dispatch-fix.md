# PLAN-dispatch-fix.md
# Fix Dispatch Module Issues (Label Printing & Multi-Batch Picking)

> **Synthesized from dual-plan evaluation**
> - Plan A (Quick Pragmatic): Fast, low-risk, minimal changes
> - Plan B (Unified Architecture): Thorough, shared components
> - **Result**: Hybrid approach - pragmatic fixes now, with targeted UX adoption

**Status**: Ready
**Priority**: P0 - Production blocking
**Estimated Sessions**: 2
**Risk Level**: Low
**Recommended Mode**: standard

---

## Problem Statement

Desktop dispatch module has three blocking issues:

1. **Label Printing Broken**: Uses legacy API requiring `PRINTER_HOST` env var, no printer selection
2. **Multi-Batch Not Wired**: `MultiBatchPickDialog.tsx` exists but isn't connected to picking flow
3. **UX Gap**: Worker app has better patterns (tabs, shelf picks) that desktop lacks

---

## Dual-Plan Evaluation Summary

| Criterion | Plan A (Quick Fix) | Plan B (Unified) | Selected |
|-----------|-------------------|------------------|----------|
| Requirements fit | 3/3 | 3/3 | Tie |
| Complexity | Low | Medium-High | A |
| Sessions | 1-2 | 3-4 | A |
| Risk | Low | Medium | A |
| Future maintenance | Medium | Better long-term | B |

**Decision**: Take Plan A's approach for the core fixes (quick, low-risk), but prepare for future UX improvements. Skip the shared component abstraction layer from Plan B as it adds complexity without immediate benefit.

---

## Approach

**Philosophy**: Fix what's broken first, enhance UX second. Reuse existing tested code.

| Issue | Solution | Rationale |
|-------|----------|-----------|
| Label printing | Switch to `/api/labels/print-sale` + add printer dropdown | Same API worker uses, already tested |
| Multi-batch | Wire up existing `MultiBatchPickDialog` | Component exists and works |
| UX improvements | Optional - Add key worker patterns to MultiBatchPickDialog | Targeted enhancements, not full rewrite |

---

## Phase 1: Fix Label Printing (45 mins)

### Task 1.1: Add printer state and fetching to PickingStepLabels

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepLabels.tsx`

Add:
- State for printers list and selected printer
- useEffect to fetch printers on mount
- Printer dropdown in the UI

```typescript
// State
const [printers, setPrinters] = useState<Array<{id: string; name: string; is_default: boolean}>>([]);
const [selectedPrinter, setSelectedPrinter] = useState<string>("");
const [loadingPrinters, setLoadingPrinters] = useState(true);

// Fetch on mount
useEffect(() => {
  fetch("/api/printers")
    .then(res => res.json())
    .then(data => {
      if (data.data) {
        setPrinters(data.data);
        const defaultPrinter = data.data.find((p: any) => p.is_default);
        if (defaultPrinter) setSelectedPrinter(defaultPrinter.id);
      }
    })
    .finally(() => setLoadingPrinters(false));
}, []);
```

**Acceptance Criteria**:
- [ ] Printers are fetched when component mounts
- [ ] Default printer is auto-selected
- [ ] Loading state is shown

### Task 1.2: Add printer selector UI

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepLabels.tsx`

Add a Select dropdown above the print buttons.

**Acceptance Criteria**:
- [ ] Dropdown shows all available printers
- [ ] Default printer is marked
- [ ] Warning shown if no printers configured

### Task 1.3: Update print handlers to use new API

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepLabels.tsx`

Replace the old API calls with calls to `/api/labels/print-sale`.

```typescript
const formatPrice = (price: number | null) => {
  if (price == null) return "Price TBC";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
};

const handlePrintPriceLabels = async () => {
  setPrintingType('price');
  setLoading(true);
  try {
    const printPromises = items.map(item =>
      fetch("/api/labels/print-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTitle: item.productName || item.plantVariety,
          size: item.size,
          priceText: formatPrice(item.unitPrice),
          barcode: `PLU:${item.productName || item.plantVariety}|${item.size}`.slice(0, 40),
          symbology: "code128",
          printerId: selectedPrinter || undefined,
          copies: item.targetQty,
        }),
      })
    );

    const results = await Promise.all(printPromises);
    const failed = results.filter(r => !r.ok);

    if (failed.length > 0) {
      throw new Error(`${failed.length} item(s) failed to print`);
    }

    setPriceLabelsPrinted(true);
    toast({
      title: 'Labels Sent',
      description: `Price labels for ${items.length} items sent to printer.`,
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Print Error',
      description: error instanceof Error ? error.message : 'Failed to print labels',
    });
  } finally {
    setLoading(false);
    setPrintingType(null);
  }
};
```

**Acceptance Criteria**:
- [ ] Print button sends to selected printer
- [ ] All items print with correct quantities
- [ ] Error handling works
- [ ] Success toast shows

### Task 1.4: Handle plant labels (price labels with batch info)

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepLabels.tsx`

Plant labels are similar to price labels but include batch/lot number.

**Acceptance Criteria**:
- [ ] Plant labels include batch/lot number
- [ ] Uses same printer selection
- [ ] Both label types can be printed

---

## Phase 2: Wire Up Multi-Batch Picking (45 mins)

### Task 2.1: Add MultiBatchPickDialog import and state

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepPick.tsx`

```typescript
import MultiBatchPickDialog from '@/components/sales/MultiBatchPickDialog';

// Add state near other state declarations
const [multiBatchItem, setMultiBatchItem] = useState<PickItem | null>(null);
```

**Acceptance Criteria**:
- [ ] Import compiles
- [ ] State is available

### Task 2.2: Add Multi-Batch button to item actions

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepPick.tsx`

Add a "Multi-Batch" button to the first row of action buttons (alongside Scan/Keyboard/Check).

**Acceptance Criteria**:
- [ ] Multi button appears on each pending item
- [ ] Button opens the dialog

### Task 2.3: Add MultiBatchPickDialog to component

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/dispatch/PickingStepPick.tsx`

Add the dialog component with proper handlers.

```typescript
// Add before the navigation div at the end of the component
<MultiBatchPickDialog
  open={!!multiBatchItem}
  onOpenChange={(open) => {
    if (!open) setMultiBatchItem(null);
  }}
  pickItemId={multiBatchItem?.id || ""}
  pickListId={pickList.id}
  productName={multiBatchItem?.productName || multiBatchItem?.plantVariety || "Unknown"}
  targetQty={multiBatchItem?.targetQty || 0}
  onConfirm={async (batches, notes) => {
    if (!multiBatchItem) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/picking/${pickList.id}/items/${multiBatchItem.id}/batches`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batches, notes }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to save picks',
        });
        return;
      }

      // Calculate total picked
      const totalPicked = batches.reduce((sum, b) => sum + b.quantity, 0);

      updateItem(multiBatchItem.id, {
        status: data.status || (totalPicked >= multiBatchItem.targetQty ? 'picked' : 'short'),
        pickedQty: data.pickedQty || totalPicked,
      });

      toast({
        title: 'Item Picked',
        description: `${multiBatchItem.productName || multiBatchItem.plantVariety} picked from ${batches.length} batch(es)`,
      });

      setMultiBatchItem(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save picks',
      });
    } finally {
      setLoading(false);
    }
  }}
/>
```

**Acceptance Criteria**:
- [ ] Dialog shows available batches
- [ ] Can select multiple batches with quantities
- [ ] Progress bar shows selection status
- [ ] Confirm calls PUT API
- [ ] Item updates correctly in list
- [ ] Short picks are handled

---

## Phase 3: Quick UX Enhancements (30 mins - Optional)

### Task 3.1: Add shelf-based quick picks to MultiBatchPickDialog (Optional)

**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/sales/MultiBatchPickDialog.tsx`

Borrow the "Half Shelf / Full Shelf / Custom" pattern from worker app.

**Only if time permits** - the dialog already works without this.

**Acceptance Criteria**:
- [ ] (Optional) Each batch shows quick pick buttons
- [ ] (Optional) "Auto-fill FEFO" remains useful

---

## Definition of Done

**Critical (Must Ship)**:
- [ ] Label printing works without PRINTER_HOST env var
- [ ] Printer dropdown shows and works
- [ ] Multi-batch picking accessible from desktop dispatch
- [ ] PUT API called correctly with batch selections
- [ ] Item status updates after picking
- [ ] No regressions in existing single-batch flow

**Important**:
- [ ] Plant labels include batch number
- [ ] Error states handled gracefully
- [ ] Loading states shown

**Nice to Have**:
- [ ] Shelf-based quick picks
- [ ] Template selection for labels

---

## Test Plan

### Label Printing Tests
1. Open dispatch wizard, go to Labels step
2. Verify printer dropdown shows printers from database
3. Select a printer, click "Print" for price labels
4. Verify labels print (or API returns success)
5. Test plant labels - verify batch number included
6. Test with no printers configured - verify warning shown

### Multi-Batch Picking Tests
1. Open dispatch wizard, go to Pick step
2. Click "Multi" button on an item
3. Verify dialog shows available batches
4. Select 2+ batches with different quantities
5. Confirm - verify PUT API called with correct payload
6. Verify item shows as picked with correct total
7. Test short pick (select less than target) - verify warning
8. Test substitution flow still works

### Regression Tests
1. Single batch scan flow still works
2. Manual batch entry still works
3. Mark short still works
4. Substitution dialog still works

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing flows | Low | High | Test all flows after changes |
| Printer API difference | Low | Medium | Same API as worker app |
| State sync issues | Medium | Low | Toast confirms API success |
| Loading state issues | Low | Low | Disable buttons during operations |

---

## Files Modified

| File | Changes |
|------|---------|
| `/src/components/dispatch/PickingStepLabels.tsx` | Add printer state, dropdown, switch to print-sale API |
| `/src/components/dispatch/PickingStepPick.tsx` | Import MultiBatchPickDialog, add button, add dialog |

**No new files needed.**

---

## Handoff Notes for Jimmy

**Recommended Mode**: `standard`
**DB Work Required**: No
**Critical Dependencies**: None

**Agent Assignments**:
| Phase | Agent | Notes |
|-------|-------|-------|
| 1.1-1.4 | `feature-builder` | Label printing fix |
| After Phase 1 | `verifier` | Run tests, manual check |
| 2.1-2.3 | `feature-builder` | Multi-batch wiring |
| After Phase 2 | `verifier` | Run tests |
| After all | `ui-comprehensive-tester` | Full dispatch flow test |
| Final | `task-completion-validator` | Verify Definition of Done |

**Key Context**:
- The `/api/labels/print-sale` endpoint already works well (worker app uses it)
- The `MultiBatchPickDialog` already exists and works
- The PUT endpoint at `/api/picking/[pickListId]/items/[itemId]/batches` already supports multi-batch
- This is primarily a wiring task, not building new functionality

**Why This Approach (vs Plan B)**:
1. **Reuse over rewrite**: Components exist, just need connecting
2. **Low risk**: Minimal new code, using tested APIs
3. **Ship fast**: Can complete in one session
4. **Future-friendly**: Clean foundation if we want worker UX patterns later

---

## Related Plans

- `PLAN-dispatch-fix-A.md` - Quick pragmatic fix perspective (archived)
- `PLAN-dispatch-fix-B.md` - Unified architecture perspective (archived)

*Execute with: `jimmy execute PLAN-dispatch-fix.md`*
