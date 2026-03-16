-- Add verification fields to profiles table
-- Run this in your Supabase SQL Editor to enable the new verification features

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- verification_status tracks the progress: none, pending (reviewing), verified (complete), rejected (denied)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'none' 
CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_document_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

-- update: it's recommended to create a storage bucket named 'verification-docs' for these uploads.
