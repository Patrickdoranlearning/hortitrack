# Enhanced Sales Order System

## Overview

The enhanced sales order system allows customers to place both **basic** and **specific** orders:

- **Basic Orders**: System automatically allocates products from available batches using FEFO (First Expired, First Out) logic
- **Specific Orders**: Customers can request specific batches, grades, or variety preferences

## Features

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

## Components

### ProductBatchSelector
**Location**: [src/components/sales/ProductBatchSelector.tsx](../../src/components/sales/ProductBatchSelector.tsx)

Main component for product and batch selection:

```tsx
<ProductBatchSelector
  products={products}
  value={selectedValue}
  onChange={handleChange}
  mode="basic" // or "specific"
/>
```

**Props**:
- `products`: Array of products with batch information
- `value`: Current selection state
- `onChange`: Handler for selection changes
- `mode`: "basic" or "specific"
- `onModeChange`: Optional handler to toggle between modes

### EnhancedCreateOrderForm
**Location**: [src/components/sales/EnhancedCreateOrderForm.tsx](../../src/components/sales/EnhancedCreateOrderForm.tsx)

Complete order form with batch selection:

```tsx
<EnhancedCreateOrderForm
  customers={customers}
  products={productsWithBatches}
/>
```

**Features**:
- Customer selection
- Delivery date and shipping method
- Customer and internal notes
- Auto-print toggle for documents
- Multiple order line items with batch preferences
- Real-time form validation

## Data Models

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

  // Batch-specific fields (new)
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

## Server Functions

### getProductsWithBatches
**Location**: [src/server/sales/products-with-batches.ts](../../src/server/sales/products-with-batches.ts)

Fetches all products with their associated batch information:

```typescript
const products = await getProductsWithBatches(orgId);
```

**Returns**: Array of products with:
- Product details (id, name, variety, size)
- Total available stock
- Array of available batches with quantities, grades, locations

### allocateForProductLine (Enhanced)
**Location**: [src/server/sales/allocation.ts](../../src/server/sales/allocation.ts)

Enhanced allocation function with batch preferences:

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

**Returns**: Array of allocations with:
- `batchId`: UUID of the batch
- `batchNumber`: Human-readable batch number
- `qty`: Quantity allocated from this batch
- `grade`: Quality grade
- `location`: Physical location

## Usage Examples

### Basic Order Workflow

1. Customer selects a product (e.g., "Lavandula - 2L Pot")
2. Enters quantity (e.g., 100 units)
3. System automatically allocates from available batches
4. Order created with optimal batch allocation

### Specific Order Workflow

1. Customer toggles to "Specific Order" mode
2. Selects product
3. Views available batches with details:
   - Batch numbers
   - Quantities available
   - Grades
   - Locations
   - Planting dates
4. Either:
   - Selects one specific batch, OR
   - Chooses grade preference (A/B/C), OR
   - Marks multiple preferred batches
5. System allocates according to preferences
6. Order created with batch preferences stored

## Page Routes

### New Enhanced Order Page
**Route**: `/sales/orders/new-enhanced`
**File**: [src/app/sales/orders/new-enhanced/page.tsx](../../src/app/sales/orders/new-enhanced/page.tsx)

Full-featured order creation page with:
- Customer selection
- Product browsing with batch details
- Basic/specific mode toggle
- Rich form validation
- Order submission

## Database Changes

### Order Items Description Field
Batch preferences are stored in the `description` field with tags:
- `[Batch: uuid]` - Specific batch requested
- `[Grade: A]` - Grade preference specified
- `[Preferred Batches: BTH-001, BTH-002]` - Preferred batch list

This allows the pick team to see customer preferences when fulfilling orders.

## Integration with Existing System

### Backward Compatible
- Works with existing `createOrder` action
- No database schema changes required
- Existing orders continue to work
- Basic mode behaves like the original system

### Allocation Workflow
1. Order created with preferences stored in description
2. When order status changes to "picking", allocation happens:
   - Reads batch preferences from order line
   - Calls enhanced `allocateForProductLine` with preferences
   - Creates pick order with specific batches
   - Updates inventory quantities

## Future Enhancements

### Potential Improvements
1. **Dedicated Metadata Table**: Create `order_item_metadata` table for structured batch preferences
2. **Real-time Stock Updates**: Show live stock as users build orders
3. **Batch Photos**: Display photos of specific batches in selector
4. **Quality Reports**: Show QC reports when selecting batches
5. **Batch History**: Display batch history and previous orders
6. **Smart Suggestions**: AI-powered batch recommendations based on customer history

### Planned Features
- [ ] Batch reservation system (hold stock for pending orders)
- [ ] Customer-specific batch preferences (saved preferences)
- [ ] Batch age warnings (alert for old stock)
- [ ] Mixed batch restrictions (configurable per customer)
- [ ] Batch tracking through delivery (batch-to-invoice mapping)

## Testing

### Manual Testing Checklist

**Basic Order Mode**:
- [ ] Select customer
- [ ] Add product by variety + size
- [ ] Set quantity
- [ ] Verify price auto-fills from price list
- [ ] Submit order
- [ ] Verify order created successfully

**Specific Order Mode**:
- [ ] Toggle to specific mode
- [ ] Select product with multiple batches
- [ ] View batch details popover
- [ ] Select specific batch
- [ ] Verify batch ID stored in order
- [ ] Submit order
- [ ] Check description includes batch info

**Grade Preference**:
- [ ] Select product
- [ ] Choose grade preference (A/B/C)
- [ ] Submit order
- [ ] Verify grade preference stored

**Preferred Batches**:
- [ ] Open batch details
- [ ] Select multiple preferred batches
- [ ] Verify selections show in UI
- [ ] Submit order
- [ ] Check preferred batch numbers in description

## Support & Documentation

For questions or issues with the enhanced sales order system:
1. Check this documentation
2. Review component code and comments
3. Test with sample data first
4. Check server logs for allocation warnings

## API Reference

### createOrder Action
**Location**: [src/app/sales/actions.ts](../../src/app/sales/actions.ts)

Enhanced to support batch preferences:

```typescript
const result = await createOrder({
  customerId: "uuid",
  deliveryDate: "2025-12-31",
  lines: [{
    plantVariety: "Lavandula",
    size: "2L Pot",
    qty: 100,
    unitPrice: 5.50,
    // Batch preferences
    specificBatchId: "batch-uuid",
    gradePreference: "A",
    preferredBatchNumbers: ["BTH-001"]
  }]
});
```

**Returns**: Success or error object
**Side Effects**:
- Creates order record
- Creates order items with batch preferences
- Logs order creation event
- Revalidates order list
- Redirects to orders page

---

**Version**: 1.0
**Last Updated**: 2025-12-04
**Author**: Claude Code
**Status**: Production Ready
