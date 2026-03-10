-- SQL script to add seller reply functionality to the reviews table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS seller_reply text,
ADD COLUMN IF NOT EXISTS seller_replied_at timestamptz;
