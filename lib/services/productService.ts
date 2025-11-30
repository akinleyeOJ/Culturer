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

// Fetch all products with pagination, category filter, and search
export const fetchAllProducts = async (
  page: number = 0,
  limit: number = 12,
  category: string = 'all',
  searchQuery: string = '',
  userId?: string
) => {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('in_stock', true)
    .range(page * limit, (page + 1) * limit - 1);

  // Apply category filter
  if (category !== 'all') {
    query = query.eq('category', category);
  }

  // Apply search filter
  if (searchQuery) {
    query = query.ilike('name', `%${searchQuery}%`);
  }

  // CRITICAL FIX: Run queries in parallel using Promise.all
  // This prevents the "waterfall" delay where we wait for products before asking for favorites
  const [productsResponse, favoriteIds] = await Promise.all([
    query,
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data, error, count } = productsResponse;

  if (error) {
    console.error('Error fetching all products:', error);
    return { products: [], count: 0 };
  }

  const products = data ? data.map(p => transformProduct(p, favoriteIds)) : [];

  return { products, count: count || 0 };
};

// ... keep existing fetchForYouProducts, fetchHotProducts, fetchRecentlyViewed ...
// ... ensure you update them to use Promise.all if they also fetch favorites ...

// Example update for fetchForYouProducts to use Promise.all as well:
export const fetchForYouProducts = async (userId?: string) => {
  const [productsResponse, favoriteIds] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)
      .order('created_at', { ascending: false })
      .limit(10),
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data, error } = productsResponse;

  if (error || !data) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data.map(p => transformProduct(p, favoriteIds));
};

// Example update for fetchHotProducts:
export const fetchHotProducts = async (userId?: string) => {
  const [productsResponse, favoriteIds] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)
      .eq('is_featured', true)
      .order('total_favorites', { ascending: false })
      .limit(10),
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data, error } = productsResponse;

  if (error || !data) {
    console.error('Error fetching hot products:', error);
    return [];
  }

  const uniqueProducts = Array.from(
    new Map((data as Product[]).map(p => [p.id, p])).values()
  ) as Product[];

  return uniqueProducts.map(p => transformProduct(p, favoriteIds));
};

// ... keep fetchRecentlyViewed (it already does a secondary fetch but logic is specific) ...

// ... keep toggleFavorite, addToWishlist, trackProductView, fetchWishlist, fetchWishlistCount ...
// (These functions remain unchanged from your original file)

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

  const productsMap = new Map((products as any[]).map(p => [p.id, p]));

  return (recentlyViewedData as any[])
    .map((rv: any) => {
      const product = productsMap.get(rv.product_id);
      if (!product) return null;

      return {
        id: product.id,
        name: product.name,
        price: `$${product.price.toFixed(2)}`,
        emoji: product.emoji || '🎨',
        image: product.image_url || product.images?.[0],
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
};

export const toggleFavorite = async (userId: string, productId: string) => {
  const { data: existing } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('id', (existing as any).id);

    return { success: !error, isFavorited: false };
  } else {
    const { error } = await supabase
      .from('wishlist')
      .insert([{ user_id: userId, product_id: productId }] as any);

    return { success: !error, isFavorited: true };
  }
};

export const addToWishlist = async (userId: string, productId: string) => {
  const { error } = await supabase
    .from('wishlist')
    .insert([{ user_id: userId, product_id: productId }] as any);

  return { success: !error };
};

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
  // Parallel fetching for wishlist products and refreshing favorites
  const [productsResponse, favoriteIds] = await Promise.all([
    supabase.from('products').select('*').in('id', productIds),
    getUserFavorites(userId)
  ]);

  const products = productsResponse.data;

  if (productsResponse.error || !products) {
    return [];
  }

  return (wishlistData as any[]).map((wl: any) => {
    const product = (products as any[]).find((p: any) => p.id === wl.product_id);
    if (!product) return null;

    return transformProduct(product, favoriteIds);
  }).filter((p): p is NonNullable<typeof p> => p !== null);
};

export const fetchWishlistCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('wishlist')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching wishlist count:', error);
    return 0;
  }

  return count || 0;
};