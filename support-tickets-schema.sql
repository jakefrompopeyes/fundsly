-- Support Tickets Table for Bug Reports and Issues
-- Add this to your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User Information
  user_wallet TEXT,
  user_email TEXT,
  
  -- Ticket Details
  type TEXT NOT NULL CHECK (type IN ('bug', 'error', 'issue', 'feature_request', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Additional Context
  page_url TEXT,
  browser_info TEXT,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  
  -- Status Tracking
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);

-- Create index for filtering by user wallet
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_wallet ON support_tickets(user_wallet);

-- Enable Row Level Security (RLS)
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert support tickets (public submissions)
CREATE POLICY "Anyone can insert support tickets"
  ON support_tickets
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own tickets (if wallet is provided)
-- Note: In production, verify wallet signature matches user_wallet
CREATE POLICY "Users can view their own tickets"
  ON support_tickets
  FOR SELECT
  USING (true); -- TODO: Add wallet signature verification

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

