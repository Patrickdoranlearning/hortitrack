# Plan B: IPM Remedial Programs - Dedicated Remedial System

**Perspective**: Dedicated remedial system - clean separation, purpose-built tables
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

## Approach: Dedicated Tables for Remedial Domain

Remedial programs have fundamentally different semantics:
- **Preventative**: "Apply to geraniums starting at potting"
- **Remedial**: "When you find Botrytis, do this treatment"

This justifies dedicated tables optimized for remedial workflows.

### Schema Design

```sql
-- ============================================================================
-- 1. IPM Remedial Programs - Treatment protocols for specific pests/diseases
-- ============================================================================
CREATE TABLE public.ipm_remedial_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,

  -- What this program treats (the core differentiator)
  target_pest_disease text NOT NULL,  -- 'Powdery Mildew', 'Aphids', 'Botrytis'
  severity_applicability text[] DEFAULT ARRAY['medium', 'critical'],

  -- Treatment parameters
  treatment_duration_days int NOT NULL DEFAULT 14,
  treatment_urgency text DEFAULT 'standard'
    CHECK (treatment_urgency IN ('immediate', 'standard', 'preventative')),

  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_remedial_programs_org ON ipm_remedial_programs(org_id);
CREATE INDEX idx_remedial_programs_pest ON ipm_remedial_programs(org_id, target_pest_disease);
CREATE INDEX idx_remedial_programs_active ON ipm_remedial_programs(org_id, is_active);

-- RLS
ALTER TABLE ipm_remedial_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org remedial programs"
ON ipm_remedial_programs FOR SELECT
USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org remedial programs"
ON ipm_remedial_programs FOR ALL
USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. Remedial Program Steps - Treatment sequence
-- ============================================================================
CREATE TABLE public.ipm_remedial_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES ipm_remedial_programs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES ipm_products(id) ON DELETE RESTRICT,

  step_order int NOT NULL DEFAULT 1,
  day_offset int NOT NULL DEFAULT 0,  -- Days from treatment start

  rate numeric,
  rate_unit text DEFAULT 'ml/L',
  method text DEFAULT 'Foliar Spray',
  notes text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_remedial_steps_program ON ipm_remedial_steps(program_id);

-- RLS (inherits from program)
ALTER TABLE ipm_remedial_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view remedial steps"
ON ipm_remedial_steps FOR SELECT
USING (program_id IN (
  SELECT id FROM ipm_remedial_programs
  WHERE org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
));

CREATE POLICY "Users can manage remedial steps"
ON ipm_remedial_steps FOR ALL
USING (program_id IN (
  SELECT id FROM ipm_remedial_programs
  WHERE org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
))
WITH CHECK (program_id IN (
  SELECT id FROM ipm_remedial_programs
  WHERE org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
));

-- ============================================================================
-- 3. Remedial Program Applications - When a program is applied to a scout finding
-- ============================================================================
CREATE TABLE public.ipm_remedial_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES ipm_remedial_programs(id) ON DELETE RESTRICT,
  triggered_by_log_id uuid NOT NULL REFERENCES plant_health_logs(id) ON DELETE RESTRICT,

  -- Target (where treatment is applied)
  target_type text NOT NULL CHECK (target_type IN ('batch', 'location')),
  target_batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  target_location_id uuid REFERENCES nursery_locations(id) ON DELETE CASCADE,

  -- Timing
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  expected_completion date,
  completed_at date,

  -- Status tracking
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  steps_completed int DEFAULT 0,

  applied_by uuid REFERENCES auth.users(id),
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT remedial_application_target_check CHECK (
    (target_type = 'batch' AND target_batch_id IS NOT NULL) OR
    (target_type = 'location' AND target_location_id IS NOT NULL)
  )
);

CREATE INDEX idx_remedial_applications_org ON ipm_remedial_applications(org_id);
CREATE INDEX idx_remedial_applications_log ON ipm_remedial_applications(triggered_by_log_id);
CREATE INDEX idx_remedial_applications_status ON ipm_remedial_applications(org_id, status);

-- RLS
ALTER TABLE ipm_remedial_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org remedial applications"
ON ipm_remedial_applications FOR SELECT
USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org remedial applications"
ON ipm_remedial_applications FOR ALL
USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. View: Available remedial programs by pest/disease
-- ============================================================================
CREATE OR REPLACE VIEW v_remedial_programs_by_pest AS
SELECT
  rp.org_id,
  rp.target_pest_disease,
  rp.id as program_id,
  rp.name as program_name,
  rp.description,
  rp.treatment_duration_days,
  rp.treatment_urgency,
  rp.severity_applicability,
  COUNT(rs.id) as step_count,
  ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as products_used
FROM ipm_remedial_programs rp
LEFT JOIN ipm_remedial_steps rs ON rs.program_id = rp.id
LEFT JOIN ipm_products p ON p.id = rs.product_id
WHERE rp.is_active = true
GROUP BY rp.id;
```

---

## Implementation Plan

### Phase 1: Schema & Core Backend (1-2 sessions)

#### Task 1.1: Migration
- Create `ipm_remedial_programs` table
- Create `ipm_remedial_steps` table
- Create `ipm_remedial_applications` table
- Create view for pest lookup
- All RLS policies

#### Task 1.2: TypeScript Types
- `IpmRemedialProgram` type
- `IpmRemedialStep` type
- `IpmRemedialApplication` type
- Input types for create/update

