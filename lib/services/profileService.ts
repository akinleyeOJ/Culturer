import { supabase } from '../supabase';
import type { Database } from '../../types/database';

export const fetchPublicSellerProfile = async (sellerId: string) => {
    // 1. Fetch the seller's public profile data
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
            id,
            full_name,
            bio,
            avatar_url,
            cover_url,
            location,
            cultures,
            spoken_languages,
            shipping_regions,
            shop_policies,
            created_at
        `)
        .eq('id', sellerId)
        .single();

    if (profileError || !profile) {
        console.error('Error fetching seller profile:', profileError);
        return null;
    }

    // 2. Compute aggregate ratings from the reviews table
    const { data: reviews, error: reviewError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('seller_id', sellerId);

    let averageRating = 0;
    let reviewCount = 0;

    if (!reviewError && reviews) {
        reviewCount = reviews.length;
        if (reviewCount > 0) {
            const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
            averageRating = sum / reviewCount;
        }
    }

    // 3. Fetch follower count
    const { count: followerCount, error: followCountError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', sellerId);

    // 4. Fetch following count
    const { count: followingCount, error: followingCountError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', sellerId);

    return {
        ...profile,
        average_rating: averageRating,
        review_count: reviewCount,
        follower_count: followerCount || 0,
        following_count: followingCount || 0,
    };
};

export const getFollowStatus = async (followerId: string, sellerId: string) => {
    if (!followerId || !sellerId) return false;

    const { data, error } = await supabase
        .from('user_follows')
        .select('created_at')
        .eq('follower_id', followerId)
        .eq('following_id', sellerId)
        .maybeSingle();

    if (error) {
        console.error('Error checking follow status:', error);
        return false;
    }

    return !!data;
};

export const toggleFollowSeller = async (followerId: string, sellerId: string, currentlyFollowing: boolean) => {
    if (!followerId || !sellerId) return { success: false, isFollowing: currentlyFollowing };

    if (currentlyFollowing) {
        // Unfollow
        const { error } = await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', sellerId);

        if (error) {
            console.error('Error unfollowing seller:', error);
            return { success: false, isFollowing: currentlyFollowing };
        }
        return { success: true, isFollowing: false };
    } else {
        // Follow
        const { error } = await supabase
            .from('user_follows')
            .insert({
                follower_id: followerId,
                following_id: sellerId
            });

        if (error) {
            console.error('Error following seller:', error);
            return { success: false, isFollowing: currentlyFollowing };
        }
        return { success: true, isFollowing: true };
    }
};
