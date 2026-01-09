# Select With Create Pattern for AI Agents

## Overview

Use this guide when implementing form dropdowns that allow users to create new options inline. This pattern ensures users can add missing options without losing their form data.

---

## Core Principle (CRITICAL)

**Always open the entity creation page in a new browser tab.**

- **NEVER** use dialogs/modals for creating new entities from dropdown "Add new" actions
- **REASON**: Dialogs risk losing form data if something goes wrong
- **REASON**: Users get the full creation experience, not a simplified "quick create" form
- **REASON**: No duplicate forms to maintain

---

## Architecture

```
Form with Dropdown
       │
       ▼
SelectWithCreate Component
       │
       ├── Regular options (SelectItem)
       │
       └── "Add new" action (opens new tab)
              │
              ▼
       Entity Settings Page (e.g., /sizes, /varieties, /locations)
              │
              ▼
       User creates entity, returns to original tab
              │
              ▼
       useRefreshOnFocus auto-refreshes reference data
```

---

## Components Reference

### SelectWithCreate

**Location:** `src/components/ui/select-with-create.tsx`

A wrapper around Radix Select that adds an "Add new" option at the bottom.

```tsx
import { SelectWithCreate } from "@/components/ui/select-with-create";

<SelectWithCreate
  options={items.map((item) => ({
    value: item.id,
    label: item.name,
    badge: item.isPrimary ? <Badge>Primary</Badge> : undefined, // optional
  }))}
  value={selectedValue}
  onValueChange={setSelectedValue}
  createHref="/settings/items"  // URL to open in new tab
  placeholder="Select an item"
  createLabel="Add new item"    // optional, defaults to "Add new"
/>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SelectOption[]` | Yes | Array of `{ value, label, badge? }` |
| `value` | `string` | No | Currently selected value |
| `onValueChange` | `(value: string) => void` | Yes | Selection change handler |
| `createHref` | `string` | Yes | URL to open when "Add new" is clicked |
| `placeholder` | `string` | No | Placeholder text |
| `createLabel` | `string` | No | Label for create action (default: "Add new") |
| `className` | `string` | No | Additional CSS classes for trigger |
| `disabled` | `boolean` | No | Disable the select |
| `emptyLabel` | `string` | No | If provided, adds a clear/empty option at the top |
| `emptyValue` | `string` | No | Value for the empty option (default: "") |

**Handling Optional Selections:**

For dropdowns where the field is optional (user can clear their selection), use `emptyLabel` and `emptyValue`:

```tsx
<SelectWithCreate
  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
  value={selectedSupplierId ?? "none"}
  onValueChange={(val) => setSelectedSupplierId(val === "none" ? null : val)}
  createHref="/suppliers"
  placeholder="Select supplier"
  createLabel="Add new supplier"
  emptyLabel="No default supplier"  // Shows at top of list
  emptyValue="none"                  // Value when "clear" option selected
/>
```

### useRefreshOnFocus

**Location:** `src/hooks/useRefreshOnFocus.ts`

A hook that triggers a callback when the browser tab regains focus. Use this to auto-refresh data when users return from creating a new entity.

```tsx
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";

// In your form component
const { reload } = useContext(ReferenceDataContext);
useRefreshOnFocus(reload);
```

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `onFocus` | `() => void` | Yes | Callback to execute on focus |
| `enabled` | `boolean` | No | Whether hook is active (default: true) |

---

## Implementation Checklist

When adding "Add new" to a dropdown:

- [ ] Import `SelectWithCreate` from `@/components/ui/select-with-create`
- [ ] Import `useRefreshOnFocus` from `@/hooks/useRefreshOnFocus`
- [ ] Replace `Select` with `SelectWithCreate`
- [ ] Map your data to the `options` format: `{ value, label, badge? }`
- [ ] Set `createHref` to the correct settings page URL
- [ ] Add `useRefreshOnFocus(reload)` to auto-refresh when tab regains focus
- [ ] Set a descriptive `createLabel` (e.g., "Add new variety" not just "Add new")

---

## Common Entity URLs

| Entity | URL | Notes |
|--------|-----|-------|
| Varieties | `/varieties` | Plant varieties |
| Sizes | `/sizes` | Container/pot sizes |
| Locations | `/locations` | Nursery locations |
| Suppliers | `/suppliers` | Material suppliers |
| Customers | `/sales/customers` | Sales customers |
| Hauliers | `/hauliers` | Delivery hauliers |

---

## Full Example

```tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function MyForm() {
  const { data: referenceData, reload } = React.useContext(ReferenceDataContext);
  
  // Auto-refresh when user returns from creating new entity
  useRefreshOnFocus(reload);
  
  const form = useForm({ /* ... */ });
  
  const sizes = React.useMemo(() => {
    const s = [...(referenceData?.sizes ?? [])];
    // Sort propagation sizes first
    return s.sort((a, b) => {
      if (a.container_type === "prop_tray" && b.container_type !== "prop_tray") return -1;
      if (a.container_type !== "prop_tray" && b.container_type === "prop_tray") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [referenceData]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="size_id"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Size / Container</FormLabel>
              <SelectWithCreate
                options={sizes.map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${s.container_type}`,
                  badge: s.container_type === "prop_tray" ? (
                    <Badge variant="outline" className="text-[10px]">Prop</Badge>
                  ) : undefined,
                }))}
                value={field.value}
                onValueChange={field.onChange}
                createHref="/sizes"
                placeholder="Select a size"
                createLabel="Add new size"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
```

---

## When NOT to Use This Pattern

- **Static enum values** - Use plain `Select` for fixed options like statuses, types
- **Search-heavy dropdowns** - Consider `Combobox` with search + create
- **Inline quick-add** - If the entity only needs a name field, consider a different UX

---

## Reference Implementation

See the following files for working examples:

- **SelectWithCreate component**: `src/components/ui/select-with-create.tsx`
- **useRefreshOnFocus hook**: `src/hooks/useRefreshOnFocus.ts`
- **Simple form**: `src/components/batches/PropagationForm.tsx`
- **Bulk upload with optional selection**: `src/components/batches/BulkPropagationUpload.tsx`
- **Entity form with related entity**: `src/components/vehicle-form.tsx`
- **Material form with size/supplier**: `src/components/materials/MaterialForm.tsx`
- **Sales order form with customer**: `src/components/sales/CreateOrderForm.tsx`

---

## Troubleshooting

### "Add new" not opening in new tab
- Verify `createHref` is a valid URL string
- Check browser popup blocker settings

### Data not refreshing when returning
- Ensure `useRefreshOnFocus(reload)` is called in the component
- Verify `reload` function is available from context
- Check browser dev tools for any errors during reload

### Badge not showing in dropdown
- Ensure `badge` property is a React node, not a string
- Check that the SelectWithCreate component is rendering badges correctly
