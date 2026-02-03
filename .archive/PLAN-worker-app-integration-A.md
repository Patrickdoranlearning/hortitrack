# PLAN: Worker App Integration - Maximum Code Reuse

**Perspective**: Maximum code reuse and DRY principles
**Feature**: Worker App Integration with Main App
**Created**: 2026-02-01
**Status**: Draft

---

## Executive Summary

This plan prioritizes eliminating code duplication between the worker app and main app by creating a shared component library and unified API layer. The goal is to have a single source of truth for forms, validation, and business logic.

---

## Current State Analysis

### Identified Issues

1. **Duplicate Forms**:
   - Main app: `PropagationClient.tsx` (290 lines) - uses react-hook-form, server actions
   - Worker app: `PropagationForm.tsx` (489 lines) - custom state, fetch API
   - Both do the same thing with different implementations

2. **Duplicate Transplant Flows**:
   - Main app: `BulkTransplantClient.tsx` - with ReferenceDataProvider
   - Worker app: `TransplantWizard.tsx` - custom implementation

3. **404 Error in "My Active Work"**:
   - `WorkerOfflineProvider.tsx` calls `/api/worker/my-tasks` (line 228)
   - This API route is in `_deferred/tasks/` folder (disabled)
   - Tasks removed from all modules except Plant Health

4. **Task System State**:
   - Production/Dispatch tasks: Deferred (in `_deferred/tasks/`)
   - Plant Health tasks: Active (`/src/app/plant-health/tasks/page.tsx`)
   - Worker app still expects the deferred task API

### Existing Shared Components (Potential Reuse)

| Component | Location | Notes |
|-----------|----------|-------|
| Reference data fetching | `/api/lookups/reference-data` | Already shared |
| Variety/Size/Location selects | Various | Could be unified |
| Batch creation APIs | `/api/production/batches/propagate` | Exists |
| UI components | `/src/components/ui/` | shadcn/ui - already shared |

---

## Proposed Architecture

### Shared Form Components

```
src/components/shared/forms/
  PropagationForm/
    PropagationForm.tsx      # Core form logic
    PropagationForm.schema.ts # Zod validation
    PropagationForm.types.ts  # TypeScript types
    index.ts
  TransplantForm/
    TransplantWizard.tsx
    TransplantWizard.schema.ts
    index.ts
  selectors/
    VarietySelector.tsx      # Unified variety picker
    SizeSelector.tsx         # Unified size picker
    LocationSelector.tsx     # Unified location picker
    index.ts
```

### Form Component Props Pattern

```typescript
interface SharedFormProps<T> {
  // Data sources
  varieties: Variety[];
  sizes: Size[];
  locations: Location[];

  // Callbacks
  onSuccess: (result: T) => void;
  onCancel?: () => void;

  // Presentation variants
  variant: 'desktop' | 'mobile';

  // Optional presets
  defaultValues?: Partial<FormValues>;
}
```

---

## Phase 1: Fix 404 Error (Priority: Critical)

**Goal**: Fix the immediate 404 error in worker app

### Task 1.1: Update WorkerOfflineProvider for Plant-Health-Only Tasks
- **Agent**: `feature-builder`
- **Files**: `/src/offline/WorkerOfflineProvider.tsx`
- **Action**:
  - Modify to ONLY fetch plant health tasks (since other modules deferred)
  - Use existing IPM tasks API or create minimal endpoint
  - Remove references to production/dispatch tasks
- **Acceptance**: Worker app loads without 404 error

### Task 1.2: Create Minimal Plant Health Task Endpoint
- **Agent**: `feature-builder`
- **Files**: `/src/app/api/worker/plant-health-tasks/route.ts`
- **Action**: Create endpoint that returns IPM tasks for current user
- **Acceptance**: Worker app shows plant health tasks in "My Active Work"

### Phase 1 Complete When:
- [ ] Worker app loads without HTTP errors
- [ ] Plant health tasks display in worker app
- [ ] No console errors related to task fetching

---

## Phase 2: Create Shared Form Infrastructure

**Goal**: Build the foundation for shared forms

### Task 2.1: Create Shared Selector Components
- **Agent**: `feature-builder`
- **Files**:
  - `/src/components/shared/selectors/VarietySelector.tsx`
  - `/src/components/shared/selectors/SizeSelector.tsx`
  - `/src/components/shared/selectors/LocationSelector.tsx`
- **Action**: Extract common selector logic from both apps
- **Acceptance**: Components work in both desktop and mobile contexts

### Task 2.2: Create Unified Propagation Form Schema
- **Agent**: `feature-builder`
- **Files**: `/src/components/shared/forms/propagation/schema.ts`
- **Action**: Merge validation from both implementations
- **Acceptance**: Single Zod schema validates all propagation inputs

### Task 2.3: Create Shared PropagationForm Component
- **Agent**: `feature-builder`
- **Files**: `/src/components/shared/forms/propagation/PropagationForm.tsx`
- **Action**:
  - Build single form component with `variant` prop
  - Desktop variant: original styling
  - Mobile variant: large touch targets, haptic feedback
- **Acceptance**: Form works correctly in both contexts

### Phase 2 Complete When:
- [ ] Shared selectors work in both apps
- [ ] PropagationForm has desktop and mobile variants
- [ ] No duplicate form code

---

## Phase 3: Migrate Main App

