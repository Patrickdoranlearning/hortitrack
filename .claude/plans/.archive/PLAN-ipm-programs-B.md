# PLAN: IPM Programs - Perspective B (Comprehensive Program Management)

**Created**: 2026-02-04
**Status**: Draft
**Perspective**: Proper architecture - Full-featured program system with templates, severity-based suggestions, and custom treatment building

---

## Goal

Build a comprehensive IPM program system that:
1. Distinguishes preventative vs remedial programs clearly
2. Suggests programs based on issue + severity combination
3. Allows users to customize suggested programs before applying
4. Supports custom multi-product treatment creation from scout flow
5. Tracks program application history for reporting

---

## Key Design Decisions

### Program Templates vs Applied Programs
- **Program Template** (`ipm_programs`): Reusable definition
- **Applied Program Instance** (`ipm_program_applications`): Actual application with dates, modifications
- This separation enables tracking and reporting

### Severity-Based Suggestions
Different severities get different suggestions:
- Low: Single product spot treatment
- Medium: Standard remedial program
- Critical: Aggressive program (more applications, shorter intervals)

### Custom Treatment Builder
Scout flow should allow creating ad-hoc multi-product treatments, not just selecting a single product.

---

## Phase 1: Schema Evolution

### Task 1.1: Comprehensive program schema changes
**Agent**: `data-engineer`

```sql
-- Program types and categorization
ALTER TABLE ipm_programs
ADD COLUMN program_type text DEFAULT 'preventative'
  CHECK (program_type IN ('preventative', 'remedial', 'emergency'));

ALTER TABLE ipm_programs
ADD COLUMN target_issues text[] DEFAULT '{}';

ALTER TABLE ipm_programs
ADD COLUMN severity_level text DEFAULT 'any'
  CHECK (severity_level IN ('any', 'low', 'medium', 'critical'));

ALTER TABLE ipm_programs
ADD COLUMN is_template boolean DEFAULT true;

-- Program application tracking
CREATE TABLE ipm_program_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  program_id uuid REFERENCES ipm_programs(id),  -- NULL if custom treatment
  target_type text NOT NULL CHECK (target_type IN ('batch', 'location')),
  target_batch_id uuid REFERENCES batches(id),
  target_location_id uuid REFERENCES nursery_locations(id),
  triggered_by_log_id uuid REFERENCES plant_health_logs(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at date NOT NULL,
  modifications jsonb DEFAULT '{}',  -- Track any customizations
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT target_check CHECK (
    (target_type = 'batch' AND target_batch_id IS NOT NULL) OR
    (target_type = 'location' AND target_location_id IS NOT NULL)
  )
);

-- Link spot treatments to program application
ALTER TABLE ipm_spot_treatments
ADD COLUMN program_application_id uuid REFERENCES ipm_program_applications(id);
```

**Acceptance**: Migration applies, program application tracking works

### Task 1.2: Severity-based suggestion view
**Agent**: `data-engineer`

Create view for efficient program lookups:
```sql
CREATE VIEW v_program_suggestions AS
SELECT
  p.*,
  unnest(p.target_issues) as target_issue,
  array_length(p.steps, 1) as step_count
FROM ipm_programs p
WHERE p.program_type IN ('remedial', 'emergency')
  AND p.is_active = true
  AND p.is_template = true;
```

---

## Phase 2: Backend Services

### Task 2.1: Program suggestion service
**Agent**: `feature-builder`
**File**: `src/app/actions/ipm-programs.ts` (new file)

Full-featured suggestion logic:
```typescript
export type ProgramSuggestion = {
  program: IpmProgram;
  matchScore: number;  // 0-100
  matchReason: string;
  severityMatch: boolean;
  productMatch: boolean;
};

export async function getSuggestedPrograms(params: {
  issueReason: string;
  severity: 'low' | 'medium' | 'critical';
  locationId?: string;
  batchId?: string;
}): Promise<IpmResult<ProgramSuggestion[]>>
```

Matching algorithm:
1. Exact target_issue match (score: 100)
2. Partial target_issue match (score: 75)
3. Product target_pests match (score: 50)
4. Severity level match (bonus: +20)
5. Sort by score, return top 5

### Task 2.2: Program application service
**Agent**: `feature-builder`
**File**: `src/app/actions/ipm-programs.ts`

```typescript
export async function applyProgram(params: {
  programId: string;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  startDate: string;
  modifications?: {
    intervalDays?: number;  // Override program interval
    skipSteps?: number[];   // Skip certain steps
    extraApplications?: number;  // Add more applications
  };
  triggeredByLogId?: string;
}): Promise<IpmResult<{ applicationId: string; treatmentIds: string[] }>>
```

Creates:
1. `ipm_program_applications` record
2. Linked `ipm_spot_treatments` for each step

### Task 2.3: Custom treatment builder service
**Agent**: `feature-builder`
**File**: `src/app/actions/ipm-programs.ts`

```typescript
export async function createCustomTreatment(params: {
  products: Array<{
    productId: string;
    rate?: number;
    rateUnit?: string;
    method?: string;
    applicationCount: number;
    intervalDays?: number;
  }>;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  startDate: string;
  triggeredByLogId?: string;
}): Promise<IpmResult<{ treatmentIds: string[] }>>
```

