-- Materials Management Module
-- Tracks materials (pots, trays, soil, labels, chemicals), stock levels, and purchase orders

-------------------------------------------------------------------------------
-- 1. MATERIAL CATEGORIES (shared - no org_id, like plant_varieties/plant_sizes)
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_group text NOT NULL,
  consumption_type text NOT NULL DEFAULT 'per_unit' CHECK (consumption_type IN ('per_unit', 'proportional', 'fixed')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_categories IS 'Categories for materials (shared across orgs)';
COMMENT ON COLUMN public.material_categories.consumption_type IS 'per_unit=1 per plant, proportional=rate*qty, fixed=constant amount';

-- Seed categories
INSERT INTO public.material_categories (code, name, parent_group, consumption_type, sort_order) VALUES
  ('POT', 'Pots', 'Containers', 'per_unit', 1),
  ('TRY', 'Trays', 'Containers', 'per_unit', 2),
  ('MKT', 'Marketing Trays', 'Containers', 'per_unit', 3),
  ('SOI', 'Soil', 'Growing Media', 'proportional', 10),
  ('PER', 'Perlite', 'Growing Media', 'proportional', 11),
  ('VER', 'Vermiculite', 'Growing Media', 'proportional', 12),
  ('LBL', 'Labels', 'Labels/Tags', 'per_unit', 20),
  ('TAG', 'Tags', 'Labels/Tags', 'per_unit', 21),
  ('FRT', 'Fertilizers', 'Chemicals', 'proportional', 30),
  ('PST', 'Pesticides', 'Chemicals', 'proportional', 31),
  ('BIO', 'Biologicals', 'Chemicals', 'proportional', 32)
ON CONFLICT (code) DO NOTHING;

-------------------------------------------------------------------------------
-- 2. MATERIALS TABLE (org-scoped)
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  part_number text NOT NULL,
  name text NOT NULL,
  description text,
  category_id uuid NOT NULL REFERENCES public.material_categories(id),

  -- Size linking for automatic pot/tray selection during actualization
  linked_size_id uuid REFERENCES public.plant_sizes(id),

  -- Unit of measure
  base_uom text NOT NULL DEFAULT 'each',

  -- Default supplier
  default_supplier_id uuid REFERENCES public.suppliers(id),

  -- Stock management thresholds
  reorder_point int DEFAULT 0,
  reorder_quantity int,
  target_stock int,

  -- Pricing
  standard_cost numeric(10,4),

  -- Barcodes
  barcode text,
  internal_barcode text,

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT materials_part_number_org_unique UNIQUE (org_id, part_number)
);

