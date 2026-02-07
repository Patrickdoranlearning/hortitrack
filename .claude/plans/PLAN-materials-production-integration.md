# Implementation Plan: Materials-Production Integration (Synthesized)

**Status**: In Progress
**Created**: 2026-02-06
**Author**: Jimmy (dual-plan synthesis: MVP Speed + Proper Architecture)
**Complexity**: L
**Estimated Sessions**: 2-3

---

## Summary

Integrate materials module with production so that:
1. **Planners** can assign materials (pots, compost) when creating batches
2. **Workers** can confirm material usage by scanning lot barcodes or searching/selecting
3. Full traceability from batch -> planned materials -> confirmed lots -> consumption records

## Key Insight

**Zero database migrations needed.** All tables exist:
- `planned_batch_materials` — stores what's planned
- `batch_material_lots` — stores what was consumed (lot-level)
- `material_consumption_rules` — rules per size
- `material_lots` — with scannable barcodes and FIFO function

All server functions exist:
- `consumeFromLot()` — full consumption with traceability
- `getBatchMaterialLots()` — fetch consumed lots for a batch
- `previewConsumption()` — auto-suggest + stock check
- `getMaterialsForSize()` — find linked materials for a size
- `getAvailableLotsFifo()` — FIFO lot selection

**This is a UI integration task** — wiring existing backend to new/modified frontend.

---

## Phase 1: Planning UI (Propagation Form)

### 1.1 Add `getPlannedBatchMaterials()` to consumption.ts
- Query `planned_batch_materials` with material join
- Returns typed array for display

### 1.2 Add materials field to propagation schema
- Modify `propagation-schema.ts` to include optional `materials` array
- Modify `PropagationFormSchema` in `types/batch.ts` to match

### 1.3 Add `BatchMaterialsSection` component
- New `src/components/batches/BatchMaterialsSection.tsx`
- Collapsible "Materials" section
- When sizeId changes, calls `/api/materials/consumption/preview` to auto-suggest
- Shows material rows with quantity inputs, add/remove, stock availability
- Uses `MaterialSearchCombobox` for adding custom materials

### 1.4 Integrate into `PropagationClient.tsx`
- Render `BatchMaterialsSection` after location field
- Materials array included in form submission
- Modify `createPropagationBatch` to save materials to `planned_batch_materials`

---

## Phase 2: Batch Detail Visibility

### 2.1 Create `GET /api/worker/batches/[id]/materials` endpoint
- Returns `{ planned, consumed, checklist }` for a batch
- Merges planned + consumed into a status checklist

### 2.2 Create `BatchMaterialsView` for worker tab
- Material checklist with status (pending/confirmed)
- "Confirm" button per unconfirmed material

### 2.3 Add "Materials" tab to `BatchDetailTabs`
- New tab: `{ key: "materials", label: "Materials", icon: Package }`

### 2.4 Add `BatchMaterialsCard` for desktop batch detail
- Card showing planned vs consumed materials
- Add to batch detail page

---

## Phase 3: Worker Material Confirmation

### 3.1 Create `POST /api/worker/batches/[id]/materials/confirm` endpoint
- Validates input, calls `consumeFromLot()`, returns updated checklist

### 3.2 Create `MaterialConfirmDialog` component
- Two input modes: Scan barcode (via ScannerClient) / Search (via LotSelectionCombobox)
- Shows FIFO-suggested lots
- Mismatch warning if scanned lot material != planned material
- Quantity input (defaults to planned)
- Confirm button calls POST endpoint

### 3.3 Wire into BatchMaterialsView
- Tapping unconfirmed item opens MaterialConfirmDialog

---

## Phase 4: Transplant Forms + Polish

### 4.1 Add `BatchMaterialsSection` to transplant forms
### 4.2 Stock availability indicators on planning form
### 4.3 Material confirmation badge on batch list views

---

## Files

### New (6)
- `src/components/batches/BatchMaterialsSection.tsx` — Planning form material picker
- `src/components/batches/BatchMaterialsCard.tsx` — Desktop detail card
- `src/components/worker/batch/BatchMaterialsView.tsx` — Worker materials tab
- `src/components/worker/batch/MaterialConfirmDialog.tsx` — Lot confirmation dialog
- `src/app/api/worker/batches/[id]/materials/route.ts` — GET planned+consumed
- `src/app/api/worker/batches/[id]/materials/confirm/route.ts` — POST confirm

### Modified (7)
- `src/app/production/forms/propagation-schema.ts` — Add materials array
- `src/types/batch.ts` — Add materials to PropagationFormSchema
- `src/app/production/batches/new/propagation/PropagationClient.tsx` — Add materials section
- `src/server/materials/consumption.ts` — Add getPlannedBatchMaterials()
- `src/server/batches/service.ts` — Save materials on batch creation
- `src/components/worker/batch/BatchDetailTabs.tsx` — Add Materials tab
- `src/app/production/batches/[batchId]/page.tsx` — Add materials card
