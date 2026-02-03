# PLAN: Gold Standard Batch Picking UX

**Status**: Ready
**Feature**: Unified batch picking experience for dispatch
**Recommended Mode**: standard
**Estimated Sessions**: 2-3

---

## Context

The dispatch picking experience needs to reach "gold standard" UX. Currently there are two implementations:

1. **Worker App (`PickingBatchSelector.tsx`)** - Better UX with bottom sheet, tabs (Available/Scan/Type/Search), shelf-based quick picks, progress tracking
2. **Desktop Dispatch (`MultiBatchPickDialog.tsx`)** - Clunky dialog with checkboxes that hide quantity controls

### Key UX Gaps in Desktop
- No quick-pick buttons (Half/Full Shelf)
- No tabs for input modes (scan, type, search)
- Checkboxes pattern requires two steps (select, then adjust qty)
- No shelf quantity awareness
- Less intuitive progress visualization

### What Worker App Does Well
- Bottom sheet pattern (familiar, mobile-native)
- Shelf-based quick picks (Half Shelf / Full Shelf / Custom)
- Tabs for input modes (list, scan, type, search)
- Real-time progress: "Need: X | Remaining: Y"
- Selected batches summary at bottom
- Haptic feedback
- Large touch targets

### What Desktop App Does Well
- Auto-fill FEFO button (apply FEFO allocation in one click)
- Detailed summary popover with breakdown
- Notes field for pick comments
- Short-pick warning with clear messaging

---

## Bug Fix (Completed)

**Issue**: `getAvailableBatchesForItem` in `/src/server/sales/picking.ts` at lines 1385-1391 didn't filter by saleable status for product-based orders. Only filtered `quantity > 0`, but should also filter `.in("status", ["Ready", "Looking Good"])` like the variety-based query does.

**Fix Applied**: Updated the product-based query to:
1. Filter by saleable status (`["Ready", "Looking Good"]`)
2. Sort by `planted_at` ascending (FEFO ordering)

---

## Design Decision: Unified Component

**Recommendation**: Create a new unified `BatchPicker` component that adapts to context (mobile vs desktop) rather than maintaining two separate implementations.

### Rationale
1. Single source of truth for picking logic
2. Consistent UX across all picking contexts
3. Easier to maintain and enhance
4. Responsive design handles both form factors

### Component Architecture
```
BatchPicker (unified component)
  - Responsive: Sheet on mobile, Dialog on desktop
  - Same tabs, quick-picks, progress tracking
  - Context-aware: haptics on mobile, keyboard shortcuts on desktop
  - Props determine behavior (pickListId, itemId, target, onConfirm)
```

---

## P0: Critical (Must Have)

### Task 1.1: Create unified BatchPicker component
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx` (new)
**Acceptance Criteria**:
- [ ] Renders as Sheet on mobile, Dialog on desktop (breakpoint: 768px)
- [ ] Tabs: Available / Scan / Type / Search
- [ ] Quick-pick buttons: Half Shelf / Full Shelf / Custom
- [ ] Progress display: "Need: X | Remaining: Y"
- [ ] Selected batches summary section
- [ ] FEFO auto-fill button
- [ ] Short-pick handling with warnings
- [ ] Notes field (optional)

### Task 1.2: Implement shelf quantity system
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx`
**Acceptance Criteria**:
- [ ] Use `shelfQuantity` from batch data (product/size config)
- [ ] Calculate Half Shelf = floor(shelfQuantity / 2)
- [ ] Full Shelf = min(shelfQuantity, available, remaining)
- [ ] Show actual numbers on buttons (not just labels)
- [ ] Disable buttons when remaining = 0

### Task 1.3: Wire up to existing dispatch flows
**Agent**: feature-builder
**Files**:
- `/src/components/sales/MultiBatchPickDialog.tsx` (replace internals)
- `/src/components/worker/picking/PickingBatchSelector.tsx` (replace internals)
**Acceptance Criteria**:
- [ ] Desktop dispatch uses BatchPicker (as Dialog)
- [ ] Worker app uses BatchPicker (as Sheet)
- [ ] All existing props/callbacks preserved
- [ ] No regression in functionality

---

## P1: Important (Should Have)

