-- Run this in Supabase SQL Editor to fix RLS policies for admin panel
-- (Until auth is set up)

-- Assets - allow all operations
DROP POLICY IF EXISTS "Admins can manage assets" ON dam_assets;
CREATE POLICY "Anyone can insert assets" ON dam_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assets" ON dam_assets FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete assets" ON dam_assets FOR DELETE USING (true);

-- Tags - allow all operations  
DROP POLICY IF EXISTS "Admins can manage tags" ON dam_tags;
CREATE POLICY "Anyone can insert tags" ON dam_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tags" ON dam_tags FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tags" ON dam_tags FOR DELETE USING (true);

-- Asset Tags - allow all operations
DROP POLICY IF EXISTS "Admins can manage asset tags" ON dam_asset_tags;
CREATE POLICY "Anyone can insert asset tags" ON dam_asset_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete asset tags" ON dam_asset_tags FOR DELETE USING (true);

-- Metadata - allow all operations
DROP POLICY IF EXISTS "Admins can manage metadata" ON dam_asset_metadata;
CREATE POLICY "Anyone can insert metadata" ON dam_asset_metadata FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update metadata" ON dam_asset_metadata FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete metadata" ON dam_asset_metadata FOR DELETE USING (true);
