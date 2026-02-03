# PLAN: Batch Actions - Two-Flow Approach

## Separating Regulated Applications from Operational Actions

**Feature**: Streamlined batch actions with appropriate complexity per action type
**Status**: In Progress (Session 1 Complete)
**Created**: 2026-02-03
**Updated**: 2026-02-03 (v3 - Two-flow approach)
**Mode**: standard

---

## Problem Statement

Currently, users have **multiple scattered entry points** for batch actions:

| Entry Point | Actions Available |
|-------------|-------------------|
| "Log Event" button (Health tab) | Treatment, Fertilizer, Irrigation, Pruning, Grading, Measurement |
| "Log Action" dropdown | Move Batch, Log Dump |
| Scout tab | Issues, Readings |
| Apply Treatment (various) | Full compliance flow |

**Issues:**
1. Confusing - "Where do I log X?"
2. Chemical treatments mixed with simple actions
3. Compliance-heavy forms used for simple operations
4. "Measurement" in wrong place (it's an observation)

---

## Solution: Two Distinct Flows

### Mental Model

| Flow | Purpose | Complexity | Actions |
|------|---------|------------|---------|
| **Apply Treatment** | Regulated product applications | High - compliance, stock tracking | Chemical, Fertilizer |
| **Log Action** | Operational batch actions | Low - simple forms | Irrigation, Pruning, Grading, Mechanical, Move, Dump |
| **Scout Mode** | Observations | Medium | Issues, Readings, Measurements |
| **Check-In** | Receiving | Separate | Batch arrival |

### Why This Split?

**Regulated Applications** require:
- IPM product database selection
- PCS numbers (regulatory registration)
- REI hours (re-entry interval safety)
- Harvest intervals (withholding periods)
- Weather conditions at application
- Applicator signature
- Stock/bottle tracking
- Full audit trail

**Operational Actions** are simpler:
- "I did X to the batch"
- Notes, maybe photos
- No compliance burden

---

## Flow 1: Apply Treatment (Regulated)

**Entry Point**: "Apply Treatment" button (existing flow, keep as-is)

### What It Covers

| Action | Key Fields |
|--------|------------|
| **Chemical Treatment** | IPM product, rate, method, PCS, REI, weather, area, sprayer, signature, bottle tracking |
| **Fertilizer** | Product, rate, method, compliance fields as needed |

### Current Implementation

Already exists in multiple forms:
- `TreatmentDialog.tsx` - Location-based quick treatment
- `ApplyTreatmentDialog.tsx` - Full IPM integration
- `TreatmentComplianceForm.tsx` - Worker execution form
- `TreatmentStep.tsx` - Scout wizard integration

**Action Required**: Keep existing flows, minor cleanup only

---

## Flow 2: Log Action Wizard (Operational)

**Entry Point**: Single "Log Action" button → Step-based wizard

### What It Covers

```
┌─────────────────────────────────────────────────────────────┐
│                    What are you logging?                     │
├─────────────────────────────┬───────────────────────────────┤
│         CARE                │         OPERATIONS            │
│                             │                               │
│  💧 Irrigation              │  📍 Move Batch                │
│  ✂️ Pruning                 │  🗑️ Log Dump/Loss             │
│  ⭐ Grading                 │                               │
│  🔧 Mechanical              │                               │
│     (trim, space, weed)     │                               │
└─────────────────────────────┴───────────────────────────────┘
```

### Action Details

| Action | Form Fields |
|--------|-------------|
| **Irrigation** | Duration (optional), method (drip/overhead/hand), notes |
| **Pruning** | Type (tip/shape/deadhead), notes, photos |
| **Grading** | Quality grade, notes |
| **Mechanical** | Action type (trim/space/weed/remove), notes |
| **Move Batch** | Destination, partial move option, spacing toggle, notes |
| **Log Dump** | Reason (disease/drought/dead/poor quality/old stock), quantity, notes |

---

## Flow 3: Scout Mode (Observations)

**Entry Point**: Scout tab / Scout Mode (existing)

### What It Covers

| Observation | Purpose |
|-------------|---------|
| **Issues** | Pest, disease, environmental problems |
| **Readings** | EC, pH measurements |
| **Measurements** | Growth, height (if needed) |

**Action Required**:
- Remove "Measurement" from Health Event form (it belongs here)
- Ensure readings are prominent in Scout UI

---

## Flow 4: Check-In (Receiving)

**Entry Point**: Production Planning / Incoming Batches (existing, separate)

**Purpose**: Sign batch into nursery on arrival

**Action Required**: None - keep separate

---

## Implementation Plan

### Phase 1: Create Log Action Wizard
**Priority**: P0
**Effort**: ~2 sessions
**Agent**: `feature-builder`

#### 1.1 Create Wizard Types
**File**: `src/types/batch-actions.ts` (NEW)

```typescript
export type OperationalActionCategory = 'care' | 'operation';

// Simple care actions (no compliance burden)
export type CareActionType = 'irrigation' | 'pruning' | 'grading' | 'mechanical';

// Batch operation actions
export type OperationActionType = 'move' | 'dump';

// All operational actions (excludes regulated: chemical, fertilizer)
export type OperationalActionType = CareActionType | OperationActionType;

// Mechanical sub-types
export type MechanicalActionType = 'trimming' | 'spacing' | 'weeding' | 'removing';

export const ACTION_META: Record<OperationalActionType, {
  label: string;
  icon: string;
  category: OperationalActionCategory;
  description: string;
}> = {
  irrigation: { label: 'Irrigation', icon: 'Droplets', category: 'care', description: 'Water or adjust irrigation' },
  pruning: { label: 'Pruning', icon: 'Scissors', category: 'care', description: 'Prune or trim plants' },
  grading: { label: 'Grading', icon: 'Star', category: 'care', description: 'Grade batch quality' },
  mechanical: { label: 'Mechanical', icon: 'Wrench', category: 'care', description: 'Trimming, spacing, weeding' },
  move: { label: 'Move Batch', icon: 'MapPin', category: 'operation', description: 'Move to different location' },
  dump: { label: 'Log Dump/Loss', icon: 'Trash2', category: 'operation', description: 'Record waste or loss' },
};
```

#### 1.2 Create Wizard Component
**File**: `src/components/batches/LogActionWizard/index.tsx` (NEW)

**Structure**:
```
LogActionWizard/
├── index.tsx                # Main wizard with step management
├── ActionTypeStep.tsx       # Step 1: Select action type
├── forms/
│   ├── IrrigationForm.tsx   # Simple: method, duration, notes
│   ├── PruningForm.tsx      # Simple: type, notes, photos
│   ├── GradingForm.tsx      # Simple: grade, notes
│   ├── MechanicalForm.tsx   # Simple: action type, notes
│   ├── MoveForm.tsx         # Existing logic from ActionForm
│   └── DumpForm.tsx         # Existing logic from ActionForm
└── ActionConfirmation.tsx   # Success state
```

**Acceptance Criteria**:
- Wizard opens from single "Log Action" button
- 6 action types available (irrigation, pruning, grading, mechanical, move, dump)
- Simple forms - no compliance overhead
- Mobile-friendly

#### 1.3 Create Unified Server Action
**File**: `src/app/actions/log-batch-action.ts` (NEW)

```typescript
export async function logBatchAction(input: LogBatchActionInput) {
  // Validate input based on action type
  // Create appropriate database record
  // For move/dump, use existing logic
  // For care actions, create plant_health_logs entry
}
```

---

### Phase 2: Integrate Wizard into UI
**Priority**: P1
**Effort**: ~1 session
**Agent**: `feature-builder`

#### 2.1 Update Batch Detail Dialog
**File**: `src/components/batch-detail-dialog.tsx`

**Changes**:
- Keep "Apply Treatment" button (regulated flow)
- Replace "Log Action" dropdown with "Log Action" button → wizard
- Remove Treatment/Fertilizer from Health tab's "Log Event"

**New Actions Panel**:
```
Actions
├── Edit Batch
├── Transplant
├── Apply Treatment  ← Regulated flow (existing)
├── Log Action       ← Opens wizard (new)
├── Chat about Batch
└── View Full Page
```

#### 2.2 Update Tab Labels
**File**: `src/components/batch-detail-dialog.tsx`

| Current | New | Content |
|---------|-----|---------|
| Health | Care | Irrigation, Pruning, Grading, Mechanical history |
| Scout | Observations | Issues, Readings |

**Note**: Treatment and Fertilizer logs still show in Care tab (they're care actions), but they're LOGGED via the separate regulated flow.

#### 2.3 Clean Up Health Event Form
**File**: `src/components/plant-health/AddHealthLogDialog.tsx`

**Remove from this form**:
- Treatment (use Apply Treatment flow)
- Fertilizer (use Apply Treatment flow)
- Measurement (use Scout mode)

**What remains** (or deprecate entirely):
- Consider deprecating this form if wizard replaces it

---

### Phase 3: Scout & Observations
**Priority**: P1
**Effort**: ~0.5 session
**Agent**: `feature-builder`

#### 3.1 Ensure Scout Has Readings Prominent
**File**: `src/components/plant-health/scout/ScoutLogStep.tsx`

Verify Scout mode clearly supports:
- Issues (pest, disease, environmental)
- Readings (EC, pH)
- Measurements

#### 3.2 Update Navigation
**File**: `src/config/nav.ts`

```typescript
{
  label: "Scout Mode",
  href: "/plant-health/scout",
  description: "Log observations: issues and readings (EC/pH)."
}
```

---

### Phase 4: Verification & Cleanup
**Priority**: P2
**Effort**: ~0.5 session
**Agent**: `verifier`, `tester-tim`

#### 4.1 Test User Flows

**Regulated Flow**:
- [ ] Apply chemical treatment with full compliance fields
- [ ] Apply fertilizer
- [ ] Verify stock tracking works
- [ ] Verify REI is applied to location

**Operational Wizard**:
- [ ] Log irrigation via wizard
- [ ] Log pruning via wizard
- [ ] Log grading via wizard
- [ ] Log mechanical action via wizard
- [ ] Move batch via wizard
- [ ] Log dump via wizard

**Scout Mode**:
- [ ] Log issue
- [ ] Log EC/pH reading

**Check-In**:
- [ ] Check in new batch (unchanged)

#### 4.2 Mobile Testing
- [ ] Wizard works on mobile
- [ ] Apply Treatment works on mobile

#### 4.3 Cleanup
- [ ] Remove deprecated code paths
- [ ] Update all imports

---

## Implementation Order

```
Session 1: COMPLETE (2026-02-03)
  [x] 1.1 Create action types
  [x] 1.2 Create LogActionWizard shell
  [x] 1.2 Create ActionTypeStep (selection grid)
  [x] 1.2 Create IrrigationForm, PruningForm, GradingForm, MechanicalForm
  [x] Verify: Build passes

Session 2:
  [ ] 1.2 Extract MoveForm and DumpForm from existing ActionForm
  [ ] 1.3 Create unified server action
  [ ] 2.1 Integrate wizard into batch detail dialog
  [ ] Verify: Can complete all 6 actions via wizard

Session 3:
  [ ] 2.2 Update tab labels
  [ ] 2.3 Clean up Health Event form (remove treatment/fertilizer/measurement)
  [ ] 3.1 Verify Scout has readings
  [ ] 3.2 Update nav descriptions
  [ ] Verify: Clean separation between flows

Session 4:
  [ ] 4.1 Full test pass - all flows
  [ ] 4.2 Mobile testing
  [ ] 4.3 Cleanup deprecated code
  [ ] Verify: Complete user journeys
```

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/types/batch-actions.ts` | Operational action types |
| `src/components/batches/LogActionWizard/index.tsx` | Main wizard |
| `src/components/batches/LogActionWizard/ActionTypeStep.tsx` | Action selection |
| `src/components/batches/LogActionWizard/forms/*.tsx` | Individual forms |
| `src/app/actions/log-batch-action.ts` | Unified server action |

### Modified Files

| File | Change |
|------|--------|
| `src/components/batch-detail-dialog.tsx` | Add wizard trigger, update tabs |
| `src/components/plant-health/AddHealthLogDialog.tsx` | Remove treatment/fertilizer/measurement |
| `src/config/nav.ts` | Update descriptions |

### Unchanged (Keep As-Is)

| File | Reason |
|------|--------|
| `src/components/plant-health/TreatmentDialog.tsx` | Regulated flow |
| `src/components/plant-health/ApplyTreatmentDialog.tsx` | Regulated flow |
| `src/components/plant-health/TreatmentComplianceForm.tsx` | Regulated flow |
| `src/components/batches/CheckInForm.tsx` | Separate receiving flow |
| `src/components/plant-health/scout/*` | Scout mode stays separate |

---

## Definition of Done

### Regulated Flow (Apply Treatment)
- [ ] Chemical treatment works with full compliance
- [ ] Fertilizer works with compliance as needed
- [ ] Stock tracking functional
- [ ] REI safety locks applied

### Operational Wizard (Log Action)
- [ ] Single "Log Action" button opens wizard
- [ ] 6 actions available: Irrigation, Pruning, Grading, Mechanical, Move, Dump
- [ ] Simple forms - no compliance burden
- [ ] Mobile-friendly
- [ ] All actions save correctly

### Scout Mode (Observations)
- [ ] Issues can be logged
- [ ] Readings (EC/pH) can be logged
- [ ] Measurement NOT in operational wizard

### General
- [ ] Tab renamed: "Health" → "Care"
- [ ] Treatment/Fertilizer removed from Health Event form
- [ ] Clear user journey for each action type
- [ ] All existing tests pass

---

## User Story Validation

After implementation, users should confidently answer:

| Question | Answer |
|----------|--------|
| "I sprayed for aphids" | **Apply Treatment** → Chemical (full compliance) |
| "I applied fertilizer" | **Apply Treatment** → Fertilizer |
| "I watered the batch" | **Log Action** → Irrigation |
| "I pruned the plants" | **Log Action** → Pruning |
| "I graded the batch" | **Log Action** → Grading |
| "I spaced the plants" | **Log Action** → Mechanical |
| "I moved batch to Tunnel 3" | **Log Action** → Move Batch |
| "Some plants died" | **Log Action** → Log Dump |
| "I measured EC today" | **Scout Mode** → Reading |
| "I found aphids" | **Scout Mode** → Issue |
| "New batch arriving" | **Check-In** (separate) |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking regulated flow | Keep existing treatment forms unchanged |
| User confusion about which flow | Clear button labels, consistent UI |
| Missing compliance data | Regulated items stay in regulated flow |
| Scope creep | Stick to 6 operational actions |

---

## Estimated Total Effort

**~4 sessions** (thorough implementation with testing)

---

*This plan separates regulated product applications (chemical, fertilizer) from simple operational actions, ensuring compliance requirements aren't diluted while making everyday batch operations quick and easy.*
