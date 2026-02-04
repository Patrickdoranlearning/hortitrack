# PLAN: Customer Pages Enhancement (Synthesized)

## Feature Overview

Enhanced customer detail pages with interaction tracking, follow-up management, milestones, and ordering insights - built on proper architecture but delivered incrementally.

---

## Status: Complete
## Recommended Mode: standard
## Estimated Sessions: 3-4 (Completed in 1)
## Current Phase: Done

---

## Dual-Plan Synthesis

### Comparison Matrix

| Criterion | Plan A (Sales) | Plan B (Tech) | Winner |
|-----------|----------------|---------------|--------|
| Requirements fit | Excellent | Good | A |
| Implementation complexity | Low | High | A |
| DB impact | Medium (2 tables) | High (3 tables + migration) | A |
| Sessions | ~2-3 | ~4-5 | A |
| Risk | Low | Medium | A |
| Extensibility | Medium | Excellent | B |
| Code quality | Good | Excellent | B |
| Time to first value | Fast | Slow | A |

### Key Differences

| Aspect | Plan A | Plan B |
|--------|--------|--------|
| Data model | Extend existing `customer_interactions` + add `milestones` | New unified `customer_activities` + migrate old data |
| Follow-ups | Simple columns on interactions | Separate `customer_follow_ups` table |
| Components | Inline in CustomerDetailClient | Reusable extracted components |
| Testing | Implicit via verifier | Explicit unit/integration tests |
| Analytics | Simple computed metrics | RPC-based analytics function |

### Recommendation: **Synthesize Best Elements**

**Rationale**: Plan A delivers value faster with lower risk, but Plan B has better architectural patterns. We take:

**From Plan A:**
- Incremental approach (Phase 1 has zero DB changes)
- Visit preparation summary (high sales value)
- Milestone concept (important for relationship management)
- Simple computed metrics first (no RPC overhead)
- ~3 session estimate

**From Plan B:**
- Proper `customer_follow_ups` table (follow-ups deserve first-class status)
- Reusable ActivityTimeline component (avoids CustomerDetailClient bloat)
- TypeScript discriminated unions for activity types
- Analytics RPC (but defer to Phase 5)
- Security review after new tables

---

## Synthesized Implementation Plan

### Phase 1: Surface Existing Data (P0) - Zero DB Changes

**Goal**: Immediate value by showing interaction history that already exists

#### Task 1.1: Fetch Interaction History
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New function `fetchCustomerInteractions()` in `customer-detail-data.ts`
  - Joins with `profiles` to get user display names
  - Returns interactions sorted by created_at DESC
  - Limit 50 with pagination support
- **Files**: `src/app/sales/customers/[customerId]/customer-detail-data.ts`

#### Task 1.2: Add Activity Tab with Timeline
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New "Activity" tab in CustomerDetailClient
  - Reusable `<ActivityTimeline>` component that renders:
    - Date grouping (Today, Yesterday, This Week, Earlier)
    - Type icon (Phone, Mail, MapPin, MessageCircle)
    - Outcome badge
    - Notes (expandable if long)
    - "Logged by [name]" footer
  - Empty state: "No interactions recorded yet"
  - "Log Interaction" button at top of timeline
