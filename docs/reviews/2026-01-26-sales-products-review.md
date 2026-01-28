# Review: Sales Module & Product Implementation

I have reviewed the sales module and product implementation as requested, specifically focusing on the new **Family Matching** and **Group Reservation** features.

## Findings

1.  **UI Feedback for Group Reservations**:
    *   **Status**: Partially Incomplete.
    *   **Issue**: While the backend correctly calculated `groupReserved` stock, the `SalesProductAccordionRow` component was not displaying this information. Users would see reduced `netAvailableStock` but not know *why* (i.e., that it was reserved for a group order).
    *   **Fix**: Updated `SalesProductAccordionRow.tsx` to display a `[-N grp]` indicator in the product dropdown when stock is reserved for a group.

2.  **Admin vs. Sales Stock Discrepancy**:
    *   **Status**: Inconsistent.
    *   **Issue**: The `match_families` logic was implemented in the Sales engine (`getProductsWithBatches`) but was missing from the Admin Product Management data loader (`mapProducts`).
    *   **Result**: A product with `match_families` configured would show **correct stock** in the Sales Wizard but **zero stock** in the Admin Product List "Inventory" column (unless batches were manually linked).
    *   **Fix**: Updated `product-data.ts` to implement the same dynamic matching logic. Admin UI now correctly identifies and counts family-matched batches as "Linked Batches" (dynamic).

3.  **Data Fetching Gaps**:
    *   **Status**: Minor Gap.
    *   **Issue**: `fetchProductManagementData` was not retrieving `family` information for batches, which was required to fix finding #2.
    *   **Fix**: Updated the query to include `plant_varieties(family)`.

## Summary of Changes

### Frontend
-   **`src/components/sales/wizard/SalesProductAccordionRow.tsx`**: Added visual indicator for group reservations.

### Backend / Data
-   **`src/app/sales/products/product-data.ts`**:
    -   Updated `fetchProductManagementData` to fetch batch variety families.
    -   Rewrote `mapProducts` to perform dynamic family matching, merging these with manually linked batches for a unified view.
-   **`src/app/sales/products/page.tsx`**: Updated to pass full batch data to `mapProducts` to enable the dynamic matching.

## Result
The Sales module and Product Management are now fully aligned.
-   **Sales**: Shows correct stock and explains group reservations.
-   **Admin**: Shows correct stock counts including dynamically matched batches.
