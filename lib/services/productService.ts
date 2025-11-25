// lib/services/productService.ts
import { supabase } from "../supabase";
import type { Database } from "../../types/database";

type Product = Database['public']['Tables']['products']['Row'];

// Helper function to get user's favorite product IDs from wishlist
const getUserFavorites = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('wishlist')
    .select('product_id')
    .eq('user_id', userId) as { data: { product_id: string }[] | null };
  
  return data?.map(f => f.product_id) || [];
};

// Transform product to UI format
const transformProduct = (product: Product, favoriteIds: string[] = []) => ({
  id: product.id,
  name: product.name,
  price: `$${product.price.toFixed(2)}`,
  emoji: product.emoji || '🎨',
  image: product.image_url || product.images?.[0],
  rating: product.rating,
  reviews: product.reviews_count,
  shipping: product.shipping,
  outOfStock: product.out_of_stock || !product.in_stock,
  isFavorited: favoriteIds.includes(product.id),
  badge: product.is_featured ? 'HOT' as const : null,
});

// Fetch products for "For You" section
export const fetchForYouProducts = async (userId?: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    console.error('Error fetching products:', error);
    return [];
  }

  const favoriteIds = userId ? await getUserFavorites(userId) : [];
  return data.map(p => transformProduct(p, favoriteIds));
};

// Fetch hot/featured products
export const fetchHotProducts = async (userId?: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .eq('is_featured', true)
    .order('total_favorites', { ascending: false })
    .limit(10);

  if (error || !data) {
    console.error('Error fetching hot products:', error);
    return [];
  }

  // Deduplicate by product ID to prevent showing the same product twice
  const uniqueProducts = Array.from(
    new Map((data as Product[]).map(p => [p.id, p])).values()
  ) as Product[];

  const favoriteIds = userId ? await getUserFavorites(userId) : [];
  return uniqueProducts.map(p => transformProduct(p, favoriteIds));
};

// Fetch user's recently viewed products
export const fetchRecentlyViewed = async (userId: string) => {
  const { data: recentlyViewedData, error: rvError } = await supabase
    .from('recently_viewed')
    .select('product_id, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(10);

  if (rvError || !recentlyViewedData || recentlyViewedData.length === 0) {
    return [];
  }

  const productIds = (recentlyViewedData as any[]).map((rv: any) => rv.product_id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, emoji, image_url, images')
    .in('id', productIds);

  if (productsError || !products) {
    return [];
  }

  return (recentlyViewedData as any[]).map((rv: any) => {
    const product = (products as any[]).find((p: any) => p.id === rv.product_id);
    if (!product) return null;
    
    return {
      id: product.id,
      name: product.name,
      price: `$${product.price.toFixed(2)}`,
      emoji: product.emoji || '🎨',
      image: product.image_url || product.images?.[0],
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);
};

// Toggle favorite - uses wishlist table
export const toggleFavorite = async (userId: string, productId: string) => {
  // Check if already favorited
  const { data: existing } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    // Remove from wishlist
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', (existing as any).id);
    
    return { success: !error, isFavorited: false };
  } else {
    // Add to wishlist
    const { error } = await supabase
      .from('wishlist')
      .insert([{ user_id: userId, product_id: productId }] as any);
    
    return { success: !error, isFavorited: true };
  }
};

// Add to wishlist (different from favorites - this is for "save for later")
export const addToWishlist = async (userId: string, productId: string) => {
  const { error } = await supabase
    .from('wishlist')
    .insert([{ user_id: userId, product_id: productId }] as any);
  
  return { success: !error };
};

// Track when user views a product
export const trackProductView = async (userId: string, productId: string) => {
  const { error } = await supabase
    .from('recently_viewed')
    .upsert(
      [{ 
        user_id: userId, 
        product_id: productId, 
        viewed_at: new Date().toISOString() 
      }] as any,
      { onConflict: 'user_id,product_id' }
    );

  if (error) {
    console.error('Error tracking view:', error);
  }
};

// Fetch user's wishlist
export const fetchWishlist = async (userId: string) => {
  const { data: wishlistData, error: wishlistError } = await supabase
    .from('wishlist')
    .select('product_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (wishlistError || !wishlistData || wishlistData.length === 0) {
    return [];
  }

  const productIds = (wishlistData as any[]).map((w: any) => w.product_id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError || !products) {
    return [];
  }

  const favoriteIds = await getUserFavorites(userId);

  return (wishlistData as any[]).map((wl: any) => {
    const product = (products as any[]).find((p: any) => p.id === wl.product_id);
    if (!product) return null;

    return transformProduct(product, favoriteIds);
  }).filter((p): p is NonNullable<typeof p> => p !== null);
};