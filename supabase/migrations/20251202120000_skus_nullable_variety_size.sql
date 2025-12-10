-- Allow SKUs without a fixed variety/size
ALTER TABLE public.skus
  ALTER COLUMN plant_variety_id DROP NOT NULL,
  ALTER COLUMN size_id DROP NOT NULL;



