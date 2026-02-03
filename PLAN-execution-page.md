# PLAN: Execution Page Redesign

**Status**: Complete
**Feature**: Transform Jobs page into Execution Page with printable worksheets
**Created**: 2026-02-03
**Updated**: 2026-02-03
**Estimated Sessions**: 2-3

---

## Overview

Transform the existing Production Jobs page (`/production/jobs`) into an "Execution Page" that organizes batch execution plans into configurable groups and generates **printable worksheets** for staff. No in-app job management - the focus is on planning visibility and print output.

### Current State
- Jobs page uses a Kanban board layout for job status tracking
- Jobs are created from ghost batches (Incoming/Planned status)
- Basic filtering by process type and assignee

### Target State
- Execution Page with configurable group panels
- Default groups by production phase: Incoming, Propagation, Plugs/Liners, Potting
- User-configurable group definitions (stored per organization)
- Rich filtering within each group (size, supplier, week, date, etc.)
- **Print button** to generate worksheets for staff with batch details
- No in-app job tracking - paper-based execution

---

## Technical Design

### Database Changes (P0)

New table for execution group configuration:

```sql
CREATE TABLE public.execution_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT,  -- Optional accent color for visual distinction
  icon TEXT,   -- Optional icon identifier
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- RLS policies
ALTER TABLE public.execution_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org execution groups" ON public.execution_groups
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage org execution groups" ON public.execution_groups
  FOR ALL USING (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  );
```

**filter_criteria JSONB structure:**
```typescript
type FilterCriteria = {
  statuses?: string[];        // e.g., ["Incoming", "Planned"]
  phases?: string[];          // e.g., ["propagation", "growing"]
  supplierIds?: string[];     // Filter by specific suppliers
  sizeIds?: string[];         // Filter by specific sizes
  varietyIds?: string[];      // Filter by specific varieties
  locationIds?: string[];     // Filter by locations
  weekRange?: { from?: number; to?: number };
  dateRange?: { from?: string; to?: string };
  processTypes?: string[];    // e.g., ["potting", "propagation"]
};
```

### File Structure

```
src/app/production/execution/
  page.tsx                    # Server component - data fetching
  ExecutionClient.tsx         # Main client component
  components/
    ExecutionGroupCard.tsx    # Individual group panel
    GroupConfigDialog.tsx     # Create/edit group configuration
    GroupFilterBar.tsx        # Inline filter controls within group
    BatchListItem.tsx         # Individual batch row in group
    ExecutionStats.tsx        # Summary statistics header
    PrintWorksheet.tsx        # Print-optimized worksheet component
    PrintButton.tsx           # Triggers print with proper styling
```

### Default Groups (Seeded on First Load)

| Order | Name | Filter Criteria | Description |
|-------|------|-----------------|-------------|
| 1 | Incoming Plants | status: ["Incoming"] | Deliveries expected from suppliers |
| 2 | Propagation | phase: ["propagation"], status: ["Planned"] | Seeds/cuttings to be started |
| 3 | Plugs/Liners | status: ["Plugs/Liners"] | Young plants ready for potting |
| 4 | Potting | processType: ["potting"], status: ["Planned"] | Batches scheduled for potting |

### Data Flow

```
+---------------------------------------------------------------------+
|                         Execution Page                               |
+---------------------------------------------------------------------+
|  +------------------+ +------------------+ +------------------+      |
|  | Stats Summary    | | Quick Filters    | | [Print] [Config] |      |
|  +------------------+ +------------------+ +------------------+      |
+---------------------------------------------------------------------+
|                                                                      |
|  +----------------------------------------------------------------+ |
|  | GROUP: Incoming Plants (Week 6-7)                   [filters]  | |
|  | +------------------------------------------------------------+ | |
|  | | Batch 1234 - Lavender - 500 units - Week 6 - Supplier X    | | |
|  | | Batch 1235 - Rosemary - 300 units - Week 6 - Supplier Y    | | |
|  | | Batch 1236 - Mint - 200 units - Week 7 - Supplier X        | | |
|  | +------------------------------------------------------------+ | |
|  | Total: 3 batches, 1000 units                      [Print Group]| |
|  +----------------------------------------------------------------+ |
|                                                                      |
|  +----------------------------------------------------------------+ |
|  | GROUP: Propagation                                  [filters]  | |
|  | +------------------------------------------------------------+ | |
|  | | Batch 2001 - Geranium - 1000 units - Week 5                | | |
|  | +------------------------------------------------------------+ | |
|  | Total: 1 batch, 1000 units                        [Print Group]| |
|  +----------------------------------------------------------------+ |
|                                                                      |
|  [+ Add Group]                            [Print All Worksheets]    |
+---------------------------------------------------------------------+
```

