-- Document templates with versioning for the Document Designer

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  current_version_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  layout JSONB NOT NULL DEFAULT '[]',
  variables JSONB NOT NULL DEFAULT '{}', -- key/value defaults
  bindings JSONB NOT NULL DEFAULT '{}', -- optional bindings metadata/validation
  sample_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Connect template.current_version_id to versions
ALTER TABLE document_templates
  ADD CONSTRAINT document_templates_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES document_template_versions(id)
  ON DELETE SET NULL;

-- Uniqueness and lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_template_version_unique
  ON document_template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_doc_templates_org
  ON document_templates(org_id, document_type, status);
CREATE INDEX IF NOT EXISTS idx_doc_template_versions_template
  ON document_template_versions(template_id);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_document_templates()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_document_templates ON document_templates;
CREATE TRIGGER trg_touch_document_templates
  BEFORE UPDATE ON document_templates
  FOR EACH ROW
  EXECUTE FUNCTION touch_document_templates();

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_template_versions ENABLE ROW LEVEL SECURITY;

-- Policies for document_templates (org scoped)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'document_templates_select'
  ) THEN
    CREATE POLICY document_templates_select ON document_templates
      FOR SELECT
      USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'document_templates_insert'
  ) THEN
    CREATE POLICY document_templates_insert ON document_templates
      FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'document_templates_update'
  ) THEN
    CREATE POLICY document_templates_update ON document_templates
      FOR UPDATE
      USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'document_templates_delete'
  ) THEN
    CREATE POLICY document_templates_delete ON document_templates
      FOR DELETE
      USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
  END IF;
END$$;

-- Policies for document_template_versions (inherit org from parent template)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_template_versions' AND policyname = 'document_template_versions_select'
  ) THEN
    CREATE POLICY document_template_versions_select ON document_template_versions
      FOR SELECT
      USING (
        template_id IN (
          SELECT id FROM document_templates WHERE org_id IN (
            SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_template_versions' AND policyname = 'document_template_versions_insert'
  ) THEN
    CREATE POLICY document_template_versions_insert ON document_template_versions
      FOR INSERT
      WITH CHECK (
        template_id IN (
          SELECT id FROM document_templates WHERE org_id IN (
            SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_template_versions' AND policyname = 'document_template_versions_update'
  ) THEN
    CREATE POLICY document_template_versions_update ON document_template_versions
      FOR UPDATE
      USING (
        template_id IN (
          SELECT id FROM document_templates WHERE org_id IN (
            SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_template_versions' AND policyname = 'document_template_versions_delete'
  ) THEN
    CREATE POLICY document_template_versions_delete ON document_template_versions
      FOR DELETE
      USING (
        template_id IN (
          SELECT id FROM document_templates WHERE org_id IN (
            SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END$$;

COMMENT ON TABLE document_templates IS 'Stores document templates (invoice, delivery, order confirmation, AV list, Lookin Good) with publish status and current version.';
COMMENT ON TABLE document_template_versions IS 'Immutable versions of document templates including layout JSON and bindings.';

