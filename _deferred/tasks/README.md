# Deferred: Generic Task Management

**Deferred Date**: 2026-02-01
**Reason**: Simplify v1 release - managers will handle task assignment in person

## What's Deferred

This folder contains the **generic task management system** that was deferred from v1:

- **Worker task list** (`/worker/tasks`) - view all assigned tasks
- **Worker schedule** (`/worker/schedule`) - weekly schedule view
- **Desktop task overview** (`/tasks`) - task dashboard
- **Production tasks kanban** (`/tasks/production`) - production task assignment
- **Dispatch tasks kanban** (`/tasks/dispatch`) - dispatch task assignment
- **Generic task cards** - ProductionTaskCard, DispatchTaskCard, GenericTaskCard
- **Generic execution flows** - ProductionExecutionFlow, DispatchExecutionFlow
- **Generic task API routes** - task CRUD, staff list, my-tasks, schedule

## What's Still Active

The following task-related functionality is **still active** in v1:

- **Plant Health Tasks** - Full IPM task management via `ipm_tasks` table
  - `/plant-health/tasks` - IPM task kanban (desktop)
  - `/worker/task/[id]` - Task execution for plant health
  - `PlantHealthTaskCard` and `PlantHealthExecutionFlow`

- **Production Jobs** - Job planning (not task assignment)
  - `/production/jobs` - Create and manage production jobs
  - JobsKanban, CreateJobDialog, TaskWizard components
  - `/api/tasks/jobs/*` routes

- **Task Infrastructure** - Used by plant health
  - `src/server/tasks/service.ts` - task start/complete
  - `/api/tasks/[id]/start` and `/api/tasks/[id]/complete` routes

## How to Restore

To restore generic task management in a future release:

1. Move contents back to their original locations:
   ```
   _deferred/tasks/app/tasks/* → src/app/tasks/
   _deferred/tasks/app-worker/* → src/app/(worker)/worker/
   _deferred/tasks/components/* → src/components/worker/
   _deferred/tasks/api/* → src/app/api/
   ```

2. Update navigation:
   - Add "Tasks" back to `src/config/nav.ts`
   - Add "My Tasks" and "Schedule" back to `src/components/worker/MoreMenuSheet.tsx`

3. Update component exports:
   - Add ProductionTaskCard, DispatchTaskCard, GenericTaskCard to `src/components/worker/cards/index.ts`
   - Add ProductionExecutionFlow, DispatchExecutionFlow to `src/components/worker/execution/index.ts`
   - Update `src/components/worker/TaskCard.tsx` to handle all modules

4. Update worker task detail page:
   - Import and render all execution flows in `src/app/(worker)/worker/task/[id]/page.tsx`

5. Run `npm run build` and fix any type errors

## File Structure

```
_deferred/tasks/
├── app/tasks/                    # Desktop task pages
│   ├── page.tsx                  # Task overview (deferred)
│   ├── error.tsx
│   ├── TasksOverviewClient.tsx
│   ├── production/               # Production task kanban
│   └── dispatch/                 # Dispatch task kanban
├── app-worker/                   # Worker task pages
│   ├── tasks/page.tsx           # Task list
│   └── schedule/page.tsx        # Weekly schedule
├── components/
│   ├── cards/                    # Task card components
│   │   ├── ProductionTaskCard.tsx
│   │   ├── DispatchTaskCard.tsx
│   │   └── GenericTaskCard.tsx
│   └── execution/                # Execution flow components
│       ├── ProductionExecutionFlow.tsx
│       └── DispatchExecutionFlow.tsx
└── api/
    ├── tasks/route.ts           # Generic task CRUD
    └── worker/                   # Worker task APIs
        ├── my-tasks/
        ├── search-tasks/
        └── schedule/
```
