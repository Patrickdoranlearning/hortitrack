# PLAN: Worker App Enhancement - Main App Feature Reuse

**Purpose**: Identify and port valuable features from the main HortiTrack app to the worker app
**Status**: IN PROGRESS - Quick Wins + Phase A + Phase D Complete
**Created**: 2026-02-01
**Updated**: 2026-02-01
**Author**: Jimmy (coordinator review)

## Completion Summary (Session 1)

### Quick Wins Implemented:
1. **Health Indicator Dots on Batch Cards** - Workers can now see health status at a glance
2. **Stock Ledger View** - Added tabbed batch detail with stock movement history
3. **Batch Detail Tabs** - Summary, Stock, Health, Scout tabs (Health/Scout as placeholders)
4. **Batch Substitution Sheet** - Enhanced picking with reason capture for substitutions
5. **Scan to Find on Materials** - Material barcode scanning with lookup support

### Files Created:
- `/src/components/worker/batch/BatchHealthBadge.tsx` - Mobile health indicator
- `/src/components/worker/batch/StockLedgerView.tsx` - Stock movement display
- `/src/components/worker/batch/BatchDetailTabs.tsx` - Tabbed batch detail
- `/src/components/worker/picking/BatchSubstitutionSheet.tsx` - Substitution wizard

### Files Modified:
- `/src/app/(worker)/worker/batches/page.tsx` - Added health indicators
- `/src/app/(worker)/worker/batches/[id]/page.tsx` - Integrated tabs
- `/src/app/(worker)/worker/materials/page.tsx` - Added scan button
- `/src/app/api/worker/batches/route.ts` - Added health data support
- `/src/app/api/worker/scan-lookup/route.ts` - Added material lookup
- `/src/components/worker/picking/PickItemDialog.tsx` - Integrated substitution
- `/src/components/worker/ScanResult.tsx` - Added material display
- `/src/types/worker.ts` - Added health types

---

## Completion Summary (Session 2 - Phase D: Enhanced Picking)

### Phase D Features Implemented:
1. **Batch Substitution Verification** - Verified BatchSubstitutionSheet from Quick Wins is properly integrated into PickItemDialog with reason capture
2. **Sale Label Printing from Pick Flow** - Workers can now print price labels for picked items before staging trolley

### Phase D Files Created:
- `/src/components/worker/picking/SaleLabelPrintSheet.tsx` - Mobile-optimized sale label printing sheet with:
  - Printer selection (fetches from /api/printers)
  - Label template selection (fetches from /api/label-templates?type=sale)
  - Per-item quantity controls
  - Label preview with barcode
  - Print status feedback
  - Touch targets >= 48px

### Phase D Files Modified:
- `/src/components/worker/picking/PickingTrolleyStep.tsx` - Added "Print Labels" option in trolley staging step
- `/src/app/(worker)/worker/picking/[pickListId]/page.tsx` - Pass label items to PickingTrolleyStep
- `/src/server/sales/picking.ts`:
  - Extended PickItem interface to include `unitPriceExVat`
  - Updated getPickItems() query to fetch price from order_items

### Phase D Integration Points:
- When worker clicks "FINISH & STAGE" after picking, they see the PickingTrolleyStep
- A new "Print Labels" card appears if any picked items have prices
- Workers can adjust label quantities per item
- Print preview shows the label format
- After printing, a "Printed" badge shows confirmation
- Labels print via existing `/api/labels/print-sale` endpoint

---

---

## Executive Summary

The Worker App is feature-complete at a foundational level (Phases 1-5 done), but there are **significant main app features** that could dramatically improve worker productivity. This document identifies what exists, what's missing, and recommends a prioritized approach to enhance the worker app.

---

## Current State Analysis

### Worker App: What We Have ✅

| Module | Features Implemented | Completeness |
|--------|---------------------|--------------|
| **Production** | Batch list, batch detail, create batch, log actions (move, loss) | 70% |
| **Dispatch/Picking** | Pick queue, picking workflow, multi-batch picking, trolley staging | 90% |
| **Plant Health** | Scouting landing, batch/location scout, issue recording, photo capture | 60% |
| **Materials** | Browse materials, stock check, receive delivery | 50% |
| **Tasks** | My tasks, schedule view, task cards by module | 80% |
| **Stats** | Productivity dashboard, period selection, charts | 70% |
| **Scanning** | Universal scanner, multiple barcode formats | 85% |
| **Print** | Batch labels, location labels | 60% |

### Main App: Valuable Features NOT Yet in Worker App 🔴

---

