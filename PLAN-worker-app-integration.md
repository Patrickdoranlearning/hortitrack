# PLAN: Worker App Integration (Final)

**Feature**: Worker App Integration with Main App
**Created**: 2026-02-01
**Status**: Complete
**Synthesized From**: Plan A (Maximum Code Reuse) + Plan B (Worker-Optimized UX)

---

## Dual-Plan Evaluation

### Perspectives Explored

| Plan | Perspective | File |
|------|-------------|------|
| A | Maximum code reuse and DRY principles | PLAN-worker-app-integration-A.md |
| B | Worker-optimized UX, mobile-first | PLAN-worker-app-integration-B.md |

### Comparison Matrix

| Criterion | Plan A | Plan B | Winner |
|-----------|--------|--------|--------|
| Requirements fit | *** | **** | B |
| Complexity | **** | ** | B |
| Risk | Medium | Low | B |
| Code reduction | ~1500 lines | ~50 lines | A |
| Sessions | 4.5 | 3.5 | B |
| Worker UX impact | Potential degradation | Preserved | B |
| Maintenance burden | Lower long-term | Slightly higher | A |

### Key Differences

| Aspect | Plan A | Plan B |
|--------|--------|--------|
| Forms | Single shared component with variants | Separate mobile-optimized components |
| UI components | Force shared UI | Keep separate, share only logic |
| Scope | Aggressive refactoring | Surgical fixes |
| Philosophy | DRY above all | Right tool for job |

### Recommendation

**Selected: Synthesized Plan (Best of Both)**

**Rationale**:
1. The 404 error is the critical issue - both plans fix it the same way
2. Worker forms ALREADY work and are mobile-optimized - Plan A's refactoring is unnecessary risk
3. Plan B's approach of sharing logic but keeping UI separate is pragmatic
4. However, Plan A correctly identifies that shared schemas/types/utils are valuable
5. The 3.5 session estimate is more realistic than 4.5

---

## Synthesized Approach

### From Plan B (Primary):
- Keep worker UI components separate (already optimized)
- Fix 404 by updating WorkerOfflineProvider
- Create plant-health-only task endpoint
- Focus on making Plant Health work in worker app
- Lower risk, faster delivery

### From Plan A:
- Extract shared Zod schemas (validation)
- Extract shared TypeScript types
- Extract shared calculation utilities
- Clean separation between shared logic and UI

---

## Executive Summary

The worker app has a 404 error because it calls a deferred task API. Tasks have been intentionally removed from Production/Dispatch modules, leaving only Plant Health tasks active. This plan fixes the 404, ensures Plant Health tasks work in the worker app, and extracts shared logic (not UI) between apps.

---

## Phase 1: Fix the 404 Error (Priority: Critical)

**Goal**: Worker app loads without errors

### Task 1.1: Update WorkerOfflineProvider
- **Agent**: `feature-builder`
- **Files**: `/src/offline/WorkerOfflineProvider.tsx`
- **Action**:
  - Change API call from `/api/worker/my-tasks` to new plant-health endpoint
  - Add graceful error handling (empty array fallback)
  - Filter to only expect `plant_health` module tasks
- **Acceptance Criteria**:
  - [ ] Worker app loads without 404 error
  - [ ] No console errors related to task fetching
  - [ ] Cached data still works when offline

### Task 1.2: Create Plant Health Tasks Endpoint
- **Agent**: `feature-builder`
- **Files**: `/src/app/api/worker/plant-health-tasks/route.ts`
- **Action**:
  - Create new endpoint for IPM tasks only
  - Query `ipm_tasks` table for current user's assigned tasks
  - Include batch context for display
  - Return in WorkerTask format expected by provider
- **Acceptance Criteria**:
  - [ ] Returns valid JSON array
  - [ ] Includes pending, assigned, in_progress tasks
  - [ ] Respects RLS (org_id scoping)

### Task 1.3: Simplify Production Landing Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/production/page.tsx`
- **Action**:
  - Remove "My Active Work" section (references deferred tasks)
  - Keep: Quick actions (Propagate, Transplant, Check In, Batches)
  - Keep: Recent Batches section
  - Clean up task-related imports
