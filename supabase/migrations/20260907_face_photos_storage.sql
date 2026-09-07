-- Create Storage Buckets for face-photos and avatars if not already existing
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-photos', 'face-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for face-photos
DROP POLICY IF EXISTS "Public Face Photos Read" ON storage.objects;
CREATE POLICY "Public Face Photos Read" ON storage.objects
FOR SELECT USING (bucket_id IN ('face-photos', 'avatars'));

DROP POLICY IF EXISTS "Allow Face Photos Uploads" ON storage.objects;
CREATE POLICY "Allow Face Photos Uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id IN ('face-photos', 'avatars'));

DROP POLICY IF EXISTS "Allow Face Photos Updates" ON storage.objects;
CREATE POLICY "Allow Face Photos Updates" ON storage.objects
FOR UPDATE USING (bucket_id IN ('face-photos', 'avatars'));
