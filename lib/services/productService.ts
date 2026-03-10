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
const transformProduct = (product: Product, favoriteIds: string[] = []) => {
  const endsAt = (product as any).promotion_ends_at;
  const isExpired = endsAt ? new Date(endsAt) < new Date() : false;
  const discount = isExpired ? 0 : ((product as any).discount_percentage || 0);
  const hasDiscount = discount > 0;
  const discountedPrice = hasDiscount ? product.price * (1 - discount / 100) : product.price;

  return {
    id: product.id,
    name: product.name,
    price: `$${discountedPrice.toFixed(2)}`,
    originalPrice: hasDiscount ? `$${product.price.toFixed(2)}` : undefined,
    emoji: product.emoji || '🎨',
    image: product.image_url || product.images?.[0],
    rating: product.rating,
    reviews: product.reviews_count,
    shipping: product.shipping,
    outOfStock: product.out_of_stock || !product.in_stock || (product as any).stock_quantity === 0,
    category: product.category,
    condition: product.condition,
    description: product.description,
    images: product.images || [],
    status: (product as any).status,
    stock_quantity: (product as any).stock_quantity,
    cultural_origin: product.cultural_origin,
    cultural_story: (product as any).cultural_story,
    seller_id: (product as any).seller_id,
    isFavorited: favoriteIds.includes(product.id),
    badge: hasDiscount ? 'SALE' as const : product.is_featured ? 'HOT' as const : null,
    discount_percentage: discount,
  };
};

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
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .gt('stock_quantity', 0)
    .or('out_of_stock.is.null,out_of_stock.eq.false');

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
  const filters: FilterOptions = { sortBy: 'newest' };

  if (userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('shipping_preferences')
        .eq('id', userId)
        .single();

      if (profile?.shipping_preferences) {
        const prefs = profile.shipping_preferences as any;
        
        // If they prefer express, prioritize showing express items
        if (prefs.delivery_speed === 'express') {
          filters.shipping = 'Express Available';
        }
        
        // If they prefer local pickup, that takes precedence
        if (prefs.local_pickup) {
          filters.shipping = 'Pickup Available';
        }

        // If 'any' is selected or nothing is set, we don't apply a strict shipping filter
        // which allows 'both' standard and express items to show up.
      }
    } catch (error) {
      console.error('Error fetching profile for personalization:', error);
    }
  }

  return (await fetchProducts(0, 10, filters, userId)).products;
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
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, emoji, image_url, images')
    .in('id', productIds)
    .eq('status', 'active')
    .or('out_of_stock.is.null,out_of_stock.eq.false');

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
    
    // Track Save Analytics - ONLY IF NOT THE SELLER
    if (!error) {
      const { data: product } = await supabase.from('products').select('seller_id').eq('id', productId).single();
      if (product && product.seller_id !== userId) {
        await supabase.from('listing_analytics').insert({
          product_id: productId,
          seller_id: product.seller_id,
          event_type: 'save'
        });
        
        // Update product total_favorites
        await supabase.rpc('increment_total_favorites', { product_id: productId });
      }
    }
    
    return { success: !error, isFavorited: true };
  }
};

export const trackProductView = async (userId: string, productId: string, sellerId?: string) => {
  // Existing Recently Viewed logic
  const { error: rvError } = await supabase
    .from('recently_viewed')
    .upsert(
      [{ user_id: userId, product_id: productId, viewed_at: new Date().toISOString() }] as any,
      { onConflict: 'user_id,product_id' }
    );
    
  if (rvError) console.error('Error tracking recently viewed:', rvError);

  // Listing Analytics Logic
  try {
    let finalSellerId = sellerId;
    if (!finalSellerId) {
      const { data } = await supabase.from('products').select('seller_id').eq('id', productId).single();
      finalSellerId = data?.seller_id;
    }

    if (finalSellerId && finalSellerId !== userId) {
      await supabase.from('listing_analytics').insert({
        product_id: productId,
        seller_id: finalSellerId,
        event_type: 'view'
      });
      
      // Update product total_views
      await supabase.rpc('increment_total_views', { product_id: productId });
    }
  } catch (error) {
    console.error('Error tracking analytics view:', error);
  }
};

export const trackProductSale = async (productId: string, sellerId: string) => {
  try {
    await supabase.from('listing_analytics').insert({
      product_id: productId,
      seller_id: sellerId,
      event_type: 'sale'
    });
  } catch (error) {
    console.error('Error tracking analytics sale:', error);
  }
};


export const fetchWishlistCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('wishlist')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return 0;
  return count || 0;
};

export type DateRange = '7days' | '30days' | 'year' | 'all';

