-- Create product_varieties junction table for many-to-many relationship
-- between products and plant_varieties

CREATE TABLE IF NOT EXISTS product_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variety_id uuid NOT NULL REFERENCES plant_varieties(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  -- Prevent duplicate product-variety links
  UNIQUE(product_id, variety_id)
);

-- Enable RLS
ALTER TABLE product_varieties ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view product varieties in their org"
  ON product_varieties FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert product varieties in their org"
  ON product_varieties FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update product varieties in their org"
  ON product_varieties FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete product varieties in their org"
  ON product_varieties FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX idx_product_varieties_org_id ON product_varieties(org_id);
CREATE INDEX idx_product_varieties_product_id ON product_varieties(product_id);
CREATE INDEX idx_product_varieties_variety_id ON product_varieties(variety_id);
