-- Add spoken_languages and shipping_regions to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS spoken_languages TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shipping_regions TEXT[] DEFAULT '{}';

-- Allow these columns to be readable by anyone (via profile read policies)
-- Allow them to be updated by the owner (via existing profile update policies)