## Gap Analysis: Features to Port

### 🔥 P0 - High Impact, Easy Ports

#### 1. **Rich Batch Check-In Form**
**Source**: `src/components/batches/CheckInForm.tsx`
**What it does**:
- Multi-field validation with Zod
- Variety, size, location selection with type-ahead
- Supplier & batch number tracking
- Quality rating with emoji scale (1-6)
- Material consumption preview
- Plant passport override fields
- Pest/disease flag checkboxes

**Current worker gap**: Worker batch creation is basic - just batch number, variety, location.

**Port complexity**: Medium (need to mobile-optimize form layout)

---

#### 2. **Batch Detail Tabs (Rich View)**
**Source**: `src/components/batch/BatchDetail.tsx`
**What it does**:
- **Summary Tab**: Key metrics, status, location, age
- **Stock Tab**: Stock ledger with all movements, adjustments
- **Health Tab**: Health status timeline, AI recommendations
- **Scout Tab**: All scout observations with photos
- **Photos Tab**: Lazy-loaded gallery
- **Ancestry Tab**: Parent/child batch relationships

**Current worker gap**: Worker batch detail is flat, no tabs, limited info

**Port complexity**: Medium (tab component exists, need mobile swipe tabs)

---

#### 3. **Stock Ledger Card with Adjustments**
**Source**: `src/components/batches/StockLedgerCard.tsx`
**What it does**:
- Real-time stock movement history
- Summary: total in, total out, current balance
- Stock adjustment dialog for manual corrections
- Loss recording with timestamps and reasons

**Current worker gap**: Worker can log moves/losses but can't see ledger history

**Port complexity**: Low (mostly display, existing API)

---

#### 4. **Batch Substitution Dialog**
**Source**: `src/components/sales/BatchSubstitutionDialog.tsx`
**What it does**:
- Find alternative batches for picking
- Shows availability, location, age
- Substitution reason capture
- Maintains audit trail

**Current worker gap**: Multi-batch picking exists, but no guided substitution flow

**Port complexity**: Low (dialog component, existing API)

---

### 🟡 P1 - Should Have

#### 5. **Scout Wizard (Full Featured)**
**Source**: `src/components/plant-health/scout/ScoutWizard.tsx`
**What it does**:
- Step-by-step scouting flow
- Issue type selection with icons
- Severity slider with color feedback
- Photo capture with annotation
- Trigger treatment scheduling
- pH/EC readings if applicable

**Current worker gap**: Worker scout is basic - form fields only, no wizard flow

**Port complexity**: Medium-High (multi-step UI, camera integration)

---

#### 6. **IPM Treatment Compliance Form**
**Source**: `src/components/plant-health/ipm/ApplyTreatmentDialog.tsx`
**What it does**:
- Product bottle scan to verify correct product
- Compliance data capture:
  - PCS number (product registration)
  - Reason for use
  - Weather conditions
  - Rate applied, area treated
  - Sprayer used
  - Safe harvest date calculation
- Stock deduction from bottle

**Current worker gap**: Worker plant health has no treatment recording

**Port complexity**: Medium (form with validation, bottle scan)

---

#### 7. **Transplant/Propagation Forms**
**Source**: `src/components/batches/TransplantForm/`, `src/components/batches/PropagationForm.tsx`
**What it does**:
- Parent batch selection
- Quantity splitting
- Destination container size
- Multi-parent support for hybrid propagation
- Timeline tracking

**Current worker gap**: Worker can create batches but not transplant/propagate

**Port complexity**: Medium (multi-batch selection, quantity math)

---

#### 8. **Material Consumption Preview**
**Source**: `src/components/materials/MaterialConsumptionPreview.tsx`
**What it does**:
- Shows materials needed for a production job
- Lot selection with FIFO suggestion
- Expiry warnings
- Usage forecasting

**Current worker gap**: Worker materials shows stock but not job-material linking

**Port complexity**: Low-Medium (display component, existing calculation)

---

### 🟢 P2 - Nice to Have

#### 9. **Data Visualization Charts (Mobile-Optimized)**
**Source**: `src/components/charts/`
| Chart | Purpose | Mobile Value |
|-------|---------|--------------|
| `AvailabilityDonut.tsx` | Stock by status | Quick status overview |
| `BatchAgeHistogram.tsx` | Age distribution | Identify old stock |
| `LossTrendChart.tsx` | Loss over time | Spot problem patterns |
| `VarietyTreemap.tsx` | Variety distribution | Visual inventory |
| `LocationGrid.tsx` | Batch density by location | Find stock fast |

