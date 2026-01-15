-- Fix compute_quantity_produced to accept text instead of enum
-- since container_type column was converted from enum to text

-- Drop the old function with enum parameter
DROP FUNCTION IF EXISTS public.compute_quantity_produced(integer, size_container_type, integer);

-- Create new function with text parameter
CREATE OR REPLACE FUNCTION public.compute_quantity_produced(
  _initial integer,
  _container text,
  _cell_multiple integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
begin
  if _initial is null then
    return null;
  end if;

  if _container in ('prop_tray','plug_tray') then
    return greatest(0, _initial * coalesce(_cell_multiple,1));
  else
    return greatest(0, _initial);
  end if;
end $function$;
