# PLAN: Plant Health Module Audit Fixes

**Created**: 2026-02-04
**Status**: Complete
**Completed**: 2026-02-04
**Feature**: Plant Health Module - Security, Quality & Feature Fixes
**Estimated Sessions**: 3-4
**Actual Sessions**: 1
**Recommended Mode**: `thorough`

---

## Overview

This plan addresses the issues identified in the Plant Health module audit. The audit found security vulnerabilities, missing features, and code quality issues that need to be resolved to meet FEATURES.md specifications and production standards.

---

## Audit Summary

### High Priority (Security & Critical)
| ID | Issue | File | Impact |
|----|-------|------|--------|
| SEC-1 | Missing input validation | `src/app/actions/plant-health.ts` | Empty strings allowed for required fields |
| SCOUT-2 | Photo upload TODO | `src/components/plant-health/scout/ScoutWizard.tsx:146` | Feature incomplete per FEATURES.md |
| CQ-1 | No error boundaries | Multiple components | Crashes propagate to full page |
| SEC-4 | Missing RBAC for deletes | `src/app/actions/ipm.ts` | Any user can delete programs/products |

### Feature Gaps (vs FEATURES.md)
| Gap | Spec Reference | Current State |
|-----|----------------|---------------|
| Photo upload | SCOUT-2 | UI exists, upload not wired |
| Batch-only treatment | IPM-4 | Cannot schedule for batch-only scans |
| Critical alerts | SCOUT-3 | Severity stored, no alert triggered |
| WHI enforcement | Health Rules | Stored but not checked during picking |

### Medium Priority
| ID | Issue | File | Impact |
|----|-------|------|--------|
| ERR-1 | Silent errors | `src/app/actions/ipm-tasks.ts:640-643` | Log insert failures swallowed |
| RATE-1 | No rate limiting | `src/app/actions/ipm-tasks.ts` | Bulk ops can overload DB |
| CQ-2 | 978-line component | `ProgramWizard.tsx` | Maintainability, no tests |
| TYPE-1 | `any` type usage | `src/app/plant-health/programs/page.tsx:140` | Type safety violation |

---

## Phase 1: Security Fixes (Priority: Critical)

**Goal**: Address all security vulnerabilities before any feature work.

### Task 1.1: Add Zod Validation Schemas to plant-health.ts
**Agent**: `feature-builder`
**Files**: `src/app/actions/plant-health.ts`

**Changes**:
```typescript
// Add at top of file
import { z } from 'zod';

// Define validation schemas
const treatmentInputSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  productName: z.string().min(1, 'Product name required').max(200),
  rate: z.number().positive('Rate must be positive'),
  unit: z.string().min(1, 'Unit required'),
  method: z.string().min(1, 'Method required'),
  reiHours: z.number().min(0, 'REI hours must be non-negative'),
  notes: z.string().max(1000).optional(),
  ipmProductId: z.string().uuid().optional(),
  bottleId: z.string().uuid().optional(),
  quantityUsedMl: z.number().positive().optional(),
});

const flagLocationInputSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  issueReason: z.string().min(1, 'Issue reason required').max(500),
  severity: z.enum(['low', 'medium', 'critical']),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
  affectedBatchIds: z.array(z.string().uuid()).optional(),
});

const scoutLogInputSchema = z.object({
  locationId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  logType: z.enum(['issue', 'reading']),
  issueReason: z.string().min(1).max(500).optional(),
  severity: z.enum(['low', 'medium', 'critical']).optional(),
  ec: z.number().min(0).max(10).optional(),
  ph: z.number().min(0).max(14).optional(),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
  affectedBatchIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.locationId || data.batchId,
  'Either locationId or batchId is required'
);

const scheduleTreatmentInputSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  treatmentType: z.enum(['chemical', 'mechanical', 'feeding']),
  productId: z.string().uuid().optional(),
  productName: z.string().min(1).max(200).optional(),
  rate: z.number().positive().optional(),
  rateUnit: z.string().optional(),
  method: z.string().optional(),
  applicationsTotal: z.number().int().positive().optional(),
  applicationIntervalDays: z.number().int().positive().optional(),
  mechanicalAction: z.enum(['trimming', 'spacing', 'weeding', 'removing']).optional(),
  fertilizerName: z.string().optional(),
  fertilizerRate: z.number().positive().optional(),
  fertilizerUnit: z.string().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  notes: z.string().max(1000).optional(),
  triggeredByLogId: z.string().uuid().optional(),
});
```