**Current worker gap**: Worker stats has basic charts, not these detailed ones

**Port complexity**: Low (charts are responsive, may need touch legends)

---

#### 10. **Task Actualization Wizard**
**Source**: `src/app/tasks/components/ActualizeWizard.tsx`
**What it does**:
- Convert ghost batches to actual batches
- Quantity adjustment on completion
- Batch splitting if needed

**Current worker gap**: Worker completes tasks but can't actualize ghost batches

**Port complexity**: Medium (wizard flow, batch creation logic)

---

#### 11. **Sale Label Print Wizard**
**Source**: `src/components/sales/SaleLabelPrintWizard.tsx`
**What it does**:
- Customer order labels
- Unit price on labels
- Batch tracking QR codes
- Preview before print

**Current worker gap**: Worker can print batch/location labels, not sale labels

**Port complexity**: Low (existing print infrastructure)

---

#### 12. **Job Kanban View**
**Source**: `src/app/tasks/components/JobsKanban.tsx`
**What it does**:
- Drag-and-drop status updates (pending → in progress → complete)
- Card view with task details
- Filtered by team/individual

**Current worker gap**: Worker sees list view only

**Port complexity**: Medium (drag-drop may be awkward on mobile, consider swipe-to-complete)

---

## Components Ready for Direct Reuse

These components are already mobile-friendly and need minimal adaptation:

| Component | Location | Reuse Notes |
|-----------|----------|-------------|
| `MiniBatchCard.tsx` | `src/components/batch/` | Already compact |
| `HealthIndicator.tsx` | `src/components/batch/` | Color-coded dots |
| `DataMatrixScanner.tsx` | `src/components/dispatch/picker/` | Torch control, Web Worker |
| `BatchLabelPreview.tsx` | `src/components/` | Print preview |
| `JobChecklist.tsx` | `src/components/tasks/` | Already in worker (MobileChecklist) |
| UI primitives (Dialog, Sheet, Badge) | `src/components/ui/` | All responsive |

---

## Recommended Implementation Phases

### Phase A: Batch Experience Enhancement (P0)
**Effort**: 2-3 sessions
**Impact**: High - workers handle batches constantly

1. Port rich batch detail tabs to worker
2. Add stock ledger view with adjustment capability
3. Enhance batch creation with CheckInForm fields
4. Add health indicators to batch cards

**Files to Create/Modify**:
```
src/app/(worker)/worker/batches/[id]/page.tsx  # Enhance with tabs
src/components/worker/batch/BatchDetailTabs.tsx
src/components/worker/batch/StockLedgerView.tsx
src/components/worker/batch/BatchHealthBadge.tsx
```

---

### Phase B: Plant Health & Scouting (P1)
**Effort**: 2-3 sessions
**Impact**: High for IPM compliance

1. Port ScoutWizard to worker (step-by-step flow)
2. Add IPM treatment recording with compliance form
3. Add treatment schedule view
4. Integrate bottle scanning for product verification

**Files to Create/Modify**:
```
src/app/(worker)/worker/scout/[type]/[id]/wizard/page.tsx
src/components/worker/scout/ScoutWizardFlow.tsx
src/components/worker/scout/TreatmentComplianceForm.tsx
src/app/api/worker/scout/treatments/route.ts
```

---

### Phase C: Production Workflows (P1)
**Effort**: 2-3 sessions
**Impact**: Medium-High for production staff

1. Port transplant workflow
2. Port propagation tracking
3. Add material consumption preview to jobs
4. Add ghost batch actualization

**Files to Create/Modify**:
```
src/app/(worker)/worker/production/transplant/page.tsx
src/app/(worker)/worker/production/propagate/page.tsx
src/components/worker/production/MaterialsNeededCard.tsx
src/components/worker/production/ActualizeSheet.tsx
```

---

### Phase D: Enhanced Picking (P2) - COMPLETE
**Effort**: 1-2 sessions
**Impact**: Medium (already good with multi-batch)
**Status**: COMPLETE

1. ~~Add batch substitution wizard~~ - DONE (Quick Wins)
2. ~~Add sale label printing from pick flow~~ - DONE
3. Optimize for rapid scanning workflow - Deferred (already well-optimized)

**Files Created**:
```
src/components/worker/picking/SaleLabelPrintSheet.tsx  # New mobile label printing
```

**Files Modified**:
```
src/components/worker/picking/PickingTrolleyStep.tsx  # Added Print Labels option
src/app/(worker)/worker/picking/[pickListId]/page.tsx  # Pass label items
src/server/sales/picking.ts  # Added unitPriceExVat to PickItem
```

