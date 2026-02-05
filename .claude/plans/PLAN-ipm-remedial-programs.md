# Plan: IPM Remedial Programs

**Feature**: Pest/Disease-targeted remedial treatment programs
**Created**: 2026-02-04
**Status**: Complete
**Completed**: 2026-02-04
**Recommended Mode**: standard

---

## Dual-Plan Evaluation

### Perspectives Explored

| Plan | Perspective | File |
|------|-------------|------|
| A | Minimal schema extension | PLAN-ipm-remedial-programs-A.md |
| B | Dedicated remedial system | PLAN-ipm-remedial-programs-B.md |

### Comparison Matrix

| Criterion | Plan A (Extend) | Plan B (Dedicated) | Winner |
|-----------|-----------------|-------------------|--------|
| Requirements fit | Adequate | Excellent | B |
| Schema complexity | Minimal (4 ALTERs) | Moderate (3 tables) | A |
| Query performance | Needs GIN index | Native index | B |
| Tracking capabilities | Basic | Rich (applications) | B |
| Separation of concerns | Mixed | Clean | B |
| Implementation effort | 3 sessions | 4-6 sessions | A |
| Future extensibility | Limited | High | B |
| Risk to existing code | Low | None | B |

### Key Trade-offs

| Aspect | Plan A | Plan B |
|--------|--------|--------|
| **Program storage** | Same table, type discriminator | Separate tables |
| **Step scheduling** | Week-based (like preventative) | Day-offset based (more natural for remedial) |
| **Application tracking** | Via spot_treatments | Dedicated applications table |
| **Severity matching** | Not native | Built-in |
| **Urgency levels** | Not supported | Built-in |
| **Progress tracking** | Manual | Automatic |

### Recommendation: **Plan B (Dedicated Remedial System)**

**Rationale**:

1. **Conceptual clarity**: Preventative and remedial programs serve fundamentally different purposes:
   - Preventative: "What to do for this crop type"
   - Remedial: "What to do when you find this pest"

2. **Better data model**: Day-offset scheduling makes more sense for remedial ("treat on Day 0, repeat Day 7") vs week-based ("Week 3 after potting").

3. **Rich tracking**: The `ipm_remedial_applications` table provides:
   - Direct link to triggering scout log (audit trail)
   - Progress tracking (steps completed)
   - Expected completion dates
   - Status management

4. **Severity matching**: Critical issues may need different treatment protocols than medium issues.

5. **Zero risk**: New tables don't touch existing preventative program code paths.

6. **Worth the extra effort**: The 1-2 additional sessions yield a much more capable system.

---

## Final Plan (Based on Plan B with refinements)

### Overview

Create a dedicated remedial program system that:
1. Stores treatment protocols indexed by pest/disease
2. Integrates with Scout Wizard Step 3 (Treatment)
3. Allows applying a full program OR creating custom treatments
4. Tracks remedial applications with step-by-step progress

---

## Phase 1: Schema & Core Backend

**Goal**: Database tables and server actions for remedial programs
**Agent**: data-engineer, then security-auditor

### Task 1.1: Create Migration

**File**: `supabase/migrations/YYYYMMDD_ipm_remedial_programs.sql`

Tables to create:
- `ipm_remedial_programs` - Protocol definitions
- `ipm_remedial_steps` - Treatment steps with day offsets
- `ipm_remedial_applications` - Applied treatments tracking
- View: `v_remedial_programs_by_pest`

Key columns for `ipm_remedial_programs`:
- `target_pest_disease` (text) - What this treats
- `severity_applicability` (text[]) - Which severities this applies to
- `treatment_duration_days` (int) - Expected duration
- `treatment_urgency` (text) - 'immediate' | 'standard'

Key columns for `ipm_remedial_steps`:
- `day_offset` (int) - Days from treatment start (0, 7, 14, etc.)
- `product_id` - Link to existing ipm_products
- `rate`, `rate_unit`, `method` - Application details

Key columns for `ipm_remedial_applications`:
- `triggered_by_log_id` - Links to scout log that found the issue
- `target_type`, `target_batch_id`, `target_location_id` - Where to apply
- `status`, `steps_completed` - Progress tracking

