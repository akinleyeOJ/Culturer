-- Migration to add social link support to profiles
-- Instagram handle and Website URL

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
ADD COLUMN IF NOT EXISTS facebook_handle TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Indexing isn't strictly necessary for these but good if we ever search by them
CREATE INDEX IF NOT EXISTS idx_profiles_instagram ON profiles(instagram_handle);