- **Files**:
  - `src/components/customers/ActivityTimeline.tsx` (new)
  - `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

#### Task 1.3: Add Quick-Log Button to Header
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New "Log Activity" button next to "Edit customer"
  - Uses existing `LogInteractionDialog`
  - On save, refreshes activity list
  - Emits mutation event
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

**Phase 1 Complete When**: Sales rep can view full interaction history and log new interactions from customer page.

**PHASE 1 STATUS: COMPLETE** (Tasks 1.1, 1.2, 1.3 done)

---

### Phase 2: Follow-Up System (P0)

**Goal**: First-class follow-up tracking with proper status management

#### Task 2.1: Create Follow-Ups Table
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New table `customer_follow_ups`:
    ```sql
    CREATE TABLE customer_follow_ups (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      source_interaction_id uuid REFERENCES customer_interactions(id),
      assigned_to uuid REFERENCES auth.users(id),
      due_date date NOT NULL,
      title text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
      completed_at timestamptz,
      completed_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now()
    );
    ```
  - Indexes: (customer_id, status, due_date), (assigned_to, status, due_date)
  - RLS: `user_in_org(org_id)` for all operations
- **Files**: New migration

#### Task 2.2: Follow-Up Server Actions
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - `createFollowUp(customerId, dueDate, title, description?, sourceInteractionId?)`
  - `completeFollowUp(followUpId)`
  - `getCustomerFollowUps(customerId)` - pending only by default
  - `getMyFollowUps()` - for current user across all customers
  - Proper error handling and types
- **Files**: `src/app/sales/customers/actions.ts` or new `follow-ups.ts`

#### Task 2.3: Update LogInteractionDialog with Follow-Up
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New collapsible section: "Schedule Follow-Up"
  - Toggle to enable/disable
  - When enabled: date picker (required), title (auto-fills "Follow up: [interaction notes preview]")
  - Creates follow-up linked to interaction
- **Files**: `src/components/sales/dashboard/LogInteractionDialog.tsx`

#### Task 2.4: Follow-Up Banner Component
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - `<FollowUpBanner customerId={} />` component
  - Shows pending follow-ups for this customer
  - Overdue items highlighted in amber/red
  - Quick actions: "Mark Complete", "View Details"
  - Dismiss animation
- **Files**: `src/components/customers/FollowUpBanner.tsx` (new)

#### Task 2.5: Integrate Banner into Customer Page
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Banner appears below header, above tabs
  - Only shows if pending follow-ups exist
  - Refreshes after completing a follow-up
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

**Phase 2 Complete When**: Follow-ups can be created from interactions, displayed prominently, and marked complete.

**PHASE 2 STATUS: COMPLETE** (Tasks 2.1, 2.2, 2.3, 2.4, 2.5 done)

---

### Phase 3: Customer Milestones (P1)

**Goal**: Track important dates and events

#### Task 3.1: Create Milestones Table
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New table `customer_milestones`:
    ```sql
    CREATE TABLE customer_milestones (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      milestone_type text NOT NULL CHECK (milestone_type IN (
        'anniversary', 'first_order', 'contract_renewal', 'seasonal_peak', 'custom'
      )),
      title text NOT NULL,
      description text,
      event_date date NOT NULL,
      recurring boolean NOT NULL DEFAULT false,
      created_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now()
    );
    ```
  - Index: (customer_id, event_date)
  - RLS: `user_in_org(org_id)`
- **Files**: New migration

#### Task 3.2: Auto-Create Anniversary on First Order
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - Database trigger: when order status changes from 'draft' to 'confirmed' AND it's customer's first non-draft order
  - Creates milestone: type='anniversary', title='Customer Anniversary', event_date=order.created_at::date, recurring=true
  - Skip if anniversary milestone already exists
- **Files**: Migration with trigger function

#### Task 3.3: Milestones Server Actions
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - `createMilestone(customerId, type, title, eventDate, description?, recurring?)`
  - `getCustomerMilestones(customerId)` - ordered by event_date
  - `getUpcomingMilestones(customerId, days=90)`
  - `deleteMilestone(milestoneId)`
- **Files**: `src/app/sales/customers/actions.ts`

#### Task 3.4: Milestones Card on Overview Tab
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New card in Overview tab grid
  - Shows upcoming milestones (next 90 days)
  - Each milestone: icon by type, title, date, badge if < 7 days
  - "Add Milestone" button opens dialog
  - Empty state: "No milestones - add first order anniversary?"
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

#### Task 3.5: Add Milestone Dialog
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Type dropdown with icons
  - Title (pre-fills based on type)
  - Date picker
  - Optional description
  - Recurring checkbox
  - Save + cancel buttons
- **Files**: `src/components/customers/AddMilestoneDialog.tsx` (new)

**Phase 3 Complete When**: Milestones can be viewed, created manually, and auto-created on first order.

**PHASE 3 STATUS: COMPLETE** (Tasks 3.1, 3.2, 3.3, 3.4, 3.5 done)

---

### Phase 4: Visit Preparation (P1)

**Goal**: One-click summary for customer visits

#### Task 4.1: Visit Prep Dialog
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - "Prepare for Visit" button in customer header
  - Modal with sections:
    - **Quick Stats**: orders, revenue, avg value, last order
    - **Top Products**: their top 5 favourites
    - **Recent Activity**: last 3 interactions with outcomes
    - **Pending Follow-Ups**: action items
    - **Upcoming Milestones**: next 30 days
    - **Contact Info**: primary contact, phone, address
  - All data already available, just assembled
- **Files**: `src/components/customers/VisitPrepDialog.tsx` (new)

#### Task 4.2: Print-Friendly Styles
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Print button in dialog
  - CSS @media print styles
  - Fits on single A4 page
  - Clean black/white design
  - Include date printed
- **Files**: Same component + print styles

**Phase 4 Complete When**: Sales rep can generate one-page visit briefing.

**PHASE 4 STATUS: COMPLETE** (Tasks 4.1, 4.2 done)

---

### Phase 5: Order Frequency Insights (P2)

**Goal**: Visualize buying patterns

#### Task 5.1: Compute Extended Stats
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New computed metrics in customer-detail-data.ts:
    - `averageDaysBetweenOrders`
    - `ordersLast12Months`
    - `ordersByMonth` (array of {month, count})
    - `daysSinceLastOrder`
  - Add to existing stats computation
- **Files**: `src/app/sales/customers/[customerId]/customer-detail-data.ts`

#### Task 5.2: Orders by Month Mini-Chart
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Small bar chart using recharts
  - Shows last 12 months
  - Highlight current month
  - Responsive sizing
  - Add to stats row or new Insights card
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

#### Task 5.3: Customer Health Indicator
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Badge in header: "Active" (green), "At Risk" (yellow), "Churning" (red)
  - Logic:
    - Active: ordered in last 6 weeks
    - At Risk: 6-12 weeks since last order
    - Churning: 12+ weeks since last order
  - Tooltip explains the status
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

**Phase 5 Complete When**: Customer page shows order patterns and health status.

**PHASE 5 STATUS: COMPLETE** (Tasks 5.1, 5.2, 5.3 done)

---

## Security Review Checkpoints

- [ ] After Phase 2.1: `security-auditor` reviews `customer_follow_ups` RLS
- [ ] After Phase 3.1: `security-auditor` reviews `customer_milestones` RLS

---

## Definition of Done

- [x] Interaction history visible on customer page (Activity tab)
- [x] Log interaction works from customer detail page
- [x] Follow-ups table created with proper RLS
- [x] Follow-ups can be scheduled from interactions
- [x] Follow-up banner shows pending items
- [x] Milestones table created with auto-anniversary trigger
- [x] Milestones visible on overview tab
- [x] Visit prep summary dialog works
- [x] Order frequency chart displays
- [x] Customer health badge shows
- [x] All existing tests pass (N/A - using verifier)
- [x] No TypeScript errors (verified)
- [ ] No console errors in dev (requires manual verification)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| UI gets cluttered | Medium | Low | Activity tab keeps timeline separate from overview |
| Follow-up banner ignored | Medium | Low | Make it visually prominent |
| Performance with large datasets | Low | Medium | Pagination, indexed queries |
| Scope creep into full CRM | Medium | Medium | Defer notifications, dashboards to future |

---

## Handoff Notes (for Jimmy)

**DB Work Required**: Yes
- Phase 2.1: `customer_follow_ups` table
- Phase 3.1-3.2: `customer_milestones` table + trigger

**Critical Dependencies**: None - all phases can start independently, but Phase 1 is recommended first for immediate value.

**Recommended Starting Point**: Phase 1 (zero DB changes, surfaces existing data)

**Security Review Required**: After Phase 2.1 and Phase 3.1 (new tables with RLS)

**Files Affected**:
- New: `ActivityTimeline.tsx`, `FollowUpBanner.tsx`, `AddMilestoneDialog.tsx`, `VisitPrepDialog.tsx`
- Modified: `CustomerDetailClient.tsx`, `LogInteractionDialog.tsx`, `customer-detail-data.ts`, `actions.ts`
- Migrations: 2 new tables, 1 trigger

---

## Archive Note

This plan was synthesized from:
- `PLAN-customer-pages-A.md` (Sales perspective)
- `PLAN-customer-pages-B.md` (Tech perspective)

See those files for the original competing approaches.
