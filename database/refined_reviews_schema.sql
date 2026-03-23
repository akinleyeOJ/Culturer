-- SQL script to refine the reviews table
-- 1. Add missing tracking columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('product', 'shop')) DEFAULT 'product';

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

    -- Update Seller Ratings (for both product and shop reviews)
    IF (NEW.seller_id IS NOT NULL) THEN
        UPDATE public.profiles
        SET 
            seller_rating = (SELECT AVG(rating) FROM public.reviews WHERE seller_id = NEW.seller_id),
            seller_reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE seller_id = NEW.seller_id)
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
