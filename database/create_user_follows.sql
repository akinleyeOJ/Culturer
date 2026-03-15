-- Create a table to track follower relationships between users/sellers
CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- Enable RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Users can read all follows (to see follower counts, etc)
CREATE POLICY "Anyone can view follows" 
ON public.user_follows FOR SELECT 
USING (true);

-- Users can only insert their own follows
CREATE POLICY "Users can follow others" 
ON public.user_follows FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

-- Users can only unfollow for themselves
CREATE POLICY "Users can unfollow others" 
ON public.user_follows FOR DELETE 
USING (auth.uid() = follower_id);

-- Optional: Function to get a user's follower count
CREATE OR REPLACE FUNCTION get_follower_count(user_id UUID)
RETURNS INTEGER AS $$
    SELECT count(*)::int FROM public.user_follows WHERE following_id = $1;
$$ LANGUAGE sql STABLE;

-- Optional: Function to get a user's following count
CREATE OR REPLACE FUNCTION get_following_count(user_id UUID)
RETURNS INTEGER AS $$
    SELECT count(*)::int FROM public.user_follows WHERE follower_id = $1;
$$ LANGUAGE sql STABLE;
