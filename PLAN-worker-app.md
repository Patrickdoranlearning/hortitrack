# PLAN: Worker App for HortiTrack

**Feature**: Mobile-first task execution interface for nursery workers
**Status**: COMPLETE
**Created**: 2026-01-31
**Author**: planner agent
**Validated**: 2026-01-31 (thorough review completed)
**Completed**: 2026-01-31 (all 5 phases implemented, thorough mode validation passed)
**Complexity**: L (Large - 5 phases)

---

## Validation Summary

### Pre-Flight Check Results
| Check | Status | Notes |
|-------|--------|-------|
| Existing PLAN.md | Separate file (PLAN-worker-app.md) | No conflicts |
| ROADMAP.md alignment | N/A | No ROADMAP.md found |
| Related plans in progress | PLAN-plant-health-completion.md | No direct conflicts |
| Worker route group exists | No | To be created (expected) |

### Component Verification Results

| Component | Claimed Location | Status | Notes |
|-----------|------------------|--------|-------|
| `ScannerClient` | `src/components/Scanner/ScannerClient.tsx` | **VERIFIED** | Full camera/barcode scanning with WASM fallback |
| `JobChecklist` | `src/components/tasks/JobChecklist.tsx` | **VERIFIED** | Complete checklist UI with skip/progress tracking |
| `OfflineProvider` | `src/offline/OfflineProvider.tsx` | **VERIFIED** | RxDB-based batch caching with sync |
| `ServiceWorkerRegistration` | `src/components/ServiceWorkerRegistration.tsx` | **VERIFIED** | PWA support exists |

### Server Function Verification Results

| Function | Claimed Location | Status | Notes |
|----------|------------------|--------|-------|
| `getTasks` | `src/server/tasks/service.ts` | **VERIFIED** | Full filter support (status, assignedTo, date, module) |
| `getEmployeeSchedule` | `src/server/tasks/service.ts` | **VERIFIED** | Returns tasks for user with assigned/in_progress status |
| `startTask` | `src/server/tasks/service.ts` | **VERIFIED** | Sets status to in_progress, records started_at |
| `completeTask` | `src/server/tasks/service.ts` | **VERIFIED** | Records completion, logs to productivity_logs |
| `getTemplatesForProcess` | `src/server/tasks/checklist-service.ts` | **VERIFIED** | Returns prerequisites & postrequisites arrays |

### API Endpoint Verification Results

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/tasks` | **VERIFIED** | Supports all filter params |
| `GET /api/tasks/[id]` | **VERIFIED** | Single task lookup |
| `POST /api/tasks/[id]/start` | **VERIFIED** | Calls startTask service |
| `POST /api/tasks/[id]/complete` | **VERIFIED** | Accepts actualPlantQuantity |
| `GET /api/tasks/staff` | **VERIFIED** | Returns assignable staff |

### Database Schema Verification Results

| Table/View | Status | Notes |
|------------|--------|-------|
| `tasks` | **VERIFIED** | All required columns exist (status, assigned_to, started_at, completed_at, plant_quantity) |
| `tasks_with_productivity` | **VERIFIED** | View with duration_minutes, plants_per_hour, assigned_to_name |
| `productivity_logs` | **VERIFIED** | Logging table exists with RLS |
| `checklist_templates` | **VERIFIED** | Full template system with RLS |
| RLS policies | **VERIFIED** | org_memberships-based access on all tables |

### Auth/Role Verification

| Role | Status | Notes |
|------|--------|-------|
| `grower` role | **VERIFIED** | Defined in `src/server/auth/getUser.ts` as valid OrgRole |
| RLS for workers | **VERIFIED** | Based on org_memberships, not role-specific - workers see all org tasks |

---

## Executive Summary

The Worker App provides a streamlined, mobile-first interface for nursery workers to view, execute, and complete tasks in the field. Workers operate in polytunnels with phones/tablets, often in challenging conditions (wet, dirty, bright sunlight). The app must be simple, fast, and scan-focused.

### Architecture Decision: Route Group (`/worker`)

**Recommendation**: Option 1 - Route group within the existing Next.js app

**Rationale**:
1. **Shared infrastructure** - Same auth, same API, same database connections
2. **Faster delivery** - No separate build/deploy pipeline to maintain
3. **Simpler offline story** - Existing `OfflineProvider` + RxDB already handles batch caching
4. **PWA-capable anyway** - Next.js route groups can still be installable via manifest
5. **Reduced maintenance** - One codebase, one deploy, one Supabase project

**Trade-offs acknowledged**:
- Workers share the main app's bundle (mitigated by route-based code splitting)
- No true offline-first (but network in tunnels is usually adequate)
- Manager features accessible if worker knows URL (security via RLS, not route hiding)

---

## Priority Breakdown

### P0 - Must Have (Core MVP)

| Task | Description | Effort |
|------|-------------|--------|
| Worker layout shell | `/worker` route group with mobile-optimized nav | S |
| My Tasks Today view | Task list filtered by current user + date | M |
| Task detail/execution | Start, view checklist, complete task flow | M |
| Scan-to-start | Scan barcode to find and start task | M |
| Basic productivity capture | Log plant count on completion | S |

### P1 - Should Have (Full Feature)

| Task | Description | Effort |
|------|-------------|--------|
| Week schedule view | Calendar/list of tasks for the week | M |
| Checklist UI for workers | Mobile-optimized checklist step-through | M |
| Task search/filter | Find tasks by batch, location, type | S |
| Personal stats dashboard | Plants/hour, tasks completed today/week | M |
| Offline task queue | Queue completions when offline, sync later | L |

### P2 - Nice to Have (Polish)

| Task | Description | Effort |
|------|-------------|--------|
| Voice notes on task | Record audio note during task | M |
| Photo capture | Attach photo to task completion | M |
| Batch location hints | Show polytunnel/zone for task's batches | S |
| Worker notifications | Push notifications for new assignments | L |
| Team leaderboard | Gamified productivity view | S |
| Haptic feedback | Vibration on scan success | S |

---

## Component Breakdown

### New Components (to create)

```
src/app/(worker)/
  layout.tsx              # Mobile-first shell, bottom nav
  page.tsx                # Today's tasks (home)
  schedule/
    page.tsx              # Week view
  task/
    [id]/
      page.tsx            # Task detail + execution
  scan/
    page.tsx              # Scan to find/start task
  stats/
    page.tsx              # Personal productivity dashboard

