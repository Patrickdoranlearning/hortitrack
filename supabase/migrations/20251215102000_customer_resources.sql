-- Customer Resources Library
-- Documents, videos, and other resources shared with B2B customers

CREATE TABLE IF NOT EXISTS public.customer_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL
    CHECK (resource_type IN ('pdf', 'document', 'spreadsheet', 'image', 'video', 'link')),
  file_url text,
  storage_path text,
  file_size_bytes bigint,
  mime_type text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_resources_org_idx ON public.customer_resources(org_id);
CREATE INDEX customer_resources_category_idx ON public.customer_resources(category) WHERE category IS NOT NULL;
CREATE INDEX customer_resources_active_idx ON public.customer_resources(is_active, org_id)
  WHERE is_active = true;

COMMENT ON TABLE public.customer_resources IS 'Shared resources (documents, videos, guides) for B2B customers';
COMMENT ON COLUMN public.customer_resources.category IS 'Resource category: care_guides, catalogs, price_lists, marketing, etc.';

-- Enable Row Level Security
ALTER TABLE public.customer_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customer portal users can view active resources
CREATE POLICY "Customer portal users can view active resources"
  ON public.customer_resources
  FOR SELECT
  USING (
    is_active = true
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.portal_role = 'customer'
          AND profiles.active_org_id = customer_resources.org_id
      )
      OR
      -- Allow impersonating staff to view resources
      EXISTS (
        SELECT 1 FROM public.customer_impersonation_sessions cis
        JOIN public.customers c ON c.id = cis.customer_id
        WHERE cis.staff_user_id = auth.uid()
          AND cis.ended_at IS NULL
          AND c.org_id = customer_resources.org_id
      )
    )
  );

-- RLS Policy: Internal users can manage resources
CREATE POLICY "Internal users can manage resources"
  ON public.customer_resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.portal_role = 'internal'
        AND profiles.active_org_id = customer_resources.org_id
    )
  );
