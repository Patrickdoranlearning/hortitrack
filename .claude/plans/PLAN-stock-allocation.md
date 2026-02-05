# Implementation Plan: Two-Tier Stock Allocation System

**Status**: Complete
**Created**: 2026-02-04
**Completed**: 2026-02-04
**Author**: Dual-Plan Synthesis (MVP Speed + Proper Architecture)
**Complexity**: XL
**Estimated Sessions**: 6-8
**Approach**: Full Architecture with pragmatic shortcuts

---

## Executive Summary

Implement a **two-tier stock allocation system** that separates:
- **Tier 1 (Product Allocation)**: Reserve against product when order confirmed
- **Tier 2 (Batch Allocation)**: Assign specific batches when picking starts

### Key Decisions (from requirements gathering)

| Decision | Choice |
|----------|--------|
| Product ATS | Hybrid - calculated from batches with optional override |
| Saleable gate | `sales_status = 'available'` (not growing_status) |
| Overselling | Allowed with warning |
| Shortage priority | FIFO by order confirmation date |
| Batch matching | Hybrid - auto-match criteria with manual overrides |
| Allocation trigger | On order `confirmed` status |
| B2B visibility | Stock indicators (In/Low/Out), not exact numbers |
| Picker UX | Filterable batch list (by variety, etc.) |

---

## 1. Problem Statement

Currently, orders require batch-level allocation at order creation time. This:
1. Forces sales to know exact batches before confirming orders
2. Creates conflicts when multiple orders compete for same batches
3. Doesn't match real-world workflow (batch selection happens at picking)
4. Makes product-level availability reporting inaccurate

### Solution: Two-Tier Allocation

```
ORDER LIFECYCLE
===============

[Draft] --> [Confirmed] --> [Picking] --> [Picked] --> [Dispatched]
               |                |
               v                v
         +-----------+    +-----------+
         | TIER 1    |    | TIER 2    |
         | Product   |    | Batch     |
         | Allocation|    | Allocation|
         +-----------+    +-----------+
               |                |
               v                v
         Decrements       Decrements
         Product ATS      Batch Available
```

---

## 2. Technical Design

### New Database Objects

#### 2.1 Enums

```sql
-- Allocation tier
CREATE TYPE allocation_tier AS ENUM ('product', 'batch');

-- Allocation status (state machine)
CREATE TYPE allocation_status_v2 AS ENUM (
    'reserved',    -- Tier 1: Product level, awaiting batch selection
    'allocated',   -- Tier 2: Batch selected, awaiting picking
    'picked',      -- Items physically picked
    'shipped',     -- Order dispatched
    'cancelled'    -- Allocation released
);

-- Inventory event types
CREATE TYPE inventory_event_type AS ENUM (
    'PRODUCT_RESERVED',
    'PRODUCT_UNRESERVED',
    'BATCH_ALLOCATED',
    'BATCH_DEALLOCATED',
    'BATCH_PICKED',
    'BATCH_PICK_REVERSED',
    'BATCH_SHIPPED',
    'MANUAL_ADJUSTMENT',
    'SHORTAGE_RECORDED',
    'OVERSELL_RECORDED'
);
```

#### 2.2 allocation_ledger Table

Unified allocation tracking with explicit tier and status:

```sql
CREATE TABLE public.allocation_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id),
    batch_id uuid REFERENCES batches(id),  -- NULL for Tier 1

    allocation_tier allocation_tier NOT NULL DEFAULT 'product',
    allocation_status allocation_status_v2 NOT NULL DEFAULT 'reserved',

    quantity integer NOT NULL CHECK (quantity > 0),
    picked_quantity integer NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),

    reserved_at timestamptz NOT NULL DEFAULT now(),
    allocated_at timestamptz,
    picked_at timestamptz,
    shipped_at timestamptz,
    cancelled_at timestamptz,

    priority_rank integer,  -- For FIFO shortage handling

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT unique_order_item_allocation UNIQUE (order_item_id),
    CONSTRAINT tier_batch_consistency CHECK (
        (allocation_tier = 'product' AND batch_id IS NULL) OR
        (allocation_tier = 'batch' AND batch_id IS NOT NULL)
    )
);
```

#### 2.3 inventory_events Table

Event sourcing for full audit trail:

```sql
CREATE TABLE public.inventory_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    event_type inventory_event_type NOT NULL,

    allocation_id uuid REFERENCES allocation_ledger(id),
    product_id uuid REFERENCES products(id),
    batch_id uuid REFERENCES batches(id),
    order_id uuid REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),

    quantity_change integer NOT NULL,
    running_product_ats integer,  -- Product ATS after this event
    running_batch_available integer,  -- Batch available after this event

    metadata jsonb NOT NULL DEFAULT '{}',
    actor_id uuid REFERENCES auth.users(id),
    occurred_at timestamptz NOT NULL DEFAULT now(),

    created_at timestamptz NOT NULL DEFAULT now()
);
```

