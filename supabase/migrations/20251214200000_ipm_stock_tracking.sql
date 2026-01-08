-- IPM Stock Tracking Extension
-- Track individual bottles and stock movements for full traceability

-- ============================================================================
-- 1. Add stock tracking fields to ipm_products
-- ============================================================================
ALTER TABLE public.ipm_products
  ADD COLUMN IF NOT EXISTS target_stock_bottles int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS low_stock_threshold int DEFAULT 2,
  ADD COLUMN IF NOT EXISTS default_bottle_volume_ml int DEFAULT 1000;

-- ============================================================================
-- 2. IPM Product Bottles - Individual bottles with unique IDs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_product_bottles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ipm_products(id) ON DELETE CASCADE,
  bottle_code text NOT NULL,                    -- Unique scannable code (e.g., BTL-001-ABC123)
  volume_ml int NOT NULL,                       -- Original volume
  remaining_ml int NOT NULL,                    -- Current remaining volume
  batch_number text,                            -- Manufacturer batch number
  expiry_date date,                             -- Product expiry
  purchase_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'sealed' 
    CHECK (status IN ('sealed', 'open', 'empty', 'disposed', 'expired')),
  opened_at timestamptz,                        -- When first opened
  emptied_at timestamptz,                       -- When marked empty
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, bottle_code)
);

