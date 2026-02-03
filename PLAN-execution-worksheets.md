# PLAN: Execution Worksheets Feature

**Status**: Complete
**Created**: 2026-02-03
**Completed**: 2026-02-03
**Feature**: Persistent worksheet tracking for batch execution
**Estimated Sessions**: 2-3

---

## Executive Summary

Enhance the Execution Page with saved worksheet functionality. Currently, worksheets are printed ad-hoc from execution groups but are not persisted. This feature adds:
1. Batch selection within groups (checkboxes)
2. Saved worksheets in the database
3. Worksheet lifecycle tracking (completion status)
4. Print from saved worksheets

---

## Current State Analysis

### Existing Execution Page (`/production/execution`)
- **ExecutionClient.tsx**: Main client component with group management
- **ExecutionGroupCard.tsx**: Displays batches in collapsible groups
- **PrintWorksheet.tsx**: Ad-hoc printing (no persistence)
- **BatchListItem.tsx**: Individual batch row display

### Existing Infrastructure
- `execution_groups` table exists (creates filter-based groups)
- `production_jobs` + `production_job_batches` tables (for job-based tracking)
- `batches` table with `status` column tracking lifecycle
- Ghost batches (status: "Incoming", "Planned") shown on execution page
- Actualization via `/api/production/batches/actualize` transitions batches

### Batch Status Lifecycle
```
Incoming → (actualize) → Growing/Propagation/Plugs/Liners
Planned  → (actualize) → Growing/Propagation/Plugs/Liners
```

When a batch is "actualized", it transitions from a ghost status to an active status.

---

## Requirements

### R1: Batch Selection
- Add checkboxes to `BatchListItem` rows
- Support "select all" per group
- Selection state managed in parent component
- Clear selection after creating worksheet

### R2: Saved Worksheets
- Create `execution_worksheets` table
- Create `execution_worksheet_batches` junction table
- Worksheets have: name, date, created_by, status
- Link to multiple batches via junction table

### R3: Worksheet Lifecycle
- Status: `open` | `completed`
- Track completion per batch (actualized = completed)
- Show progress: "3 of 5 batches completed"
- Auto-complete worksheet when all batches completed
- Manager can manually delete worksheets

### R4: Print Saved Worksheets
- New UI section showing saved worksheets
- Print from saved worksheet (not just ad-hoc)
- Include completion status on printed worksheet

---

## Database Design

### New Table: `execution_worksheets`
```sql
CREATE TABLE public.execution_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Worksheet details
  name TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open',  -- 'open', 'completed'

  -- Completion metadata
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status check constraint
ALTER TABLE public.execution_worksheets
  ADD CONSTRAINT execution_worksheets_status_check
  CHECK (status IN ('open', 'completed'));

-- Indexes
CREATE INDEX execution_worksheets_org_id_idx ON public.execution_worksheets(org_id);
CREATE INDEX execution_worksheets_status_idx ON public.execution_worksheets(status);
CREATE INDEX execution_worksheets_scheduled_date_idx ON public.execution_worksheets(scheduled_date);

-- RLS
ALTER TABLE public.execution_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org worksheets"
  ON public.execution_worksheets
  FOR SELECT
  USING (org_id = (SELECT current_setting('app.current_org_id')::uuid));

CREATE POLICY "Users can insert own org worksheets"
  ON public.execution_worksheets
  FOR INSERT
  WITH CHECK (org_id = (SELECT current_setting('app.current_org_id')::uuid));

CREATE POLICY "Users can update own org worksheets"
  ON public.execution_worksheets
  FOR UPDATE
  USING (org_id = (SELECT current_setting('app.current_org_id')::uuid));

CREATE POLICY "Users can delete own org worksheets"
  ON public.execution_worksheets
  FOR DELETE
  USING (org_id = (SELECT current_setting('app.current_org_id')::uuid));
```

