# Project Status

> This file is maintained by AI agents to preserve context between sessions.
> Update this before ending a session. Reference it at the start of new sessions.

## Current Milestone
- [x] Plant Health Module Completion (PLAN-plant-health-completion.md) - COMPLETE
- [x] Worker App Core (PLAN-worker-app.md Phases 1-5) - COMPLETE
- [x] Worker App Expansion (Phases 6-10) - COMPLETE
- [x] Security Remediation (PLAN-security-remediation.md) - ALL PHASES COMPLETE
- [x] Worker Picking Enhancement (PLAN-worker-picking-enhancement.md) - COMPLETE
- [x] Multi-Batch Picking (PLAN-multi-batch-picking.md) - COMPLETE

## Last Session Summary
_Update this section at the end of each working session_

**Date**: 2026-02-10
**Focus**: Codebase Consistency Remediation (happy-marinating-globe.md)
**Mode**: Standard

**Work Completed:**

### Codebase Consistency Remediation — 4-Phase Plan (Phases 1-3 COMPLETE, Phase 4 partial)

**Phase 1: Quick Wins** (COMPLETE)
- Toast imports consolidated to `@/lib/toast` across 80+ files
- Response helpers merged — `src/server/http/responses.ts` deleted, all using `@/server/utils/envelope`
- Legacy duplicate routes deleted: `api/batches/checkin` and `api/batches/propagation-start`
- Loading state names standardized

**Phase 2: Error Handling & Logging** (COMPLETE)
- `ActionResult<T>` pattern adopted across all server action files
- console.* calls reduced from **864 → ~55** (target was <50). Remaining ~20 are legitimate (logger.ts itself, log.ts, dev-bypass, commented-out)
- 10 new logger modules added: labels, email, planning, protocols, media, documents, b2b, suppliers, org, tasks
- `src/server/observability/logger.ts` deleted (consolidated into `src/server/utils/logger.ts`)
- 4 parallel agents cleaned 150+ files across server, API routes, components, pages

**Phase 3: Auth & Security** (COMPLETE)
- `getUserAndOrg()` now returns **regular** Supabase client (RLS-enforced) instead of admin
- New `getUserAndOrgAdmin()` for explicit admin access (documented when to use)
- `getUserIdAndOrgId()` deprecated with `@deprecated` JSDoc tag
- `src/app/api/org/members/[userId]/route.ts` migrated to `getUserAndOrgAdmin` (modifies other users)
- `withApiGuard` pattern documented for incremental adoption (6 routes already using it, 245 candidates)

**Phase 4: Architecture** (partial)
- SaleableBatchesClient.tsx pre-existing syntax error fixed (stray `});`)
- TypeScript build verified: only 1 pre-existing error (supabase.ts generated types)

**Key Metrics:**
| Metric | Before | After |
|--------|--------|-------|
| console.* calls | 864 | ~55 (20 legitimate) |
| Logger modules | 14 | 24 |
| Files using ActionResult | ~60% | ~95% |
| TypeScript errors | 3 | 1 (generated types only) |
| getUserAndOrg returns admin client | Yes | No (security fix) |

---

### Previous Session: Multi-Batch Picking as DEFAULT (COMPLETE)

Per user requirement: **"Picking from multiple batches should be the standard, not the exception."**

**What Changed:**
1. **Desktop UI**: Clicking "Pick" now opens `MultiBatchPickDialog` by default
   - Auto-suggests optimal batch selection using FEFO (oldest first)
   - Pre-fills quantities to meet target
   - Shows running total, progress bar
   - Warns for short picks
   - Single-batch is now a special case (one batch selected)

2. **Worker App UI**: `MultiBatchPickSheet` is now the primary picking interface
   - Mobile-optimized Sheet component (swipe up)
   - Large touch targets (48px min)
   - Stepper controls for quantity
   - "Auto-fill FEFO" button
   - Expandable batch quantity controls

