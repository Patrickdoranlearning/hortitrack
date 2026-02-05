# Plan: Scout Quality Section with Photo Uploads

**Created**: 2026-02-04
**Status**: Complete
**Completed**: 2026-02-05
**Complexity**: Medium
**Estimated Sessions**: 1

## Overview

Add a "Quality" section to the Scout wizard allowing users to:
1. Upload photos with "Sales Photo" or "Growing Photo" badges
2. Review/assess the quality of batches during scouting

## Current State Analysis

### ScoutWizard Structure
- **Location**: `src/components/plant-health/scout/ScoutWizard.tsx`
- **Current Steps**: Scan -> Log -> Treatment (conditional)
- **Flow**: User scans location/batch -> logs issue OR reading -> schedules treatment if needed

### Existing Photo System
- Single optional photo in `ScoutLogStep` (uploaded to `plant-health` bucket as scout photo)
- No badge type classification for scout photos
- Photo goes into `scouts/{targetId}/{timestamp}.{ext}` path

### Media System (for proper integration)
- **Upload Endpoint**: `/api/media/upload`
- **Tables**: `media_library` + `media_attachments` (polymorphic)
- **Entity Types**: batch, variety, product
- **Current Badge Types**: `live_crop`, `reference`, `size_guide`
- **Badge type column**: `text` (unconstrained - allows new types)

### Reference Implementation
- `QuickSaleableForm.tsx` shows pattern for uploading to media system with badge type
- Uses FormData with `entityType`, `entityId`, `badgeType` fields

## Design Decision: Quality Step vs Quality Section

**Option A: Add Quality as a NEW STEP (4th step)**
- Pros: Clean separation, dedicated UI
- Cons: Longer wizard flow, may feel redundant

**Option B: Add Quality SECTION to Log Step**
- Pros: Faster flow, natural place to assess quality while logging
- Cons: Log step becomes larger

**Recommendation**: Option B - Add to Log Step
- Quality assessment naturally happens during observation
- Keeps wizard efficient (3 steps)
- Photos can be added to either Issue or Reading tabs

## Implementation Plan

### Phase 1: Add New Badge Types
**Files**: Migration + Types

#### Task 1.1: Document Badge Types (No Migration Needed)
The `badge_type` column in `media_attachments` is `text` with no constraint, so we can use any string value. New badge types:
- `sales` - Sales-quality photos for B2B catalog
- `growing` - Growing/grower photos for internal tracking

No database migration required - just use the new values in code.

#### Task 1.2: Update Type Definitions
**File**: `src/components/media/SmartGalleryUploader.tsx`

Update the `badgeType` prop type to include new values:
```typescript
badgeType?: 'live_crop' | 'reference' | 'size_guide' | 'sales' | 'growing';
```

Update `getBadgeLabel()` to handle new types:
```typescript
case 'sales':
  return 'Sales Photo';
case 'growing':
  return 'Grower Photo';
```

### Phase 2: Create QualityPhotoSection Component
**File**: `src/components/plant-health/scout/QualityPhotoSection.tsx`

New component for the quality photo upload UI:

```typescript
type QualityPhotoSectionProps = {
  batchIds: string[];
  onPhotosChange: (photos: QualityPhoto[]) => void;
  photos: QualityPhoto[];
};

type QualityPhoto = {
  file: File;
  preview: string;
  batchId: string;
  badgeType: 'sales' | 'growing';
};
```

**Features**:
- Photo upload with Camera/Gallery buttons (reuse pattern from ScoutLogStep)
- Badge type toggle: "Sales Photo" vs "Growing Photo"
- If multiple batches selected, option to choose which batch the photo is for
- Preview with badge indicator
- Multiple photos support (up to 5)
- Remove photo functionality

**UI Design**:
```
+------------------------------------------+
| Quality Photos (Optional)                 |
|                                          |
| [Preview Grid of uploaded photos]         |
| Each shows: thumbnail + badge + X button |
|                                          |
| +---------------+ +----------------+      |
| | [Camera]      | | [Gallery]      |      |
| | Take Photo    | | Choose Photo   |      |
| +---------------+ +----------------+      |
|                                          |
| Photo Type:                              |
| [x] Sales Photo  [ ] Growing Photo       |
|                                          |
| For Batch: [Dropdown if multiple batches]|
+------------------------------------------+
```

### Phase 3: Integrate into ScoutLogStep
**File**: `src/components/plant-health/scout/ScoutLogStep.tsx`

#### Task 3.1: Update LogData Type
Add quality photos to the data structure:

```typescript
export type LogData = {
  // existing fields...
  qualityPhotos?: QualityPhoto[];
};
```

