import { supabase } from "../supabase";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from "../../types/database";

type Product = Database['public']['Tables']['products']['Row'];

// Helper: Get user favorites
const getUserFavorites = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('wishlist')
    .select('product_id')
    .eq('user_id', userId) as { data: { product_id: string }[] | null };

  return data?.map(f => f.product_id) || [];
};

// Helper: Transform product for UI
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
  category: product.category,
  isFavorited: favoriteIds.includes(product.id),
  badge: product.is_featured ? 'HOT' as const : null,
});

// Filter Options Interface
export interface FilterOptions {
  categories?: string[];
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'like_new' | 'good' | 'fair';
  shipping?: string;
  culture?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popularity';
}

// Unified fetch function
export const fetchProducts = async (
  page: number = 0,
  limit: number = 12,
  filters: FilterOptions = {},
  userId?: string
) => {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });

  // 1. Categories (multiple)
  if (filters.categories && filters.categories.length > 0) {
    query = query.in('category', filters.categories);
  }

  // 2. Search
  if (filters.searchQuery) {
    query = query.ilike('name', `%${filters.searchQuery}%`);
  }

  // 3. Price Range
  if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice);

  // 4. Condition & Shipping & Culture
  if (filters.condition) query = query.eq('condition', filters.condition);
  if (filters.shipping) {
    if (filters.shipping === 'Free Shipping') {
      query = query.eq('free_shipping', true);
    } else if (filters.shipping === 'Express Available') {
      query = query.eq('express_shipping', true);
    } else if (filters.shipping === 'Pickup Available') {
      query = query.eq('pickup_available', true);
    }
  }
  if (filters.culture) query = query.ilike('cultural_origin', `%${filters.culture}%`);

  // 5. Sorting
  switch (filters.sortBy) {
    case 'price_asc': query = query.order('price', { ascending: true }); break;
    case 'price_desc': query = query.order('price', { ascending: false }); break;
    case 'popularity': query = query.order('total_favorites', { ascending: false }); break;
    case 'newest':
    default: query = query.order('created_at', { ascending: false }); break;
  }

  // Pagination
  query = query.range(page * limit, (page + 1) * limit - 1);

  // Parallel execution
  const [productsResponse, favoriteIds] = await Promise.all([
    query,
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data, error, count } = productsResponse;

  if (error) {
    console.error('Error fetching products:', error);
    return { products: [], count: 0 };
  }

  const products = data ? data.map(p => transformProduct(p, favoriteIds)) : [];
  return { products, count: count || 0 };
};

// Specific fetchers for Home screen (reusing fetchProducts)
export const fetchForYouProducts = async (userId?: string) => {
  return (await fetchProducts(0, 10, { sortBy: 'newest' }, userId)).products;
};

export const fetchHotProducts = async (userId?: string) => {
  return (await fetchProducts(0, 10, { sortBy: 'popularity' }, userId)).products;
};

export const fetchRecentlyViewed = async (userId: string) => {
  // Get the last cleared timestamp
  const lastCleared = await AsyncStorage.getItem(`last_cleared_history_${userId}`);

  let query = supabase
    .from('recently_viewed')
    .select('product_id, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(20);

  // Filter out items viewed before the last clear
  if (lastCleared) {
    query = query.gt('viewed_at', lastCleared);
  }

  const { data: recentlyViewedData, error: rvError } = await query;

  if (rvError || !recentlyViewedData || recentlyViewedData.length === 0) return [];

  const productIds = (recentlyViewedData as any[]).map((rv: any) => rv.product_id);
  const { data: products } = await supabase.from('products').select('id, name, price, emoji, image_url, images').in('id', productIds);

  if (!products) return [];
  const productsMap = new Map((products as any[]).map(p => [p.id, p]));

  return (recentlyViewedData as any[]).map((rv: any) => {
    const product = productsMap.get(rv.product_id);
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

export const clearRecentlyViewed = async (userId: string) => {
  console.log('Attempting to clear history for user:', userId);

  // Set the last cleared timestamp locally
  await AsyncStorage.setItem(`last_cleared_history_${userId}`, new Date().toISOString());

  const { error, count } = await supabase
    .from('recently_viewed')
    .delete({ count: 'exact' })
    .eq('user_id', userId);

  console.log('Clear history result:', { error, count });

  // Return true even if DB delete fails, as we're hiding them locally
  return true;
};

export const toggleFavorite = async (userId: string, productId: string) => {
  const { data: existing } = await supabase
    .from('wishlist')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('wishlist').delete().eq('id', (existing as any).id);
    return { success: !error, isFavorited: false };
  } else {
    const { error } = await supabase.from('wishlist').insert([{ user_id: userId, product_id: productId }] as any);
    return { success: !error, isFavorited: true };
  }
};

export const trackProductView = async (userId: string, productId: string) => {
  const { error } = await supabase
    .from('recently_viewed')
    .upsert(
      [{ user_id: userId, product_id: productId, viewed_at: new Date().toISOString() }] as any,
      { onConflict: 'user_id,product_id' }
    );
  if (error) console.error('Error tracking view:', error);
};

export const fetchWishlistCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('wishlist')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return 0;
  return count || 0;
};

export const fetchWishlist = async (userId: string) => {
  const { data: wishlistData, error: wishlistError } = await supabase
    .from('wishlist')
    .select('product_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (wishlistError || !wishlistData || wishlistData.length === 0) return [];

  const productIds = (wishlistData as any[]).map((w: any) => w.product_id);
  const [productsResponse, favoriteIds] = await Promise.all([
    supabase.from('products').select('*').in('id', productIds),
    getUserFavorites(userId)
  ]);

  const products = productsResponse.data;
  if (!products) return [];

  return (wishlistData as any[]).map((wl: any) => {
    const product = (products as any[]).find((p: any) => p.id === wl.product_id);
    if (!product) return null;
    return transformProduct(product, favoriteIds);
  }).filter((p): p is NonNullable<typeof p> => p !== null);
};

// Fetch single product by ID with full details
export const fetchProductById = async (productId: string, userId?: string) => {
  const [productResponse, favoriteIds] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).single(),
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data: product, error } = productResponse;

  if (error || !product) {
    console.error('Error fetching product:', error);
    return null;
  }

  // Fetch seller details separately to avoid join errors
  let sellerProfile = null;
  if ((product as any).user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', (product as any).user_id)
      .single();
    sellerProfile = data;
  }

  return {
    ...transformProduct(product, favoriteIds),
    description: (product as any).description || '',
    images: (product as any).images && (product as any).images.length > 0
      ? (product as any).images
      : (product as any).image_url
        ? [(product as any).image_url]
        : [],
    category: (product as any).category || 'all',
    condition: (product as any).condition || 'New',
    cultural_origin: (product as any).cultural_origin || '',
    dimensions: (product as any).dimensions || '',
    returns_policy: (product as any).returns_policy || '7 days',
    seller_name: sellerProfile?.full_name || 'Unknown Seller',
    seller_id: (product as any).user_id,
    seller_avatar: sellerProfile?.avatar_url,
    seller_rating: (product as any).seller_rating || 4.5,
    seller_reviews_count: (product as any).seller_reviews_count || 0,
    seller_location: (product as any).seller_location || 'Berlin',
    pickup_available: (product as any).pickup_available || false,
    free_shipping: (product as any).free_shipping || false,
    express_shipping: (product as any).express_shipping || false,
    shipping_days_min: (product as any).shipping_days_min || 3,
    shipping_days_max: (product as any).shipping_days_max || 5,
    stock_quantity: (product as any).stock_quantity || 10,
    cultural_story: (product as any).cultural_story || '',
  };
};

// Fetch other products by the same seller
export const fetchSellerProducts = async (
  sellerId: string,
  excludeProductId: string,
  limit: number = 6,
  userId?: string
) => {
  const [productsResponse, favoriteIds] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .neq('id', excludeProductId)
      .limit(limit),
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data: products, error } = productsResponse;

  if (error || !products) {
    return [];
  }

  return products.map(p => transformProduct(p, favoriteIds));
};

