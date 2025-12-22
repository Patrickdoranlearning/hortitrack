-- Delete old delivery run DR-20251208-006 from Dec 8
-- This run is outdated and should be cleaned up

DELETE FROM delivery_runs
WHERE run_date < '2024-12-10'::date
   OR (load_name IS NOT NULL AND load_name LIKE '%20251208%');