**Acceptance Criteria**:
- [ ] All tables created with proper FKs
- [ ] RLS policies enabled and tested
- [ ] Indexes on org_id, pest/disease, and status
- [ ] View returns programs grouped by pest with product info

### Task 1.2: TypeScript Types

**File**: `src/types/ipm-remedial.ts` (new)

Types to define:
- `IpmRemedialProgram`
- `IpmRemedialStep`
- `IpmRemedialApplication`
- Input types for create/update operations

### Task 1.3: Server Actions

**File**: `src/app/actions/ipm-remedial.ts` (new)

Actions to implement:
- `listRemedialPrograms()` - All org's remedial programs
- `getRemedialProgramsForPest(pest: string, severity?: string)` - Filtered
- `createRemedialProgram(input)` - With steps
- `updateRemedialProgram(id, input)` - Modify existing
- `deleteRemedialProgram(id)` - Remove (admin only)
- `applyRemedialProgram(logId, programId, targetType, targetId)` - Create application
- `getActiveRemedialApplications()` - Dashboard data
- `completeRemedialStep(applicationId, stepOrder)` - Mark step done
- `cancelRemedialApplication(applicationId)` - Stop treatment

**Acceptance Criteria**:
- [ ] All CRUD operations work
- [ ] Pest lookup returns matching programs
- [ ] Application creates proper records
- [ ] RLS enforced on all queries

---

## Phase 2: Remedial Program Management UI

**Goal**: UI for creating and managing remedial programs
**Agent**: feature-builder

### Task 2.1: RemedialProgramWizard Component

**File**: `src/components/plant-health/ipm/RemedialProgramWizard.tsx` (new)

Wizard steps:
1. **Program Details**
   - Name, description
   - Target pest/disease (dropdown from `plant_health_issue` attribute options)
   - Severity applicability (checkboxes: low, medium, critical)
   - Treatment urgency (standard/immediate)
   - Expected duration (days)

2. **Treatment Steps**
   - Add steps with day offset (Day 0, Day 7, etc.)
   - Select product from `ipm_products`
   - Rate, unit, method
   - Support multiple products per day (tank mix)

3. **Review & Save**
   - Summary of program
   - Create button

**Acceptance Criteria**:
- [ ] Wizard validates all required fields
- [ ] Steps can be added/removed/reordered
- [ ] Tank mix supported (multiple products same day)
- [ ] Creates program via server action

### Task 2.2: Remedial Programs List

**File**: `src/app/plant-health/programs/page.tsx` (extend with tab)

Add "Remedial Programs" tab alongside "Preventative Programs":
- List view grouped by pest/disease
- Show: name, target pest, duration, # steps, products used
- Create/Edit/Delete actions
- Badge for urgency level

**Alternative**: New route `/plant-health/remedial-programs/page.tsx`

**Acceptance Criteria**:
- [ ] Tab switches between preventative and remedial
- [ ] Create button opens RemedialProgramWizard
- [ ] Edit/Delete work correctly
- [ ] Empty state encourages creation

---

## Phase 3: Scout Wizard Integration

**Goal**: Suggest remedial programs during scouting treatment step
**Agent**: feature-builder

### Task 3.1: Fetch Matching Programs

**File**: `src/components/plant-health/scout/TreatmentStep.tsx`

When TreatmentStep loads with an issue:
1. Extract `issueReason` and `severity` from logData
2. Call `getRemedialProgramsForPest(issueReason, severity)`
3. Store matching programs in state

### Task 3.2: Suggested Programs Panel

Add new UI section above treatment type selector:

```
+------------------------------------------+
| Recommended for: [Powdery Mildew]        |
+------------------------------------------+
| [Standard PM Protocol]                   |
| 14 days | 4 applications                 |
| Products: Nimrod, Systhane               |
| [Apply This Program]                     |
+------------------------------------------+
| [Aggressive PM Treatment]                |
| 7 days | 6 applications                  |
| Products: Nimrod, Systhane, Switch       |
| [Apply This Program]                     |
+------------------------------------------+
| -- OR --                                 |
| [Create Custom Treatment] (existing UI)  |
+------------------------------------------+
```

