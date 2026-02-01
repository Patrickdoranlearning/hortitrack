# Implementation Plan: Task Management Deferral (Revised)

**Status**: Ready
**Created**: 2026-02-01
**Updated**: 2026-02-01
**Author**: Planner
**Complexity**: M (Medium) - reduced from L
**Estimated Sessions**: 1-2

---

## Pre-Flight Check
- Existing PLAN.md: Found (this is a revision of PLAN-task-deferral.md)
- ROADMAP.md alignment: N/A (task management deferred)
- Related plans: PLAN-worker-app.md (minor nav update needed)
- Backlog cross-ref: None

---

## 1. Overview

### Problem Statement
Generic task management (production tasks, dispatch tasks, worker task list, schedule view) adds complexity that isn't needed for v1. However, **plant health/IPM functionality is self-contained** and should be kept - it uses the `ipm_tasks` table directly and only touches the generic `tasks` table for optional employee scheduling integration.

### Decision Summary
- **KEEP**: All plant health/IPM functionality, including task execution flow
- **DEFER**: Only the generic task list, schedule, and task overview pages
- **KEEP (infrastructure)**: Task service, task API routes needed by plant health execution

### Scope
**In Scope (DEFER these files)**:
- Desktop `/tasks` overview page and TasksOverviewClient
- Desktop `/tasks/production` and `/tasks/dispatch` pages
- Worker `/worker/tasks` (generic task list)
- Worker `/worker/schedule` (weekly schedule)
- "Tasks" nav item from desktop nav
- "My Tasks" and "Schedule" from worker MoreMenuSheet
- Generic task components: `ProductionTaskCard`, `DispatchTaskCard`, `GenericTaskCard`
- Generic execution flows: `ProductionExecutionFlow`, `DispatchExecutionFlow`
- Task-related types and offline queue (partial - keep what plant health needs)

**Out of Scope (KEEP these)**:
- All `/plant-health/*` pages
- All `/worker/plant-health/*` pages
- `/worker/task/[id]` page (used by plant health execution)
- `PlantHealthTaskCard` and `PlantHealthExecutionFlow`
- `PlantHealthKanban` (at `/tasks/plant-health` - but we remove nav link)
- `/api/tasks/{id}/start` and `/api/tasks/{id}/complete` routes
- `/api/tasks/jobs/*` routes (production planning)
- `src/server/tasks/service.ts` (used by plant health)
- `src/server/tasks/checklist-service.ts` (used by production jobs)
- `TaskCard.tsx` (delegates to module-specific cards, plant health uses it)
- `TaskCardWrapper.tsx` (used by PlantHealthTaskCard)
- `useOfflineTaskAction` hook (used by TaskCardWrapper)
- `task-queue.ts` (used by offline system)
- `WorkerOfflineProvider` (still useful for online status)
- `ipm-tasks.ts`, `ipm-stock.ts`, `ipm.ts` server actions

---

## 2. Requirements

### Functional Requirements
| ID | Requirement | Priority | Size |
|----|-------------|----------|------|
| FR-1 | Remove "Tasks" nav item from desktop sidebar | P0 | S |
| FR-2 | Remove "My Tasks" and "Schedule" from worker menu | P0 | S |
| FR-3 | Move generic task overview/production/dispatch pages | P0 | M |
| FR-4 | Move worker tasks and schedule pages | P0 | S |
| FR-5 | Move generic task card components (not plant health) | P0 | S |
| FR-6 | Keep plant health worker flow fully functional | P0 | - |
| FR-7 | Keep worker `/task/[id]` page for plant health | P0 | - |

### Non-Functional Requirements
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | No runtime errors | 0 console errors |
| NFR-2 | Build passes | `npm run build` succeeds |
| NFR-3 | Plant health scout mode works | Full workflow functional |

### Assumptions
- Plant health can continue using TaskCard and TaskCardWrapper
- Worker `/task/[id]` page stays (PlantHealthExecutionFlow renders there)
- Task service stays (used by plant health summary tasks)
- Task API routes for start/complete stay (used by PlantHealthExecutionFlow)

