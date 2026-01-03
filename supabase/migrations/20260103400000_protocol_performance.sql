-- Protocol Performance Tracking
-- Captures actual vs planned metrics when batches using a protocol are completed

CREATE TABLE IF NOT EXISTS public.protocol_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  protocol_id uuid NOT NULL REFERENCES public.protocols(id),
  batch_id uuid NOT NULL REFERENCES public.batches(id),
  
  -- Planned metrics (from protocol)
  planned_duration_days integer,
  planned_ready_week integer,
  planned_yield_pct numeric DEFAULT 100,
  
  -- Actual metrics (calculated on completion)
  actual_duration_days integer,
  actual_ready_week integer,
  actual_yield_pct numeric,
  
  -- Quantities
  initial_quantity integer,
  final_quantity integer,
  
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate entries
  CONSTRAINT protocol_performance_batch_unique UNIQUE (batch_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS protocol_performance_org_id_idx 
  ON public.protocol_performance(org_id);
CREATE INDEX IF NOT EXISTS protocol_performance_protocol_id_idx 
  ON public.protocol_performance(protocol_id);
CREATE INDEX IF NOT EXISTS protocol_performance_completed_at_idx 
  ON public.protocol_performance(completed_at DESC);

-- Enable RLS
ALTER TABLE public.protocol_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can view and manage performance data for their org
DROP POLICY IF EXISTS "Users can view org protocol performance" ON public.protocol_performance;
CREATE POLICY "Users can view org protocol performance"
ON public.protocol_performance
FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage org protocol performance" ON public.protocol_performance;
CREATE POLICY "Users can manage org protocol performance"
ON public.protocol_performance
FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  )
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocol_performance TO authenticated;

-- Comment
COMMENT ON TABLE public.protocol_performance IS 'Tracks actual vs planned performance metrics for batches using production protocols';

