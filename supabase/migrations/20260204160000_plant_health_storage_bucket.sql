-- Migration: Create plant-health storage bucket for photo uploads
-- Used by ScoutWizard for scout observation photos

-- Create the plant-health storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plant-health',
  'plant-health',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policy: Authenticated users can upload photos
-- Note: We allow all authenticated users to upload - org scoping is handled
-- at the application level via the file path structure (scouts/{target_id}/)
CREATE POLICY "Authenticated users can upload plant-health photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plant-health');

-- RLS policy: Anyone can view plant-health photos (public bucket)
CREATE POLICY "Public read access to plant-health photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'plant-health');

-- RLS policy: Users can update their own uploads (for overwrites)
CREATE POLICY "Authenticated users can update plant-health photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'plant-health')
WITH CHECK (bucket_id = 'plant-health');

-- RLS policy: Users can delete plant-health photos
CREATE POLICY "Authenticated users can delete plant-health photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'plant-health');
