-- Fix notifications table RLS policies
-- This allows the system to create notifications when messages are sent

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Allow users to view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- CRITICAL: Allow any authenticated user to create notifications for other users
-- This is needed when sending messages - the sender creates a notification for the recipient
CREATE POLICY "Authenticated users can create notifications"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
