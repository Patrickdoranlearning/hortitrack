-- Migration: Customer Follow-Ups Table
-- Purpose: First-class follow-up tracking for customer interactions
-- Part of: Customer Pages Enhancement (Phase 2)

-- Create customer_follow_ups table
CREATE TABLE IF NOT EXISTS customer_follow_ups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source_interaction_id uuid REFERENCES customer_interactions(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_status_due
  ON customer_follow_ups(customer_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_status_due
  ON customer_follow_ups(assigned_to, status, due_date);

CREATE INDEX IF NOT EXISTS idx_follow_ups_org_status_due
  ON customer_follow_ups(org_id, status, due_date);

-- Enable RLS
ALTER TABLE customer_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_in_org function (standard pattern in HortiTrack)
CREATE POLICY "Users can view follow-ups in their org"
  ON customer_follow_ups FOR SELECT
  USING (user_in_org(org_id));

CREATE POLICY "Users can create follow-ups in their org"
  ON customer_follow_ups FOR INSERT
  WITH CHECK (user_in_org(org_id));

CREATE POLICY "Users can update follow-ups in their org"
  ON customer_follow_ups FOR UPDATE
  USING (user_in_org(org_id));

CREATE POLICY "Users can delete follow-ups in their org"
  ON customer_follow_ups FOR DELETE
  USING (user_in_org(org_id));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_follow_ups TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE customer_follow_ups IS 'Tracks follow-up tasks for customers, optionally linked to interactions';
COMMENT ON COLUMN customer_follow_ups.source_interaction_id IS 'Optional link to the interaction that generated this follow-up';
COMMENT ON COLUMN customer_follow_ups.status IS 'pending, completed, or cancelled';