- **Acceptance Criteria**:
  - [ ] Production tab loads without errors
  - [ ] Quick action buttons work
  - [ ] Recent batches display correctly

### Phase 1 Complete When:
- [ ] Worker app loads without HTTP errors
- [ ] Production tab works with simplified layout
- [ ] Plant Health tab fetches tasks without errors
- [ ] All navigation works

---

## Phase 2: Ensure Plant Health Works End-to-End

**Goal**: Workers can view and complete IPM tasks

### Task 2.1: Verify Plant Health Landing Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/plant-health/page.tsx`
- **Action**:
  - Verify IPM tasks display in "IPM Tasks Due" section
  - Verify Treatment Schedule section works
  - Ensure task cards are tappable and lead to correct flows
- **Acceptance Criteria**:
  - [ ] IPM tasks appear when assigned to user
  - [ ] Treatment schedule shows pending treatments
  - [ ] Can tap to view task details

### Task 2.2: Add Quick Treatment Completion
- **Agent**: `feature-builder`
- **Files**: `/src/components/worker/scout/TreatmentScheduleCard.tsx`
- **Action**:
  - Add "Complete" button to treatment cards
  - Implement inline completion flow
  - Use existing `completeTasks` action from main app
- **Acceptance Criteria**:
  - [ ] Can complete treatment from worker app
  - [ ] Completion syncs to database
  - [ ] Task disappears from pending list

### Task 2.3: Test Offline Task Handling
- **Agent**: `verifier`
- **Action**:
  - Verify tasks cached locally
  - Verify task actions queue when offline
  - Verify sync when back online
- **Acceptance Criteria**:
  - [ ] Tasks viewable offline
  - [ ] Actions queue correctly
  - [ ] Sync works on reconnect

### Phase 2 Complete When:
- [ ] Plant Health tasks visible in worker app
- [ ] Can complete treatments from worker app
- [ ] Offline mode works for tasks
- [ ] No errors in any Plant Health flows

---

## Phase 3: Extract Shared Logic

**Goal**: Share validation and business logic between apps

### Task 3.1: Create Shared Schema Directory
- **Agent**: `feature-builder`
- **Files**:
  - `/src/lib/shared/schemas/propagation.ts`
  - `/src/lib/shared/schemas/transplant.ts`
  - `/src/lib/shared/schemas/index.ts`
- **Action**:
  - Extract Zod schemas from main app
  - Export for use in both apps
  - Include all validation rules and error messages
- **Acceptance Criteria**:
  - [ ] Schemas defined once in shared location
  - [ ] Schemas importable by both apps
  - [ ] Same validation in both contexts

### Task 3.2: Create Shared Types
- **Agent**: `feature-builder`
- **Files**:
  - `/src/lib/shared/types/batch.ts`
  - `/src/lib/shared/types/reference-data.ts`
  - `/src/lib/shared/types/index.ts`
- **Action**:
  - Define Variety, Size, Location types once
  - Define common response types
  - Export for use in both apps
- **Acceptance Criteria**:
  - [ ] Types defined once
  - [ ] No duplicate type definitions
  - [ ] Both apps use shared types

### Task 3.3: Create Shared Utilities
- **Agent**: `feature-builder`
- **Files**:
  - `/src/lib/shared/utils/calculations.ts`
  - `/src/lib/shared/utils/index.ts`
- **Action**:
  - Extract `calculateTotalPlants(containers, cellMultiple)`
  - Extract any other shared business logic
- **Acceptance Criteria**:
  - [ ] Utility functions in shared location
  - [ ] Both apps use same calculations

### Task 3.4: Update Apps to Use Shared Logic
- **Agent**: `feature-builder`
- **Files**:
  - Main app propagation form
  - Worker app propagation form
  - Main app transplant form
  - Worker app transplant wizard
- **Action**:
  - Import schemas from shared
  - Import types from shared
  - Import utils from shared
  - Keep UI implementations separate
- **Acceptance Criteria**:
  - [ ] Both apps import from `/src/lib/shared/`
  - [ ] No validation logic duplicated
  - [ ] UI components unchanged

