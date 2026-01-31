# PLAN: Plant Health Module Completion & Production Integration

**Status**: Complete
**Created**: 2026-01-31
**Completed**: 2026-01-31
**Scope**: Complete plant health module with full production integration including Stock, Health, and Scout tabs

---

## Executive Summary

The plant health module has solid foundations but needs completion and deeper integration with the production module. Current state analysis reveals:

### What Exists (Working)
- `plant_health_logs` table with RLS (scout_flag, treatment, measurement, clearance events)
- IPM products database with bottle tracking (`ipm_product_bottles`, `ipm_stock_movements`)
- Scout wizard with location/batch scanning, issue logging, and treatment scheduling
- `PlantHealthCard` component fetching batch health history
- `StockLedgerCard` component showing stock movements
- Plant health dashboard with IPM programs, tasks, trials
- APIs: `/api/production/batches/[id]/plant-health`, `/api/production/batches/[id]/stock-movements`

### What's Incomplete or Missing
1. **BatchDetail tabs mismatch**: Component shows Log/Photos/Ancestry but user wants Stock/Health/Scout/Photos
2. **Scout tab**: No dedicated batch-level scout log viewing (scouts are location-based)
3. **Health tab enhancements**: Missing action buttons for adding treatments/fertilizers directly
4. **Photos tab**: Placeholder only - needs growth timeline and comparison features
5. **Integration gaps**: Health events not fully linked to batch lifecycle
6. **UI consistency**: Different tab structures in BatchDetail vs batch-detail-dialog

---

## Phase 1: Unify Batch Detail Tab Structure (P0)

**Goal**: Create consistent tab experience across all batch detail views

### Task 1.1: Update BatchDetail.tsx Tab Structure
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Rename tabs to match user requirements: Summary, Stock, Health, Scout, Photos, Ancestry
- Keep Log History accessible (can be nested under Stock or separate)
- Add tab icons matching batch-detail-dialog.tsx pattern

### Task 1.2: Add Stock Tab Content
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Integrate `StockLedgerCard` into Stock tab
- Show running balance, in/out totals
- Display distribution bar at top of tab

### Task 1.3: Add Health Tab Content
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Integrate `PlantHealthCard` into Health tab
- Show treatments, fertilizers, pest observations
- Add quick action button to log new health event

### Task 1.4: Create Scout Tab Component
**Agent**: `feature-builder`
**Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/ScoutTab.tsx` (new)
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Display all scout logs where this batch was affected
- Show severity badges (low/medium/critical)
- Link to full scout wizard for new entries
- Filter scout_flag events from plant_health_logs where batch_id matches or batch was in affected location

**Phase 1 Complete When**:
- [x] BatchDetail.tsx has 6 tabs: Summary, Stock, Health, Scout, Photos, Ancestry
- [x] All tabs render actual data (not placeholder text)
- [x] Tab structure matches batch-detail-dialog.tsx for consistency

**Phase 1 COMPLETED**: 2026-01-31

---

## Phase 2: Enhance Health Tab with Actions (P0)

**Goal**: Make the Health tab actionable - not just read-only

### Task 2.1: Create AddHealthLogDialog Component
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/AddHealthLogDialog.tsx` (new)
**Acceptance Criteria**:
- Support event types: treatment, fertilizer, irrigation, pruning, grading, measurement
- Product selection from ipm_products for treatments
- Bottle scanning for stock tracking (optional)
- Rate/dosage input with units
- Weather conditions capture
- Photo attachment
- Safe harvest date calculation based on product's harvest_interval_days

