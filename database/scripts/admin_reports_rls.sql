-- SQL Script to correctly set up the reports table with profile relationships
-- Run this in the Supabase SQL Editor

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the reports table referencing PROFILES instead of auth.users
-- This allows the app to easily join report data with user names/avatars
DROP TABLE IF EXISTS public.reports;

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_id UUID, -- ID of the order or message being reported
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. User Policies
CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can see their own reports" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- 4. Admin Policies
CREATE POLICY "Admins can view all reports" ON public.reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all reports" ON public.reports
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
