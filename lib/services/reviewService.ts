import { supabase } from '../supabase';

export interface ReviewWithDetails {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  seller_replied_at: string | null;
  created_at: string;
  // Joined fields
  product_name: string;
  product_image: string | null;
  buyer_name: string;
  buyer_avatar?: string | null;
  // New fields
  type: 'product' | 'shop';
  order_id?: string;
}

export const fetchSellerReviews = async (sellerId: string): Promise<ReviewWithDetails[]> => {
  try {
    // 1. Fetch ALL reviews for this seller (includes both type='product' and type='shop')
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;
    if (!reviews || reviews.length === 0) return [];

    // 2. Fetch related product details and buyer profiles in parallel
    const productIds = Array.from(new Set(reviews.map(r => r.product_id).filter(Boolean)));
    const userIds = Array.from(new Set(reviews.map(r => r.user_id)));

    const [productsResult, profilesResult] = await Promise.all([
      supabase.from('products').select('id, name, image_url, images').in('id', productIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    ]);

    const productMap = new Map((productsResult.data || []).map(p => [p.id, p]));
    const profileMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

    // 3. Map everything together
    return reviews.map((r: any) => {
      const product = r.product_id ? productMap.get(r.product_id) : null;
      const buyer = profileMap.get(r.user_id);
      return {
        id: r.id,
        product_id: r.product_id,
        user_id: r.user_id,
        rating: r.rating,
        comment: r.comment,
        seller_reply: r.seller_reply,
        seller_replied_at: r.seller_replied_at,
        created_at: r.created_at,
        type: r.type || 'product',
        order_id: r.order_id,
        product_name: r.type === 'shop' ? 'Shop Feedback' : (product?.name || 'Unknown Product'),
        product_image: product?.image_url || product?.images?.[0] || null,
        buyer_name: buyer?.full_name || 'Anonymous User',
        buyer_avatar: buyer?.avatar_url || null,
      };
    });
  } catch (error) {
    console.error('Error fetching seller reviews:', error);
    return [];
  }
};

export const fetchProductReviews = async (productId: string): Promise<ReviewWithDetails[]> => {
  try {
    // 1. Fetch reviews for the specific product
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;
    if (!reviews || reviews.length === 0) return [];

    // 2. Fetch buyer profiles manually to avoid cross-schema foreign key issues
    const userIds = Array.from(new Set(reviews.map(r => r.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // 3. Map everything together
    return reviews.map((r: any) => {
      const buyer = profileMap.get(r.user_id);
      return {
        id: r.id,
        product_id: r.product_id,
        user_id: r.user_id,
        rating: r.rating,
        comment: r.comment,
        seller_reply: r.seller_reply,
        seller_replied_at: r.seller_replied_at,
        created_at: r.created_at,
        type: 'product',
        product_name: '', // Not strictly needed for item view, but keeping interface
        product_image: null,
        buyer_name: buyer?.full_name || 'Anonymous User',
        buyer_avatar: buyer?.avatar_url || null, // Optional addition for nice UI
      };
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return [];
  }
};

export const replyToReview = async (reviewId: string, replyText: string) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        seller_reply: replyText,
        seller_replied_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error replying to review:', error);
    return { success: false, error };
  }
};

export const deleteReviewReply = async (reviewId: string) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        seller_reply: null,
        seller_replied_at: null,
      })
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting review reply:', error);
    return { success: false, error };
  }
};
