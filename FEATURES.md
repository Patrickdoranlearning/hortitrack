# HortiTrack Feature Specifications

> Source of truth for how features should work. Tester Tim validates against this document.

**Last Updated**: 2026-02-01
**Status**: Living document - update as features evolve

---

## Document Structure

Each feature includes:
- **User Stories**: Who needs it and why
- **Acceptance Criteria**: What "working" means
- **Edge Cases**: What happens in unusual situations
- **Not Supported**: Explicit out-of-scope items

---

## How to Use This Document

| Role | Use |
|------|-----|
| **Planner** | Reference before designing new features |
| **Feature-builder** | Check acceptance criteria while building |
| **Tester Tim** | Validate features work as specified |
| **Jimmy** | Route to relevant sections during planning |

---

# Core Modules

## 1. Authentication & Authorization

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| AUTH-1 | User | Log in with email/password | I can access my organization's data |
| AUTH-2 | Admin | Invite team members | They can join my organization |
| AUTH-3 | User | Reset my password | I can regain access if forgotten |
| AUTH-4 | System | Enforce org-scoped access | Users only see their own data |

### Acceptance Criteria

**AUTH-1: Login**
- [ ] User enters valid email + password → redirected to dashboard
- [ ] User enters invalid credentials → error message, no redirect
- [ ] User enters valid email, wrong password 5x → account temporarily locked
- [ ] Session persists across browser refresh
- [ ] Session expires after [X hours] of inactivity

**AUTH-2: Team Invites**
- [ ] Admin can send invite email to new user
- [ ] Invite link expires after 7 days
- [ ] Invited user sets password on first login
- [ ] Invited user is added to admin's organization
- [ ] Non-admins cannot invite users

**AUTH-4: Org Scoping**
- [ ] All queries filter by authenticated user's org_id
- [ ] User cannot access data from other organizations
- [ ] RLS policies enforce this at database level

### Edge Cases
- User tries to access URL for another org's resource → 403 or redirect
- Invite sent to email already in system → [define behavior]
- Admin removed while other users exist → [define behavior]

### Not Supported
- Social login (Google, GitHub)
- Multi-organization membership (user belongs to one org)
- API key authentication (future consideration)

---

## 2. Batch Management

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| BATCH-1 | Grower | Create a new batch from seed arrival | I can track plants from origin |
| BATCH-2 | Grower | View batch details and history | I can see what happened to a batch |
| BATCH-3 | Grower | Update batch status/health | I can record changes over time |
| BATCH-4 | Grower | Scan batch QR code | I can quickly find batch info |
| BATCH-5 | Grower | Transplant batch to new location | I can track plant movement |
| BATCH-6 | Grower | Split a batch | I can separate plants for different purposes |
| BATCH-7 | Manager | View all batches with filters | I can find specific batches quickly |

### Acceptance Criteria

**BATCH-1: Create Batch**
- [ ] User enters: variety, quantity, source, location, date
- [ ] System generates unique batch code (format: [define])
- [ ] Batch appears in batch list immediately
- [ ] QR code generated for batch
- [ ] Initial status set to "seedling" or configurable

**BATCH-2: View Batch**
- [ ] Shows: variety, current quantity, location, status, age
- [ ] Shows timeline of all events (created, moved, health updates)
- [ ] Shows any allocations against this batch
- [ ] Shows related tasks

**BATCH-4: Scan QR**
- [ ] Camera opens on scan button tap
- [ ] Valid batch code → shows batch details
- [ ] Invalid code → error message "Batch not found"
- [ ] Works offline → shows cached data if available

**BATCH-5: Transplant**
- [ ] User selects source batch, destination location, quantity
- [ ] Source batch quantity decreases by transplant amount
- [ ] New batch created OR existing batch updated at destination
- [ ] Event logged: "Transplanted X from [source] to [dest]"
- [ ] Total plant count remains constant (source - X + dest + X)

**BATCH-6: Split Batch**
- [ ] User specifies quantity to split off
- [ ] Original batch quantity decreases
- [ ] New batch created with split quantity
- [ ] Both batches linked to original parent
- [ ] Event logged on both batches

### Edge Cases
- Transplant more than available → error, prevent action
- Split entire batch → error, use "move" instead
- Scan batch from different org → "Batch not found" (not "Access denied")
- Delete batch with allocations → prevent, show warning