---

## 3. Technical Design

### What's Actually Happening

The plant health system has **two task systems**:
1. **`ipm_tasks` table** - Self-contained IPM-specific tasks (treatments, applications)
2. **`tasks` table** - Generic tasks for employee scheduling integration

`PlantHealthExecutionFlow` uses:
- `/api/tasks/{id}/start` and `/api/tasks/{id}/complete` for task lifecycle
- These call `startTask()` and `completeTask()` from `@/server/tasks/service`

The worker `/plant-health` page shows IPM tasks via `TaskCard` -> `PlantHealthTaskCard` -> `TaskCardWrapper`, which links to `/worker/task/[id]` for execution.

### System Diagram

```mermaid
flowchart TB
    subgraph DEFER["Move to _deferred/tasks/"]
        DT[Desktop /tasks/*]
        WT[Worker /worker/tasks]
        WS[Worker /worker/schedule]
        PTC[ProductionTaskCard]
        DTC[DispatchTaskCard]
        GTC[GenericTaskCard]
        PEF[ProductionExecutionFlow]
        DEF[DispatchExecutionFlow]
    end

    subgraph KEEP["Keep In Place"]
        PH[/plant-health/*]
        WPH[/worker/plant-health]
        WTD[/worker/task/id]
        PHTC[PlantHealthTaskCard]
        PHEF[PlantHealthExecutionFlow]
        TCW[TaskCardWrapper]
        TC[TaskCard.tsx]
        TS[tasks/service.ts]
        TSA[/api/tasks/id/start]
        TCA[/api/tasks/id/complete]
        IPM[ipm-tasks.ts]
    end

    subgraph UPDATE["Update Only"]
        NAV[config/nav.ts]
        MM[MoreMenuSheet]
    end

    WTD --> PHEF
    PHEF --> TSA
    PHEF --> TCA
    WPH --> TC
    TC --> PHTC
    PHTC --> TCW
```

### Database Changes
**Assessment**: None required
**data-engineer Required**: No

---

## 4. File Inventory

### Files to Move to `_deferred/tasks/`

**Desktop App Pages** (5 files):
```
src/app/tasks/page.tsx
src/app/tasks/error.tsx
src/app/tasks/TasksOverviewClient.tsx
src/app/tasks/production/page.tsx
src/app/tasks/production/ProductionTasksClient.tsx
src/app/tasks/dispatch/page.tsx
src/app/tasks/dispatch/DispatchKanban.tsx
src/app/tasks/components/TaskWizard.tsx
src/app/tasks/components/EmployeeSchedule.tsx
src/app/tasks/components/JobsKanban.tsx
src/app/tasks/components/CreateJobDialog.tsx
```

Note: Keep `/tasks/plant-health/*` in place (or access via `/plant-health/tasks`)

**Worker App Pages** (2 files):
```
src/app/(worker)/worker/tasks/page.tsx
src/app/(worker)/worker/schedule/page.tsx
```

Note: KEEP `/worker/task/[id]/page.tsx` - used by plant health

**Worker Components** (partial - only generic cards/flows):
```
src/components/worker/cards/ProductionTaskCard.tsx
src/components/worker/cards/DispatchTaskCard.tsx
src/components/worker/cards/GenericTaskCard.tsx
src/components/worker/execution/ProductionExecutionFlow.tsx
src/components/worker/execution/DispatchExecutionFlow.tsx
src/components/worker/schedule/ (if exists)
```

Note: KEEP these:
- `PlantHealthTaskCard.tsx`
- `PlantHealthExecutionFlow.tsx`
- `TaskCardWrapper.tsx`
- `TaskCard.tsx`

**API Routes to Move**:
```
src/app/api/tasks/route.ts (generic CRUD)
src/app/api/tasks/staff/route.ts
src/app/api/worker/my-tasks/route.ts
src/app/api/worker/search-tasks/route.ts
src/app/api/worker/schedule/route.ts
```