src/components/worker/
  WorkerNav.tsx           # Bottom navigation bar
  TaskCard.tsx            # Compact task card for lists
  TaskExecutionFlow.tsx   # Start/checklist/complete wizard
  MobileChecklist.tsx     # Touch-optimized checklist steps
  ScanToStart.tsx         # Scanner wrapper for task lookup
  ProductivitySummary.tsx # Stats cards (plants/hour, etc.)
  OfflineIndicator.tsx    # Shows sync status
```

### Existing Components (to reuse)

| Component | Location | Notes |
|-----------|----------|-------|
| `ScannerClient` | `src/components/Scanner/ScannerClient.tsx` | Camera/barcode scanning |
| `JobChecklist` | `src/components/tasks/JobChecklist.tsx` | Checklist UI (needs mobile adaptation) |
| `OfflineProvider` | `src/offline/OfflineProvider.tsx` | Offline batch lookup |
| `ServiceWorkerRegistration` | `src/components/ServiceWorkerRegistration.tsx` | PWA support |

### Server Functions (existing, to reuse)

| Function | Location | Purpose |
|----------|----------|---------|
| `getTasks` | `src/server/tasks/service.ts` | Fetch tasks with filters |
| `getEmployeeSchedule` | `src/server/tasks/service.ts` | Get user's assigned tasks |
| `startTask` | `src/server/tasks/service.ts` | Mark task in_progress |
| `completeTask` | `src/server/tasks/service.ts` | Complete + log productivity |
| `getTemplatesForProcess` | `src/server/tasks/checklist-service.ts` | Get checklists for task type |

---

## Database Requirements

### No New Tables Needed

The existing schema fully supports the Worker App:

- **`tasks`** - All task data with status, assignments, timestamps
- **`tasks_with_productivity`** - View with computed duration/plants_per_hour
- **`productivity_logs`** - Individual productivity entries
- **`checklist_templates`** - Checklist definitions per process type

### New Views (optional, for performance)

```sql
-- P1: Worker's task summary for quick stats
CREATE OR REPLACE VIEW v_worker_stats AS
SELECT
  t.assigned_to AS user_id,
  t.org_id,
  DATE(t.completed_at) AS work_date,
  COUNT(*) FILTER (WHERE t.status = 'completed') AS tasks_completed,
  SUM(t.plant_quantity) FILTER (WHERE t.status = 'completed') AS plants_processed,
  AVG(twp.plants_per_hour) FILTER (WHERE twp.plants_per_hour IS NOT NULL) AS avg_plants_per_hour