### New Table: `execution_worksheet_batches`
```sql
CREATE TABLE public.execution_worksheet_batches (
  worksheet_id UUID NOT NULL REFERENCES public.execution_worksheets(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,

  -- Ordering
  sort_order INT DEFAULT 0,

  -- Per-batch completion tracking (denormalized for performance)
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Notes specific to this batch in this worksheet
  notes TEXT,

  -- Audit
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (worksheet_id, batch_id)
);

-- Indexes
CREATE INDEX execution_worksheet_batches_worksheet_id_idx
  ON public.execution_worksheet_batches(worksheet_id);
CREATE INDEX execution_worksheet_batches_batch_id_idx
  ON public.execution_worksheet_batches(batch_id);

-- RLS (inherits from parent worksheet)
ALTER TABLE public.execution_worksheet_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage worksheet batches via parent"
  ON public.execution_worksheet_batches
  FOR ALL
  USING (
    worksheet_id IN (
      SELECT id FROM public.execution_worksheets
      WHERE org_id = (SELECT current_setting('app.current_org_id')::uuid)
    )
  );
```

### Trigger: Auto-complete worksheet batches on actualization
```sql
CREATE OR REPLACE FUNCTION fn_mark_worksheet_batch_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- When a batch is actualized (status changes from Incoming/Planned to something else)
  IF OLD.status IN ('Incoming', 'Planned') AND NEW.status NOT IN ('Incoming', 'Planned') THEN
    -- Mark any worksheet entries for this batch as completed
    UPDATE public.execution_worksheet_batches
    SET completed_at = now(),
        completed_by = (SELECT current_setting('app.current_user_id', true)::uuid)
    WHERE batch_id = NEW.id
      AND completed_at IS NULL;

    -- Check if any worksheets are now fully complete
    UPDATE public.execution_worksheets w
    SET status = 'completed',
        completed_at = now(),
        completed_by = (SELECT current_setting('app.current_user_id', true)::uuid)
    WHERE w.id IN (
      SELECT DISTINCT worksheet_id
      FROM public.execution_worksheet_batches
      WHERE batch_id = NEW.id
    )
    AND w.status = 'open'
    AND NOT EXISTS (
      SELECT 1 FROM public.execution_worksheet_batches wb
      WHERE wb.worksheet_id = w.id
        AND wb.completed_at IS NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_mark_worksheet_batch_completed
  AFTER UPDATE OF status ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION fn_mark_worksheet_batch_completed();
```

---

## Implementation Plan

### Phase 1: Database & Backend (Session 1)

#### Task 1.1: Create Migration
**Agent**: `data-engineer`
**Files**: `supabase/migrations/YYYYMMDDHHMMSS_execution_worksheets.sql`
**Acceptance Criteria**:
- [ ] `execution_worksheets` table created with all columns
- [ ] `execution_worksheet_batches` junction table created
- [ ] RLS policies enabled and tested
- [ ] Trigger for auto-completion created
- [ ] Indexes for common queries added

#### Task 1.2: Server Functions
**Agent**: `feature-builder`
**Files**: `src/server/production/execution-worksheets.ts`
**Acceptance Criteria**:
- [ ] `getExecutionWorksheets()` - list all open worksheets
- [ ] `getExecutionWorksheetById(id)` - single worksheet with batches
- [ ] `createExecutionWorksheet(input)` - create with batch IDs
- [ ] `deleteExecutionWorksheet(id)` - manager-only soft delete
- [ ] `getWorksheetProgress(id)` - returns completed/total counts
- [ ] All functions use org_id scoping via `getUserAndOrg()`

#### Task 1.3: API Routes
**Agent**: `feature-builder`
**Files**:
- `src/app/api/production/execution-worksheets/route.ts` (GET, POST)
- `src/app/api/production/execution-worksheets/[id]/route.ts` (GET, DELETE)
**Acceptance Criteria**:
- [ ] POST creates worksheet with array of batch_ids
- [ ] GET returns worksheets with progress calculation
- [ ] DELETE validates user permissions
- [ ] Proper error handling and validation