**Update each action to validate**:
```typescript
export async function applyLocationTreatment(
  input: TreatmentInput
): Promise<PlantHealthResult<{ count: number }>> {
  // Validate input first
  const validation = treatmentInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }
  // ... rest of function
}
```

**Acceptance Criteria**:
- [ ] All public server actions validate input with Zod
- [ ] Empty strings rejected for required fields
- [ ] UUID format validated for all ID fields
- [ ] Numeric ranges validated (EC 0-10, pH 0-14, etc.)
- [ ] Error messages are user-friendly

---

### Task 1.2: Add Role-Based Access Control for Delete Operations
**Agent**: `feature-builder` -> `security-auditor`
**Files**:
- `src/app/actions/ipm.ts`
- `src/server/auth/permissions.ts` (new or existing)

**Changes**:
Create permission check helper:
```typescript
// src/server/auth/permissions.ts
export async function requireRole(allowedRoles: string[]): Promise<void> {
  const { user, supabase } = await getUserAndOrg();

  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!member || !allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions');
  }
}
```

Update delete functions:
```typescript
export async function deleteIpmProgram(id: string): Promise<IpmResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Check role - only admin/owner can delete
    await requireRole(['admin', 'owner']);

    // ... rest of function
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return { success: false, error: 'You do not have permission to delete programs' };
    }
    // ... handle other errors
  }
}
```

Apply to:
- `deleteIpmProgram`
- `deleteIpmProduct`
- Any other destructive operations

**Acceptance Criteria**:
- [ ] `deleteIpmProgram` requires admin/owner role
- [ ] `deleteIpmProduct` requires admin/owner role
- [ ] Non-admin users see "insufficient permissions" error
- [ ] UI hides delete buttons for non-admins (separate task)

---

## Phase 2: Photo Upload Implementation (Priority: High)

**Goal**: Complete the photo upload feature per FEATURES.md SCOUT-2.

### Task 2.1: Wire Photo Upload in ScoutWizard
**Agent**: `feature-builder`
**Files**:
- `src/components/plant-health/scout/ScoutWizard.tsx`
- `src/components/plant-health/scout/ScoutLogStep.tsx`

**Current State** (line 146):
```typescript
photoUrl: logData.photoPreview, // TODO: Upload photo and get URL
```

**Implementation**:
```typescript
// In ScoutWizard.tsx handleLogComplete

const handleLogComplete = useCallback(async (logData: LogData) => {
  setIsSaving(true);

  try {
    let photoUrl: string | undefined;

    // Upload photo if provided
    if (logData.photoFile) {
      const timestamp = Date.now();
      const ext = logData.photoFile.name.split('.').pop() || 'jpg';
      const path = `scouts/${wizardState.target?.location?.id || 'batch'}/${timestamp}.${ext}`;

      try {
        photoUrl = await uploadPhoto(logData.photoFile, 'plant-health', path);
      } catch (uploadError) {
        // Log but don't fail - photo is optional
        console.error('Photo upload failed:', uploadError);
        toast.warning('Photo upload failed - log saved without photo');
      }
    }

    const result = await createScoutLog({
      locationId: logData.locationId,
      logType: logData.logType,
      issueReason: logData.issue?.reason,
      severity: logData.issue?.severity,
      ec: logData.reading?.ec,
      ph: logData.reading?.ph,
      notes: logData.logType === 'issue' ? logData.issue?.notes : logData.reading?.notes,
      photoUrl, // Now using uploaded URL
      affectedBatchIds: logData.selectedBatchIds,
    });
    // ... rest of handler
  }
}, [onComplete]);
```

