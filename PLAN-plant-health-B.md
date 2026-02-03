# PLAN: Plant Health Logging Consolidation
## Perspective B: Software Engineer

**Feature**: Streamline plant health logging into a single coherent route
**Perspective**: Software Engineer (data model, code architecture, maintainability)
**Status**: Draft
**Created**: 2026-02-03

---

## Current Technical State

### Database Schema (`plant_health_logs`)

```sql
-- Current event types
create type public.health_event_type as enum (
  'scout_flag',    -- Issue/problem observed
  'treatment',     -- IPM/pest treatment applied
  'measurement',   -- EC/pH/readings
  'clearance'      -- Location cleared / maintenance
);

-- Main table structure
plant_health_logs (
  id uuid primary key,
  org_id uuid not null,
  batch_id uuid,           -- Can be batch-level
  location_id uuid,        -- Can be location-level
  event_type health_event_type,
  event_at timestamptz,
  recorded_by uuid,
  title text,
  notes text,

  -- Polymorphic fields (used based on event_type)
  product_name text,       -- treatment/fertilizer
  rate numeric,            -- treatment/fertilizer
  unit text,               -- treatment/fertilizer
  method text,             -- treatment/fertilizer/irrigation
  ec_reading numeric,      -- measurement
  ph_reading numeric,      -- measurement
  issue_reason text,       -- scout_flag
  severity text,           -- scout_flag
  photo_url text,          -- any
  ...
)
```

### Current Code Architecture

**Two Parallel Entry Points**:

1. **AddHealthLogDialog** (`src/components/plant-health/AddHealthLogDialog.tsx`)
   - Batch-level logging
   - Event types: treatment, fertilizer, irrigation, pruning, grading, measurement
   - Calls `logBatchHealthEvent()` action

2. **ScoutWizard** (`src/components/plant-health/scout/ScoutWizard.tsx`)
   - Location-level logging (with batch selection)
   - Log types: issue, reading
   - Multi-step wizard: Scan -> Log -> Treatment
   - Calls `createScoutLog()` action

**Backend Actions**:
- `batch-health.ts`: `logBatchHealthEvent()` - batch-centric
- `plant-health.ts`: `createScoutLog()`, `logMeasurement()`, `flagLocation()` - location-centric

### Problems from Engineering Perspective

1. **Duplicated Concepts**: "measurement" exists in both systems
2. **Inconsistent APIs**: Different actions for similar operations
3. **Polymorphic Overload**: `plant_health_logs` has many nullable fields
4. **Navigation Complexity**: Two routes for overlapping functionality
5. **Type Confusion**: UI types don't match DB enum

---

## Proposed Architecture

### Option 1: Unified Log Type with Category

**Concept**: Single `LogHealthEventDialog` with two modes:

```typescript
type HealthLogCategory = 'action' | 'observation';

type HealthLogType =
  // Actions (things done to crop)
  | 'treatment'
  | 'fertilizer'
  | 'irrigation'
  | 'pruning'
  | 'grading'
  // Observations (things recorded about crop)
  | 'issue'
  | 'reading'
  | 'measurement';

interface HealthLogInput {
  category: HealthLogCategory;
  type: HealthLogType;
  targetType: 'batch' | 'location';
  batchId?: string;
  locationId?: string;
  // ... type-specific fields
}
```

**Pros**:
- Single source of truth for logging
- Cleaner type hierarchy
- Easy to add new types

**Cons**:
- Large form component
- Migration of existing UI

### Option 2: Separate Forms, Unified Backend (Recommended)

**Concept**: Keep separate UI forms but consolidate backend and data model

```
UI Layer:
  CareActionForm      (treatment, fertilizer, irrigation, pruning, grading)
  ScoutObservationForm (issue, reading, measurement)

Service Layer:
  logPlantHealthEvent(input: PlantHealthInput): Promise<Result>

Database:
  plant_health_logs (unchanged schema, cleaner usage)
```

**Pros**:
- Smaller, focused components
- Matches user mental model
- Minimal backend changes
- Easier to maintain

**Cons**:
- Two forms to maintain
- Shared field validation duplicated

---

## Recommended Technical Approach

### Phase 1: Consolidate Backend (P0)

**Goal**: Single server action that handles all plant health logging

**File**: `src/app/actions/plant-health-unified.ts`

```typescript
// Unified input types
export type ActionType = 'treatment' | 'fertilizer' | 'irrigation' | 'pruning' | 'grading';
export type ObservationType = 'issue' | 'reading' | 'measurement';

export type PlantHealthLogInput = {
  category: 'action' | 'observation';
  type: ActionType | ObservationType;
  target: {
    type: 'batch' | 'location' | 'both';
    batchId?: string;
    locationId?: string;
  };
  // Common fields
  notes?: string;
  photoUrl?: string;
  eventAt?: string;
  // Type-specific fields (discriminated union)
} & (
  | TreatmentFields
  | FertilizerFields
  | IrrigationFields
  | PruningFields
  | GradingFields
  | IssueFields
  | ReadingFields
);

// Single action
export async function logPlantHealth(
  input: PlantHealthLogInput
): Promise<PlantHealthResult<{ logId: string }>> {
  // Validate, normalize, insert
}
```

