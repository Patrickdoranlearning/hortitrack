-- Organization fee configuration table
CREATE TABLE IF NOT EXISTS org_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  fee_type TEXT NOT NULL, -- 'pre_pricing', 'delivery_flat', 'delivery_per_km', etc.
  name TEXT NOT NULL, -- Display name like "Pre-pricing Fee", "Standard Delivery"
  description TEXT, -- Optional description
  amount DECIMAL(10,4) NOT NULL, -- Amount in currency (euros)
  unit TEXT NOT NULL DEFAULT 'flat', -- 'per_unit', 'flat', 'per_km', 'percentage'
  vat_rate DECIMAL(5,2) DEFAULT 0, -- VAT rate applicable to this fee
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Auto-apply this fee to new orders
  min_order_value DECIMAL(10,2), -- Minimum order value to apply (for free delivery thresholds)
  max_amount DECIMAL(10,2), -- Cap for percentage-based fees
  metadata JSONB DEFAULT '{}', -- For additional config
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT org_fees_org_id_fee_type_key UNIQUE(org_id, fee_type)
);

-- Order fees - tracks fees applied to each order
CREATE TABLE IF NOT EXISTS order_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  org_fee_id UUID REFERENCES org_fees(id) ON DELETE SET NULL, -- Link to fee config (nullable for historical)
  fee_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity INT DEFAULT 1, -- e.g., number of pre-priced units
  unit_amount DECIMAL(10,4) NOT NULL, -- Amount per unit
  unit TEXT NOT NULL DEFAULT 'flat',
  subtotal DECIMAL(10,4) NOT NULL, -- quantity * unit_amount
  vat_rate DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(10,4) DEFAULT 0,
  total_amount DECIMAL(10,4) NOT NULL, -- subtotal + vat_amount
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_org_fees_org_id ON org_fees(org_id);
CREATE INDEX IF NOT EXISTS idx_org_fees_fee_type ON org_fees(org_id, fee_type);
CREATE INDEX IF NOT EXISTS idx_order_fees_order_id ON order_fees(order_id);

-- Enable RLS
ALTER TABLE org_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies for org_fees
DROP POLICY IF EXISTS "Users can view org fees for their org" ON org_fees;
CREATE POLICY "Users can view org fees for their org" ON org_fees
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage org fees for their org" ON org_fees;
CREATE POLICY "Users can manage org fees for their org" ON org_fees
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

-- RLS policies for order_fees
DROP POLICY IF EXISTS "Users can view order fees for their org orders" ON order_fees;
CREATE POLICY "Users can view order fees for their org orders" ON order_fees
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage order fees for their org orders" ON order_fees;
CREATE POLICY "Users can manage order fees for their org orders" ON order_fees
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders WHERE org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      )
    )
  );

