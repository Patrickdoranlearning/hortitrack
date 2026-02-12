# Plan: Auto-refresh data after mutations (CSV upload, add, delete, edit)

## Problem
All 5 data management pages require a manual browser refresh to see changes after:
- CSV upload
- Quick inline add (Save row)
- Delete
- Form save (edit/add via modal)

## Root Cause
Pages use `useCollection` hook which has its own in-memory cache (5-min TTL).
After mutations, `invalidateReferenceData()` clears the SWR cache but NOT the `useCollection` cache.
The `forceRefresh()` function exists in `useCollection` but is never called.

## Fix (all 5 pages)
1. Destructure `forceRefresh` from `useCollection`
2. Call `await forceRefresh()` after every successful mutation
3. Keep `invalidateReferenceData()` too (for SWR-based dropdowns elsewhere in the app)

## Affected Pages
- `src/app/suppliers/page.tsx` — suppliers
- `src/app/varieties/page.tsx` — plant_varieties
- `src/app/sizes/page.tsx` — plant_sizes
- `src/app/locations/page.tsx` — nursery_locations
- `src/app/hauliers/page.tsx` — suppliers (filtered to haulier type)

## Mutation Points Per Page (suppliers as example)
1. `handleQuickAdd` (line ~192) — after `addSupplierAction`
2. `handleUploadCsv` (line ~268) — after CSV import loop
3. `handleDelete` (line ~281) — after `deleteSupplierAction`
4. Form save callback (line ~366) — after `addSupplierAction`/`updateSupplierAction`

## Risk
- Low. `forceRefresh` already exists and is well-tested logic.
- No schema changes, no new dependencies.
