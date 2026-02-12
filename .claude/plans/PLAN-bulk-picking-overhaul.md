# PLAN: Bulk Picking Overhaul — Synthesized

> Dual plan synthesis: Senior Software Engineer (A) + Dispatch Manager (B)
> See: `bulk-picking-engineer-plan.md` and `bulk-picking-dispatch-plan.md`

## Summary

Fix the broken bulk picking system (tables never created), then add product-based grouping, picker specializations, and a morning planning dashboard. 4 phases, each deliverable independently.

## Key Design Decisions (Where the Plans Diverged)

| Decision | Engineer (A) | Dispatch Manager (B) | **Selected** | Rationale |
|----------|-------------|---------------------|--------------|-----------|
| Size categories | Separate lookup tables (`picking_size_categories` + junction) | `size_category text` column on `plant_sizes` | **A (lookup tables)** | Owner mentioned "Asta picks planters" — planters isn't a standard category. Org-configurable categories let Doran Nurseries define their own groupings. Worth the extra table. |
| Picker specializations | Separate `picker_specializations` table with proficiency (1-3) | `specialisations text[]` on `picking_team_members` | **A (separate table)** | Proficiency levels enable smart load-balancing (prefer expert over "can do"). Clean data model. |
| Product grouping UI location | New tab on batch **creation** page | New tab on batch **workflow** page | **Both** | Show product view during creation (to plan what to batch) AND during workflow (to track progress by category). |
| Morning Planner | Not included | Dedicated `/dispatch/bulk-picking/planner` page | **B (include it)** | This is the killer feature. "What does the dispatch manager do at 6am?" — plan the day. |
| Worker view | "My Items" toggle on batch workflow | Filtered worker dispatch page showing only assigned items | **B (dedicated worker view)** | Pickers need to see ONLY their items, not toggle a filter on a manager page. |
| Print List | Not included | Print button generates printable A4 pick list | **B (include it)** | Pickers in polytunnels don't always have phones. Paper backup is essential. |
| Assignment algorithm | Proficiency + load-balanced round-robin | Auto-suggest by specialisation matching | **A (proficiency + load balance)** | Well-designed algorithm. Assign biggest items first, prefer highest proficiency, balance by unit count. |

---

## Phase 1: Fix the Bug (P0 — Unblocks Everything)

**What**: Apply the existing migration `20251221100000_picking_workflow_enhancements.sql` to create 3 tables.

| # | Task | Agent | Size |
|---|------|-------|------|
| 1.1 | Apply migration to production Supabase | `data-engineer` | S |
| 1.2 | Verify page loads, no schema errors | `verifier` | S |
| 1.3 | Smoke test: create batch → pick items → pack order | `verifier` | S |
| 1.4 | Regenerate TypeScript types | `feature-builder` | S |

**Done when**: `/dispatch/bulk-picking` loads, batch creation works end-to-end.

---

## Phase 2: Size Categories + Picker Specializations (P0)

**What**: Create the data model for product grouping and picker assignment.

### New Tables (1 migration)

1. **`picking_size_categories`** — org-configurable size groupings (e.g., "Small Pots", "Large Pots", "Planters")
2. **`picking_size_category_sizes`** — junction mapping categories → `plant_sizes`
3. **`picker_specializations`** — user → category with proficiency (1=can, 2=preferred, 3=expert)
4. Two new columns on `bulk_pick_items`: `assigned_to uuid`, `size_category_id uuid`

### Default seed data for Doran Nurseries

| Category | Sizes |
|----------|-------|
| Small Pots | P9, P10, P11, P13, P17, P19, 1L, 1.5L, 2L |
| Large Pots | 3L, 5L, 10L |
| Trays & Plugs | 6 Pack, 40 Cell, 84 Cell, 104 Cell, 144 Plug, 200 Plug, 273 Prop |
| Bareroot | Bareroot |

### Admin UI

- `SizeCategoryManager` — manage categories and their size mappings
- `PickerSpecializationSettings` — matrix: pickers × categories with proficiency toggles

| # | Task | Agent | Size |
|---|------|-------|------|
| 2.1 | Create migration (3 tables + 2 columns + RLS + seed data) | `data-engineer` | M |
| 2.2 | API: CRUD for size categories | `feature-builder` | M |
| 2.3 | API: CRUD for picker specializations | `feature-builder` | M |
| 2.4 | UI: SizeCategoryManager component | `feature-builder` | M |
| 2.5 | UI: PickerSpecializationSettings component | `feature-builder` | M |
| 2.6 | Settings page for specialization management | `feature-builder` | S |

**Done when**: Admin can configure "Asta → Large Pots (expert)", "Ramunas → Small Pots (expert)".

---

## Phase 3: Product-Based Grouping + Picker Assignment UI (P0-P1)

**What**: New views for seeing items by product category and by assigned picker.

### Batch Creation — "By Product" Tab

```
+--------------------------------------------------+
| Create New Bulk Pick                              |
| [By Delivery Date] [By Product]                   |
+--------------------------------------------------+
| --- Small Pots (340 units across 12 orders) ---   |
| [x] Lavender 1L              120 units  5 orders  |
| [x] Rosemary 1.5L             80 units  3 orders  |
| [x] Thyme 2L                  60 units  4 orders  |
|                                                    |
| --- Large Pots (180 units across 8 orders) ---    |
| [x] Hydrangea 5L              30 units  2 orders  |
| [x] Acer 10L                 100 units  3 orders  |
+--------------------------------------------------+
```

