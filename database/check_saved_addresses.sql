-- Check if your saved address is actually in the database
-- Replace 'YOUR_EMAIL_HERE' with your email: timitrilli@gmail.com

SELECT 
    id,
    full_name,
    saved_address,
    created_at
FROM profiles
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'timitrilli@gmail.com'
);

-- This will show you:
-- 1. Your user ID
-- 2. Your full name
-- 3. The saved_address column (should be a JSON array)
-- 4. When the profile was created
