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

# 1. Authentication & Authorization

## 1.1 User Login

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| AUTH-1 | User | Log in with email/password | I can access my organization's data |
| AUTH-2 | Admin | Invite team members | They can join my organization |
| AUTH-3 | User | Reset my password | I can regain access if forgotten |
| AUTH-4 | System | Enforce org-scoped access | Users only see their own data |
| AUTH-5 | Worker | Log in on mobile device | I can use the worker app |

### Acceptance Criteria

**AUTH-1: Login**
- [ ] User enters valid email + password → redirected to dashboard
- [ ] User enters invalid credentials → error message, no redirect
- [ ] Session persists across browser refresh
- [ ] Session expires after inactivity period
- [ ] Logout clears session and redirects to login

**AUTH-2: Team Invites**
- [ ] Admin can send invite email to new user
- [ ] Invite link expires after 7 days
- [ ] Invited user sets password on first login
- [ ] Invited user is added to admin's organization
- [ ] Non-admins cannot invite users

**AUTH-4: Org Scoping (RLS)**
- [ ] All queries filter by authenticated user's org_id
- [ ] User cannot access data from other organizations
- [ ] RLS policies enforce this at database level
- [ ] Attempting to access other org's data returns empty/403

**AUTH-5: Worker App Login**
- [ ] Worker can log in via mobile app
- [ ] Session persists for mobile workflow
- [ ] Worker sees only tasks assigned to them (or their team)

### Edge Cases
- User tries to access URL for another org's resource → 403 or redirect
- Invite sent to email already in system → show error, suggest login
- User's org membership revoked → immediate session invalidation
- Dev-bypass authentication → only works in development mode

### Not Supported
- Social login (Google, GitHub) - future consideration
- Multi-organization membership (user belongs to one org)
- API key authentication for external systems

---

## 1.2 Role-Based Access Control

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| ROLE-1 | Owner | Have full system access | I can manage everything |
| ROLE-2 | Admin | Manage users and settings | I can configure the system |
| ROLE-3 | Grower | Access production features | I can manage batches and growing |
| ROLE-4 | Sales | Access sales and orders | I can manage customer orders |
| ROLE-5 | Viewer | See data without editing | I can review without risk |

### Acceptance Criteria

**Role Permissions Matrix**
| Feature | Owner | Admin | Grower | Sales | Viewer |
|---------|-------|-------|--------|-------|--------|
| User management | Yes | Yes | No | No | No |
| Settings | Yes | Yes | No | No | No |
| Batches (edit) | Yes | Yes | Yes | No | No |
| Batches (view) | Yes | Yes | Yes | Yes | Yes |
| Orders (edit) | Yes | Yes | No | Yes | No |
| Orders (view) | Yes | Yes | Yes | Yes | Yes |
| Picking | Yes | Yes | Yes | Yes | No |
| Reports | Yes | Yes | Yes | Yes | Yes |

### Edge Cases
- User role changed while logged in → new permissions apply on next request
- Last admin demoted → prevent, must have at least one admin

---

# 2. Batch Management (Production)

## 2.1 Batch Creation

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| BATCH-1 | Grower | Create a new batch from seed/cutting arrival | I can track plants from origin |
| BATCH-2 | Grower | Create a transplant batch from existing batch | I can track plant movement |
| BATCH-3 | Grower | Bulk create batches | I can save time on large intakes |
| BATCH-4 | Grower | Assign batch to protocol | Growing steps are pre-defined |

### Acceptance Criteria

**BATCH-1: Create Propagation Batch**
- [ ] User selects variety from catalog
- [ ] User selects size/container type
- [ ] User enters quantity
- [ ] User selects source location
- [ ] User sets propagation date
- [ ] System generates unique batch number (format: `YYYYMMDD-VARIETY-SEQ`)
- [ ] Batch appears in batch list immediately
- [ ] Initial status set to "incoming" or "planned"
- [ ] QR code generated for batch label

**BATCH-2: Create Transplant Batch**
- [ ] User selects source batch(es)
- [ ] User specifies quantity to transplant
- [ ] User selects destination location
- [ ] User selects new size (if upgrading container)
- [ ] Source batch quantity decreases by transplant amount
- [ ] New batch created linked to parent batch(es)
- [ ] Event logged: "Transplanted X from [source] to [dest]"
- [ ] Total plant count remains constant (source - X + child + X)

**BATCH-3: Bulk Operations**
- [ ] User can select multiple batches
- [ ] User can apply same operation to all selected
- [ ] Progress indicator shows during bulk operation
- [ ] Summary shown after completion

### Edge Cases
- Transplant more than source available → error, prevent action
- Create batch with variety not in catalog → prompt to add variety first
- Duplicate batch number → system generates unique sequence
- Batch creation fails midway → rollback, no partial batch

### Not Supported
- Merging batches (only split/transplant)
- Batch templates for repeated recipes
- Automatic batch creation from purchase orders

---