export const fetchSellerAnalytics = async (sellerId: string, range: DateRange = '30days') => {
  try {
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();
    let prevEndDate = new Date();

    if (range === '7days') {
      startDate.setDate(now.getDate() - 7);
      prevStartDate.setDate(now.getDate() - 14);
      prevEndDate.setDate(now.getDate() - 7);
    } else if (range === '30days') {
      startDate.setDate(now.getDate() - 30);
      prevStartDate.setDate(now.getDate() - 60);
      prevEndDate.setDate(now.getDate() - 30);
    } else if (range === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
      prevStartDate.setFullYear(now.getFullYear() - 2);
      prevEndDate.setFullYear(now.getFullYear() - 1);
    } else {
      startDate = new Date(0); // All time
    }

    const startDateStr = startDate.toISOString();
    const prevStartDateStr = prevStartDate.toISOString();
    const prevEndDateStr = prevEndDate.toISOString();

    // 1. Fetch Events (Current + Previous)
    const { data: allEvents, error: eventsError } = await supabase
      .from('listing_analytics')
      .select('event_type, created_at, product_id, products(cultural_origin)')
      .eq('seller_id', sellerId)
      .gte('created_at', range === 'all' ? startDateStr : prevStartDateStr);

    if (eventsError) throw eventsError;

    // Filter events into current and previous
    const events = allEvents.filter(e => new Date(e.created_at) >= startDate);
    const prevEvents = allEvents.filter(e => {
        const d = new Date(e.created_at);
        return d >= prevStartDate && d < startDate;
    });

    // 2. Fetch Orders (Current + Previous)
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('total_amount, created_at, status')
      .eq('seller_id', sellerId)
      .in('status', ['paid', 'shipped', 'delivered'])
      .gte('created_at', range === 'all' ? startDateStr : prevStartDateStr);

    if (ordersError) throw ordersError;

    const orders = allOrders.filter(o => new Date(o.created_at) >= startDate);
    const prevOrders = allOrders.filter(o => {
        const d = new Date(o.created_at);
        return d >= prevStartDate && d < startDate;
    });

    // Fulfillment counts (current state, regardless of date range for actionable items)
    // Actually, for the dashboard, we usually show "What's pending now"
    const { data: currentOrders } = await supabase
      .from('orders')
      .select('status')
      .eq('seller_id', sellerId)
      .in('status', ['paid', 'shipped']);

    const fulfillment = {
      toShip: currentOrders?.filter(o => o.status === 'paid').length || 0,
      inTransit: currentOrders?.filter(o => o.status === 'shipped').length || 0,
    };

    // 3. Compile Summary & Trends
    const curViews = events.filter(e => e.event_type === 'view').length;
    const curSaves = events.filter(e => e.event_type === 'save').length;
    const curSales = events.filter(e => e.event_type === 'sale').length;
    const curRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const curConv = curViews > 0 ? (curSales / curViews) * 100 : 0;

    const prevViews = prevEvents.filter(e => e.event_type === 'view').length;
    const prevSaves = prevEvents.filter(e => e.event_type === 'save').length;
    const prevSales = prevEvents.filter(e => e.event_type === 'sale').length;
    const prevRevenue = prevOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const prevConv = prevViews > 0 ? (prevSales / prevViews) * 100 : 0;

    const calculateTrend = (cur: number, prev: number, type: 'percent' | 'count' = 'percent') => {
        if (range === 'all') return '';
        if (type === 'percent') {
            if (prev === 0) return cur > 0 ? `+100%` : '+0%';
            const diff = ((cur - prev) / prev) * 100;
            return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
        } else {
            const diff = cur - prev;
            return `${diff >= 0 ? '+' : ''}${diff}`;
        }
    };

    const summary = {
      views: curViews,
      saves: curSaves,
      sales: curSales,
      revenue: curRevenue,
      trends: {
          revenue: calculateTrend(curRevenue, prevRevenue),
          sales: calculateTrend(curSales, prevSales, 'count') + ' orders',
          conversion: calculateTrend(curConv, prevConv),
          views: calculateTrend(curViews, prevViews, 'count')
      }
    };

    // 4. Time-series Data (Trends Chart)
    const trends: { label: string; value: number }[] = [];
    const isYear = range === 'year';
    
    if (isYear) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const monthLabel = d.toLocaleString('default', { month: 'short' });
        const count = events.filter(e => {
          const ed = new Date(e.created_at);
          return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear() && e.event_type === 'view';
        }).length;
        trends.push({ label: monthLabel, value: count });
      }
    } else {
      const days = range === '7days' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayLabel = d.toLocaleString('default', { weekday: 'short' }).substring(0, 1);
        const count = events.filter(e => {
          const ed = new Date(e.created_at);
          return ed.getDate() === d.getDate() && ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear() && e.event_type === 'view';
        }).length;
        trends.push({ label: range === '7days' ? dayLabel : d.getDate().toString(), value: count });
      }
    }

    // 5. Cultures Reached
    const cultures: { [key: string]: number } = {};
    events.forEach(e => {
      const origin = (e.products as any)?.cultural_origin || 'Unknown';
      cultures[origin] = (cultures[origin] || 0) + 1;
    });
    
    const culturalReach = Object.entries(cultures)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 6. Product Breakdown
    const { data: products } = await supabase
      .from('products')
      .select('id, name, image_url, images, price')
      .eq('seller_id', sellerId)
      .eq('status', 'active');

    const productStats = (products || []).map(p => {
      const pEvents = events.filter(e => e.product_id === p.id);
      const views = pEvents.filter(e => e.event_type === 'view').length;
      const saves = pEvents.filter(e => e.event_type === 'save').length;
      const sales = pEvents.filter(e => e.event_type === 'sale').length;
      
      return {
        id: p.id,
        name: p.name,
        image_url: p.image_url || (p as any).images?.[0] || null,
        price: p.price,
        views,
        saves,
        sales,
        conversion: views > 0 ? (sales / views) * 100 : 0
      };
    }).sort((a, b) => b.views - a.views).slice(0, 10);

    return { summary, trends, culturalReach, productStats, fulfillment };
  } catch (error) {
    console.error('Error fetching seller analytics:', error);
    return null;
  }
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
    supabase.from('products').select('*').in('id', productIds).eq('status', 'active'),
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
    stock_quantity: typeof (product as any).stock_quantity === 'number' ? (product as any).stock_quantity : 10,
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
      .eq('status', 'active')
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
      .eq('status', 'active')
      .gt('stock_quantity', 0)
      .or('out_of_stock.is.null,out_of_stock.eq.false')
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
  const hasStock = (listingData.stock_quantity ?? 1) > 0;

  const payload = {
    ...listingData,
    in_stock: hasStock,
    out_of_stock: !hasStock,
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