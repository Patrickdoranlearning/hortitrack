# Sales Module – Picking, Substitutions & Audit Trail

This note stitches the new database entities to the day-to-day workflow for sales + dispatch.

## 1. Picking Flow
- Pick lists pull order items that are in `picking` status and show the **linked product + suggested batches** (`product_batches`).
- When a picker confirms a batch, we store the allocation (future table) and append an `order_events` record:
  - `event_type = 'batch_confirmed'`
  - `metadata = { batch_id, quantity }`
- If the picker uses a different batch (manual substitution), they can still confirm it as long as it belongs to the same product. We log:
  - `event_type = 'batch_substituted'`
  - `metadata = { from_batch_id, to_batch_id, reason }`

## 2. Handling Stock Issues
- When **no linked batch** is saleable for a product, the picker records an exception instead of substituting ad‑hoc.
- Insert into `order_exceptions`:
  - `exception_type = 'product_unavailable'`
  - `status = 'open'`
  - `order_item_id` referencing the offending line.
  - Optional `metadata` holds context (scanner code, notes, photos).
- UI cues:
  - Orders with any open exceptions show a red badge and are blocked from moving past `ready_for_dispatch`.
  - Dispatch manager can review the exception (swap product, edit qty, cancel line) and then mark it resolved, which:
    - Sets `status = 'resolved'`, `resolved_by`, `resolved_at`.
    - Adds `order_events` entry `event_type = 'exception_resolved'`.

## 3. Invoice / Traceability
- Every “interesting” moment adds an `order_events` row so we have a single audit log:
  - Creation (`order_created`)
  - Picking updates
  - Exceptions raised/resolved
  - Invoice / credit generation
- Because batches are linked to products through `product_batches`, we can re-create which batch fulfilled each line by combining:
  - `order_items.product_id`
  - Allocations (future table) tying batches to the same line.
- Credit notes referencing a line can point back to the exception or substitution event via `order_events` metadata.

## 4. Management Rules Summary
1. **Batch substitution** – Picker decides, logs reason, order continues.
2. **Product unavailable** – Picker cannot decide; raises exception → dispatch manager resolution required.
3. **Dispatch gate** – `ready_for_dispatch` transition only allowed when `order_exceptions.status = 'resolved'` for all rows.

These rules ensure pickers stay fast while managers retain oversight and the system captures a tamper-proof audit trail for every divergence from the original order.