## 2.2 Batch Lifecycle & Status

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| LIFE-1 | Grower | Update batch status | I can track growing progress |
| LIFE-2 | Grower | Move batch to new location | I can track where plants are |
| LIFE-3 | Grower | Mark batch as saleable | Sales can allocate it to orders |
| LIFE-4 | Grower | Archive batch with loss recording | I can track shrinkage |
| LIFE-5 | Manager | View batch timeline | I can see full history |

### Acceptance Criteria

**Batch Statuses (in order)**
```
Incoming → Planned → Germinating → Growing → Ready → Saleable → Dispatched
                                                          ↓
                                                     Archived (with loss)
```

**LIFE-1: Status Updates**
- [ ] User can change status to next valid state
- [ ] Status change logged with timestamp and user
- [ ] Phase tracking updated (propagation, vegetative, hardening)
- [ ] Cannot skip statuses (must progress in order)
- [ ] Can revert to previous status (with reason)

**LIFE-2: Location Movement**
- [ ] User selects new location from available locations
- [ ] Movement logged with timestamp
- [ ] Batch list updates to show new location
- [ ] Location history preserved

**LIFE-3: Mark Saleable**
- [ ] User actuates batch quantity (confirms actual count)
- [ ] User marks batch as saleable
- [ ] Batch appears in available inventory for sales
- [ ] Saleable batches can be allocated to orders

**LIFE-4: Archive with Loss**
- [ ] User enters quantity lost
- [ ] User selects loss reason (pest, disease, environmental, other)
- [ ] User adds notes
- [ ] Batch status set to "archived"
- [ ] Loss recorded for reporting

**LIFE-5: Batch Timeline**
- [ ] Shows all events chronologically
- [ ] Shows: status changes, location moves, quantity changes
- [ ] Shows: who made each change
- [ ] Shows: photos attached to batch
- [ ] Filterable by event type

### Edge Cases
- Batch in "dispatched" status → cannot be modified
- Location marked as restricted → batch inherits restriction
- Archive batch with allocations → error, must deallocate first
- Batch has children → archiving shows warning about descendants

---

## 2.3 Batch Lookup & Scanning

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| SCAN-1 | Grower | Scan batch QR code | I can quickly find batch info |
| SCAN-2 | Grower | Search batches by criteria | I can find specific batches |
| SCAN-3 | Worker | Scan from mobile device | I can work without a computer |

### Acceptance Criteria

**SCAN-1: QR Scanning**
- [ ] Camera opens on scan button tap
- [ ] Valid batch code → shows batch details page
- [ ] Invalid code → error "Batch not found"
- [ ] Works in bright sunlight and shade
- [ ] Response time < 1 second after scan

**SCAN-2: Batch Search**
- [ ] Search by batch number (partial match)
- [ ] Filter by variety
- [ ] Filter by size
- [ ] Filter by location
- [ ] Filter by status
- [ ] Filter by date range (created, ready)
- [ ] Results paginated for large datasets

**SCAN-3: Mobile Scanning**
- [ ] Worker app has prominent scan button
- [ ] Scan works offline (shows cached data)
- [ ] Manual entry fallback if camera unavailable

### Edge Cases
- Scan batch from different org → "Batch not found" (not "Access denied")
- Scan archived batch → show with "ARCHIVED" indicator
- Multiple batches with similar codes → show disambiguation list

---

## 2.4 Batch Health & QC

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| QC-1 | Grower | Set batch quality grade | I can track A/B/C quality |
| QC-2 | Grower | Flag health issues | I can track pest/disease status |
| QC-3 | Sales | See quality grade when allocating | I can fulfill customer requirements |

### Acceptance Criteria

**QC-1: Quality Grading**
- [ ] User can set grade: A (premium), B (standard), C (budget)
- [ ] Grade affects allocation priority (A first by default)
- [ ] Grade visible on batch details
- [ ] Grade history tracked

**QC-2: Health Status**
- [ ] Health status: Clean, Infested, Restricted
- [ ] Infested batches flagged for treatment
- [ ] Restricted batches cannot be picked/sold
- [ ] Restriction has end date
- [ ] Health status inherited from parent (propagation)

**QC-3: Allocation Impact**
- [ ] Grade preference can be specified on order
- [ ] "Grade A only" orders skip B/C batches
- [ ] Health restrictions prevent allocation entirely

### Edge Cases
- Downgrade batch already allocated → warning, option to deallocate
- Batch location marked restricted → batch inherits restriction
- Restriction expires → batch automatically returns to "Clean"

---

# 3. Sales & Orders

## 3.1 Order Creation

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| ORD-1 | Sales | Create a new order for a customer | I can record customer requests |
| ORD-2 | Sales | Add line items to order | I can specify what customer wants |
| ORD-3 | Sales | See available inventory | I know what I can promise |
| ORD-4 | Sales | Set delivery date | Customer knows when to expect delivery |

### Acceptance Criteria

**ORD-1: Create Order**
- [ ] User selects customer (or creates new)
- [ ] User sets requested delivery date
- [ ] Order created with status "draft"
- [ ] Order number generated (format: `ORD-YYYYMMDD-SEQ`)
- [ ] Customer details auto-populated (address, contact)

