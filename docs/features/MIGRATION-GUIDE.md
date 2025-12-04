# Enhanced Sales Order Migration Guide

## What Changed?

The `/sales/orders/new` route now uses the enhanced order form with batch selection capabilities.

## Key Changes

### 1. Order Form Route
**File**: [src/app/sales/orders/new/page.tsx](../../src/app/sales/orders/new/page.tsx)

**Before**: Used simple `CreateOrderForm` with basic text inputs
**After**: Uses `EnhancedCreateOrderForm` with rich product/batch selection

### 2. New Components

#### ProductBatchSelector
- **Location**: [src/components/sales/ProductBatchSelector.tsx](../../src/components/sales/ProductBatchSelector.tsx)
- **Purpose**: Allows selection of products with optional batch-level control
- **Modes**:
  - **Basic**: Auto-allocation (like before)
  - **Specific**: Choose batches, grades, or preferences

#### EnhancedCreateOrderForm
- **Location**: [src/components/sales/EnhancedCreateOrderForm.tsx](../../src/components/sales/EnhancedCreateOrderForm.tsx)
- **Purpose**: Complete order form with all features
- **New Features**:
  - Mode toggle (Basic/Specific)
  - Batch details viewer
  - Grade preference selection
  - Preferred batch selection

### 3. Backend Updates

#### Order Line Schema
- **File**: [src/lib/sales/types.ts](../../src/lib/sales/types.ts:15-37)
- **Added Fields**:
  ```typescript
  specificBatchId?: string
  gradePreference?: 'A' | 'B' | 'C'
  preferredBatchNumbers?: string[]
  ```

#### Allocation Logic
- **File**: [src/server/sales/allocation.ts](../../src/server/sales/allocation.ts)
- **Enhanced**: Now supports batch preferences
- **New Interface**: `AllocationOptions` with preference fields

#### Data Fetching
- **File**: [src/server/sales/products-with-batches.ts](../../src/server/sales/products-with-batches.ts)
- **Function**: `getProductsWithBatches(orgId)`
- **Returns**: Products with complete batch information

## How to Use

### For Basic Orders (Default Behavior)
1. Click "Create Order" button
2. Select customer
3. Add products (just like before)
4. System auto-allocates from available batches
5. Submit order

**Nothing changes for basic workflow!**

### For Specific Orders (New Feature)
1. Click "Create Order" button
2. Select customer
3. Toggle to "Specific Order" mode
4. Select product
5. View available batches
6. Either:
   - Select a specific batch, OR
   - Choose grade preference, OR
   - Mark preferred batches
7. Submit order

## Backward Compatibility

✅ **Existing orders**: Continue to work unchanged
✅ **Basic mode**: Works exactly like the old form
✅ **No database changes**: Uses existing schema
✅ **Optional features**: Batch selection is optional

## Testing Checklist

- [ ] Navigate to `/sales/orders/new`
- [ ] Verify form loads with products
- [ ] Test basic mode (should work like before)
- [ ] Toggle to specific mode
- [ ] View batch details
- [ ] Select a specific batch
- [ ] Submit order
- [ ] Verify order created successfully
- [ ] Check order description includes batch info

## Rollback Instructions

If you need to revert to the old form:

1. Edit [src/app/sales/orders/new/page.tsx](../../src/app/sales/orders/new/page.tsx)
2. Replace import:
   ```typescript
   // Change from:
   import EnhancedCreateOrderForm from '@/components/sales/EnhancedCreateOrderForm';

   // Back to:
   import CreateOrderForm from '@/components/sales/CreateOrderForm';
   ```
3. Simplify the page to use old form (see git history)

The old `CreateOrderForm` still exists and is unchanged.

## Common Issues

### Issue: "No Products Available"
**Cause**: No products with stock found
**Solution**:
- Check that products exist in database
- Verify products are marked as `is_active = true`
- Ensure batches have `quantity > 0`
- Check batch status is "Ready for Sale" or "Looking Good"

### Issue: "No Active Organization"
**Cause**: User profile doesn't have `active_org_id` set
**Solution**: Ensure user has selected an organization

### Issue: Batch details not showing
**Cause**: Product-batch mappings may be missing
**Solution**: Check `product_batches` table has entries linking products to batches

## Support

For issues or questions:
1. Check [enhanced-sales-orders.md](./enhanced-sales-orders.md) for detailed documentation
2. Review component code and inline comments
3. Check browser console for errors
4. Verify database has required data

## Next Steps

Consider:
- [ ] Training team on specific order mode
- [ ] Updating customer documentation
- [ ] Creating video tutorial
- [ ] Setting up batch reservations
- [ ] Adding batch photos to selector

---

**Version**: 1.0
**Date**: 2025-12-04
