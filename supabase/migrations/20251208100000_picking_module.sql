-- ================================================
-- PICKING MODULE MIGRATION
-- ================================================
-- This migration creates tables for:
-- 1. Picking Teams - Groups of pickers
-- 2. Pick Lists - Order picking assignments
-- 3. Pick Items - Individual line items to pick
-- ================================================

-- ================================================
-- ENUMS FOR PICKING MODULE
-- ================================================

-- Pick list status
CREATE TYPE pick_list_status AS ENUM (
  'pending',      -- Assigned but not started
  'in_progress',  -- Picker is working on it
  'completed',    -- All items picked
  'cancelled'     -- Pick list cancelled
);

-- Pick item status
CREATE TYPE pick_item_status AS ENUM (
  'pending',      -- Not yet picked
  'picked',       -- Successfully picked
  'short',        -- Could not fulfill full quantity
  'substituted',  -- Picked with a different batch
  'skipped'       -- Skipped (e.g., out of stock)
);

-- ================================================
-- PICKING TEAMS
-- ================================================
-- Teams of pickers that can be assigned orders

CREATE TABLE public.picking_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT picking_teams_pkey PRIMARY KEY (id),
  CONSTRAINT picking_teams_org_id_fkey FOREIGN KEY (org_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT picking_teams_unique_name UNIQUE (org_id, name)
);

CREATE INDEX idx_picking_teams_org ON public.picking_teams(org_id) WHERE is_active = true;

-- ================================================
-- PICKING TEAM MEMBERS
-- ================================================
-- Links users to picking teams

CREATE TABLE public.picking_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT picking_team_members_pkey PRIMARY KEY (id),
  CONSTRAINT picking_team_members_team_id_fkey FOREIGN KEY (team_id) 
    REFERENCES public.picking_teams(id) ON DELETE CASCADE,
  CONSTRAINT picking_team_members_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT picking_team_members_unique UNIQUE (team_id, user_id)
);

CREATE INDEX idx_picking_team_members_user ON public.picking_team_members(user_id);
CREATE INDEX idx_picking_team_members_team ON public.picking_team_members(team_id);

-- ================================================
-- PICK LISTS
-- ================================================
-- Master pick list for an order - one per order

CREATE TABLE public.pick_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  order_id uuid NOT NULL,
  
  -- Assignment
  assigned_team_id uuid,
  sequence integer NOT NULL DEFAULT 0,  -- Lower = higher priority
  
  -- Status tracking
  status pick_list_status NOT NULL DEFAULT 'pending',
  
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Who worked on it
  started_by uuid,
  completed_by uuid,
  
  -- Notes
  notes text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pick_lists_pkey PRIMARY KEY (id),
  CONSTRAINT pick_lists_org_id_fkey FOREIGN KEY (org_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT pick_lists_order_id_fkey FOREIGN KEY (order_id) 
    REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT pick_lists_team_id_fkey FOREIGN KEY (assigned_team_id) 
    REFERENCES public.picking_teams(id) ON DELETE SET NULL,
  CONSTRAINT pick_lists_started_by_fkey FOREIGN KEY (started_by) 
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pick_lists_completed_by_fkey FOREIGN KEY (completed_by) 
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pick_lists_unique_order UNIQUE (order_id)
);

CREATE INDEX idx_pick_lists_org_status ON public.pick_lists(org_id, status);
CREATE INDEX idx_pick_lists_team_status ON public.pick_lists(assigned_team_id, status) 
  WHERE assigned_team_id IS NOT NULL;
CREATE INDEX idx_pick_lists_sequence ON public.pick_lists(org_id, assigned_team_id, sequence) 
  WHERE status IN ('pending', 'in_progress');

-- ================================================
-- PICK ITEMS
-- ================================================
-- Individual line items to pick from a pick list

CREATE TABLE public.pick_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pick_list_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  
  -- Quantities
  target_qty integer NOT NULL CHECK (target_qty > 0),
  picked_qty integer NOT NULL DEFAULT 0 CHECK (picked_qty >= 0),
  
  -- Status
  status pick_item_status NOT NULL DEFAULT 'pending',
  
  -- Batch tracking
  original_batch_id uuid,     -- Initially allocated batch
  picked_batch_id uuid,       -- Actually picked batch (may differ)
  
  -- Substitution info
  substitution_reason text,   -- Why batch was changed
  
  -- Notes and metadata
  notes text,
  picked_at timestamptz,
  picked_by uuid,
  
  -- Location hint for picker
  location_hint text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pick_items_pkey PRIMARY KEY (id),
  CONSTRAINT pick_items_pick_list_id_fkey FOREIGN KEY (pick_list_id) 
    REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  CONSTRAINT pick_items_order_item_id_fkey FOREIGN KEY (order_item_id) 
    REFERENCES public.order_items(id) ON DELETE CASCADE,
  CONSTRAINT pick_items_original_batch_fkey FOREIGN KEY (original_batch_id) 
    REFERENCES public.batches(id) ON DELETE SET NULL,
  CONSTRAINT pick_items_picked_batch_fkey FOREIGN KEY (picked_batch_id) 
    REFERENCES public.batches(id) ON DELETE SET NULL,
  CONSTRAINT pick_items_picked_by_fkey FOREIGN KEY (picked_by) 
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pick_items_unique_order_item UNIQUE (pick_list_id, order_item_id)
);