### Print Worksheet Layout

```
+---------------------------------------------------------------------+
|  [LOGO]    EXECUTION WORKSHEET - Incoming Plants      Date: 03/02/26|
+---------------------------------------------------------------------+
|  Week: 6-7                              Printed by: John             |
+---------------------------------------------------------------------+
|                                                                      |
|  +----------------------------------------------------------------+ |
|  | #  | Variety    | Size  | Qty | Supplier | Due    | Done | Notes||
|  |----|------------|-------|-----|----------|--------|------|------||
|  | 1  | Lavender   | P9    | 500 | SupplierX| Mon 3  | [ ]  |      ||
|  | 2  | Rosemary   | P9    | 300 | SupplierY| Mon 3  | [ ]  |      ||
|  | 3  | Mint       | P9    | 200 | SupplierX| Fri 7  | [ ]  |      ||
|  +----------------------------------------------------------------+ |
|                                                                      |
|  Total: 1000 units across 3 batches                                 |
|                                                                      |
|  Staff Notes: _________________________________________________     |
|              _________________________________________________      |
+---------------------------------------------------------------------+
```

---

## Implementation Phases

### Phase 1: Database & Foundation (P0)
**Agent**: `data-engineer`
**Sessions**: 0.5

#### Tasks:
1.1. Create `execution_groups` table migration
   - Include RLS policies
   - Include updated_at trigger
   - Include indexes on org_id and sort_order

1.2. Create seed function for default groups
   - RPC: `seed_default_execution_groups(p_org_id UUID)`
   - Only creates if no groups exist for org

1.3. Create server service for execution groups
   - File: `src/server/production/execution-groups.ts`
   - Functions: `getExecutionGroups()`, `createGroup()`, `updateGroup()`, `deleteGroup()`, `reorderGroups()`

**Phase 1 Complete When:**
- [x] Migration applied successfully
- [x] TypeScript types generated
- [x] Server service passes basic tests
- [x] RLS policies verified

---

### Phase 2: Core UI Components (P1)
**Agent**: `feature-builder`
**Sessions**: 1

#### Tasks:
2.1. Create execution page route and server component
   - File: `src/app/production/execution/page.tsx`
   - Fetch execution groups + planning batches

2.2. Create ExecutionClient main component
   - File: `src/app/production/execution/ExecutionClient.tsx`
   - Manage group state and filtering
   - Filter batches per group based on filter_criteria

2.3. Create ExecutionGroupCard component
   - File: `src/app/production/execution/components/ExecutionGroupCard.tsx`
   - Collapsible panel with header showing count/stats
   - Batch list table view
   - Print button for this group's worksheet

2.4. Create BatchListItem component
   - File: `src/app/production/execution/components/BatchListItem.tsx`
   - Display: variety, size, quantity, date/week, supplier, location
   - Click to view batch details (optional)

2.5. Create ExecutionStats component
   - File: `src/app/production/execution/components/ExecutionStats.tsx`
   - Summary cards: total batches, total plants, by status

**Phase 2 Complete When:**
- [x] Page renders with default groups
- [x] Batches correctly filtered into groups
- [x] Stats display correctly
- [x] Group cards collapsible and show batch counts

---

### Phase 3: Filtering & Configuration (P1)
**Agent**: `feature-builder`
**Sessions**: 1

#### Tasks:
3.1. Create GroupFilterBar component
   - File: `src/app/production/execution/components/GroupFilterBar.tsx`
   - Inline filters: size, supplier, week, date range
   - Filters applied on top of group's base filter_criteria
   - Clear filters button

3.2. Create GroupConfigDialog component
   - File: `src/app/production/execution/components/GroupConfigDialog.tsx`
   - Name, description, color
   - Filter criteria builder (multi-select for each filter type)
   - Preview of matching batches

3.3. Add group management actions
   - Create new group (opens GroupConfigDialog)
   - Edit existing group
   - Delete group (with confirmation)
   - Reorder groups (drag-drop or up/down buttons)