### Task 2.2: Create Server Action for Batch Health Logs
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/batch-health.ts` (new)
**Acceptance Criteria**:
- `logTreatment(batchId, productId, rate, unit, ...)` - creates plant_health_log
- `logFertilizer(batchId, name, rate, unit, ...)`
- `logMeasurement(batchId, ec, ph, notes)`
- All actions create proper batch_events for history tracking
- Link to ipm_stock_movements if bottle_id provided

### Task 2.3: Integrate Action Button in Health Tab
**Agent**: `feature-builder`
**Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batches/PlantHealthCard.tsx`
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Add "Log Health Event" button to PlantHealthCard header
- Button opens AddHealthLogDialog
- Refresh health log list after successful submission

### Task 2.4: Add Treatment Type Icons & Styling
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/history/PlantHealthLog.tsx`
**Acceptance Criteria**:
- Distinct icons for: treatment (Syringe), fertilizer (Leaf), irrigation (Droplet), measurement (Gauge), pruning (Scissors), grading (Star)
- Color-coded severity for scout flags
- Expandable details for treatments showing full compliance info

**Phase 2 Complete When**:
- [x] Users can log treatments, fertilizers, and measurements from batch detail
- [x] Health events appear immediately in Health tab after logging
- [x] IPM stock tracking updated when bottle used

**Phase 2 COMPLETED**: 2026-01-31

---

## Phase 3: Scout Tab Deep Integration (P1)

**Goal**: Show grower scout history and enable quick scouting from batch context

### Task 3.1: Create Scout Log API for Batch
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/production/batches/[id]/scout-logs/route.ts` (new)
**Acceptance Criteria**:
- Return all scout_flag events from plant_health_logs where:
  - batch_id = this batch, OR
  - location_id matches a location where this batch was present at event_at time
- Include severity, issue type, notes, photos
- Order by event_at descending

### Task 3.2: Create ScoutLogCard Component
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batches/ScoutLogCard.tsx` (new)
**Acceptance Criteria**:
- Timeline view of scout observations
- Severity badges with color coding
- Issue type with icon
- Affected batches listed (when location-scoped)
- Photo thumbnails if available
- Link to treatment if one was scheduled from this scout

### Task 3.3: Add Quick Scout Button
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- "Log Scout Observation" button in Scout tab
- Opens ScoutLogForm pre-populated with this batch
- Shows batch's current location automatically

### Task 3.4: Server Function for Batch Scout History
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/server/batches/scout-history.ts` (new)
**Acceptance Criteria**:
- `getBatchScoutHistory(batchId, orgId)` function
- Queries plant_health_logs for scout_flag events
- Joins with location history to find location-scoped scouts
- Returns enriched scout log data

**Phase 3 Complete When**:
- [x] Scout tab shows all relevant observations for the batch
- [x] Users can log new scout observations from batch context
- [x] Location-scoped scouts correctly attributed to affected batches

**Phase 3 COMPLETED**: 2026-01-31

---

## Phase 4: Stock Tab Enhancements (P1)

**Goal**: Make stock tracking more actionable and insightful

### Task 4.1: Add Stock Adjustment Dialog
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/StockAdjustmentDialog.tsx` (new)
**Acceptance Criteria**:
- Adjust stock up or down with reason
- Creates batch_event with type ADJUSTMENT
- Updates batch quantity
- Require reason selection: count_correction, damage, theft, found, other

### Task 4.2: Add Loss Recording
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/RecordLossDialog.tsx` (new)
**Acceptance Criteria**:
- Record loss with reason and quantity
- Creates batch_event with type LOSS
- Updates batch quantity
- Reason options: pest_damage, disease, environmental, quality_cull, other

### Task 4.3: Stock Movement Export
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/production/batches/[id]/stock-movements/export/route.ts` (new)
**Acceptance Criteria**:
- Export stock movements as CSV
- Include all movement details with timestamps
- Suitable for audit/compliance purposes

### Task 4.4: Integrate Action Buttons in Stock Tab
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batches/StockLedgerCard.tsx`
**Acceptance Criteria**:
- Add "Adjust Stock" button
- Add "Record Loss" button
- Add "Export" button
- Refresh ledger after actions

