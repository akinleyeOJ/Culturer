-- Products and Related Tables Schema for Culturar
-- This documents the existing database structure

-- 1. Products table (main product catalog)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  category TEXT,
  emoji TEXT DEFAULT '🎨',
  image_url TEXT,
  images TEXT[], -- Array of image URLs
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  shipping TEXT DEFAULT 'Free',
  out_of_stock BOOLEAN DEFAULT false,
  in_stock BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 10,
  is_featured BOOLEAN DEFAULT false,
  total_favorites INTEGER DEFAULT 0,
  
  -- Product details
  condition TEXT DEFAULT 'New',
  cultural_origin TEXT,
  dimensions TEXT,
  returns_policy TEXT DEFAULT '7 days',
  
  -- Seller information
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_avatar TEXT,
  seller_rating DECIMAL(3,2) DEFAULT 4.5,
  seller_reviews_count INTEGER DEFAULT 0,
  seller_location TEXT DEFAULT 'Berlin',
  
  -- Shipping options
  pickup_available BOOLEAN DEFAULT false,
  free_shipping BOOLEAN DEFAULT false,
  express_shipping BOOLEAN DEFAULT false,
  shipping_days_min INTEGER DEFAULT 3,
  shipping_days_max INTEGER DEFAULT 5,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Wishlist table (user favorites)
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- 3. Recently viewed table (browsing history)
CREATE TABLE IF NOT EXISTS recently_viewed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_viewed_at ON recently_viewed(viewed_at);

-- Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

-- Products policies (public read, admin write)
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  USING (true);

-- Wishlist policies
CREATE POLICY "Users can view their own wishlist"
  ON wishlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own wishlist"
  ON wishlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own wishlist"
  ON wishlist FOR DELETE
  USING (auth.uid() = user_id);

-- Recently viewed policies
CREATE POLICY "Users can view their own history"
  ON recently_viewed FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own history"
  ON recently_viewed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history"
  ON recently_viewed FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history"
  ON recently_viewed FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update products updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Function to increment total_favorites when item is added to wishlist
CREATE OR REPLACE FUNCTION increment_product_favorites()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET total_favorites = total_favorites + 1
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_added
  AFTER INSERT ON wishlist
  FOR EACH ROW
  EXECUTE FUNCTION increment_product_favorites();

-- Function to decrement total_favorites when item is removed from wishlist
CREATE OR REPLACE FUNCTION decrement_product_favorites()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET total_favorites = GREATEST(total_favorites - 1, 0)
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlist_removed
  AFTER DELETE ON wishlist
  FOR EACH ROW
  EXECUTE FUNCTION decrement_product_favorites();