3. **Database Schema**: `pick_item_batches` junction table
   - Stores individual batch picks for multi-batch scenarios
   - When `picked_batch_id IS NULL` and `picked_qty > 0`, check this table

4. **RPC Functions**:
   - `pick_item_multi_batch`: Atomic multi-batch picking
   - `restore_batch_quantity`: Helper for undo operations
   - Updated `reject_pick_list_atomic`: Now handles multi-batch picks on QC rejection

5. **API Endpoints** (already existed, now verified working):
   - `PUT /api/picking/[pickListId]/items/[itemId]/batches` - Multi-batch pick
   - `GET /api/picking/[pickListId]/items` - Now includes `batchPicks[]`

**Files Created:**
- `supabase/migrations/20260201100000_multi_batch_picking.sql`
- `src/components/sales/MultiBatchPickDialog.tsx`
- `src/components/worker/picking/MultiBatchPickSheet.tsx`

**Files Modified:**
- `src/components/sales/PickItemCard.tsx` - Multi-batch as default
- `src/app/dispatch/picking/[pickListId]/PickingWorkflowClient.tsx` - Added multi-batch handler
- `src/components/worker/picking/PickItemDialog.tsx` - Integrated MultiBatchPickSheet
- `src/app/(worker)/worker/picking/[pickListId]/page.tsx` - Updated prop passing

**Migration Pending:**
- `20260201100000_multi_batch_picking.sql` needs to be applied to production database

---

### Previous Session: Phase 1: Database & API Foundation (COMPLETE)
1. **Created `pick_item_batches` junction table:**
   - Junction table for multi-batch picking support
   - RLS enabled with org_isolation policy
   - Indexes on pick_item_id, batch_id, org_id
   - Updated_at trigger with fixed search_path

2. **Created `pick_item_multi_batch` RPC:**
   - Atomic multi-batch picking operation
   - Handles inventory deduction, allocation updates, event logging
   - Maintains backward compatibility with picked_batch_id

3. **Created `restore_batch_quantity` helper RPC:**
   - For undo/remove batch pick functionality

4. **Updated `getPickItems` service:**
   - Added BatchPick interface and batchPicks array
   - Fetches batch picks with batch details

5. **Updated API endpoints:**
   - PUT `/api/picking/[pickListId]/items/[itemId]/batches` - Multi-batch pick
   - DELETE `/api/picking/[pickListId]/items/[itemId]/batches?pickId=xxx` - Remove batch pick
   - GET now includes `includePicks` option

### Phase 2: Enhanced Pick Flow UI (COMPLETE)
1. **Created `PickingBatchSelector.tsx`:**
   - Multi-tab interface: Available, Scan, Type, Search
   - Real-time quantity tracking
   - Batch selection with +/- controls
   - Scanner integration via ScannerClient

2. **Created `PickingItemCard.tsx`:**
   - Progress bar showing picked/target
   - Multi-batch display with badges
   - "SCAN TO CFRM" button for pending items
   - Status indicators (picked, short, substituted)

3. **Updated worker picking page:**
   - Integrated new components
   - Added handleMultiBatchPick handler
   - Uses PickingBatchSelector as primary picker

### Phase 3: Trolley Step (COMPLETE)
1. **Created `PickingTrolleyStep.tsx`:**
   - Mobile-optimized trolley assignment sheet
   - Trolley number scan/entry
   - Trolley type selection from attribute_options
   - Shelf count input
   - "FINISH & STAGE TROLLEY" action

2. **Integrated trolley step into picking page:**
   - Shows when all items picked
   - "FINISH & STAGE" button opens trolley sheet
   - Trolley info passed to complete handler

**Files Created:**
- `src/components/worker/picking/PickingBatchSelector.tsx`
- `src/components/worker/picking/PickingItemCard.tsx`
- `src/components/worker/picking/PickingTrolleyStep.tsx`

**Files Modified:**
- `src/lib/database.types.ts` - Added pick_item_batches type
- `src/server/sales/picking.ts` - Added BatchPick, multi-batch functions
- `src/app/api/picking/[pickListId]/items/[itemId]/batches/route.ts` - Added PUT, DELETE
- `src/app/(worker)/worker/picking/[pickListId]/page.tsx` - Integrated new components

