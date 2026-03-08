-- Create listing_analytics table
CREATE TABLE IF NOT EXISTS public.listing_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'save', 'sale')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_listing_analytics_product ON public.listing_analytics(product_id);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_seller ON public.listing_analytics(seller_id);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_created ON public.listing_analytics(created_at);

-- Enable RLS
ALTER TABLE public.listing_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Sellers can view their own analytics" 
ON public.listing_analytics FOR SELECT 
TO authenticated 
USING (auth.uid() = seller_id);

CREATE POLICY "Analytics can be inserted by anyone" 
ON public.listing_analytics FOR INSERT 
TO public 
WITH CHECK (true);

-- Function to record multiple events safely
CREATE OR REPLACE FUNCTION record_listing_event(
    p_product_id UUID,
    p_seller_id UUID,
    p_event_type TEXT
) RETURNS VOID AS $$
BEGIN
INSERT INTO public.listing_analytics (product_id, seller_id, event_type)
    VALUES (p_product_id, p_seller_id, p_event_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to increment total_views
CREATE OR REPLACE FUNCTION increment_total_views(product_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET total_views = total_views + 1
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to increment total_favorites
CREATE OR REPLACE FUNCTION increment_total_favorites(product_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET total_favorites = total_favorites + 1
    WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