---

## Phase 3: Scout Wizard Redesign

### Task 3.1: Create ProgramSuggestionCard component
**Agent**: `feature-builder`
**File**: `src/components/plant-health/scout/ProgramSuggestionCard.tsx` (new)

```typescript
type Props = {
  suggestion: ProgramSuggestion;
  onSelect: () => void;
  onCustomize: () => void;
};
```

Shows:
- Program name and description
- Match reason ("Matches: Powdery Mildew, Medium severity")
- Product list with rates
- Application schedule summary
- [Apply] [Customize] buttons

### Task 3.2: Create CustomTreatmentBuilder component
**Agent**: `feature-builder`
**File**: `src/components/plant-health/scout/CustomTreatmentBuilder.tsx` (new)

Multi-product treatment builder:
- Add/remove products (like ProgramWizard but inline)
- Set applications per product
- Set interval between applications
- Preview total schedule

### Task 3.3: Redesign TreatmentStep with tabs
**Agent**: `feature-builder`
**File**: `src/components/plant-health/scout/TreatmentStep.tsx`

New structure:
```
[Tabs: Suggested | Manual | Custom]

SUGGESTED TAB:
- List of ProgramSuggestionCards
- "No programs match" state if empty

MANUAL TAB (existing):
- Single product selection
- Quick one-off treatment

CUSTOM TAB (new):
- CustomTreatmentBuilder
- For complex multi-product treatments
```

### Task 3.4: Program customization modal
**Agent**: `feature-builder`
**File**: `src/components/plant-health/scout/ProgramCustomizeModal.tsx` (new)

When user clicks "Customize" on a suggestion:
- Show program steps (editable)
- Adjust interval
- Skip/add steps
- Change start date
- [Apply Modified Program]

---

## Phase 4: Program Management UI

### Task 4.1: Enhanced ProgramWizard
**Agent**: `feature-builder`
**File**: `src/components/plant-health/ipm/ProgramWizard.tsx`

Add to Step 1:
- Program Type selector (Preventative | Remedial | Emergency)
- Target Issues multi-select (for Remedial/Emergency)
- Severity Level selector

### Task 4.2: Programs page with filtering
**Agent**: `feature-builder`
**File**: `src/app/plant-health/programs/page.tsx`

- Filter tabs: All | Preventative | Remedial | Emergency
- Show target issues as tags on remedial programs
- Show usage stats (times applied)

### Task 4.3: Program application history
**Agent**: `feature-builder`
**File**: `src/app/plant-health/programs/[id]/page.tsx` (new)

Program detail page showing:
- Program definition
- Application history
- Effectiveness (if issues resolved after application)

---

## Database Changes Summary

```sql
-- Migration 1: Program categorization
ALTER TABLE ipm_programs ADD COLUMN program_type text DEFAULT 'preventative';
ALTER TABLE ipm_programs ADD COLUMN target_issues text[] DEFAULT '{}';
ALTER TABLE ipm_programs ADD COLUMN severity_level text DEFAULT 'any';
ALTER TABLE ipm_programs ADD COLUMN is_template boolean DEFAULT true;

-- Migration 2: Application tracking
CREATE TABLE ipm_program_applications (...);
ALTER TABLE ipm_spot_treatments ADD COLUMN program_application_id uuid;

-- Migration 3: Indexes
CREATE INDEX idx_programs_type ON ipm_programs(org_id, program_type);
CREATE INDEX idx_programs_issues ON ipm_programs USING GIN(target_issues);
CREATE INDEX idx_applications_program ON ipm_program_applications(program_id);
CREATE INDEX idx_applications_target ON ipm_program_applications(target_batch_id, target_location_id);
```

---

## Definition of Done

- [ ] Programs can be categorized as preventative/remedial/emergency
- [ ] Remedial programs have target issues and severity levels
- [ ] Scout wizard shows relevant program suggestions with match scores
- [ ] Users can apply suggested programs directly OR customize first
- [ ] Users can build custom multi-product treatments
- [ ] Program applications are tracked for history/reporting
- [ ] Programs page filters by type and shows usage stats

---

## Estimated Sessions

4-5 sessions:
- Session 1: Schema migrations + basic services
- Session 2: Program suggestion logic + API
- Session 3: Scout wizard redesign (suggestions + custom builder)
- Session 4: Program customization + application tracking
- Session 5: Programs page enhancements + testing

---

## Risks

| Risk | Mitigation |
|------|------------|
| Complex UI confuses users | Clear tab separation, good defaults |
| Over-engineering for current needs | Phase rollout - core first, extras later |
| Performance with suggestion queries | Indexes on target_issues, cache suggestions |
| Migration complexity | Split into 3 smaller migrations |

---

## Handoff Notes for Jimmy

**DB Work Required**: Yes - 3 migrations for program categorization, application tracking, indexes
**Recommended Mode**: `thorough` (multiple schema changes)
**First Agent**: `data-engineer` for migrations
**Critical Dependencies**: None - extends existing schema
**Phasing Recommendation**: Can ship Phase 1-2 first as MVP, then Phase 3-4 as enhancement
