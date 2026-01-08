# Product Alias Architecture

**Status**: ✅ COMPLETE

Nursery SKU → Product → Customer Alias

---

## Overview

This feature enables customer-specific product naming, pricing, and SKU codes while maintaining a single source of truth for internal operations.

**Implementation**: The `product_aliases` table exists and is integrated with the sales module.

---

## 1. Nursery SKUs (Internal) ✅

**Table**: `skus`

**Purpose**: Canonical internal identifier for stock

| Field | Description |
|-------|-------------|
| `code` | e.g., `SKU-0001` |
| `display_name` | Human-friendly label for ops |
| `barcode` | Scannable barcode |
| `default_vat_rate` | Default VAT percentage |
| `sku_type` | `Internal`, `Customer`, `Both` |

**Notes**:
- A SKU can back many products
- Variety/size references remain optional
- SKUs are general-purpose identifiers

---

## 2. Products (Shared Catalog) ✅

**Table**: `products`

**Relationship**: 1:1 with a SKU

**Purpose**: Adds sales copy and linked batches for internal sales UI and B2B portal

| Field | Description |
|-------|-------------|
| `name` | Product display name |
| `sku_id` | Link to SKU |
| `hero_image_url` | Main product image |
| `description` | Sales description |
| `default_status` | Default availability |
| `is_active` | Active/inactive flag |

---

## 3. Product Aliases (Customer-Specific Layer) ✅

**Table**: `product_aliases`

**Migration**: `20251202123500_product_aliases.sql`

| Field | Description |
|-------|-------------|
| `id` | Primary key |
| `product_id` | FK to `products` |
| `customer_id` | FK to `customers` (nullable) |
| `alias_name` | Customer-specific product name |
| `customer_sku_code` | Customer's SKU code |
| `customer_barcode` | Customer's barcode (optional) |
| `price_list_id` | Price list override |
| `unit_price_ex_vat` | Explicit price override |
| `is_active` | Active flag |
| `notes` | Additional notes |

### Resolution Behavior

When displaying products for a customer:

1. If customer matches an alias → show alias name/SKU/pricing
2. If multiple aliases exist → apply by specificity:
   - Customer-specific
   - Price list-specific
   - Default product

---

## 4. UI Implementation ✅

### Product Page
- Aliases tab listing current aliases
- Form to add/edit aliases
- Table showing: Customer, Alias Name, Customer SKU, Price

### Customer Page
- Assigned products section
- Quick-edit for customer SKU/code and pricing

### Order Flow
1. When selecting a product for a customer
2. Alias is auto-resolved
3. Line uses `customer_alias.customer_sku_code`
4. Price override applied if defined

---

## 5. Use Cases

### Garden Centre Chain
- Your product: "Lavandula angustifolia 'Hidcote' 2L"
- Their code: "LAV-HID-2L"
- Their name: "Lavender Hidcote 2 Litre"
- Their price: €4.50 (vs standard €5.00)

### Supermarket
- Your product: "Mixed Heather Tray x6"
- Their code: "7891234567890" (EAN barcode)
- Their name: "Garden Heather Collection"

---

## 6. Implementation Status

| Component | Status |
|-----------|--------|
| Database table | ✅ Complete |
| RLS policies | ✅ Complete |
| Server actions | ✅ Complete |
| Product UI | ✅ Complete |
| Customer UI | ✅ Complete |
| Order flow integration | ✅ Complete |
| B2B portal | ✅ Complete |

---

## Benefits Realized

- **Internal Operations**: Single source of truth with nursery SKUs
- **Sales Flexibility**: Customer-specific branding and codes
- **B2B Portal**: Customers see their familiar names
- **Invoicing**: Documents match customer expectations
- **Pricing**: Per-customer price overrides

---

**Last Updated**: January 2026
