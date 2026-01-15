-- Fix historical batch_allocations that weren't updated when items were picked
-- This updates allocations to 'picked' status where the corresponding pick_item
-- has already been marked as picked/substituted

-- Update batch_allocations status from 'allocated' to 'picked' for already-picked items
UPDATE batch_allocations ba
SET
  status = 'picked',
  updated_at = COALESCE(pi.picked_at, NOW())
FROM pick_items pi
JOIN order_items oi ON oi.id = pi.order_item_id
WHERE ba.order_item_id = oi.id
  AND ba.status = 'allocated'
  AND pi.status IN ('picked', 'substituted');

-- Also handle cases where the pick_item picked_batch_id matches the allocation batch_id
-- This is a more precise match when substitutions occurred
UPDATE batch_allocations ba
SET
  status = 'picked',
  updated_at = COALESCE(pi.picked_at, NOW())
FROM pick_items pi
WHERE ba.order_item_id = pi.order_item_id
  AND ba.batch_id = pi.picked_batch_id
  AND ba.status = 'allocated'
  AND pi.status IN ('picked', 'substituted')
  AND pi.picked_qty > 0;

-- Log this migration for audit purposes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % batch_allocations status to picked', updated_count;
END $$;