FROM tasks t
LEFT JOIN tasks_with_productivity twp ON t.id = twp.id
WHERE t.assigned_to IS NOT NULL
GROUP BY t.assigned_to, t.org_id, DATE(t.completed_at);
```

### New Indexes (performance)

```sql
-- Index for worker's active tasks lookup (already exists as tasks_employee_schedule_idx)
-- Index for scan-to-start (task by source_ref)
CREATE INDEX IF NOT EXISTS tasks_scan_lookup_idx
  ON tasks(org_id, source_ref_type, source_ref_id)
  WHERE status IN ('assigned', 'in_progress');
```

---

## API Requirements

### Existing Endpoints (reuse)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tasks` | GET | List tasks with filters |
| `/api/tasks/[id]` | GET | Get single task |
| `/api/tasks/[id]/start` | POST | Start a task |
| `/api/tasks/[id]/complete` | POST | Complete a task |
| `/api/tasks/staff` | GET | Get assignable staff |

### New Endpoints

```typescript
// GET /api/worker/my-tasks?date=2026-01-31
// Returns tasks assigned to current user for given date
// Response: { tasks: Task[], stats: { pending: number, inProgress: number, completed: number } }

// GET /api/worker/stats?range=week
// Returns productivity stats for current user
// Response: {
//   today: { tasks: number, plants: number, avgPlantsPerHour: number },
//   week: { tasks: number, plants: number, avgPlantsPerHour: number },
//   history: { date: string, tasks: number, plants: number }[]
// }

// POST /api/worker/scan-lookup
// Body: { code: string }
// Finds task matching scanned barcode (batch, location, or task ID)
// Response: { task: Task | null, batch?: Batch, suggestions?: Task[] }
```

---

## UI/UX Considerations

### Mobile-First Design Principles

1. **Large touch targets** - Minimum 48x48px, prefer 56px for primary actions
2. **Bottom-aligned actions** - Thumb-reachable primary buttons
3. **High contrast** - Readable in bright sunlight
4. **One-hand operation** - All actions reachable with thumb
5. **Minimal typing** - Prefer scan/tap over keyboard input
6. **Clear state feedback** - Loading spinners, success/error states

### Key UI Patterns

```
+------------------------------------------+
|  [Back]    My Tasks Today    [Scan]      |  <- Top bar (minimal)
+------------------------------------------+
|                                          |
|  +------------------------------------+  |
|  | [POTTING]                          |  |
|  | Batch #2024-0142 - Lavender        |  |
|  | 500 plants | Tunnel 4              |  |
|  |                                    |  |
|  |              [START TASK]          |  |  <- Big, green, thumb-height
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | [IN PROGRESS]                      |  |
|  | Batch #2024-0138 - Rosemary        |  |
|  | Started 14 min ago                 |  |
|  |                                    |  |
|  |              [CONTINUE]            |  |  <- Blue, in-progress
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|   [Home]    [Schedule]    [Stats]        |  <- Bottom nav
+------------------------------------------+
```

### Task Execution Flow

```
[Assigned Task Card]
        |
        v (tap Start or scan batch)
[Prerequisites Checklist] (if defined)
        |
        v (complete checklist)
[IN PROGRESS state - timer running]
        |
        v (tap Complete)
[Postrequisites Checklist] (if defined)
        |
        v (complete checklist)
[Plant Count Confirmation]
        |
        v (confirm or adjust)
[COMPLETED - Show plants/hour stat]
```

### Scan Interaction

```
[Scan Page]
     |
     v (camera opens automatically)
[Point at barcode]
     |
     v (decode)
[Parse code type: batch / task / location]
     |
     +--> Batch: Find task for this batch
     |           |
     |           v
     |         [Show task card with START button]
     |
     +--> Task ID: Direct task lookup
     |           |
     |           v
     |         [Show task detail]
     |
     +--> Location: Find tasks at this location
                 |
                 v
               [Show task list for location]
```

---

## Integration Points

### With Existing Modules

| Module | Integration |
|--------|-------------|
| Production | Tasks sync from `production_jobs` via existing hooks |
| Dispatch | Picking tasks already exist in tasks table |
| Plant Health | IPM observations create tasks via `syncTaskFromIPM` |
| Auth | Same Supabase auth, worker is org member |
| Offline | Extend `OfflineProvider` to cache worker's tasks |

---

## Module Integration Details

This section documents how the Worker App integrates with each HortiTrack module. Workers see tasks from all modules through the unified `tasks` table, but each module type requires specific UI handling and data display.

### Task Source Modules

The `tasks.source_module` field identifies where a task originated:

| source_module | Description | Task Types |
|---------------|-------------|------------|
| `production` | Production jobs (potting, spacing, etc.) | `potting`, `propagation`, `transplant`, `spacing`, `other` |
| `dispatch` | Order picking and fulfillment | `picking` |
| `plant_health` | IPM treatments and scouting | `ipm_treatment`, `ipm_observation` |

### 1. Production Module Integration

**Source Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/production/jobs.ts` - Job CRUD, assignment, completion
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/production/jobs/ProductionJobsClient.tsx` - Manager UI
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/production/tasks.ts` - Production task scheduling

**How Tasks Are Created**:
```typescript
// When a job is assigned to a worker, a task is created:
await createTask({
  sourceModule: "production",
  sourceRefType: "job",
  sourceRefId: jobId,
  title: job.name,
  taskType: job.processType ?? "production", // potting, propagation, transplant, spacing, other
  assignedTo,
  plantQuantity: job.totalPlants,
});
```

**Task Types for Workers**:
| taskType | Description | Worker Actions |
|----------|-------------|----------------|
| `potting` | Potting job - transplanting into final pots | Execute checklist, record plants potted |
| `propagation` | Propagation - cuttings/seed sowing | Execute checklist, record units propagated |
| `transplant` | Transplanting between stages | Execute checklist, confirm quantities |
| `spacing` | Spacing out plants in trays/benches | Execute checklist, confirm area completed |
| `other` | General production task | Execute checklist if defined |

**Data Workers Need**:
```typescript
// From production_jobs via source_ref_id:
{
  name: string;              // Job title
  processType: string;       // potting, spacing, etc.
  location: string | null;   // Polytunnel/zone
  machine: string | null;    // Equipment needed
  batchCount: number;        // Number of batches in job
  totalPlants: number;       // Total plant count
  scheduledDate: string;     // Target date
  checklistProgress: {       // Progress through checklist
    prerequisites: { id, title, completed, skipped }[];
    postrequisites: { id, title, completed, skipped }[];
  };
}

// Batches in the job (from production_job_batches):
{
  batchNumber: string;
  varietyName: string;
  sizeName: string;
  quantity: number;
  status: string;
  readyAt: string;
}
```

**Worker Actions**:
1. **View job details** - See batches, quantities, location
2. **Start job** - Sets status to `in_progress`, records `started_at`
3. **Execute checklist** - Step through prerequisites (e.g., "Check machine ready", "Verify materials")
4. **Complete job** - Records `completed_at`, logs productivity, actualizes ghost batches
5. **Complete postrequisites** - Post-job checklist (e.g., "Clean equipment", "Update stock")

**Sync Back on Completion**:
```typescript
// From completeJob() in jobs.ts:
// 1. Update job status to 'completed'
// 2. Record completion timestamp and user
// 3. Sync associated task to 'completed'
// 4. Actualize ghost batches (Planned -> Active)
// 5. Log to productivity_logs for plants/hour tracking
```

**API Endpoints for Worker App**:
- `GET /api/tasks/jobs/{id}?includeBatches=true` - Get job details with batches
- `POST /api/tasks/jobs/{id}/start` - Start job
- `POST /api/tasks/jobs/{id}/complete` - Complete job with wizard data
- `PATCH /api/tasks/jobs/{id}` - Update checklist progress

---

### 2. Dispatch Module Integration

**Source Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/sales/picking.ts` - Pick list CRUD, item picking
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/dispatch/picker-queries.ts` - Picker-specific queries
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/dispatch/picker/page.tsx` - Picker queue UI
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/dispatch/picking/[pickListId]/PickingWorkflowClient.tsx` - Picking workflow

**How Tasks Are Created**:
```typescript
// When a pick list is created for an order:
await createTask({
  sourceModule: "dispatch",
  sourceRefType: "pick_list",
  sourceRefId: pickListId,
  title: `Pick Order #${orderNumber} - ${customerName}`,
  description: `Pick list for order ${orderNumber}. ${itemCount} line items, ${totalQty} total units.`,
  taskType: "picking",
  assignedTeamId: teamId,  // Can be team-assigned initially
  scheduledDate: requestedDeliveryDate,
  plantQuantity: totalQty,
});
```

**Task Types for Workers**:
| taskType | Description | Worker Actions |
|----------|-------------|----------------|
| `picking` | Order picking task | Pick items from batches, handle substitutions, mark shorts |

**Data Workers Need**:
```typescript
// From pick_lists:
{
  id: string;
  orderNumber: string;
  customerName: string;
  requestedDeliveryDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  totalItems: number;
  pickedItems: number;
  totalQty: number;
  pickedQty: number;
}

