-- Ensure real-time is enabled for the messages table
-- This is often the missed step for chat apps

-- 1. Enable REPLICA IDENTITY (Allows valid update tracking)
ALTER TABLE messages REPLICA IDENTITY FULL;

-- 2. Add 'messages' to the publication explicitly
-- This ensures 'INSERT' events are broadcast
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, conversations, notifications;

-- 3. Just to be absolutely sure the policies allow reading by the recipient
DROP POLICY IF EXISTS "Users can read conversation messages" ON messages;
CREATE POLICY "Users can read conversation messages"
ON messages FOR SELECT
USING (
    conversation_id IN (
        SELECT id FROM conversations 
        WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
    )
);
