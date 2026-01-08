-- B2B Customer Portal Authentication
-- Links user profiles to customers and enables sales rep impersonation

-- Add customer portal fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_role text DEFAULT 'internal'
    CHECK (portal_role IN ('internal', 'customer'));

CREATE INDEX IF NOT EXISTS profiles_customer_id_idx ON public.profiles(customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.customer_id IS 'Links customer portal users to their customer account';
COMMENT ON COLUMN public.profiles.portal_role IS 'Distinguishes between internal staff and customer portal users';

-- Customer impersonation sessions (for sales reps placing orders on behalf of customers)
CREATE TABLE IF NOT EXISTS public.customer_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_session_check CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX customer_impersonation_staff_idx ON public.customer_impersonation_sessions(staff_user_id);
CREATE INDEX customer_impersonation_customer_idx ON public.customer_impersonation_sessions(customer_id);
CREATE INDEX customer_impersonation_active_idx ON public.customer_impersonation_sessions(staff_user_id, ended_at)
  WHERE ended_at IS NULL;

COMMENT ON TABLE public.customer_impersonation_sessions IS 'Tracks when internal staff impersonate customers to place orders on their behalf';

-- Enable Row Level Security
ALTER TABLE public.customer_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer impersonation sessions
CREATE POLICY "Internal users can manage impersonation sessions"
  ON public.customer_impersonation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.portal_role = 'internal'
    )
  );

-- Update profiles RLS to allow customer portal users to view their own profile
CREATE POLICY "Customer portal users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    AND portal_role = 'customer'
  );
