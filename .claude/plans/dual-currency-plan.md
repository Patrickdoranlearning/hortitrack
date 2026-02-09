# Dual Currency Plan (EUR / GBP)

**Date**: 2026-02-07
**Status**: COMPLETE
**Scope**: Enable GBP customers to see £ prices throughout the system

---

## Current State

### What Already Exists (Good News)
- `customers.currency` — char(3), default `'EUR'`, already stores `'EUR'` or `'GBP'`
- `price_lists.currency` — char(3), default `'EUR'`, supports per-list currency
- `product_prices.currency` — char(3), stored per product/price_list combo
- `SalesOrderDocSchema.currency` — Zod schema has field, defaults to `"EUR"`
- `invoices` table — has a `currency` column
- Customer form schema — already has `z.enum(['EUR', 'GBP'])`
- Country options — already maps GB/XI → GBP, IE/NL → EUR

### What's Broken (The Problem)
1. **`orders` table has NO `currency` column** — order-level currency is never persisted
2. **56 files hardcode `€`** — no dynamic currency formatting anywhere
3. **No `formatCurrency()` utility** — every component does `€${value.toFixed(2)}` inline
4. **Order wizard ignores customer currency** — loads it but displays EUR regardless
5. **Price list → customer currency not validated** — GBP customer could get EUR price list
6. **Fees hardcoded to EUR** — pre-pricing and delivery fees show `€` always
7. **Invoices display hardcoded `€`** — despite having a currency column in DB

---

## Implementation Plan

### Phase 1: Foundation (No UI changes yet)

#### 1.1 — Create `formatCurrency()` utility
**File**: `src/lib/format-currency.ts` (new)

```typescript
export type CurrencyCode = 'EUR' | 'GBP';

const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; locale: string }> = {
  EUR: { symbol: '€', locale: 'en-IE' },
  GBP: { symbol: '£', locale: 'en-GB' },
};

/** Format a number as currency string: €12.50 or £12.50 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'EUR'): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.EUR;
  return `${config.symbol}${amount.toFixed(2)}`;
}

/** Get the currency symbol only */
export function currencySymbol(currency: CurrencyCode = 'EUR'): string {
  return CURRENCY_CONFIG[currency]?.symbol ?? '€';
}
```

Why simple string formatting instead of `Intl.NumberFormat`? Because the existing codebase uses `€${x.toFixed(2)}` everywhere — matching this pattern keeps diffs minimal and avoids locale quirks (comma vs dot decimals). Can upgrade to Intl later if needed.

#### 1.2 — Add `currency` column to `orders` table
**Migration**: `add_currency_to_orders`

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'EUR';

