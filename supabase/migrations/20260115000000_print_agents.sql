-- Migration: Print Agents and Print Queue
-- Adds support for local USB printers via desktop print agents

-- ============================================
-- Table: print_agents
-- ============================================
-- Represents a desktop print agent installed on a workstation
CREATE TABLE IF NOT EXISTS print_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- Human-friendly name, e.g., "Potting Shed PC"
  agent_key TEXT NOT NULL UNIQUE,                  -- Hashed API key for authentication
  agent_key_prefix TEXT NOT NULL,                  -- First 8 chars for display: "pa_abc12..."
  status TEXT NOT NULL DEFAULT 'offline',          -- 'online', 'offline'
  last_seen_at TIMESTAMPTZ,
  workstation_info JSONB DEFAULT '{}',             -- OS, hostname, version info from agent
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_print_agents_org_id ON print_agents(org_id);
CREATE INDEX IF NOT EXISTS idx_print_agents_agent_key ON print_agents(agent_key);
CREATE INDEX IF NOT EXISTS idx_print_agents_status ON print_agents(org_id, status);

-- Enable RLS
ALTER TABLE print_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY print_agents_access ON print_agents
  FOR ALL
  USING (public.user_in_org(org_id));

-- Grant service role access for WebSocket authentication
CREATE POLICY print_agents_service_access ON print_agents
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role');

COMMENT ON TABLE print_agents IS 'Desktop print agents for local USB printer support';
COMMENT ON COLUMN print_agents.agent_key IS 'SHA256 hash of the API key used for agent authentication';
COMMENT ON COLUMN print_agents.agent_key_prefix IS 'First 8 characters of the key for display purposes';
COMMENT ON COLUMN print_agents.status IS 'Current connection status: online or offline';
COMMENT ON COLUMN print_agents.workstation_info IS 'JSON object with hostname, platform, osVersion, agentVersion';

-- ============================================
-- Modify: printers table
-- ============================================
-- Add columns for agent-connected printers
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES print_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usb_device_id TEXT,     -- USB identifier from agent discovery
  ADD COLUMN IF NOT EXISTS usb_device_name TEXT;   -- Friendly name reported by OS

-- Create index for agent lookup
CREATE INDEX IF NOT EXISTS idx_printers_agent_id ON printers(agent_id);

COMMENT ON COLUMN printers.agent_id IS 'Reference to the print agent this USB printer is connected through';
COMMENT ON COLUMN printers.usb_device_id IS 'USB device identifier reported by the agent';
COMMENT ON COLUMN printers.usb_device_name IS 'USB device name as reported by the operating system';

-- ============================================
-- Table: print_queue
-- ============================================
-- Queue for pending print jobs to agent-connected printers
CREATE TABLE IF NOT EXISTS print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES print_agents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,                          -- 'batch', 'sale', 'location', 'trolley'
  zpl_data TEXT NOT NULL,                          -- The ZPL to send to the printer
  copies INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending', 'sent', 'completed', 'failed'
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_print_queue_agent_status ON print_queue(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_print_queue_created_at ON print_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_queue_org_id ON print_queue(org_id);

-- Enable RLS
ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY print_queue_access ON print_queue
  FOR ALL
  USING (public.user_in_org(org_id));

-- Grant service role access for agent job processing
CREATE POLICY print_queue_service_access ON print_queue
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role');

COMMENT ON TABLE print_queue IS 'Queue for print jobs sent to agent-connected printers';
COMMENT ON COLUMN print_queue.job_type IS 'Type of label: batch, sale, location, trolley';
COMMENT ON COLUMN print_queue.zpl_data IS 'ZPL commands to send to the printer';
COMMENT ON COLUMN print_queue.status IS 'Job status: pending, sent, completed, failed';

-- ============================================
-- Function: Clean up stale print queue entries
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_stale_print_queue()
RETURNS void AS $$
BEGIN
  -- Mark jobs as failed if they've been pending for more than 5 minutes
  UPDATE print_queue
  SET
    status = 'failed',
    error_message = 'Job timed out waiting for agent'
  WHERE
    status = 'pending'
    AND created_at < now() - INTERVAL '5 minutes';

  -- Delete completed/failed jobs older than 7 days
  DELETE FROM print_queue
  WHERE
    status IN ('completed', 'failed')
    AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_stale_print_queue IS 'Cleans up timed out and old print queue entries';

-- ============================================
-- Function: Mark agent offline if not seen recently
-- ============================================
CREATE OR REPLACE FUNCTION mark_stale_agents_offline()
RETURNS void AS $$
BEGIN
  UPDATE print_agents
  SET status = 'offline'
  WHERE
    status = 'online'
    AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '2 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_stale_agents_offline IS 'Marks agents as offline if they have not sent a heartbeat recently';
