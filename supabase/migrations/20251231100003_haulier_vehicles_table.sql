-- Create haulier_vehicles table for managing fleet vehicles
-- Each vehicle belongs to a haulier and has configurable dimensions/capacity

CREATE TABLE IF NOT EXISTS public.haulier_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  haulier_id uuid NOT NULL REFERENCES public.hauliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  registration text,
  vehicle_type text DEFAULT 'van' CHECK (vehicle_type IN ('van', 'truck', 'trailer', 'other')),
  trolley_capacity integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  -- Truck layout configuration for visual loading interface
  truck_layout jsonb DEFAULT '{"type": "van", "rows": 2, "columns": 5, "trolleySlots": 10}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT haulier_vehicles_pkey PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_haulier_vehicles_org_id ON public.haulier_vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_haulier_vehicles_haulier_id ON public.haulier_vehicles(haulier_id);

-- Enable RLS
ALTER TABLE public.haulier_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view vehicles in their org" ON public.haulier_vehicles
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vehicles in their org" ON public.haulier_vehicles
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update vehicles in their org" ON public.haulier_vehicles
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vehicles in their org" ON public.haulier_vehicles
  FOR DELETE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_memberships om WHERE om.user_id = auth.uid()
    )
  );

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.haulier_vehicles TO authenticated;

-- Add comment
COMMENT ON TABLE public.haulier_vehicles IS 'Fleet vehicles belonging to hauliers with configurable dimensions and loading layouts';
COMMENT ON COLUMN public.haulier_vehicles.truck_layout IS 'JSON configuration for visual truck loading: { type, rows, columns, trolleySlots }';
