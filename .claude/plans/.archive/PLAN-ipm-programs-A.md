# PLAN: IPM Programs - Perspective A (MVP Integration)

**Created**: 2026-02-04
**Status**: Draft
**Perspective**: MVP speed - Get program suggestions working in scout flow with minimal changes

---

## Goal

Enable the scout wizard to suggest relevant IPM programs when issues are found, allowing users to apply a pre-configured remedial program instead of manually selecting individual products.

---

## Key Insight

We already have most of the infrastructure:
- `ipm_programs` table with `steps` (products with rates/methods)
- `ipm_products` table with `target_pests` array
- `TreatmentStep.tsx` currently shows single product selection
- `plant_health_issue` attribute options define issue types

**MVP Approach**: Match issue reasons to product target_pests, find programs containing those products, suggest them.

---

## Phase 1: Program Matching Logic (Backend)

### Task 1.1: Add program_type to ipm_programs
**Agent**: `data-engineer`
**File**: New migration

Add a `program_type` enum column to distinguish preventative vs remedial:
```sql
ALTER TABLE ipm_programs
ADD COLUMN program_type text DEFAULT 'preventative'
CHECK (program_type IN ('preventative', 'remedial', 'custom'));

-- Add target_issues array for remedial programs
ALTER TABLE ipm_programs
ADD COLUMN target_issues text[] DEFAULT '{}';
```

**Acceptance**: Migration applies, types generated

### Task 1.2: Create program suggestion function
**Agent**: `feature-builder`
**File**: `src/app/actions/ipm.ts`

Add server action to find matching programs:
```typescript
export async function getSuggestedPrograms(params: {
  issueReason: string;
  severity: 'low' | 'medium' | 'critical';
}): Promise<IpmResult<IpmProgram[]>>
```

Logic:
1. Search for remedial programs where `target_issues` contains the issue
2. Fallback: Find products where `target_pests` matches issue, then find programs using those products
3. Return top 3 matches sorted by relevance

**Acceptance**: Returns matching programs for common issues

---

## Phase 2: Scout Wizard Integration (Frontend)

### Task 2.1: Add program suggestion to TreatmentStep
**Agent**: `feature-builder`
**File**: `src/components/plant-health/scout/TreatmentStep.tsx`

Modify TreatmentStep to:
1. Fetch suggested programs on mount (based on logData.issue)
2. Show "Suggested Program" card at top if matches found
3. User can select program OR continue with manual treatment
4. Show program details (products, schedule, applications)

New UI flow:
```
[Suggested Program Card] - if available
  "Powdery Mildew Protocol" - 3 applications, 7 day intervals
  Products: Fungicide A, Fungicide B (rotation)
  [Apply Program] [Customize] [Skip to Manual]

--- OR ---

[Manual Treatment] - existing UI
```

**Acceptance**: Programs appear when relevant issues logged

### Task 2.2: Apply program creates spot treatment series
**Agent**: `feature-builder`
**File**: `src/app/actions/plant-health.ts`

Add action to apply a program as spot treatment:
```typescript
export async function applyProgramAsTreatment(params: {
  programId: string;
  locationId?: string;
  batchId?: string;
  startDate: string;
  triggeredByLogId?: string;
}): Promise<PlantHealthResult<{ treatmentIds: string[] }>>
```

This creates one `ipm_spot_treatment` per program step, linked together.

**Acceptance**: Program application creates scheduled treatments

---

## Phase 3: Program Management Enhancements

### Task 3.1: Add program type selector to ProgramWizard
**Agent**: `feature-builder`
**File**: `src/components/plant-health/ipm/ProgramWizard.tsx`

Add Step 0 or modify Step 1:
- Radio: Preventative | Remedial
- If Remedial: Show multi-select for target issues (from `plant_health_issue` options)

**Acceptance**: Can create both program types

### Task 3.2: Display program type on Programs page
**Agent**: `feature-builder`
**File**: `src/app/plant-health/programs/page.tsx`

Show badge for program type, filter tabs (All | Preventative | Remedial)

**Acceptance**: Programs page shows and filters by type

---

## Database Changes Summary

```sql
-- Migration: add_program_type_and_targets
ALTER TABLE ipm_programs
ADD COLUMN program_type text DEFAULT 'preventative'
  CHECK (program_type IN ('preventative', 'remedial', 'custom'));

ALTER TABLE ipm_programs
ADD COLUMN target_issues text[] DEFAULT '{}';

CREATE INDEX idx_ipm_programs_type ON ipm_programs(org_id, program_type);
CREATE INDEX idx_ipm_programs_issues ON ipm_programs USING GIN(target_issues);
```

---

## Definition of Done

- [ ] Remedial programs can be created with target issues
- [ ] Scout wizard suggests relevant programs when issue logged
- [ ] User can apply suggested program OR use manual treatment
- [ ] Applied programs create scheduled spot treatments
- [ ] Programs page shows/filters by type

---

## Estimated Sessions

2-3 sessions:
- Session 1: Schema + backend matching logic
- Session 2: Scout wizard integration
- Session 3: Program wizard updates + polish

---

## Risks

| Risk | Mitigation |
|------|------------|
| Issue names don't match product target_pests | Use fuzzy matching or normalize both |
| Too many programs suggested | Limit to top 3, add relevance scoring |
| Users confused by two paths | Clear UI with "Suggested" vs "Manual" sections |

---

## Handoff Notes for Jimmy

**DB Work Required**: Yes - add program_type and target_issues columns
**Recommended Mode**: `standard`
**First Agent**: `data-engineer` for migration
**Critical Dependencies**: None - builds on existing schema