**ORD-2: Add Line Items**
- [ ] User searches products by name/code
- [ ] User selects variety + size combination
- [ ] User specifies quantity needed
- [ ] Shows available stock for product
- [ ] Shows MOQ if applicable
- [ ] Line item added to order
- [ ] Order total updates automatically

**ORD-3: Availability Display**
- [ ] Shows total available quantity
- [ ] Shows quantity already reserved
- [ ] Shows quantity available to promise
- [ ] Color-coded: green (available), yellow (low), red (unavailable)

**ORD-4: Delivery Date**
- [ ] Calendar picker for date selection
- [ ] Cannot select past dates
- [ ] Shows delivery schedule if configured
- [ ] Delivery address editable per order

### Edge Cases
- Product discontinued → show warning but allow if stock exists
- Customer on credit hold → show warning, require override
- Zero available stock → allow order but show backorder warning
- Duplicate line items → combine quantities or warn

---

## 3.2 Stock Allocation

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| ALLOC-1 | Sales | Allocate stock to order | I can reserve inventory |
| ALLOC-2 | Sales | Use automatic allocation | System picks optimal batches |
| ALLOC-3 | Sales | Manually select batches | I can fulfill specific requests |
| ALLOC-4 | Sales | See allocation suggestions | I can review before confirming |

### Acceptance Criteria

**ALLOC-1: Allocation Basics**
- [ ] Allocated stock marked as reserved
- [ ] Available stock decreases by allocated amount
- [ ] Cannot allocate more than available
- [ ] Allocation visible on batch details

**ALLOC-2: Auto-Allocation (FEFO)**
- [ ] System suggests allocation using FEFO (First Expired, First Out)
- [ ] Oldest/nearest-ready batches prioritized
- [ ] Grade preferences honored (A before B before C)
- [ ] Location preferences honored if specified
- [ ] User can accept or modify suggestions

**ALLOC-3: Manual Allocation**
- [ ] User can select specific batch(es)
- [ ] User can split across multiple batches
- [ ] Running total shows progress toward line item quantity
- [ ] Warning if selected batch is not optimal (newer than alternatives)

**ALLOC-4: Multi-Batch Allocation (DEFAULT)**
- [ ] Interface shows all eligible batches for product
- [ ] Quantity steppers for each batch
- [ ] Auto-fill button applies FEFO algorithm
- [ ] Clear display of running total vs. required
- [ ] Save allocates all selected batches at once

### Edge Cases
- Batch becomes unavailable after allocation → notify sales, suggest alternatives
- Partial allocation → allowed, shows unfulfilled quantity
- Deallocate then reallocate → original batch may no longer be available
- Customer requests specific batch → override FEFO, use specified

---

## 3.3 Order Lifecycle

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| LIFE-1 | Sales | Confirm order | Picking can begin |
| LIFE-2 | Sales | Cancel order | Customer changed their mind |
| LIFE-3 | Sales | Edit order before dispatch | I can make corrections |
| LIFE-4 | Sales | Track order status | I know where it is in the workflow |

### Acceptance Criteria

**Order Statuses**
```
Draft → Confirmed → Picking → Ready → Packed → Dispatched → Delivered
                                                     ↓
                                                Cancelled
```

**LIFE-1: Confirm Order**
- [ ] All line items must have allocation (or backorder flag)
- [ ] Delivery date must be set
- [ ] Status changes to "confirmed"
- [ ] Pick list can now be created
- [ ] Email notification to warehouse (optional)

**LIFE-2: Cancel Order**
- [ ] Only orders not yet dispatched can be cancelled
- [ ] Allocations released back to available stock
- [ ] Order status set to "cancelled"
- [ ] Cancellation reason recorded
- [ ] Email notification to customer (optional)

**LIFE-3: Edit Order**
- [ ] Draft orders: full edit capability
- [ ] Confirmed orders: can add/remove/modify line items
- [ ] Picking orders: requires unpicking first
- [ ] Dispatched orders: cannot edit (must create return/adjustment)

**LIFE-4: Status Tracking**
- [ ] Current status clearly visible
- [ ] Status history with timestamps
- [ ] Each status change logged with user
- [ ] Dashboard shows orders by status

### Edge Cases
- Edit order during active picking → pause pick, notify picker
- Cancel order with partial pick → return picked items to stock
- Delivery failed → order stays "dispatched", manual intervention

---

## 3.4 Substitutions

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| SUB-1 | Sales | Request a substitution | Customer can approve alternatives |
| SUB-2 | Customer | Approve/reject substitution | I control what I receive |
| SUB-3 | Warehouse | See approved substitutions | I pick the right items |

### Acceptance Criteria

**SUB-1: Request Substitution**
- [ ] User selects original line item
- [ ] User proposes substitute product
- [ ] User provides reason
- [ ] Substitution status: "requested"
- [ ] Customer notified

**SUB-2: Approve/Reject**
- [ ] Customer reviews substitution request
- [ ] Customer approves or rejects
- [ ] If approved: status → "approved", original deallocated, substitute allocated
- [ ] If rejected: status → "rejected", original remains

