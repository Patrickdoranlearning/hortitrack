# Sales Targeting Page Redesign - Dual Plan

> **Status**: ✅ IMPLEMENTED (Phase 1 Complete)
> **Goal**: Redesign the sales targeting page to make the map view the primary, most powerful tool for route-based sales targeting with intuitive probability visualization.

## Implementation Summary

**Decisions Made:**
- ✅ Traffic light coloring (green/yellow/orange)
- ✅ Map view as primary (default)
- ✅ Client-side route optimization algorithm
- ✅ Mobile-friendly design

**Files Modified:**
- `src/lib/targeting/types.ts` - Added probability color helpers, haversine distance
- `src/lib/targeting/routeOptimization.ts` - NEW: Route optimization utilities
- `src/components/sales/targeting/MapContainer.tsx` - Probability colors, route polyline, marker sizing
- `src/components/sales/targeting/TargetMap.tsx` - New legend, mobile sidebar, "Add to Route"
- `src/components/sales/targeting/TargetsClient.tsx` - Map as default, route building panel

**Database Connection:** Uses existing `probability_score` field from `v_smart_sales_targets` view (0-100 scale)

---

## Executive Summary

### Current State
The existing sales targeting page has a solid foundation:
- Leaflet/OpenStreetMap integration with auto-fit bounds
- Smart targeting algorithm with probability scores (0-100) and route fit scores (0-20+)
- Dual view (list/map) with filtering by target reason
- Scheduled deliveries shown as red markers
- Targets colored by *reason type* (6 categories)

### Problem
The current color scheme is **reason-based** (why target them) rather than **probability-based** (how likely to convert). A salesperson looking at the map can't quickly answer: *"Which customers on this route have the highest chance of ordering today?"*

### Proposed Solution
Transform the map into a **probability heat map** with:
- **Green**: High probability (70%+) - call these first
- **Yellow/Amber**: Medium probability (40-69%) - worth calling
- **Orange/Red**: Low probability (<40%) - only if on route

---

## Industry Research Summary

### How Leading Companies Do This

| Software | Key Approach | Notable Feature |
|----------|-------------|-----------------|
| **Salesforce Maps** | Einstein AI scoring + proximity filters | Prioritize by "Einstein score" with route optimization |
| **Badger Maps** | Mobile-first route optimization | Up to 25 stops per optimized route |
| **eSpatial** | Heat mapping + territory balancing | 90% reduction in territory alignment time |
| **SPOTIO** | GPS activity tracking + visual territories | Mobile-first for field sales |
| **Maptive** | Google Maps + business heat maps | "Hot zones" for deal density |

### Key Insights from Research
1. **Heat maps > Discrete colors**: Industry standard uses warm-to-cool spectrum for instant pattern recognition
2. **Cluster markers at zoom-out**: Avoid clutter by grouping nearby customers
3. **Route visualization**: Show suggested driving route, not just pins
4. **Score-based sizing**: Higher-value targets get larger markers
5. **Layer toggles**: Let users show/hide different data types
6. **Quick actions**: Call, navigate, log - directly from map

