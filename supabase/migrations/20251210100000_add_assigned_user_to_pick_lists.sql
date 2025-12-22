-- ================================================
-- ADD ASSIGNED_USER_ID TO PICK_LISTS
-- ================================================
-- Allows assigning individual pickers (growers) to orders
-- instead of or in addition to teams

ALTER TABLE public.pick_lists 
ADD COLUMN assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_pick_lists_assigned_user 
  ON public.pick_lists(assigned_user_id) 
  WHERE assigned_user_id IS NOT NULL;

COMMENT ON COLUMN public.pick_lists.assigned_user_id IS 'Individual user (picker/grower) assigned to pick this order';




