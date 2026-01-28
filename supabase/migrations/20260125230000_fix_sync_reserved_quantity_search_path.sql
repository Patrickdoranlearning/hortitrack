-- Fix search_path for sync_reserved_quantity trigger function
-- The function has empty search_path which prevents it from finding batches table

ALTER FUNCTION public.sync_reserved_quantity()
SET search_path = public;
