# Product Stock Logic & Availability

This document explains the logic behind product stock calculation, batch linking, and reservations in the Hortitrack Sales module.

## Core Concepts

The system uses two methods to link **Batches** (growing stock) to **Products** (sellable items):

### 1. Explicit Linking (`product_batches`)
- **Mechanism**: Manual links created in the "Inventory" tab of the Product Management screen.
- **Use Case**: When a product maps to a specific batch that doesn't follow standard family/size rules, or when precise control is needed.
- **Data Source**: `product_batches` table.

### 2. Dynamic Linking (`match_families`)
- **Mechanism**: Automatic matching based on Plant Family and Pot Size.
- **Use Case**: "Generic" products like "1L Heathers" that should automatically include any available batch of Heathers in a 1L pot.
- **Configuration**:
  - **Product**: Must have `match_families` array set (e.g., `['Calluna', 'Erica Carnea']`) AND a SKU with a defined Size.
  - **Batch**: Must have a matching Plant Variety (Family match) AND the same Size ID.
- **Matching Logic**:
  - **Family**: Case-insensitive match against the batch's variety family.
  - **Size**: Exact match on `size_id`.
  - **Status**: Only batches with `behavior: 'available'` (or equivalent status) are included.

> **Note**: The system merges both sources. If a batch is both explicitly linked AND dynamically matched, it is deduped.

---

## Availability Calculation

The "Net Available Stock" determines what can be sold.

### Formula

```typescript
netAvailableStock = MAX(0, totalStock - orderReserved - groupReserved)
```

### Components

1.  **`totalStock`**: Sum of `quantity` (or `available_quantity_override`) from all linked batches (Explicit + Dynamic).
2.  **`orderReserved`**: Sum of quantities from confirmed orders placed directly against this product (`order_items.product_id`).
3.  **`groupReserved`**: Sum of quantities from confirmed orders placed against **Product Groups** that this product belongs to.

---

## Group Reservations

When a customer orders a **Product Group** (e.g., "1L Heather Mix"), they are not specifying the exact variety. This creates a "floating" reservation that must reduce the availability of all member products to prevent overselling.

-   **Mechanism**:
    1.  Order is placed with `product_group_id` (and `product_id` is null).
    2.  System calculates total group reservations.
    3.  This total is distributed to **ALL** member products as `groupReserved`.
-   **UI Representation**:
    -   In Sales Wizard: Shown as `[-N grp]` in the product dropdown.
    -   Availability: Subtracted from the main available figure.

---

## Admin vs. Sales Consistency

Historically, the Admin panel and Sales Wizard used different logic. As of Jan 2026, they are unified:

-   **Sales Engine** (`src/server/sales/products-with-batches.ts`): Implements the full logic described above.
-   **Admin Data Loader** (`src/app/sales/products/product-data.ts`): Implements the same dynamic matching logic in `mapProducts` to ensure the "Inventory" column in the product list matches what salespeople see.

---

## Key Files

-   **`src/server/sales/products-with-batches.ts`**: Main engine for Sales Wizard stock calculation.
-   **`src/app/sales/products/product-data.ts`**: Data loader for Admin Product Management.
-   **`src/server/sales/product-groups-with-availability.ts`**: Logic for Product Group availability.