#### Task 1.3: Server Actions
- `listRemedialPrograms()` - all remedial programs
- `getRemedialProgramsForPest(pestOrDisease)` - filtered by pest
- `createRemedialProgram(input)` - with steps
- `updateRemedialProgram(id, input)`
- `applyRemedialProgram(logId, programId)` - creates application
- `completeRemedialStep(applicationId, stepOrder)` - marks step done

### Phase 2: Remedial Program Management UI (1 session)

#### Task 2.1: RemedialProgramWizard Component (New)
- Step 1: Program details + target pest/disease
- Step 2: Treatment steps (day-offset based)
- Step 3: Review & save
- Distinct from ProgramWizard (preventative)

#### Task 2.2: Remedial Programs Page
- New route: `/plant-health/remedial-programs`
- List view with pest/disease grouping
- Create/Edit/Delete actions
- OR: Tab on existing programs page

### Phase 3: Scout Wizard Integration (1-2 sessions)

#### Task 3.1: Enhanced TreatmentStep
- Query matching remedial programs for logged issue
- Display "Recommended Remedial Programs" panel
- Show program details: steps, duration, products
- "Apply This Program" button

#### Task 3.2: Manual Treatment Option
- Tabs: "Apply Program" | "Custom Treatment"
- Custom treatment = existing spot treatment flow
- Clear choice between approaches

#### Task 3.3: Program Application Logic
- When user applies program:
  - Create `ipm_remedial_applications` record
  - Generate IPM tasks for each step (day-offset)
  - Link back to scout log
  - Update application status as steps complete

### Phase 4: Treatment Tracking & Completion (1 session)

#### Task 4.1: Active Remedial Treatments View
- Dashboard widget showing active remedial treatments
- Progress indicator (steps completed / total)
- Due dates for next steps

#### Task 4.2: Step Completion Flow
- Mark individual steps as complete
- Auto-advance when all steps done
- Record to plant_health_logs

---

## Data Flow

```
Scout finds "Powdery Mildew" (severity: medium)
                    ↓
TreatmentStep queries: v_remedial_programs_by_pest
                    ↓
WHERE target_pest_disease = 'Powdery Mildew'
  AND 'medium' = ANY(severity_applicability)
                    ↓
Display matching programs:
┌─────────────────────────────────────────────┐
│ Recommended for Powdery Mildew              │
├─────────────────────────────────────────────┤
│ [Standard PM Protocol]     14 days, 4 steps │
│   Products: Nimrod, Systhane                │
│   [Apply Program]                           │
├─────────────────────────────────────────────┤
│ [Aggressive PM Treatment]   7 days, 6 steps │
│   Products: Nimrod, Systhane, Switch        │
│   [Apply Program]                           │
└─────────────────────────────────────────────┘
OR: [Create Custom Treatment]
                    ↓
User selects "Standard PM Protocol"
                    ↓
Creates ipm_remedial_applications record
Creates IPM tasks for Day 0, Day 4, Day 7, Day 14
Links to triggering scout log
```

---

## Advantages of This Approach

1. **Clear domain separation** - Preventative and remedial are conceptually different
2. **Optimized queries** - Index directly on pest/disease
3. **Rich tracking** - Application records show full treatment history
4. **Severity matching** - Programs can target specific severity levels
5. **Urgency levels** - "immediate" vs "standard" treatment protocols
6. **Progress tracking** - Steps completed, expected completion date
7. **Audit trail** - Which scout log triggered which treatment
8. **No risk to existing** - New tables, zero impact on preventative programs

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| More tables = more complexity | Clear separation makes each simpler |
| Duplicate product references | Same `ipm_products` table - no duplication |
| UI maintenance overhead | RemedialProgramWizard can share components |
| Learning curve | Clear documentation + distinct UI sections |

---

## Estimated Effort

| Phase | Sessions | Hours |
|-------|----------|-------|
| Schema & Core Backend | 1-2 | 3-5 |
| Remedial Program Management UI | 1 | 3-4 |
| Scout Wizard Integration | 1-2 | 4-6 |
| Treatment Tracking | 1 | 2-3 |
| **Total** | **4-6** | **12-18** |

---

## Files to Create/Modify

### Schema (New)
- `supabase/migrations/YYYYMMDD_remedial_programs.sql`

### Backend (New)
- `src/app/actions/ipm-remedial.ts` - dedicated actions file

### Types (Extend)
- `src/types/supabase.ts` - regenerate
- `src/types/ipm-remedial.ts` - new type definitions

### UI (New)
- `src/components/plant-health/ipm/RemedialProgramWizard.tsx`
- `src/app/plant-health/remedial-programs/page.tsx` (OR tab on programs)

### UI (Modify)
- `src/components/plant-health/scout/TreatmentStep.tsx` - add program suggestion
- `src/components/plant-health/scout/ScoutWizard.tsx` - minor updates
- `src/app/plant-health/page.tsx` - add active remedial treatments widget

---

## Definition of Done

- [ ] Dedicated remedial program tables with RLS
- [ ] CRUD for remedial programs and steps
- [ ] Programs indexed by target pest/disease
- [ ] Scout Wizard shows matching remedial programs
- [ ] User can apply program OR create custom treatment
- [ ] Application creates scheduled IPM tasks
- [ ] Step completion tracking
- [ ] Active treatments visible on dashboard
- [ ] TypeScript types for all new entities
- [ ] No impact on existing preventative programs
