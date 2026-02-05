# Plan A: IPM Remedial Programs - Minimal Schema Extension

**Perspective**: Minimal schema extension - reuse existing tables where possible
**Created**: 2026-02-04
**Status**: Draft (Dual-Plan Evaluation)

---

## Understanding

### Current State
- **Preventative Programs** (`ipm_programs`): Crop-targeted, applied before issues occur
  - Assigned to plant families or locations via `ipm_assignments`
  - Week-based scheduling relative to potting date
  - Products defined in `ipm_program_steps`

### New Requirement
- **Remedial Programs**: Pest/Disease-targeted, applied after scouting finds an issue
  - Triggered when scout logs an issue like "Powdery Mildew"
  - System suggests a matching remedial program
  - User can accept suggestion OR create custom treatment

---

## Approach: Extend Existing Tables

The core insight: `ipm_programs` can hold BOTH preventative and remedial programs by adding a `program_type` discriminator.

### Schema Changes (Minimal)

```sql
-- 1. Add program_type to distinguish preventative vs remedial
ALTER TABLE ipm_programs
ADD COLUMN program_type text DEFAULT 'preventative'
  CHECK (program_type IN ('preventative', 'remedial'));

-- 2. Add target_pest_disease for remedial programs (what pest/disease this treats)
ALTER TABLE ipm_programs
ADD COLUMN target_pest_disease text[];  -- Array: ['Powdery Mildew', 'Botrytis']

-- 3. Index for quick lookup by pest/disease
CREATE INDEX idx_ipm_programs_target_pest
ON ipm_programs USING GIN (target_pest_disease)
WHERE program_type = 'remedial';

-- 4. Link scout logs to remedial programs applied
ALTER TABLE plant_health_logs
ADD COLUMN remedial_program_id uuid REFERENCES ipm_programs(id);
```

**Total: 4 ALTER statements, 1 index** - No new tables!

---

## Implementation Plan

### Phase 1: Schema & Backend (1 session)

#### Task 1.1: Migration
- Add `program_type` column to `ipm_programs`
- Add `target_pest_disease` array column
- Add index for pest/disease lookup
- Add `remedial_program_id` FK to `plant_health_logs`

#### Task 1.2: Update Types
- Extend `IpmProgram` type with `programType` and `targetPestDisease`
- Update `IpmProgramInput` to accept these fields

#### Task 1.3: Server Actions
- Update `createIpmProgram` to handle remedial programs
- Add `listRemedialPrograms(pestOrDisease: string)` function
- Add `applyRemedialProgram(logId, programId)` function

### Phase 2: Remedial Program Management UI (1 session)

#### Task 2.1: Extend ProgramWizard
- Add program type selector (preventative/remedial)
- Show "Target Pest/Disease" field for remedial programs
- Hide family/location assignment for remedial (not needed)

#### Task 2.2: Programs List Page
- Add filter for program type
- Show target pests for remedial programs
- Different badge styling for remedial vs preventative

### Phase 3: Scout Wizard Integration (1 session)

#### Task 3.1: Treatment Step Enhancement
- On TreatmentStep, if issue was logged:
  - Query `listRemedialPrograms(issueReason)`
  - Show "Suggested Remedial Programs" section
  - Allow user to select one OR continue with manual treatment

#### Task 3.2: Program Application Flow
- When user selects remedial program:
  - Create spot treatment entries for each step
  - Link to triggering scout log
  - Schedule tasks based on program's week schedule

#### Task 3.3: "Apply Program" vs "Custom Treatment" UX
- Clear toggle/tabs between:
  - "Apply Remedial Program" (shows matching programs)
  - "Custom Treatment" (existing manual form)

---

## Data Flow

```
Scout finds "Powdery Mildew" → TreatmentStep loads
                                    ↓
                    Query: WHERE 'Powdery Mildew' = ANY(target_pest_disease)
                                    ↓
                    Display: "Remedial Programs for Powdery Mildew"
                              - Standard PM Protocol (4 weeks)
                              - Aggressive PM Treatment (2 weeks)
                                    ↓
                    User selects → Apply program steps as spot treatments
```

---

## Advantages of This Approach

1. **No schema complexity** - Reuses existing proven tables
2. **Unified program management** - One wizard, one list, filtered by type
3. **Shared product library** - Same `ipm_products` for both program types
4. **Minimal migration risk** - Additive columns only
5. **Faster implementation** - Less code to write and test

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Program table gets cluttered | Filter by type in all UIs |
| Confusion between types | Clear labeling, color-coded badges |
| Step structure differs | Week-based works for both (remedial = W0, W1, W2...) |

---

## Estimated Effort

| Phase | Sessions | Hours |
|-------|----------|-------|
| Schema & Backend | 1 | 2-3 |
| Program Management UI | 1 | 2-3 |
| Scout Wizard Integration | 1 | 3-4 |
| **Total** | **3** | **7-10** |

---

## Files to Modify

### Schema
- `supabase/migrations/YYYYMMDD_remedial_programs.sql` (new)

### Backend
- `src/app/actions/ipm.ts` (extend)
- `src/types/supabase.ts` (regenerate)

### UI
- `src/components/plant-health/ipm/ProgramWizard.tsx` (extend)
- `src/app/plant-health/programs/page.tsx` (extend)
- `src/components/plant-health/scout/TreatmentStep.tsx` (major changes)
- `src/components/plant-health/scout/ScoutWizard.tsx` (minor)

---

## Definition of Done

- [ ] Remedial programs can be created with target pest/disease
- [ ] Scout Wizard suggests matching remedial programs
- [ ] User can apply suggested program OR create custom treatment
- [ ] Spot treatments created from program steps
- [ ] Program list shows both types with clear distinction
- [ ] All RLS policies intact
- [ ] TypeScript types updated
