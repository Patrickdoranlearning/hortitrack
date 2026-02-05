# PLAN: IPM Tasks Page Redesign - Perspective C (Software Architecture)

**Created**: 2026-02-04
**Status**: Draft
**Perspective**: Software Architecture - Optimizing for maintainability, performance, and extensibility

---

## Core Philosophy

Build on proven patterns (Execute Production page) while minimizing:
- New database tables
- Complex state management
- Breaking changes to existing flows
- Technical debt

**Design Principle**: Compose existing primitives; add minimal new infrastructure.

---

## Architecture Analysis

### Current State

```
ipm_tasks (existing)
    |
    +-- Grouped by product + week + method in getGroupedTasks()
    |
    +-- Displayed as cards in UI
    |
    +-- Completed individually or in groups
```

### Execute Production Pattern (Reference)

```
ExecutionGroup (persisted config)
    |
    +-- FilterCriteria (JSON) - defines what batches belong
    |
    +-- Batches matched dynamically via client-side filtering
    |
    +-- Worksheet (saved batch selection)
    |
    +-- PrintWorksheet (print view)
```

### Key Insight

The Execute Production page does NOT store batch assignments in a junction table. It stores **filter criteria** and evaluates them at runtime. This is simpler and more flexible.

---

## Proposed Architecture

### Option 1: Follow Execute Pattern Exactly

**Application Groups** = saved filter configurations for IPM tasks

```typescript
type IpmApplicationGroup = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;

  // Filter criteria - defines what tasks belong to this group
  filterCriteria: {
    productIds?: string[];
    calendarWeeks?: number[];
    methods?: string[];
    statuses?: ('pending' | 'overdue')[];
    locationIds?: string[];
  };

  // Display options
  groupBy: 'location' | 'batch' | 'product';
  sortBy: 'location' | 'scheduledDate' | 'batchNumber';
};
```

**Advantages**:
- No new junction tables
- Dynamic grouping (tasks appear/disappear as status changes)
- Reuses proven patterns
- Easy to create custom views

**Disadvantages**:
- No explicit "job" assignment tracking
- Can't track partial completion of a "job"
- Less suitable for applicator workflow

### Option 2: Lightweight Job Layer

Add minimal job tracking on top of existing tasks:

```typescript
type IpmJob = {
  id: string;
  orgId: string;
  name: string;
  scheduledDate: string;
  calendarWeek: number;
  status: 'pending' | 'in_progress' | 'completed';

  // Grouping key (computed, not stored per-task)
  groupKey: string; // e.g., "product:abc123-week:6-rate:2.5"

  // Execution tracking
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;

  // Compliance (job-level, not per-task)
  weatherConditions?: string;
  sprayerUsed?: string;
  totalVolumeMl?: number;
  signedBy?: string;
  notes?: string;
};
```

**No junction table** - tasks belong to a job via their `groupKey` matching the job's `groupKey`.

**Advantages**:
- Very lightweight (1 new table)
- Jobs are "views" over tasks, not duplicates
- Compliance data captured once per job, not per task
- Easy to understand

**Disadvantages**:
- Can't have different tasks in same group in different jobs
- GroupKey logic must be consistent

### Option 3: Full Job-Task Junction (Most Complex)

As described in Perspective A. Full many-to-many relationship.

**Skip this** - too complex for the benefit.

---

## Recommended Approach: Hybrid

Combine the best of Options 1 and 2:

### 1. Application Groups (Display Configuration)

Like Execute Production - saved filter configurations for viewing tasks:

```sql
CREATE TABLE ipm_application_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  filter_criteria JSONB NOT NULL DEFAULT '{}',
  display_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

This gives scouts the "Command Center" view with customizable columns.

### 2. Jobs (Execution Tracking)

Lightweight job records for tracking execution:

```sql
CREATE TABLE ipm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  group_key TEXT NOT NULL, -- Links to tasks via computed key

  scheduled_date DATE NOT NULL,
  calendar_week INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES profiles(id),
  scout_notes TEXT,
  priority TEXT DEFAULT 'normal',

  -- Execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),

  -- Compliance (job-level)
  weather_conditions TEXT,
  sprayer_used TEXT,
  total_volume_ml INTEGER,
  bottle_id UUID REFERENCES ipm_bottles(id),
  signed_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(org_id, group_key, calendar_week)
);

