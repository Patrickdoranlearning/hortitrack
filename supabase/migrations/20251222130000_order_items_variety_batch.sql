-- Add variety and batch constraints to order_items for allocation validation

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS required_variety_id uuid REFERENCES public.plant_varieties(id),
  ADD COLUMN IF NOT EXISTS required_batch_id uuid REFERENCES public.batches(id);

COMMENT ON COLUMN public.order_items.required_variety_id IS
  'If set, only batches of this variety can fulfill this line (NULL = any variety).';

COMMENT ON COLUMN public.order_items.required_batch_id IS
  'If set, only this specific batch can fulfill this line (NULL = any matching batch).';




