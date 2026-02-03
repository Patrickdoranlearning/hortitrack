# PLAN: Worker App Integration - Worker-Optimized UX

**Perspective**: Worker-optimized UX with mobile-first, simplified workflows
**Feature**: Worker App Integration with Main App
**Created**: 2026-02-01
**Status**: Draft

---

## Executive Summary

This plan prioritizes the worker experience, recognizing that workers have fundamentally different needs than managers using the main app. While some code sharing is beneficial, this plan maintains separate, purpose-built worker components optimized for speed, glove-friendly operation, and outdoor conditions.

---

## Key Insight: Different Users, Different Needs

| Aspect | Main App (Manager) | Worker App |
|--------|-------------------|------------|
| Device | Desktop/laptop | Phone (often older) |
| Context | Office, seated | Field, standing, moving |
| Hands | Free, clean | Gloved, dirty, wet |
| Time per action | Can take time | Needs to be fast |
| Network | Stable WiFi | Spotty cellular |
| Screen | Large | Small, bright sun |
| Input | Keyboard/mouse | Touch only |

**Conclusion**: Forcing shared components may harm the worker experience. Better to share backend logic and keep UX separate.

---

## Current State Analysis

### What's Actually Broken

1. **404 Error in "My Active Work"**:
   - Root cause: `/api/worker/my-tasks` is in `_deferred/tasks/` (disabled)
   - `WorkerOfflineProvider.tsx` still calls this endpoint
   - **Fix**: Update provider to not call deferred API

2. **Task System Reality**:
   - Production/Dispatch tasks: DEFERRED (intentionally disabled)
   - Plant Health tasks: ACTIVE and working
   - Worker app should only show Plant Health tasks

3. **Forms Work Fine**:
   - Worker propagation form: Works, mobile-optimized
   - Worker transplant wizard: Works, mobile-optimized
   - Not broken, just duplicate code

### What's Actually Good

| Worker Feature | Status | Notes |
|----------------|--------|-------|
| Propagation form | Working | Mobile-optimized, haptics |
| Transplant wizard | Working | Multi-step, parent batch selection |
| Batch viewing | Working | Card-based, scannable |
| Plant health scouting | Working | Photo capture, severity slider |
| QR scanning | Working | Fast, reliable |
| Offline caching | Partially working | Tasks 404, batches work |

---

## Proposed Architecture

### Keep Worker Components Separate

```
src/components/worker/           # Worker-specific components
  production/
    PropagationForm.tsx         # KEEP - mobile optimized
    TransplantWizard.tsx        # KEEP - mobile optimized
    ParentBatchSelector.tsx     # KEEP - touch-friendly
  scout/
    ScoutIssueSelector.tsx      # KEEP - worker-specific
    PhotoCapture.tsx            # KEEP - camera handling
  ...

src/lib/shared/                  # Shared LOGIC only
  schemas/
    propagation.schema.ts       # Validation rules
    transplant.schema.ts        # Validation rules
  types/
    batch.types.ts              # Shared types
  utils/
    calculations.ts             # Plant count math, etc.
```

### Philosophy: Share Logic, Not UI

```typescript
// GOOD: Shared validation
import { propagationSchema } from '@/lib/shared/schemas/propagation';

// GOOD: Shared types
import type { PropagationInput } from '@/lib/shared/types/propagation';

// GOOD: Shared utility
import { calculateTotalPlants } from '@/lib/shared/utils/calculations';

// NOT: Shared UI component forced into both contexts
// import { PropagationForm } from '@/components/shared/PropagationForm'; // AVOID
```

---

## Phase 1: Fix the 404 Error (Priority: Critical)

**Goal**: Worker app loads without errors

### Task 1.1: Update WorkerOfflineProvider to Skip Deferred Tasks
- **Agent**: `feature-builder`
- **Files**: `/src/offline/WorkerOfflineProvider.tsx`
- **Action**:
  - Change fetch URL from `/api/worker/my-tasks` to `/api/worker/plant-health-tasks` (new endpoint)
  - Or: Add try/catch with graceful fallback to empty array
  - Update task filtering to only expect plant_health module
- **Acceptance**: Worker app loads, no 404, no console errors

### Task 1.2: Create Plant-Health-Only Task Endpoint
- **Agent**: `feature-builder`
- **Files**: `/src/app/api/worker/plant-health-tasks/route.ts`
- **Action**:
  - Create lightweight endpoint for IPM tasks
  - Return only plant_health tasks for current user
  - Include batch context for display