**SUB-3: Picking with Substitutions**
- [ ] Pick list shows substitute (not original) for approved substitutions
- [ ] Original product crossed out with substitute shown
- [ ] Clear indication this is a substitution

### Edge Cases
- Substitute also unavailable → offer another or cancel line
- Customer doesn't respond → configurable timeout, default action
- Partial substitution → allowed (e.g., 80 of 100 requested)

---

# 4. Picking & Dispatch

## 4.1 Pick List Management

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| PICK-1 | Warehouse | See pick lists for today | I know what to pick |
| PICK-2 | Warehouse | Create pick list from order | I can start picking |
| PICK-3 | Warehouse | Assign picker to list | Work is distributed |
| PICK-4 | Warehouse | Track pick list progress | I know what's done |

### Acceptance Criteria

**PICK-1: View Pick Lists**
- [ ] Shows pick lists by status (pending, in_progress, completed)
- [ ] Filterable by date, picker, team
- [ ] Shows progress (X of Y items picked)
- [ ] Sorted by priority / delivery date

**PICK-2: Create Pick List**
- [ ] Select one or more orders
- [ ] System generates pick list with all allocated items
- [ ] Items grouped by location (for efficient route)
- [ ] Pick list number generated

**PICK-3: Assignment**
- [ ] Assign to individual picker
- [ ] Assign to picking team
- [ ] Reassign if needed
- [ ] Notification to assigned picker (if enabled)

**PICK-4: Progress Tracking**
- [ ] Real-time update as items picked
- [ ] Shows: total items, picked items, remaining
- [ ] Completion percentage
- [ ] Time tracking (start to finish)

### Edge Cases
- Picker goes offline mid-pick → sync when reconnected
- Order modified during pick → notify picker, update pick list
- Multiple pickers same list → coordinate to avoid duplicates

---

## 4.2 Multi-Batch Picking (DEFAULT)

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| MBATCH-1 | Picker | Pick from multiple batches for one line item | I can fulfill orders efficiently |
| MBATCH-2 | Picker | See suggested batch breakdown | I know optimal picking route |
| MBATCH-3 | Picker | Adjust quantities per batch | I can handle real-world situations |
| MBATCH-4 | Picker | Confirm total matches required | Order is fulfilled correctly |

### Acceptance Criteria

**MBATCH-1: Multi-Batch Interface**
- [ ] Pick item shows all eligible batches
- [ ] Each batch shows: location, quantity available, grade, age
- [ ] Quantity stepper (+/-) for each batch
- [ ] Large touch targets for mobile use
- [ ] Running total displayed prominently

**MBATCH-2: Auto-Suggestion**
- [ ] "Auto-fill" button applies FEFO algorithm
- [ ] Distributes quantity across batches optimally
- [ ] Respects grade preferences from order
- [ ] Picker can accept or modify

**MBATCH-3: Manual Adjustment**
- [ ] Picker can increase/decrease per batch
- [ ] Picker can zero out a batch (skip it)
- [ ] Picker can add batch not in original suggestion
- [ ] Changes reflect in running total immediately

**MBATCH-4: Completion**
- [ ] Total must equal required quantity (or mark short)
- [ ] Confirm button finalizes pick
- [ ] All source batches decremented
- [ ] Pick record created for each batch used
- [ ] Progress updates on pick list

### Edge Cases
- Batch quantity less than expected → adjust, system records discrepancy
- Batch not found in location → report missing, skip batch
- Total exceeds required → warning, cannot overpick
- Short pick → mark item as short, record actual quantity

---

## 4.3 Trolley Management

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| TROL-1 | Picker | Assign picks to trolley | I can organize for delivery |
| TROL-2 | Picker | Specify shelf placement | Load is balanced |
| TROL-3 | Dispatcher | View trolley contents | I know what's on each trolley |
| TROL-4 | Dispatcher | Assign trolley to vehicle | Delivery is organized |

### Acceptance Criteria

**TROL-1: Trolley Assignment**
- [ ] Picker enters/scans trolley number
- [ ] System validates trolley exists
- [ ] Picks assigned to trolley
- [ ] Trolley status: staging

**TROL-2: Shelf Assignment**
- [ ] Trolley has configurable shelf count
- [ ] Picker assigns items to specific shelf
- [ ] Weight/balance calculation (optional)
- [ ] Capacity warnings if exceeded

**TROL-3: Trolley View**
- [ ] Shows all items on trolley
- [ ] Grouped by customer/order
- [ ] Shows total weight/count
- [ ] Print trolley manifest

**TROL-4: Vehicle Loading**
- [ ] Assign trolley to haulier/vehicle
- [ ] Trolley status: loaded
- [ ] Load manifest generated
- [ ] Balance transfer between trolleys if needed

### Edge Cases
- Trolley already assigned to different order → warning
- Trolley capacity exceeded → require split or different trolley
- Trolley damaged → mark unavailable, reassign contents

---

## 4.4 QC & Dispatch

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| QC-1 | QC | Verify picks before dispatch | Quality is assured |
| QC-2 | QC | Flag issues | Problems are addressed |
| QC-3 | QC | Reject items | Bad product doesn't ship |
| DISP-1 | Dispatcher | Mark order dispatched | Delivery tracking begins |
| DISP-2 | Driver | Confirm delivery | Order is complete |

