# PLAN: Plant Health Logging Consolidation
## Perspective A: Nursery Plant Manager

**Feature**: Streamline plant health logging into a single coherent route
**Perspective**: Nursery Plant Manager (workflow, daily usability, operational clarity)
**Status**: Draft
**Created**: 2026-02-03

---

## The Problem (From a Plant Manager's View)

Right now, when I walk through the nursery with my tablet, I have TWO different places to log plant health information:

1. **"Health" Tab** (via "Log Event" button)
   - Treatment (IPM sprays, pest control)
   - Fertilizer (feeding)
   - Irrigation (watering records)
   - Pruning (trimming)
   - Grading (quality assessment)
   - Measurement (EC/pH readings) <-- **This feels wrong here**

2. **"Scout" Mode** (separate page/wizard)
   - Issue logging (flagging problems, severity)
   - Readings (EC/pH, soil moisture) <-- **This is where measurements belong**
   - Can trigger treatments

### Why This Is Confusing

As a plant manager, my mental model is simple:

**Things I DO to the crop** (Actions):
- Spray it (treatment)
- Feed it (fertilizer)
- Water it (irrigation)
- Trim it (pruning)
- Grade it (quality check)

**Things I OBSERVE about the crop** (Observations):
- EC/pH readings
- Pest/disease presence
- Growth measurements
- Quality issues

Currently, "Measurement" (an observation) is lumped with treatments (actions). This breaks my workflow because:
- When I'm doing my morning scout walk, I want ONE place to log all observations
- When I'm applying treatments after scouting, I want ONE place for all actions
- Having to choose between "Health > Measurement" vs "Scout > Reading" for EC/pH is confusing

---

## Proposed Solution: Two-Tab Model

### Tab 1: "Care Actions" (Things We DO)
Replaces current "Health" tab. Contains:
- Treatment (IPM/pest control)
- Fertilizer
- Irrigation
- Pruning
- Grading

**Entry Point**: "Log Action" button opens action type selector

### Tab 2: "Scout Observations" (Things We SEE)
Consolidates current Scout functionality. Contains:
- Issue/Problem logging (pest, disease, damage)
- Readings (EC, pH, moisture, temperature)
- Growth measurements (height, spread)
- Quality observations
- Photos with notes

**Entry Point**: "New Observation" button or scan QR to start

---

## Mental Model Diagram

```
                    PLANT HEALTH
                         |
          +--------------+--------------+
          |                             |
     CARE ACTIONS              SCOUT OBSERVATIONS
    (What we DO)               (What we SEE)
          |                             |
    +-----+-----+               +-------+-------+
    |     |     |               |       |       |
  Treat  Feed  Prune         Issues  Readings  Photos
  (IPM) (Fert) (Trim)       (Flags) (EC/pH)   (Notes)
          |                             |
       Irrigation                  Growth Metrics
       Grading                     Quality Notes
```

---

## User Workflows (Day in the Life)

### Morning Scout Walk
1. Grab tablet, go to Plant Health > Scout Observations
2. Walk through tunnels, scan location QR codes
3. For each location:
   - Log any issues spotted (aphids, yellowing, etc.)
   - Take readings if needed (EC/pH at mixing station)
   - Take photos of anything noteworthy
4. System flags locations needing action

### Treatment Day (After Scout)
1. Review flagged locations from scout
2. Go to Plant Health > Care Actions
3. Select location or batch
4. Log treatment with:
   - Product used
   - Rate applied
   - Method
   - Weather conditions
5. System calculates re-entry interval, harvest date

### Weekly Feeding
1. Go to Plant Health > Care Actions
2. Filter by location or batch
3. Log fertilizer application:
   - Product & composition
   - Rate
   - Method
4. Done - visible in batch history

---

## Benefits of This Approach

### For Daily Operations
- **Clear mental model**: "Do I want to LOG what I did, or RECORD what I saw?"
- **Faster data entry**: Less confusion about which form to use
- **Better scout workflow**: All observation types in one wizard

### For Data Quality
- **Consistent categorization**: Measurements always treated as observations
- **Linked actions**: Scout observations can trigger action tasks
- **Complete picture**: View both actions and observations on batch timeline

### For Reporting
- **Treatment compliance**: Clear trail of what was applied when
- **Scout coverage**: Track what was observed and when
- **Action-to-observation ratio**: Are we acting on what we find?

---

## Implementation Phases

### Phase 1: UI Restructure (Low Risk)
**Goal**: Rename and reorganize without changing data model

1. Rename "Health" tab to "Care Actions"
2. Remove "Measurement" from Care Actions form
3. Update nav labels and icons
4. Add "Measurement" type to Scout observations

**Effort**: ~1 session
**Risk**: Low (cosmetic changes)