Note: KEEP these:
- `/api/tasks/[id]/route.ts` - might be needed
- `/api/tasks/[id]/start/route.ts` - used by PlantHealthExecutionFlow
- `/api/tasks/[id]/complete/route.ts` - used by PlantHealthExecutionFlow
- `/api/tasks/jobs/*` - production planning
- `/api/worker/task/[id]/route.ts` - worker task detail

### Files to Update (NOT move)

| File | Change |
|------|--------|
| `src/config/nav.ts` | Remove "tasks" nav item entirely |
| `src/components/worker/MoreMenuSheet.tsx` | Remove "My Tasks" and "Schedule" items |
| `src/components/worker/TaskCard.tsx` | Remove production/dispatch/generic imports, just keep plant_health |
| `src/components/worker/cards/index.ts` | Update exports |
| `src/components/worker/execution/index.ts` | Update exports |

---

## 5. Implementation Plan

### Phase 1: Create Deferred Structure & Move Pages (P0)
| # | Task | Agent | Size | Acceptance Criteria |
|---|------|-------|------|---------------------|
| 1.1 | Create `_deferred/tasks/` folder structure | `feature-builder` | S | Folders exist |
| 1.2 | Move desktop task pages (except plant-health) | `feature-builder` | M | Files in `_deferred/tasks/app/` |
| 1.3 | Move worker tasks and schedule pages | `feature-builder` | S | Files in `_deferred/tasks/app-worker/` |

**Phase 1 Complete When**:
- [ ] Desktop `/tasks`, `/tasks/production`, `/tasks/dispatch` moved
- [ ] Worker `/worker/tasks`, `/worker/schedule` moved
- [ ] `/tasks/plant-health` kept in place (or linked from plant-health)

### Phase 2: Move Components & API Routes (P0)
| # | Task | Agent | Size | Acceptance Criteria |
|---|------|-------|------|---------------------|
| 2.1 | Move generic task card components | `feature-builder` | S | ProductionTaskCard, DispatchTaskCard, GenericTaskCard moved |
| 2.2 | Move generic execution flows | `feature-builder` | S | ProductionExecutionFlow, DispatchExecutionFlow moved |
| 2.3 | Move generic API routes | `feature-builder` | S | tasks/route.ts, staff, my-tasks, search-tasks, schedule moved |
| 2.4 | Update remaining component index files | `feature-builder` | S | No import errors |

**Phase 2 Complete When**:
- [ ] Generic components moved
- [ ] Generic API routes moved
- [ ] Plant health components still in place and importable

### Phase 3: Update Navigation (P0)
| # | Task | Agent | Size | Acceptance Criteria |
|---|------|-------|------|---------------------|
| 3.1 | Remove "Tasks" from desktop nav config | `feature-builder` | S | No "Tasks" in APP_NAV |
| 3.2 | Remove "My Tasks" and "Schedule" from MoreMenuSheet | `feature-builder` | S | Items removed from moreMenuItems |
| 3.3 | Update TaskCard to only handle plant_health | `feature-builder` | S | Fallback for other modules |

**Phase 3 Complete When**:
- [ ] No task navigation in desktop or worker
- [ ] Plant health nav items unchanged

### Phase 4: Verification (P1)
| # | Task | Agent | Size | Acceptance Criteria |
|---|------|-------|------|---------------------|
| 4.1 | Fix TypeScript errors | `feature-builder` | M | `npm run type-check` passes |
| 4.2 | Fix lint errors | `feature-builder` | S | `npm run lint` passes |
| 4.3 | Verify build | `verifier` | S | `npm run build` succeeds |
| 4.4 | Test plant health worker flow | `verifier` | M | Scout, task execution, completion work |

