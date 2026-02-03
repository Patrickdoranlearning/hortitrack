# PLAN: Customer Pages Enhancement (Plan B)

## Perspective: Chief Technology Officer & Software Development

**Focus**: Architecture, data modeling, scalability, and technical implementation excellence

---

## Status: Ready
## Recommended Mode: thorough
## Estimated Sessions: 4-5

---

## Feature Overview

Build a robust, extensible customer relationship management foundation that:
- Properly models customer activities with audit trails
- Follows established patterns in the codebase
- Supports future features (notifications, analytics, mobile)
- Maintains data integrity and RLS compliance

---

## Phase 1: Data Architecture Foundation (Priority: P0)

**Goal**: Design and implement proper data model for customer activities

### Task 1.1: Design Unified Activity Model
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New table `customer_activities` that supersedes basic interactions:
    ```sql
    customer_activities (
      id uuid PRIMARY KEY,
      org_id uuid NOT NULL REFERENCES organizations,
      customer_id uuid NOT NULL REFERENCES customers,
      activity_type activity_type NOT NULL, -- ENUM
      title text NOT NULL,
      description text,
      occurred_at timestamptz NOT NULL,
      created_by uuid REFERENCES auth.users,
      metadata jsonb DEFAULT '{}', -- Flexible per-type data
      created_at timestamptz DEFAULT now()
    )

    activity_type ENUM:
      'interaction_call', 'interaction_email', 'interaction_visit', 'interaction_whatsapp',
      'milestone_anniversary', 'milestone_contract', 'milestone_custom',
      'note_general', 'note_visit',
      'system_first_order', 'system_price_change'
    ```
  - Index on (customer_id, occurred_at DESC)
  - Index on (org_id, activity_type, occurred_at DESC)
  - RLS policies for org-scoped access
- **Files**: New migration
- **Rationale**: Single source of truth for all customer timeline events

### Task 1.2: Migrate Existing Interactions
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - Migration script copies `customer_interactions` to `customer_activities`
  - Maps old types to new enum values
  - Preserves created_at as occurred_at
  - Old table remains for rollback (soft deprecation)
- **Files**: Migration

### Task 1.3: Create TypeScript Types and Zod Schemas
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - `ActivityType` enum type
  - `CustomerActivity` interface
  - `CreateActivitySchema` Zod validator
  - `ActivityMetadata` discriminated union per type
- **Files**: `src/app/sales/customers/types.ts` or new `activity-types.ts`

### Task 1.4: Activity Repository Pattern
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New `src/server/sales/activities.server.ts`
  - Functions: `createActivity()`, `getCustomerActivities()`, `getActivityById()`
  - Proper error handling and return types
  - Follows existing server function patterns
- **Files**: New server file

**Phase 1 Complete When**: Data model is in place with typed access layer.

---

## Phase 2: Follow-Up System (Priority: P0)

**Goal**: Implement proper task/reminder infrastructure

### Task 2.1: Create Follow-Up Tasks Table
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New table `customer_follow_ups`:
    ```sql
    customer_follow_ups (
      id uuid PRIMARY KEY,
      org_id uuid NOT NULL REFERENCES organizations,
      customer_id uuid NOT NULL REFERENCES customers,
      source_activity_id uuid REFERENCES customer_activities,
      assigned_to uuid REFERENCES auth.users,
      due_date date NOT NULL,
      title text NOT NULL,
      description text,
      status follow_up_status NOT NULL DEFAULT 'pending',
      completed_at timestamptz,
      completed_by uuid REFERENCES auth.users,
      created_at timestamptz DEFAULT now()
    )

    follow_up_status ENUM: 'pending', 'completed', 'cancelled', 'snoozed'
    ```
  - Index on (assigned_to, status, due_date)
  - Index on (customer_id, status)
  - RLS: user can see org follow-ups, but filter by assigned_to in app
- **Files**: New migration

### Task 2.2: Follow-Up API Layer
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Server actions: `createFollowUp()`, `completeFollowUp()`, `snoozeFollowUp()`
  - Types and validation schemas
  - Audit trail via activity creation on completion
- **Files**: `src/server/sales/follow-ups.server.ts`

### Task 2.3: Create Follow-Up List View
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - New `v_my_follow_ups` view for current user
  - Ordered by due_date, with overdue items first
  - Include customer name and context
- **Files**: Migration + data fetch function

**Phase 2 Complete When**: Follow-ups are first-class entities with proper status management.

---

## Phase 3: UI Components (Priority: P0)

**Goal**: Build reusable, well-tested UI components

### Task 3.1: ActivityTimeline Component
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Generic `<ActivityTimeline activities={} />` component
  - Renders different activity types with appropriate icons/colors
  - Supports pagination (load more)
  - Empty state handling
  - Can be reused on customer page and future contexts
- **Files**: `src/components/customers/ActivityTimeline.tsx`

### Task 3.2: CreateActivityDialog Component
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Replaces/extends LogInteractionDialog
  - Activity type selector
  - Dynamic form fields based on type (discriminated union)
  - Follow-up creation toggle with fields
  - Validation per activity type
- **Files**: `src/components/customers/CreateActivityDialog.tsx`

### Task 3.3: FollowUpBanner Component
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Displays pending follow-ups for customer
  - Shows overdue items in red
  - Quick actions: Complete, Snooze, Open Details
  - Animates in/out smoothly
