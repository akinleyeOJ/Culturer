-- REVISED: Skip the ALTER TABLE line and just add the policies

-- 1. Allow PUBLIC to VIEW files in these buckets
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id IN ('avatars', 'covers') );

-- 2. Allow Authenticated users to UPLOAD to their own folder
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id IN ('avatars', 'covers') 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow Authenticated users to UPDATE/DELETE their own files
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id IN ('avatars', 'covers') 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id IN ('avatars', 'covers') 
    AND (storage.foldername(name))[1] = auth.uid()::text
);