# PLAN: IPM Programs (Preventative & Remedial)

**Created**: 2026-02-04
**Status**: Ready
**Synthesized From**: PLAN-ipm-programs-A.md (MVP), PLAN-ipm-programs-B.md (Comprehensive)

---

## Dual-Plan Evaluation

### Perspectives Explored
| Plan | Perspective | Key Approach |
|------|-------------|--------------|
| A | MVP Integration | Minimal schema changes, quick scout integration |
| B | Comprehensive Management | Full tracking, customization, severity matching |

### Comparison Matrix
| Criterion | Plan A | Plan B | Winner |
|-----------|--------|--------|--------|
| Requirements fit | Good | Excellent | B |
| Complexity | Low | Medium-High | A |
| DB impact | 1 migration | 3 migrations | A |
| Sessions | 2-3 | 4-5 | A |
| Extensibility | Limited | Excellent | B |
| User confusion risk | Low | Medium | A |

### Synthesis Decision

**Taking a phased approach** - Start with Plan A's simplicity, incorporate key elements from Plan B for future-proofing:

**From Plan A:**
- Simple `program_type` and `target_issues` columns (not separate tracking table yet)
- Quick scout wizard integration
- 2-3 session timeline

**From Plan B:**
- Severity-based program matching (but simpler implementation)
- "Custom treatment" option in scout flow (but without full builder initially)
- Better match scoring logic

**Deferred to Phase 2 (if needed):**
- `ipm_program_applications` tracking table
- Full program customization modal
- Program effectiveness analytics

---

## Goal

Enable IPM programs to be categorized as preventative or remedial, with the scout wizard suggesting relevant remedial programs based on the issue type and severity found during scouting.

**User Story**: "When I log Powdery Mildew (medium severity), the system suggests the 'Fungicide Rotation Program' I've configured. I can apply it directly or create a custom treatment."

---

## Phase 1: Schema & Backend (Session 1)

### Task 1.1: Add program categorization columns
**Agent**: `data-engineer`
**Estimated**: 20 min

Create migration to add program type and targeting:

```sql
-- Migration: 20260204_ipm_program_categorization.sql

-- Program type enum
ALTER TABLE ipm_programs
ADD COLUMN IF NOT EXISTS program_type text DEFAULT 'preventative'
  CHECK (program_type IN ('preventative', 'remedial', 'custom'));

-- Target issues for remedial programs (matches plant_health_issue attribute options)
ALTER TABLE ipm_programs
ADD COLUMN IF NOT EXISTS target_issues text[] DEFAULT '{}';

-- Optional severity targeting
ALTER TABLE ipm_programs
ADD COLUMN IF NOT EXISTS target_severity text DEFAULT 'any'
  CHECK (target_severity IN ('any', 'low', 'medium', 'critical'));

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ipm_programs_type
  ON ipm_programs(org_id, program_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ipm_programs_issues
  ON ipm_programs USING GIN(target_issues)
  WHERE program_type = 'remedial';

COMMENT ON COLUMN ipm_programs.program_type IS 'preventative=scheduled prevention, remedial=response to issues, custom=ad-hoc';
COMMENT ON COLUMN ipm_programs.target_issues IS 'Issue reasons this remedial program addresses (matches plant_health_issue options)';
COMMENT ON COLUMN ipm_programs.target_severity IS 'Severity level this program is designed for';
```

**Acceptance Criteria**:
- Migration applies without error
- Existing programs default to `preventative`
- TypeScript types regenerated

### Task 1.2: Add program suggestion server action
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/ipm.ts`
**Estimated**: 30 min

Add new exports:

```typescript
export type ProgramSuggestion = {
  program: IpmProgram;
  matchScore: number;      // 0-100
  matchReasons: string[];  // ["Targets: Powdery Mildew", "Severity: Medium"]
};

export async function getSuggestedPrograms(params: {
  issueReason: string;
  severity: 'low' | 'medium' | 'critical';
}): Promise<IpmResult<ProgramSuggestion[]>>
```

Matching logic:
1. **Exact issue match** (100 points): `target_issues` contains exact issueReason
2. **Partial match** (60 points): `target_issues` contains similar text (case-insensitive partial)
3. **Product match** (40 points): Program products have `target_pests` matching issue
4. **Severity bonus** (+25 points): `target_severity` matches OR is 'any'
5. Filter scores >= 40, sort descending, return top 5

**Acceptance Criteria**:
- Returns empty array gracefully if no matches
- Exact matches score highest
- Returns programs with steps/products included

### Task 1.3: Add program application action
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/plant-health.ts`
**Estimated**: 30 min