**Phase 4 Complete When**:
- [x] Users can adjust stock counts with reasons
- [x] Losses recorded with proper categorization
- [x] Stock movements exportable for compliance

**Phase 4 COMPLETED**: 2026-01-31

---

## Phase 5: Sync batch-detail-dialog.tsx (P1)

**Goal**: Ensure modal dialog has same capabilities as full page

### Task 5.1: Add Scout Tab to Dialog
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch-detail-dialog.tsx`
**Acceptance Criteria**:
- Add Scout tab between Health and Photos
- Use same ScoutLogCard component
- Fetch scout logs on tab activation

### Task 5.2: Add Action Buttons to Dialog
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch-detail-dialog.tsx`
**Acceptance Criteria**:
- Health tab: "Log Health Event" button
- Stock tab: "Adjust Stock" button
- Scout tab: "Log Observation" button
- All open respective dialogs

### Task 5.3: Refresh Data After Actions
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch-detail-dialog.tsx`
**Acceptance Criteria**:
- SWR mutate calls after dialog actions complete
- Stock movements refresh after adjustment
- Health logs refresh after new entry

**Phase 5 Complete When**:
- [x] batch-detail-dialog.tsx feature parity with BatchDetail.tsx
- [x] All tabs present: Summary, Stock, Health, Scout, Photos, Ancestry
- [x] Actions work and refresh data

**Phase 5 COMPLETED**: 2026-01-31

---

## Phase 6: Photos Tab - Growth Tracking (P1)

**Goal**: Enable growers to document plant growth over time with a visual timeline

### Task 6.1: Create GrowthTimelineView Component
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/GrowthTimelineView.tsx` (new)
**Acceptance Criteria**:
- Timeline/filmstrip view of photos ordered by `taken_at`
- Group photos by week or status change
- Show status badge on each photo (Growing, Hardening, Saleable)
- Click to expand full-size with navigation
- Display `taken_by` user name and timestamp

### Task 6.2: Add Photo Comparison Feature
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/PhotoComparisonView.tsx` (new)
**Acceptance Criteria**:
- Side-by-side comparison of any two photos
- Slider overlay comparison mode
- Select photos from timeline
- Show date/status context for each compared photo

### Task 6.3: Integrate Photos Tab in BatchDetail
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx`
**Acceptance Criteria**:
- Replace placeholder with GrowthTimelineView
- Add "Add Photo" button using BatchPhotoUploader
- Toggle between Timeline and Grid views
- Filter by photo type (Grower/Sales)
- Show photo count in tab label

### Task 6.4: Add Quick Capture from Mobile
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/QuickPhotoCapture.tsx` (new)
**Acceptance Criteria**:
- Mobile-optimized camera capture
- Auto-tag with current batch status
- Optional caption input
- Quick access from batch card swipe action

### Task 6.5: Growth Summary Stats
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/GrowthSummaryCard.tsx` (new)
**Acceptance Criteria**:
- Show photo count per status stage
- Days between first and latest photo
- Visual progress indicator
- Link to full timeline

**Phase 6 Complete When**:
- [x] Photos tab shows chronological growth timeline
- [x] Users can compare photos side-by-side
- [x] Mobile camera capture works seamlessly (via existing SmartGalleryUploader)
- [x] Photos tagged with status and timestamp
- [x] Growth progression visually clear

**Phase 6 COMPLETED**: 2026-01-31

---

## Phase 7: Production Page Integration (P2)

**Goal**: Surface health insights on production dashboard

### Task 7.1: Add Health Status to Batch List
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/production/batches/BatchesClient.tsx`
**Acceptance Criteria**:
- Show health indicator on batch cards (green/yellow/red based on recent scouts)
- Tooltip with last health event info
- Filter batches by health status

### Task 7.2: Create Production Health Summary
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/production/ProductionHealthSummary.tsx` (new)
**Acceptance Criteria**:
- Card showing: batches needing attention, upcoming treatments, recent issues
- Click-through to affected batches
- Integration with production dashboard