-- Index for finding jobs by group key
CREATE INDEX idx_ipm_jobs_group_key ON ipm_jobs(org_id, group_key);
```

### 3. Group Key Generation

The `group_key` is computed from task properties:

```typescript
function computeGroupKey(task: IpmTask): string {
  if (task.tankMixGroupId) {
    return `tankmix:${task.tankMixGroupId}`;
  }
  return `product:${task.productId}-rate:${task.rate}-method:${task.method || 'default'}`;
}
```

Tasks and jobs share the same group key, creating an implicit relationship.

### 4. Enhanced Task Status

Add job reference to tasks without junction table:

```sql
ALTER TABLE ipm_tasks
ADD COLUMN job_id UUID REFERENCES ipm_jobs(id),
ADD COLUMN location_completed_at TIMESTAMPTZ; -- Track per-location completion
```

When a job is created, matching tasks get `job_id` set.
When tasks are completed, the job checks if all tasks are done.

---

## Component Architecture

### Page Structure (Following Execute Pattern)

```
/plant-health/tasks/page.tsx (Server)
    |
    +-- IpmTasksClient.tsx (Client)
            |
            +-- IpmTasksDashboard.tsx
            |       |
            |       +-- IpmGroupCard.tsx (like ExecutionGroupCard)
            |       +-- IpmTaskList.tsx
            |       +-- GroupFilterBar.tsx (reuse)
            |
            +-- IpmJobSheet.tsx (Slide-over for job details)
            |       |
            |       +-- JobLocationList.tsx (walking route)
            |       +-- JobCompletionForm.tsx
            |
            +-- CreateJobDialog.tsx
            +-- PrintJobWorksheet.tsx (reuse PrintWorksheet pattern)
```

### State Management

Use SWR like Execute Production:

```typescript
// In IpmTasksClient.tsx
const { data: groups } = useSWR('/api/ipm/groups', groupsFetcher);
const { data: tasks } = useSWR('/api/ipm/tasks', tasksFetcher);
const { data: jobs } = useSWR('/api/ipm/jobs', jobsFetcher);

// Client-side filtering (fast, no round trips)
const tasksForGroup = filterTasksForGroup(tasks, group.filterCriteria);
```

### API Routes

```
GET  /api/ipm/groups         - List application groups
POST /api/ipm/groups         - Create group
PUT  /api/ipm/groups/[id]    - Update group
DEL  /api/ipm/groups/[id]    - Delete group

GET  /api/ipm/jobs           - List jobs (with task counts)
POST /api/ipm/jobs           - Create job from task group
PUT  /api/ipm/jobs/[id]      - Update job (assign, start, complete)
POST /api/ipm/jobs/[id]/complete - Complete job with compliance data

GET  /api/ipm/tasks          - List tasks (existing, enhanced)
POST /api/ipm/tasks/complete - Complete tasks (existing)
```

---

## Implementation Phases

### Phase 1: Foundation (1 session)

1. Create database migrations:
   - `ipm_application_groups` table
   - `ipm_jobs` table
   - Add `job_id` to `ipm_tasks`

2. Create server functions:
   - `getApplicationGroups()`
   - `createApplicationGroup()`
   - `computeGroupKey()`

### Phase 2: Group-Based View (1 session)

1. New client component: `IpmTasksDashboard.tsx`
2. Port `ExecutionGroupCard` pattern to `IpmGroupCard`
3. Inline filtering with `GroupFilterBar`
4. Task list within groups

### Phase 3: Job Creation & Assignment (1 session)

1. `CreateJobDialog.tsx`
2. Server action: `createJobFromGroup()`
3. Job assignment UI
4. Jobs column in dashboard

### Phase 4: Job Execution View (1 session)

1. `IpmJobSheet.tsx` - Slide-over for active job
2. Location-grouped task list (walking route)
3. Per-location completion checkboxes
4. Real-time progress tracking

### Phase 5: Completion & Compliance (1 session)

1. `JobCompletionForm.tsx`
2. Batch completion of tasks via job
3. Compliance data capture (job-level)
4. Plant health log creation

### Phase 6: Print & Polish (0.5 session)

1. `PrintJobWorksheet.tsx`
2. Mobile-responsive refinements
3. Keyboard shortcuts
4. Empty states

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Junction table | No | GroupKey approach is simpler |
| Task status source | ipm_tasks | Single source of truth |
| Compliance data | Job-level | Reduce redundancy |
| Client filtering | Yes | Fast, no server round trips |
| State management | SWR | Proven in Execute Production |
| Walking route | Client-side | Sort by location name (future: coordinates) |

---

## Migration Strategy

1. **Non-breaking**: New tables and columns only
2. **Backward compatible**: Existing task completion still works
3. **Incremental adoption**: Groups/Jobs are optional
4. **Data preservation**: No existing data modified

---

## Performance Considerations

1. **Index on group_key**: Fast job-task association
2. **Denormalized counts**: Cache task counts on jobs
3. **Client-side filtering**: Avoid N+1 queries
4. **Optimistic updates**: Fast UI feedback

---

## Testing Strategy

1. Unit tests for `computeGroupKey()`
2. Integration tests for job creation/completion
3. E2E tests for scout and applicator workflows
4. Manual testing of print worksheets

---

## Estimated Effort

| Phase | Sessions | Complexity |
|-------|----------|------------|
| Foundation | 1 | Low |
| Group View | 1 | Medium |
| Job CRUD | 1 | Medium |
| Execution View | 1 | Medium |
| Completion | 1 | Medium |
| Polish | 0.5 | Low |
| **Total** | **5.5** | - |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Group key collisions | Low | Include all differentiating fields |
| Performance with many tasks | Medium | Pagination, virtual scrolling |
| Offline support complexity | High | Defer to future phase |
| Mobile UX challenges | Medium | Test early on real devices |