**Benefits**:
- Remove duplication between `batch-health.ts` and `plant-health.ts`
- Consistent error handling
- Single point for audit logging
- Type-safe discriminated unions

### Phase 2: UI Component Refactor (P1)

**Goal**: Two focused form components replacing current three

**Components**:

1. **CareActionDialog** (replaces AddHealthLogDialog)
   - Path: `src/components/plant-health/CareActionDialog.tsx`
   - Event types: treatment, fertilizer, irrigation, pruning, grading
   - Removes: measurement (moved to observations)

2. **ObservationDialog** (replaces/enhances ScoutLogStep)
   - Path: `src/components/plant-health/ObservationDialog.tsx`
   - Log types: issue, reading (EC/pH/moisture), measurement (growth)
   - Can be used standalone or within ScoutWizard

**Shared Components**:
```
src/components/plant-health/
  shared/
    ProductSelector.tsx      (treatment, fertilizer)
    RateInput.tsx           (treatment, fertilizer)
    ReadingInputs.tsx       (EC, pH, moisture)
    SeveritySelector.tsx    (issues)
    PhotoCapture.tsx        (all)
    NotesField.tsx          (all)
```

### Phase 3: Database Normalization (P2 - Optional)

**Goal**: Cleaner data model if table grows too large

**Option A: Add category column**
```sql
ALTER TABLE plant_health_logs
ADD COLUMN category text CHECK (category IN ('action', 'observation'));

-- Backfill
UPDATE plant_health_logs
SET category = CASE
  WHEN event_type IN ('treatment', 'clearance') THEN 'action'
  WHEN event_type IN ('scout_flag', 'measurement') THEN 'observation'
END;
```

**Option B: Split tables (more invasive)**
```sql
-- plant_health_actions (treatment, fertilizer, irrigation, pruning, grading)
-- plant_health_observations (issue, reading, measurement)
-- Unified view for history display
```

**Recommendation**: Start with Option A (category column). Only split if query performance degrades with scale.

---

## Migration Strategy

### Step 1: Deprecation Path for Old Actions

```typescript
// In batch-health.ts
/**
 * @deprecated Use logPlantHealth() from plant-health-unified.ts
 * This function will be removed in next release.
 */
export async function logBatchHealthEvent(input: BatchHealthEventInput) {
  console.warn('logBatchHealthEvent is deprecated. Use logPlantHealth instead.');
  // Forward to new action for backward compatibility
  return logPlantHealth(convertToNewFormat(input));
}
```

### Step 2: UI Migration

1. Create new `CareActionDialog` and `ObservationDialog`
2. Update `BatchDetailDialog` to use new components
3. Update `PlantHealthCard` to use new components
4. Update Scout wizard to use `ObservationDialog` internally
5. Remove old `AddHealthLogDialog`

### Step 3: Route Consolidation

Current routes:
```
/plant-health              (dashboard)
/plant-health/scout        (scout wizard)
/plant-health/history      (log history)
/plant-health/tasks        (IPM tasks)
/plant-health/products     (IPM products)
/plant-health/programs     (IPM programs)
/plant-health/trials       (trials)
```

Proposed routes (minimal change):
```
/plant-health              (dashboard - add quick action buttons)
/plant-health/scout        (scout wizard - enhanced)
/plant-health/actions      (NEW - quick action logging page, optional)
/plant-health/history      (unified history with filters)
/plant-health/tasks        (unchanged)
/plant-health/products     (unchanged)
/plant-health/programs     (unchanged)
/plant-health/trials       (unchanged)
```

---

## Technical Tasks

### Phase 1: Backend Consolidation (~1 session)

| Task | File | Change |
|------|------|--------|
| 1.1 | `src/app/actions/plant-health-unified.ts` | Create unified action with types |
| 1.2 | `src/app/actions/batch-health.ts` | Add deprecation, forward to unified |
| 1.3 | `src/app/actions/plant-health.ts` | Add deprecation for overlapping functions |
| 1.4 | Tests | Add tests for unified action |

### Phase 2: UI Components (~2 sessions)

| Task | File | Change |
|------|------|--------|
| 2.1 | `src/components/plant-health/CareActionDialog.tsx` | New component |
| 2.2 | `src/components/plant-health/ObservationDialog.tsx` | New component |
| 2.3 | `src/components/plant-health/shared/` | Extract shared components |
| 2.4 | `src/components/batch-detail-dialog.tsx` | Update to use new dialogs |
| 2.5 | `src/components/plant-health/scout/ScoutWizard.tsx` | Integrate ObservationDialog |

