-- Add missing order_status enum values used by the application
-- The original enum had: draft, confirmed, processing, ready_for_dispatch, dispatched, delivered, cancelled
-- The application uses: picking, ready (shortcuts for processing and ready_for_dispatch)

-- Add 'picking' status (between confirmed and ready_for_dispatch)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'picking' AFTER 'confirmed';

-- Add 'ready' status (alias for ready_for_dispatch, for simpler workflow)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'picking';

-- Add 'void' status for cancelled/voided orders
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'void' AFTER 'cancelled';