### Phase 2: UI - Selection & Creation (Session 1-2)

#### Task 2.1: Add Batch Selection to Groups
**Agent**: `feature-builder`
**Files**:
- `src/app/production/execution/ExecutionClient.tsx`
- `src/app/production/execution/components/BatchListItem.tsx`
- `src/app/production/execution/components/ExecutionGroupCard.tsx`
**Acceptance Criteria**:
- [ ] Checkbox column added to batch table
- [ ] Controlled selection state in ExecutionClient
- [ ] "Select All" checkbox in group header
- [ ] Selected count displayed per group
- [ ] Selection persists during inline filtering

#### Task 2.2: Create Worksheet Dialog
**Agent**: `feature-builder`
**Files**: `src/app/production/execution/components/CreateWorksheetDialog.tsx`
**Acceptance Criteria**:
- [ ] Dialog opens when batches selected
- [ ] Shows count of selected batches
- [ ] Input for worksheet name (with smart default)
- [ ] Optional date picker for scheduled_date
- [ ] Submit creates worksheet and clears selection
- [ ] Success toast with link to worksheet

#### Task 2.3: Add Create Worksheet Button
**Agent**: `feature-builder`
**Files**: `src/app/production/execution/ExecutionClient.tsx`
**Acceptance Criteria**:
- [ ] "Create Worksheet" button appears when batches selected
- [ ] Button shows selected count
- [ ] Opens CreateWorksheetDialog
- [ ] Button disabled when no selection

### Phase 3: UI - Worksheet Management (Session 2)

#### Task 3.1: Worksheets List Section
**Agent**: `feature-builder`
**Files**:
- `src/app/production/execution/components/WorksheetsPanel.tsx`
- `src/app/production/execution/ExecutionClient.tsx`
**Acceptance Criteria**:
- [ ] Panel shows list of open worksheets
- [ ] Each shows: name, date, progress (e.g., "3/5 complete")
- [ ] Progress bar visualization
- [ ] Click expands to show batch list
- [ ] Completed worksheets collapsible/hidden

#### Task 3.2: Worksheet Detail View
**Agent**: `feature-builder`
**Files**: `src/app/production/execution/components/WorksheetDetail.tsx`
**Acceptance Criteria**:
- [ ] Shows all batches in worksheet
- [ ] Completed batches marked with checkmark
- [ ] Batch status badges (Incoming vs actualized)
- [ ] Timestamp when batch was completed
- [ ] Link to batch detail page

#### Task 3.3: Print from Saved Worksheet
**Agent**: `feature-builder`
**Files**:
- `src/app/production/execution/components/PrintWorksheet.tsx` (modify)
- `src/app/production/execution/components/WorksheetDetail.tsx`
**Acceptance Criteria**:
- [ ] Print button on worksheet detail
- [ ] PrintWorksheet accepts worksheet data (not just groups)
- [ ] Printed worksheet shows completion status
- [ ] Completed batches have visual indicator

#### Task 3.4: Delete Worksheet
**Agent**: `feature-builder`
**Files**: `src/app/production/execution/components/WorksheetDetail.tsx`
**Acceptance Criteria**:
- [ ] Delete button (with confirmation)
- [ ] API call to delete endpoint
- [ ] Optimistic UI update
- [ ] Success feedback

### Phase 4: Polish & Testing (Session 2-3)

#### Task 4.1: Loading States & Error Handling
**Agent**: `feature-builder`
**Acceptance Criteria**:
- [ ] Skeleton loading for worksheets panel
- [ ] Error boundaries for worksheet components
- [ ] Retry logic for failed API calls
- [ ] Empty state when no worksheets

