-- Fix: Make starts_at nullable in ipm_assignments
-- Programs are templates that start relative to batch potting dates,
-- so assignments don't need a specific start date

ALTER TABLE public.ipm_assignments 
ALTER COLUMN starts_at DROP NOT NULL;