### Not Supported
- Merging batches (only split)
- Batch templates
- Automatic batch creation from purchase orders

---

## 3. Sales Orders

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| ORDER-1 | Sales | Create a new order | I can record customer requests |
| ORDER-2 | Sales | Add line items to order | I can specify what customer wants |
| ORDER-3 | Sales | Allocate stock to order | I can reserve inventory |
| ORDER-4 | Sales | View order status | I can track progress |
| ORDER-5 | Warehouse | See pick list for order | I know what to pick |
| ORDER-6 | Sales | Cancel order | I can handle customer changes |
| ORDER-7 | Sales | Edit order before dispatch | I can make corrections |

### Acceptance Criteria

**ORDER-1: Create Order**
- [ ] User selects customer (or creates new)
- [ ] User sets delivery date
- [ ] Order created with status "draft"
- [ ] Order number generated (format: [define])

**ORDER-2: Add Line Items**
- [ ] User searches products by name/code
- [ ] User specifies quantity needed
- [ ] Shows available stock for product
- [ ] Line item added to order
- [ ] Order total updates

**ORDER-3: Allocate Stock**
- [ ] System suggests allocation from available batches
- [ ] User can accept suggestion or manually allocate
- [ ] Allocated stock marked as reserved
- [ ] Available stock decreases by allocated amount
- [ ] Cannot allocate more than available

**ORDER-5: Pick List**
- [ ] Shows all items to pick for order
- [ ] Grouped by location for efficient picking
- [ ] Shows batch codes to pick from
- [ ] Picker can mark items as picked
- [ ] Order status updates when all picked

**ORDER-6: Cancel Order**
- [ ] Only orders not yet dispatched can be cancelled
- [ ] Allocations released back to available stock
- [ ] Order status set to "cancelled"
- [ ] Cancellation reason recorded

### Edge Cases
- Order item exceeds available stock → warning, allow partial allocation
- Stock becomes unavailable after allocation → [define behavior]
- Edit order after partial pick → [define behavior]
- Customer in order deleted → prevent customer deletion

### Not Supported
- Recurring orders
- Order templates
- Automatic reorder points

---

## 4. Picking & Dispatch

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| PICK-1 | Picker | See my assigned pick lists | I know what to pick today |
| PICK-2 | Picker | Mark items as picked | I can track my progress |
| PICK-3 | Picker | Scan batch to confirm pick | I pick the right plants |
| PICK-4 | Picker | Report short picks | I can flag inventory issues |
| PICK-5 | Dispatcher | Create delivery manifest | Driver knows what to deliver |
| PICK-6 | Driver | Mark delivery complete | We know customer received order |

### Acceptance Criteria

**PICK-1: View Pick Lists**
- [ ] Shows pick lists assigned to current user
- [ ] Or shows all pick lists if unassigned workflow
- [ ] Ordered by priority / delivery date
- [ ] Shows progress (X of Y items picked)

**PICK-2: Mark Picked**
- [ ] Picker taps item → marks as picked
- [ ] Quantity picked recorded
- [ ] Timestamp recorded
- [ ] If all items picked → pick list status "complete"

**PICK-3: Scan Confirm**
- [ ] Picker scans batch QR
- [ ] System validates: correct batch for this pick?
- [ ] If correct → item marked picked
- [ ] If wrong batch → warning "Wrong batch, expected [X]"
- [ ] If wrong product → error "This batch is [product], not [expected]"

**PICK-4: Short Pick**
- [ ] Picker can mark item as "short"
- [ ] Picker enters actual quantity available
- [ ] Difference flagged for inventory reconciliation
- [ ] Order updated with actual picked quantity

### Edge Cases
- Pick list item already picked by another user → show status, prevent double-pick
- Batch no longer exists → error, flag for investigation
- Pick more than allocated → warning, require confirmation

### Not Supported
- Wave picking (multiple orders combined)
- Pick path optimization
- Automated warehouse systems integration

---

## 5. IPM (Integrated Pest Management)

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| IPM-1 | Scout | Record pest/disease observation | We track plant health issues |
| IPM-2 | Scout | Attach photo to observation | We have visual evidence |
| IPM-3 | Manager | View IPM dashboard | I see health trends across nursery |
| IPM-4 | Manager | Create treatment task from observation | Issues get addressed |
| IPM-5 | Scout | Follow up on previous observation | I can track if treatment worked |

