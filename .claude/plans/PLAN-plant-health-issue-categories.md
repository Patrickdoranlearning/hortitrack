# Plan: Plant Health Issue Categories/Grouping

**Created**: 2026-02-05
**Status**: Complete
**Type**: Feature Enhancement
**Estimated Sessions**: 1

---

## Summary

Add grouping/categorization for plant health issues in the Dropdown Manager. Issues should be organized into categories (Disease, Pest, Cultural, Nutrition) to improve usability when selecting issues during scouting and IPM logging.

---

## Current State Analysis

### Database Schema
- **Table**: `attribute_options`
- **Relevant columns**: `id`, `org_id`, `attribute_key`, `system_code`, `display_label`, `sort_order`, `is_active`, `behavior`, `color`, `category` (already exists!)
- **RLS**: Enabled with `tenant_isolation_attribute_options` policy

### Frontend Configuration
- **Type definition** (`src/lib/attributeOptions.ts`):
  - `plant_health_issue` already has `allowCategory: true`
  - `categoryOptions: ["Pest", "Disease", "Environmental"]` defined
  - Default options already include category assignments (e.g., "Aphids" -> "Pest")

- **Settings page** (`src/app/settings/dropdowns/page.tsx`):
  - Already supports category dropdown for attributes with `allowCategory: true`
  - Category selector rendered at lines 389-412 when `meta.allowCategory && meta.categoryOptions` is true

### Issue Consumers
1. **ScoutLogStep.tsx** (lines 100, 310-314): Uses `useAttributeOptions('plant_health_issue')` - displays flat list
2. **ScoutLogForm.tsx** (lines 83, 231-235): Uses `useAttributeOptions('plant_health_issue')` - displays flat list

### What Already Works
1. Database `category` column exists on `attribute_options`
2. Server-side service (`src/server/attributeOptions/service.ts`) reads and writes `category`
3. API route (`src/app/api/options/[attributeKey]/route.ts`) handles `category` in payload
4. Settings page shows category dropdown for plant_health_issue options
5. Default options have categories pre-assigned

### What Needs Work
The issue selection dropdowns in **scout forms** show a flat list. User wants:
1. Issues grouped by category in the dropdown (Disease, Pest, etc.)
2. Add **Nutrition** and **Cultural** as new categories (currently only Pest, Disease, Environmental)
3. Possibly visual grouping with headers/separators in the select component

---

## Requirements

### Functional Requirements
1. **Categories**: Update from ["Pest", "Disease", "Environmental"] to ["Disease", "Pest", "Cultural", "Nutrition"]
2. **Grouped Display**: Issue dropdowns in scout forms should show issues grouped by category
3. **Category Headers**: Visual separators/headers for each category group
4. **Settings Page**: Already works - no changes needed (verify only)
5. **Default Options**: Update default issues to include Cultural and Nutrition examples

### Non-Functional Requirements
1. No database migration needed (category column exists)
2. Maintain backward compatibility with existing data
3. Issues without a category should still appear (perhaps in "Other" group)

---

## Implementation Plan

### Phase 1: Update Category Options

**Task 1.1**: Update `PLANT_HEALTH_CATEGORIES` in `src/lib/attributeOptions.ts`

From:
```typescript
export const PLANT_HEALTH_CATEGORIES = ["Pest", "Disease", "Environmental"] as const;
```

To:
```typescript
export const PLANT_HEALTH_CATEGORIES = ["Disease", "Pest", "Cultural", "Nutrition"] as const;
```

Also update the `ATTRIBUTE_META.plant_health_issue.categoryOptions` array to match.

**Task 1.2**: Update default options in `DEFAULTS.plant_health_issue`

- Keep existing Pest and Disease issues
- Map existing "Environmental" issues to appropriate new categories
- Add new Cultural issues (e.g., Physical Damage, Sunburn, Frost Damage)
- Add new Nutrition issues (e.g., Nitrogen Deficiency, Iron Chlorosis)
- Reorder by category grouping for cleaner defaults

**Acceptance Criteria**:
- [ ] Four categories: Disease, Pest, Cultural, Nutrition
- [ ] Default issues include examples from all four categories
- [ ] Existing issues preserve their mapping (backwards compatible)

---

### Phase 2: Create Grouped Select Component

**Task 2.1**: Create `GroupedIssueSelect` component

Location: `src/components/plant-health/GroupedIssueSelect.tsx`

Features:
- Groups options by category
- Shows category headers (optgroup-style)
- Handles "Other (custom)" option at bottom
- Works with react-hook-form's `Select` pattern
- Uses existing shadcn/ui Select components

Component interface:
```typescript
type GroupedIssueSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AttributeOption[];
  placeholder?: string;
  showCustomOption?: boolean;
};
```

**Task 2.2**: Style category headers in the select

- Use subtle visual separator (border, background tint)
- Category name in smaller, muted text
- Indent options under category header

**Acceptance Criteria**:
- [ ] Issues grouped visually by category in dropdown
- [ ] Category headers are non-selectable labels
- [ ] Smooth user experience (no jank)
- [ ] "Other (custom)" option remains at bottom

---

### Phase 3: Integrate Grouped Select into Scout Forms

**Task 3.1**: Update `ScoutLogStep.tsx`

Replace current Select with GroupedIssueSelect:
- Lines 296-320 (issue type select)
- Pass `issueOptions` from `useAttributeOptions('plant_health_issue')`

**Task 3.2**: Update `ScoutLogForm.tsx`

Replace current Select with GroupedIssueSelect:
- Lines 217-242 (issue type select)
- Same pattern as ScoutLogStep