**Database Migrations Applied:**
- `create_pick_item_batches_table`
- `create_pick_item_multi_batch_rpc`
- `create_restore_batch_quantity_rpc`
- `fix_pick_item_batches_trigger_search_path`

**Validation Results:**
- TypeScript: PASS (no errors in picking-related files)
- RLS Policy: PASS (org_isolation policy verified)
- Security Audit: PASS (search_path fixed on all functions)

**Remaining Work (Phase 4):**
- Product images in pick cards (P2)
- Haptic feedback on scan (already implemented)
- Offline handling improvements
- End-to-end testing
- Touch target verification (>= 48px)

## Active Blockers
_Issues preventing progress_

- None currently

## Technical Debt
_Known issues to address_

- `src/types/supabase.ts` generated types has a syntax error — regenerate with `supabase gen types`
- ~35 non-legitimate console.* calls remain in client-side code (lib/, hooks/, stores/, offline/)
- `withApiGuard` only used in 6/251 API routes — adopt incrementally for new routes
- `getUserIdAndOrgId` deprecated but still used internally in `getUser.ts` — consider full removal
- Worker API consolidation (multiple similar patterns) — see Phase 4 of remediation plan

## Next Steps
_Priority order for next session_

1. Remaining console.* cleanup in client-side code (~35 calls in lib/, hooks/, stores/, offline/)
2. `withApiGuard` adoption for new API routes going forward
3. Regenerate Supabase types (`supabase gen types`) to fix types/supabase.ts error
4. Manual testing of multi-batch picking flow
5. Worker API pattern consolidation

## Recent Decisions
_Important architectural or design decisions made_

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-01 | Shared worker types in `src/types/worker.ts` | Client components cannot import from server-only route files |
| 2026-02-01 | Batch context fetching for scan-lookup | Avoids N+1 queries when multiple tasks found |
| 2026-02-01 | Dev-only logging for client-side reference data | Structured logger is server-only |
| 2026-02-01 | Use Recharts native types for chart components | Better type safety, no custom type definitions needed |
| 2026-02-01 | Centralized `escapePostgrestFilter` utility | Single point to fix/test SQL injection, consistent sanitization |
| 2026-02-01 | `withWorkerGuard` wrapper for worker APIs | Consistent auth, rate limiting, logging without code duplication |
| 2026-02-01 | Validate x-org-id header against org_memberships | Prevents header spoofing to access other orgs' data |
| 2026-02-01 | Runtime assertion in dev-bypass | Fail-fast if misconfigured in production |
| 2026-02-10 | getUserAndOrg returns regular client, not admin | RLS enforcement by default; explicit getUserAndOrgAdmin for admin ops |
| 2026-02-10 | 24 logger modules (was 14) | Module-scoped structured logging for all domains |
| 2026-02-10 | withApiGuard incremental adoption | Don't migrate 245 routes at once; use for new routes |
| 2026-01-31 | Worker App as route group `/worker` not separate app | Shared auth, DB, faster delivery, no deploy pipeline overhead |

## Files Recently Modified
_For quick context on what's been touched_

**P2/P3 Remediation Session (2026-02-01):**
- src/app/api/picking/route.ts (fixed `any[]` type)
- src/app/production/batches/BatchesClient.tsx (fixed 5 `any` type usages)
- src/app/api/worker/task/[id]/route.ts (removed unused parameters)

