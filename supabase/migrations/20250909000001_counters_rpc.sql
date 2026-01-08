CREATE OR REPLACE FUNCTION public.increment_counter(p_org_id uuid, p_key text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE new_val bigint;
BEGIN
  -- lock the row to avoid races
  UPDATE public.org_counters
     SET value = value + 1
   WHERE org_id = p_org_id AND key = p_key
   RETURNING value INTO new_val;

  IF NOT FOUND THEN
    -- safety: insert then try again (shouldn't happen with upsert preceding)
    INSERT INTO public.org_counters (org_id, key, value)
    VALUES (p_org_id, p_key, 1)
    ON CONFLICT (org_id, key) DO UPDATE SET value = public.org_counters.value + 1
    RETURNING value INTO new_val;
  END IF;

  RETURN new_val;
END;
$$;