### Acceptance Criteria

**QC-1: Pre-Dispatch Verification**
- [ ] QC sees trolley contents
- [ ] QC can check each item
- [ ] Mark items as verified
- [ ] Cannot dispatch until QC complete (if enabled)

**QC-2: Issue Flagging**
- [ ] QC can flag item with issue type
- [ ] Issue types: wrong product, wrong quantity, quality problem, damage
- [ ] Issue logged with photo option
- [ ] Notification to relevant parties

**QC-3: Rejection**
- [ ] QC can reject item
- [ ] Rejected quantity returned to batch inventory
- [ ] Picker notified to repick
- [ ] Rejection logged with reason

**DISP-1: Dispatch**
- [ ] All items QC verified (or QC bypassed)
- [ ] Mark order as dispatched
- [ ] Timestamp recorded
- [ ] Driver/vehicle recorded
- [ ] Customer notification (optional)

**DISP-2: Delivery Confirmation**
- [ ] Driver marks as delivered
- [ ] Customer signature/confirmation (optional)
- [ ] Delivery timestamp recorded
- [ ] Order status → delivered

### Edge Cases
- Partial delivery → order stays open, remaining tracked
- Delivery refused → return workflow triggered
- Damaged in transit → damage report, adjustment

---

# 5. Materials Management

## 5.1 Material Catalog

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| MAT-1 | Manager | Maintain material catalog | I can track all inputs |
| MAT-2 | Grower | See available materials | I know what's in stock |
| MAT-3 | Buyer | Track supplier information | I can reorder easily |

### Acceptance Criteria

**MAT-1: Material Types**
- [ ] Categories: fertilizers, pesticides, growing media, pots/containers, labels, other
- [ ] Each material has: name, SKU, unit of measure, supplier
- [ ] Safety data sheet link (optional)
- [ ] Restricted use flag for controlled substances

**MAT-2: Stock Visibility**
- [ ] Current stock level by location
- [ ] Expiration dates for perishable items
- [ ] Low stock alerts
- [ ] Lot-level tracking (which lot is where)

**MAT-3: Supplier Management**
- [ ] Supplier directory with contact info
- [ ] Link materials to primary supplier
- [ ] Purchase history per supplier
- [ ] Lead time tracking

---

## 5.2 Material Receiving

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| RCV-1 | Worker | Receive materials from delivery | I can add to inventory |
| RCV-2 | Worker | Create lot with details | I can track batch/expiry |
| RCV-3 | Worker | Assign storage location | I know where it is |

### Acceptance Criteria

**RCV-1: Goods Receipt**
- [ ] Select or create purchase order
- [ ] Confirm quantities received
- [ ] Note any discrepancies
- [ ] Receipt logged with timestamp

**RCV-2: Lot Creation**
- [ ] Lot number generated or entered
- [ ] Expiration date entered
- [ ] Supplier lot number captured
- [ ] Cost per unit recorded

**RCV-3: Location Assignment**
- [ ] Select storage location
- [ ] Lot linked to location
- [ ] Stock level updated
- [ ] QR/barcode for lot label

### Edge Cases
- Received quantity differs from PO → log variance, option to adjust PO
- Material not in catalog → prompt to add or reject
- Damaged goods → partial receipt, note damage

---

## 5.3 Material Consumption

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| CONS-1 | Grower | Record material use on batch | I can track inputs |
| CONS-2 | Manager | See material consumption reports | I can analyze costs |
| CONS-3 | System | Deduct from stock automatically | Inventory stays accurate |

### Acceptance Criteria

**CONS-1: Recording Use**
- [ ] Select batch or location
- [ ] Select material lot (FIFO suggested)
- [ ] Enter quantity used
- [ ] Record application method/notes

**CONS-2: Consumption Reports**
- [ ] By material: total used, cost
- [ ] By batch: materials applied
- [ ] By time period
- [ ] Export to CSV/Excel

**CONS-3: Stock Deduction**
- [ ] Stock level decreases automatically
- [ ] Lot quantity decreases
- [ ] Cost of goods sold tracked
- [ ] Alert if stock goes negative (data error)

---

# 6. Plant Health & IPM

## 6.1 Scouting & Observations

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| SCOUT-1 | Scout | Record pest/disease observation | We track plant health issues |
| SCOUT-2 | Scout | Attach photo to observation | We have visual evidence |
| SCOUT-3 | Scout | Rate severity | We prioritize response |
| SCOUT-4 | Manager | View scout reports | I see health trends |

### Acceptance Criteria

**SCOUT-1: Record Observation**
- [ ] Scout selects location or batch
- [ ] Scout selects pest/disease from catalog (or adds new)
- [ ] Scout adds notes
- [ ] Observation saved with timestamp and scout ID

**SCOUT-2: Photo Attachment**
- [ ] Camera opens from observation form
- [ ] Photo captured and attached
- [ ] Photo compressed for storage
- [ ] Photo viewable in observation history