// Pick items (what to pick):
{
  id: string;
  targetQty: number;
  pickedQty: number;
  status: 'pending' | 'picked' | 'short' | 'substituted';
  productName: string;
  plantVariety: string;
  size: string;
  originalBatchNumber: string;
  batchLocation: string;       // Where to find it
  locationHint: string;        // Polytunnel/zone
  isProductGroup: boolean;     // Can pick from any group member
}
```

**Worker Actions**:
1. **View pick queue** - See assigned and available orders
2. **Claim order** - Self-assign an unassigned pick list
3. **Start picking** - Begin the pick workflow
4. **Pick item** - Scan batch, confirm quantity picked
5. **Mark short** - Item partially/not available
6. **Substitute batch** - Use alternative batch with reason
7. **Complete pick list** - All items picked, ready for QC/dispatch

**Picking Workflow**:
```
[Pick Queue] -> [Select Order] -> [Pick Workflow]
                                      |
                   For each item:    |
                   +------------------+
                   |
                   v
            [Scan batch barcode]
                   |
                   v
            [Confirm quantity]
                   |
          +--------+--------+
          |        |        |
         Full   Partial   Missing
          |        |        |
     [picked]  [short]  [short]
                   |
                   v
            [Next item...]
                   |
                   v
            [Complete Pick List]
```

**Sync Back on Completion**:
```typescript
// From completePickList() via RPC complete_pick_list:
// 1. Update pick_list status to 'completed'
// 2. Deduct stock from picked batches (batch_allocations)
// 3. Update order status to 'picked' or 'packed'
// 4. Sync associated task to 'completed'
// 5. Log productivity
```

**Existing Picker UI to Reference**:
The dispatch module already has a mobile-friendly picker UI at `/dispatch/picker`. The Worker App should either:
- **Option A**: Deep-link to existing picker pages for picking tasks
- **Option B**: Embed picking workflow in worker app (reuse components)

**Recommendation**: Option A for MVP - avoid duplication. Worker task card links to `/dispatch/picking/{pickListId}`.

---

### 3. Plant Health Module Integration

**Source Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/actions/ipm-tasks.ts` - IPM task CRUD, completion
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/scout/ScoutWizard.tsx` - Scouting UI
- `/Users/patrickdoran/Hortitrack/hortitrack/src/components/plant-health/ipm/ApplyTreatmentDialog.tsx` - Treatment application

**How Tasks Are Created**:

**1. IPM Program Tasks (auto-generated)**:
```typescript
// When a batch is created, tasks are generated based on family's IPM programs:
generateTasksForBatch(batchId, pottingDate);
// Creates ipm_tasks entries with scheduled_date based on program steps
```

**2. IPM Summary Tasks (for generic task system)**:
```typescript
// To show IPM work in the unified task list:
await createTask({
  sourceModule: 'plant_health',
  sourceRefType: 'ipm_summary',
  sourceRefId: `ipm-${productId}-week${calendarWeek}`,
  title: `IPM: ${productName} - Week ${calendarWeek}`,
  description: `Apply ${productName} to ${batchCount} batches`,
  taskType: 'ipm_treatment',
  assignedTo,
  scheduledDate,
  plantQuantity: batchCount,
});
```

**3. Spot Treatment Tasks**:
```typescript
// When a scout finds an issue and schedules treatment:
generateTasksForSpotTreatment(spotTreatmentId);
// Creates ipm_tasks for the treatment schedule
```

**Task Types for Workers**:
| taskType | Description | Worker Actions |
|----------|-------------|----------------|
| `ipm_treatment` | Apply IPM product (spray, drench, etc.) | Scan product, record application, compliance data |
| `ipm_observation` | Scout/inspect batches for issues | Log observations, photos, trigger treatments |

**Data Workers Need**:
```typescript
// For treatment tasks (from ipm_tasks):
{
  id: string;
  batchId: string;
  batchNumber: string;
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  rate: number;           // Application rate
  rateUnit: string;       // ml/L, g/L, etc.
  method: string;         // spray, drench, granular
  scheduledDate: string;
  calendarWeek: number;
  isTankMix: boolean;     // Multiple products applied together
  tankMixProducts: string[]; // If tank mix, list all products
}

