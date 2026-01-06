-- ================================================
-- PICKING WORKFLOW ENHANCEMENTS
-- ================================================
-- This migration adds fields to support the new picking workflow:
-- 1. Trolley type and shelves to order_packing table
-- 2. Bulk picking batch tables for group picking

-- ================================================
-- ORDER PACKING ENHANCEMENTS
-- ================================================

-- Add trolley_type column to order_packing
ALTER TABLE public.order_packing
ADD COLUMN IF NOT EXISTS trolley_type text DEFAULT 'tag6';

-- Add shelves column to order_packing
ALTER TABLE public.order_packing
ADD COLUMN IF NOT EXISTS shelves integer DEFAULT 0;

-- Add qc_notes column to order_packing for QC observations
ALTER TABLE public.order_packing
ADD COLUMN IF NOT EXISTS qc_notes text;

-- Add qc_checklist JSONB column to store QC checklist state
ALTER TABLE public.order_packing
ADD COLUMN IF NOT EXISTS qc_checklist jsonb;

-- Add trolley_numbers array to store specific trolley IDs
ALTER TABLE public.order_packing
ADD COLUMN IF NOT EXISTS trolley_numbers text[];

-- ================================================
-- BULK PICKING TABLES
-- ================================================

-- Create bulk_pick_batches table for grouping orders into bulk picks
CREATE TABLE IF NOT EXISTS public.bulk_pick_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  
  -- Identification
  batch_number text NOT NULL,
  batch_date date NOT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'picked', 'packing', 'completed', 'cancelled')),
  
  -- Timing
  started_at timestamp with time zone,
  started_by uuid,
  completed_at timestamp with time zone,
  completed_by uuid,
  
  -- Notes
  notes text,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT bulk_pick_batches_pkey PRIMARY KEY (id),
  CONSTRAINT bulk_pick_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT bulk_pick_batches_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.profiles(id),
  CONSTRAINT bulk_pick_batches_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id)
);

-- Create index for querying bulk pick batches
CREATE INDEX IF NOT EXISTS idx_bulk_pick_batches_org_status ON public.bulk_pick_batches(org_id, status);
CREATE INDEX IF NOT EXISTS idx_bulk_pick_batches_date ON public.bulk_pick_batches(org_id, batch_date);

-- Create bulk_pick_batch_orders junction table
CREATE TABLE IF NOT EXISTS public.bulk_pick_batch_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bulk_batch_id uuid NOT NULL,
  order_id uuid NOT NULL,
  pick_list_id uuid,
  
  -- Packing status (for when orders are broken down from bulk)
  packing_status text NOT NULL DEFAULT 'pending' CHECK (packing_status IN ('pending', 'in_progress', 'packed')),
  packed_at timestamp with time zone,
  packed_by uuid,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT bulk_pick_batch_orders_pkey PRIMARY KEY (id),
  CONSTRAINT bulk_pick_batch_orders_bulk_batch_fkey FOREIGN KEY (bulk_batch_id) REFERENCES public.bulk_pick_batches(id) ON DELETE CASCADE,
  CONSTRAINT bulk_pick_batch_orders_order_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT bulk_pick_batch_orders_pick_list_fkey FOREIGN KEY (pick_list_id) REFERENCES public.pick_lists(id),
  CONSTRAINT bulk_pick_batch_orders_unique UNIQUE (bulk_batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_bulk_pick_batch_orders_batch ON public.bulk_pick_batch_orders(bulk_batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_pick_batch_orders_order ON public.bulk_pick_batch_orders(order_id);

-- Create bulk_pick_items table for aggregated items in bulk picking
CREATE TABLE IF NOT EXISTS public.bulk_pick_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bulk_batch_id uuid NOT NULL,
  
  -- Item identification (aggregated across orders)
  sku_id uuid NOT NULL,
  
  -- Quantities
  total_qty integer NOT NULL DEFAULT 0,
  picked_qty integer NOT NULL DEFAULT 0,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'short', 'substituted')),
  
  -- Batch tracking
  picked_batch_id uuid,
  substitute_batch_id uuid,
  substitution_reason text,
  
  -- Location hint for picker
  location_hint text,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT bulk_pick_items_pkey PRIMARY KEY (id),
  CONSTRAINT bulk_pick_items_bulk_batch_fkey FOREIGN KEY (bulk_batch_id) REFERENCES public.bulk_pick_batches(id) ON DELETE CASCADE,
  CONSTRAINT bulk_pick_items_sku_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id),
  CONSTRAINT bulk_pick_items_unique_sku UNIQUE (bulk_batch_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_bulk_pick_items_batch ON public.bulk_pick_items(bulk_batch_id, status);

-- ================================================
-- RLS POLICIES
-- ================================================

-- Enable RLS on new tables
ALTER TABLE public.bulk_pick_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_pick_batch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_pick_items ENABLE ROW LEVEL SECURITY;

-- Policies for bulk_pick_batches
CREATE POLICY "Users can view bulk pick batches in their org"
  ON public.bulk_pick_batches FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can create bulk pick batches in their org"
  ON public.bulk_pick_batches FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update bulk pick batches in their org"
  ON public.bulk_pick_batches FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete bulk pick batches in their org"
  ON public.bulk_pick_batches FOR DELETE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- Policies for bulk_pick_batch_orders
CREATE POLICY "Users can view bulk pick batch orders in their org"
  ON public.bulk_pick_batch_orders FOR SELECT
  TO authenticated
  USING (bulk_batch_id IN (
    SELECT id FROM public.bulk_pick_batches 
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can manage bulk pick batch orders in their org"
  ON public.bulk_pick_batch_orders FOR ALL
  TO authenticated
  USING (bulk_batch_id IN (
    SELECT id FROM public.bulk_pick_batches 
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  ));

-- Policies for bulk_pick_items
CREATE POLICY "Users can view bulk pick items in their org"
  ON public.bulk_pick_items FOR SELECT
  TO authenticated
  USING (bulk_batch_id IN (
    SELECT id FROM public.bulk_pick_batches 
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can manage bulk pick items in their org"
  ON public.bulk_pick_items FOR ALL
  TO authenticated
  USING (bulk_batch_id IN (
    SELECT id FROM public.bulk_pick_batches 
    WHERE org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid())
  ));

-- Grant service role full access
GRANT ALL ON public.bulk_pick_batches TO service_role;
GRANT ALL ON public.bulk_pick_batch_orders TO service_role;
GRANT ALL ON public.bulk_pick_items TO service_role;

-- ================================================
-- TRIGGER FOR UPDATED_AT
-- ================================================

CREATE OR REPLACE FUNCTION update_bulk_pick_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bulk_pick_batches_updated_at
  BEFORE UPDATE ON public.bulk_pick_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_pick_batches_updated_at();

CREATE OR REPLACE FUNCTION update_bulk_pick_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bulk_pick_items_updated_at
  BEFORE UPDATE ON public.bulk_pick_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_pick_items_updated_at();