Add action to apply a program as spot treatments:

```typescript
export async function applyProgramAsTreatment(params: {
  programId: string;
  locationId?: string;
  batchId?: string;
  startDate: string;
  triggeredByLogId?: string;
}): Promise<PlantHealthResult<{ treatmentIds: string[] }>>
```

Logic:
1. Load program with steps
2. Create `ipm_spot_treatment` for each step
   - Set `first_application_date` based on step's week offset from startDate
   - Link to triggeredByLogId if provided
3. Return all created treatment IDs

**Acceptance Criteria**:
- Creates correct number of treatments
- Dates calculated correctly from startDate
- All treatments linked to program products

---

## Phase 2: Scout Wizard Integration (Session 2)

### Task 2.1: Create ProgramSuggestionCard component
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/scout/ProgramSuggestionCard.tsx` (new)
**Estimated**: 30 min

Simple card showing:
- Program name and description
- Match reasons as badges
- Products in program (icons + names)
- Application summary ("3 applications over 3 weeks")
- [Apply Program] button
- [View Details] expand/collapse

```typescript
type ProgramSuggestionCardProps = {
  suggestion: ProgramSuggestion;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApply: () => void;
  isApplying: boolean;
};
```

**Acceptance Criteria**:
- Shows all key program info
- Apply button triggers callback
- Collapse/expand for details

### Task 2.2: Modify TreatmentStep to show suggestions
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/scout/TreatmentStep.tsx`
**Estimated**: 45 min

Changes:
1. Fetch suggested programs on mount when `logData.logType === 'issue'`
2. Show suggestions section ABOVE treatment type selector (when suggestions exist)
3. Add "or create manual treatment" divider
4. Handle program application flow

New state:
```typescript
const [suggestions, setSuggestions] = useState<ProgramSuggestion[]>([]);
const [loadingSuggestions, setLoadingSuggestions] = useState(false);
const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
const [applyingProgram, setApplyingProgram] = useState<string | null>(null);
```

UI structure when suggestions exist:
```
[Header: "Suggested Programs for {issueReason}"]

[ProgramSuggestionCard 1]
[ProgramSuggestionCard 2]
... (max 3)

[Divider: "--- or create a manual treatment ---"]

[Existing treatment type selector + forms]
```

**Acceptance Criteria**:
- Suggestions load on mount for issues
- Shows loading state
- Empty state if no suggestions ("No matching programs - create a manual treatment")
- Applying program shows loading, then completes wizard

### Task 2.3: Wire up program application in TreatmentStep
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/scout/TreatmentStep.tsx`
**Estimated**: 20 min

When user clicks "Apply Program":
1. Call `applyProgramAsTreatment` with programId, target, savedLogId
2. Show success toast with treatment count
3. Complete the wizard (call `onComplete` with program data)

Modify `TreatmentData` type to support program:
```typescript
export type TreatmentData = {
  type: 'chemical' | 'mechanical' | 'feeding' | 'program';
  // ... existing fields
  programId?: string;
  programName?: string;
  treatmentIds?: string[];
};
```

**Acceptance Criteria**:
- Program application creates treatments
- Wizard completes successfully
- Toast shows confirmation

---

## Phase 3: Program Management UI (Session 3)

### Task 3.1: Add program type to ProgramWizard Step 1
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/ipm/ProgramWizard.tsx`
**Estimated**: 30 min

Add to Step 1 (Program Details):
1. Program Type radio group: Preventative | Remedial
2. When Remedial selected, show:
   - Target Issues multi-select (from `plant_health_issue` attribute options)
   - Target Severity radio: Any | Low | Medium | Critical

Update form schema and submission to include new fields.

**Acceptance Criteria**:
- Can create preventative programs (existing behavior)
- Can create remedial programs with target issues
- Validation: remedial requires at least one target issue