### Phase 3 Complete When:
- [ ] Shared schemas in `/src/lib/shared/schemas/`
- [ ] Shared types in `/src/lib/shared/types/`
- [ ] Shared utils in `/src/lib/shared/utils/`
- [ ] Both apps using shared logic
- [ ] All forms still work correctly

---

## Phase 4: Verification

**Goal**: Everything works as specified

### Task 4.1: Verify Worker App Flows
- **Agent**: `tester-tim`
- **Spec Reference**: FEATURES.md Section 7 (Worker Mobile Experience)
- **Test Cases**:
  - [ ] WKR-1: See tasks for today (Plant Health only)
  - [ ] WKR-2: Complete tasks from phone
  - [ ] WKR-3: Scan QR codes
  - [ ] WKR-4: Work offline
- **Acceptance Criteria**: All FEATURES.md criteria pass

### Task 4.2: Verify Main App Not Affected
- **Agent**: `tester-tim`
- **Test Cases**:
  - [ ] Propagation form works
  - [ ] Transplant form works
  - [ ] Plant Health tasks page works
- **Acceptance Criteria**: No regressions

### Task 4.3: Verify Shared Logic Works in Both Contexts
- **Agent**: `verifier`
- **Test Cases**:
  - [ ] Same validation errors in both apps
  - [ ] Same calculations in both apps
- **Acceptance Criteria**: Consistent behavior

### Phase 4 Complete When:
- [ ] All worker flows tested
- [ ] Main app verified
- [ ] Shared logic verified
- [ ] No regressions

---

## Technical Notes

### Why Deferred Tasks Are Deferred

The `_deferred/tasks/` folder contains a generic task system that was built but intentionally disabled. Reasons:

1. Too complex for current needs
2. Plant Health has its own IPM task system that works well
3. Production/Dispatch don't need generic tasks right now
4. May be re-enabled in future when needed

**DO NOT**: Try to re-enable or fix the deferred task system. It's intentionally parked.

### What We're Actually Building

1. A bridge between worker app and Plant Health IPM tasks
2. Shared logic layer (schemas, types, utils)
3. Simplified worker production page (no tasks)

---

## Session Estimate

| Phase | Sessions | Notes |
|-------|----------|-------|
| Phase 1 | 0.5 | Fix 404, simplify production page |
| Phase 2 | 1 | Plant Health worker integration |
| Phase 3 | 0.5 | Extract shared logic |
| Phase 4 | 0.5 | Verification |
| **Total** | **2.5** | Conservative estimate |

---

## Definition of Done

- [ ] Zero 404 errors in worker app
- [ ] Production tab loads cleanly (no task section)
- [ ] Plant Health tasks visible and completable in worker app
- [ ] Shared validation schemas in `/src/lib/shared/`
- [ ] Shared types in `/src/lib/shared/`
- [ ] Shared utils in `/src/lib/shared/`
- [ ] Worker UX unchanged (haptics, touch targets preserved)
- [ ] Main app unaffected
- [ ] All tests pass
- [ ] Offline mode works

---

## Handoff Notes for Jimmy

### Recommended Mode: `standard`

### DB Work Required: No
- No schema changes
- No migrations
- Only API route additions

### First Agent: `feature-builder`
- Start with Phase 1 Task 1.1 (fix WorkerOfflineProvider)
- This unblocks everything else

### Critical Dependencies:
- Phase 1 must complete before Phase 2 can be tested
- Phase 2 must complete before Phase 3 (verify what works first)

### What NOT To Do:
- DO NOT re-enable or modify anything in `_deferred/tasks/`
- DO NOT refactor worker UI components (they work fine)
- DO NOT force shared UI components between apps

### Key Files:
- 404 Source: `/src/offline/WorkerOfflineProvider.tsx` line 228
- Deferred API: `/_deferred/tasks/api/worker/my-tasks/route.ts`
- Working IPM tasks: `/src/app/plant-health/tasks/page.tsx`
- Plant Health actions: `/src/app/actions/ipm-tasks.ts`

### After Completion:
- Archive Plan A and Plan B to `.archive/`
- Update STATUS.md with completion notes