COMMENT ON TABLE public.materials IS 'Materials catalog (pots, trays, soil, labels, chemicals)';
COMMENT ON COLUMN public.materials.part_number IS 'Format: M-{CATEGORY}-{SEQ}, e.g., M-POT-001';
COMMENT ON COLUMN public.materials.linked_size_id IS 'Links to plant_sizes for auto-selection during batch actualization';
COMMENT ON COLUMN public.materials.internal_barcode IS 'Generated Data Matrix code for scanning';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_materials_org ON public.materials(org_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_linked_size ON public.materials(linked_size_id) WHERE linked_size_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_materials_barcode ON public.materials(org_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_materials_internal_barcode ON public.materials(org_id, internal_barcode) WHERE internal_barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(org_id, is_active);

-- RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_materials ON public.materials;
CREATE POLICY tenant_isolation_materials ON public.materials
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-------------------------------------------------------------------------------
-- 3. MATERIAL STOCK TABLE (org-scoped)
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.nursery_locations(id),

  quantity_on_hand numeric(12,3) NOT NULL DEFAULT 0,
  quantity_reserved numeric(12,3) NOT NULL DEFAULT 0,
  quantity_available numeric(12,3) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,

  last_counted_at timestamptz,
  last_movement_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_stock IS 'Current stock levels by material and location';
COMMENT ON COLUMN public.material_stock.location_id IS 'NULL = general/unassigned stock';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_stock_org ON public.material_stock(org_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_material ON public.material_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_location ON public.material_stock(location_id) WHERE location_id IS NOT NULL;
-- Unique index for material stock (COALESCE needed for NULL location handling)
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_stock_unique
  ON public.material_stock(org_id, material_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- RLS
ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_material_stock ON public.material_stock;
CREATE POLICY tenant_isolation_material_stock ON public.material_stock
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-------------------------------------------------------------------------------
-- 4. MATERIAL TRANSACTION TYPE ENUM
-------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_transaction_type') THEN
    CREATE TYPE material_transaction_type AS ENUM (
      'receive',
      'consume',
      'adjust',
      'transfer',
      'count',
      'return',
      'scrap'
    );
  END IF;
END$$;

-------------------------------------------------------------------------------
-- 5. MATERIAL TRANSACTIONS TABLE (audit log)
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.material_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  transaction_type material_transaction_type NOT NULL,

  quantity numeric(12,3) NOT NULL,
  uom text NOT NULL DEFAULT 'each',

  -- Location tracking
  from_location_id uuid REFERENCES public.nursery_locations(id),
  to_location_id uuid REFERENCES public.nursery_locations(id),

  -- Source references
  purchase_order_line_id uuid,
  batch_id uuid REFERENCES public.batches(id),

  -- Running balance
  quantity_after numeric(12,3),

  -- Metadata
  reference text,
  notes text,
  cost_per_unit numeric(10,4),

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_transactions IS 'Audit log of all stock movements';
COMMENT ON COLUMN public.material_transactions.quantity IS 'Positive=in, Negative=out';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_txn_org ON public.material_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_material_txn_material ON public.material_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_material_txn_batch ON public.material_transactions(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_material_txn_date ON public.material_transactions(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_material_txn_type ON public.material_transactions(org_id, transaction_type);

-- RLS
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_material_txn ON public.material_transactions;
CREATE POLICY tenant_isolation_material_txn ON public.material_transactions
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-------------------------------------------------------------------------------
-- 6. PURCHASE ORDER STATUS ENUM
-------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
    CREATE TYPE purchase_order_status AS ENUM (
      'draft',
      'submitted',
      'confirmed',
      'partially_received',
      'received',
      'cancelled'
    );
  END IF;
END$$;

-------------------------------------------------------------------------------
-- 7. PURCHASE ORDERS TABLE
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),

  status purchase_order_status NOT NULL DEFAULT 'draft',

  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date date,

  -- Totals
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,

  -- Delivery
  delivery_location_id uuid REFERENCES public.nursery_locations(id),
  delivery_notes text,

  -- Reference
  supplier_ref text,
  notes text,

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  received_at timestamptz,

  CONSTRAINT purchase_orders_number_unique UNIQUE (org_id, po_number)
);

COMMENT ON TABLE public.purchase_orders IS 'Purchase orders for materials';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_org ON public.purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(org_id, status);

-- RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_po ON public.purchase_orders;
CREATE POLICY tenant_isolation_po ON public.purchase_orders
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-------------------------------------------------------------------------------
-- 8. PURCHASE ORDER LINES TABLE
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),

  line_number int NOT NULL,

  quantity_ordered numeric(12,3) NOT NULL,
  quantity_received numeric(12,3) NOT NULL DEFAULT 0,
  uom text NOT NULL DEFAULT 'each',

  unit_price numeric(10,4) NOT NULL,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL,

  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT po_lines_unique_line UNIQUE (purchase_order_id, line_number)
);

COMMENT ON TABLE public.purchase_order_lines IS 'Line items on purchase orders';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_material ON public.purchase_order_lines(material_id);

-- RLS (inherited through purchase_orders)
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_po_lines ON public.purchase_order_lines;
CREATE POLICY tenant_isolation_po_lines ON public.purchase_order_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND public.user_in_org(po.org_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po
            WHERE po.id = purchase_order_lines.purchase_order_id
            AND public.user_in_org(po.org_id))
  );

-- Add FK for purchase_order_line_id now that table exists
ALTER TABLE public.material_transactions
  DROP CONSTRAINT IF EXISTS material_transactions_purchase_order_line_id_fkey;
ALTER TABLE public.material_transactions
  ADD CONSTRAINT material_transactions_purchase_order_line_id_fkey
  FOREIGN KEY (purchase_order_line_id) REFERENCES public.purchase_order_lines(id);

-------------------------------------------------------------------------------
-- 9. MATERIAL CONSUMPTION RULES TABLE
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.material_consumption_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.plant_sizes(id),

  quantity_per_unit numeric(10,4) NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT consumption_rules_unique UNIQUE (org_id, material_id, size_id)
);

COMMENT ON TABLE public.material_consumption_rules IS 'Defines how much material to consume per plant for a given size';
COMMENT ON COLUMN public.material_consumption_rules.quantity_per_unit IS 'e.g., 0.5 = 0.5L soil per plant';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consumption_rules_org ON public.material_consumption_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_consumption_rules_material ON public.material_consumption_rules(material_id);
CREATE INDEX IF NOT EXISTS idx_consumption_rules_size ON public.material_consumption_rules(size_id);

