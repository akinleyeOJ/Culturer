-- Features Schema Update
-- Run this in Supabase SQL Editor

-- 1. Enable 'Save Card' Feature
-- Add stripe_customer_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Enable 'Discount Codes' Feature
-- Create table for coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE, -- The code user types (e.g. SUMMER10)
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL, -- e.g. 10.00 or 15 (percent)
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can fetch coupon details to validate them
CREATE POLICY "Users can view active coupons" ON coupons
  FOR SELECT
  USING (is_active = true);

-- 3. Seed some example coupons
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount)
VALUES 
  ('WELCOME10', 'percentage', 10, 0),
  ('SAVE20', 'fixed', 20, 50)
ON CONFLICT (code) DO NOTHING;