### Task 3.2: Update Programs page to show types
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/plant-health/programs/page.tsx`
**Estimated**: 25 min

Changes:
1. Add filter tabs: All | Preventative | Remedial
2. Show program type badge on each card
3. For remedial programs, show target issues as tags

**Acceptance Criteria**:
- Filter tabs work
- Type badges display correctly
- Target issues visible on remedial programs

### Task 3.3: Update listIpmPrograms to support filtering
**Agent**: `feature-builder`
**File**: `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/ipm.ts`
**Estimated**: 15 min

Add optional filter parameter:
```typescript
export async function listIpmPrograms(filters?: {
  programType?: 'preventative' | 'remedial' | 'custom';
}): Promise<IpmResult<IpmProgram[]>>
```

**Acceptance Criteria**:
- Without filter, returns all (existing behavior)
- With filter, returns only matching type

---

## Phase 4: Testing & Polish (Session 3 continued)

### Task 4.1: Test program suggestions
**Agent**: `tester-tim`
**Estimated**: 20 min

Test matrix:
1. Log "Aphids" issue (medium) - should suggest programs targeting aphids
2. Log "Powdery Mildew" issue (critical) - should suggest fungicide programs
3. Log unknown issue - should fall back to product matching or empty
4. Apply suggested program - verify treatments created correctly

### Task 4.2: Verify complete flow
**Agent**: `task-completion-validator`
**Estimated**: 15 min

End-to-end validation:
1. Create remedial program for "Botrytis" with 2 fungicide products
2. Start scout, log Botrytis (medium)
3. Verify program suggested
4. Apply program
5. Verify spot treatments created with correct dates

---

## Definition of Done

- [ ] Schema: `program_type`, `target_issues`, `target_severity` columns exist
- [ ] Backend: `getSuggestedPrograms` returns relevant programs
- [ ] Backend: `applyProgramAsTreatment` creates linked spot treatments
- [ ] Scout: TreatmentStep shows program suggestions for issues
- [ ] Scout: Users can apply suggested program OR create manual treatment
- [ ] Programs: ProgramWizard supports creating remedial programs
- [ ] Programs: Programs page filters and displays by type
- [ ] Tests: Program suggestion and application flows validated

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/20260204_*.sql` | New | Program categorization schema |
| `src/app/actions/ipm.ts` | Modify | Add getSuggestedPrograms, listIpmPrograms filter |
| `src/app/actions/plant-health.ts` | Modify | Add applyProgramAsTreatment |
| `src/components/plant-health/scout/TreatmentStep.tsx` | Modify | Add suggestions section |
| `src/components/plant-health/scout/ProgramSuggestionCard.tsx` | New | Suggestion display component |
| `src/components/plant-health/ipm/ProgramWizard.tsx` | Modify | Add program type selection |
| `src/app/plant-health/programs/page.tsx` | Modify | Add type filters and badges |
| `src/types/supabase.ts` | Regenerate | After migration |

---

## Estimated Timeline

**Total: 3 sessions**

| Session | Tasks | Duration |
|---------|-------|----------|
| 1 | Phase 1 (Schema + Backend) | ~80 min |
| 2 | Phase 2 (Scout Integration) | ~95 min |
| 3 | Phase 3 + 4 (Program UI + Testing) | ~70 min |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Issue names don't match product target_pests | Medium | Medium | Use case-insensitive partial matching |
| Too many suggestions | Low | Low | Limit to top 3, require minimum score |
| Users confused by two paths | Low | Medium | Clear "Suggested" vs "Manual" sections |
| Migration on existing programs | Low | Low | Default to 'preventative', non-breaking |

---

## Future Enhancements (Deferred)

These were in Plan B but deferred for simplicity:
- [ ] `ipm_program_applications` tracking table for history
- [ ] Program customization before applying
- [ ] Full custom treatment builder (multi-product)
- [ ] Program effectiveness analytics
- [ ] Emergency program type with alerts

---

## Handoff Notes for Jimmy

**DB Work Required**: Yes - single migration for program categorization
**Recommended Mode**: `standard`
**First Agent**: `data-engineer` for migration
**Critical Dependencies**: None

**Execution Order**:
1. `data-engineer` - Migration (Task 1.1)
2. `feature-builder` - Backend actions (Tasks 1.2, 1.3)
3. `verifier` - Check types regenerated
4. `feature-builder` - Scout integration (Tasks 2.1-2.3)
5. `feature-builder` - Program management UI (Tasks 3.1-3.3)
6. `tester-tim` - Validate complete flow (Tasks 4.1-4.2)
7. `karen` - Reality check before completion
