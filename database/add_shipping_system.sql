-- ============================================
-- Shipping System Migration
-- Adds weight tiers, carrier tracking, and 
-- shipping method details to the schema
-- ============================================

-- 1. PRODUCTS: Add weight_tier column
-- Values: 'mini', 'small', 'medium', 'large'
ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight_tier TEXT DEFAULT 'medium';

-- 2. ORDERS: Add shipping fulfillment fields
-- carrier_name: e.g. 'InPost', 'DHL', 'Royal Mail'
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS carrier_name TEXT;

-- tracking_number: seller enters this when marking as shipped
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- shipping_method_details: JSONB for flexible data
-- e.g. { "type": "locker", "locker_id": "WAW102", "locker_address": "..." }
-- or   { "type": "home_delivery" }
-- or   { "type": "store_pickup" }
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_method_details JSONB;

-- shipping_zone: 'domestic', 'eu', 'international'
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_zone TEXT;
