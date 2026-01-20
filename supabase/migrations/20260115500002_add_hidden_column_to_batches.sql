-- Add the hidden column to batches table
-- This column is referenced by existing functions but was never added

ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Add index for filtering visible batches
CREATE INDEX IF NOT EXISTS idx_batches_hidden ON public.batches (hidden) WHERE hidden = true;

-- Comment explaining the column
COMMENT ON COLUMN public.batches.hidden IS 'When true, batch is hidden from sales views and availability calculations';
