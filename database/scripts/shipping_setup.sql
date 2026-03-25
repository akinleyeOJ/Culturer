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

-- 3. Add a column to profiles for Shippo Customer ID (optional, for saved cards/customers)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shippo_customer_id TEXT;

COMMENT ON COLUMN orders.shipping_status IS 'Shipping status synced from Shippo: pending, pre_transit, in_transit, out_for_delivery, delivered, returned, failure';