**Phase 4 Complete When**:
- [ ] Build passes
- [ ] Plant health scout mode works
- [ ] Plant health task execution works (`/worker/task/[id]`)
- [ ] IPM tasks appear on `/worker/plant-health`

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Plant health TaskCard breaks | Low | High | Keep TaskCardWrapper, PlantHealthTaskCard |
| Task execution APIs break | Low | High | Keep `/api/tasks/{id}/start|complete` |
| Import errors in kept files | Medium | Low | Update index files carefully |
| Desktop nav still shows tasks | Low | Low | Double-check nav config |

---

## 7. Definition of Done

Feature is complete when:
- [ ] All P0 tasks complete
- [ ] `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] No "Tasks" in desktop nav
- [ ] No "My Tasks" or "Schedule" in worker menu
- [ ] Plant health scout mode works end-to-end
- [ ] Worker plant health page shows IPM tasks
- [ ] Clicking IPM task opens `/worker/task/[id]` with PlantHealthExecutionFlow
- [ ] Task start/complete works for plant health tasks
- [ ] `_deferred/tasks/` contains all removed code
- [ ] `_deferred/README.md` exists with restoration instructions

---

## 8. Handoff Notes

### Jimmy Command String
```
jimmy execute PLAN-task-deferral.md --mode standard
```

### For Jimmy (Routing)
- **Start with**: `feature-builder` (Phase 1.1)
- **DB Work Required**: No
- **Recommended Mode**: standard
- **Critical Dependencies**: Keep all plant health task infrastructure
- **Estimated Sessions**: 1-2

### For feature-builder
Key context:
- **DO NOT MOVE** anything under `/plant-health/`, `/worker/plant-health/`, or `/worker/task/[id]/`
- **DO NOT MOVE** `PlantHealthTaskCard`, `PlantHealthExecutionFlow`, `TaskCardWrapper`, `TaskCard`
- **DO NOT MOVE** `/api/tasks/[id]/start`, `/api/tasks/[id]/complete`
- **DO NOT MOVE** `/api/tasks/jobs/*` (production planning uses these)
- **DO NOT MOVE** `/api/worker/task/[id]/route.ts`
- **DO NOT MOVE** `src/server/tasks/service.ts` or `checklist-service.ts`
- Update `TaskCard.tsx` to gracefully handle missing production/dispatch cards

Pattern:
1. Move files maintaining relative paths
2. Update imports/exports in files that stay
3. Test plant health flow after each phase

### For verifier
Test these flows:
1. Worker plant health page loads with IPM tasks
2. Tapping an IPM task opens `/worker/task/[id]`
3. PlantHealthExecutionFlow renders correctly
4. Start Task button works (calls `/api/tasks/{id}/start`)
5. Complete Task flow works (calls `/api/tasks/{id}/complete`)
6. Scout mode works (independent of generic tasks)

### Restoration Instructions (for future)
To restore generic task management:
1. Move contents of `_deferred/tasks/` back to original locations
2. Add "Tasks" nav item back to `src/config/nav.ts`
3. Add menu items back to `MoreMenuSheet.tsx`
4. Restore TaskCard imports for production/dispatch/generic
5. Run `npm run build` and fix any type errors

---

## 9. Appendix: Component Dependency Map

```
PlantHealthTaskCard (KEEP)
  └── TaskCardWrapper (KEEP)
       ├── useOfflineTaskAction (KEEP)
       │    └── task-queue.ts (KEEP)
       └── WorkerOfflineProvider (KEEP)

TaskCard.tsx (KEEP - update to handle missing modules gracefully)
  ├── ProductionTaskCard (MOVE)
  ├── DispatchTaskCard (MOVE)
  ├── PlantHealthTaskCard (KEEP)
  └── GenericTaskCard (MOVE)

/worker/task/[id]/page.tsx (KEEP)
  ├── ProductionExecutionFlow (MOVE)
  ├── PlantHealthExecutionFlow (KEEP)
  └── DispatchExecutionFlow (MOVE)

PlantHealthExecutionFlow (KEEP)
  └── calls /api/tasks/{id}/start (KEEP)
  └── calls /api/tasks/{id}/complete (KEEP)
       └── uses startTask/completeTask from service.ts (KEEP)
```