**Build Fix Session (2026-02-01):**
- src/types/worker.ts (NEW - shared worker types)
- src/app/api/worker/materials/[id]/route.ts (import from shared types)
- src/app/api/worker/scout/route.ts (import from shared types)
- src/app/api/worker/stats/route.ts (import from shared types)
- src/app/api/worker/locations/route.ts (import from shared types)
- src/app/api/worker/team/[userId]/route.ts (import from shared types)
- src/app/api/worker/batches/route.ts (import from shared types)
- src/app/api/worker/batches/[id]/route.ts (import from shared types)
- src/app/api/worker/team/route.ts (import from shared types)
- src/app/api/worker/schedule/route.ts (import from shared types)
- src/app/(worker)/worker/materials/[id]/page.tsx (import from shared types)
- src/app/(worker)/worker/plant-health/page.tsx (import from shared types)
- src/app/(worker)/worker/stats/page.tsx (import from shared types)
- src/app/(worker)/worker/locations/page.tsx (import from shared types)
- src/app/(worker)/worker/team/[userId]/page.tsx (import from shared types)
- src/app/(worker)/worker/batches/page.tsx (import from shared types)
- src/app/(worker)/worker/batches/[id]/page.tsx (import from shared types)
- src/app/(worker)/worker/scout/batch/[id]/page.tsx (import from shared types)
- src/app/(worker)/worker/team/page.tsx (import from shared types)
- src/app/(worker)/worker/schedule/page.tsx (import from shared types)
- src/app/(worker)/worker/production/page.tsx (import from shared types)

**Code Quality Session (2026-02-01):**
- src/server/utils/logger.ts (added production, sales, materials, ai, cache, refdata modules)
- src/app/api/picking/route.ts (structured logging, type fixes)
- src/app/api/picking/[pickListId]/route.ts (structured logging, type fixes)
- src/app/api/picking/reorder/route.ts (structured logging, type fixes)
- src/app/api/picking/teams/route.ts (structured logging, type fixes)
- src/app/api/picking/teams/[teamId]/route.ts (structured logging, type fixes)
- src/app/api/picking/teams/[teamId]/members/route.ts (structured logging, type fixes)
- src/app/api/picking/[pickListId]/items/route.ts (structured logging, type fixes)
- src/app/api/picking/[pickListId]/items/[itemId]/batches/route.ts (structured logging, type fixes)
- src/server/sales/allocation.ts (type fixes, structured logging)
- src/server/documents/render.ts (type fixes - DocumentData, TableRowData)
- src/components/charts/LossTrendChart.tsx (Recharts type fixes)
- src/components/charts/AvailabilityDonut.tsx (Recharts type fixes)
- src/components/charts/BatchAgeHistogram.tsx (Recharts type fixes)
- src/components/charts/VarietyTreemap.tsx (Recharts type fixes)
- src/app/api/worker/scan-lookup/route.ts (N+1 query fix with batch enrichment)
- src/app/api/worker/task/[id]/route.ts (unused parameter fix)
- src/lib/referenceData/service.ts (dev-only logging)
- src/app/production/batches/BatchesClient.tsx (dev-only logging)

**Security Remediation (2026-02-01):**
- src/server/db/sanitize.ts (new - SQL injection prevention utilities)
- src/server/db/scoped-client.ts (new - org-scoped client wrapper)
- src/server/http/worker-guard.ts (new - worker API guard with rate limiting)
- src/server/auth/dev-bypass.ts (hardened with production guard)
- src/server/security/auth.ts (structured logging)
- src/server/security/rateLimit.ts (structured logging)
- src/server/http/guard.ts (structured logging)
- src/app/api/lookups/[resource]/route.ts (org membership validation)
- src/app/api/sales/orders/[orderId]/route.ts (org_id filter)
- src/app/api/worker/print/search/route.ts (SQL injection fix)
- src/app/api/worker/batches/route.ts (SQL injection fix)
- src/app/api/worker/batches/[id]/actions/route.ts (error handling)
- src/app/api/catalog/locations/route.ts (SQL injection fix)
- src/app/api/locations/route.ts (SQL injection fix)
- src/components/worker/WorkerErrorBoundary.tsx (new)
- src/app/(worker)/worker/layout.tsx (added error boundary)

---

## How to Use This File

**Starting a session**:
```
@STATUS.md What's the current state? What should I work on?
```

**Ending a session**:
```
Update STATUS.md with what we accomplished and what's next
```
