-- Shipping & Tracking Integration (Shippo)
-- Run this in your Supabase SQL Editor

-- 1. Add tracking and label columns to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS label_url TEXT,
ADD COLUMN IF NOT EXISTS shippo_shipment_id TEXT,
ADD COLUMN IF NOT EXISTS shippo_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'pending', -- pre_transit, in_transit, delivered, returned
ADD COLUMN IF NOT EXISTS shipping_method_details JSONB;

-- 2. Add an index for faster tracking lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- 3. Ensure profiles table has the shop_shipping settings column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS shop_shipping JSONB DEFAULT '{
  "processing_time": "3-5 business days",
  "pickup_location": "",
  "origin_street1": "",
  "origin_city": "",
  "origin_state": "",
  "origin_zip": "",
  "origin_country": "",
  "shipping_zones": ["domestic"],
  "modes": {
    "home_delivery": {
      "enabled": false,
      "preferred_carriers": [],
      "use_live_rates": false,
      "handling_fee": 0
    },
    "locker_pickup": {
      "enabled": false,
      "preferred_carriers": []
    },
    "local_pickup": {
      "enabled": false
    }
  },
  "providers": [],
  "local_pickup": false,
  "carriers": []
}'::jsonb;

COMMENT ON COLUMN orders.shipping_status IS 'Shipping status synced from Shippo: pending, pre_transit, in_transit, out_for_delivery, delivered, returned, failure';
