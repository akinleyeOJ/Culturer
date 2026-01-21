-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat images" ON storage.objects;

-- Create storage bucket for chat images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Simple policy: Allow all authenticated users to upload to chat-images
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow all authenticated users to view chat images
CREATE POLICY "Authenticated users can view chat images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-images');

-- Allow all authenticated users to delete their uploaded images
CREATE POLICY "Authenticated users can delete chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND owner = auth.uid());