#### 2.4 Products Table Additions

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS ats_override integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_oversell boolean DEFAULT true;
```

### State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │         ALLOCATION STATE MACHINE            │
                    └─────────────────────────────────────────────┘

[*] ──order_confirmed──> [reserved] ──batch_selected──> [allocated]
                              │                              │
                              │ order_cancelled              │ item_picked
                              v                              v
                         [cancelled] <──order_cancelled── [picked]
                                                              │
                                                              │ order_dispatched
                                                              v
                                                          [shipped]

State Impacts:
┌───────────┬─────────┬──────────────────┬──────────────────────┐
│ State     │ Tier    │ Product ATS      │ Batch Reserved       │
├───────────┼─────────┼──────────────────┼──────────────────────┤
│ reserved  │ product │ -N (decremented) │ 0 (not affected)     │
│ allocated │ batch   │ 0 (released)     │ +N (incremented)     │
│ picked    │ batch   │ 0                │ 0 (qty deducted)     │
│ shipped   │ batch   │ 0                │ 0                    │
│ cancelled │ either  │ +N (if Tier 1)   │ -N (if Tier 2)       │
└───────────┴─────────┴──────────────────┴──────────────────────┘
```

### Key RPCs

#### fn_create_product_allocation
Creates Tier 1 allocation when order confirmed.

```sql
CREATE OR REPLACE FUNCTION public.fn_create_product_allocation(
    p_org_id uuid,
    p_order_item_id uuid,
    p_product_id uuid,
    p_quantity integer,
    p_actor_id uuid DEFAULT NULL
) RETURNS uuid AS $$
    -- Creates allocation_ledger entry with tier='product', status='reserved'
    -- Logs PRODUCT_RESERVED event
    -- Returns allocation_id
$$;
```

#### fn_transition_to_batch_allocation
Upgrades Tier 1 → Tier 2 when picker selects batch.

```sql
CREATE OR REPLACE FUNCTION public.fn_transition_to_batch_allocation(
    p_allocation_id uuid,
    p_batch_id uuid,
    p_actor_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
    -- Validates batch has sufficient stock
    -- Updates allocation: tier='batch', status='allocated', batch_id=X
    -- Logs BATCH_ALLOCATED event
    -- Updates batch.reserved_quantity
    -- Returns success/error with details
$$;
```