**Add import**:
```typescript
import { uploadPhoto } from '@/lib/storage/upload';
```

**Acceptance Criteria**:
- [ ] Photos upload to Supabase Storage `plant-health` bucket
- [ ] Upload failures logged but don't block log creation
- [ ] Photo URL stored in `plant_health_logs.photo_url`
- [ ] Photos viewable in scout history

---

### Task 2.2: Ensure Storage Bucket Exists
**Agent**: `data-engineer`
**Files**: New migration

Create storage bucket if not exists:
```sql
-- Migration: create_plant_health_storage_bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-health', 'plant-health', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for plant-health bucket
CREATE POLICY "Users can upload to their org folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'plant-health' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can view plant-health photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'plant-health');
```

**Acceptance Criteria**:
- [ ] `plant-health` storage bucket exists
- [ ] RLS allows authenticated uploads
- [ ] Public read access for photos

---

## Phase 3: Error Boundaries (Priority: High)

**Goal**: Prevent component crashes from propagating to full page.

### Task 3.1: Wrap Plant Health Components with ErrorBoundary
**Agent**: `feature-builder`
**Files**:
- `src/components/plant-health/scout/ScoutWizard.tsx`
- `src/components/plant-health/ipm/ProgramWizard.tsx`
- `src/app/plant-health/page.tsx`
- `src/app/plant-health/programs/page.tsx`
- `src/app/plant-health/scout/page.tsx`

**Pattern** (already exists in codebase):
```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

// In page component
export default function PlantHealthPage() {
  return (
    <PageFrame moduleKey="plantHealth">
      <ErrorBoundary>
        <PlantHealthContent />
      </ErrorBoundary>
    </PageFrame>
  );
}
```

For complex components like wizards:
```tsx
// ScoutWizard usage
<ErrorBoundary
  fallback={
    <Card className="p-8 text-center">
      <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
      <p className="mt-4">Scout wizard encountered an error</p>
      <Button onClick={() => window.location.reload()} className="mt-4">
        Reload Page
      </Button>
    </Card>
  }
>
  <ScoutWizard onComplete={handleComplete} />
</ErrorBoundary>
```

**Acceptance Criteria**:
- [ ] ScoutWizard wrapped with ErrorBoundary
- [ ] ProgramWizard wrapped with ErrorBoundary
- [ ] All plant-health pages have error boundaries
- [ ] Custom fallback UI shows recovery options
- [ ] Errors logged (console in dev, structured logging in prod)

---

## Phase 4: Feature Gap Fixes (Priority: Medium)

### Task 4.1: Critical Severity Alerts
**Agent**: `feature-builder`
**Files**:
- `src/app/actions/plant-health.ts`
- New: `src/server/notifications/alerts.ts`

**Implementation**:
```typescript
// In flagLocation action, after successful RPC:
if (input.severity === 'critical') {
  // Trigger alert
  await createCriticalHealthAlert({
    locationId: input.locationId,
    issueReason: input.issueReason,
    logId: rpcResult.log_id,
    orgId,
  });
}
```

Alert function:
```typescript
// src/server/notifications/alerts.ts
export async function createCriticalHealthAlert(params: {
  locationId: string;
  issueReason: string;
  logId: string;
  orgId: string;
}) {
  const supabase = await createServerClient();

  // Create notification in database
  await supabase.from('notifications').insert({
    org_id: params.orgId,
    type: 'critical_health_issue',
    title: 'Critical Plant Health Issue',
    message: `Critical issue reported: ${params.issueReason}`,
    data: { locationId: params.locationId, logId: params.logId },
    created_at: new Date().toISOString(),
  });

  // Future: Email/SMS integration
}
```

