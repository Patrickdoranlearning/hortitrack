No linting required for markdown documentation.
# Product Alias Architecture (Nursery SKU → Product → Customer Alias)

## 1. Nursery SKUs (Internal)
- Table: `skus`
- Purpose: canonical internal identifier for stock; a SKU can back many products.
- Key fields:
  - `code` (e.g. `SKU-0001`)
  - `display_name` (new) – human-friendly label for ops
  - `barcode`
  - `default_vat_rate`
  - `sku_type` (enum) – `Internal`, `Customer`, `Both`
  - Variety/size references remain optional; SKUs are general.

## 2. Products (Shared Catalog)
- Table: `products`
- 1:1 with a SKU, adds sales copy and linked batches.
- Used by the internal sales UI and the default view in the B2B portal.
- Fields already exist (`name`, `hero_image_url`, `default_status`, etc.).

## 3. Product Aliases (Customer-Specific Layer)
- New table: `product_aliases`
  - `id`
  - `product_id` → `products`
  - `customer_id` (nullable) → `customers`
  - `alias_name`
  - `customer_sku_code`
  - `customer_barcode` (optional)
  - `price_list_id` or explicit `unit_price_ex_vat`
  - `is_active`, `notes`
- Behaviors:
  - If customer matches an alias, show alias name/SKU/pricing instead of the base product.
  - If multiple aliases exist (e.g., channel-specific), apply the first matching by specificity: customer → price list → default.

### UI Plan
- Product page: new “Aliases” tab listing current aliases and an inline form to add/edit.
- Customer page: “Assigned products” section showing aliases for that customer, with quick-edit for their SKU/code.
- Order flow: when selecting a product for a customer, the alias is auto-resolved, and the line uses `customer_alias.customer_sku_code` and price override if defined.

This keeps logistics centered on nursery SKUs while giving sales/customer-specific branding and numbering. Next steps: add the `product_aliases` table + server actions, then the UI described above.

