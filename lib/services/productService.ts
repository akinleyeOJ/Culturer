// lib/services/productService.ts
import { supabase } from "../supabase";
import type { Database } from "../../types/database";

// Type helpers
type Product = Database['public']['Tables']['products']['Row'];

// Fetch products for "For You" section
export const fetchForYouProducts = async (userId?: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  if (!data) return [];

  // If user is logged in, fetch their wishlist to mark favorites
  let wishlistIds: string[] = [];
  if (userId) {
    const { data: wishlistData } = await supabase
      .from('wishlist')
      .select('product_id')
      .eq('user_id', userId) as { data: { product_id: string }[] | null };
    
    wishlistIds = wishlistData?.map(w => w.product_id) || [];
  }

  // Transform database format to UI format
  return data.map((product: Product) => ({
    id: product.id,
    name: product.name,
    price: `$${product.price.toFixed(2)}`,
    emoji: product.emoji || '🎨',
    image: product.image_url || product.images?.[0],
    rating: product.rating,
    reviews: product.reviews_count,
    shipping: product.shipping,
    outOfStock: product.out_of_stock || !product.in_stock,
    isFavorited: wishlistIds.includes(product.id),
  }));
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

  if (error) {
    console.error('Error fetching hot products:', error);
    return [];
  }

  if (!data) return [];

  // If user is logged in, fetch their wishlist
  let wishlistIds: string[] = [];
  if (userId) {
    const { data: wishlistData } = await supabase
      .from('wishlist')
      .select('product_id')
      .eq('user_id', userId) as { data: { product_id: string }[] | null };
    
    wishlistIds = wishlistData?.map(w => w.product_id) || [];
  }

  return data.map((product: Product) => ({
    id: product.id,
    name: product.name,
    price: `$${product.price.toFixed(2)}`,
    emoji: product.emoji || '🎨',
    image: product.image_url || product.images?.[0],
    rating: product.rating,
    reviews: product.reviews_count,
    shipping: product.shipping,
    outOfStock: product.out_of_stock || !product.in_stock,
    isFavorited: wishlistIds.includes(product.id),
  }));
};

// Fetch user's recently viewed products
export const fetchRecentlyViewed = async (userId: string) => {
  // First get recently viewed product IDs
  const { data: recentlyViewedData, error: rvError } = await supabase
    .from('recently_viewed')
    .select('product_id, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(10);

  if (rvError || !recentlyViewedData || recentlyViewedData.length === 0) {
    console.error('Error fetching recently viewed:', rvError);
    return [];
  }

  // Get the actual products
  const productIds = (recentlyViewedData as any[]).map((rv: any) => rv.product_id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, emoji, image_url, images')
    .in('id', productIds);

  if (productsError || !products) {
    console.error('Error fetching products:', productsError);
    return [];
  }

  // Map products in the order they were viewed
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

// Toggle favorite/wishlist
export const toggleFavorite = async (userId: string, productId: string) => {
  // Check if already favorited
  const { data: existing, error: checkError } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking favorite:', checkError);
    return { error: checkError };
  }

  if (existing) {
    // Remove from wishlist
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', (existing as any).id);
    
    return { error };
  } else {
    // Add to wishlist
    const { error } = await supabase
      .from('wishlist')
      .insert([{ user_id: userId, product_id: productId }] as any);
    
    return { error };
  }
};

// Track when user views a product
export const trackProductView = async (userId: string, productId: string) => {
  // Upsert: update viewed_at if exists, insert if doesn't
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
  // First get wishlist items
  const { data: wishlistData, error: wishlistError } = await supabase
    .from('wishlist')
    .select('product_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (wishlistError || !wishlistData || wishlistData.length === 0) {
    console.error('Error fetching wishlist:', wishlistError);
    return [];
  }

  // Get the actual products
  const productIds = (wishlistData as any[]).map((w: any) => w.product_id);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError || !products) {
    console.error('Error fetching products:', productsError);
    return [];
  }

  // Map products in wishlist order
  return (wishlistData as any[]).map((wl: any) => {
    const product = (products as any[]).find((p: any) => p.id === wl.product_id);
    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      price: `$${product.price.toFixed(2)}`,
      emoji: product.emoji || '🎨',
      image: product.image_url || product.images?.[0],
      rating: product.rating,
      reviews: product.reviews_count,
      shipping: product.shipping,
      outOfStock: product.out_of_stock || !product.in_stock,
      isFavorited: true,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);
};