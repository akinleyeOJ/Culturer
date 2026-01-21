-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Blocked Users Policies
CREATE POLICY "Users can see their own blocks" ON public.blocked_users
    FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others" ON public.blocked_users
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock" ON public.blocked_users
    FOR DELETE USING (auth.uid() = blocker_id);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID, -- Optional: ID of the message or product being reported
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending', -- pending, reviewed, resolved
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can see their own reports" ON public.reports
    FOR SELECT USING (auth.uid() = reporter_id);

-- Update notifications and messages to hide if blocked
-- This is best handled via views or in-app filtering for now to keep it simple, 
-- but we could add a policy later.
