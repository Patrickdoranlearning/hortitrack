-- Fix printers check constraints to include new connection types and printer types

-- Drop and recreate the connection_type check constraint to include 'agent'
ALTER TABLE public.printers DROP CONSTRAINT IF EXISTS printers_connection_type_check;
ALTER TABLE public.printers ADD CONSTRAINT printers_connection_type_check
  CHECK (connection_type = ANY (ARRAY['network'::text, 'usb'::text, 'bluetooth'::text, 'agent'::text]));

-- Drop and recreate the type check constraint to include 'toshiba'
ALTER TABLE public.printers DROP CONSTRAINT IF EXISTS printers_type_check;
ALTER TABLE public.printers ADD CONSTRAINT printers_type_check
  CHECK (type = ANY (ARRAY['zebra'::text, 'dymo'::text, 'brother'::text, 'toshiba'::text, 'generic'::text]));