3.4. Create API routes for groups
   - `GET /api/production/execution-groups` - list groups
   - `POST /api/production/execution-groups` - create group
   - `PATCH /api/production/execution-groups/[id]` - update group
   - `DELETE /api/production/execution-groups/[id]` - delete group
   - `POST /api/production/execution-groups/reorder` - reorder groups

**Phase 3 Complete When:**
- [x] Inline filters work within groups
- [x] Groups can be created/edited/deleted
- [x] Group reordering works
- [x] Changes persist across page reloads

---

### Phase 4: Print Functionality (P1)
**Agent**: `feature-builder`
**Sessions**: 0.5

#### Tasks:
4.1. Create PrintWorksheet component
   - File: `src/app/production/execution/components/PrintWorksheet.tsx`
   - Print-optimized layout with table format
   - Includes: batch details, checkbox column for "Done", notes area
   - Header with group name, date range, printed date

4.2. Create PrintButton component
   - File: `src/app/production/execution/components/PrintButton.tsx`
   - Uses @media print CSS for proper styling
   - Option to print single group or all groups

4.3. Print stylesheet
   - File: `src/app/production/execution/print.css`
   - Hide navigation, filters during print
   - Page breaks between groups
   - Clean table formatting

4.4. Update navigation
   - Update production module navigation to show "Execution" instead of "Jobs"
   - Consider keeping `/production/jobs` as redirect for bookmarks

**Phase 4 Complete When:**
- [x] Print single group worksheet works
- [x] Print all worksheets works
- [x] Print output is clean and professional
- [x] Navigation updated

---

### Phase 5: Polish & Migration (P2)
**Agent**: `feature-builder`
**Sessions**: 0.5

#### Tasks:
5.1. Responsive design
   - Mobile-friendly layout for group cards
   - Touch-friendly batch selection

5.2. Empty states
   - No batches in group message
   - No groups configured message
   - First-time setup guidance

5.3. Loading states
   - Skeleton loaders for groups
   - Optimistic updates for group config changes

5.4. Keyboard navigation
   - Tab through groups
   - Keyboard shortcuts for common actions

**Phase 5 Complete When:**
- [x] Mobile layout works well
- [x] All empty states have appropriate messages
- [x] Loading states smooth
- [x] Basic keyboard navigation works

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Filter criteria complexity | Medium | Medium | Start with simple filters, add complexity iteratively |
| Performance with many batches | Low | Medium | Use pagination/virtualization if needed |
| Group configuration UI complexity | Medium | Low | Provide sensible defaults, progressive disclosure |
| Print formatting across browsers | Medium | Low | Test in Chrome/Safari, use standard print CSS |

---

## Definition of Done

- [x] Execution page accessible at `/production/execution`
- [x] Default groups created on first visit
- [x] Groups configurable through UI
- [x] Batches filtered correctly per group criteria
- [x] Additional inline filtering within groups
- [x] Print single group worksheet works
- [x] Print all worksheets works
- [x] Print output is clean and professional for staff use
- [x] Navigation updated (Jobs → Execution)
- [x] RLS policies verified by security-auditor
- [x] Feature documented in FEATURES.md

---

## Handoff Notes

### For Jimmy (Orchestration):
- **DB Work Required**: Yes - Phase 1 needs `data-engineer`
- **Recommended Mode**: `standard`
- **Critical Dependencies**: Phase 1 must complete before Phase 2

### For data-engineer:
- New table `execution_groups` with JSONB filter_criteria
- RLS pattern matches existing tables (org_memberships subquery)
- Seed function should be idempotent

### For feature-builder:
- Reuse `PlanningBatch` type from `@/lib/planning/types`
- Reuse filter context pattern from `DashboardFilterContext`
- Consider using existing `useAttributeOptions` hook for filter dropdowns
- Print functionality: use `@media print` CSS and `window.print()`
- Reference existing print patterns in the codebase if any

### For security-auditor:
- Review RLS policies on new table
- Verify filter_criteria JSONB cannot be exploited
- Check API routes have proper auth

---

## References

| File | Purpose |
|------|---------|
| `/src/lib/planning/types.ts` | PlanningBatch type definition |
| `/src/components/production/dashboard/DashboardFilterContext.tsx` | Filter context pattern |
| `/src/app/production/planning/PlanningClient.tsx` | Ghost batch display patterns |
| `/src/app/settings/dropdowns/page.tsx` | Configuration UI patterns |
| `/src/app/production/jobs/ProductionJobsClient.tsx` | Current jobs page (to be replaced) |