### Batch Workflow — Picker Assignment View

```
+--------------------------------------------------+
| [All Items] [My Items]  [By Product]              |
|                                                    |
| --- Asta (Large Pots) --- 3/5 picked             |
| [x] Lavender 3L          x50  PICKED              |
| [ ] Photinia 3L           x25  PENDING             |
|                                                    |
| --- Ramunas (Small Pots) --- 1/3 picked           |
| [x] Lavender 1L          x120  PICKED             |
| [ ] Rosemary 1.5L         x80  PENDING             |
|                                                    |
| --- Unassigned --- 0/2 picked                      |
| [ ] Mixed herbs 6 Pack   x400  PENDING             |
+--------------------------------------------------+
```

| # | Task | Agent | Size |
|---|------|-------|------|
| 3.1 | API: `GET /api/bulk-picking/preview-products` (aggregate items by SKU+category across orders) | `feature-builder` | M |
| 3.2 | UI: "By Product" tab on batch creation page | `feature-builder` | L |
| 3.3 | UI: Product grouping view on batch workflow page | `feature-builder` | M |
| 3.4 | UI: Picker assignment grouping on batch workflow page | `feature-builder` | M |
| 3.5 | UI: "My Items" toggle for individual pickers | `feature-builder` | S |
| 3.6 | API: Include assignment + category data in batch detail endpoint | `feature-builder` | S |

**Done when**: Manager can see items grouped by product category AND by assigned picker.

---

## Phase 4: Smart Assignment + Morning Planner (P1)

**What**: Auto-assign items to pickers, morning planning dashboard, worker view, print lists.

### Morning Planner (`/dispatch/bulk-picking/planner`)

```
+------------------------------------------------------+
| Morning Plan - Tuesday 11 Feb              [Refresh]  |
| 3 delivery runs | 12 orders | 496 total units        |
+------------------------------------------------------+
| +------ ASTA ----+  +--- RAMUNAS ---+  +--- MARIA --+|
| | Large Pots     |  | Small Pots    |  | Trays      ||
| | [====    ] 30% |  | [==      ] 15%|  | [     ] 0% ||
| | 122 units      |  | 312 units     |  | 28 trays   ||
| | [Assign]       |  | [Assign]      |  | [Assign]   ||
| | [Print List]   |  | [Print List]  |  | [Print List]||
| +----------------+  +---------------+  +------------+|
|                                                        |
| UNASSIGNED                                             |
| 6 Pack Geranium x24                    [Assign to...] |
+------------------------------------------------------+
```

### Worker View (filtered)

```
+------------------------------------------------------+
| Your Picks Today                       [Refresh]      |
| Batch: BP-20260211-A4XK | Small Pots                 |
| [======     ] 45% complete (140/312 units)            |
|                                                        |
| 1.5L Euonymus Emerald Gold          x80               |
| For: #1042 (x30), #1044 (x20), #1047 (x30)          |
|                                     [Pick All]        |
+------------------------------------------------------+
```

### Assignment Algorithm

```
For each bulk_pick_item:
  1. Resolve: SKU → plant_size → size_category
  2. Find pickers specialized in that category (sorted by proficiency DESC)
  3. Among equally-proficient pickers, pick the one with lowest current load
  4. Items with no matching specialization → unassigned
```

| # | Task | Agent | Size |
|---|------|-------|------|
| 4.1 | Implement auto-assignment algorithm (server-side) | `feature-builder` | M |
| 4.2 | Integrate into POST /api/bulk-picking batch creation | `feature-builder` | M |
| 4.3 | API: Morning planner endpoint | `feature-builder` | M |
| 4.4 | API: Assign/reassign items to picker | `feature-builder` | S |
| 4.5 | UI: Morning planner page with picker columns + progress | `feature-builder` | L |
| 4.6 | UI: Worker view filtered by assigned picker | `feature-builder` | M |
| 4.7 | UI: Print pick list (printable A4) | `feature-builder` | S |
| 4.8 | Progress polling (15s) or Supabase Realtime | `feature-builder` | M |
| 4.9 | End-to-end verification | `verifier` | M |

**Done when**: Manager opens planner at 6am, sees work split by picker, assigns, workers see their items, progress updates live.

---

## Execution Order

```
Phase 1 (1 session)  ←── MUST DO FIRST (unblocks everything)
    ↓
Phase 2 (2 sessions) ←── Schema + admin UI
    ↓
Phase 3 (2 sessions) ←── Product views + picker assignment views
    ↓
Phase 4 (3 sessions) ←── Morning planner + worker view + auto-assign
```

**Parallel opportunity**: Phase 3 tasks 3.1-3.3 (product grouping UI) can start after Phase 1, in parallel with Phase 2.

## Jimmy Command

```
jimmy execute .claude/plans/PLAN-bulk-picking-overhaul.md --mode thorough
```

## Success Criteria

- [ ] Bulk picking page loads (no schema errors)
- [ ] Batches can be created and completed end-to-end
- [ ] Items viewable grouped by product category
- [ ] Asta sees her Large Pots assignments
- [ ] Ramunas sees his Small Pots assignments
- [ ] Morning planner shows today's work split by picker
- [ ] Workers see only their assigned items
- [ ] Pick lists printable as paper backup
- [ ] All new tables have RLS
- [ ] No cross-org data leakage
