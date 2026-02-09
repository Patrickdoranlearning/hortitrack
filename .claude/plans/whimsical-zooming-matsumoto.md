# Plan: Pre-Pricing (RRP) Feature Completion

## Problem Summary

The pre-pricing feature has all the structural pieces in place (DB tables, UI calculations, customer settings) but **fees are never persisted** when creating an order. They exist only as ephemeral UI state in `PricingReviewStep` and vanish on submit. Additionally, the RRP auto-fill priority chain is inverted (order history takes priority over explicit admin-set defaults).

## Current State (What Already Works)

- Customer-level settings: `requires_pre_pricing`, `pre_pricing_foc`, `pre_pricing_cost_per_label` on `customers` table
- Org-level fee config: `org_fees` table with `pre_pricing` fee type
- Order-level fee storage: `order_fees` table exists with proper schema (but is **never written to**)
- RRP on order items: `order_items.rrp` stored per line via RPC
- Pricing hints: `getPricingHints()` auto-populates RRP from order history + product aliases
- UI: Pre-pricing toggle per line, RRP input, fee calculation & display in Step 3
- CustomerSheet: Pricing tab allows setting per-product RRP via `product_aliases`

## Gaps to Fix

1. **Fee persistence** — fees calculated in UI never saved to `order_fees`
2. **Order totals don't include fees** — `recalc_order_totals` trigger only sums `order_items`
3. **No fees on order detail or invoices** — since nothing is persisted
4. **Wrong RRP priority** — order history beats explicit alias defaults (should be reversed)

---

## Implementation Steps

### Step 1: Migration — Update `recalc_order_totals` to Include Fees

The DB trigger `recalc_order_totals` currently only sums `order_items`. Any manual total adjustment gets wiped on the next trigger fire. Fix this at the source.

**New migration**: `supabase/migrations/YYYYMMDD_recalc_order_totals_with_fees.sql`

```sql
CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
declare
  s_items_ex numeric(12,2);
  s_items_vat numeric(12,2);
  s_fees_ex numeric(12,2);
  s_fees_vat numeric(12,2);
begin
  -- Sum order items
  select coalesce(sum(line_total_ex_vat),0), coalesce(sum(line_vat_amount),0)
    into s_items_ex, s_items_vat
  from order_items where order_id = _order_id;

  -- Sum order fees
  select coalesce(sum(subtotal),0), coalesce(sum(vat_amount),0)
    into s_fees_ex, s_fees_vat
  from order_fees where order_id = _order_id;

  update orders
     set subtotal_ex_vat = round(s_items_ex + s_fees_ex, 2),
         vat_amount      = round(s_items_vat + s_fees_vat, 2),
         total_inc_vat   = round(s_items_ex + s_items_vat + s_fees_ex + s_fees_vat, 2),
         updated_at      = now()
   where id = _order_id;
end $$;

-- Add trigger on order_fees to recalculate order totals
CREATE OR REPLACE FUNCTION public.trg_recalc_order_totals_from_fees()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  IF TG_OP = 'DELETE' THEN
    PERFORM recalc_order_totals(OLD.order_id);
    RETURN OLD;
  ELSE
    PERFORM recalc_order_totals(NEW.order_id);
    RETURN NEW;
  END IF;
end $$;

CREATE TRIGGER trg_order_fees_recalc_aiud
  AFTER INSERT OR UPDATE OR DELETE ON order_fees
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_order_totals_from_fees();
```

**Apply via**: `mcp__supabase__apply_migration`

---

### Step 2: Extend Form Schema with Fee Data

**File**: `src/lib/sales/types.ts`

Add `OrderFeeSchema` and include optional `fees` array in `CreateOrderSchema`:

```typescript
export const OrderFeeSchema = z.object({
  orgFeeId: z.string().uuid().optional(),
  feeType: z.string(),
  name: z.string(),
  quantity: z.number().int().nonnegative().default(1),
  unitAmount: z.number().nonnegative(),
  unit: z.string().default('flat'),
  vatRate: z.number().min(0).max(100).default(0),
  isFoc: z.boolean().optional().default(false),
});
export type OrderFeeInput = z.infer<typeof OrderFeeSchema>;

// Add to CreateOrderSchema:
fees: z.array(OrderFeeSchema).optional().default([]),
```

---

### Step 3: Surface Fee State from PricingReviewStep

**File**: `src/components/sales/wizard/steps/PricingReviewStep.tsx`

- Add `onFeesChange?: (fees: OrderFeeInput[]) => void` to Props
- Add `useEffect` watching `prePricingInfo` and `deliveryInfo` that constructs fee array and calls `onFeesChange`
- Fee array structure:
  - Pre-pricing: `{ orgFeeId, feeType: 'pre_pricing', name: 'Pre-pricing (RRP Labels)', quantity: totalUnits, unitAmount: ratePerUnit, unit: 'per_unit', vatRate, isFoc }`
  - Delivery: `{ orgFeeId, feeType: fee.feeType, name, quantity: 1, unitAmount: fee, unit: 'flat', vatRate }`

---

### Step 4: Wire Fee State in SalesOrderWizard

