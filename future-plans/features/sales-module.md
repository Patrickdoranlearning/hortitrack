# Sales Module Data & Workflow Plan

**Status**: ✅ COMPLETE

This document captures the structural components of the sales module.

---

## 1. Invoice Numbering ✅

**Implementation**: Complete

- Dedicated `invoice_number_seq` sequence seeded at **200000**
- `invoices.invoice_number` defaults to `nextval('invoice_number_seq')::text`
- Server actions read generated number from insert response (no client-side numbering)

---

## 2. Product/SKU/Batches Architecture ✅

**Implementation**: Complete

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `skus` | Canonical internal SKU | `plant_variety_id`, `size_id`, VAT rate |
| `products` | Merchandised sales listing | FK `sku_id`, `name`, `description`, `hero_image_url`, `is_active` |
| `product_batches` | Links batches to products | FKs `product_id`, `batch_id`, `available_quantity_override` |

### Key Principles
- A **product owns exactly one SKU**
- All downstream references (order items, price rows) point to `product_id`
- Join to SKU when stock metadata is needed

---

## 3. Pricing Architecture ✅

**Implementation**: Complete

| Table | Purpose |
|-------|---------|
| `price_lists` | Org-level price groups (default + specials) |
| `product_prices` | `product_id`, `price_list_id`, `unit_price_ex_vat`, `currency`, `valid_from/valid_to`, `min_qty` |
| `price_list_customers` | Optional override mapping customers to specific price lists |

### Price Resolution Order
1. Explicit mapping in `price_list_customers` (if active)
2. Customer's `default_price_list_id`
3. Org default price list (`price_lists.is_default = true`)

---

## 4. Order Events & Exceptions ✅

**Implementation**: Complete (tables exist in migrations)

### Order Events
Table `order_events` logs lifecycle milestones:
- Status changes
- Substitutions
- Invoices generated

### Order Exceptions
Table `order_exceptions` captures fulfillment blockers:

| Field | Description |
|-------|-------------|
| `type` | e.g., `'product_unavailable'` |
| `status` | `'open'` \| `'resolved'` |
| `raised_by` | User who raised |
| `resolved_by` | User who resolved |
| `notes` | Details |

### Workflow
- Picking UI can freely substitute **batches**
- When a **product** allocation fails, picker records an exception
- Orders with open exceptions cannot transition to `ready_for_dispatch`
- Dispatch manager must resolve exceptions first

---

## 5. Order Status Flow ✅

```
draft → confirmed → processing → ready_for_dispatch → dispatched → delivered
                                        ↓
                                   cancelled
```

---

## 6. Customer Data Model ✅

**Implementation**: Complete

### Core Customer Table
```sql
customers
├── id, org_id
├── code (customer reference)
├── name
├── email, phone
├── vat_number
├── default_price_list_id
├── notes
```

### Related Tables
- `customer_addresses` - Shipping and billing addresses
- `customer_contacts` - Contact persons with roles
- `customer_delivery_preferences` - Delivery preferences

---

## 7. Invoice Data Model ✅

**Implementation**: Complete

```sql
invoices
├── id, org_id
├── invoice_number (auto-generated)
├── customer_id
├── order_id (optional)
├── status (draft, issued, paid, void, overdue)
├── currency
├── issue_date, due_date
├── subtotal_ex_vat, vat_amount, total_inc_vat
├── amount_credited, balance_due
```

---

## Implementation Checklist

- [x] Invoice numbering sequence
- [x] Products table with SKU link
- [x] Product batches linking
- [x] Price lists and product prices
- [x] Customer price list mapping
- [x] Order events logging
- [x] Order exceptions table
- [x] Invoice PDF generation (B2B portal)

---

## Future Enhancements

These are potential future improvements, not blockers:

- [ ] Sales analytics dashboard
- [ ] Customer purchase history timeline view
- [ ] Credit note workflow improvements
- [ ] Payment recording and tracking
- [ ] Aging report (30/60/90 days overdue)

---

**Last Updated**: January 2026