-- Backfill existing orders from their customer's currency
UPDATE public.orders o
SET currency = COALESCE(c.currency, 'EUR')
FROM public.customers c
WHERE o.customer_id = c.id;
```

#### 1.3 — Add `currency` to `CreateOrderSchema`
**File**: `src/lib/sales/types.ts`

Add `currency` field to `CreateOrderSchema` so it flows through order creation:
```typescript
currency: z.enum(['EUR', 'GBP']).default('EUR'),
```

Update the server action that creates orders to persist `currency`.

---

### Phase 2: Sales Order Wizard (Critical Path)

This is where GBP customers place orders — highest priority.

#### 2.1 — Pass `currency` through wizard props
The wizard already receives customer data. Thread `currency` from customer selection through to:
- `PricingReviewStep` — needs currency for all price display
- `SalesProductAccordionRow` — unit price display
- `ProductSelectionStep` — price column in product picker

#### 2.2 — Update `PricingReviewStep.tsx`
Replace all `€${...}` with `formatCurrency(amount, currency)`:
- Line totals, unit prices, RRP values
- Pre-pricing fee display
- Delivery fee display
- Grand totals (net, VAT, total inc VAT)
- Multibuy savings display

#### 2.3 — Update `SalesProductAccordionRow.tsx`
- Unit price display
- RRP input label
- Multibuy price display

#### 2.4 — Update `ProductSelectionStep.tsx`
- Price column in product list

---

### Phase 3: Order Detail & Invoice Display

#### 3.1 — Update `OrderDetailPage.tsx`
- Read `order.currency` from the order record
- Pass to all price display sections

#### 3.2 — Update `OrderSummaryCard.tsx`
- Accept `currency` prop
- Replace `€` with `formatCurrency()` for:
  - Subtotal, VAT, total
  - Fee amounts
  - Unit amounts

#### 3.3 — Update `OrderItemsTable.tsx`
- Unit price and line total columns

#### 3.4 — Update `PrintableInvoiceClient.tsx`
- All price display in printed invoice
- Read currency from invoice record

#### 3.5 — Update `InvoiceDetailDialog.tsx`
- Amounts in invoice modal

#### 3.6 — Update `InvoiceCard.tsx` / `OrderInvoicePanel.tsx`
- Invoice list items

---

### Phase 4: Remaining Components (Broader Sweep)

#### 4.1 — Order list views
- `SalesOrdersClient.tsx` — order total in list
- `OrderCard.tsx` — order card total

#### 4.2 — Customer views
- `CustomerSheet.tsx` — product price display
- Customer detail page — order history totals

#### 4.3 — B2B portal (customer-facing)
- `B2BProductCard.tsx`, `B2BProductAccordionCard.tsx` — product prices
- `B2BCartSidebar.tsx`, `B2BCartLineItem.tsx` — cart totals
- `B2BCheckoutReview.tsx`, `B2BCheckoutPricing.tsx`, `B2BCheckoutCart.tsx` — checkout
- `B2BOrdersClient.tsx`, `B2BOrderDetailClient.tsx` — order history
- `B2BInvoicesClient.tsx` — invoice list
- `B2BDashboardClient.tsx` — dashboard metrics

#### 4.4 — Other operational views
- `CreditNoteWizard.tsx` / `CreditNoteDialog.tsx`
- `PickItemCard.tsx` / `SaleLabelPrintWizard.tsx`
- `DispatchDocumentsClient.tsx` / `OrderReadyCard.tsx`
- `CopyOrderDialog.tsx`
- `CreateOrderForm.tsx` / `EnhancedCreateOrderForm.tsx`
- `LoadDetailClient.tsx`

#### 4.5 — Dashboard / Analytics
- `SalesMetricCard.tsx` / `SalesMetrics.tsx`
- `WeeklySalesChart.tsx` / `TopProductsChart.tsx`
- `SalesAdminInbox.tsx`
- `SmartTargetCard.tsx` / `TargetList.tsx`

#### 4.6 — Settings / Config
- `FeeSettingsClient.tsx` — fee amount display
- `price-lists/page.tsx` — price list display

#### 4.7 — Server-side / API
- `src/app/sales/settings/fees/actions.ts` — fee display
- `src/app/sales/orders/[orderId]/actions.ts` — order detail
- `src/app/api/sales/orders/[orderId]/labels/print/route.ts` — label printing
- `src/app/api/sales/invoices/[invoiceId]/send-email/route.ts` — email template
- `src/server/labels/build-sale-label.ts` — label generation

---

### Phase 5: Validation & Guards

#### 5.1 — Price list currency validation
When assigning a price list to a customer, validate that currencies match. A GBP customer should not be assigned an EUR price list.

#### 5.2 — Order creation: auto-set currency from customer
In the `createOrder` server action, automatically set `order.currency` from the customer's currency field.

#### 5.3 — Product price lookup: filter by currency
When loading product prices for the order wizard, prefer prices from price lists matching the customer's currency. Fall back to default price list if no currency-matched list exists.

---

## Decisions (Confirmed by User)

1. **Fees**: Multi-currency — pre-pricing and delivery fees can have different amounts per currency. Add `currency` column to `org_fees` table. Separate fee records per currency.
2. **B2B Portal**: Include in this pass — full coverage.
3. **Dashboard totals**: Single currency display (org default currency).

## What This Plan Does NOT Cover (Out of Scope)

- **Currency conversion / exchange rates** — Not needed. GBP customers have GBP price lists with GBP prices. No EUR→GBP conversion at order time.
- **Multi-currency reporting** — Dashboard totals show in org's default currency. Cross-currency aggregation is a future concern.

---

## Approach: How to Execute

Phase 1 first (foundation + DB), then Phase 2 (wizard), then Phase 3 (orders/invoices), then Phase 4 (B2B + remaining), then Phase 5 (guards).

**Estimated file changes**: ~60 files (56 with hardcoded €, plus new utility + migration + type changes)

**Risk**: Low. Primarily display-layer changes. Database already supports dual currency.