#### Task 4.2: Mobile Responsiveness
**Agent**: `feature-builder`
**Acceptance Criteria**:
- [ ] Selection works on touch devices
- [ ] Worksheets panel collapses nicely
- [ ] Print preview works on mobile
- [ ] Batch table scrolls horizontally

#### Task 4.3: Integration Testing
**Agent**: `tester-tim`
**Acceptance Criteria**:
- [ ] Create worksheet with selected batches
- [ ] Worksheet appears in panel
- [ ] Actualize batch -> worksheet progress updates
- [ ] All batches done -> worksheet auto-completes
- [ ] Print worksheet shows correct data
- [ ] Delete worksheet works

---

## Definition of Done

- [x] All tasks completed
- [x] RLS policies verified by security-auditor
- [x] TypeScript types generated and no `any` types
- [x] All acceptance criteria met
- [x] No console errors in browser
- [x] Manual testing completed:
  - [x] Create worksheet flow
  - [x] Progress tracking on actualization
  - [x] Print saved worksheet
  - [x] Delete worksheet
- [x] FEATURES.md updated with new user stories

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Batch deleted while on worksheet | Low | Medium | CASCADE DELETE on FK + show "batch removed" UI |
| Large number of worksheets | Low | Low | Add pagination and status filter |
| Trigger performance on bulk actualize | Medium | Low | Trigger is per-row, test with bulk |
| Concurrent worksheet creation | Low | Low | No unique constraint on batch per worksheet |

---

## Out of Scope

- Worksheet templates (save filter criteria)
- Automatic worksheet creation from jobs
- Email/notification when worksheet completed
- Worksheet assignment to specific users
- Edit worksheet after creation (add/remove batches)

---

## Files to Create/Modify

### New Files
- `supabase/migrations/YYYYMMDDHHMMSS_execution_worksheets.sql`
- `src/server/production/execution-worksheets.ts`
- `src/app/api/production/execution-worksheets/route.ts`
- `src/app/api/production/execution-worksheets/[id]/route.ts`
- `src/app/production/execution/components/CreateWorksheetDialog.tsx`
- `src/app/production/execution/components/WorksheetsPanel.tsx`
- `src/app/production/execution/components/WorksheetDetail.tsx`

### Modified Files
- `src/app/production/execution/ExecutionClient.tsx`
- `src/app/production/execution/components/BatchListItem.tsx`
- `src/app/production/execution/components/ExecutionGroupCard.tsx`
- `src/app/production/execution/components/PrintWorksheet.tsx`
- `FEATURES.md`

---

## Handoff Notes

**For Jimmy (orchestration)**:
- Route Phase 1 to `data-engineer` (schema) then `security-auditor` (RLS review)
- Route Phases 2-3 to `feature-builder`
- Route Phase 4 testing to `tester-tim`
- Recommended mode: `standard` (no auth/payment changes)

**For data-engineer**:
- The `execution_groups` table already exists but has no migration visible
- New tables follow same RLS pattern as `production_jobs`
- Trigger needs careful testing with bulk actualization

**For feature-builder**:
- Follow existing patterns in `ExecutionClient.tsx`
- Use SWR for data fetching (already in use)
- Selection state should NOT persist in URL (local state only)

**DB Work Required**: Yes - new tables and trigger
**Critical Dependencies**: Existing `batches` table, `execution_groups` functionality

---

## Phase 1 Complete When
- [x] Migration applied successfully
- [x] Server functions return expected data
- [x] API routes respond correctly (test with curl)
- [x] RLS verified with different org contexts

## Phase 2 Complete When
- [x] Can select batches with checkboxes
- [x] Can create worksheet from selection
- [x] Worksheet visible in database

## Phase 3 Complete When
- [x] Worksheets panel shows created worksheets
- [x] Progress updates on batch actualization
- [x] Can print from saved worksheet
- [x] Can delete worksheet

## Phase 4 Complete When
- [x] Full integration test passing
- [x] No visual regressions
- [x] FEATURES.md updated