**SCOUT-3: Severity Rating**
- [ ] Scale: 1-5 or Low/Medium/High/Critical
- [ ] Severity affects prioritization
- [ ] Critical severity triggers alert

**SCOUT-4: Scout Reports**
- [ ] Historical observations by location/batch
- [ ] Filter by pest/disease type
- [ ] Filter by date range
- [ ] Trend visualization

### Edge Cases
- Same pest observed multiple times same day → can create multiple or update existing
- Photo upload fails → save observation, retry photo later
- Observation for archived batch → allowed, flag as historical

---

## 6.2 IPM Programs & Treatments

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| IPM-1 | Manager | Define IPM program | Treatment schedules are standardized |
| IPM-2 | Manager | Assign program to location/batch | Regular treatments are scheduled |
| IPM-3 | Grower | Complete IPM task | Treatment is recorded |
| IPM-4 | Grower | Record spot treatment | Ad-hoc issues are addressed |

### Acceptance Criteria

**IPM-1: Program Definition**
- [ ] Program name and description
- [ ] Target pest/disease
- [ ] Treatment schedule (weekly, bi-weekly, monthly)
- [ ] Approved products with application rates
- [ ] Duration/recurrence

**IPM-2: Program Assignment**
- [ ] Assign to location(s)
- [ ] Assign to batch(es)
- [ ] Set start date
- [ ] Tasks auto-generated per schedule

**IPM-3: Task Completion**
- [ ] Task shows: due date, product, rate, target area
- [ ] Worker marks complete
- [ ] Actual product used recorded
- [ ] Notes and photos optional

**IPM-4: Spot Treatment**
- [ ] Ad-hoc treatment entry (not from program)
- [ ] Select issue being addressed
- [ ] Record product and rate
- [ ] Link to scout observation if applicable

### Edge Cases
- Product out of stock → flag task, suggest alternative
- Task overdue → highlight, allow late completion
- Program cancelled → pending tasks removed

---

## 6.3 Health Restrictions

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| REST-1 | Manager | Mark location as restricted | Sales cannot ship from there |
| REST-2 | System | Prevent picking from restricted areas | Quality is protected |
| REST-3 | Manager | Set restriction end date | Normal operations resume automatically |

### Acceptance Criteria

**REST-1: Apply Restriction**
- [ ] Select location or batch
- [ ] Set restriction type (quarantine, treatment, inspection)
- [ ] Set end date (required)
- [ ] Add reason notes

**REST-2: Picking Prevention**
- [ ] Restricted batches excluded from allocation
- [ ] Restricted batches excluded from pick lists
- [ ] Warning if manually attempting to pick restricted batch

**REST-3: Automatic Release**
- [ ] Restriction expires at end date
- [ ] Status returns to "Clean"
- [ ] Batches become available again
- [ ] Notification to manager (optional)

---

# 7. Worker App (Mobile)

## 7.1 Worker Dashboard

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| WORK-1 | Worker | See my tasks for today | I know what to do |
| WORK-2 | Worker | See quick stats | I know my progress |
| WORK-3 | Worker | Navigate to features easily | I can work efficiently |

### Acceptance Criteria

**WORK-1: Task List**
- [ ] Shows tasks assigned to worker
- [ ] Filterable by type (production, picking, IPM)
- [ ] Sorted by priority/due date
- [ ] Pull-to-refresh updates list
- [ ] Badge count for pending tasks

**WORK-2: Quick Stats**
- [ ] Tasks completed today
- [ ] Items picked today
- [ ] Current streak (days active)
- [ ] Team ranking (optional)

**WORK-3: Navigation**
- [ ] Bottom nav with key features: Tasks, Scan, Picking, More
- [ ] Large touch targets (44x44px minimum)
- [ ] Safe area handling for notched phones
- [ ] Haptic feedback on key actions

---

## 7.2 Task Execution

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| TASK-1 | Worker | View task details | I know what to do |
| TASK-2 | Worker | Complete task from phone | I don't need a computer |
| TASK-3 | Worker | Defer task to later | I can prioritize |
| TASK-4 | Worker | Add notes and photos | I can document my work |

### Acceptance Criteria

**TASK-1: Task Details**
- [ ] Shows task type and instructions
- [ ] Shows batch/location information
- [ ] Shows checklist items (if applicable)
- [ ] Shows any attached resources

**TASK-2: Complete Task**
- [ ] Mark checklist items done
- [ ] Enter completion notes
- [ ] Confirm completion
- [ ] Task removed from pending list
- [ ] Productivity updated

**TASK-3: Defer Task**
- [ ] Option to defer to later
- [ ] Select defer reason
- [ ] Task remains in list but marked deferred
- [ ] Manager visibility into deferrals

**TASK-4: Documentation**
- [ ] Add notes text
- [ ] Capture photo from camera
- [ ] Attach to task completion record
- [ ] View attached items later

---

## 7.3 Mobile Picking

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| MPICK-1 | Picker | See assigned pick lists | I know what to pick |
| MPICK-2 | Picker | Pick items from phone | I can work mobile |
| MPICK-3 | Picker | Scan to confirm batch | I pick the right plants |
| MPICK-4 | Picker | Use multi-batch picking | I can fulfill efficiently |

