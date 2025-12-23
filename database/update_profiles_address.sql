-- Add saved_address column to profiles table to support multiple shipping addresses

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS saved_address JSONB DEFAULT '[]'::jsonb;

-- Verify it exists
SELECT id, full_name, saved_address FROM profiles LIMIT 5;