-- Indexes for ipm_product_bottles
CREATE INDEX IF NOT EXISTS idx_ipm_bottles_org ON public.ipm_product_bottles(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_bottles_product ON public.ipm_product_bottles(product_id);
CREATE INDEX IF NOT EXISTS idx_ipm_bottles_code ON public.ipm_product_bottles(org_id, bottle_code);
CREATE INDEX IF NOT EXISTS idx_ipm_bottles_status ON public.ipm_product_bottles(org_id, product_id, status);

-- RLS for ipm_product_bottles
ALTER TABLE public.ipm_product_bottles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org bottles" ON public.ipm_product_bottles;
CREATE POLICY "Users can view org bottles"
ON public.ipm_product_bottles FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org bottles" ON public.ipm_product_bottles;
CREATE POLICY "Users can manage org bottles"
ON public.ipm_product_bottles FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. IPM Stock Movements - Track all usage and replenishment
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ipm_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bottle_id uuid NOT NULL REFERENCES public.ipm_product_bottles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ipm_products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('open', 'usage', 'adjustment', 'disposal')),
  quantity_ml int NOT NULL,                     -- Positive for additions, negative for usage
  remaining_after_ml int NOT NULL,              -- Bottle remaining after this movement
  health_log_id uuid REFERENCES public.plant_health_logs(id), -- Links usage to treatment
  spot_treatment_id uuid REFERENCES public.ipm_spot_treatments(id),
  location_id uuid REFERENCES public.nursery_locations(id),
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ipm_stock_movements
CREATE INDEX IF NOT EXISTS idx_ipm_movements_org ON public.ipm_stock_movements(org_id);
CREATE INDEX IF NOT EXISTS idx_ipm_movements_bottle ON public.ipm_stock_movements(bottle_id);
CREATE INDEX IF NOT EXISTS idx_ipm_movements_product ON public.ipm_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_ipm_movements_date ON public.ipm_stock_movements(org_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ipm_movements_health_log ON public.ipm_stock_movements(health_log_id) WHERE health_log_id IS NOT NULL;

-- RLS for ipm_stock_movements
ALTER TABLE public.ipm_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org movements" ON public.ipm_stock_movements;
CREATE POLICY "Users can view org movements"
ON public.ipm_stock_movements FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage org movements" ON public.ipm_stock_movements;
CREATE POLICY "Users can manage org movements"
ON public.ipm_stock_movements FOR ALL
USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. Add bottle tracking to plant_health_logs
-- ============================================================================
ALTER TABLE public.plant_health_logs
  ADD COLUMN IF NOT EXISTS bottle_id uuid REFERENCES public.ipm_product_bottles(id),
  ADD COLUMN IF NOT EXISTS quantity_used_ml int;

CREATE INDEX IF NOT EXISTS idx_plant_health_logs_bottle ON public.plant_health_logs(bottle_id) WHERE bottle_id IS NOT NULL;

-- ============================================================================
-- 5. Trigger to update bottle remaining_ml on movement
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_bottle_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the bottle's remaining_ml
  UPDATE public.ipm_product_bottles
  SET 
    remaining_ml = NEW.remaining_after_ml,
    updated_at = now(),
    -- Auto-update status based on remaining
    status = CASE 
      WHEN NEW.remaining_after_ml <= 0 THEN 'empty'
      WHEN (SELECT status FROM public.ipm_product_bottles WHERE id = NEW.bottle_id) = 'sealed' 
           AND NEW.movement_type = 'open' THEN 'open'
      ELSE (SELECT status FROM public.ipm_product_bottles WHERE id = NEW.bottle_id)
    END,
    opened_at = CASE 
      WHEN NEW.movement_type = 'open' 
           AND (SELECT opened_at FROM public.ipm_product_bottles WHERE id = NEW.bottle_id) IS NULL 
      THEN now()
      ELSE (SELECT opened_at FROM public.ipm_product_bottles WHERE id = NEW.bottle_id)
    END,
    emptied_at = CASE 
      WHEN NEW.remaining_after_ml <= 0 
           AND (SELECT emptied_at FROM public.ipm_product_bottles WHERE id = NEW.bottle_id) IS NULL 
      THEN now()
      ELSE (SELECT emptied_at FROM public.ipm_product_bottles WHERE id = NEW.bottle_id)
    END
  WHERE id = NEW.bottle_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bottle_on_movement ON public.ipm_stock_movements;
CREATE TRIGGER trg_update_bottle_on_movement
AFTER INSERT ON public.ipm_stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_bottle_on_movement();

-- ============================================================================
-- 6. Function to generate unique bottle code
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_bottle_code(p_org_id uuid, p_product_id uuid)
RETURNS text AS $$
DECLARE
  v_product_name text;
  v_prefix text;
  v_count int;
  v_code text;
BEGIN
  -- Get product name for prefix
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), 3))
  INTO v_prefix
  FROM public.ipm_products
  WHERE id = p_product_id;
  
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'BTL';
  END IF;
  
  -- Count existing bottles for this product
  SELECT COUNT(*) + 1
  INTO v_count
  FROM public.ipm_product_bottles
  WHERE org_id = p_org_id AND product_id = p_product_id;
  
  -- Generate code: PREFIX-COUNT-RANDOM (e.g., NEM-001-A7X2)
  v_code := v_prefix || '-' || LPAD(v_count::text, 3, '0') || '-' || 
            UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4));
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. View for stock summary by product
-- ============================================================================
CREATE OR REPLACE VIEW public.v_ipm_stock_summary AS
SELECT 
  p.id as product_id,
  p.org_id,
  p.name as product_name,
  p.target_stock_bottles,
  p.low_stock_threshold,
  p.default_bottle_volume_ml,
  COUNT(b.id) FILTER (WHERE b.status IN ('sealed', 'open')) as bottles_in_stock,
  COUNT(b.id) FILTER (WHERE b.status = 'sealed') as bottles_sealed,
  COUNT(b.id) FILTER (WHERE b.status = 'open') as bottles_open,
  COALESCE(SUM(b.remaining_ml) FILTER (WHERE b.status IN ('sealed', 'open')), 0) as total_remaining_ml,
  COUNT(b.id) FILTER (WHERE b.status IN ('sealed', 'open')) < p.low_stock_threshold as is_low_stock,
  (
    SELECT COALESCE(SUM(ABS(m.quantity_ml)), 0)
    FROM public.ipm_stock_movements m
    WHERE m.product_id = p.id 
      AND m.movement_type = 'usage'
      AND m.recorded_at >= CURRENT_DATE - INTERVAL '30 days'
  ) as usage_last_30_days_ml
FROM public.ipm_products p
LEFT JOIN public.ipm_product_bottles b ON b.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.org_id, p.name, p.target_stock_bottles, p.low_stock_threshold, p.default_bottle_volume_ml;

COMMENT ON TABLE public.ipm_product_bottles IS 'Individual IPM product bottles with unique scannable codes for full traceability';
COMMENT ON TABLE public.ipm_stock_movements IS 'Track all stock movements - usage during treatments, adjustments, and disposals';
COMMENT ON VIEW public.v_ipm_stock_summary IS 'Aggregated stock summary by product showing current inventory and usage trends';