**Goal**: Main app uses shared components

### Task 3.1: Update Main Propagation Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/production/batches/new/propagation/PropagationClient.tsx`
- **Action**: Replace with shared PropagationForm (desktop variant)
- **Acceptance**: Main app propagation works identically

### Task 3.2: Update Main Transplant Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/production/batches/new/bulk-transplant/BulkTransplantClient.tsx`
- **Action**: Integrate shared components where applicable
- **Acceptance**: Main app transplant works identically

### Phase 3 Complete When:
- [ ] Main app uses shared form components
- [ ] No functionality regression
- [ ] Tests pass

---

## Phase 4: Migrate Worker App

**Goal**: Worker app uses shared components

### Task 4.1: Update Worker Propagation Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/production/propagate/page.tsx`
- **Action**: Replace with shared PropagationForm (mobile variant)
- **Acceptance**: Worker propagation works with mobile UX

### Task 4.2: Update Worker Transplant Page
- **Agent**: `feature-builder`
- **Files**: `/src/app/(worker)/worker/production/transplant/page.tsx`
- **Action**: Replace with shared TransplantWizard (mobile variant)
- **Acceptance**: Worker transplant works with mobile UX

### Task 4.3: Delete Redundant Worker Components
- **Agent**: `feature-builder`
- **Files**:
  - DELETE `/src/components/worker/production/PropagationForm.tsx`
  - DELETE `/src/components/worker/production/TransplantWizard.tsx`
  - DELETE `/src/app/(worker)/worker/batches/create/page.tsx`
- **Action**: Remove duplicate implementations
- **Acceptance**: No orphan code

### Phase 4 Complete When:
- [ ] Worker app uses shared form components
- [ ] Duplicate files removed
- [ ] Mobile UX preserved (haptics, touch targets)

---

## Phase 5: Verify Plant Health Integration

**Goal**: Confirm plant health tasks work in both apps

### Task 5.1: Test Plant Health Tasks in Main App
- **Agent**: `tester-tim`
- **Files**: Test `/src/app/plant-health/tasks/page.tsx`
- **Action**: Verify IPM task workflow end-to-end
- **Acceptance**: Can create, view, complete IPM tasks

### Task 5.2: Test Plant Health Tasks in Worker App
- **Agent**: `tester-tim`
- **Files**: Test `/src/app/(worker)/worker/plant-health/page.tsx`
- **Action**: Verify mobile IPM workflow
- **Acceptance**: Worker can view and complete IPM tasks on mobile

### Phase 5 Complete When:
- [ ] Plant health tasks work in main app
- [ ] Plant health tasks work in worker app
- [ ] Task data syncs correctly

---

## Technical Decisions

### Form Submission Strategy
- **Decision**: Use server actions for both apps
- **Rationale**: Consistent behavior, automatic loading states, type safety
- **Alternative considered**: Separate fetch-based API for worker (rejected - duplication)

### State Management for Forms
- **Decision**: react-hook-form with Zod
- **Rationale**: Already used in main app, good mobile support
- **Alternative considered**: Custom useState (rejected - more code)

### Mobile Haptics
- **Decision**: Apply haptics via wrapper/hook, not in form component
- **Rationale**: Keeps form logic pure, haptics are presentation concern

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regression in main app | Medium | High | Test thoroughly before removing old code |
| Mobile UX degradation | Medium | Medium | Keep haptics/touch targets in mobile variant |
| Performance impact | Low | Low | Shared components are smaller than duplicates |
| Migration complexity | Medium | Medium | Phase incrementally, rollback plan |

---

## Files To Delete (After Migration)

```
/src/components/worker/production/PropagationForm.tsx (489 lines)
/src/components/worker/production/TransplantWizard.tsx
/src/components/worker/production/ParentBatchSelector.tsx
/src/components/worker/production/ActualizeSheet.tsx
/src/app/(worker)/worker/batches/create/page.tsx (597 lines)
```

**Total Lines Removed**: ~1500+ lines of duplicate code

---

## Session Estimate

| Phase | Sessions | Notes |
|-------|----------|-------|
| Phase 1 | 0.5 | Quick fix for 404 |
| Phase 2 | 1.5 | Core shared infrastructure |
| Phase 3 | 1 | Main app migration |
| Phase 4 | 1 | Worker app migration |
| Phase 5 | 0.5 | Testing & verification |
| **Total** | **4.5** | Assumes standard mode |

---

## Definition of Done

- [ ] Zero 404 errors in worker app
- [ ] Single PropagationForm component used by both apps
- [ ] Single TransplantWizard component used by both apps
- [ ] All shared selectors work in both contexts
- [ ] No duplicate form implementations
- [ ] Plant health tasks work in worker app
- [ ] Mobile UX preserved (haptics, large touch targets)
- [ ] All existing tests pass
- [ ] ~1500 lines of code removed

---

## Handoff Notes for Jimmy

### Recommended Mode: `standard`

### DB Work Required: No
- No schema changes needed
- API changes are additive or fixes

### First Agent: `feature-builder`
- Start with Phase 1 Task 1.1 (fix 404 error)

### Critical Dependencies:
- Must fix 404 before other work can be tested
- Must verify plant health tasks work before modifying task system

### Watch Out For:
- The deferred tasks folder structure - don't accidentally re-enable
- Haptics library usage in mobile variant
- Reference data API differences between apps
