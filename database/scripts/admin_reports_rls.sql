-- SQL Script to enable admin access to reports
-- Run this in the Supabase SQL Editor

-- 1. Give Admins SELECT access to all reports
CREATE POLICY "Admins can view all reports"
ON public.reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 2. Give Admins UPDATE access to all reports (to change status)
CREATE POLICY "Admins can update all reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);
