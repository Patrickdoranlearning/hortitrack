# Mini Plan: Quick Saleable Form Fixes

**Created**: 2026-02-04
**Status**: Ready

## Goal

Fix two issues in the Quick Saleable feature:
1. Photo upload failing with ".catch is not a function" error
2. "Looking Good" status has incorrect description

## Issues Analysis

### Issue 1: Photo Upload Error

**Error**: `supabase.from(...).insert(...).catch is not a function`

**Root Cause**: In `/src/app/api/batches/[batchId]/photos/route.ts` at line 119-132, the code uses:
```typescript
await supabase.from("batch_events").insert({...}).catch(() => {...});
```

The Supabase client's query builder returns a `PostgrestBuilder` object, not a standard Promise. While it's thenable (has `.then()`), it does NOT have a `.catch()` method. This causes the runtime error.

**File**: `/src/app/api/batches/[batchId]/photos/route.ts`
**Lines**: 119-132

**Fix**: Wrap the call in a try/catch block or use `.then(null, errorHandler)`:
```typescript
// Option A: try/catch (recommended)
try {
  await supabase.from("batch_events").insert({...});
} catch {
  console.warn("Failed to log photo upload event");
}

// Option B: .then() with error handler
supabase.from("batch_events").insert({...}).then(null, () => {
  console.warn("Failed to log photo upload event");
});
```

### Issue 2: "Looking Good" Description

**Problem**: Current description says "On track, not quite ready" but should indicate:
- "Saleable and looking particularly good (better than just saleable)"
- Looking Good = IS ready for sale AND looks better than average

**File**: `/src/components/batches/LogActionWizard/forms/QuickSaleableForm.tsx`
**Lines**: 27-31

**Current**:
```typescript
const STATUS_OPTIONS = [
  { value: 'Ready for Sale', label: 'Ready for Sale', description: 'Available to sell now' },
  { value: 'Looking Good', label: 'Looking Good', description: 'On track, not quite ready' },
  { value: '', label: 'No Change', description: 'Keep current status' },
] as const;
```

**Fix**: Change "Looking Good" description to accurately reflect it means premium quality AND saleable:
```typescript
{ value: 'Looking Good', label: 'Looking Good', description: 'Saleable & premium quality' },
```

## Tasks

- [ ] Fix `.catch()` error in `/src/app/api/batches/[batchId]/photos/route.ts`
  - Replace `.catch()` with try/catch block
  - Lines 119-132

- [ ] Update "Looking Good" description in `/src/components/batches/LogActionWizard/forms/QuickSaleableForm.tsx`
  - Change from "On track, not quite ready" to "Saleable & premium quality"
  - Line 29

- [ ] Verify: Run TypeScript check to ensure no type errors

## Files Changed

1. `/src/app/api/batches/[batchId]/photos/route.ts` - Fix .catch() pattern
2. `/src/components/batches/LogActionWizard/forms/QuickSaleableForm.tsx` - Fix status description

## Notes

- The "Looking Good" status has `behavior: "available"` in `attributeOptions.ts` (line 123), confirming it IS meant to be saleable
- Both fixes are localized, low-risk changes
- No database changes required
