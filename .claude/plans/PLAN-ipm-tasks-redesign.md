# PLAN: IPM Tasks Page Redesign (Streamlined)

**Created**: 2026-02-04
**Status**: In Progress
**Mode**: Thorough

---

## Executive Summary

Redesign the IPM Tasks page to support two distinct user workflows:
1. **Scout** - Creates and assigns spray jobs from grouped tasks
2. **Applicator** - Executes jobs with clear walking routes and simple completion

**Key insight**: Much of the infrastructure already exists. This plan focuses on the **new pieces only**.

---

## What Already Exists ✅

| Component | Location | Notes |
|-----------|----------|-------|
| `ipm_products` table | Migration 20251214100000 | Full product database |
| `ipm_programs` + `ipm_program_steps` | Migration 20251214100000 | Preventative programs |
| `ipm_assignments` | Migration 20251214100000 | Links programs to families/locations |
| `ipm_spot_treatments` | Migration 20251214100000 | Ad-hoc treatments |
| Stock tracking | Migration 20251214200000 | Bottles, movements, status lifecycle |
| Compliance fields | Migration 20251214700000 | weather, sprayer, signed_by, etc. |
| Task grouping logic | `ipm-tasks.ts:getGroupedTasks()` | Groups by product+week+method |
| 3-step completion wizard | `tasks/page.tsx` | Stock → Details → Sign-off |
| Task generation | `ipm-tasks.ts` | generateTasksForBatch, generateTasksForSpotTreatment |
| Execute Production patterns | `production/execution/` | ExecutionGroupCard, GroupFilterBar, selection |

---

## What's Actually Missing ❌

### Database
1. **`ipm_tasks` base table** - Referenced but never created!
2. **`ipm_jobs` table** - Job abstraction for applicator assignment
3. **`job_id` + `group_key`** columns on ipm_tasks

### Server Actions
4. Job management: `createJob()`, `assignJob()`, `startJob()`, `completeJob()`
5. `getJobsForApplicator()` - Jobs assigned to current user

### UI Components
6. **Scout Command Center** - Kanban view for job management
7. **Applicator Dashboard** - "My Jobs" with walking route execution

---

## Phase 1: Database Foundation

### 1.1 Create `ipm_tasks` Table (CRITICAL - currently missing!)

```sql
-- Migration: 20260204200000_ipm_tasks_table.sql

CREATE TABLE IF NOT EXISTS public.ipm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Target
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.nursery_locations(id) ON DELETE SET NULL,

  -- Source (what generated this task)
  program_id UUID REFERENCES public.ipm_programs(id) ON DELETE SET NULL,
  program_step_id UUID REFERENCES public.ipm_program_steps(id) ON DELETE SET NULL,
  spot_treatment_id UUID REFERENCES public.ipm_spot_treatments(id) ON DELETE CASCADE,

  -- Product & Application
  product_id UUID NOT NULL REFERENCES public.ipm_products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  rate NUMERIC,
  rate_unit TEXT,
  method TEXT,

  -- Tank mix support
  is_tank_mix BOOLEAN DEFAULT false,
  tank_mix_group_id UUID,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  week_number INTEGER,
  calendar_week INTEGER NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'overdue', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  skip_reason TEXT,

  -- Stock tracking
  bottle_id UUID REFERENCES public.ipm_product_bottles(id),
  quantity_used_ml INTEGER,
  notes TEXT,

  -- Job link (added in Phase 1.2)
  job_id UUID,
  group_key TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ipm_tasks_org ON public.ipm_tasks(org_id);
CREATE INDEX idx_ipm_tasks_batch ON public.ipm_tasks(batch_id);
CREATE INDEX idx_ipm_tasks_location ON public.ipm_tasks(location_id);
CREATE INDEX idx_ipm_tasks_status ON public.ipm_tasks(org_id, status);
CREATE INDEX idx_ipm_tasks_week ON public.ipm_tasks(org_id, calendar_week, status);
CREATE INDEX idx_ipm_tasks_product ON public.ipm_tasks(product_id);
CREATE INDEX idx_ipm_tasks_scheduled ON public.ipm_tasks(org_id, scheduled_date);

-- RLS
ALTER TABLE public.ipm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org ipm_tasks"
ON public.ipm_tasks FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org ipm_tasks"
ON public.ipm_tasks FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));
```

