# Production Recipes Feature Plan

**Status**: Phase 1 ✅ COMPLETE | Phase 2 📋 PLANNED

## Overview

Production Recipes define the growing timeline and conditions to take a plant from propagation (seed/cutting) to a saleable product. Recipes are reusable templates that standardize production and enable future optimization through data analysis.

---

## Current State (Phase 1) ✅ COMPLETE

### What's Built
- **Recipe Library** (`/production/recipes`) - Card grid view of all recipes
- **Recipe Editor** (`/production/recipes/[id]`) - Full edit capability
- **Stage Builder** - Define stages with duration, phase, and environmental targets
- **CRUD Operations** - Create, duplicate, archive, delete recipes
- **Planning Integration** - Assign recipes to planned batches
- **Protocol Drawer** - Visual protocol assignment in planning

### Data Model
```
protocols
├── id, org_id, name, description
├── target_variety_id → plant_varieties
├── target_size_id → plant_sizes (final product size)
├── is_active
├── definition (jsonb)
│   ├── summary
│   ├── steps[]
│   └── targets (temp, humidity, etc.)
└── route (jsonb)
    ├── nodes[] (stages)
    │   ├── id, label, durationDays
    │   ├── stageName (Propagation, Plug, Potted, etc.)
    │   └── targets (per-stage conditions)
    └── edges[] (stage connections)
```

### Implementation Files
- `src/app/production/recipes/page.tsx` - Recipe library
- `src/app/production/recipes/[id]/page.tsx` - Recipe detail/edit
- `src/app/production/recipes/RecipesClient.tsx` - Library component
- `src/app/production/planning/components/ProtocolDrawer.tsx` - Planning integration

---

## Phase 2: Enhanced Recipe Creation 📋 PLANNED

### Problem
Current form is basic - just name, variety, and simple stages. Nurseries need:
1. **Size flows** - The container progression (72-cell tray → plug → 1.5L pot)
2. **Week ranges** - When to start production to hit target sale weeks
3. **Seasonality** - Some varieties only produced in certain seasons

### Proposed Enhancements

#### 1. Size Flow Builder
Instead of a single "target size", define the progression:

```
Size Flow Example:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 72-cell     │ →  │ 9cm plug    │ →  │ 1.5L pot    │
│ (propagate) │    │ (grow on)   │    │ (finish)    │
│ 30 days     │    │ 60 days     │    │ 90 days     │
└─────────────┘    └─────────────┘    └─────────────┘
```

Data structure:
```typescript
sizeFlow: [
  { sizeId: "72-cell-tray", stageName: "Propagation", durationDays: 30 },
  { sizeId: "9cm-plug", stageName: "Plug", durationDays: 60 },
  { sizeId: "1.5L-pot", stageName: "Potted", durationDays: 90 },
]
```

#### 2. Target Week Ranges
Define optimal production windows:

```typescript
timing: {
  // When should the final product be ready?
  targetReadyWeeks: { start: 38, end: 44 }, // Weeks 38-44 (Sept-Oct)
  
  // Calculate backwards: if 180 days total, start Week 12-18
  calculatedStartWeeks: { start: 12, end: 18 },
  
  // Is this a seasonal recipe?
  seasonalOnly: true,
  seasons: ["spring", "autumn"],
}
```

#### 3. Recipe Form Improvements

**Section 1: Basic Info**
- Name, description
- Target variety (searchable)
- Season restrictions (optional)

**Section 2: Size Flow**
- Visual builder showing container progression
- Each step: Size → Duration → Next Size
- Auto-calculates total duration

**Section 3: Week Planning**
- Target ready weeks (when product should be saleable)
- Auto-calculates start weeks based on total duration
- Visual calendar showing production window

**Section 4: Stage Details** (expandable)
- Environmental targets per stage
- Notes and special instructions

---

## Phase 3: Performance Tracking 📋 PLANNED

### Data to Capture
When batches using a recipe complete:

```sql
CREATE TABLE protocol_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  protocol_id uuid REFERENCES protocols(id),
  batch_id uuid REFERENCES batches(id),
  planned_duration_days integer,
  actual_duration_days integer,
  planned_ready_week integer,
  actual_ready_week integer,
  initial_quantity integer,
  final_quantity integer,
  yield_pct numeric,
  completed_at timestamptz DEFAULT now()
);
```

### Analytics Views
- **Duration accuracy**: Planned vs actual days (are recipes realistic?)
- **Yield rates**: Which recipes have best success?
- **Seasonal patterns**: When do batches using this recipe perform best?

---

## Phase 4: Sales Integration 📋 FUTURE

### When Sales Data Exists
Link orders to batches to understand:
- Which recipes produce stock that sells fastest
- Optimal ready weeks for each variety
- Demand patterns by season

### AI Suggestions
With enough data:
- "Start Kramer's Red in Week 12 to hit peak demand Week 40"
- "This recipe typically runs 2 weeks over - consider adjusting"
- "Yield rate drops 15% when started after Week 20"

---

## Implementation Priority

| Priority | Feature | Effort | Value | Status |
|----------|---------|--------|-------|--------|
| 1 | Recipe library & editor | Medium | High | ✅ Done |
| 2 | Planning integration | Medium | High | ✅ Done |
| 3 | Size flow builder | Medium | High | 📋 Planned |
| 4 | Target week ranges | Medium | High | 📋 Planned |
| 5 | Performance tracking | High | High | 📋 Planned |
| 6 | Sales correlation | High | Very High | 📋 Future |

---

## UI/UX Notes

### Create Recipe Flow (Proposed for Phase 2)
1. **Start**: Select variety + final product size
2. **Build flow**: Add size steps backwards (finish → plug → propagation)
3. **Set timing**: Choose target ready weeks, see calculated start weeks
4. **Add details**: Environmental targets, notes (optional, collapsible)
5. **Save**: Recipe ready to use in planning

### Visual Elements
- Timeline bar showing relative stage durations
- Calendar widget for week selection
- Size icons/badges for container types
- Color-coded stages (propagation=green, plug=blue, potted=amber)

---

## Questions to Resolve

1. **Multiple size flows per recipe?** 
   - Could same variety have different routes (e.g., fast track vs standard)?
   - Suggest: Yes, create separate recipes for each route

2. **Location-specific recipes?**
   - Some stages may require specific locations (heated greenhouse, polytunnel)
   - Suggest: Add optional location per stage

3. **Recipe versioning?**
   - Track changes over time? Compare old vs new?
   - Suggest: Defer to Phase 3, keep simple for now

---

**Last Updated**: January 2026