### Acceptance Criteria

**MPICK-1: Pick List View**
- [ ] Shows assigned lists
- [ ] Progress indicator per list
- [ ] Tap to open list
- [ ] Status badges (pending, in progress, complete)

**MPICK-2: Item Picking**
- [ ] Item shows: product, quantity needed, location
- [ ] Large quantity steppers
- [ ] Mark as picked
- [ ] Progress updates immediately

**MPICK-3: Scan Confirmation**
- [ ] Scan batch QR code
- [ ] System validates: correct batch?
- [ ] If correct → auto-fill quantity or prompt
- [ ] If wrong → warning "Wrong batch, expected X"

**MPICK-4: Multi-Batch Sheet**
- [ ] Opens when multiple batches possible
- [ ] All eligible batches listed
- [ ] Quantity stepper per batch
- [ ] Auto-fill FEFO option
- [ ] Running total prominent
- [ ] Confirm saves all at once

### Edge Cases
- Batch not in expected location → allow override with scan
- Short quantity → mark short, record actual
- Network loss during pick → queue locally, sync later

---

## 7.4 Offline Support

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| OFF-1 | Worker | Work without internet | I can work in signal-dead areas |
| OFF-2 | Worker | See when I'm offline | I know my data isn't syncing |
| OFF-3 | System | Sync when reconnected | Data is preserved |

### Acceptance Criteria

**OFF-1: Offline Capability**
- [ ] Tasks cached locally when online
- [ ] Task completion queued for sync
- [ ] Batch lookups work from cache
- [ ] Picking actions queued

**OFF-2: Offline Indicator**
- [ ] Visual indicator when offline (banner or icon)
- [ ] Shows count of pending actions
- [ ] Color change: online=green, offline=yellow

**OFF-3: Sync Behavior**
- [ ] Auto-sync when connection restored
- [ ] Conflict resolution: server wins for data, queue preserved for actions
- [ ] Notification when sync complete
- [ ] Error display if sync fails

### Edge Cases
- Task modified on server while offline → show conflict, ask user
- App killed while offline → queue persists, sync on restart
- Long offline period → cache may be stale, full refresh on reconnect

---

## 7.5 Worker Printing

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| PRT-1 | Worker | Print batch labels | Batches are identified |
| PRT-2 | Worker | Print from mobile | I don't need a computer |
| PRT-3 | Worker | See print status | I know if print succeeded |

### Acceptance Criteria

**PRT-1: Label Types**
- [ ] Batch labels with QR code
- [ ] Location labels
- [ ] Trolley labels
- [ ] Material lot labels

**PRT-2: Mobile Print**
- [ ] Select label type
- [ ] Select item to label
- [ ] Tap print button
- [ ] Job sent to print agent

**PRT-3: Print Status**
- [ ] Shows queue status
- [ ] Success/failure indication
- [ ] Reprint option
- [ ] Printer connection status

---

# 8. Reporting & Analytics

## 8.1 Production Reports

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| RPT-1 | Manager | View inventory summary | I know what stock I have |
| RPT-2 | Manager | View batch age distribution | I can plan harvests |
| RPT-3 | Manager | View loss trends | I can identify problems |

### Acceptance Criteria

**RPT-1: Inventory Summary**
- [ ] Total plants by variety
- [ ] Total by status (growing, ready, saleable)
- [ ] Available vs allocated
- [ ] Filterable by location, variety
- [ ] Export to Excel/CSV

**RPT-2: Batch Age Histogram**
- [ ] Distribution of batch ages
- [ ] Grouped by weeks or days
- [ ] Color-coded by variety/size
- [ ] Click-through to batch list

**RPT-3: Loss Trend Chart**
- [ ] Loss quantity over time
- [ ] Breakdown by cause (pest, disease, environmental)
- [ ] Compare periods
- [ ] Alert threshold lines

---

## 8.2 Sales Reports

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| SRPT-1 | Manager | View sales dashboard | I see revenue at a glance |
| SRPT-2 | Manager | View order pipeline | I know upcoming work |
| SRPT-3 | Manager | View customer activity | I understand customer behavior |

### Acceptance Criteria

**SRPT-1: Sales Dashboard**
- [ ] Revenue: today, week, month, YTD
- [ ] Order count by status
- [ ] Top products by volume
- [ ] Trend comparison to prior period

**SRPT-2: Order Pipeline**
- [ ] Orders by status (funnel view)
- [ ] Delivery schedule calendar
- [ ] Picking workload forecast
- [ ] Capacity warnings

**SRPT-3: Customer Reports**
- [ ] Orders by customer
- [ ] Revenue by customer
- [ ] Product preferences
- [ ] Last order date

---

## 8.3 Performance Reports

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| PERF-1 | Manager | View picker productivity | I can optimize staffing |
| PERF-2 | Manager | View protocol performance | I can improve growing methods |
| PERF-3 | Manager | View delivery metrics | I can track service levels |

### Acceptance Criteria