### 1.2 Create `ipm_jobs` Table

```sql
-- Migration: 20260204200001_ipm_jobs.sql

CREATE TABLE IF NOT EXISTS public.ipm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  group_key TEXT NOT NULL,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  calendar_week INTEGER NOT NULL,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),

  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id),
  scout_notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),

  -- Compliance (job-level)
  weather_conditions TEXT,
  sprayer_used TEXT,
  total_volume_ml INTEGER,
  bottle_id UUID REFERENCES public.ipm_product_bottles(id),
  quantity_used_ml INTEGER,
  signed_by TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One job per group per week
  UNIQUE(org_id, group_key, calendar_week)
);

-- Indexes
CREATE INDEX idx_ipm_jobs_org ON public.ipm_jobs(org_id);
CREATE INDEX idx_ipm_jobs_status ON public.ipm_jobs(org_id, status);
CREATE INDEX idx_ipm_jobs_assigned ON public.ipm_jobs(assigned_to) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX idx_ipm_jobs_week ON public.ipm_jobs(org_id, calendar_week);
CREATE INDEX idx_ipm_jobs_group_key ON public.ipm_jobs(org_id, group_key);

-- RLS
ALTER TABLE public.ipm_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org ipm_jobs"
ON public.ipm_jobs FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org ipm_jobs"
ON public.ipm_jobs FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- Add FK from ipm_tasks to ipm_jobs
ALTER TABLE public.ipm_tasks
ADD CONSTRAINT fk_ipm_tasks_job
FOREIGN KEY (job_id) REFERENCES public.ipm_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_ipm_tasks_job ON public.ipm_tasks(job_id);
CREATE INDEX idx_ipm_tasks_group_key ON public.ipm_tasks(org_id, group_key, calendar_week);

-- Trigger to compute group_key on ipm_tasks
CREATE OR REPLACE FUNCTION compute_ipm_task_group_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tank_mix_group_id IS NOT NULL THEN
    NEW.group_key := 'tankmix:' || NEW.tank_mix_group_id;
  ELSE
    NEW.group_key := 'product:' || NEW.product_id ||
                     '-rate:' || COALESCE(NEW.rate::text, 'default') ||
                     '-method:' || COALESCE(NEW.method, 'spray');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ipm_task_group_key
BEFORE INSERT OR UPDATE OF product_id, rate, method, tank_mix_group_id ON public.ipm_tasks
FOR EACH ROW EXECUTE FUNCTION compute_ipm_task_group_key();
```

---

## Phase 2: Server Actions

Add to existing `src/app/actions/ipm-tasks.ts`:

```typescript
// Types
export type IpmJob = {
  id: string;
  orgId: string;
  name: string;
  groupKey: string;
  scheduledDate: string;
  calendarWeek: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  assignedToName?: string;
  scoutNotes?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  startedAt?: string;
  completedAt?: string;
  // Aggregated from tasks
  taskCount: number;
  locationCount: number;
  locations: { id: string; name: string; taskCount: number }[];
  product: { id: string; name: string; rate?: number; rateUnit?: string };
};

// Server Actions to add:

// 1. createJob(groupKey, scheduledDate, name?) - Create job from task group
// 2. assignJob(jobId, assignedTo, scoutNotes?, priority?) - Assign to applicator
// 3. startJob(jobId) - Mark as in_progress
// 4. completeJob(jobId, complianceData) - Complete with compliance
// 5. getJobsForWeek(calendarWeek) - All jobs for scout view
// 6. getMyJobs() - Jobs assigned to current user
// 7. getJobWithTasks(jobId) - Job detail with all tasks for execution
```

---

## Phase 3: Scout Command Center

### Page Structure