// For grouped view (all batches needing same treatment):
{
  productName: string;
  calendarWeek: number;
  locations: { id, name, batchCount }[];
  totalBatches: number;
}
```

**Worker Actions**:

**For IPM Treatment**:
1. **View treatment list** - Grouped by product/week
2. **Start treatment** - Select batches to treat
3. **Scan product bottle** - Verify correct product, track bottle usage
4. **Record compliance data** - Required for chemical applications:
   - PCS number (product registration)
   - Reason for use
   - Weather conditions
   - Rate applied
   - Area treated
   - Sprayer used
   - WHI (Withholding Interval) / safe harvest date
5. **Complete treatment** - Log to `plant_health_logs`, deduct stock

**For Scouting/Observation**:
1. **Scan location or batch** - Start scout session
2. **Log observation** - Issue type, severity, affected batches
3. **Take photo** - Visual record
4. **Schedule treatment** - If issue found, create spot treatment
5. **Record readings** - pH, EC if applicable

**Sync Back on Completion**:
```typescript
// From completeTasks() in ipm-tasks.ts:
// 1. Update ipm_tasks status to 'completed'
// 2. Create plant_health_logs entries for audit trail
// 3. Record bottle stock usage
// 4. Sync to generic task if ipm_summary exists
```

**Compliance Data Structure**:
```typescript
type ComplianceData = {
  bottleId?: string;
  quantityUsedMl?: number;
  notes?: string;
  pcsNumber?: string;         // Product registration
  cropName?: string;          // What was treated
  reasonForUse?: string;      // Why treatment applied
  weatherConditions?: string; // At time of application
  harvestIntervalDays?: number;
  safeHarvestDate?: string;
  areaTreated?: string;
  sprayerUsed?: string;
  signedBy?: string;          // Applicator signature
  fertiliserComposition?: string; // For feeding
};
```

---

### 4. Tasks Module (Core System)

**Source Files**:
- `/Users/patrickdoran/Hortitrack/hortitrack/src/server/tasks/service.ts` - Unified task service
- `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/tasks/route.ts` - Tasks API

**Core Task Structure**:
```typescript
type Task = {
  id: string;
  orgId: string;
  sourceModule: 'production' | 'dispatch' | 'plant_health';
  sourceRefType: string | null;  // 'job', 'pick_list', 'ipm_summary'
  sourceRefId: string | null;    // Reference to source entity
  title: string;
  description: string | null;
  taskType: string | null;       // Determines UI rendering
  assignedTo: string | null;
  assignedToName: string | null;
  assignedTeamId: string | null;
  scheduledDate: string | null;
  priority: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  plantQuantity: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  plantsPerHour: number | null;
};
```

**Task Lifecycle**:
```
[pending] --> [assigned] --> [in_progress] --> [completed]
    |             |              |                 ^
    |             |              +-- startTask() --+
    |             |                                |
    |             +---- assignTask() -------------+
    |                                              |
    +---- createTask(assignedTo) -----------------+
```

**Filtering for Worker App**:
```typescript
// Get tasks for current user:
await getTasks({
  assignedTo: userId,
  status: ['assigned', 'in_progress'],
  scheduledDateFrom: today,
  scheduledDateTo: endOfWeek,
});