#### Task 3.2: Add QualityPhotoSection to Both Tabs
Add the quality section below the existing photo capture in both Issue and Reading tabs:

```tsx
{/* Existing Photo Capture (for issue documentation) */}
<div className="space-y-2">
  <div className="flex items-center gap-2 text-sm font-medium">
    <Camera className="h-4 w-4" />
    Photo (Optional)
  </div>
  {/* existing photo UI */}
</div>

{/* NEW: Quality Photos Section */}
<QualityPhotoSection
  batchIds={selectedBatchIds}
  photos={qualityPhotos}
  onPhotosChange={setQualityPhotos}
/>
```

#### Task 3.3: Include Quality Photos in Submission
Pass quality photos through to the parent handler.

### Phase 4: Handle Photo Uploads in ScoutWizard
**File**: `src/components/plant-health/scout/ScoutWizard.tsx`

#### Task 4.1: Upload Quality Photos to Media System
In `handleLogComplete`, after saving the scout log, upload quality photos:

```typescript
// Upload quality photos if provided
if (logData.qualityPhotos?.length) {
  for (const photo of logData.qualityPhotos) {
    const fd = new FormData();
    fd.append('file', photo.file);
    fd.append('entityType', 'batch');
    fd.append('entityId', photo.batchId);
    fd.append('badgeType', photo.badgeType); // 'sales' or 'growing'

    await fetch('/api/media/upload', {
      method: 'POST',
      body: fd,
    });
  }
}
```

### Phase 5: Visual Polish & UX
**Files**: Various UI components

#### Task 5.1: Add Visual Distinction for Photo Types
- Sales photos: Green tint/border
- Growing photos: Blue tint/border

#### Task 5.2: Add Success Feedback
Show toast with photo count after upload.

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/media/SmartGalleryUploader.tsx` | Modify | Add new badge types to prop types and getBadgeLabel() |
| `src/components/plant-health/scout/QualityPhotoSection.tsx` | **NEW** | Quality photo upload component |
| `src/components/plant-health/scout/ScoutLogStep.tsx` | Modify | Add LogData types, integrate QualityPhotoSection |
| `src/components/plant-health/scout/ScoutWizard.tsx` | Modify | Handle quality photo uploads to media system |

## Acceptance Criteria

- [ ] User can upload multiple quality photos during scouting
- [ ] Each photo can be tagged as "Sales Photo" or "Growing Photo"
- [ ] Photos are uploaded to media system with correct badge_type
- [ ] Photos appear in batch gallery after upload
- [ ] If multiple batches selected, user can assign photo to specific batch
- [ ] Preview shows badge type clearly
- [ ] Photos can be removed before submission

## Testing Checklist

1. **Basic Flow**
   - [ ] Scout a location with batches
   - [ ] Add a quality photo, mark as "Sales Photo"
   - [ ] Complete scout
   - [ ] Verify photo appears in batch gallery with "Sales Photo" badge

2. **Multiple Photos**
   - [ ] Add 3+ photos with mixed badge types
   - [ ] Remove one photo
   - [ ] Complete scout
   - [ ] Verify correct photos saved with correct badges

3. **Multiple Batches**
   - [ ] Scout location with 3+ batches
   - [ ] Add photos assigned to different batches
   - [ ] Verify each photo goes to correct batch's gallery

4. **Edge Cases**
   - [ ] Scout with no photos (should still work)
   - [ ] Scout single batch (no batch selector needed)
   - [ ] Large file handling

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large photos slow upload | Medium | Compress on client before upload |
| Multiple batch UX confusion | Low | Clear batch selector UI |
| Conflict with existing scout photos | Low | Existing photo is for issue documentation, new section is for quality |

## Handoff Notes

**Agent Assignments**:
- Phase 1: `feature-builder` (type updates)
- Phase 2-4: `feature-builder` (main implementation)
- Phase 5: `feature-builder` (polish)

**Recommended Mode**: `standard`

**Pre-flight Checks**:
- [x] No database migration needed (badge_type is unconstrained text)
- [x] Media system already supports new badge types
- [x] Patterns exist in QuickSaleableForm and BatchGallerySection

**Post-Implementation**:
- Run `verifier` after each phase
- Run `tester-tim` against acceptance criteria
- Run `karen` for scope check

---

## Quick Start

To execute this plan:
```
jimmy execute PLAN-scout-quality-section.md
```

Or implement manually:
1. Update SmartGalleryUploader types
2. Create QualityPhotoSection component
3. Integrate into ScoutLogStep
4. Handle uploads in ScoutWizard
5. Test full flow
