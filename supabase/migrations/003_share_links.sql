-- Shareable links for assets
CREATE TABLE IF NOT EXISTS dam_share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES dam_assets(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_share_links_token ON dam_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_asset ON dam_share_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_share_links_expires ON dam_share_links(expires_at);

-- RLS policies
ALTER TABLE dam_share_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create/view/delete share links
CREATE POLICY "Authenticated users can manage share links" 
  ON dam_share_links FOR ALL 
  USING (true);

-- Allow public read access for valid tokens (needed for the share page)
CREATE POLICY "Public can read by token" 
  ON dam_share_links FOR SELECT 
  USING (true);
