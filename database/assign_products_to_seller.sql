-- Run this SQL in your Supabase SQL Editor to fix product ownership.
-- This ensures products are owned by a user who can receive messages.

-- 1. Create a "Universal Seller" profile if it doesn't exist
-- WARNING: This inserts into public.profiles only. 
-- For this to work fully with Auth, this ID should correspond to a real user in auth.users.
-- IF YOU HAVE A SECOND ACCOUNT, REPLACE THE UUID BELOW WITH THAT USER'S ID.
DO $$
DECLARE
    -- REPLACE THIS ID WITH YOUR SECOND ACCOUNT'S ID IF YOU HAVE ONE
    seller_user_id UUID := '00000000-0000-0000-0000-000000000001'; 
BEGIN
    -- 2. Insert dummy profile for this seller ID
    INSERT INTO profiles (id, full_name, avatar_url, bio)
    VALUES (
        seller_user_id,
        'Culturar Artisan Shop',
        'https://ui-avatars.com/api/?name=Culturar+Artisan&background=random',
        'We sell authentic cultural artifacts from around the world.'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 3. Assign ALL products to this seller
    -- This ensures that when you click "Message Seller", it goes to THIS user.
    UPDATE products
    SET user_id = seller_user_id;
    
    -- 4. Clean up any broken conversations from previous tests
    DELETE FROM conversations 
    WHERE seller_id NOT IN (SELECT id FROM profiles);
    
END $$;

