-- Remove unique constraint to allow multiple measurements per subject per week
-- This allows users to record multiple readings throughout a week

DROP INDEX IF EXISTS public.idx_trial_measurements_subject_week;

-- Keep the non-unique index for query performance
-- idx_trial_measurements_week already exists as a regular index
