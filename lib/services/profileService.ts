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
            is_verified,
            verification_status,
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

export const requestVerification = async (userId: string, documentUrl: string) => {
    if (!userId || !documentUrl) return { success: false };

    const { error } = await supabase
        .from('profiles')
        .update({ 
            verification_status: 'pending',
            verification_document_url: documentUrl
        })
        .eq('id', userId);

    if (error) {
        console.error('Error requesting verification:', error);
        return { success: false, error };
    }

    return { success: true };
};

export const cancelVerification = async (userId: string) => {
    if (!userId) return { success: false };

    const { error } = await supabase
        .from('profiles')
        .update({ 
            verification_status: 'none',
            verification_document_url: null 
        })
        .eq('id', userId);

    if (error) {
        console.error('Error cancelling verification:', error);
        return { success: false, error };
    }

    return { success: true };
};

// Admin Service Functions
export const fetchPendingVerifications = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, verification_status, verification_document_url, created_at')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching pending verifications:', error);
        return { success: false, error };
    }

    return { success: true, data };
};

export const updateVerificationStatus = async (
    userId: string, 
    status: 'verified' | 'rejected',
    isVerified: boolean = false,
    rejectionReason?: string
) => {
    const { error } = await supabase
        .from('profiles')
        .update({ 
            verification_status: status,
            is_verified: isVerified,
            verification_rejection_reason: rejectionReason || null
        })
        .eq('id', userId);

    if (error) {
        console.error(`Error updating verification to ${status}:`, error);
        return { success: false, error };
    }

    return { success: true };
};

export const getSignedImageUrl = async (bucket: string, path: string, expiresIn: number = 3600) => {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

    if (error) {
        console.error('Error creating signed URL:', error);
        return null;
    }

    return data.signedUrl;
};
