-- Migration: Print Jobs table
-- Stores print job history for reprinting and auditing

CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label_type TEXT NOT NULL, -- 'sale', 'batch', 'location'
  template_id UUID REFERENCES label_templates(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  copies INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}', -- Stores the label data for reprinting
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_org_id ON print_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_label_type ON print_jobs(org_id, label_type);

-- Enable RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for print_jobs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'print_jobs' AND policyname = 'print_jobs_select_policy'
  ) THEN
    CREATE POLICY print_jobs_select_policy ON print_jobs
      FOR SELECT
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'print_jobs' AND policyname = 'print_jobs_insert_policy'
  ) THEN
    CREATE POLICY print_jobs_insert_policy ON print_jobs
      FOR INSERT
      WITH CHECK (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'print_jobs' AND policyname = 'print_jobs_update_policy'
  ) THEN
    CREATE POLICY print_jobs_update_policy ON print_jobs
      FOR UPDATE
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'print_jobs' AND policyname = 'print_jobs_delete_policy'
  ) THEN
    CREATE POLICY print_jobs_delete_policy ON print_jobs
      FOR DELETE
      USING (org_id IN (
        SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE print_jobs IS 'Stores print job history for label printing operations';
COMMENT ON COLUMN print_jobs.label_type IS 'Type of label: sale, batch, location';
COMMENT ON COLUMN print_jobs.payload_json IS 'JSON payload containing the label data for reprinting';
COMMENT ON COLUMN print_jobs.status IS 'Job status: pending, completed, failed';