### Task 7.3: Link Batch Cards to Health Tab
**Agent**: `feature-builder`
**Files**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/MiniBatchCard.tsx`
**Acceptance Criteria**:
- Health indicator dot on card
- Click opens batch detail to Health tab

**Phase 7 Complete When**:
- [x] Production page shows health status at glance
- [x] Easy navigation from production to batch health details
- [x] Batches needing attention clearly visible

**Phase 7 COMPLETED**: 2026-01-31

---

## Database Considerations

**No new migrations required** - existing schema supports all features:
- `plant_health_logs` - all health events including scouts
- `batch_events` - stock movements, lifecycle events
- `ipm_product_bottles` + `ipm_stock_movements` - bottle tracking
- `nursery_locations` - location-based scouting

**RLS already configured** for all tables via org_id.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scout logs location-batch attribution complex | Medium | Medium | Use batch_events to track location history |
| Performance with many health logs | Low | Medium | Add pagination, consider summary view |
| UI inconsistency between components | Medium | Low | Use shared component library |
| Stock adjustments affect order allocations | Medium | High | Validate available qty before adjustment |

---

## Handoff Notes for Jimmy

**Recommended Execution Mode**: `standard`

**DB Work Required**: No - existing schema sufficient

**Critical Dependencies**:
1. PlantHealthCard already works - enhance, don't rebuild
2. StockLedgerCard already works - add actions
3. ScoutWizard exists - reuse for batch-context scouting

**Execution Order**:
1. Phase 1 first - establishes tab structure for all subsequent work
2. Phase 2 + Phase 3 can run in parallel after Phase 1
3. Phase 4 + Phase 5 depend on Phase 2/3 completion
4. Phase 6 (Photos) can run in parallel with Phase 4/5
5. Phase 7 is polish, can be deferred

**Testing Approach**:
- Manual testing of each tab after completion
- Verify RLS by testing with different org users
- Check stock balance integrity after adjustments

---

## Definition of Done

- [x] BatchDetail.tsx has all 6 tabs with real data
- [x] batch-detail-dialog.tsx has matching tabs
- [x] Users can log health events from batch context
- [x] Scout history shows all relevant observations
- [x] Stock adjustments work with proper audit trail
- [x] Photos tab shows growth timeline with comparison feature
- [x] Production page surfaces health status
- [x] All components use consistent styling
- [x] No console errors in development (new files)
- [x] TypeScript strict mode passes (new files)

---

## Key Files Reference

### Existing Components to Enhance
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch/BatchDetail.tsx` - Main batch detail component (needs major updates)
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batch-detail-dialog.tsx` - Modal version (already has Stock/Health tabs)
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batches/PlantHealthCard.tsx` - Health log display
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/batches/StockLedgerCard.tsx` - Stock movement display
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/history/PlantHealthLog.tsx` - Health log timeline renderer

### Server Functions to Reuse
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/batches/plant-health-history.ts` - Existing health history builder
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/batches/stock-movements.ts` - Existing stock movement builder
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/plant-health.ts` - Existing scout/treatment actions

### Type Definitions
- `/Users/patrickdoran/Hortitrack/hortitrack/src/lib/history-types.ts` - StockMovement, PlantHealthEvent types

### Database Schema References
- `/Users/patrickdoran/Hortitrack/hortitrack/supabase/migrations/20251207100000_status_id_and_plant_health.sql` - plant_health_logs table
- `/Users/patrickdoran/Hortitrack/hortitrack/supabase/migrations/20251214100000_ipm_module.sql` - IPM products/programs
- `/Users/patrickdoran/Hortitrack/hortitrack/supabase/migrations/20251214200000_ipm_stock_tracking.sql` - Bottle tracking

---

*Plan created by Planner via Jimmy. Execute with: `jimmy execute PLAN-plant-health-completion.md`*