### Phase 3: Navigation & History (~1 session)

| Task | File | Change |
|------|------|--------|
| 3.1 | `src/config/nav.ts` | Update labels/structure |
| 3.2 | `src/app/plant-health/history/` | Add category filter |
| 3.3 | `src/components/history/PlantHealthLog.tsx` | Add category badges |

### Phase 4: Cleanup (~0.5 session)

| Task | File | Change |
|------|------|--------|
| 4.1 | Remove deprecated `AddHealthLogDialog` | Delete |
| 4.2 | Remove forwarding from old actions | Cleanup |
| 4.3 | Update all imports | Codemod |

---

## Type Definitions

```typescript
// src/types/plant-health.ts

export type HealthCategory = 'action' | 'observation';

export type ActionType =
  | 'treatment'
  | 'fertilizer'
  | 'irrigation'
  | 'pruning'
  | 'grading';

export type ObservationType =
  | 'issue'
  | 'reading'
  | 'measurement';

export type HealthEventType = ActionType | ObservationType;

// Maps to database enum (for clarity)
export const DB_EVENT_TYPE_MAP: Record<HealthEventType, string> = {
  treatment: 'treatment',
  fertilizer: 'treatment',  // stored as treatment with product_name
  irrigation: 'treatment',  // stored as treatment with method='irrigation'
  pruning: 'clearance',     // stored as clearance
  grading: 'clearance',     // stored as clearance
  issue: 'scout_flag',
  reading: 'measurement',
  measurement: 'measurement',
};

export const CATEGORY_FOR_TYPE: Record<HealthEventType, HealthCategory> = {
  treatment: 'action',
  fertilizer: 'action',
  irrigation: 'action',
  pruning: 'action',
  grading: 'action',
  issue: 'observation',
  reading: 'observation',
  measurement: 'observation',
};
```

---

## API Design

### Unified Action Endpoint

```typescript
// POST /api/plant-health/log
// Body: PlantHealthLogInput

// Response:
{
  success: true,
  data: {
    logId: string,
    category: 'action' | 'observation',
    type: string,
    eventAt: string
  }
}
```

### History Query Endpoint

```typescript
// GET /api/plant-health/history
// Query params:
//   - batchId?: string
//   - locationId?: string
//   - category?: 'action' | 'observation'
//   - type?: string[]
//   - from?: string (ISO date)
//   - to?: string (ISO date)
//   - limit?: number
//   - offset?: number

// Response:
{
  success: true,
  data: {
    logs: PlantHealthLog[],
    total: number,
    summary: {
      actions: number,
      observations: number,
      byType: Record<string, number>
    }
  }
}
```

---

## Testing Strategy

### Unit Tests
- `plant-health-unified.test.ts`: Action validation, type mapping
- `CareActionDialog.test.tsx`: Form submission, validation
- `ObservationDialog.test.tsx`: Form submission, validation

### Integration Tests
- Create action -> verify in history
- Create observation -> verify in history
- Scout wizard flow -> verify both observation and scheduled action

### E2E Tests (if applicable)
- Batch detail dialog: Log care action, log observation
- Scout mode: Complete full wizard flow
- History page: Filter by category

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing action calls | Medium | High | Deprecation warnings + forwarding |
| UI regression | Medium | Medium | Comprehensive tests |
| Data migration issues | Low | High | No schema changes in Phase 1-2 |
| User confusion during transition | Low | Low | Clear documentation |

---

## Definition of Done

- [ ] Unified `logPlantHealth()` action handles all log types
- [ ] `CareActionDialog` replaces old AddHealthLogDialog
- [ ] `ObservationDialog` integrates with ScoutWizard
- [ ] "Measurement" no longer appears in care actions
- [ ] "Reading" in scout includes EC/pH
- [ ] History page shows category filter
- [ ] All existing tests pass
- [ ] New tests cover unified action
- [ ] No console deprecation warnings from new code

---

## Estimated Effort

| Phase | Sessions | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend | 1 | None |
| Phase 2: UI | 2 | Phase 1 |
| Phase 3: Navigation | 1 | Phase 2 |
| Phase 4: Cleanup | 0.5 | Phase 3 |

**Total**: ~4.5 sessions

---

## Summary

This plan prioritizes **code maintainability and type safety** while achieving the user-facing goals:

1. **Unified backend action**: Single source of truth for logging
2. **Two focused UI components**: CareActionDialog, ObservationDialog
3. **Clear type hierarchy**: Actions vs Observations with proper mappings
4. **Minimal database changes**: Use existing schema with clearer conventions
5. **Deprecation path**: Backward compatible migration

The architecture goal is that any engineer can answer: "Where do I add a new log type?" with confidence: **Add to `plant-health-unified.ts` types, implement fields in the appropriate dialog.**

---

*Plan created from Software Engineer perspective - focusing on data model, code architecture, and maintainability.*