**Sources:**
- [Maptive: 15 Best Sales Territory Mapping Software](https://www.maptive.com/15-best-sales-territory-mapping-software/)
- [Salesforce Maps](https://www.salesforce.com/sales/mapping-software/)
- [SPOTIO: Sales Mapping Software](https://spotio.com/blog/sales-mapping-software/)
- [Forma.ai: Sales Territory Planning Best Practices](https://www.forma.ai/resources/article/sales-territory-planning)
- [Eleken: Map UI Design Best Practices](https://www.eleken.co/blog-posts/map-ui-design)

---

## Dual Plan: Two Perspectives

---

# PERSPECTIVE A: Sales Director

> *"I need to know where to send my team today to maximize orders. Show me the money on a map."*

## Vision
A map that answers these questions in under 5 seconds:
1. Where are we already delivering today? (current route)
2. Who else near that route is likely to order?
3. What's the optimal order to visit them?

## Requirements (Priority Order)

### P0: Must Have for Launch

#### 1. Probability-Based Color Coding
**Current**: Colors mean "route match" vs "churn risk" vs "likely to order" (confusing)
**Proposed**: Traffic light system based on probability score:

| Color | Probability | Meaning | Action |
|-------|-------------|---------|--------|
| 🟢 **Green** | 70-100% | Hot lead - likely to order | Call now |
| 🟡 **Yellow** | 40-69% | Warm lead - worth trying | Call if on route |
| 🟠 **Orange** | <40% | Cool lead - low probability | Only if convenient |

*Why this works*: Sales people universally understand green = go, red = stop. No training needed.

#### 2. Current Route Visualization
- Show scheduled deliveries connected by a **route line** (not just dots)
- Route line should be prominent (thick, blue or purple)
- Shows the "spine" of today's delivery run

#### 3. "Smart Targets Nearby" Clustering
- When zoomed out: Show cluster markers with count of targets
- Cluster color = average probability of targets within
- Click cluster to zoom in and see individual targets

#### 4. Quick-Access Target Sidebar
- Click any target → slide-out panel with:
  - Customer name & contact
  - Probability score (big, prominent)
  - Last order date & value
  - One-click: Call | Create Order | Log Interaction
  - "Add to Today's Route" button

### P1: Should Have

#### 5. Route Optimizer
- Select multiple targets → "Optimize Route" button
- Shows optimal driving order with estimated time
- Can drag-drop to reorder stops
- Export to Google Maps / Apple Maps for navigation

#### 6. Heat Map Overlay (Toggle)
- Geographic heat map showing target density
- Hot zones = areas with many high-probability targets
- Helps identify "hunting grounds" for new routes

#### 7. Day-of-Week Filter
- Filter by customer's preferred ordering day
- "Show me customers who usually order on Wednesdays"

### P2: Nice to Have

#### 8. Revenue Overlay
- Marker size = customer value (small/medium/large)
- Or: Show €€€ indicators on hover

#### 9. Competitor Mapping
- Mark where competitors are strong (if data available)
- Identify "cold zones" to develop

#### 10. Historical Route Replay
- "Show me last Tuesday's route" for comparison
- Learn from past successful routes

## Success Metrics
- **Time to first call reduced by 50%** (from opening page to making a call)
- **Calls per day increased by 20%** (better route efficiency)
- **Order conversion rate up 15%** (calling right people at right time)

---

# PERSPECTIVE B: Software Engineer

> *"How do we build this in a maintainable, performant way using our existing stack?"*

## Technical Assessment

### Current Architecture (Strengths)
- ✅ Leaflet + react-leaflet already working
- ✅ Smart targeting algorithm already calculates probability_score (0-100)
- ✅ Route fit score exists (0-20+)
- ✅ Database materialized views for performance
- ✅ Eircode-based geocoding with lat/lng

### Technical Challenges
1. **Clustering**: Leaflet doesn't natively cluster markers
2. **Route lines**: Need to calculate and render polylines
3. **Route optimization**: TSP/VRP is computationally expensive
4. **Heat maps**: Leaflet.heat plugin needed
5. **Performance**: 100+ markers can slow map

## Implementation Plan

### P0: Core Redesign (Week 1)

#### Task 1: Probability-Based Marker Colors
**Files**: `src/components/sales/targeting/TargetMap.tsx`, `MapContainer.tsx`

```typescript
// Replace reason-based colors with probability-based
const getProbabilityColor = (score: number): string => {
  if (score >= 70) return '#16a34a'; // green-600 - hot
  if (score >= 40) return '#eab308'; // yellow-500 - warm
  return '#f97316';                   // orange-500 - cool
};

// Marker size based on value quartile
const getMarkerRadius = (quartile: number | null): number => {
  if (quartile === 4) return 12; // Platinum
  if (quartile === 3) return 10; // Gold
  if (quartile === 2) return 8;  // Silver
  return 6;                       // Bronze/unknown
};
```

**Effort**: Low (2-3 hours)
**Risk**: Low

#### Task 2: Route Line for Scheduled Deliveries
**Files**: `MapContainer.tsx`
**Approach**: Use `react-leaflet` Polyline component

```typescript
import { Polyline } from 'react-leaflet';

// Sort deliveries by suggested route order (if available) or geographically
const routeCoordinates = sortedDeliveries
  .filter(d => d.lat && d.lng)
  .map(d => [d.lat!, d.lng!] as [number, number]);

<Polyline
  positions={routeCoordinates}
  color="#6366f1"  // indigo-500
  weight={4}
  opacity={0.8}
  dashArray="10, 5"  // dashed line
/>
```

**Effort**: Low (1-2 hours)
**Risk**: Low

#### Task 3: Enhanced Target Sidebar
**Files**: `TargetMap.tsx`
**Approach**: Expand existing sidebar with more actions

Current sidebar is good, enhance with:
- Larger probability score display
- "Add to Route" button (stores in local state)
- Better visual hierarchy

**Effort**: Medium (3-4 hours)
**Risk**: Low

#### Task 4: Updated Legend
**Files**: `TargetMap.tsx`

Replace reason-based legend with:
```
Legend:
🔴 Scheduled Delivery
🟢 High Probability (70%+)
🟡 Medium Probability (40-69%)
🟠 Low Probability (<40%)
━━ Today's Route
```

**Effort**: Low (1 hour)
**Risk**: Low

### P1: Clustering & Route Optimization (Week 2)

#### Task 5: Marker Clustering
**Dependencies**: `react-leaflet-cluster` or `leaflet.markercluster`

```bash
npm install react-leaflet-cluster
```

```typescript
import MarkerClusterGroup from 'react-leaflet-cluster';

// Custom cluster icon showing average probability
const createClusterCustomIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers();
  const avgProbability = markers.reduce((sum, m) =>
    sum + m.options.probability, 0) / markers.length;
  const color = getProbabilityColor(avgProbability);

  return L.divIcon({
    html: `<div style="background:${color}" class="cluster-icon">${markers.length}</div>`,
    className: 'custom-cluster',
  });
};
```

**Effort**: Medium (4-5 hours)
**Risk**: Medium (need to test performance)

#### Task 6: Basic Route Optimization
**Approach**: Client-side nearest-neighbor algorithm (good enough for <20 stops)

```typescript
// Nearest neighbor TSP approximation
function optimizeRoute(stops: {lat: number, lng: number}[]): typeof stops {
  if (stops.length <= 2) return stops;

  const result = [stops[0]];
  const remaining = [...stops.slice(1)];

  while (remaining.length > 0) {
    const current = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((stop, idx) => {
      const dist = haversineDistance(current, stop);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    result.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return result;
}
```

For better optimization (>20 stops), consider:
- OSRM (Open Source Routing Machine) API
- Google Directions API
- GraphHopper

**Effort**: Medium-High (6-8 hours for basic, more for API integration)
**Risk**: Medium

#### Task 7: "Add to Route" Functionality
**State Management**: Local state with context or URL params

```typescript
// In TargetsClient or a new context
const [selectedRoute, setSelectedRoute] = useState<SmartTarget[]>([]);

const addToRoute = (target: SmartTarget) => {
  setSelectedRoute(prev => [...prev, target]);
};

const removeFromRoute = (customerId: string) => {
  setSelectedRoute(prev => prev.filter(t => t.customer_id !== customerId));
};

const optimizeCurrentRoute = () => {
  setSelectedRoute(optimizeRoute(selectedRoute));
};
```

**Effort**: Medium (4-5 hours)
**Risk**: Low

### P2: Heat Map & Advanced Features (Week 3+)

#### Task 8: Heat Map Layer
**Dependencies**: `leaflet.heat`

```bash
npm install leaflet.heat
npm install @types/leaflet.heat
```

```typescript
import 'leaflet.heat';

// Create heat layer from target data
const heatData = targets.map(t => [
  t.lat,
  t.lng,
  t.probability_score / 100  // intensity 0-1
]);

L.heatLayer(heatData, {
  radius: 25,
  blur: 15,
  maxZoom: 12,
  gradient: { 0.4: 'orange', 0.65: 'yellow', 1: 'green' }
}).addTo(map);
```

**Effort**: Medium (4-5 hours)
**Risk**: Low

#### Task 9: Layer Toggle Controls
**Files**: New component `MapLayerControls.tsx`

```typescript
interface MapLayers {
  showScheduledDeliveries: boolean;
  showTargets: boolean;
  showRouteLine: boolean;
  showHeatMap: boolean;
}

// Toggle UI in map corner
<div className="absolute top-4 left-4 bg-white rounded-lg shadow p-2 z-[1000]">
  <Checkbox checked={layers.showHeatMap} onChange={...} />
  <label>Heat Map</label>
  // etc.
</div>
```

**Effort**: Low-Medium (2-3 hours)
**Risk**: Low

## Database Considerations

### No Schema Changes Required
The existing `v_smart_sales_targets` view already provides:
- `probability_score` (0-100) - for color coding
- `route_fit_score` (0-20+) - for route matching
- `value_quartile` (1-4) - for marker sizing
- `lat`, `lng` - for mapping

### Potential Future Enhancement
If route optimization becomes important:

```sql
-- Store optimized routes
CREATE TABLE sales_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  route_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  stops JSONB NOT NULL, -- Array of {customer_id, order}
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Performance Considerations

1. **Marker Count**: Cluster when >50 visible markers
2. **Bounds Filtering**: Only load markers in current viewport
3. **Debounce**: Debounce filter changes to avoid re-renders
4. **Memoization**: useMemo for filtered targets
5. **Virtual Scrolling**: For list view with many targets

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Leaflet SSR issues | Already handled with dynamic import |
| Clustering performance | Test with 500+ markers, add limits if needed |
| Route optimization accuracy | Start with nearest-neighbor, upgrade to API if needed |
| Mobile touch issues | Test clustering touch interactions |

---

## Synthesis: Recommended Implementation Order

Based on both perspectives, here's the recommended build order:

### Phase 1: Quick Wins (1-2 days)
1. ✅ Change marker colors from reason-based to probability-based
2. ✅ Add route polyline connecting scheduled deliveries
3. ✅ Update legend to reflect new color scheme
4. ✅ Enhance sidebar with bigger probability display

### Phase 2: Core Value (3-5 days)
5. 🔧 Add marker clustering with average probability colors
6. 🔧 Implement "Add to Route" functionality
7. 🔧 Basic route optimization (nearest-neighbor algorithm)
8. 🔧 Export route to Google Maps

### Phase 3: Polish (1 week)
9. 📈 Heat map overlay with toggle
10. 📈 Layer toggle controls
11. 📈 Marker size based on customer value
12. 📈 Day-of-week filter

### Phase 4: Future (Backlog)
13. 🔮 Advanced route optimization (OSRM/Google API)
14. 🔮 Historical route replay
15. 🔮 Competitor mapping
16. 🔮 Mobile app integration

---

## Decision Points for User

1. **Color Scheme**: Traffic light (green/yellow/orange) or heat map (red/yellow/green)?
   - Sales Director prefers: Traffic light (intuitive for "go/caution/stop")
   - Note: Heat maps traditionally use red=hot, but that can confuse salespeople

2. **Route Optimization**: Client-side algorithm or external API?
   - <20 stops: Client-side nearest-neighbor is fine
   - 20+ stops: Need Google Directions API or OSRM

3. **Map as Primary View**: Should map be the default view instead of list?
   - Sales Director: Yes, map should be primary
   - Current: List is default

4. **Mobile Considerations**: Is this used on phones/tablets in the field?
   - If yes: Need to prioritize touch interactions and mobile-friendly sidebar

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/sales/targeting/TargetMap.tsx` | Probability colors, enhanced sidebar, legend |
| `src/components/sales/targeting/MapContainer.tsx` | Route polyline, clustering, marker sizing |
| `src/components/sales/targeting/TargetsClient.tsx` | Add-to-route state, default to map view |
| `src/lib/utils/routeOptimization.ts` | NEW: Route optimization algorithms |
| `src/components/sales/targeting/MapLayerControls.tsx` | NEW: Layer toggles |
| `package.json` | Add react-leaflet-cluster, leaflet.heat |

---

## Summary

| Aspect | Sales Director View | Software Engineer View |
|--------|---------------------|------------------------|
| **Priority** | Probability colors, route lines, quick actions | Same, plus clustering for performance |
| **Success Metric** | More calls, more orders | Fast load times, maintainable code |
| **Risk Concern** | "Will my team actually use this?" | "Will it perform with 200+ markers?" |
| **Timeline** | "Can we have Phase 1 by Friday?" | "Phase 1 is 1-2 days of focused work" |

Both perspectives agree: **Start with probability-based colors and route lines**. These are quick wins that immediately transform the map's usefulness.