// Or use convenience function:
await getEmployeeSchedule(userId, today);
```

---

### Task Card UI Requirements by Module

Based on the integration analysis, the Worker App needs module-specific task card rendering:

| Module | Card Elements | Primary Action | Secondary Actions |
|--------|---------------|----------------|-------------------|
| **Production** | Job name, process type badge, batch count, plant count, location | Start/Continue | View checklist, View batches |
| **Dispatch** | Order number, customer name, item count, progress bar, due date | Start Picking | View items, Mark as picked |
| **Plant Health** | Product name, week number, batch/location count, method badge | Apply Treatment | View batches, Record compliance |

**Recommended Component Structure**:
```typescript
// Generic wrapper that delegates to module-specific cards:
function TaskCard({ task }: { task: Task }) {
  switch (task.sourceModule) {
    case 'production':
      return <ProductionTaskCard task={task} />;
    case 'dispatch':
      return <DispatchTaskCard task={task} />;
    case 'plant_health':
      return <PlantHealthTaskCard task={task} />;
    default:
      return <GenericTaskCard task={task} />;
  }
}
```

---

### API Additions for Worker App

Beyond the existing `/api/tasks/*` endpoints, the worker app needs module-context APIs:

```typescript
// Worker's unified task view with module context:
// GET /api/worker/my-tasks?date=2026-01-31
// Response includes module-specific context:
{
  tasks: [
    {
      ...baseTask,
      // Enriched based on sourceModule:
      moduleContext: {
        // For production:
        job?: { processType, location, batchCount, totalPlants, checklistProgress },
        // For dispatch:
        pickList?: { orderNumber, customerName, totalItems, pickedItems, progress },
        // For plant_health:
        ipmGroup?: { productName, method, locations, batchCount },
      }
    }
  ],
  stats: { pending, inProgress, completed }
}
```

**Implementation Note**: This can be achieved by joining task data with source entities based on `source_ref_type` and `source_ref_id`.

---

### Updated Component List

Based on module integrations, additional components needed:

```
src/components/worker/
  TaskCard.tsx              # Generic wrapper
  cards/
    ProductionTaskCard.tsx  # Production job task display
    DispatchTaskCard.tsx    # Picking task display (links to picker UI)
    PlantHealthTaskCard.tsx # IPM treatment/scouting task display

  execution/
    ProductionExecutionFlow.tsx  # Checklist + completion for jobs
    PlantHealthExecutionFlow.tsx # Compliance form + bottle scan
    # Dispatch uses existing /dispatch/picking/* UI
```

**Reusable from Existing Code**:
- `/src/components/dispatch/picker/PickerTaskCard.tsx` - Reference for dispatch card styling
- `/src/components/tasks/JobChecklist.tsx` - Checklist UI for production
- `/src/components/plant-health/scout/ScoutWizard.tsx` - Scout flow for observations
- `/src/components/plant-health/ipm/ApplyTreatmentDialog.tsx` - Treatment compliance form

### Barcode Format Support

The existing `parseScanCode()` already handles:
- `ht:batch:<batchNumber>` - Batch lookup
- `HT:<orgPrefix>:<id>` - Internal barcodes
- `ht:loc:<locationId>` - Location codes
- UUID - Direct ID lookup

**New pattern needed**: Task barcodes
```typescript
// Add to src/lib/scan/parse.ts
// ht:task:<taskId> - Direct task reference
const htTask = raw.match(/^ht:task:([a-z0-9-]+)$/i);
if (htTask) {
  return { by: 'taskId', value: htTask[1], raw };
}
```

---

## Offline Strategy

### P0: Online-Required with Graceful Degradation

- Tasks list requires network
- Scan works offline for batch lookup (existing RxDB)
- Show "offline" banner when disconnected
- Disable start/complete buttons when offline

### P1: Offline Task Queue

```typescript
// src/offline/task-queue.ts
type PendingAction = {
  id: string;
  type: 'start' | 'complete';
  taskId: string;
  payload: { plantCount?: number; checklistProgress?: object };
  createdAt: string;
};

// Queue actions locally, sync when online
// Show pending count badge on nav
```

---

## Implementation Phases

### Phase 1: Foundation (P0)
**Estimated: 2-3 sessions**

1. Create `/app/(worker)/` route group with layout
2. Build `WorkerNav` bottom navigation
3. Implement "My Tasks Today" page
4. Create `TaskCard` component
5. Wire up task fetching with auth

**Phase 1 Complete When**:
- Worker can see their assigned tasks for today
- Navigation between home/schedule/stats works
- Layout is mobile-optimized

### Phase 2: Task Execution (P0)
**Estimated: 2-3 sessions**

1. Build task detail page with execution flow
2. Integrate existing `JobChecklist` (mobile-adapted)
3. Implement start/complete mutations
4. Add plant count capture on completion
5. Show productivity feedback after completion

**Phase 2 Complete When**:
- Worker can start a task
- Worker can complete prerequisites/postrequisites
- Worker can complete task with plant count
- Worker sees their plants/hour on completion

### Phase 3: Scan Integration (P0)
**Estimated: 1-2 sessions**

1. Create worker scan page with `ScannerClient`
2. Add task barcode pattern to parser
3. Implement scan-to-task-lookup API
4. Build scan result UI (found task, suggestions, not found)
5. Quick-start flow from scan result

**Phase 3 Complete When**:
- Worker can scan batch barcode to find task
- Worker can scan task barcode to open task
- Scan shows helpful message if no task found

### Phase 4: Schedule & Stats (P1)
**Estimated: 2-3 sessions**

1. Build week schedule view (day-by-day breakdown)
2. Create stats dashboard with productivity metrics
3. Add worker stats API endpoint
4. Implement task filters (by type, by status)
5. Add today/week toggle for stats

**Phase 4 Complete When**:
- Worker can view their full week schedule
- Worker can see productivity stats
- Stats update after task completion

### Phase 5: Offline & Polish (P1/P2)
**Estimated: 2-3 sessions**

1. Extend OfflineProvider for task caching
2. Build offline action queue
3. Add sync status indicator
4. Polish animations and transitions
5. Add haptic feedback on scan
6. PWA manifest for "Add to Home Screen"

**Phase 5 Complete When**:
- App works offline for viewing cached tasks
- Actions queue when offline, sync when online
- App installable as PWA

---

## Definition of Done

### Per-Task Criteria
- [ ] TypeScript strict mode passes
- [ ] Mobile viewport tested (375px width minimum)
- [ ] Touch targets >= 48px
- [ ] Loading states implemented
- [ ] Error states handled with user feedback
- [ ] RLS policies protect data

### Feature Complete Criteria
- [ ] Worker can view and complete tasks on mobile
- [ ] Scan-to-start workflow functions
- [ ] Productivity metrics captured and displayed
- [ ] No console errors in production
- [ ] Works on iOS Safari and Android Chrome

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scanner performance in polytunnels | Medium | High | Test with real devices in field; fallback to manual entry |
| Network connectivity issues | Medium | Medium | Offline task queue (P1); show clear offline state |
| Workers overwhelmed by UI | Low | Medium | User testing with actual workers; iterate on feedback |
| Checklist overhead slows workers | Medium | Medium | Make checklists optional/skippable; fast-path for simple tasks |

---

## Handoff Notes for Jimmy

**Mode Recommendation**: `standard`

**DB Work Required**: No - existing schema sufficient. Optional view `v_worker_stats` can be added in P1.

**Critical Dependencies** (ALL VERIFIED):
- [x] `getTasks` / `getEmployeeSchedule` - working with full filter support
- [x] `startTask` / `completeTask` - working with productivity logging
- [x] `ScannerClient` - operational with WASM fallback for Data Matrix
- [x] `JobChecklist` - full checklist UI with progress tracking
- [x] `OfflineProvider` - batch caching via RxDB
- [x] Auth/RLS - org_memberships-based access verified

**First Task**: Start with Phase 1, Task 1 - Create the route group layout.

**Agent Routing**:
- Phase 1-3: `feature-builder` for UI work
- If DB view needed: `data-engineer` first
- After each phase: `verifier` for tests
- Before merge: `security-auditor` for RLS review

---

## Execution Readiness Assessment

### GO/NO-GO: **GO**

All prerequisites verified. No blockers found.

### Verified Components Ready for Reuse:
1. `/Users/patrickdoran/Hortitrack/hortitrack/src/components/Scanner/ScannerClient.tsx` - Camera scanning
2. `/Users/patrickdoran/Hortitrack/hortitrack/src/components/tasks/JobChecklist.tsx` - Checklist UI
3. `/Users/patrickdoran/Hortitrack/hortitrack/src/offline/OfflineProvider.tsx` - Offline batch lookup
4. `/Users/patrickdoran/Hortitrack/hortitrack/src/server/tasks/service.ts` - All task CRUD operations
5. `/Users/patrickdoran/Hortitrack/hortitrack/src/server/tasks/checklist-service.ts` - Checklist templates
6. `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/tasks/route.ts` - Task list API
7. `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/tasks/[id]/start/route.ts` - Start task API
8. `/Users/patrickdoran/Hortitrack/hortitrack/src/app/api/tasks/[id]/complete/route.ts` - Complete task API

### Minor Gaps Identified (Non-Blocking):
1. **Task barcode pattern**: `ht:task:<id>` not yet in parser - add during Phase 3
2. **tasks_with_productivity view**: Missing `assigned_team_name` join - non-blocking, team assignment is optional
3. **Worker-specific API**: `/api/worker/*` endpoints need creation (planned)

### Recommended First Step:
```
jimmy execute PLAN-worker-app.md --mode standard

Start: Phase 1, Task 1.1 - Create /app/(worker)/layout.tsx
Agent: feature-builder
```

### Notes for feature-builder:
- The `(worker)` route group uses parentheses for Next.js route grouping
- Reuse existing Tailwind mobile classes from recent mobile optimization commit (bcb64c9)
- The `JobChecklist` component already has touch-friendly UI but may need larger tap targets
- Auth context is available via `useActiveOrg()` from `@/lib/org/context`

---

## Files to Create (Summary)

```
src/app/(worker)/
  layout.tsx
  page.tsx
  schedule/page.tsx
  task/[id]/page.tsx
  scan/page.tsx
  stats/page.tsx

src/components/worker/
  WorkerNav.tsx
  TaskCard.tsx
  TaskExecutionFlow.tsx
  MobileChecklist.tsx
  ScanToStart.tsx
  ProductivitySummary.tsx
  OfflineIndicator.tsx

src/app/api/worker/
  my-tasks/route.ts
  stats/route.ts
  scan-lookup/route.ts
```

---

*Plan created by planner agent. Ready for execution via `jimmy execute PLAN-worker-app.md`*