**Acceptance Criteria**:
- [ ] Critical severity creates notification
- [ ] Notification visible in dashboard (if notifications exist)
- [ ] FEATURES.md SCOUT-3 satisfied

---

### Task 4.2: Batch-Only Treatment Scheduling
**Agent**: `feature-builder`
**Files**:
- `src/components/plant-health/scout/ScoutWizard.tsx`
- `src/app/actions/plant-health.ts`

**Current limitation**: Line 189-192 prevents batch-only treatment:
```typescript
if (!targetLocation) {
  toast.error('No location selected - cannot schedule treatment for batch-only scans');
  return;
}
```

**Solution**: Modify `scheduleTreatment` to support batch-only targets:
```typescript
// In scheduleTreatment
const insertData: Record<string, any> = {
  org_id: orgId,
  target_type: input.locationId ? 'location' : 'batch',
  target_location_id: input.locationId || null,
  target_batch_id: input.batchId || null, // New field
  // ... rest
};
```

Update ScoutWizard:
```typescript
if (!targetLocation && !effectiveBatch) {
  toast.error('No target selected');
  return;
}

const result = await scheduleTreatment({
  locationId: targetLocation?.id, // Now optional
  batchId: effectiveBatch?.id, // New param
  // ...
});
```

**Acceptance Criteria**:
- [ ] Batch-only scans can schedule treatments
- [ ] UI shows batch name when no location
- [ ] Treatment links to batch_id in database
- [ ] FEATURES.md IPM-4 satisfied

---

## Phase 5: Code Quality Fixes (Priority: Medium)

### Task 5.1: Fix Silent Error Handling in ipm-tasks.ts
**Agent**: `feature-builder`
**Files**: `src/app/actions/ipm-tasks.ts`

**Current** (lines 640-643):
```typescript
if (logError) {
  console.error('[completeTasks] log insert failed', logError);
  // Don't fail the whole operation, just log the error
}
```

**Fix**:
```typescript
if (logError) {
  logError('[completeTasks] log insert failed', {
    error: logError.message,
    taskIds,
    context: 'health_log_audit_trail'
  });
  // Still don't fail the operation, but return warning
  return {
    success: true,
    data: undefined,
    warning: 'Task completed but audit log failed to save'
  };
}
```

Update return type to support warnings:
```typescript
type TaskResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string; // New
};
```

**Acceptance Criteria**:
- [ ] Errors use structured logging (logError)
- [ ] Warnings returned to caller
- [ ] UI can show warnings to user

---

### Task 5.2: Fix `any` Type in programs/page.tsx
**Agent**: `feature-builder`
**Files**: `src/app/plant-health/programs/page.tsx`

**Current** (line 140):
```typescript
setLocations(locationsResult.data.map((l: any) => ({ id: l.id, name: l.name })));
```

**Fix**:
```typescript
type LocationResult = { id: string; name: string };

// In component
setLocations(
  locationsResult.data.map((l: LocationResult) => ({ id: l.id, name: l.name }))
);
```

Or better, use the return type from `listLocations`:
```typescript
// If listLocations returns typed data
const locations = locationsResult.data as LocationResult[];
setLocations(locations.map(l => ({ id: l.id, name: l.name })));
```

**Acceptance Criteria**:
- [ ] No `any` types in programs/page.tsx
- [ ] TypeScript strict mode passes
- [ ] Types match actual API response

---

### Task 5.3: Add Rate Limiting for Bulk Operations
**Agent**: `feature-builder`
**Files**: `src/app/actions/ipm-tasks.ts`