### Task 3.3: Apply Program Flow

When user clicks "Apply This Program":
1. Call `applyRemedialProgram(logId, programId, targetType, targetId)`
2. Server creates:
   - `ipm_remedial_applications` record
   - IPM tasks for each step (via existing task system)
3. Show success toast with summary
4. Complete wizard flow

**Acceptance Criteria**:
- [ ] Matching programs shown only when issue logged
- [ ] Program details visible (duration, steps, products)
- [ ] Apply creates application and tasks
- [ ] User can still choose custom treatment instead
- [ ] No programs = gracefully falls back to custom only

### Task 3.4: ScoutWizard State Updates

**File**: `src/components/plant-health/scout/ScoutWizard.tsx`

- Pass `savedLogId` to TreatmentStep (already exists)
- Handle new completion type (program applied vs custom treatment)
- Success toast shows program name if applied

---

## Phase 4: Dashboard & Tracking (Optional Enhancement)

**Goal**: Visibility into active remedial treatments
**Agent**: feature-builder

### Task 4.1: Active Treatments Widget

**File**: `src/app/plant-health/page.tsx`

Add widget showing:
- Active remedial applications count
- Next step due dates
- Progress bars (steps completed / total)

### Task 4.2: Treatment Progress Page

**File**: `src/app/plant-health/remedial-treatments/page.tsx` (new, optional)

Full page view:
- All active remedial applications
- Filter by status, pest type
- Complete individual steps
- Cancel treatments

**This phase is optional** - can be added in a follow-up session.

---

## Handoff Notes

### Database Work Required
Yes - new tables for remedial programs, steps, and applications

### Recommended Starting Agent
`data-engineer` for Phase 1 tasks

### Critical Dependencies
- Existing `ipm_products` table (products are shared)
- Existing `plant_health_logs` table (for linking applications)
- Existing `attribute_options` for pest/disease dropdown values

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Complex wizard UI | Medium | Medium | Reuse ProgramWizard patterns |
| Program matching too broad/narrow | Low | Low | Allow manual selection always |
| Task generation conflicts | Low | Medium | Test with existing IPM tasks |

---

## Definition of Done

**Phase 1 Complete When**:
- [x] Migration applied successfully
- [x] All server actions return expected data
- [x] Security-auditor confirms RLS policies

**Phase 2 Complete When**:
- [x] RemedialProgramWizard creates programs correctly
- [x] Programs list shows all remedial programs
- [x] Edit/delete work without errors

**Phase 3 Complete When**:
- [x] Scout Wizard shows matching programs for issues
- [x] "Apply Program" creates application and tasks
- [x] "Custom Treatment" still works as before
- [x] End-to-end flow tested

**Feature Complete When**:
- [x] User can create remedial programs for specific pests
- [x] Scouting suggests relevant programs when issues found
- [x] Programs can be applied OR custom treatment created
- [x] All data persists correctly with proper org isolation

---

## Estimated Effort

| Phase | Sessions | Confidence |
|-------|----------|------------|
| Phase 1: Schema & Backend | 1-2 | High |
| Phase 2: Program Management UI | 1 | High |
| Phase 3: Scout Integration | 1-2 | Medium |
| Phase 4: Dashboard (optional) | 1 | High |
| **Total** | **4-6** | — |

---

## Files Summary

### New Files
- `supabase/migrations/YYYYMMDD_ipm_remedial_programs.sql`
- `src/types/ipm-remedial.ts`
- `src/app/actions/ipm-remedial.ts`
- `src/components/plant-health/ipm/RemedialProgramWizard.tsx`

### Modified Files
- `src/app/plant-health/programs/page.tsx` - add remedial tab
- `src/components/plant-health/scout/TreatmentStep.tsx` - program suggestions
- `src/components/plant-health/scout/ScoutWizard.tsx` - minor updates
- `src/types/supabase.ts` - regenerate after migration