- **Acceptance**: Endpoint returns valid JSON, worker app can fetch

### Task 1.3: Update Production Landing Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/production/page.tsx`
- **Action**:
  - Remove "My Active Work" section (deferred tasks don't apply)
  - Keep quick actions: Propagate, Transplant, Check In, Batches
  - Simplify to just Recent Batches + actions
- **Acceptance**: Production tab works without task references

### Phase 1 Complete When:
- [ ] Worker app loads without any HTTP errors
- [ ] Production tab shows quick actions and recent batches
- [ ] Plant Health tab shows IPM tasks correctly
- [ ] No references to deferred task system

---

## Phase 2: Optimize Plant Health Worker Flow

**Goal**: Plant Health tasks work seamlessly in worker app

### Task 2.1: Enhance Plant Health Landing Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/plant-health/page.tsx`
- **Action**:
  - Show IPM tasks prominently
  - Add quick "Complete Treatment" button per task
  - Improve scan-to-scout flow
- **Acceptance**: Workers can view and complete IPM tasks efficiently

### Task 2.2: Create Mobile Treatment Completion Flow
- **Agent**: `feature-builder`
- **Files**: `/src/components/worker/plant-health/TreatmentCompletionSheet.tsx`
- **Action**:
  - Bottom sheet for quick treatment completion
  - Pre-populated with product/rate info
  - Large confirm button, haptic feedback
  - Optional compliance fields (collapsible)
- **Acceptance**: Complete treatment in < 30 seconds

### Task 2.3: Add Treatment History to Batch Detail
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/batches/[id]/page.tsx`
- **Action**:
  - Show treatment history when viewing batch
  - Visual timeline of IPM events
- **Acceptance**: Worker can see batch treatment history

### Phase 2 Complete When:
- [ ] IPM tasks visible in worker Plant Health tab
- [ ] Can complete treatments from worker app
- [ ] Batch detail shows treatment history
- [ ] All flows work offline with sync

---

## Phase 3: Extract Shared Logic (Not UI)

**Goal**: Share validation and business logic, keep UI separate

### Task 3.1: Create Shared Propagation Schema
- **Agent**: `feature-builder`
- **Files**: `/src/lib/shared/schemas/propagation.ts`
- **Action**:
  - Extract Zod schema from main app
  - Use in both main app form and worker app form
  - Include all validation rules
- **Acceptance**: Both apps use same validation

### Task 3.2: Create Shared Calculation Utils
- **Agent**: `feature-builder`
- **Files**: `/src/lib/shared/utils/plant-calculations.ts`
- **Action**:
  - Extract `calculateTotalPlants(containers, cellMultiple)`
  - Any other shared math
- **Acceptance**: Both apps use same calculations

### Task 3.3: Create Shared Types
- **Agent**: `feature-builder`
- **Files**: `/src/lib/shared/types/index.ts`
- **Action**:
  - Define Variety, Size, Location types once
  - Export for use in both apps
- **Acceptance**: Type definitions not duplicated

### Task 3.4: Update Both Apps to Use Shared Logic
- **Agent**: `feature-builder`
- **Files**:
  - Main app propagation
  - Worker app propagation
- **Action**: Import from shared, keep UI implementations separate
- **Acceptance**: Both apps work, use shared logic

### Phase 3 Complete When:
- [ ] Shared schemas in `/src/lib/shared/`
- [ ] Shared utils in `/src/lib/shared/`
- [ ] Both apps import from shared
- [ ] UI components remain separate

---

## Phase 4: Polish Worker Experience

**Goal**: Best-in-class mobile experience

### Task 4.1: Improve Haptic Feedback
- **Agent**: `feature-builder`
- **Files**: `/src/lib/haptics.ts`, various worker components
- **Action**:
  - Audit all touch interactions
  - Add haptic feedback where missing
  - Ensure vibration patterns are consistent
- **Acceptance**: Every action gives tactile confirmation

### Task 4.2: Improve Offline Indicators
- **Agent**: `feature-builder`
- **Files**: `/src/components/worker/OfflineIndicator.tsx`
- **Action**:
  - Clear visual when offline
  - Pending sync count indicator
  - Auto-sync notification when back online
- **Acceptance**: Workers always know connectivity state

### Task 4.3: Improve Loading States
- **Agent**: `feature-builder`
- **Files**: Various worker components
- **Action**:
  - Skeleton loaders for all lists
  - Progressive loading for forms
  - Optimistic updates where safe
- **Acceptance**: App feels responsive even on slow connections

### Task 4.4: Verify Touch Targets
- **Agent**: `ui-comprehensive-tester`
- **Files**: All worker components
- **Action**:
  - All buttons minimum 44x44px
  - Adequate spacing between targets
  - Works with gloved fingers
- **Acceptance**: No tap frustration

### Phase 4 Complete When:
- [ ] Consistent haptic feedback
- [ ] Clear offline indicators
- [ ] Smooth loading states
- [ ] Touch-friendly throughout

---

## Phase 5: Verification

**Goal**: Everything works as expected

### Task 5.1: End-to-End Worker Flow Testing
- **Agent**: `tester-tim`
- **Action**: Test complete worker workflows
  - Propagation: Create batch successfully
  - Transplant: Create child batch successfully
  - Scout: Record observation with photo
  - Treatment: Complete IPM task
- **Acceptance**: All flows work end-to-end

### Task 5.2: Offline Testing
- **Agent**: `ui-comprehensive-tester`
- **Action**:
  - Disable network in browser
  - Perform actions
  - Re-enable, verify sync
- **Acceptance**: Offline mode works correctly

### Task 5.3: Verify Main App Not Affected
- **Agent**: `tester-tim`
- **Action**: Test main app forms still work
- **Acceptance**: No regressions in main app

### Phase 5 Complete When:
- [ ] All worker flows tested
- [ ] Offline mode verified
- [ ] Main app unaffected
- [ ] Sign-off from team

---

## Technical Decisions

### Why NOT Share UI Components

| Reason | Explanation |
|--------|-------------|
| Touch targets | Worker needs 44px+ buttons; main app uses standard sizing |
| Haptics | Worker uses vibration feedback; main app doesn't |
| Loading | Worker shows skeletons; main app may use different patterns |
| Layout | Worker is single-column; main app uses grid |
| Styling | Worker needs high contrast for outdoor use |
| Complexity | Shared component with variants adds conditional logic |

### What TO Share

| Share | Why |
|-------|-----|
| Zod schemas | Same validation rules |
| TypeScript types | Same data shapes |
| Calculations | Same business logic |
| API endpoints | Same backend |
| Database | Same data |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing worker forms | Low | High | Don't modify working code in Phase 1-2 |
| Task 404 persists | Low | High | Phase 1 explicitly fixes this |
| Plant health tasks don't work | Low | Medium | Test thoroughly in Phase 2 |
| Shared logic breaks both apps | Low | Medium | Good test coverage |

---

## Files Modified (Not Deleted)

This plan keeps existing worker components and only modifies:

```
/src/offline/WorkerOfflineProvider.tsx       # Fix 404
/src/app/(worker)/worker/production/page.tsx # Remove task section
/src/app/(worker)/worker/plant-health/page.tsx # Enhance
+ New shared logic files in /src/lib/shared/
+ New API endpoint for plant health tasks
```

**Lines of Code Impact**: Minimal changes to existing code

---

## Session Estimate

| Phase | Sessions | Notes |
|-------|----------|-------|
| Phase 1 | 0.5 | Fix 404 + update production page |
| Phase 2 | 1 | Plant health worker enhancements |
| Phase 3 | 0.5 | Extract shared logic |
| Phase 4 | 1 | Polish and UX improvements |
| Phase 5 | 0.5 | Testing |
| **Total** | **3.5** | Assumes standard mode |

---

## Definition of Done

- [ ] Zero 404 errors in worker app
- [ ] Production tab works without task system
- [ ] Plant Health tasks visible and completable in worker app
- [ ] Shared validation logic in `/src/lib/shared/`
- [ ] Shared calculation utils in `/src/lib/shared/`
- [ ] Worker UX remains optimized for mobile/field use
- [ ] Offline mode works
- [ ] All touch targets 44px+
- [ ] Haptic feedback on all actions

---

## Handoff Notes for Jimmy

### Recommended Mode: `standard`

### DB Work Required: No
- No schema changes needed
- Only API route additions

### First Agent: `feature-builder`
- Start with Phase 1 Task 1.1 (fix WorkerOfflineProvider)

### Critical Dependencies:
- Must understand deferred tasks were INTENTIONALLY disabled
- Plant Health is the ONLY active task module
- Don't try to re-enable deferred task system

### Watch Out For:
- `_deferred/tasks/` folder - leave it alone
- Worker forms already work - don't break them
- Mobile haptics - important for worker UX
- Offline caching - critical for field use

### Key Difference from Plan A:
- This plan KEEPS worker UI components separate
- Only shares logic (schemas, types, utils)
- Prioritizes worker experience over code reduction