- **Files**: `src/components/customers/FollowUpBanner.tsx`

### Task 3.4: CustomerInsightsCard Component
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Reusable card showing computed metrics
  - Props for which metrics to display
  - Loading states
  - Responsive layout
- **Files**: `src/components/customers/CustomerInsightsCard.tsx`

**Phase 3 Complete When**: All UI components built, tested, and documented.

---

## Phase 4: Integration into Customer Detail Page (Priority: P1)

**Goal**: Assemble components into enhanced customer page

### Task 4.1: Refactor CustomerDetailClient
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Replace hardcoded tabs with component-based structure
  - Add "Activity" tab using ActivityTimeline
  - Integrate FollowUpBanner at top of page
  - Add "New Activity" button in header
  - Lazy-load tab content for performance
- **Files**: `src/app/sales/customers/[customerId]/CustomerDetailClient.tsx`

### Task 4.2: Data Fetching Optimization
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Parallel data fetching for initial load
  - Activities fetched on tab switch (not initial)
  - React Query or SWR for caching (if not already used)
  - Loading skeletons per section
- **Files**: `customer-detail-data.ts`, page.tsx

### Task 4.3: Customer Header Enhancement
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Add "customer health" indicator (based on order recency)
  - Quick action menu: New Order, Log Activity, View Invoices
  - Mobile-responsive header layout
- **Files**: CustomerDetailClient.tsx

**Phase 4 Complete When**: Customer page integrates all new components with good performance.

---

## Phase 5: Analytics & Computed Insights (Priority: P1)

**Goal**: Provide data-driven customer insights

### Task 5.1: Create Customer Analytics RPC
- **Agent**: `data-engineer`
- **Acceptance Criteria**:
  - New RPC `get_customer_analytics(customer_id)` returns:
    - order_frequency_days (average)
    - orders_by_month (last 12 months array)
    - top_products (limit 10)
    - total_lifetime_value
    - days_since_last_order
    - churn_risk_score (simple calculation)
  - Computed on-demand (not materialized) for now
- **Files**: Migration with function

### Task 5.2: Integrate Analytics into UI
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Use CustomerInsightsCard to display analytics
  - Simple sparkline for order frequency
  - Churn risk badge (Low/Medium/High)
  - Product recommendations based on patterns
- **Files**: CustomerDetailClient.tsx, new InsightsTab.tsx

### Task 5.3: Customer Health Badge
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Visual indicator: green (healthy), yellow (at risk), red (churning)
  - Tooltip explains the calculation
  - Shows in customer list and detail page
- **Files**: Multiple components

**Phase 5 Complete When**: Customer pages show actionable analytics.

---

## Phase 6: Testing & Documentation (Priority: P1)

**Goal**: Ensure code quality and maintainability

### Task 6.1: Unit Tests for Activity Functions
- **Agent**: `tester-tim`
- **Acceptance Criteria**:
  - Tests for all server functions
  - Tests for Zod schemas
  - Mock Supabase client
- **Files**: `__tests__/activities.test.ts`

### Task 6.2: Integration Tests
- **Agent**: `tester-tim`
- **Acceptance Criteria**:
  - Test activity creation flow
  - Test follow-up lifecycle
  - Test permission boundaries
- **Files**: Test files

### Task 6.3: Component Stories (if Storybook exists)
- **Agent**: `feature-builder`
- **Acceptance Criteria**:
  - Story for ActivityTimeline with various states
  - Story for CreateActivityDialog
  - Story for FollowUpBanner
- **Files**: `.stories.tsx` files

**Phase 6 Complete When**: Test coverage above 80% for new code.

---

## Technical Debt Addressed

- [ ] Consolidate interaction logging patterns
- [ ] Proper TypeScript discriminated unions for activity types
- [ ] Server function standardization
- [ ] Component reusability

---

## What This Plan Deprioritizes

- UI polish details (focus on architecture first)
- Print functionality (can add later)
- Visit preparation view (can compose from components)
- Real-time updates (polling is fine initially)

---

## Definition of Done

- [ ] `customer_activities` table with migration from old data
- [ ] `customer_follow_ups` table with proper status management
- [ ] Activity server functions with full typing
- [ ] Reusable UI components (Timeline, Dialog, Banner, Card)
- [ ] Customer detail page integrated
- [ ] Analytics RPC and UI
- [ ] Unit and integration tests
- [ ] All RLS policies reviewed by security-auditor
- [ ] TypeScript strict mode passes
- [ ] No console errors

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration from old interactions fails | Medium | High | Keep old table, copy don't move |
| Over-engineering delays delivery | Medium | Medium | Phase 1-3 can ship independently |
| Activity types proliferate | Low | Low | Use metadata jsonb for edge cases |
| Performance with large activity lists | Low | Medium | Pagination, indexed queries |

---

## Handoff Notes (for Jimmy)

**DB Work Required**: Yes - Phase 1 (activities), Phase 2 (follow-ups), Phase 5 (analytics RPC)
**Critical Dependencies**: None, but recommend `data-engineer` completes Phase 1.1-1.2 first
**Recommended Starting Point**: Phase 1 - data model is foundation for everything
**Security Review**: Required after Phase 1 and Phase 2 (new tables with RLS)