CREATE INDEX idx_pick_items_pick_list ON public.pick_items(pick_list_id);
CREATE INDEX idx_pick_items_status ON public.pick_items(pick_list_id, status);
CREATE INDEX idx_pick_items_batch ON public.pick_items(picked_batch_id) WHERE picked_batch_id IS NOT NULL;

-- ================================================
-- PICK LIST EVENTS (Audit Trail)
-- ================================================
-- Track all changes to pick lists and items

CREATE TABLE public.pick_list_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  pick_list_id uuid NOT NULL,
  pick_item_id uuid,
  
  event_type text NOT NULL,  -- 'started', 'item_picked', 'item_substituted', 'completed', etc.
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pick_list_events_pkey PRIMARY KEY (id),
  CONSTRAINT pick_list_events_org_id_fkey FOREIGN KEY (org_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT pick_list_events_pick_list_id_fkey FOREIGN KEY (pick_list_id) 
    REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  CONSTRAINT pick_list_events_pick_item_id_fkey FOREIGN KEY (pick_item_id) 
    REFERENCES public.pick_items(id) ON DELETE SET NULL
);

CREATE INDEX idx_pick_list_events_pick_list ON public.pick_list_events(pick_list_id, created_at DESC);

-- ================================================
-- TRIGGERS
-- ================================================

-- Update updated_at timestamp
CREATE TRIGGER update_picking_teams_updated_at 
  BEFORE UPDATE ON public.picking_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pick_lists_updated_at 
  BEFORE UPDATE ON public.pick_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pick_items_updated_at 
  BEFORE UPDATE ON public.pick_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE public.picking_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_list_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users (refine per org later)
CREATE POLICY "Allow all access for authenticated users" ON public.picking_teams
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.picking_team_members
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.pick_lists
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.pick_items
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.pick_list_events
  FOR ALL USING (auth.role() = 'authenticated');

-- ================================================
-- HELPFUL VIEWS
-- ================================================

-- View: Pick lists with order and team info
CREATE VIEW v_pick_lists_detail AS
SELECT
  pl.id,
  pl.org_id,
  pl.order_id,
  pl.assigned_team_id,
  pl.sequence,
  pl.status,
  pl.started_at,
  pl.completed_at,
  pl.notes,
  pl.created_at,
  o.order_number,
  o.status as order_status,
  o.requested_delivery_date,
  c.name as customer_name,
  pt.name as team_name,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_items,
  (SELECT COUNT(*) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id AND pi.status = 'picked') as picked_items,
  (SELECT SUM(pi.target_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as total_qty,
  (SELECT SUM(pi.picked_qty) FROM public.pick_items pi WHERE pi.pick_list_id = pl.id) as picked_qty
FROM public.pick_lists pl
LEFT JOIN public.orders o ON o.id = pl.order_id
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN public.picking_teams pt ON pt.id = pl.assigned_team_id;

-- View: Team workload summary
CREATE VIEW v_picking_team_workload AS
SELECT
  pt.id as team_id,
  pt.org_id,
  pt.name as team_name,
  COUNT(CASE WHEN pl.status = 'pending' THEN 1 END) as pending_picks,
  COUNT(CASE WHEN pl.status = 'in_progress' THEN 1 END) as in_progress_picks,
  COUNT(CASE WHEN pl.status = 'completed' AND pl.completed_at > now() - interval '24 hours' THEN 1 END) as completed_today,
  (SELECT COUNT(*) FROM public.picking_team_members ptm WHERE ptm.team_id = pt.id) as member_count
FROM public.picking_teams pt
LEFT JOIN public.pick_lists pl ON pl.assigned_team_id = pt.id
WHERE pt.is_active = true
GROUP BY pt.id, pt.org_id, pt.name;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.picking_teams IS 'Teams of pickers that can be assigned orders';
COMMENT ON TABLE public.picking_team_members IS 'Links users to picking teams';
COMMENT ON TABLE public.pick_lists IS 'Master pick list for an order - one pick list per order';
COMMENT ON TABLE public.pick_items IS 'Individual line items to pick from a pick list';
COMMENT ON TABLE public.pick_list_events IS 'Audit trail for pick list and item changes';




