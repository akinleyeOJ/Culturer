ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shipping_preferences JSONB DEFAULT '{"local_pickup": false, "delivery_speed": "standard"}'::jsonb;