-- RLS
ALTER TABLE public.material_consumption_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_consumption_rules ON public.material_consumption_rules;
CREATE POLICY tenant_isolation_consumption_rules ON public.material_consumption_rules
  FOR ALL USING (public.user_in_org(org_id))
  WITH CHECK (public.user_in_org(org_id));

-------------------------------------------------------------------------------
-- 10. TRIGGER: Update stock on transaction
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_material_stock_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_location_id uuid;
  v_current_qty numeric(12,3);
BEGIN
  -- For receives and transfers TO, use to_location_id
  -- For consumes, adjusts, etc., use from_location_id
  IF NEW.transaction_type IN ('receive', 'count') THEN
    v_location_id := NEW.to_location_id;
  ELSIF NEW.transaction_type = 'transfer' THEN
    -- Handle both sides of transfer
    -- First, reduce from source
    IF NEW.from_location_id IS NOT NULL THEN
      INSERT INTO public.material_stock (org_id, material_id, location_id, quantity_on_hand, last_movement_at)
      VALUES (NEW.org_id, NEW.material_id, NEW.from_location_id, -ABS(NEW.quantity), now())
      ON CONFLICT (org_id, material_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET
        quantity_on_hand = material_stock.quantity_on_hand - ABS(NEW.quantity),
        last_movement_at = now(),
        updated_at = now();
    END IF;

    -- Then add to destination
    IF NEW.to_location_id IS NOT NULL THEN
      INSERT INTO public.material_stock (org_id, material_id, location_id, quantity_on_hand, last_movement_at)
      VALUES (NEW.org_id, NEW.material_id, NEW.to_location_id, ABS(NEW.quantity), now())
      ON CONFLICT (org_id, material_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET
        quantity_on_hand = material_stock.quantity_on_hand + ABS(NEW.quantity),
        last_movement_at = now(),
        updated_at = now();
    END IF;

    RETURN NEW;
  ELSE
    v_location_id := NEW.from_location_id;
  END IF;

  -- Upsert stock record (quantity is already signed appropriately)
  INSERT INTO public.material_stock (org_id, material_id, location_id, quantity_on_hand, last_movement_at)
  VALUES (NEW.org_id, NEW.material_id, v_location_id, NEW.quantity, now())
  ON CONFLICT (org_id, material_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    quantity_on_hand = material_stock.quantity_on_hand + NEW.quantity,
    last_movement_at = now(),
    updated_at = now();

  -- Update quantity_after on the transaction
  SELECT quantity_on_hand INTO v_current_qty
  FROM public.material_stock
  WHERE org_id = NEW.org_id
    AND material_id = NEW.material_id
    AND COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_location_id, '00000000-0000-0000-0000-000000000000'::uuid);

  NEW.quantity_after := v_current_qty;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_stock_update ON public.material_transactions;
CREATE TRIGGER trg_material_stock_update
BEFORE INSERT ON public.material_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_material_stock_on_transaction();

-------------------------------------------------------------------------------
-- 11. TRIGGER: Update timestamps
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_materials_updated_at ON public.materials;
CREATE TRIGGER trg_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.update_materials_updated_at();

DROP TRIGGER IF EXISTS trg_material_stock_updated_at ON public.material_stock;
CREATE TRIGGER trg_material_stock_updated_at
BEFORE UPDATE ON public.material_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_materials_updated_at();

DROP TRIGGER IF EXISTS trg_po_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_po_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_materials_updated_at();

DROP TRIGGER IF EXISTS trg_po_lines_updated_at ON public.purchase_order_lines;
CREATE TRIGGER trg_po_lines_updated_at
BEFORE UPDATE ON public.purchase_order_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_materials_updated_at();

DROP TRIGGER IF EXISTS trg_consumption_rules_updated_at ON public.material_consumption_rules;
CREATE TRIGGER trg_consumption_rules_updated_at
BEFORE UPDATE ON public.material_consumption_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_materials_updated_at();

-------------------------------------------------------------------------------
-- 12. GRANTS
-------------------------------------------------------------------------------

GRANT SELECT ON public.material_categories TO authenticated;
GRANT ALL ON public.materials TO authenticated;
GRANT ALL ON public.material_stock TO authenticated;
GRANT ALL ON public.material_transactions TO authenticated;
GRANT ALL ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_order_lines TO authenticated;
GRANT ALL ON public.material_consumption_rules TO authenticated;
