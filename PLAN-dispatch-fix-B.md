# PLAN-dispatch-fix-B.md
# Perspective: Unified Architecture

> **Philosophy**: Properly unify desktop and worker patterns for long-term maintainability. Build shared components that both apps use.

## Feature: Fix Dispatch Module Issues

**Status**: Ready
**Priority**: P0 - Production blocking
**Estimated Sessions**: 3-4
**Risk Level**: Medium (refactoring shared components)

---

## Problem Statement

Desktop dispatch and worker app have diverged:
- Different label printing implementations
- Different batch selection UX patterns
- Duplicated code that will drift further

## Unified Architecture Approach

**Core Principle**: Create shared components in a common location that both desktop and worker apps consume. This prevents future drift and ensures feature parity.

---

## Phase 1: Create Shared Printer Selection Component (1 hour)

### Task 1.1: Extract PrinterSelector to shared location

**New File**: `/src/components/shared/PrinterSelector.tsx`

Create a reusable printer selection component that:
- Fetches available printers from `/api/printers`
- Supports default printer auto-selection
- Handles loading/error states
- Works in both desktop and mobile contexts

```typescript
interface PrinterSelectorProps {
  value: string;
  onChange: (printerId: string) => void;
  variant?: 'desktop' | 'mobile';
  showLabel?: boolean;
}
```

**Acceptance Criteria**:
- [ ] Component works in isolation
- [ ] Supports both desktop (dropdown) and mobile (sheet) variants
- [ ] Auto-selects default printer
- [ ] Handles "no printers" state gracefully

### Task 1.2: Extract TemplateSelectorto shared location

**New File**: `/src/components/shared/TemplateSelector.tsx`

Similar pattern for label template selection.

**Acceptance Criteria**:
- [ ] Fetches templates from `/api/label-templates`
- [ ] Filters by label type
- [ ] Shows dimensions

---

## Phase 2: Create Unified Label Printing Service (1.5 hours)

### Task 2.1: Create shared printing hook

**New File**: `/src/hooks/use-label-printing.ts`

```typescript
interface UseLabelPrintingOptions {
  printerId?: string;
  templateId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface LabelItem {
  productName: string;
  size: string;
  price: number;
  quantity: number;
  batchNumber?: string;
}

function useLabelPrinting(options: UseLabelPrintingOptions) {
  const printSaleLabels = async (items: LabelItem[]) => { ... };
  const printPlantLabels = async (items: LabelItem[]) => { ... };

  return {
    printSaleLabels,
    printPlantLabels,
    isPrinting,
    error,
  };
}
```

**Acceptance Criteria**:
- [ ] Hook handles all print API calls
- [ ] Supports batch printing (multiple items)
- [ ] Returns loading/error state
- [ ] Works with any printer/template

### Task 2.2: Update SaleLabelPrintSheet to use shared hook

**File**: `/src/components/worker/picking/SaleLabelPrintSheet.tsx`

Refactor to use the shared hook instead of inline fetch calls.

**Acceptance Criteria**:
- [ ] Still works identically
- [ ] Uses shared PrinterSelector
- [ ] Uses useLabelPrinting hook

### Task 2.3: Update PickingStepLabels to use shared components

**File**: `/src/components/dispatch/PickingStepLabels.tsx`

Refactor to use:
- `PrinterSelector`
- `TemplateSelector`
- `useLabelPrinting`

**Acceptance Criteria**:
- [ ] Price labels work
- [ ] Plant labels work (add new endpoint if needed)
- [ ] Same UX as worker app

---

## Phase 3: Create Unified Batch Selector Component (2 hours)

### Task 3.1: Create shared BatchPickerSheet

**New File**: `/src/components/shared/BatchPickerSheet.tsx`

Port the excellent patterns from `PickingBatchSelector.tsx`:
- Tabbed interface (Available / Scan / Type / Search)
- Shelf-based quick picks
- Multi-batch summary with progress
- Mobile-first but works on desktop

