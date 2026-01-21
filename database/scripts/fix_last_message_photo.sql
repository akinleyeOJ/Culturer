-- Update the conversation last_message logic to handle image messages
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message = CASE 
            WHEN (NEW.content IS NULL OR NEW.content = '') AND NEW.image_url IS NOT NULL THEN '📷 Photo'
            ELSE NEW.content
        END,
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
