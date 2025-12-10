-- Improve dispatch board filtering by status and requested delivery date
CREATE INDEX IF NOT EXISTS idx_orders_org_status_request_date
  ON public.orders (org_id, status, requested_delivery_date);

COMMENT ON INDEX idx_orders_org_status_request_date IS
  'Supports dispatch board queries filtered by org, status, and delivery date window.';