### Task 2.1: Add keyboard shortcuts (desktop)
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx`
**Acceptance Criteria**:
- [ ] Enter = confirm pick
- [ ] Escape = close
- [ ] Number keys 1-9 = select batch by position
- [ ] F = auto-fill FEFO
- [ ] Tab = switch input modes

### Task 2.2: Add FEFO visual indicator
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx`
**Acceptance Criteria**:
- [ ] Show "Oldest" badge on first batch in list
- [ ] Show planted date on hover/tap
- [ ] Visual indication of FEFO order (subtle numbering or icons)

### Task 2.3: Enhanced progress visualization
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx`
**Acceptance Criteria**:
- [ ] Animated progress bar
- [ ] Color transitions (amber when partial, green when complete)
- [ ] Celebratory feedback when target reached (subtle animation, success color)
- [ ] Over-pick warning if exceeds target

### Task 2.4: Batch card improvements
**Agent**: feature-builder
**Files**: `/src/components/picking/BatchPicker.tsx`
**Acceptance Criteria**:
- [ ] Show batch status badge (Ready, Looking Good)
- [ ] Show location prominently
- [ ] Show product name if multi-product order
- [ ] Compact mode for long lists (> 10 batches)

---

## P2: Nice to Have (Could Have)

### Task 3.1: Recent batches quick access
**Agent**: feature-builder
**Acceptance Criteria**:
- [ ] Show "Recently picked" section at top
- [ ] Persisted per user/session
- [ ] One-tap to re-add from recent

### Task 3.2: Batch location grouping
**Agent**: feature-builder
**Acceptance Criteria**:
- [ ] Group batches by location (polytunnel)
- [ ] Collapsible location sections
- [ ] Location count badges

### Task 3.3: Offline support (worker app)
**Agent**: feature-builder
**Acceptance Criteria**:
- [ ] Cache available batches
- [ ] Queue picks for sync when back online
- [ ] Offline indicator

---

## Definition of Done

1. [ ] BatchPicker renders correctly on mobile (< 768px) as bottom sheet
2. [ ] BatchPicker renders correctly on desktop (>= 768px) as centered dialog
3. [ ] All four input modes work (Available, Scan, Type, Search)
4. [ ] Quick-pick buttons work with correct shelf calculations
5. [ ] FEFO auto-fill applies oldest-first selection
6. [ ] Progress tracking shows correct counts and visual feedback
7. [ ] Short-pick flow works with confirmation
8. [ ] Desktop dispatch workflow unchanged externally
9. [ ] Worker app workflow unchanged externally
10. [ ] No TypeScript errors
11. [ ] Verifier passes (build, lint, type-check)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Responsive breakpoint causes layout issues | Medium | Medium | Test at various widths, use container queries |
| Scanner integration differs between contexts | Low | High | Keep scanner abstracted, test on actual devices |
| Performance with large batch lists | Low | Medium | Virtualize list if > 50 batches |
| Haptics not available on all mobile | Low | Low | Graceful fallback (no-op) |

---

## Handoff Notes

### For data-engineer
- No DB changes needed
- Bug fix already applied: `getAvailableBatchesForItem` now filters by saleable status for product-based queries

### For feature-builder
- Start with Task 1.1 (create unified component)
- Reference both existing implementations for patterns
- Worker app has the better UX patterns, use as primary reference
- Keep the Dialog/Sheet decision based on viewport width
- Preserve all existing callback signatures for backward compatibility

### For verifier
- After Task 1.3, run full regression on:
  - Desktop dispatch picking flow
  - Worker app picking flow
  - Both with single batch and multi-batch orders

---

## Files Reference

| File | Purpose |
|------|---------|
| `/src/components/picking/BatchPicker.tsx` | NEW unified component |
| `/src/components/sales/MultiBatchPickDialog.tsx` | Desktop dispatch (to be updated) |
| `/src/components/worker/picking/PickingBatchSelector.tsx` | Worker app (to be updated) |
| `/src/server/sales/picking.ts` | Server-side picking logic (bug fixed) |
| `/api/picking/[pickListId]/items/[itemId]/batches` | API for fetching available batches |

---

*Created by jimmy planning flow*
*Last updated: Session start*