### Phase 2: Scout Wizard Enhancement
**Goal**: Make Scout wizard the single entry point for observations

1. Add measurement types to scout wizard:
   - EC/pH readings
   - Growth measurements (optional)
   - Moisture readings (optional)
2. Improve flow: Scan -> Select type -> Log -> Done or Schedule Action
3. Allow logging without triggering action (simple recording)

**Effort**: ~1-2 sessions
**Risk**: Medium (form changes, but existing data intact)

### Phase 3: History View Consolidation
**Goal**: Single timeline showing both actions and observations

1. Batch detail timeline shows all entries chronologically
2. Filter by type: Actions | Observations | All
3. Visual distinction between action (green) and observation (orange)
4. Link observations to subsequent actions when applicable

**Effort**: ~1 session
**Risk**: Low (display changes only)

---

## Navigation Changes

### Current Structure
```
Plant Health
  - Dashboard
  - IPM Tasks
  - Scout Mode        <-- Observations only
  - Trials
  - IPM Products
  - IPM Programs
  - Health History    <-- Mixed actions/observations
```

### Proposed Structure
```
Plant Health
  - Dashboard
  - IPM Tasks
  - Scout & Observe   <-- All observations
  - Log Actions       <-- Quick action logging (optional shortcut)
  - Trials
  - IPM Products
  - IPM Programs
  - Health History    <-- Unified timeline
```

Or simpler:
```
Plant Health
  - Dashboard
  - Scout Mode        <-- Observations (renamed internally)
  - IPM Tasks         <-- Scheduled treatments
  - Health History    <-- All logs (filterable)
  - Products & Programs (submenu)
```

---

## Data Entry Points (Where Users Log)

### Option A: Centralized (Recommended)
- **Batch Detail Dialog**: Shows two tabs (Care Actions, Scout Observations)
- **Location Page**: Same two tabs for location-level logging
- **Scout Mode**: Full-screen wizard for walking routes

### Option B: Separate Pages
- `/plant-health/actions` - Log care actions
- `/plant-health/scout` - Log observations
- Both linked from batch/location views

**Recommendation**: Option A gives context (you see the batch info while logging) and reduces navigation.

---

## Form Field Mapping

### Care Actions Form (New)
| Field | Treatment | Fertilizer | Irrigation | Pruning | Grading |
|-------|-----------|------------|------------|---------|---------|
| Product | Yes | Yes (name) | - | - | - |
| Rate/Unit | Yes | Yes | - | - | - |
| Method | Yes | Yes | Yes | - | - |
| Weather | Yes | Optional | - | - | - |
| Area Treated | Yes | Optional | - | - | - |
| Equipment | Yes | Optional | Yes | Yes | - |
| Grade Result | - | - | - | - | Yes |
| Notes | Yes | Yes | Yes | Yes | Yes |

### Scout Observations Form (Enhanced)
| Field | Issue | Reading | Measurement | Photo |
|-------|-------|---------|-------------|-------|
| Issue Type | Yes | - | - | - |
| Severity | Yes | - | - | - |
| EC | - | Yes | - | - |
| pH | - | Yes | - | - |
| Moisture | - | Optional | - | - |
| Height/Spread | - | - | Yes | - |
| Photo | Optional | Optional | Optional | Yes |
| Notes | Yes | Yes | Yes | Yes |

---

## Questions to Resolve

1. **Should "Grading" stay with actions or become an observation?**
   - Argument for action: You're actively assessing/sorting
   - Argument for observation: You're recording what you see
   - **Recommendation**: Keep with actions (it results in a quality classification)

2. **Should scout observations auto-create tasks?**
   - Current: Medium/Critical issues prompt treatment scheduling
   - Proposed: Keep this behavior, make it optional for readings
   - **Recommendation**: Yes for issues, optional for abnormal readings

3. **How to handle legacy "measurement" health logs?**
   - Display them in history as observations
   - No migration needed (just display logic)

---

## Success Metrics

- **User clarity**: "Where do I log X?" questions should decrease
- **Data entry time**: Should not increase (aim for same or faster)
- **Scout completion**: More observations logged per scout session
- **Action-to-observation linking**: Can track what actions resulted from observations

---

## Summary

This plan prioritizes **user mental model clarity** over technical elegance:

1. **Two clear categories**: Actions (what we do) vs Observations (what we see)
2. **Measurement moves to Scout**: EC/pH readings are observations, not actions
3. **Minimal data model changes**: Mostly UI/UX restructuring
4. **Phased rollout**: Start with renames, then enhance scout wizard

The goal is that any nursery worker can answer: "I just measured EC - where do I log it?" with confidence: **Scout Observations**.

---

*Plan created from Nursery Plant Manager perspective - focusing on workflow clarity and daily usability.*
