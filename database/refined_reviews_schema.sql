-- 1. Add missing tracking columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('product', 'shop')) DEFAULT 'product';

-- Drop the old unique constraint if it exists (allows multiple reviews across different orders)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_product_id_key;

-- Add rating columns to profiles to support aggregate storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seller_reviews_count INTEGER DEFAULT 0;

-- 2. Constraints to prevent duplicate reviews
-- One review per product per order
DROP INDEX IF EXISTS idx_reviews_product_unique;
CREATE UNIQUE INDEX idx_reviews_product_unique 
ON public.reviews (order_id, product_id) 
WHERE (product_id IS NOT NULL AND type = 'product');

-- One shop review per order
DROP INDEX IF EXISTS idx_reviews_shop_unique;
CREATE UNIQUE INDEX idx_reviews_shop_unique 
ON public.reviews (order_id, seller_id) 
WHERE (type = 'shop');

-- 3. Trigger to automatically update product/seller ratings (Optional but recommended)
-- This assumes products table has rating and reviews_count columns
-- and profiles table has seller_rating and seller_reviews_count columns

CREATE OR REPLACE FUNCTION update_ratings_on_review()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.type = 'product' AND NEW.product_id IS NOT NULL) THEN
        -- Update Product Ratings
        UPDATE public.products
        SET 
            rating = (SELECT AVG(rating) FROM public.reviews WHERE product_id = NEW.product_id AND type = 'product'),
            reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = NEW.product_id AND type = 'product')
        WHERE id = NEW.product_id;
    END IF;

    -- Update Seller Ratings (ONLY shop reviews per user request)
    IF (NEW.seller_id IS NOT NULL) THEN
        UPDATE public.profiles
        SET 
            seller_rating = COALESCE((SELECT AVG(rating) FROM public.reviews WHERE seller_id = NEW.seller_id AND type = 'shop'), 0),
            seller_reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE seller_id = NEW.seller_id AND type = 'shop')
        WHERE id = NEW.seller_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ratings ON public.reviews;
CREATE TRIGGER trigger_update_ratings
    AFTER INSERT OR UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_ratings_on_review();

-- 4. Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" 
ON public.reviews FOR SELECT 
USING (true);

-- Authenticated users can insert their own reviews
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews" 
ON public.reviews FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Sellers can update (reply to) reviews where they are the seller_id
DROP POLICY IF EXISTS "Sellers can reply to their reviews" ON public.reviews;
CREATE POLICY "Sellers can reply to their reviews" 
ON public.reviews FOR UPDATE 
TO authenticated 
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 5. Data Migration: Populate seller_id for existing product reviews
-- This allows sellers to reply to older reviews that didn't have seller_id tracked
UPDATE public.reviews
SET seller_id = products.seller_id::uuid
FROM public.products
WHERE reviews.product_id = products.id
AND reviews.seller_id IS NULL;
-- 6. Recalculate Seller Ratings (Apply fix to existing data)
-- This ensures existing seller_rating/count only reflect 'shop' type reviews
UPDATE public.profiles p
SET 
    seller_rating = COALESCE((SELECT AVG(rating) FROM public.reviews r WHERE r.seller_id = p.id AND r.type = 'shop'), 0),
    seller_reviews_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.seller_id = p.id AND r.type = 'shop');
