# PLAN: IPM Tasks Page Redesign - Perspective A (Applicator UX)

**Created**: 2026-02-04
**Status**: Draft
**Perspective**: Applicator UX - Optimizing for the person walking around with a sprayer

---

## Core Philosophy

The applicator is the primary user of this page. They have:
- One sprayer with one mix in the tank
- Limited time and cognitive load
- Need to physically navigate the nursery efficiently
- Must not make mistakes (wrong product, wrong rate, wrong location)

**Design Principle**: Make it impossible to get lost or confused.

---

## Key User Journey

```
Applicator arrives at work
       |
       v
Opens IPM Tasks page
       |
       v
Sees TODAY'S APPLICATION JOBS (not raw tasks)
       |
       v
Selects a job (e.g., "Foliage Feed - Week 6")
       |
       v
Sees WALKING ROUTE with clear location list
       |
       v
Completes job, signs off
       |
       v
Next job or done for day
```

---

## Proposed UI Structure

### 1. Application Jobs Dashboard (Main View)

Replace the current product/week grouping with **Application Jobs**:

```
+---------------------------------------------------------------+
| IPM APPLICATION JOBS                                    Today |
+---------------------------------------------------------------+
| Filter: [All Jobs v] [This Week v] [My Assignments v]         |
+---------------------------------------------------------------+
|                                                               |
| +-----------------------------------------------------------+ |
| | JOB: Foliage Feed Application                             | |
| | Week 6 - Due: Monday 4 Feb                                | |
| +-----------------------------------------------------------+ |
| | Product: Foliage Feed Pro                                 | |
| | Rate: 2.5 ml/L                                            | |
| | Method: Spray                                             | |
| | Locations: 5 tunnels | 23 batches | ~4,500 plants         | |
| |                                                           | |
| | [          START APPLICATION          ]                   | |
| +-----------------------------------------------------------+ |
|                                                               |
| +-----------------------------------------------------------+ |
| | JOB: Tank Mix - Fungicide + Insecticide                   | |
| | Week 6 - Due: Tuesday 5 Feb                               | |
| +-----------------------------------------------------------+ |
| | Products:                                                 | |
| |   - Product A @ 1.2 ml/L                                  | |
| |   - Product B @ 0.8 ml/L                                  | |
| | Method: High volume spray                                 | |
| | Locations: 3 tunnels | 15 batches | ~2,100 plants         | |
| |                                                           | |
| | [          START APPLICATION          ]                   | |
| +-----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

### 2. Active Application View (Walking Route)

When "START APPLICATION" is clicked:

```
+---------------------------------------------------------------+
| ACTIVE: Foliage Feed Application                    [X Close] |
+---------------------------------------------------------------+
| MIX INSTRUCTIONS                                              |
+---------------------------------------------------------------+
| Product: Foliage Feed Pro (PCS #12345)                        |
| Rate: 2.5 ml/L                                                |
| Total spray required: ~150L (estimate)                        |
|                                                               |
| For a 20L backpack: Add 50ml product                          |
+---------------------------------------------------------------+
|                                                               |
| WALKING ROUTE (Most efficient order)                          |
+---------------------------------------------------------------+
|                                                               |
| 1. Tunnel 4A - North End                         [  ] Done    |
|    - Petunias (Batch #2024-001) - 200 plants                  |
|    - Begonias (Batch #2024-002) - 150 plants                  |
|                                                               |
| 2. Tunnel 4B - South End                         [  ] Done    |
|    - Mixed bedding (3 batches) - 450 plants                   |
|                                                               |
| 3. Tunnel 5A                                     [  ] Done    |
|    - Geraniums (Batch #2024-005) - 300 plants                 |
|                                                               |
| ... (grouped by physical proximity)                           |
+---------------------------------------------------------------+
| Progress: 0/5 locations | [COMPLETE ALL & SIGN OFF]           |
+---------------------------------------------------------------+
```

### 3. Completion & Sign-off (Streamlined)

```
+---------------------------------------------------------------+
| SIGN OFF APPLICATION                                          |
+---------------------------------------------------------------+
| [Pre-filled summary of what was done]                         |
|                                                               |
| Weather: [Dry, 12C, Light wind    ]                           |
| Sprayer Used: [Backpack 20L   v]                              |
| Total Volume Used: [150] L                                    |
| Stock Used: [Bottle #BTL-001 v] (optional)                    |
|                                                               |
| Signed by: [John Smith          ]                             |
|                                                               |
| [                  COMPLETE APPLICATION                     ] |
+---------------------------------------------------------------+
```

---

## Data Model Changes

### New: `ipm_application_jobs` Table

```sql
CREATE TABLE ipm_application_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  calendar_week INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed

  -- Job configuration (can merge tasks from adjacent days)
  merge_window_days INTEGER DEFAULT 0, -- 0 = strict day, 1 = +/-1 day flexibility

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),

  -- Completion data
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  weather_conditions TEXT,
  sprayer_used TEXT,
  total_volume_ml INTEGER,
  signed_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ipm_application_job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ipm_application_jobs(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES ipm_tasks(id),
  sort_order INTEGER DEFAULT 0, -- for walking route
  completed_at TIMESTAMPTZ,

  UNIQUE(job_id, task_id)
);
```

---

## Implementation Phases

### Phase 1: Job Compilation Layer (Backend)

1. Create server action to compile tasks into jobs:
   - Group by: product (or tank mix group), calendar week, method, rate
   - Support merging adjacent days
   - Calculate walking route (optimize by location proximity)

2. Create job CRUD operations:
   - `createJobFromTasks(taskIds[], options)`
   - `getJobsForWeek(weekNumber)`
   - `startJob(jobId)`
   - `completeJobLocation(jobId, locationId)`
   - `completeJob(jobId, completionData)`

### Phase 2: Job Dashboard UI

1. Replace current tasks page with jobs view
2. Show pending jobs grouped by urgency (overdue, today, this week)
3. Clear visual hierarchy: Job name > Products > Locations summary

### Phase 3: Active Application View

1. Full-screen mode for active job
2. Walking route with location grouping
3. Check-off locations as completed
4. Large touch targets for mobile/tablet use

### Phase 4: Completion Flow

1. Streamlined sign-off wizard (1-2 steps max)
2. Auto-populate what we can (products, batches affected)
3. Smart defaults for weather (fetch from API?)
4. Minimal required fields

---

## Key UX Principles

1. **Jobs, not Tasks**: User thinks in "applications" not individual batch treatments
2. **Walking Route**: Group by physical location, suggest efficient path
3. **Mix Calculator**: Show dilution math for different sprayer sizes
4. **Big Touch Targets**: Works on tablet in the field
5. **Offline Support** (future): Job can be downloaded, synced when back online

---

## Trade-offs

| Advantage | Trade-off |
|-----------|-----------|
| Much simpler for applicator | More complex data model |
| Clear walking route | Requires location coordinates for optimization |
| Grouped completions | Scout loses granular task control |
| Merge-day flexibility | Could get confusing if overused |

---

## Metrics for Success

- Time to complete daily spraying reduced by 30%
- Zero "wrong product applied" errors
- Applicator satisfaction score 4.5/5

---

## Open Questions

1. Should jobs be auto-generated or manually created by scout?
2. How to handle partial completions (some locations done, not all)?
3. Mobile app vs responsive web for field use?
