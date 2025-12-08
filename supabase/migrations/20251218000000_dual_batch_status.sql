-- Migration: Add dual batch status (growing_status + sales_status)
-- This enables tracking plant health separately from sales availability

-- 1. Add growing_status column (text-based, references attribute_options)
ALTER TABLE public.batches 
ADD COLUMN IF NOT EXISTS growing_status text DEFAULT 'healthy';

-- 2. Add sales_status column (text-based, references attribute_options)  
ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS sales_status text DEFAULT 'not_available';

-- 3. Create indexes for filtering
CREATE INDEX IF NOT EXISTS batches_growing_status_idx ON public.batches(growing_status);
CREATE INDEX IF NOT EXISTS batches_sales_status_idx ON public.batches(sales_status);

-- 4. Seed default growing_status attribute options for each org
INSERT INTO public.attribute_options (org_id, attribute_key, system_code, display_label, sort_order)
SELECT 
    o.id,
    'growing_status',
    gs.code,
    gs.label,
    gs.sort_order
FROM public.organizations o
CROSS JOIN (VALUES 
    ('healthy', 'Healthy', 1),
    ('struggling', 'Struggling', 2),
    ('excellent', 'Excellent', 3),
    ('looking_good', 'Looking Good', 4),
    ('damaged', 'Damaged', 5),
    ('dead', 'Dead', 6)
) AS gs(code, label, sort_order)
ON CONFLICT (org_id, attribute_key, system_code) DO NOTHING;

-- 5. Seed default sales_status attribute options for each org
INSERT INTO public.attribute_options (org_id, attribute_key, system_code, display_label, sort_order)
SELECT 
    o.id,
    'sales_status',
    ss.code,
    ss.label,
    ss.sort_order
FROM public.organizations o
CROSS JOIN (VALUES 
    ('not_available', 'Not Available', 1),
    ('available', 'Available for Sale', 2),
    ('reserved', 'Reserved', 3),
    ('allocated', 'Allocated to Order', 4),
    ('sold', 'Sold', 5)
) AS ss(code, label, sort_order)
ON CONFLICT (org_id, attribute_key, system_code) DO NOTHING;

-- 6. Migrate existing status to sales_status where applicable
-- Batches with status containing "sale" or "ready" become "available"
UPDATE public.batches 
SET sales_status = 'available'
WHERE lower(status) LIKE '%sale%' 
   OR lower(status) LIKE '%ready%'
   OR lower(status) = 'looking good';

-- Batches that are sold/dispatched
UPDATE public.batches 
SET sales_status = 'sold'
WHERE lower(status) = 'sold'
   OR lower(status) = 'dispatched';

-- 7. Set growing_status based on existing status hints
UPDATE public.batches 
SET growing_status = 'looking_good'
WHERE lower(status) = 'looking good';

UPDATE public.batches 
SET growing_status = 'excellent'
WHERE lower(status) LIKE '%excellent%';

-- 8. Add comments for documentation
COMMENT ON COLUMN public.batches.growing_status IS 'Plant health status: healthy, struggling, excellent, looking_good, damaged, dead';
COMMENT ON COLUMN public.batches.sales_status IS 'Sales availability: not_available, available, reserved, allocated, sold';

-- 9. Create a view for easy querying of batch availability
CREATE OR REPLACE VIEW public.v_available_batches AS
SELECT 
    b.*,
    pv.name as variety_name,
    ps.name as size_name,
    nl.name as location_name
FROM public.batches b
LEFT JOIN public.plant_varieties pv ON b.plant_variety_id = pv.id
LEFT JOIN public.plant_sizes ps ON b.size_id = ps.id
LEFT JOIN public.nursery_locations nl ON b.location_id = nl.id
WHERE b.sales_status = 'available'
  AND b.quantity > 0
  AND b.archived_at IS NULL;

-- Grant access to the view
GRANT SELECT ON public.v_available_batches TO authenticated;

