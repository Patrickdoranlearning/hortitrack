# Sales Module: Data + Workflow Plan

This note captures the structural changes we need before building out the refreshed sales experience. It ties back to the existing spec in `docs/Hortitrack_one`.

## 1. Invoice Numbering
- Introduce a dedicated `invoice_number_seq` sequence seeded at **200000**.
- Set `invoices.invoice_number` default to `nextval('invoice_number_seq')::text`.
- Server actions must always read the generated number from the insert response to avoid race conditions (no client-side numbering).

## 2. Product/SKU/Batches
| Entity | Purpose | Key Fields / Notes |
| --- | --- | --- |
| `skus` (existing) | Canonical internal SKU per product | Already tied to `plant_variety_id`, `size_id`, VAT rate, etc. |
| `products` (new) | Merchandised sales listing that sales + webshop users see | FK `sku_id` (unique), `name`, `description`, `default_status`, `hero_image_url`, `is_active`. |
| `product_batches` (new) | Relates finished batches to the product/SKU they can fulfill | FKs `product_id`, `batch_id`, `available_quantity_override` for manual tweaks, timestamps for traceability. |

### Notes
- A **product owns exactly one SKU**, fulfilling the “one SKU per product” request.
- All downstream references (order items, price rows) should point to `product_id` (and join to SKU when stock metadata is needed).

## 3. Pricing
| Table | Purpose |
| --- | --- |
| `price_lists` (existing) | Holds org-level price groups (default + specials). |
| `product_prices` (new) | `product_id`, `price_list_id`, `unit_price_ex_vat`, `currency`, `valid_from/valid_to`, `min_qty`. |
| `price_list_customers` (new helper) | Optional override that maps customers onto a specific price list when the `customers.default_price_list_id` is not enough (e.g., seasonal promos). |

Resolution order for a customer:
1. Explicit mapping in `price_list_customers` (if active).
2. Customer’s `default_price_list_id`.
3. Org default price list (`price_lists.is_default = true`).

## 4. Order Events & Exceptions
- `order_events` table to log lifecycle milestones (status changes, substitutions, invoices generated).
- `order_exceptions` table to capture issues that block fulfillment, e.g.:
  - `type = 'product_unavailable'`.
  - `status = 'open' | 'resolved'`.
  - captures who raised/resolved, notes, timestamps.
- Picking UI can freely substitute **batches**. When a **product** allocation fails (no linked batches or zero stock), the picker records an exception. Orders with open exceptions cannot transition to `ready_for_dispatch` until a dispatch manager resolves them.

## 5. Next Steps
1. Write Supabase migration(s) to add all new tables, sequence, and defaults.
2. Update `src/app/sales/actions.ts` + server utilities to read/write the new schema.
3. Extend the picking workflow UI to surface substitutions vs. product-level exceptions.
4. Add regression tests around pricing resolution + invoice sequencing.

This plan keeps the DB immutable-friendly and provides a paper trail for audits while matching the sales spec. Let me know if any adjustments are needed before we cut migrations.