---

### Phase E: Analytics & Insights (P2)
**Effort**: 1-2 sessions
**Impact**: Medium - visibility for workers

1. Port key charts to worker stats page
2. Add location grid for quick stock finding
3. Add loss trend visibility

**Files to Create/Modify**:
```
src/app/(worker)/worker/stats/page.tsx  # Enhance
src/components/worker/stats/MobileCharts.tsx
src/app/(worker)/worker/locations/grid/page.tsx
```

---

## Quick Wins (Can Be Done Now)

These require minimal effort and provide immediate value:

1. **Add HealthIndicator dots to batch cards** - 30 mins
   - Import from `src/components/batch/HealthIndicator.tsx`
   - Add to `src/components/worker/cards/ProductionTaskCard.tsx`

2. **Add batch substitution button to picking** - 1 hour
   - Port dialog, add to `PickItemDialog.tsx`

3. **Add stock ledger read-only view** - 1 hour
   - New tab on batch detail
   - Uses existing batch events API

4. **Add variety/family display to batch cards** - 30 mins
   - Data already fetched, just add display

5. **Add "Scan to Find" on materials page** - 1 hour
   - Reuse scan infrastructure
   - Add material barcode parsing

---

## What NOT to Port (Overkill for Mobile)

| Feature | Reason |
|---------|--------|
| Full Kanban drag-drop | Awkward on mobile, use swipe gestures instead |
| Complex multi-select tables | Use checkboxes with swipe select |
| Nested dialogs | Flatten to sheets/pages |
| Keyboard shortcuts | Not applicable |
| Rich text editing | Stick to plain text |

---

## Architecture Recommendations

### 1. Shared Components Pattern
Create `src/components/shared/` for components used by both main and worker apps:
```typescript
// Example: BatchHealthBadge used in both apps
// src/components/shared/BatchHealthBadge.tsx
export function BatchHealthBadge({ status, size = 'md' }) {
  // Same component, different size props for mobile
}
```

### 2. Mobile-First Sheet Pattern
Convert dialogs to sheets for mobile:
```typescript
// Main app: <Dialog>
// Worker app: <Sheet> with same content
// Create shared content component, wrap differently
```

### 3. API Reuse
Worker app should use existing APIs where possible:
- `/api/batches/[id]/stock-ledger` - already exists
- `/api/picking/[id]/items` - already returns what's needed
- `/api/plant-health/scout` - full scout API

Only create `/api/worker/*` when mobile-specific optimization needed.

---

## Success Metrics

After implementing these enhancements, workers should be able to:

| Task | Before | After |
|------|--------|-------|
| Check batch health history | ❌ Not visible | ✅ Full timeline in app |
| See stock movements | ❌ Not visible | ✅ Ledger with all transactions |
| Record IPM treatment | ❌ Manual paper | ✅ Digital compliance capture |
| Scout with photos | ⚠️ Basic | ✅ Guided wizard with annotations |
| Transplant batches | ❌ Desktop only | ✅ Full mobile workflow |
| Print sale labels | ❌ Desktop only | ✅ From picking flow |

---

## Recommended Next Steps

1. **User Interview**: Talk to workers about pain points - what do they need most?
2. **Quick Wins Sprint**: Implement the 5 quick wins (4 hours total)
3. **Phase A Execution**: Batch experience is foundational for everything else
4. **Mobile Testing**: Each phase should include real device testing in nursery

---

## Files Reference

### Key Main App Components to Study
```
src/components/batch/BatchDetail.tsx          # Rich tabs UI
src/components/batches/CheckInForm.tsx        # Comprehensive batch form
src/components/batches/StockLedgerCard.tsx    # Stock movement display
src/components/plant-health/scout/ScoutWizard.tsx  # Step-by-step scout
src/components/plant-health/ipm/ApplyTreatmentDialog.tsx  # Compliance
src/components/sales/BatchSubstitutionDialog.tsx  # Substitution flow
src/components/charts/*.tsx                   # All visualization
```

### Current Worker App Structure
```
src/app/(worker)/worker/
  batches/[id]/page.tsx     # Basic detail → Enhance with tabs
  scout/batch/[id]/page.tsx # Basic form → Replace with wizard
  production/page.tsx       # Landing → Add transplant/propagate links
  picking/[pickListId]/     # Good → Add substitution
  materials/page.tsx        # Basic → Add consumption preview
  stats/page.tsx           # Basic charts → Port better ones
```

---

*Plan ready for review. Recommend discussing with users before execution to validate priorities.*