// Fetch similar products based on category and price
export const fetchSimilarProducts = async (
  productId: string,
  category: string,
  price: number,
  limit: number = 8,
  userId?: string
) => {
  const priceMin = price * 0.7; // 30% lower
  const priceMax = price * 1.3; // 30% higher

  const [productsResponse, favoriteIds] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .neq('id', productId)
      .gte('price', priceMin)
      .lte('price', priceMax)
      .limit(limit),
    userId ? getUserFavorites(userId) : Promise.resolve([])
  ]);

  const { data: products, error } = productsResponse;

  if (error || !products) {
    return [];
  }

  return products.map(p => transformProduct(p, favoriteIds));
};

// Create or update a product listing
export const createListing = async (listingData: {
  id?: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  cultural_origin?: string;
  cultural_story?: string;
  images: string[];
  status?: 'active' | 'draft';
  stock_quantity?: number;
}) => {
  const payload = {
    ...listingData,
    in_stock: true,
    updated_at: new Date().toISOString(),
  };

  // If this is a new listing, remove the ID key so the DB generates it
  if (!listingData.id) {
    delete (payload as any).id;
  }

  // Ensure seller_id is set (fallback for older migrations)
  (payload as any).seller_id = listingData.user_id;

  // Fetch seller info to satisfy NOT NULL constraints
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', listingData.user_id)
    .single();

  (payload as any).seller_name = profile?.full_name || 'Culturar Seller';
  (payload as any).seller_avatar = profile?.avatar_url || '';


  let query;
  if (listingData.id) {
    query = supabase
      .from('products')
      .update(payload as any)
      .eq('id', listingData.id);
  } else {
    query = supabase
      .from('products')
      .insert([{
        ...payload,
        created_at: new Date().toISOString(),
      }] as any);
  }

  const { data, error } = await query.select().single();

  if (error) {
    console.error('Error creating listing:', error);
    throw error;
  }

  return data;
};

// Fetch user drafts
export const fetchUserDrafts = async (userId: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching drafts:', error);
    return [];
  }

  return (data as Product[]).map(p => ({
    ...transformProduct(p),
    full_data: p // Keep original data for editing
  }));
};

// Fetch user active listings
export const fetchUserActiveListings = async (userId: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active listings:', error);
    return [];
  }

  return (data as Product[]).map(p => ({
    ...transformProduct(p),
    full_data: p
  }));
};

// Upload multiple images to Supabase Storage
export const uploadProductImages = async (
  userId: string,
  images: { base64: string, uri: string }[]
): Promise<string[]> => {
  const uploadPromises = images.map(async (img, index) => {
    const { decode } = await import('base64-arraybuffer');
    const fileName = `${userId}/${Date.now()}-${index}.jpg`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('product-images') // Ensure this bucket exists
      .upload(filePath, decode(img.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  });

  return Promise.all(uploadPromises);
};

// Delete a listing
export const deleteListing = async (productId: string) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting listing:', error);
    throw error;
  }
  return true;
};