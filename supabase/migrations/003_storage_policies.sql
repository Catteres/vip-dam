-- VIP DAM Storage Bucket Policies
-- Run this in Supabase SQL Editor after creating the buckets

-- ============================================
-- BUCKET: dam-originals (private - authenticated access)
-- ============================================

-- Allow authenticated users to view/download originals
CREATE POLICY "Authenticated users can view originals"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dam-originals');

-- Allow admins to upload to dam-originals
CREATE POLICY "Admins can upload originals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dam-originals' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to update originals (for upsert)
CREATE POLICY "Admins can update originals"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dam-originals' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to delete from dam-originals
CREATE POLICY "Admins can delete originals"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dam-originals' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- BUCKET: dam-previews (public read, admin write)
-- ============================================

-- Allow anyone to view previews (public bucket)
CREATE POLICY "Anyone can view previews"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dam-previews');

-- Allow admins to upload previews
CREATE POLICY "Admins can upload previews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dam-previews' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to update previews
CREATE POLICY "Admins can update previews"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dam-previews' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to delete previews
CREATE POLICY "Admins can delete previews"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dam-previews' AND
  EXISTS (SELECT 1 FROM dam_users WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- NOTES:
-- ============================================
-- 1. Create buckets first in Supabase Dashboard:
--    - dam-originals: Private (disable public access)
--    - dam-previews: Public (enable public access for reads)
--
-- 2. The originals bucket uses Supabase Image Transformations
--    for on-the-fly resizing, which requires authenticated access
--
-- 3. If you get policy conflicts, drop existing policies first:
--    DROP POLICY IF EXISTS "policy_name" ON storage.objects;
