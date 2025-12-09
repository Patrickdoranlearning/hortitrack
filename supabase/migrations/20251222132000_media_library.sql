-- Polymorphic media storage for Smart Gallery (batch -> variety -> product)

-- Media library (files)
CREATE TABLE IF NOT EXISTS public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  file_path text NOT NULL,
  storage_path text,
  media_type text DEFAULT 'image',
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now()
);

-- Polymorphic attachments to entities
CREATE TABLE IF NOT EXISTS public.media_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  media_id uuid NOT NULL REFERENCES public.media_library(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('batch', 'variety', 'product')),
  entity_id uuid NOT NULL,
  display_order int DEFAULT 0,
  caption text,
  badge_type text,
  is_hero boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_attachments_entity
  ON public.media_attachments(entity_type, entity_id, display_order);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for media_library
CREATE POLICY "Users can view media in their org"
  ON public.media_library FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert media in their org"
  ON public.media_library FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update media in their org"
  ON public.media_library FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete media in their org"
  ON public.media_library FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- RLS policies for media_attachments
CREATE POLICY "Users can view attachments in their org"
  ON public.media_attachments FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert attachments in their org"
  ON public.media_attachments FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can update attachments in their org"
  ON public.media_attachments FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete attachments in their org"
  ON public.media_attachments FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()));

-- Grant permissions
GRANT ALL ON public.media_library TO authenticated;
GRANT ALL ON public.media_attachments TO authenticated;
GRANT ALL ON public.media_library TO service_role;
GRANT ALL ON public.media_attachments TO service_role;
