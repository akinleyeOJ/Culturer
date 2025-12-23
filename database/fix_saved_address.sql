-- Ensure saved_address column exists with correct default value
-- This migration ensures addresses persist correctly

-- First, check if the column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'saved_address'
    ) THEN
        ALTER TABLE profiles ADD COLUMN saved_address JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Update any NULL values to empty array
UPDATE profiles SET saved_address = '[]'::jsonb WHERE saved_address IS NULL;

-- Ensure the column has a default for new rows
ALTER TABLE profiles ALTER COLUMN saved_address SET DEFAULT '[]'::jsonb;

-- Make sure the column is NOT NULL
ALTER TABLE profiles ALTER COLUMN saved_address SET NOT NULL;
