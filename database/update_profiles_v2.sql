-- Migration to add support for enhanced profile features
-- Cover images, cultural tags, and improved location handling

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS cultures JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Ensure public read access to these new columns (policy usually covers all columns, but good to verify)
-- The policy "Public profiles are viewable by everyone" already exists and covers all columns.