**PERF-1: Picker Productivity**
- [ ] Items picked per hour
- [ ] Pick accuracy (errors/shorts)
- [ ] By picker, by team
- [ ] Trend over time

**PERF-2: Protocol Performance**
- [ ] Actual vs planned duration
- [ ] Yield rate by protocol
- [ ] Loss rate by protocol
- [ ] Recommendations for optimization

**PERF-3: Delivery Metrics**
- [ ] On-time delivery rate
- [ ] Damage rate
- [ ] Customer satisfaction scores
- [ ] Carrier comparison

---

# 9. B2B Portal (CanopyB2B)

## 9.1 Customer Self-Service

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| B2B-1 | Customer | Log into my account | I can place orders |
| B2B-2 | Customer | Browse available products | I can see what's for sale |
| B2B-3 | Customer | Place orders online | I don't need to call/email |
| B2B-4 | Customer | View my order history | I can track past orders |

### Acceptance Criteria

**B2B-1: Customer Login**
- [ ] Separate login portal from admin
- [ ] Customer credentials (email/password)
- [ ] Password reset capability
- [ ] Session management

**B2B-2: Product Browsing**
- [ ] Product catalog view
- [ ] Filter by category/variety
- [ ] Shows pricing (customer-specific if applicable)
- [ ] Shows availability
- [ ] Product images

**B2B-3: Online Ordering**
- [ ] Add to cart
- [ ] Specify quantities
- [ ] Select delivery date
- [ ] Submit order
- [ ] Order confirmation email

**B2B-4: Order History**
- [ ] List of past orders
- [ ] Order status tracking
- [ ] Invoice download
- [ ] Reorder from history

### Edge Cases
- Customer account disabled → login rejected with message
- Product out of stock → show unavailable, allow notification request
- Price changed since cart addition → notify before checkout

---

# 10. Administration

## 10.1 Reference Data

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| REF-1 | Admin | Manage plant varieties | Catalog is accurate |
| REF-2 | Admin | Manage plant sizes | Container types are defined |
| REF-3 | Admin | Manage locations | Nursery layout is mapped |
| REF-4 | Admin | Manage suppliers | Purchasing info is available |

### Acceptance Criteria

**REF-1: Plant Varieties**
- [ ] Add/edit/deactivate varieties
- [ ] Family, genus, species taxonomy
- [ ] Default growing protocol
- [ ] Images and descriptions

**REF-2: Plant Sizes**
- [ ] Container types (pot, tray, plug)
- [ ] Cell configurations (cells per tray)
- [ ] Volume and diameter
- [ ] Default pricing

**REF-3: Locations**
- [ ] Location hierarchy (site > zone > bay)
- [ ] Capacity settings
- [ ] Health status
- [ ] QR code for scanning

**REF-4: Suppliers**
- [ ] Contact information
- [ ] Address
- [ ] Lead times
- [ ] Payment terms

---

## 10.2 System Settings

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| SET-1 | Admin | Configure organization settings | System matches our business |
| SET-2 | Admin | Manage label templates | Labels look correct |
| SET-3 | Admin | Manage document templates | Documents are branded |
| SET-4 | Admin | Configure printers | Printing works |

### Acceptance Criteria

**SET-1: Organization Settings**
- [ ] Company name and code
- [ ] Address and contact info
- [ ] Currency and date formats
- [ ] Feature flags

**SET-2: Label Templates**
- [ ] Design label layouts
- [ ] Add QR codes, barcodes
- [ ] Preview before saving
- [ ] Assign to label types

**SET-3: Document Templates**
- [ ] Invoice template
- [ ] Delivery docket template
- [ ] Batch passport template
- [ ] Custom header/footer

**SET-4: Printer Configuration**
- [ ] Register label printers
- [ ] Test connectivity
- [ ] Assign default printers
- [ ] Print agent status

---

# Appendix A: Business Rules Summary

## Inventory Rules
- All stock movements tracked with timestamps
- FEFO (First Expired, First Out) for allocation by default
- Grade A preferred before B before C
- Restricted batches excluded from allocation

## Order Rules
- Orders must be confirmed before picking
- MOQ enforced at line item level
- Substitutions require customer approval
- Cannot ship from restricted locations

## Production Rules
- Batch ready dates computed from protocol + planting date
- Transplant chains tracked (parent → children)
- Loss must be recorded on batch archival
- Total quantity conservation: source - transfer + child = constant

## Health Rules
- Restricted locations prevent picking/sales
- Restrictions have defined expiration dates
- Health status inherited from parent batch
- Quarantine affects all descendant batches

---

# Appendix B: Adding New Features

When adding a new feature to this document:

1. **Add User Stories** - Who needs it and why (ID, As a..., I want to..., So that...)
2. **Define Acceptance Criteria** - Testable checkboxes
3. **List Edge Cases** - Unusual situations to handle
4. **Specify Not Supported** - Explicit scope limits
5. **Update Tester Tim** - Ensure test scenarios match new features

---

# Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Initial comprehensive documentation from codebase exploration | Jimmy |

---

*This document is the source of truth for feature behavior. When in doubt, refer here. When specs conflict with code, update either the spec or the code - but never leave them inconsistent.*
