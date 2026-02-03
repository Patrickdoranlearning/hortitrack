# Bug Fix Plan - Critical UI and Data Bugs

**Status**: Complete
**Created**: 2025-02-03
**Completed**: 2025-02-03
**Estimated Sessions**: 1

---

## Overview

This plan addresses 5 critical bugs identified from user-reported issues that are causing errors, data loss, or blocked workflows.

---

## Bug Summary

| Bug | Severity | Component | Root Cause |
|-----|----------|-----------|------------|
| #1 VAT number not saving | Critical | Business Settings | Missing DB columns (`vat_number`, `company_reg_number`, etc.) |
| #2 Locations page crash | Critical | `/locations` | Empty string in `SelectItem` value prop |
| #3 Supplier data issues | Medium | Suppliers page | Already working - just verifying |
| #4 Haulier delete not working | High | `/hauliers` | FK constraints not handled gracefully |
| #5 Dropdowns not scrolling | High | Check-in/Planning modals | Missing `max-height` on `SelectContent` |

---

## Phase 1: Database Schema Fix (Bug #1)

### Task 1.1: Add missing columns to organizations table

**Current state**: The `organizations` table is missing these columns:
- `vat_number` (text)
- `company_reg_number` (text)
- `bank_name` (text)
- `bank_iban` (text)
- `bank_bic` (text)
- `default_payment_terms` (integer, default 30)
- `invoice_prefix` (text, default 'INV')
- `invoice_footer_text` (text)

**Action**: Apply migration to add these columns.

**Assigned to**: `data-engineer`

### Phase 1 Complete When:
- [ ] All columns exist in organizations table
- [ ] VAT number saves and loads correctly

---

## Phase 2: UI Component Fixes (Bugs #2, #5)

### Task 2.1: Fix Locations page crash (Bug #2)

**File**: `/src/components/location-form.tsx`
**Line**: 166
**Issue**: `<SelectItem value="">None</SelectItem>` - empty string value causes Radix Select to crash
**Fix**: Change to `<SelectItem value="__none__">None</SelectItem>` and handle the sentinel value

### Task 2.2: Fix Locations page inline form (Bug #2)

**File**: `/src/app/locations/page.tsx`
**Lines**: 500-506
**Issue**: `site.id` could be undefined/empty causing crash
**Fix**: Filter sites without valid IDs or use sentinel value

### Task 2.3: Fix dropdown scrolling (Bug #5)

**Files affected**:
- `/src/app/production/planning/components/IncomingBatchDialog.tsx` (variety, size, supplier, location selects)

**Issue**: Large lists aren't scrollable because `SelectContent` lacks `max-height`
**Fix**: Add `className="max-h-[300px]"` to SelectContent components

**Assigned to**: `feature-builder`

### Phase 2 Complete When:
- [ ] Locations page loads without crash
- [ ] Site dropdown works with "None" option
- [ ] Variety dropdown scrolls in Incoming Batch dialog
- [ ] Supplier dropdown scrolls in Incoming Batch dialog

---

## Phase 3: Delete Handling (Bug #4)

### Task 3.1: Improve haulier delete with FK constraint handling

**File**: `/src/app/actions.ts` - `deleteHaulierAction`
**Issue**: Delete fails silently due to FK constraints from:
- `haulier_vehicles`
- `delivery_runs`
- `haulier_trolley_balance`
- `pending_balance_transfers`

**Fix**:
1. Check for related records before delete
2. Return meaningful error message
3. Optionally: cascade delete vehicles or soft-delete haulier

**Assigned to**: `feature-builder`

### Phase 3 Complete When:
- [ ] Haulier delete shows clear error if in use
- [ ] Haulier delete works when no related records exist
- [ ] User gets actionable feedback

---

## Phase 4: Verification

### Task 4.1: Verify supplier data (Bug #3)

**Files**: `/src/app/suppliers/page.tsx`, `/src/app/actions.ts`
**Action**: Verify supplier CRUD operations are working correctly

### Task 4.2: Full verification of all fixes

- [ ] VAT number saves and reloads
- [ ] Locations page loads without errors
- [ ] Can add location with "None" site
- [ ] Haulier delete works or shows meaningful error
- [ ] Variety dropdown scrolls in Check-in modal
- [ ] Supplier dropdown scrolls in Planning modal

**Assigned to**: `verifier`

---

## Definition of Done

1. All 5 bugs are fixed
2. No new console errors introduced
3. TypeScript compiles without errors
4. Each fix verified manually

---

## Handoff Notes

### For data-engineer (Phase 1):
- Apply migration for missing organization columns
- Columns should be nullable except `default_payment_terms` (default 30) and `invoice_prefix` (default 'INV')

### For feature-builder (Phases 2-3):
- Use `"__none__"` sentinel value pattern for optional Select fields
- Handle FK constraint errors gracefully with user-friendly messages
- Add `max-h-[300px]` to SelectContent for scrollable dropdowns

### Execution Mode
- **Recommended**: `standard`
- No schema-breaking changes
- All fixes are additive or safe modifications
