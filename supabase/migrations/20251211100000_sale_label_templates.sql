-- Migration: Add sale label templates
-- Creates the label_templates table if not exists and seeds default sale label templates

-- Create label_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  label_type TEXT NOT NULL DEFAULT 'batch',
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  margin_mm NUMERIC NOT NULL DEFAULT 3,
  dpi INTEGER NOT NULL DEFAULT 203,
  zpl_template TEXT,
  layout JSONB DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for org_id and label_type lookups
CREATE INDEX IF NOT EXISTS idx_label_templates_org_type ON label_templates(org_id, label_type);

-- Enable RLS
ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for label_templates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'label_templates' AND policyname = 'label_templates_select_policy'
  ) THEN
    CREATE POLICY label_templates_select_policy ON label_templates
      FOR SELECT
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'label_templates' AND policyname = 'label_templates_insert_policy'
  ) THEN
    CREATE POLICY label_templates_insert_policy ON label_templates
      FOR INSERT
      WITH CHECK (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'label_templates' AND policyname = 'label_templates_update_policy'
  ) THEN
    CREATE POLICY label_templates_update_policy ON label_templates
      FOR UPDATE
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'label_templates' AND policyname = 'label_templates_delete_policy'
  ) THEN
    CREATE POLICY label_templates_delete_policy ON label_templates
      FOR DELETE
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Function to seed default sale label templates for an organization
CREATE OR REPLACE FUNCTION seed_sale_label_templates(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Only insert if no sale templates exist for this org
  IF NOT EXISTS (
    SELECT 1 FROM label_templates 
    WHERE org_id = p_org_id AND label_type = 'sale'
  ) THEN
    -- Small Square (40x40mm)
    INSERT INTO label_templates (
      org_id, name, description, label_type, width_mm, height_mm, margin_mm, dpi, is_default, layout
    ) VALUES (
      p_org_id,
      'Small Square (40x40mm)',
      'Compact price label with barcode, item name, and price',
      'sale',
      40,
      40,
      2,
      203,
      false,
      '{"showSize": false, "showLot": false, "showFooter": false, "barcodeHeight": 40, "titleFontSize": 24, "priceFontSize": 32}'::jsonb
    );

    -- Standard (70x50mm) - set as default
    INSERT INTO label_templates (
      org_id, name, description, label_type, width_mm, height_mm, margin_mm, dpi, is_default, layout
    ) VALUES (
      p_org_id,
      'Standard (70x50mm)',
      'Full price label with barcode, item name, size, price, and optional lot number',
      'sale',
      70,
      50,
      3,
      203,
      true,
      '{"showSize": true, "showLot": true, "showFooter": true, "barcodeHeight": 50, "titleFontSize": 28, "priceFontSize": 36}'::jsonb
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Seed sale label templates for all existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_sale_label_templates(org_record.id);
  END LOOP;
END $$;

-- Comment for documentation
COMMENT ON TABLE label_templates IS 'Stores label templates for various label types (batch, sale, location, etc.)';
COMMENT ON COLUMN label_templates.label_type IS 'Type of label: batch, sale, location';
COMMENT ON COLUMN label_templates.layout IS 'JSON configuration for label layout options';