#### fn_get_allocation_candidates
Returns batches available for a product (picker's filterable list).

```sql
CREATE OR REPLACE FUNCTION public.fn_get_allocation_candidates(
    p_org_id uuid,
    p_product_id uuid,
    p_variety_filter text DEFAULT NULL,
    p_location_filter uuid DEFAULT NULL
) RETURNS TABLE (
    batch_id uuid,
    batch_number text,
    variety_name text,
    available_quantity integer,
    location_name text,
    growing_status text,
    age_weeks integer,
    planted_at date
) AS $$
    -- Returns saleable batches linked to product
    -- Filters: sales_status='available', archived_at IS NULL
    -- Sorted by planted_at ASC (FEFO)
    -- Optional filters by variety name, location
$$;
```

#### fn_calculate_product_ats
Returns product Available-to-Sell (hybrid calculation).

```sql
CREATE OR REPLACE FUNCTION public.fn_calculate_product_ats(
    p_product_id uuid
) RETURNS TABLE (
    calculated_ats integer,
    override_ats integer,
    effective_ats integer,
    tier1_reserved integer,
    stock_status text  -- 'in_stock', 'low_stock', 'out_of_stock'
) AS $$
    -- calculated_ats = sum of linked batch (quantity - reserved_quantity)
    --                  WHERE sales_status = 'available'
    -- tier1_reserved = sum of allocation_ledger WHERE tier='product' AND status='reserved'
    -- effective_ats = COALESCE(override_ats, calculated_ats) - tier1_reserved
    -- stock_status based on low_stock_threshold
$$;
```

### Product ATS Calculation Logic

```
Product ATS = Calculated Stock - Tier 1 Reservations

Where:
  Calculated Stock = SUM(batch.quantity - batch.reserved_quantity)
                     FOR batches WHERE:
                       - sales_status = 'available'
                       - archived_at IS NULL
                       - linked via product_batches OR auto-matched

  Tier 1 Reservations = SUM(allocation_ledger.quantity)
                        WHERE tier = 'product'
                        AND status = 'reserved'

Override:
  If product.ats_override IS NOT NULL:
    effective_ats = ats_override - tier1_reservations
```

---

## 3. UI Components

### 3.1 BatchSelectionSheet
Picker's batch selection interface.

**Location**: `/src/components/picking/BatchSelectionSheet.tsx`

**Features**:
- Filterable list of available batches
- Filter by variety name (e.g., "Kramers Red", "Hidcote")
- Filter by location
- Shows: batch number, variety, available qty, location, age
- Sorted by planted_at (FEFO)
- Select one or multiple batches to fulfill order item quantity

### 3.2 ProductATSBadge
Stock status indicator for product listings.

**Location**: `/src/components/sales/ProductATSBadge.tsx`

**States**:
- 🟢 "In Stock" - effective_ats > low_stock_threshold
- 🟡 "Low Stock" - 0 < effective_ats <= low_stock_threshold
- 🔴 "Out of Stock" - effective_ats <= 0

### 3.3 AllocationTimeline
Shows allocation event history on order detail page.

**Location**: `/src/components/orders/AllocationTimeline.tsx`

**Shows**:
- Event type, timestamp, actor
- Quantity changes
- Before/after status

---

## 4. Implementation Phases

### Phase 1: Database Foundation (P0)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| Create enums | data-engineer | S | All 3 enums exist |
| Create allocation_ledger table | data-engineer | L | Table with RLS, indexes, constraints |
| Create inventory_events table | data-engineer | M | Table with RLS, indexes |
| Add products columns | data-engineer | S | 3 new columns exist |
| Create v_product_inventory view | data-engineer | M | View returns correct ATS |

### Phase 2: Core RPCs (P0)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| fn_log_inventory_event | data-engineer | M | Events logged atomically |
| fn_calculate_product_ats | data-engineer | M | ATS correct with override |
| fn_create_product_allocation | data-engineer | L | Creates Tier 1, logs event |
| fn_transition_to_batch_allocation | data-engineer | L | Tier 1→2 transition works |
| fn_get_allocation_candidates | data-engineer | M | Filterable batch list |
| fn_cancel_allocation | data-engineer | M | Releases allocations |

### Phase 3: Order Flow (P0)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| create_order_with_product_allocation RPC | data-engineer | L | Order creates Tier 1 allocations |
| Update createOrder server action | feature-builder | M | Uses new RPC |
| Update order creation UI | feature-builder | M | No batch selection required |
| Create BatchSelectionSheet | feature-builder | L | Picker can select batches |
| Picking transition logic | feature-builder | M | Triggers batch selection |

### Phase 4: Stock Indicators (P1)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| fn_get_product_stock_status RPC | data-engineer | S | Returns stock status |
| ProductATSBadge component | feature-builder | S | Shows correct status |
| B2B portal indicators | feature-builder | M | B2B shows availability |
| Oversell warning | feature-builder | S | Warning when qty > ATS |

### Phase 5: Audit & Timeline (P1)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| AllocationTimeline component | feature-builder | M | Shows event history |
| Add to order detail page | feature-builder | S | Timeline visible |

### Phase 6: Migration & Compatibility (P0)
| Task | Agent | Size | Acceptance Criteria |
|------|-------|------|---------------------|
| Migrate existing batch_allocations | data-engineer | L | Data migrated correctly |
| Backward compatibility view | data-engineer | M | Old queries work |
| Update picking functions | data-engineer | M | Works with both systems |
| Test on staging | verifier | M | All orders work |

---

## 5. Data Migration Strategy

### Existing Data
- `batch_allocations` records with `batch_id` set → migrate as Tier 2 (`tier='batch'`, `status='allocated'`)
- Orders in `picking`/`packed`/`dispatched` status → keep allocations as-is

### Migration Script
```sql
INSERT INTO allocation_ledger (
    org_id, order_item_id, product_id, batch_id,
    allocation_tier, allocation_status,
    quantity, reserved_at, allocated_at
)
SELECT
    ba.org_id,
    ba.order_item_id,
    oi.product_id,
    ba.batch_id,
    'batch'::allocation_tier,
    CASE ba.status
        WHEN 'reserved' THEN 'allocated'
        WHEN 'picked' THEN 'picked'
        WHEN 'short' THEN 'cancelled'
        ELSE 'allocated'
    END::allocation_status_v2,
    ba.quantity,
    ba.created_at,
    ba.created_at
FROM batch_allocations ba
JOIN order_items oi ON ba.order_item_id = oi.id
WHERE ba.batch_id IS NOT NULL;
```

### Backward Compatibility
Create view `v_batch_allocations_compat` that queries `allocation_ledger` with old column names.

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration corrupts data | High | Test on staging, rollback script |
| ATS calculation slow | Medium | Indexed view, cache if needed |
| Race conditions | High | Row-level locking in RPCs |
| Breaking existing orders | High | Backward compatibility view |

---

## 7. Definition of Done

- [ ] All P0 phases complete
- [ ] All P1 phases complete
- [ ] Tests passing (verifier)
- [ ] Code reviewed (reviewer)
- [ ] Security checked (security-auditor)
- [ ] Migration tested on staging
- [ ] User acceptance:
  - [ ] Sales can create orders without batch selection
  - [ ] Pickers can select batches during picking
  - [ ] Stock indicators visible in UI
  - [ ] Existing orders still work

---

## 8. Execution

```bash
jimmy execute .claude/plans/PLAN-stock-allocation.md --mode thorough
```

**Routing**:
- Start with `data-engineer` for Phases 1-2
- `feature-builder` for Phases 3-5
- `verifier` for Phase 6 testing
- Run `security-auditor` before merge

---

*Synthesized from MVP Speed and Proper Architecture dual-plan perspectives.*
