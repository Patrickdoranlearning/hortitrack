# Enhanced Sales Order System

**Status**: ✅ COMPLETE

## Overview

The enhanced sales order system allows customers to place both **basic** and **specific** orders:

- **Basic Orders**: System automatically allocates products from available batches using FEFO (First Expired, First Out) logic
- **Specific Orders**: Customers can request specific batches, grades, or variety preferences

---

## Features ✅

### 1. Basic Order Mode (Default)
- Simple product selection by variety and size
- Automatic batch allocation using intelligent FEFO logic
- Prioritizes oldest batches first
- Considers grade quality (A > B > C)
- Best for most standard orders

### 2. Specific Order Mode
Allows customers to specify:
- **Specific Batch**: Request plants from an exact batch ID
- **Grade Preference**: Prefer Grade A, B, or C plants
- **Preferred Batches**: Select multiple preferred batch numbers to prioritize

---

## Components ✅

### ProductBatchSelector
**Location**: `src/components/sales/ProductBatchSelector.tsx`

```tsx
<ProductBatchSelector
  products={products}
  value={selectedValue}
  onChange={handleChange}
  mode="basic" // or "specific"
/>
```

### EnhancedCreateOrderForm
**Location**: `src/components/sales/EnhancedCreateOrderForm.tsx`

Features:
- Customer selection
- Delivery date and shipping method
- Customer and internal notes
- Auto-print toggle for documents
- Multiple order line items with batch preferences
- Real-time form validation

---

## Data Models ✅

### Extended Order Line Schema

```typescript
{
  // Standard fields
  productId?: string
  plantVariety?: string
  size?: string
  qty: number
  unitPrice?: number
  vatRate?: number
  allowSubstitute?: boolean
  description?: string

  // Batch-specific fields
  specificBatchId?: string         // UUID of specific batch
  gradePreference?: 'A' | 'B' | 'C' // Grade preference
  preferredBatchNumbers?: string[]  // Array of batch numbers
}
```

### Product with Batches

```typescript
interface ProductWithBatches {
  id: string
  name: string
  plantVariety: string
  size: string
  availableStock: number
  batches: BatchInfo[]
}

interface BatchInfo {
  id: string
  batchNumber: string
  plantVariety: string
  size: string
  quantity: number
  grade?: string
  location?: string
  status?: string
  plantingDate?: string
}
```

---

## Server Functions ✅

### getProductsWithBatches
**Location**: `src/server/sales/products-with-batches.ts`

```typescript
const products = await getProductsWithBatches(orgId);
```

Returns array of products with:
- Product details (id, name, variety, size)
- Total available stock
- Array of available batches with quantities, grades, locations

### allocateForProductLine (Enhanced)
**Location**: `src/server/sales/allocation.ts`

```typescript
const allocations = await allocateForProductLine({
  plantVariety: "Lavandula",
  size: "2L Pot",
  qty: 100,
  // Optional batch preferences
  specificBatchId?: "uuid",
  gradePreference?: "A",
  preferredBatchNumbers?: ["BTH-001", "BTH-002"]
});
```

**Allocation Logic**:
1. If `specificBatchId` provided: Only allocate from that batch
2. If `gradePreference` provided: Prioritize that grade
3. If `preferredBatchNumbers` provided: Try those batches first
4. Default: FEFO + grade priority (oldest → newest, A → B → C)

---

## Routes ✅

| Route | Purpose |
|-------|---------|
| `/sales/orders/new` | Standard order creation |
| `/sales/orders/new-enhanced` | Enhanced order with batch selection |

---

## Implementation Status

| Component | Status |
|-----------|--------|
| ProductBatchSelector | ✅ Complete |
| EnhancedCreateOrderForm | ✅ Complete |
| getProductsWithBatches | ✅ Complete |
| Enhanced allocateForProductLine | ✅ Complete |
| Order creation with preferences | ✅ Complete |
| Picking integration | ✅ Complete |

---

## Future Enhancements

These are potential improvements, not blockers:

- [ ] Batch reservation system (hold stock for pending orders)
- [ ] Customer-specific batch preferences (saved preferences)
- [ ] Batch age warnings (alert for old stock)
- [ ] Mixed batch restrictions (configurable per customer)
- [ ] Batch tracking through delivery (batch-to-invoice mapping)
- [ ] Batch photos in selector
- [ ] AI-powered batch recommendations based on customer history

---

**Last Updated**: January 2026
