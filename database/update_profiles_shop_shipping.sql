-- SQL to add seller shipping settings to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shop_shipping JSONB DEFAULT '{
  "processing_time": "3-5 business days",
  "local_pickup": false,
  "pickup_location": "",
  "standard_shipping_price": 0,
  "express_shipping_enabled": false,
  "express_shipping_price": 15,
  "shipping_origin": ""
}'::jsonb;