**Acceptance Criteria**:
- [ ] Both scout forms show grouped issue selector
- [ ] "Other (custom)" still works
- [ ] Form validation unchanged
- [ ] No regression in scout workflow

---

### Phase 4: Verify Settings Page

**Task 4.1**: Manual verification

The settings page at `/settings/dropdowns` should already work with categories. Verify:
- [ ] Can assign category to each issue
- [ ] Category dropdown shows all four options
- [ ] Changes save correctly
- [ ] Sort order preserved within categories

---

## Technical Details

### GroupedIssueSelect Implementation Notes

Using shadcn/ui Select, we can achieve grouping with `SelectGroup` and `SelectLabel`:

```tsx
<Select value={value} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder={placeholder} />
  </SelectTrigger>
  <SelectContent>
    {categories.map(category => {
      const categoryOptions = groupedOptions[category];
      if (!categoryOptions?.length) return null;
      return (
        <SelectGroup key={category}>
          <SelectLabel className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
            {category}
          </SelectLabel>
          {categoryOptions.map(opt => (
            <SelectItem key={opt.systemCode} value={opt.displayLabel}>
              {opt.displayLabel}
            </SelectItem>
          ))}
        </SelectGroup>
      );
    })}
    {/* Uncategorized items */}
    {uncategorizedOptions.length > 0 && (
      <SelectGroup>
        <SelectLabel>Other Issues</SelectLabel>
        {uncategorizedOptions.map(opt => (
          <SelectItem key={opt.systemCode} value={opt.displayLabel}>
            {opt.displayLabel}
          </SelectItem>
        ))}
      </SelectGroup>
    )}
    {/* Custom option */}
    {showCustomOption && (
      <>
        <SelectSeparator />
        <SelectItem value="custom">Other (type below)</SelectItem>
      </>
    )}
  </SelectContent>
</Select>
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/attributeOptions.ts` | Update categories and defaults |
| `src/components/plant-health/GroupedIssueSelect.tsx` | New component |
| `src/components/plant-health/scout/ScoutLogStep.tsx` | Use GroupedIssueSelect |
| `src/components/plant-health/ipm/ScoutLogForm.tsx` | Use GroupedIssueSelect |

### Files Unchanged

| File | Reason |
|------|--------|
| `src/app/settings/dropdowns/page.tsx` | Already supports category |
| `src/server/attributeOptions/service.ts` | Already reads/writes category |
| `src/app/api/options/[attributeKey]/route.ts` | Already handles category |
| Database schema | `category` column already exists |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing data has old categories | Medium | Low | "Environmental" maps to Cultural or remains in "Other" |
| Select component complexity | Low | Medium | Use existing shadcn patterns |
| Breaking scout form validation | Low | High | Test form submission thoroughly |

---

## Definition of Done

1. [ ] Categories updated to: Disease, Pest, Cultural, Nutrition
2. [ ] Default options include examples from all categories
3. [ ] Scout forms show grouped issue dropdown with category headers
4. [ ] "Other (custom)" option still works for custom issues
5. [ ] Settings page correctly assigns/displays categories
6. [ ] No TypeScript errors
7. [ ] Manual testing passes:
   - [ ] Create new issue in settings with category
   - [ ] Log issue via scout wizard - see grouped dropdown
   - [ ] Select issue from each category
   - [ ] Enter custom issue

---

## Handoff Notes for Agents

### For `feature-builder`:
- Start with Phase 1 (attributeOptions.ts updates)
- Phase 2 is the main work - create GroupedIssueSelect component
- Phase 3 is straightforward integration
- Reference existing Select usage in scout forms for patterns

### Execution Mode
- **Recommended**: `standard`
- No database changes needed
- No security implications

### Critical Files to Understand
1. `src/lib/attributeOptions.ts` - Types and defaults
2. `src/components/ui/select.tsx` - shadcn Select primitives
3. `src/components/plant-health/scout/ScoutLogStep.tsx` - Main usage context

---

## Progress Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Update Categories | Complete | Updated to Disease, Pest, Cultural, Nutrition with new defaults |
| Phase 2: GroupedIssueSelect | Complete | Created with category headers, colored badges, count indicators |
| Phase 3: Integrate Forms | Complete | ScoutLogStep + ScoutLogForm now use GroupedIssueSelect |
| Phase 4: Verify Settings | Complete | UI improved with colored category buttons visible in list |

## Completion Notes (2026-02-05)

### UX Improvements Made (Beyond Original Plan)
1. **Settings Page Enhancements**:
   - Category now shown as colored badge next to display label (always visible)
   - Category selector changed from dropdown to colored pill buttons
   - Each category has distinctive icon + color scheme

2. **GroupedIssueSelect Component**:
   - Issues grouped by category with headers
   - Category headers show icon + name + count badge
   - Selected item shows category badge in trigger
   - Visual separators between groups
   - "Other (type below)" at bottom with separator

3. **Category Color Scheme**:
   - Disease: Red (AlertCircle icon)
   - Pest: Amber (Bug icon)
   - Cultural: Blue (Droplets icon)
   - Nutrition: Green (Leaf icon)

### Files Modified
- `src/lib/attributeOptions.ts` - Updated categories + comprehensive defaults
- `src/app/settings/dropdowns/page.tsx` - Improved UI with category badges
- `src/components/plant-health/GroupedIssueSelect.tsx` - New component
- `src/components/plant-health/scout/ScoutLogStep.tsx` - Uses GroupedIssueSelect
- `src/components/plant-health/ipm/ScoutLogForm.tsx` - Uses GroupedIssueSelect
