-- Function to fix the notification permission error
-- This redefines the notification trigger function with SECURITY DEFINER
-- which allows it to bypass Row Level Security explicitly for this operation.

CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER 
SECURITY DEFINER -- <--- THIS IS THE KEY FIX
AS $$
DECLARE
    recipient_id UUID;
    sender_name TEXT;
    product_name TEXT;
BEGIN
    -- Get recipient (the other person in conversation)
    SELECT 
        CASE 
            WHEN c.buyer_id = NEW.sender_id THEN c.seller_id
            ELSE c.buyer_id
        END,
        p.name
    INTO recipient_id, product_name
    FROM conversations c
    JOIN products p ON p.id = c.product_id
    WHERE c.id = NEW.conversation_id;
    
    -- Get sender name
    SELECT full_name INTO sender_name
    FROM profiles
    WHERE id = NEW.sender_id;
    
    -- Create notification
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
        recipient_id,
        'message',
        sender_name || ': ' || LEFT(NEW.content, 50),
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