```typescript
interface BatchPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickListId: string;
  itemId: string;
  productName: string;
  targetQty: number;
  currentPicks: BatchPick[];
  onConfirm: (batches: Array<{ batchId: string; quantity: number }>) => Promise<void>;
}
```

**Acceptance Criteria**:
- [ ] All four tabs work (list, scan, type, search)
- [ ] Shelf-based quick picks work
- [ ] Multi-batch selection with progress
- [ ] Works on mobile and desktop

### Task 3.2: Update worker app to use shared component

**File**: `/src/components/worker/picking/PickingBatchSelector.tsx`

Replace with import from shared component (or thin wrapper).

**Acceptance Criteria**:
- [ ] Worker picking still works identically
- [ ] No regression in mobile UX

### Task 3.3: Update desktop dispatch to use shared component

**Files**:
- `/src/components/dispatch/PickingStepPick.tsx`
- Remove or deprecate `/src/components/sales/MultiBatchPickDialog.tsx`

**Acceptance Criteria**:
- [ ] Desktop dispatch gets all the worker UX patterns
- [ ] Multi-batch picking works
- [ ] Scan/type/search all work

---

## Phase 4: Deprecate Legacy Code (30 mins)

### Task 4.1: Deprecate old label print API

**File**: `/src/app/api/sales/orders/[orderId]/labels/print/route.ts`

Add deprecation notice. Consider removing in future version.

```typescript
// @deprecated Use /api/labels/print-sale instead
```

### Task 4.2: Deprecate MultiBatchPickDialog

**File**: `/src/components/sales/MultiBatchPickDialog.tsx`

Mark as deprecated in favor of shared BatchPickerSheet.

---

## Definition of Done

**Must Have**:
- [ ] Shared PrinterSelector component
- [ ] Shared useLabelPrinting hook
- [ ] Shared BatchPickerSheet component
- [ ] Desktop dispatch uses all shared components
- [ ] Worker app uses all shared components
- [ ] No regression in either app

**Nice to Have**:
- [ ] Old APIs marked deprecated
- [ ] Documentation for shared components

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break worker app | Medium | High | Thorough testing before/after |
| Break desktop dispatch | Medium | High | Incremental refactoring |
| Component API mismatch | Low | Medium | Design API first, implement second |
| Mobile/desktop style conflict | Medium | Low | Use variant prop for styling |

---

## Files to Create/Modify

| File | Type | Lines Est. |
|------|------|------------|
| `shared/PrinterSelector.tsx` | New | ~100 |
| `shared/TemplateSelector.tsx` | New | ~80 |
| `hooks/use-label-printing.ts` | New | ~100 |
| `shared/BatchPickerSheet.tsx` | New | ~400 |
| `worker/PickingBatchSelector.tsx` | Modify | -400, +10 |
| `worker/SaleLabelPrintSheet.tsx` | Modify | -100, +30 |
| `dispatch/PickingStepLabels.tsx` | Modify | -80, +50 |
| `dispatch/PickingStepPick.tsx` | Modify | -50, +40 |
| `sales/MultiBatchPickDialog.tsx` | Deprecate | +5 |

**Total New Lines**: ~680
**Net Change**: Slight reduction due to deduplication

---

## Handoff Notes for Jimmy

**Recommended Mode**: `thorough`
**DB Work Required**: No
**Critical Dependencies**: None

**Agent Assignments**:
- Phase 1: `feature-builder` (shared components)
- After Phase 1: `verifier`
- Phase 2: `feature-builder` (label printing)
- After Phase 2: `verifier` + `ui-comprehensive-tester`
- Phase 3: `feature-builder` (batch picker)
- After Phase 3: `verifier` + `ui-comprehensive-tester`
- Phase 4: `feature-builder` (cleanup)
- Final: `task-completion-validator` + `module-reviewer`

**Key Decisions Made**:
- Create true shared components, not just imports
- Mobile-first design with desktop adaptation
- Deprecate old code rather than delete immediately
- Thorough testing at each phase due to dual-app impact

**Why This Approach**:
- Prevents future divergence between apps
- Single source of truth for printing/picking UX
- Makes future enhancements easier (only update one place)
- Better code organization for team