```
/plant-health/tasks/page.tsx
    |
    +-- IpmTasksClient.tsx (Client Component)
            |
            +-- View Toggle: [Scout] [Applicator]
            |
            +-- ScoutCommandCenter.tsx
            |       |
            |       +-- Week selector
            |       +-- Kanban columns: Unassigned | Assigned | In Progress | Done
            |       +-- TaskGroupCard (adapted from ExecutionGroupCard)
            |       +-- CreateJobSheet (slide-over)
            |       +-- AssignJobSheet (slide-over)
            |
            +-- ApplicatorDashboard.tsx (Phase 4)
```

### Key UI Elements

**Scout sees:**
- Week selector (current week ± 2)
- Kanban columns showing job status
- Each card shows: product name, location count, batch count, assigned person
- Click card → slide-over with task details + assign action
- "Create Job" button on unassigned task groups

---

## Phase 4: Applicator Dashboard

### Key UI Elements

**Applicator sees:**
- "My Jobs" list (assigned to them)
- Each job card shows: product, location count, priority badge
- Click "Start" → enters execution mode

**Execution Mode:**
- Walking route: locations grouped, then batches within each
- Location checkoff (tap to mark all batches at location done)
- Mix instructions panel (dilution calculator)
- "Complete Job" button → 2-step wizard

### 2-Step Completion Wizard

**Step 1: Application Summary**
- Weather conditions (text)
- Sprayer used (dropdown from settings)
- Total volume (number)
- Bottle selection + quantity used

**Step 2: Sign Off**
- Summary of what was applied
- Signed by (name)
- Optional notes
- "Complete & Log" button

---

## Component Reuse

| Source | Target | Adaptation |
|--------|--------|------------|
| `ExecutionGroupCard` | `TaskGroupCard` | Change batch→task, add job status |
| `GroupFilterBar` | Reuse directly | Filter by location, product |
| `CreateWorksheetDialog` | `CreateJobSheet` | Create job from selection |
| `PrintWorksheet` | `PrintJobSheet` | Print spray instructions |

---

## File Structure

```
src/app/plant-health/tasks/
├── page.tsx (server component - fetch initial data)
├── IpmTasksClient.tsx (main client with view toggle)
└── components/
    ├── ScoutCommandCenter.tsx
    ├── KanbanColumn.tsx
    ├── TaskGroupCard.tsx
    ├── CreateJobSheet.tsx
    ├── AssignJobSheet.tsx
    ├── ApplicatorDashboard.tsx
    ├── MyJobsList.tsx
    ├── JobExecutionSheet.tsx
    ├── WalkingRoute.tsx
    ├── LocationCheckoff.tsx
    ├── MixInstructions.tsx
    ├── JobCompletionWizard.tsx
    └── PrintJobSheet.tsx
```

---

## Acceptance Criteria

### Scout
- [ ] Can view tasks grouped by product/week
- [ ] Can create jobs from task groups
- [ ] Can assign jobs to applicators
- [ ] Can see job progress in kanban view
- [ ] Can add scout notes and priority

### Applicator
- [ ] Can see "My Jobs" list
- [ ] Can start a job → enters execution mode
- [ ] Can see walking route (locations → batches)
- [ ] Can check off locations
- [ ] Can complete job with 2-step wizard
- [ ] Compliance data captured at job level

### Technical
- [ ] `ipm_tasks` table created with all fields
- [ ] `ipm_jobs` table created with RLS
- [ ] `group_key` computed via trigger
- [ ] No breaking changes to existing task flow
- [ ] SWR for data fetching

---

## Estimated Effort (Revised)

| Phase | Sessions | Focus |
|-------|----------|-------|
| 1. Database | 0.5 | ipm_tasks + ipm_jobs tables |
| 2. Server Actions | 0.5 | Job management actions |
| 3. Scout UI | 1 | Kanban, job creation, assignment |
| 4. Applicator UI | 1 | My jobs, execution, walking route |
| 5. Completion + Polish | 0.5 | 2-step wizard, print |
| **Total** | **3.5** | |

---

## Definition of Done

1. Scout can create, assign, and monitor spray jobs
2. Applicator can execute jobs with clear walking route
3. Compliance data captured at job level
4. Print job worksheets work
5. Existing task completion continues to work
6. All new tables have RLS
7. Mobile-responsive UI
