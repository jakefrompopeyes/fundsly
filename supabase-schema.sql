-- Supabase Database Schema for Fundly Startup Data
-- Run this SQL in your Supabase SQL Editor

-- Create the startup_data table
CREATE TABLE IF NOT EXISTS startup_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mint TEXT UNIQUE NOT NULL,
  creator_wallet TEXT NOT NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  
  -- Problem & Solution
  problem_statement TEXT,
  solution_overview TEXT,
  value_proposition TEXT,
  
  -- Market Opportunity
  total_addressable_market TEXT,
  target_market TEXT,
  competition_analysis TEXT,
  
  -- Team & Traction
  team_size TEXT,
  founders TEXT,
  founder_linkedin TEXT,
  current_traction TEXT,
  stage TEXT,
  
  -- Funding
  funding_goal TEXT,
  minimum_investment TEXT,
  use_of_funds TEXT,
  previous_funding TEXT,
  
  -- Resources & Links
  website TEXT,
  twitter TEXT,
  discord TEXT,
  pitch_deck_url TEXT,
  github_url TEXT,
  whitepaper_url TEXT,
  demo_url TEXT,
  video_pitch_url TEXT,
  
  -- Roadmap
  short_term_goals TEXT,
  long_term_vision TEXT,
  
  -- Legal
  company_name TEXT,
  registration_country TEXT,
  registration_number TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups by mint address
CREATE INDEX IF NOT EXISTS idx_startup_data_mint ON startup_data(mint);

-- Create index for filtering by creator wallet
CREATE INDEX IF NOT EXISTS idx_startup_data_creator ON startup_data(creator_wallet);

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_startup_data_category ON startup_data(category);

-- Enable Row Level Security (RLS)
ALTER TABLE startup_data ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read startup data (public data)
CREATE POLICY "Anyone can read startup data"
  ON startup_data
  FOR SELECT
  USING (true);

-- Policy: Anyone can insert (for now - in production, add wallet signature verification)
CREATE POLICY "Anyone can insert startup data"
  ON startup_data
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only creator can update their own startup data
-- Note: In production, verify wallet signature matches creator_wallet
CREATE POLICY "Creator can update their startup data"
  ON startup_data
  FOR UPDATE
  USING (true); -- TODO: Add wallet signature verification

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_startup_data_updated_at
  BEFORE UPDATE ON startup_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for public startup listings (without sensitive data)
CREATE OR REPLACE VIEW public_startup_listings AS
SELECT
  mint,
  name,
  symbol,
  description,
  image_url,
  category,
  stage,
  funding_goal,
  website,
  twitter,
  discord,
  created_at
FROM startup_data
ORDER BY created_at DESC;

-- Grant access to the view
GRANT SELECT ON public_startup_listings TO anon, authenticated;

-- ============================================================================
-- Support Tickets Table for Bug Reports and Issues
-- ============================================================================

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

