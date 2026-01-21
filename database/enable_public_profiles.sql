-- Enable RLS on profiles if not already on
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies related to reading profiles to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

-- Allow EVERYONE (authenticated or anon) to read profiles
-- This is critical for users to see "Seller 101" instead of "Unknown Seller"
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING ( true );

-- Ensure users can only edit their own profile
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." 
ON profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." 
ON profiles FOR UPDATE 
USING ( auth.uid() = id );
