-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their own conversation folders
CREATE POLICY "Users can upload chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM conversations
    WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
  )
);

-- Allow users to view images from their conversations
CREATE POLICY "Users can view chat images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM conversations
    WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
  )
);

-- Allow users to delete images from their conversations
CREATE POLICY "Users can delete chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM conversations
    WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
  )
);
