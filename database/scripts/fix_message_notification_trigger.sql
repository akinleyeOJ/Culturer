-- Fix the message notification trigger to handle image-only messages

-- Drop and recreate the function
DROP FUNCTION IF EXISTS create_message_notification() CASCADE;

CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
    sender_name TEXT;
    product_name TEXT;
    notification_title TEXT;
BEGIN
    -- Get recipient (the other person in the conversation)
    SELECT 
        CASE 
            WHEN buyer_id = NEW.sender_id THEN seller_id
            ELSE buyer_id
        END INTO recipient_id
    FROM conversations
    WHERE id = NEW.conversation_id;
    
    -- Get product name
    SELECT p.name INTO product_name
    FROM conversations c
    JOIN products p ON c.product_id = p.id
    WHERE c.id = NEW.conversation_id;
    
    -- Get sender name
    SELECT full_name INTO sender_name
    FROM profiles
    WHERE id = NEW.sender_id;
    
    -- Create notification title based on message content
    IF NEW.content IS NOT NULL AND NEW.content != '' THEN
        -- Text message
        notification_title := sender_name || ': ' || LEFT(NEW.content, 50);
    ELSIF NEW.image_url IS NOT NULL THEN
        -- Image-only message
        notification_title := sender_name || ' sent a photo';
    ELSE
        -- Fallback
        notification_title := 'New message from ' || sender_name;
    END IF;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
        recipient_id,
        'message',
        notification_title,
        product_name,
        jsonb_build_object(
            'conversation_id', NEW.conversation_id,
            'message_id', NEW.id,
            'sender_id', NEW.sender_id
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_message_notification ON messages;

CREATE TRIGGER trigger_message_notification
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION create_message_notification();
