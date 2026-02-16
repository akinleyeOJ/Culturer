-- Add columns for user interests to personalize discovery
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS interested_cultures JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS item_interests JSONB DEFAULT '[]'::jsonb;
