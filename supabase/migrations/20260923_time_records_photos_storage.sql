-- Migration: Configure time-records-photos bucket and secure storage policies
-- Run this in the Supabase Dashboard -> SQL Editor

-- 1. Ensure time-records-photos bucket exists and is public for image viewing
INSERT INTO storage.buckets (id, name, public)
VALUES ('time-records-photos', 'time-records-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow authenticated users (logged-in trainees/supervisors) to upload attendance photos
DROP POLICY IF EXISTS "Allow attendance photo uploads" ON storage.objects;
CREATE POLICY "Allow attendance photo uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'time-records-photos');

-- 3. Allow public read access so attendance photos render in reports and DTR sheets
DROP POLICY IF EXISTS "Allow attendance photo reads" ON storage.objects;
CREATE POLICY "Allow attendance photo reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'time-records-photos');

-- 4. Allow authenticated users to update/replace attendance photos if needed
DROP POLICY IF EXISTS "Allow attendance photo updates" ON storage.objects;
CREATE POLICY "Allow attendance photo updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'time-records-photos');