**Implementation**:
```typescript
const BULK_RATE_LIMIT = 100; // Max tasks per request

export async function completeTasks(
  taskIds: string[],
  completionData?: ComplianceData
): Promise<TaskResult> {
  // Rate limiting
  if (taskIds.length > BULK_RATE_LIMIT) {
    return {
      success: false,
      error: `Maximum ${BULK_RATE_LIMIT} tasks can be completed at once`
    };
  }

  // Validate all IDs are UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!taskIds.every(id => uuidRegex.test(id))) {
    return { success: false, error: 'Invalid task ID format' };
  }

  // ... rest of function
}
```

Apply to:
- `completeTasks`
- `bulkGenerateTasks`

**Acceptance Criteria**:
- [ ] Bulk operations limited to 100 items
- [ ] Clear error message when limit exceeded
- [ ] Input IDs validated as UUIDs

---

## Phase 6: ProgramWizard Refactor (Priority: Low)

**Note**: This is a larger refactor. Create separate mini-plan if time permits.

### Task 6.1: Break Down ProgramWizard Component
**Agent**: `feature-builder`
**Files**: `src/components/plant-health/ipm/ProgramWizard.tsx`

**Target structure**:
```
components/plant-health/ipm/program-wizard/
├── index.tsx              # Main ProgramWizard (orchestration only)
├── ProgramDetailsStep.tsx # Step 1
├── WeekScheduleStep.tsx   # Step 2
├── AssignTargetsStep.tsx  # Step 3
├── WeekApplicationCard.tsx
├── ProductInMixForm.tsx
├── hooks/
│   └── useProgramForm.ts
└── types.ts
```

**Mini-plan created separately if pursued.**

---

## Handoff Notes for Execution

### Critical Path
1. **Phase 1** must complete first (security)
2. **Phase 2** can run parallel to Phase 3
3. **Phase 4** depends on Phase 1 completion
4. **Phase 5** can run anytime
5. **Phase 6** is optional/stretch

### DB Work Required
- Phase 2 (Task 2.2): Storage bucket migration
- Phase 4 (Task 4.1): Notifications table (if not exists)
- Phase 4 (Task 4.2): Schema update for batch-only treatments

### Testing Requirements
- All new validation schemas need unit tests
- Photo upload needs integration test
- RBAC changes need permission tests

### Risk Mitigations
| Risk | Mitigation |
|------|------------|
| Validation breaks existing clients | Add validation incrementally, test each action |
| Photo upload storage costs | Add file size limits (5MB), compression |
| RBAC locks out users | Default to permissive, test thoroughly |
| ProgramWizard refactor breaks | Skip Phase 6 if time constrained |

---

## Definition of Done

- [ ] All High Priority issues (SEC-1, SCOUT-2, CQ-1, SEC-4) resolved
- [ ] Feature gaps addressed per FEATURES.md
- [ ] No new `any` types introduced
- [ ] Error boundaries on all plant-health pages
- [ ] Photo upload working end-to-end
- [ ] RBAC prevents unauthorized deletes
- [ ] `verifier` passes (typecheck, lint, tests)
- [ ] `security-auditor` approves changes
- [ ] `tester-tim` validates against FEATURES.md

---

## Appendix: Files Changed Summary

| File | Changes |
|------|---------|
| `src/app/actions/plant-health.ts` | Zod validation, photo upload, critical alerts |
| `src/app/actions/ipm.ts` | RBAC for deletes |
| `src/app/actions/ipm-tasks.ts` | Rate limiting, error handling |
| `src/components/plant-health/scout/ScoutWizard.tsx` | Photo upload wiring, error boundary |
| `src/components/plant-health/ipm/ProgramWizard.tsx` | Error boundary wrapper |
| `src/app/plant-health/programs/page.tsx` | Fix `any` types |
| `src/app/plant-health/page.tsx` | Error boundary |
| `src/server/auth/permissions.ts` | New permission helpers |
| `src/server/notifications/alerts.ts` | New alert system |
| `supabase/migrations/*` | Storage bucket, notifications table |

---

*Plan ready for execution with `jimmy execute PLAN-plant-health-audit-fixes.md --mode thorough`*