### Acceptance Criteria

**IPM-1: Record Observation**
- [ ] Scout selects location or batch
- [ ] Scout selects pest/disease from list (or adds new)
- [ ] Scout rates severity (1-5 or Low/Med/High)
- [ ] Scout adds notes
- [ ] Observation saved with timestamp and scout ID

**IPM-2: Attach Photo**
- [ ] Camera opens from observation form
- [ ] Photo captured and attached
- [ ] Photo compressed for storage
- [ ] Photo viewable in observation history

**IPM-4: Create Treatment Task**
- [ ] From observation, manager taps "Create Task"
- [ ] Task pre-populated with location, issue details
- [ ] Manager assigns to worker and sets due date
- [ ] Task linked back to observation

### Edge Cases
- Same pest observed multiple times same day → separate observations or update?
- Photo upload fails → save observation, retry photo later
- Observation for location that no longer exists → [define behavior]

### Not Supported
- Automatic pest identification from photos
- Weather-based pest predictions
- Chemical application tracking (separate module)

---

## 6. Reporting

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| RPT-1 | Manager | View inventory summary | I know what stock I have |
| RPT-2 | Manager | View sales summary | I know revenue trends |
| RPT-3 | Manager | Export data to Excel | I can do further analysis |
| RPT-4 | Owner | View dashboard KPIs | I see business health at a glance |

### Acceptance Criteria

**RPT-1: Inventory Summary**
- [ ] Shows total plants by variety
- [ ] Shows available vs allocated
- [ ] Filterable by location, status, age
- [ ] Updates in real-time (or near real-time)

**RPT-4: Dashboard KPIs**
- [ ] Shows: total inventory value, orders this week, pending deliveries
- [ ] Shows: top varieties by quantity, low stock alerts
- [ ] Loads within 3 seconds
- [ ] Data no more than 1 hour stale

### Edge Cases
- Large date range selected → paginate or warn about load time
- No data for selected filters → show "No data" not empty screen

### Not Supported
- Custom report builder
- Scheduled report emails
- Multi-currency support

---

# Worker App (Mobile)

## 7. Worker Mobile Experience

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| WKR-1 | Worker | See my tasks for today | I know what to do |
| WKR-2 | Worker | Complete tasks from my phone | I don't need a computer |
| WKR-3 | Worker | Scan QR codes easily | I can quickly find/update batches |
| WKR-4 | Worker | Work offline | I can work in areas with poor signal |
| WKR-5 | Worker | See my productivity stats | I can track my own performance |

### Acceptance Criteria

**WKR-1: Today's Tasks**
- [ ] Shows tasks assigned to worker, due today
- [ ] Ordered by priority
- [ ] Shows task type, location, brief description
- [ ] Pull-to-refresh updates list

**WKR-2: Complete Tasks**
- [ ] Worker opens task
- [ ] Worker performs action (varies by task type)
- [ ] Worker marks complete
- [ ] Task removed from today's list

**WKR-3: QR Scanning**
- [ ] Scan button always accessible (bottom nav or FAB)
- [ ] Camera opens quickly (< 1 second)
- [ ] Scans QR and shows relevant info
- [ ] Works in bright sunlight and shade

**WKR-4: Offline Support**
- [ ] Tasks load when online, cached locally
- [ ] Completing task queues action for sync
- [ ] Visual indicator when offline
- [ ] Auto-syncs when connection restored
- [ ] Conflict resolution: server wins for data, queue preserved for actions

### Edge Cases
- Task assigned while offline → appears on next sync
- Two workers complete same task → first sync wins, second gets conflict notice
- App killed while action queued → queue persists, syncs on next open

### Not Supported
- Push notifications (future)
- Voice commands
- Multi-language (future consideration)

---

# Adding New Features

When adding a new feature to this document:

1. **Add User Stories** - Who needs it and why
2. **Define Acceptance Criteria** - Testable conditions for "done"
3. **List Edge Cases** - Unusual situations to handle
4. **Specify Not Supported** - Explicit scope boundaries
5. **Update Tester Tim** - Ensure test scenarios match

---

# Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Initial document created | Jimmy/Planner |

---

*This document is the source of truth for feature behavior. When in doubt, refer here. When specs conflict with code, update either the spec or the code - but never leave them inconsistent.*
