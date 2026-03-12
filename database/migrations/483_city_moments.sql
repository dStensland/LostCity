-- ============================================
-- MIGRATION 483: City Moments profile video
-- ============================================
-- Adds city_moment_url and city_moment_thumbnail_url to profiles,
-- and creates the city-moments storage bucket.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- 1. Schema changes — two columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS city_moment_url TEXT,
  ADD COLUMN IF NOT EXISTS city_moment_thumbnail_url TEXT;

COMMENT ON COLUMN profiles.city_moment_url IS
  'Public URL to an optimized MP4 city moment video in Supabase storage';
COMMENT ON COLUMN profiles.city_moment_thumbnail_url IS
  'JPEG poster frame for the city moment video';

-- 2. Storage bucket — city-moments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'city-moments',
  'city-moments',
  true,
  10485760, -- 10MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies mirroring avatars bucket
-- Allow public read access
CREATE POLICY "city_moments_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'city-moments');

-- Allow authenticated users to upload to their own folder
CREATE POLICY "city_moments_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'city-moments'
    AND (storage.foldername(name))[1] = (auth.uid())::TEXT
  );

-- Allow authenticated users to update their own files
CREATE POLICY "city_moments_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'city-moments'
    AND (storage.foldername(name))[1] = (auth.uid())::TEXT
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "city_moments_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'city-moments'
    AND (storage.foldername(name))[1] = (auth.uid())::TEXT
  );