**File**: `src/components/sales/wizard/SalesOrderWizard.tsx`

- Add `const [orderFees, setOrderFees] = useState<OrderFeeInput[]>([])`
- Pass `onFeesChange={setOrderFees}` to `PricingReviewStep`
- In `onSubmit` handler (~line 467): add `expandedValues.fees = orderFees` before calling `createOrder()`

---

### Step 5: Persist Fees in `createOrder` Server Action

**File**: `src/app/sales/actions.ts`

After order creation succeeds (after line 221, where `orderId` is obtained), insert fee rows:

```typescript
// Persist order fees
const fees = result.data.fees || [];
if (fees.length > 0) {
  const feeInserts = fees.map(fee => {
    const subtotal = fee.isFoc ? 0 : fee.quantity * fee.unitAmount;
    const vatAmount = subtotal * (fee.vatRate / 100);
    return {
      order_id: orderId,
      org_fee_id: fee.orgFeeId || null,
      fee_type: fee.feeType,
      name: fee.name,
      quantity: fee.quantity,
      unit_amount: fee.isFoc ? 0 : fee.unitAmount,
      unit: fee.unit,
      subtotal: Math.round(subtotal * 100) / 100,
      vat_rate: fee.vatRate,
      vat_amount: Math.round(vatAmount * 100) / 100,
      total_amount: Math.round((subtotal + vatAmount) * 100) / 100,
    };
  });

  const { error: feeError } = await supabase.from('order_fees').insert(feeInserts);
  if (feeError) {
    logError('Failed to insert order fees', { error: feeError.message, orderId });
    // Non-fatal: order created, fees failed. The trigger will recalc totals.
  }
}
```

The `order_fees` trigger from Step 1 will automatically recalculate order totals to include fees.

---

### Step 6: Fix RRP Pricing Hints Priority

**File**: `src/app/sales/actions.ts` (lines 847-877)

Swap the lookup order in `getPricingHints`:

1. **First**: Query `product_aliases` for explicit admin-set RRP defaults (customer Pricing tab)
2. **Second**: Query `order_items` history for remaining products without alias RRP

Currently it's inverted. The fix is just reordering the two query blocks.

---

### Step 7: Display Fees on Order Detail Page

**File**: `src/app/sales/orders/[orderId]/page.tsx`

- After fetching order items, also fetch: `supabase.from('order_fees').select('*').eq('order_id', orderId)`
- Pass `orderFees` data to `OrderDetailPage` component

**File**: `src/components/sales/OrderDetailPage.tsx`

- Add `orderFees` to the component props/interface
- In the order totals section, render fee line items between Products subtotal and Grand Total
- FOC fees show as "FOC" badge

---

### Step 8: Display Fees on Invoice

**File**: `src/app/sales/orders/[orderId]/invoice/page.tsx`

- Fetch `order_fees` alongside invoice data
- Pass to `PrintableInvoiceClient`

**File**: `src/app/sales/orders/[orderId]/invoice/PrintableInvoiceClient.tsx`

- Add `fees` to the invoice data interface
- Render fee rows after product rows in the invoice table (slightly different bg for visual separation)
- Include fee VAT in the VAT summary breakdown

---

## Execution Order

```
Step 1 (migration) ─┐
Step 2 (types)    ──┤── Can run in parallel (no dependencies)
Step 6 (hints fix) ─┘
         │
Step 3 (PricingReviewStep) ── depends on Step 2 types
         │
Step 4 (Wizard wiring) ── depends on Step 3
         │
Step 5 (server action) ── depends on Steps 1, 2, 4
         │
Steps 7 + 8 (display) ── depends on Step 5 (data must be persisted first), can run in parallel
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/NEW.sql` | Update `recalc_order_totals`, add trigger on `order_fees` |
| `src/lib/sales/types.ts` | Add `OrderFeeSchema`, extend `CreateOrderSchema` |
| `src/components/sales/wizard/steps/PricingReviewStep.tsx` | Add `onFeesChange` callback |
| `src/components/sales/wizard/SalesOrderWizard.tsx` | Collect fee state, include in submit |
| `src/app/sales/actions.ts` | Persist fees in `createOrder`, fix `getPricingHints` priority |
| `src/app/sales/orders/[orderId]/page.tsx` | Fetch `order_fees` |
| `src/components/sales/OrderDetailPage.tsx` | Display fee lines |
| `src/app/sales/orders/[orderId]/invoice/page.tsx` | Fetch `order_fees` |
| `src/app/sales/orders/[orderId]/invoice/PrintableInvoiceClient.tsx` | Render fee rows on invoice |

## Verification

1. **Create an order with pre-pricing enabled** → Check `order_fees` table has a row
2. **Check order totals** → `orders.total_inc_vat` should include product + fee amounts
3. **View order detail** → Fee line should appear in summary
4. **View/print invoice** → Fee should appear as separate line
5. **Create order for FOC customer** → Fee row with `total_amount: 0` and FOC badge
6. **Set explicit RRP in customer Pricing tab** → Verify it takes priority over order history
7. **Edit order items after creation** → Verify trigger recalculates totals correctly (fees preserved)
