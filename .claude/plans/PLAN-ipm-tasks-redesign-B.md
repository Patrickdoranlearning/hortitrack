# PLAN: IPM Tasks Page Redesign - Perspective B (Scout Workflow)

**Created**: 2026-02-04
**Status**: Draft
**Perspective**: Scout Workflow - Optimizing for the person who creates and assigns work

---

## Core Philosophy

The scout is the tactical coordinator. They:
- Walk the nursery identifying issues
- Decide what needs treating and when
- Assign work to applicators
- Need visibility into what's pending, assigned, and completed
- Must maintain compliance records

**Design Principle**: Give scouts control and visibility without micromanagement burden.

---

## Key User Journey

```
Scout walks nursery daily
       |
       v
Identifies issues or sees scheduled treatments due
       |
       v
Reviews pending tasks on IPM page
       |
       v
Groups tasks into Application Jobs
       |
       v
Assigns jobs to applicators
       |
       v
Monitors progress throughout day
       |
       v
Reviews completed work, verifies compliance
```

---

## Proposed UI Structure

### 1. Scout Command Center (Main View)

A Kanban-style board showing work status:

```
+---------------------------------------------------------------+
| IPM COMMAND CENTER                          [+ Create Job]    |
+---------------------------------------------------------------+
| View: [Scout View v]  Week: [Week 6 v]  [Generate This Week]  |
+---------------------------------------------------------------+
|                                                               |
| UNASSIGNED          | ASSIGNED           | IN PROGRESS       | COMPLETED |
| (12 tasks)          | (8 tasks)          | (1 job)           | (5 jobs)  |
+---------------------|--------------------|--------------------|-----------|
|                     |                    |                    |           |
| +---------------+   | +---------------+  | +---------------+  | [...]     |
| | Foliage Feed  |   | | Fungicide Mix |  | | Insecticide   |  |           |
| | Week 6        |   | | Week 6        |  | | Tunnel 4      |  |           |
| | 5 tunnels     |   | | -> John S.    |  | | -> Mary K.    |  |           |
| | 23 batches    |   | | Due: Today    |  | | 50% done      |  |           |
| |               |   | +---------------+  | +---------------+  |           |
| | [Create Job]  |   |                    |                    |           |
| +---------------+   | +---------------+  |                    |           |
|                     | | Spot Treat    |  |                    |           |
| +---------------+   | | Aphids T7     |  |                    |           |
| | Tank Mix      |   | | -> John S.    |  |                    |           |
| | Fung + Insect |   | | Due: Tomorrow |  |                    |           |
| | Week 6        |   | +---------------+  |                    |           |
| | 3 tunnels     |   |                    |                    |           |
| | 15 batches    |   |                    |                    |           |
| |               |   |                    |                    |           |
| | [Create Job]  |   |                    |                    |           |
| +---------------+   |                    |                    |           |
+---------------------|--------------------|--------------------|-----------|
```

### 2. Job Creation Dialog

When scout clicks "Create Job" or selects tasks:

```
+---------------------------------------------------------------+
| CREATE APPLICATION JOB                                        |
+---------------------------------------------------------------+
| Job Name: [Foliage Feed - Tunnels 4-5, Week 6              ]  |
|                                                               |
| INCLUDED TASKS                                                |
| +-----------------------------------------------------------+ |
| | [x] Foliage Feed - Tunnel 4A - 5 batches                  | |
| | [x] Foliage Feed - Tunnel 4B - 3 batches                  | |
| | [x] Foliage Feed - Tunnel 5A - 8 batches                  | |
| | [ ] Foliage Feed - Tunnel 5B - 7 batches (different rate) | |
| +-----------------------------------------------------------+ |
|                                                               |
| SCHEDULING                                                    |
| Due Date: [2026-02-04  ] [Can merge +/- [1] days]             |
| Assign To: [John Smith v] (optional)                          |
|                                                               |
| NOTES FOR APPLICATOR                                          |
| [Focus on undersides of leaves in T4A                      ]  |
|                                                               |
| [Cancel]                              [Create Job]            |
+---------------------------------------------------------------+
```

### 3. Task List View (Drill-down)

Scouts can still see individual tasks:

```
+---------------------------------------------------------------+
| TASK DETAILS                                    [Back to Jobs]|
+---------------------------------------------------------------+
| Product: Foliage Feed Pro                                     |
| Week: 6 | Due: Monday 4 Feb                                   |
+---------------------------------------------------------------+
|                                                               |
| BATCHES REQUIRING TREATMENT                                   |
| +-----------------------------------------------------------+ |
| | [x] | Batch #2024-001 | Petunias | Tunnel 4A | 200 plants | |
| | [x] | Batch #2024-002 | Begonias | Tunnel 4A | 150 plants | |
| | [x] | Batch #2024-003 | Mixed    | Tunnel 4B | 100 plants | |
| | ...                                                       | |
| +-----------------------------------------------------------+ |
|                                                               |
| ACTIONS                                                       |
| [Skip Selected] [Add to Existing Job v] [Create New Job]      |
+---------------------------------------------------------------+
```

### 4. Progress Monitoring Panel

Real-time view of today's work:

```
+---------------------------------------------------------------+
| TODAY'S PROGRESS                               [Refresh]      |
+---------------------------------------------------------------+
|                                                               |
| +-----------------------------------------------------------+ |
| | [===75%===    ] Insecticide Application - Mary K.         | |
| | 3/4 locations done | Started 09:15                        | |
| +-----------------------------------------------------------+ |
|                                                               |
| +-----------------------------------------------------------+ |
| | [=30%         ] Fungicide Mix - John S.                   | |
| | 1/3 locations done | Started 10:30                        | |
| +-----------------------------------------------------------+ |
|                                                               |
| UPCOMING                                                      |
| - Foliage Feed (unassigned) - 5 locations                     |
| - Spot Treatment Aphids (assigned to John) - Tomorrow         |
+---------------------------------------------------------------+
```

---

## Data Model Enhancements

### Job States for Scout Control

```typescript
type JobStatus =
  | 'draft'        // Scout is building the job
  | 'pending'      // Ready but not assigned
  | 'assigned'     // Assigned to applicator
  | 'in_progress'  // Applicator has started
  | 'completed'    // All tasks done
  | 'cancelled';   // Scout cancelled it
```

### Scout-Specific Fields

```sql
ALTER TABLE ipm_application_jobs
ADD COLUMN created_by UUID REFERENCES profiles(id),
ADD COLUMN scout_notes TEXT, -- Instructions for applicator
ADD COLUMN priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
ADD COLUMN can_merge_days BOOLEAN DEFAULT false,
ADD COLUMN merge_window_days INTEGER DEFAULT 1;
```

---

## Implementation Phases

### Phase 1: Smart Task Grouping

1. Auto-group tasks by product + week + rate + method
2. Show grouped tasks as "potential jobs" in Unassigned column
3. Scout can accept grouping or manually adjust

### Phase 2: Job Creation & Assignment

1. Drag-and-drop or checkbox selection to create jobs
2. Assignment dropdown with team members
3. Due date with merge flexibility option
4. Scout notes field

### Phase 3: Progress Monitoring

1. Real-time job status updates
2. Location-level completion tracking
3. Estimated completion times
4. Alert for stalled jobs

### Phase 4: Compliance Review

1. View completed job details
2. Verify compliance data is complete
3. Flag jobs needing follow-up
4. Export for regulatory reports

---

## Key Scout Features

1. **Smart Grouping**: System suggests logical job groupings
2. **Batch-Level Control**: Can exclude specific batches from jobs
3. **Day Merging**: Option to combine Mon/Tue sprays into single job
4. **Assignment Queue**: Assign multiple jobs to applicators efficiently
5. **Progress Dashboard**: See who's doing what, where
6. **Compliance Verification**: Ensure all required fields captured

---

## Workflow: Creating a Job

```
1. Scout views Unassigned column
2. Sees "Foliage Feed - Week 6" group (auto-generated)
3. Clicks to review tasks
4. Notices Tunnel 5B has different rate - deselects it
5. Clicks "Create Job"
6. Names it "Foliage Feed - Tunnels 4-5"
7. Assigns to John Smith
8. Adds note: "Focus on leaf undersides"
9. Job moves to Assigned column
10. John sees it on his view
```

---

## Trade-offs

| Advantage | Trade-off |
|-----------|-----------|
| Full control for scout | More clicks than auto-assign |
| Can exclude specific batches | Complexity in task selection UI |
| Day merge flexibility | Could confuse applicators if overused |
| Real-time monitoring | Requires applicator to update progress |
| Compliance verification | Another step in workflow |

---

## Integration Points

1. **Scout observations**: Link to `ipm_observations` table
2. **Spot treatments**: Integrate remedial program jobs
3. **Generic tasks**: Create summary task for employee schedule
4. **Notifications**: Alert applicator when assigned

---

## Open Questions

1. Should scouts be able to override applicator's completion data?
2. How to handle job reassignment mid-execution?
3. Approval workflow for completed jobs?
