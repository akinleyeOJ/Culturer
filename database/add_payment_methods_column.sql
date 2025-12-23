-- Add missing payment_methods column to profiles table
-- This will fix the "Column profiles.payment_methods does not exist" error

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('saved_address', 'payment_methods');
