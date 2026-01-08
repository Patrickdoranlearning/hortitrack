# UI Templates

Reusable component templates for consistent UI/UX across Hortitrack.

## Quick Start

```tsx
import { DataPage, ConfirmDialog, EmptyState, SearchInput } from '@/ui/templates'
```

## Available Templates

### Layout (`@/ui/templates/layout`)

| Template | Description |
|----------|-------------|
| `PageFrame` | Base page wrapper with AppHeader |
| `AppHeader` | Application header with logo, nav, profile |
| `ModulePageHeader` | Page title with description and actions |

### Pages (`@/ui/templates/pages`)

| Template | Description |
|----------|-------------|
| `DataPage` | Data management page with toolbar and back button |
| `DataPageShell` | Legacy data page shell (use DataPage for new pages) |

### Dialogs (`@/ui/templates/dialogs`)

| Template | Description |
|----------|-------------|
| `DialogForm` | Form dialog with Zod validation |
| `ConfirmDialog` | Confirmation dialog for destructive actions |

### Sections (`@/ui/templates/sections`)

| Template | Description |
|----------|-------------|
| `DataToolbar` | CSV import/export toolbar with filters |
| `EmptyState` | Empty state placeholder with icon and action |

### Inputs (`@/ui/templates/inputs`)

| Template | Description |
|----------|-------------|
| `SearchInput` | Search bar with optional barcode scanner |

---

## Usage Examples

### DataPage

```tsx
import { DataPage } from '@/ui/templates'
import { DataToolbar } from '@/ui/templates'

export default function SizesPage() {
  return (
    <DataPage
      title="Plant Sizes"
      description="Manage pot, tray, and bareroot sizes."
      toolbar={
        <DataToolbar
          onDownloadTemplate={handleTemplate}
          onDownloadData={handleExport}
          onUploadCsv={handleImport}
        />
      }
      backHref="/settings"
    >
      <Card>
        <Table>...</Table>
      </Card>
    </DataPage>
  )
}
```

### ConfirmDialog

```tsx
import { ConfirmDialog } from '@/ui/templates'

<ConfirmDialog
  title="Delete item?"
  description="This action cannot be undone."
  onConfirm={() => handleDelete(id)}
  confirmLabel="Delete"
  variant="destructive"
>
  <Button variant="destructive">
    <Trash2 className="mr-2 h-4 w-4" />
    Delete
  </Button>
</ConfirmDialog>
```

### EmptyState

```tsx
import { EmptyState } from '@/ui/templates'
import { ShoppingCart } from 'lucide-react'

<EmptyState
  icon={ShoppingCart}
  title="No orders yet"
  description="Create your first order to get started."
  action={<Button>Create Order</Button>}
/>
```

### SearchInput

```tsx
import { SearchInput } from '@/ui/templates'

const [search, setSearch] = useState('')

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Search products..."
  showScanner
  onScan={(code) => handleBarcodeScan(code)}
/>
```

---

## Storybook

View all templates with interactive examples:

```bash
npm run storybook
```

Then open http://localhost:6006

---

## Adding New Templates

1. Create component in the appropriate folder
2. Export from folder's `index.ts`
3. Export from main `index.ts`
4. Create `.stories.tsx` file
5. Update this README

### Folder Structure

```
src/ui/templates/
├── README.md
├── index.ts
├── layout/      # Page wrappers, headers
├── pages/       # Full page templates
├── dialogs/     # Modal patterns
├── sections/    # Reusable sections
├── forms/       # Form patterns
└── inputs/      # Specialized inputs
```

---

## For AI Agents

When implementing new features, use these templates:

- **Data management pages** → Use `DataPage` + `DataToolbar`
- **Delete/confirm actions** → Use `ConfirmDialog`
- **Empty lists or no results** → Use `EmptyState`
- **Search functionality** → Use `SearchInput`
- **Form dialogs** → Use `DialogForm`
