# PLAN: Customer Pages Enhancement (Plan A)

## Perspective: Sales Director & Key Account Manager

**Focus**: What sales teams need day-to-day - quick access to customer insights, relationship history, and actionable data for visits

---

## Status: Ready
## Recommended Mode: standard
## Estimated Sessions: 2-3

---

## Feature Overview

Enhance customer detail pages to become the **single source of truth** for every customer interaction. Sales reps should be able to open a customer page before a visit and immediately understand:
- What does this customer typically buy?
- When did we last speak? What was discussed?
- What happened at the last visit?
- Any upcoming milestones (anniversaries, seasonal peaks)?
- What should I talk about today?

---

## Phase 1: Quick Wins - Interaction History on Detail Page (Priority: P0)

**Goal**: Surface existing interaction data that's currently hidden

### Task 1.1: Add Interactions Tab to Customer Detail Page
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New "Activity" tab on CustomerDetailClient
  - Shows chronological list of interactions from `customer_interactions` table
  - Each interaction displays: date, type icon, outcome badge, notes, logged by
  - "Log Interaction" button prominent at top
  - Empty state with call-to-action
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

### Task 1.2: Add "Log Interaction" Button to Customer Header
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Quick-access button next to "Edit customer"
  - Opens existing LogInteractionDialog
  - After logging, interaction list refreshes
- **Files**: Same as 1.1

### Task 1.3: Fetch Interaction History
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New function `fetchCustomerInteractions()` in `customer-detail-data.ts`
  - Returns interactions with user display names
  - Sorted by date descending
- **Files**: `src/app/sales/customers/[customerId]/customer-detail-data.ts`

**Phase 1 Complete When**: Sales rep can view full interaction history on customer page and log new interactions without leaving the page.

---

## Phase 2: Enhanced Visit Notes (Priority: P0)

**Goal**: Richer visit documentation for account management

### Task 2.1: Extend Interaction Schema for Visit Details
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - Add columns to `customer_interactions`:
    - `contact_name` (text) - who they spoke to
    - `follow_up_date` (date) - when to follow up
    - `follow_up_note` (text) - what to follow up on
  - Migration is backwards-compatible
  - RLS policies maintained
- **Files**: New migration

### Task 2.2: Update LogInteractionDialog with Follow-Up Fields
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Conditional fields appear for "visit" type:
    - Contact person name (autocomplete from customer contacts)
    - Follow-up date picker
    - Follow-up reminder note
  - Validation: follow_up_note required if follow_up_date set
- **Files**: `src/components/sales/dashboard/LogInteractionDialog.tsx`

### Task 2.3: Surface Follow-Ups on Customer Page
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Banner at top of customer page if pending follow-up
  - Shows: "Follow-up due [date]: [note]"
  - Clicking opens interaction where follow-up was set
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

**Phase 2 Complete When**: Sales rep can log detailed visit notes with follow-up reminders that surface prominently.

---

## Phase 3: Customer Milestones (Priority: P1)

**Goal**: Track important customer events and dates

### Task 3.1: Create Customer Milestones Table
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New table `customer_milestones`:
    - id, org_id, customer_id
    - milestone_type ENUM ('anniversary', 'first_order', 'contract_renewal', 'seasonal_peak', 'custom')
    - title, description
    - event_date (date)
    - recurring (boolean)
    - created_by, created_at
  - RLS: org-scoped
  - Index on (customer_id, event_date)
- **Files**: New migration

### Task 3.2: Auto-Generate Anniversary Milestone
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Database trigger: on first order, create "Anniversary" milestone
  - Anniversary = first order date, recurring = true
- **Files**: Migration or RPC

### Task 3.3: Milestones Panel on Customer Page
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - "Milestones" card in overview tab
  - Shows upcoming milestones (next 90 days)
  - Past milestones collapsed/expandable
  - "Add Milestone" button opens simple form
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

### Task 3.4: Milestone Quick-Add Dialog
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Dialog with: type selector, title, date, optional description
  - Seasonal peak type auto-suggests common nursery dates
  - Save creates milestone, refreshes list
- **Files**: New component

**Phase 3 Complete When**: Sales rep can view and create milestones, with anniversaries auto-tracked.

---

## Phase 4: Visit Preparation Summary (Priority: P1)

**Goal**: One-click "Prepare for Visit" summary

### Task 4.1: Create Visit Prep View
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New "Prepare for Visit" button in header
  - Opens modal/panel with:
    - Top 5 products they buy (from existing favourites)
    - Last interaction summary
    - Pending follow-ups
    - Upcoming milestones
    - Outstanding invoices (from existing invoice data)
    - Recent order status
  - Print-friendly format
- **Files**: New component `VisitPrepDialog.tsx`

### Task 4.2: Print/Export Visit Summary
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - "Print" button generates clean PDF/print view
  - A4 format, fits on one page
  - Include customer contact details, address
- **Files**: Same component with print styles

**Phase 4 Complete When**: Sales rep can generate a one-page visit briefing to review before appointments.

---

## Phase 5: Order Frequency Insights (Priority: P2)

**Goal**: Better understand buying patterns

### Task 5.1: Compute Order Frequency Metrics
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New computed stats:
    - Average days between orders
    - Last 12 months order count
    - Seasonality indicator (which quarters they order most)
  - Add to existing stats card or new "Insights" card
- **Files**: `src/app/sales/customers/[customerId]/customer-detail-data.ts`

### Task 5.2: Simple Ordering Pattern Chart
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Small bar chart showing orders by month (last 12 months)
  - Highlight if current month is typically a high/low period
  - Use existing chart library (recharts)
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

**Phase 5 Complete When**: Customer page shows clear ordering pattern visualization.

---

## What This Plan Deprioritizes

- Complex analytics/BI dashboards (use simple metrics first)
- Real-time notifications (follow-ups can be checked when opening page)
- Mobile-first redesign (desktop is primary sales tool)
- AI/ML recommendations (manual insights are fine for now)

---

## Definition of Done

- [ ] Interaction history visible on customer page
- [ ] Log interaction works from customer detail page
- [ ] Visit follow-ups can be set and surface prominently
- [ ] Milestones can be tracked with anniversaries auto-created
- [ ] Visit prep summary available in printable format
- [ ] Order frequency patterns visible
- [ ] All existing tests pass
- [ ] No console errors in dev

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Too many tabs cluttering UI | Medium | Low | Consolidate into Activity + Overview tabs |
| Follow-up reminders ignored | Medium | Low | Make banner prominent, consider email digest later |
| Performance with large interaction history | Low | Medium | Paginate interactions, limit to 50 initially |

---

## Handoff Notes (for Jimmy)

**DB Work Required**: Yes - Phase 2.1 (interaction columns) and Phase 3.1 (milestones table)
**Critical Dependencies**: None - builds on existing infrastructure
**Recommended Starting Point**: Phase 1 (zero DB changes, immediate value)
