-- CLEANUP: Remove message-based notifications to avoid redundancy
-- Users already have a dedicated 'Messages' tab, so we keep 'Notifications' for transactions/system activity only.

-- 1. Drop the trigger that creates notifications for messages
DROP TRIGGER IF EXISTS trigger_message_notification ON messages;

-- 2. Drop the redundant function
DROP FUNCTION IF EXISTS create_message_notification();

-- 3. (Optional) Remove existing 'message' type notifications to clean up the UI immediately
-- DELETE FROM notifications WHERE type = 'message';
