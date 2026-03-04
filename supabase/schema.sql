-- VIP DAM Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DAM Users (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  favorites UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tags
-- ============================================
CREATE TABLE IF NOT EXISTS dam_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  category TEXT,  -- e.g., 'Staff', 'Location', 'Procedure', 'Equipment'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(label, category)
);

-- ============================================
-- Assets (main table for images)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  original_path TEXT NOT NULL,  -- Path in Supabase Storage
  preview_path TEXT,  -- WebP preview path
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  mime_type TEXT,
  orientation TEXT CHECK (orientation IN ('landscape', 'portrait', 'square')),
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES dam_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Asset Tags (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_asset_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES dam_assets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES dam_tags(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2),  -- AI confidence score (0.00 - 1.00)
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, tag_id)
);

-- ============================================
-- Asset Metadata (key-value pairs)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_asset_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES dam_assets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,  -- e.g., 'doctor', 'location', 'procedure'
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, key)
);

-- ============================================
-- Virtual Folders (saved filter queries)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  filter_query JSONB NOT NULL DEFAULT '{}',  -- Stores the tag/metadata filter combination
  created_by UUID REFERENCES dam_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Download Log (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS dam_download_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES dam_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dam_users(id),
  format TEXT NOT NULL,  -- 'original', 'webp', 'jpg', 'png'
  width INTEGER,
  height INTEGER,
  quality INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Activity Log
-- ============================================
CREATE TABLE IF NOT EXISTS dam_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES dam_users(id),
  action TEXT NOT NULL,  -- 'upload', 'delete', 'tag', 'download', 'create_folder', etc.
  entity_type TEXT NOT NULL,  -- 'asset', 'tag', 'folder', 'user'
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dam_assets_processing_status ON dam_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_dam_assets_created_at ON dam_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dam_asset_tags_asset_id ON dam_asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_dam_asset_tags_tag_id ON dam_asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_dam_asset_metadata_asset_id ON dam_asset_metadata(asset_id);
CREATE INDEX IF NOT EXISTS idx_dam_asset_metadata_key ON dam_asset_metadata(key);
CREATE INDEX IF NOT EXISTS idx_dam_download_log_asset_id ON dam_download_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_dam_download_log_user_id ON dam_download_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dam_activity_log_created_at ON dam_activity_log(created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE dam_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_asset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_download_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY "Users can view own profile" ON dam_users
  FOR SELECT USING (auth.uid() = id);

-- Admins can do everything on users
CREATE POLICY "Admins can manage users" ON dam_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can read tags
CREATE POLICY "Anyone can view tags" ON dam_tags
  FOR SELECT USING (true);

-- Admins can manage tags
CREATE POLICY "Admins can manage tags" ON dam_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can view assets
CREATE POLICY "Anyone can view assets" ON dam_assets
  FOR SELECT USING (true);

-- Admins can manage assets
CREATE POLICY "Admins can manage assets" ON dam_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can view asset tags
CREATE POLICY "Anyone can view asset tags" ON dam_asset_tags
  FOR SELECT USING (true);

-- Admins can manage asset tags
CREATE POLICY "Admins can manage asset tags" ON dam_asset_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can view metadata
CREATE POLICY "Anyone can view metadata" ON dam_asset_metadata
  FOR SELECT USING (true);

-- Admins can manage metadata
CREATE POLICY "Admins can manage metadata" ON dam_asset_metadata
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can view folders
CREATE POLICY "Anyone can view folders" ON dam_folders
  FOR SELECT USING (true);

-- Admins can manage folders
CREATE POLICY "Admins can manage folders" ON dam_folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can insert their own downloads
CREATE POLICY "Users can log downloads" ON dam_download_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own downloads
CREATE POLICY "Users can view own downloads" ON dam_download_log
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all downloads
CREATE POLICY "Admins can view all downloads" ON dam_download_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can view activity log
CREATE POLICY "Admins can view activity" ON dam_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert activity
CREATE POLICY "Admins can log activity" ON dam_activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Storage Buckets (run in Supabase Dashboard)
-- ============================================
-- Create two buckets:
-- 1. "dam-originals" - for 4K source files (private)
-- 2. "dam-previews" - for WebP previews (public)

-- ============================================
-- Trigger to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dam_assets_updated_at
  BEFORE UPDATE ON dam_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
