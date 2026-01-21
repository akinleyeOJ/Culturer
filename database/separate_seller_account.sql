-- Create a strictly separate seller account for testing
DO $$
DECLARE
    -- Generate a NEW random ID for the seller so it definitely isn't YOU
    new_seller_id UUID := gen_random_uuid(); 
BEGIN
    -- 1. Create the separate seller profile
    INSERT INTO profiles (id, full_name, avatar_url, bio)
    VALUES (
        new_seller_id,
        'Culturar Artisan Shop',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Artisan',
        'I am a separate seller account for testing messaging.'
    );

    -- 2. Move ALL products to this new seller (so you are not buying from yourself)
    UPDATE products
    SET user_id = new_seller_id;
    
    -- 3. Cleanup: Delete old conversations to avoid confusion with "John Doe" chats
    DELETE FROM conversations;
    DELETE FROM messages;
    DELETE FROM notifications;
    
END $$;
