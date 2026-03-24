-- Migration to add shop pause functionality
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_shop_live BOOLEAN DEFAULT TRUE;

-- Add comment for clarity
COMMENT ON COLUMN profiles.is_shop_live IS 'Whether the seller shop is currently active and visible in the marketplace';
