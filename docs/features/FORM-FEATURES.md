# Enhanced Order Form Features

## Form Layout

### Section 1: Order Information Card
```
┌─────────────────────────────────────────────────────────────┐
│ Order Information                                            │
│ Customer details and delivery preferences                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Customer Dropdown ▼]    [Delivery Date: dd/mm/yyyy]       │
│                                                              │
│ [Shipping: Van/Haulier]  [✓ Auto Print Documents]          │
│                                                              │
│ [Customer Notes.........]  [Internal Notes............]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Section 2: Order Items Card

#### Mode Toggle
```
┌─────────────────────────────────────────────────────────────┐
│ Order Mode                                                   │
│ System will automatically allocate...    [Basic] [Specific] │
└─────────────────────────────────────────────────────────────┘
```

#### Basic Mode (Default)
```
┌─────────────────────────────────────────────────────────────┐
│ Item 1                                              [🗑️]     │
├─────────────────────────────────────────────────────────────┤
│ Product: [Lavandula - 2L Pot (150 available) ▼]            │
│                                                              │
│ ℹ️ System will automatically allocate from available batches│
│                                                              │
│ [Qty: 50]  [Price: 5.50]  [VAT: 13.5]  [✓ Allow Substitute]│
│                                                              │
│ [Description Override (Optional).........................]   │
└─────────────────────────────────────────────────────────────┘
```

#### Specific Mode
```
┌─────────────────────────────────────────────────────────────┐
│ Item 1                                              [🗑️]     │
├─────────────────────────────────────────────────────────────┤
│ Product: [Lavandula - 2L Pot (150 available) ▼]            │
│                                                              │
│ ┌─ Batch Selection Options ──────────── 150 plants ───┐   │
│ │                                                       │   │
│ │ Select Specific Batch:                               │   │
│ │ [Auto-allocate (or choose specific batch) ▼]        │   │
│ │   └─ BTH-001  50 plants  Grade A  Location: GH-1    │   │
│ │   └─ BTH-002  75 plants  Grade A  Location: GH-2    │   │
│ │   └─ BTH-003  25 plants  Grade B  Location: GH-1    │   │
│ │                                                       │   │
│ │ Grade Preference:                                    │   │
│ │ [Grade A] [Grade B] [Grade C] [Any Grade]          │   │
│ │                                                       │   │
│ │ [ℹ️ View All Batch Details ▼]                       │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
│ [Qty: 50]  [Price: 5.50]  [VAT: 13.5]  [✓ Allow Substitute]│
│                                                              │
│ [Description Override (Optional).........................]   │
└─────────────────────────────────────────────────────────────┘
```

#### Batch Details Popover
```
┌─────────────────────────────────────────────────────────┐
│ Available Batches                                        │
├─────────────────────────────────────────────────────────┤
│ ☑️ BTH-001         50 plants    Grade A                │
│   Location: GH-1    Status: Ready for Sale             │
│   Planted: 2025-10-15                                  │
│                                                         │
│ ☐ BTH-002         75 plants    Grade A                │
│   Location: GH-2    Status: Ready for Sale             │
│   Planted: 2025-10-20                                  │
│                                                         │
│ ☐ BTH-003         25 plants    Grade B                │
│   Location: GH-1    Status: Looking Good               │
│   Planted: 2025-10-25                                  │
│                                                         │
│ 1 batch(es) preferred                                  │
└─────────────────────────────────────────────────────────┘
```

### Section 3: Submit Actions
```
[Reset Form]                              [Create Order →]
```

## Feature Highlights

### 🎯 Basic Mode Features
- ✅ Simple product selection
- ✅ Automatic batch allocation
- ✅ FEFO logic (oldest first)
- ✅ Grade prioritization (A > B > C)
- ✅ Location-aware allocation
- ✅ No batch knowledge needed

### 🎯 Specific Mode Features
- ✅ View all available batches
- ✅ Select exact batch by ID
- ✅ Choose grade preference
- ✅ Mark multiple preferred batches
- ✅ See batch details:
  - Batch number
  - Quantity available
  - Grade (A/B/C)
  - Physical location
  - Status
  - Planting date
- ✅ Batch detail popover with checkboxes
- ✅ Real-time stock display

### 📋 Order Management Features
- ✅ Multi-line items
- ✅ Add/remove items dynamically
- ✅ Price overrides
- ✅ VAT rate overrides
- ✅ Substitution allowance per line
- ✅ Custom descriptions
- ✅ Customer notes (visible on invoice)
- ✅ Internal notes (team only)
- ✅ Delivery date picker
- ✅ Shipping method selection
- ✅ Auto-print documents option
- ✅ Form validation with inline errors
- ✅ Reset functionality

## User Experience Flow

### Creating a Basic Order
1. **Start**: Click "Create Order" from orders page
2. **Select Customer**: Choose from dropdown
3. **Add Product**: Select variety and size
4. **Set Quantity**: Enter desired quantity
5. **Review**: Price auto-fills from price list
6. **Submit**: Click "Create Order"
7. **Done**: System allocates and creates order

**Time**: ~30 seconds

### Creating a Specific Order
1. **Start**: Click "Create Order" from orders page
2. **Select Customer**: Choose from dropdown
3. **Toggle Mode**: Click "Specific Order" button
4. **Add Product**: Select variety and size
5. **View Batches**: See available batches with details
6. **Choose Preference**: Either:
   - Select one specific batch, OR
   - Choose grade preference, OR
   - Mark preferred batches in popover
7. **Set Quantity**: Enter desired quantity
8. **Submit**: Click "Create Order"
9. **Done**: System allocates per preferences

**Time**: ~60 seconds

## Validation Rules

### Required Fields
- ✅ Customer (must select)
- ✅ At least one order line
- ✅ Product or Variety + Size per line
- ✅ Quantity per line (positive integer)

### Optional Fields
- Delivery date
- Shipping method
- Notes (customer/internal)
- Unit price (defaults to price list)
- VAT rate (defaults to SKU/product default)
- Allow substitute flag
- Description override
- Batch preferences

### Error Messages
- "Provide a productId or both plant variety and size"
- "Quantity must be a positive number"
- "Customer not found"
- "No products configured for this organization"
- "No product found for [variety] [size]"

## Responsive Design

### Desktop (>1024px)
- Two-column layout for form fields
- Side-by-side notes fields
- Batch details in rich popover
- Full batch information visible

### Tablet (768-1024px)
- Two-column layout maintained
- Condensed batch popover
- Touch-friendly buttons

### Mobile (<768px)
- Single-column layout
- Stacked form fields
- Full-width inputs
- Simplified batch selector

## Accessibility

- ✅ Keyboard navigation support
- ✅ Screen reader friendly labels
- ✅ ARIA attributes on interactive elements
- ✅ Focus management
- ✅ High contrast mode compatible
- ✅ Error announcements

## Performance

- ✅ Products loaded server-side
- ✅ Batch data fetched once per page
- ✅ Form state managed client-side
- ✅ Validation runs on submit
- ✅ Optimized re-renders with React Hook Form

---

**Version**: 1.0
**Date**: 2025-12-04
