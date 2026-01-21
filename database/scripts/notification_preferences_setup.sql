-- Add notification_preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "messages": true,
    "price_drops": true,
    "back_in_stock": true,
    "promotions": false,
    "security_alerts": true
}'::jsonb;
