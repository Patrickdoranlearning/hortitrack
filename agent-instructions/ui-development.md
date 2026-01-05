# Hortitrack UI Development Guide

This guide defines the "Golden Path" for building new UI features in Hortitrack. Follow these patterns to ensure consistency, accessibility, and high performance.

## 核心 Philosophy (Core Philosophy)

1. **Template-First**: Always check `src/ui/templates` before building a layout from scratch.
2. **Standardized CRUD**: Data management pages should follow the pattern established in the `_starter-feature`.
3. **Server Actions**: Use Next.js Server Actions for all mutations (Create, Update, Delete) with structured error handling.
4. **Zod Validation**: Share schemas between the client (forms) and the server (actions).

---

## The "Starter" Pattern

When building a new data-managed feature (e.g., "Locations", "Products"), copy the `src/ui/templates/_starter-feature` folder and customize it.

### Folder Structure
- `page.tsx`: The main view using `DataPage`.
- `actions.ts`: Standardized CRUD server actions.
- `schema.ts`: Shared validation logic.
- `[Feature]Form.tsx`: A specialized form using `shadcn` components.

---

## UI Template Inventory

### Layouts (`@/ui/templates/layout`)
- **PageFrame**: The base layout wrapper. Includes `AppHeader`.
- **DataPage**: The standard layout for management screens. Includes a title, description, and optional toolbar.

### Components (`@/ui/templates/sections`)
- **DataToolbar**: A container for filters (left) and actions (right). Supports CSV import/export buttons.
- **EmptyState**: Standardized placeholder for empty lists or searches.

### Dialogs (`@/ui/templates/dialogs`)
- **DialogForm**: A generic wrapper for modal forms with built-in submission state.
- **ConfirmDialog**: Standard alert for destructive actions (e.g., "Delete").

### Inputs (`@/ui/templates/inputs`)
- **SearchInput**: Standard search bar with optional barcode scanner integration.

---

## AI Agent Instructions

When asking an AI agent to build a new feature, provide this context:

> "Build a new [FEATURE_NAME] feature. 
> 1. Follow the patterns in `src/ui/templates/_starter-feature`.
> 2. Use `DataPage` for the main layout.
> 3. Implement Server Actions in a local `actions.ts` file.
> 4. Use `DialogForm` for creating/editing items.
> 5. Ensure the UI matches the existing Hortitrack theme (shadcn/ui + Lucide icons)."

---

## Best Practices

### 1. Handling Mutations
Always use the `useToast` hook to provide feedback for server actions.
```tsx
const result = await createAction(values);
if (result.success) {
  toast({ title: "Success", description: "Item created" });
} else {
  toast({ variant: "destructive", title: "Error", description: result.error });
}
```

### 2. Form Validation
Use `react-hook-form` with `@hookform/resolvers/zod`. Keep the schema in a separate `schema.ts` file so it can be used by both the form and the server action.

### 3. Data Loading
Use the `useCollection` hook for real-time data or standard SWR patterns for reference data. Ensure loading states are handled with `Skeleton` components.


