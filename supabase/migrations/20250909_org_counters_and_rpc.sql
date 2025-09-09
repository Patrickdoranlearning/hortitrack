-- 1) Counter table (idempotent)
CREATE TABLE IF NOT EXISTS public.org_counters (
  org_id uuid NOT NULL,
  key text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, key)
);

-- 2) Atomic increment function (transactional)
CREATE OR REPLACE FUNCTION public.increment_counter(p_org_id uuid, p_key text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE new_val bigint;
BEGIN
  -- Lock the row to avoid races
  UPDATE public.org_counters
     SET value = value + 1
   WHERE org_id = p_org_id AND key = p_key
   RETURNING value INTO new_val;

  IF NOT FOUND THEN
    -- Insert then increment (handles first use)
    INSERT INTO public.org_counters (org_id, key, value)
    VALUES (p_org_id, p_key, 1)
    ON CONFLICT (org_id, key)
    DO UPDATE SET value = public.org_counters.value + 1
    RETURNING value INTO new_val;
  END IF;

  RETURN new_val;
END;
$$;
