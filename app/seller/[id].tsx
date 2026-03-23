import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Dimensions,
    Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/color';
import { ChevronLeftIcon, MagnifyingGlassIcon, CheckBadgeIcon, QuestionMarkCircleIcon } from 'react-native-heroicons/outline';
import { MapPinIcon, GlobeAltIcon, LanguageIcon, StarIcon } from 'react-native-heroicons/solid';
import { useAuth } from '../../contexts/AuthContext';

import { fetchPublicSellerProfile, getFollowStatus, toggleFollowSeller } from '../../lib/services/profileService';
import { fetchSellerInventory, FilterOptions, toggleFavorite } from '../../lib/services/productService';
import { fetchSellerReviews, ReviewWithDetails } from '../../lib/services/reviewService';
import { ProductCard } from '../../components/Card';
import { useCart } from '../../contexts/CartContext';
import { addToCart } from '../../lib/services/cartService';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

type StoreTab = 'shop' | 'policies' | 'reviews';

export default function PublicSellerProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [seller, setSeller] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<StoreTab>('shop');
    
    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followActionLoading, setFollowActionLoading] = useState(false);
    
    // Inventory State
    const [inventory, setInventory] = useState<any[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterOptions>({});
    
    // Reviews State
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    
    const { refreshCartCount } = useCart();
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    
    // Categories derived from the fetched inventory
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        loadProfile();
        checkFollowStatus();
        loadReviews();
    }, [id]);

    useEffect(() => {
        if (id) loadInventory();
    }, [id, searchQuery, selectedCategory]);

    const loadProfile = async () => {
        const data = await fetchPublicSellerProfile(id);
        setSeller(data);
        setLoading(false);
    };

    const checkFollowStatus = async () => {
        if (!user || user.id === id) return;
        const status = await getFollowStatus(user.id, id);
        setIsFollowing(status);
    };

    const loadInventory = async () => {
        setInventoryLoading(true);
        const appliedFilters: FilterOptions = {
            searchQuery: searchQuery || undefined,
            categories: selectedCategory ? [selectedCategory] : undefined,
        };
        
        const { products } = await fetchSellerInventory(id, 0, 100, appliedFilters, user?.id);
        setInventory(products);
        
        // Extract unique categories from all products exactly once
        if (!searchQuery && !selectedCategory && products.length > 0) {
            const uniqueCats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
            setAvailableCategories(uniqueCats as string[]);
        }
        
        setInventoryLoading(false);
    };

    const loadReviews = async () => {
        if (!id) return;
        setReviewsLoading(true);
        const data = await fetchSellerReviews(id);
        // User requested: "item review should not be visible on seller reviews tab"
        setReviews(data.filter(r => r.type === 'shop'));
        setReviewsLoading(false);
    };

    const handleFollowPress = async () => {
        if (!user) {
            // Need to sign in to follow
            return;
        }
        setFollowActionLoading(true);
        const result = await toggleFollowSeller(user.id, id, isFollowing);
        if (result.success) {
            setIsFollowing(result.isFollowing);
            setSeller((prev: any) => ({
                ...prev,
                follower_count: prev.follower_count + (result.isFollowing ? 1 : -1)
            }));
        }
        setFollowActionLoading(false);
    };

    const handleToggleFavorite = async (productId: string) => {
        if (!user) {
            Alert.alert("Sign In Required", "Please sign in to save items");
            return;
        }
        
        // Optimistic update
        setInventory(current => 
            current.map(p => 
                p.id === productId ? { ...p, isFavorited: !p.isFavorited } : p
            )
        );
        
        const isFav = await toggleFavorite(user.id, productId);
        
        // Revert on failure
        if (isFav === null) {
            setInventory(current => 
                current.map(p => 
                    p.id === productId ? { ...p, isFavorited: !p.isFavorited } : p
                )
            );
        }
    };

    const handleAddToCart = async (productId: string, outOfStock: boolean) => {
        if (!user) {
            Alert.alert("Sign In Required", "Please sign in to add items to cart");
            return;
        }
        if (outOfStock) {
            Alert.alert("Unavailable", "This item is sold out or out of stock.");
            return;
        }
        
        const { success } = await addToCart(user.id, productId, 1);
        if (success) {
            await refreshCartCount();
        } else {
            Alert.alert('Error', 'Failed to add item to cart. Please try again.');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    if (!seller) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Seller not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardDismissMode="on-drag">
                {/* Header / Banner Area */}
                <View style={styles.bannerContainer}>
                    {seller.cover_url ? (
                        <Image source={{ uri: seller.cover_url }} style={styles.coverImage} />
                    ) : (
                        <View style={[styles.coverImage, { backgroundColor: Colors.primary[100] }]} />
                    )}
                    
                    {/* Fixed Navbar Overlay */}
                    <View style={styles.navbarOverlay}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonOverlay}>
                            <ChevronLeftIcon size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Profile Card Overlay */}
                <View style={styles.profileMetaContainer}>
                    <View style={styles.avatarWrapper}>
                        {seller.avatar_url ? (
                            <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: Colors.neutral[200], justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={styles.avatarText}>{seller.full_name?.substring(0, 1) || '?'}</Text>
                            </View>
                        )}
                        {seller.is_verified && (
                            <TouchableOpacity 
                                style={styles.verifiedBadge}
                                onPress={() => setShowVerificationModal(true)}
                                activeOpacity={0.8}
                            >
                                <CheckBadgeIcon size={18} color={Colors.primary[500]} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.sellerName}>{seller.full_name}</Text>
                    
                    <View style={styles.badgesRow}>
                        {seller.location && (
                            <View style={styles.metaBadge}>
                                <MapPinIcon size={14} color={Colors.text.secondary} />
                                <Text style={styles.metaBadgeText}>{seller.location}</Text>
                            </View>
                        )}
                        <View style={styles.metaBadge}>
                            <StarIcon size={14} color="#F59E0B" />
                            <Text style={styles.metaBadgeText}>
                                {seller.average_rating > 0 ? seller.average_rating.toFixed(1) : 'No reviews'} ({seller.review_count})
                            </Text>
                        </View>
                    </View>

                    {/* Follow Action */}
                    {user?.id !== seller.id && (
                        <TouchableOpacity 
                            style={[styles.followButton, isFollowing && styles.followingButton]}
                            onPress={handleFollowPress}
                            disabled={followActionLoading}
                        >
                            {followActionLoading ? (
                                <ActivityIndicator size="small" color={isFollowing ? Colors.text.primary : '#FFF'} />
                            ) : (
                                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                                    {isFollowing ? 'Following' : 'Follow shop'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bio & Trust Dimensions */}
                <View style={styles.bioSection}>
                    {seller.bio && (
                        <Text style={styles.bioText}>{seller.bio}</Text>
                    )}

                    <View style={styles.trustPillsContainer}>
                        {seller.cultures && seller.cultures.length > 0 && (
                            <View style={styles.trustPill}>
                                <GlobeAltIcon size={16} color={Colors.primary[600]} />
                                <Text style={styles.trustPillValue}>
                                    {seller.cultures.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
                                </Text>
                            </View>
                        )}
                        {seller.spoken_languages && seller.spoken_languages.length > 0 && (
                            <View style={styles.trustPill}>
                                <LanguageIcon size={16} color={Colors.primary[600]} />
                                <Text style={styles.trustPillLabel}>Speaks: </Text>
                                <Text style={styles.trustPillValue}>{seller.spoken_languages.join(', ')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
                        onPress={() => setActiveTab('shop')}
                    >
                        <Text style={[styles.tabText, activeTab === 'shop' && styles.activeTabText]}>Shop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'policies' && styles.activeTab]}
                        onPress={() => setActiveTab('policies')}
                    >
                        <Text style={[styles.tabText, activeTab === 'policies' && styles.activeTabText]}>Policies</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
                        onPress={() => setActiveTab('reviews')}
                    >
                        <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Reviews</Text>
                    </TouchableOpacity>
                </View>

                {/* Content Area */}
                <View style={styles.tabContent}>
                    {activeTab === 'shop' ? (
                        <View style={styles.shopContainer}>
                            {/* Search & Filters */}
                            <View style={styles.filterSection}>
                                <View style={styles.searchBar}>
                                    <MagnifyingGlassIcon size={20} color={Colors.text.tertiary} />
                                    <TextInput 
                                        style={styles.searchInput}
                                        placeholder="Search shop..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholderTextColor={Colors.text.tertiary}
                                    />
                                </View>

                                {availableCategories.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                                        <TouchableOpacity 
                                            style={[styles.categoryPill, !selectedCategory && styles.activeCategoryPill]}
                                            onPress={() => setSelectedCategory(null)}
                                        >
                                            <Text style={[styles.categoryPillText, !selectedCategory && styles.activeCategoryPillText]}>All items</Text>
                                        </TouchableOpacity>
                                        
                                        {availableCategories.map(cat => (
                                            <TouchableOpacity 
                                                key={cat}
                                                style={[styles.categoryPill, selectedCategory === cat && styles.activeCategoryPill]}
                                                onPress={() => setSelectedCategory(cat)}
                                            >
                                                <Text style={[styles.categoryPillText, selectedCategory === cat && styles.activeCategoryPillText]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* Inventory Grid */}
                            {inventoryLoading ? (
                                <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                            ) : inventory.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No items found in this shop.</Text>
                                </View>
                            ) : (
                                <View style={styles.grid}>
                                    {inventory.map(item => (
                                        <View key={item.id} style={styles.gridItem}>
                                            <ProductCard 
                                                name={item.name}
                                                price={item.price}
                                                originalPrice={item.originalPrice}
                                                image={item.image}
                                                emoji={item.emoji}
                                                rating={item.rating}
                                                reviews={item.reviews}
                                                shipping={item.shipping}
                                                outOfStock={item.status === 'sold' || item.outOfStock}
                                                showSoldOutOverlay={item.status === 'sold'}
                                                hideFavoriteButton={user?.id === seller.id}
                                                hideAddToCartButton={user?.id === seller.id}
                                                isLiked={item.isFavorited}
                                                onLike={() => handleToggleFavorite(item.id)}
                                                onAddToCart={() => handleAddToCart(item.id, item.status === 'sold' || item.outOfStock)}
                                                onPress={() => router.push(`/item/${item.id}`)}
                                            />
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : activeTab === 'policies' ? (
                        <ScrollView style={styles.policiesContainer} showsVerticalScrollIndicator={false}>
                            {seller.shop_policies && Object.keys(seller.shop_policies).length > 0 ? (
                                <View style={styles.policyCard}>
                                    {seller.shop_policies.processing_time && (
                                        <View style={styles.policyRow}>
                                            <Text style={styles.policyTitle}>Processing Time</Text>
                                            <Text style={styles.policyDetail}>{seller.shop_policies.processing_time}</Text>
                                        </View>
                                    )}
                                    {seller.shop_policies.response_time && (
                                        <View style={styles.policyRow}>
                                            <Text style={styles.policyTitle}>Typical Response Time</Text>
                                            <Text style={styles.policyDetail}>{seller.shop_policies.response_time}</Text>
                                        </View>
                                    )}
                                    <View style={styles.policyRow}>
                                        <Text style={styles.policyTitle}>Accepts Returns & Exchanges</Text>
                                        <Text style={styles.policyDetail}>
                                            {seller.shop_policies.accepts_returns ? 'Yes' : 'No'}
                                        </Text>
                                        {seller.shop_policies.accepts_returns && seller.shop_policies.return_window_days && (
                                            <Text style={styles.policySubDetail}>
                                                Within {seller.shop_policies.return_window_days} days of delivery
                                            </Text>
                                        )}
                                    </View>
                                    {seller.shop_policies.return_shipping && (
                                        <View style={styles.policyRow}>
                                            <Text style={styles.policyTitle}>Return Shipping</Text>
                                            <Text style={styles.policyDetail}>{seller.shop_policies.return_shipping}</Text>
                                        </View>
                                    )}
                                    <View style={styles.policyRow}>
                                        <Text style={styles.policyTitle}>Accepts Cancellations</Text>
                                        <Text style={styles.policyDetail}>
                                            {seller.shop_policies.accepts_cancellations ? 'Yes' : 'No'}
                                        </Text>
                                    </View>
                                    
                                    {seller.shop_policies.additional_terms ? (
                                        <View style={[styles.policyRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                                            <Text style={styles.policyTitle}>Additional Terms</Text>
                                            <Text style={styles.policyDetail}>{seller.shop_policies.additional_terms}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : (
                                <Text style={styles.noPoliciesText}>This shop has no detailed policies listed.</Text>
                            )}

                            {/* Shop FAQs Section */}
                            {seller.shop_policies?.faqs && seller.shop_policies.faqs.length > 0 && (
                                <View style={styles.faqSection}>
                                    <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
                                    {seller.shop_policies.faqs.map((faq: any, index: number) => (
                                        <View key={faq.id || index} style={styles.faqCard}>
                                            <View style={styles.faqQuestionRow}>
                                                <QuestionMarkCircleIcon size={20} color={Colors.primary[500]} />
                                                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                                            </View>
                                            <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    ) : (
                        <View style={styles.reviewsContainer}>
                            {reviewsLoading ? (
                                <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                            ) : reviews.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No reviews yet for this shop.</Text>
                                </View>
                            ) : (
                                reviews.map(item => (
                                    <View key={item.id} style={styles.buyerReviewCard}>
                                        <View style={styles.reviewHeader}>
                                            <View style={styles.buyerInfo}>
                                                <Text style={styles.buyerRowName}>{item.buyer_name}</Text>
                                                <View style={styles.ratingRow}>
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <StarIcon 
                                                            key={star} 
                                                            size={12} 
                                                            color={star <= item.rating ? "#F59E0B" : Colors.neutral[300]} 
                                                        />
                                                    ))}
                                                </View>
                                            </View>
                                            <Text style={styles.reviewDate}>
                                                {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </Text>
                                        </View>
                                        <Text style={styles.reviewComment}>{item.comment}</Text>
                                        {item.type === 'product' && (
                                            <View style={styles.reviewedItemBadge}>
                                                <Text style={styles.reviewedItemText}>Item: {item.product_name}</Text>
                                            </View>
                                        )}
                                        {item.seller_reply && (
                                            <View style={styles.sellerReply}>
                                                <Text style={styles.replyLabel}>Seller Response</Text>
                                                <Text style={styles.replyContent}>{item.seller_reply}</Text>
                                            </View>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Verification Info Modal */}
            <Modal
                visible={showVerificationModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowVerificationModal(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowVerificationModal(false)}
                >
                    <View style={styles.infoModalContent}>
                        <View style={styles.modalHeader}>
                            <CheckBadgeIcon size={32} color={Colors.primary[500]} />
                            <Text style={styles.modalTitle}>Verified Seller</Text>
                        </View>
                        <Text style={styles.modalDescription}>
                            This seller has completed our standard identity verification check. We've verified their government-issued ID to confirm they are a real person, helping ensure a safer community for everyone.
                        </Text>
                        <TouchableOpacity 
                            style={styles.modalCloseButton}
                            onPress={() => setShowVerificationModal(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: Colors.text.secondary,
    },
    bannerContainer: {
        width: '100%',
        height: 140,
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    navbarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonOverlay: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    profileMetaContainer: {
        backgroundColor: '#FFF',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 24,
        marginTop: -30,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 5,
    },
    avatarWrapper: {
        position: 'relative',
        marginTop: -32,
        marginBottom: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 4,
        borderColor: '#FFF',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.neutral[500],
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 2,
    },
    sellerName: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    badgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaBadgeText: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    followButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
        width: '80%',
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.neutral[300],
    },
    followButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    followingButtonText: {
        color: Colors.text.primary,
    },
    bioSection: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        backgroundColor: '#F9FAFB',
    },
    bioText: {
        fontSize: 15,
        color: Colors.text.secondary,
        lineHeight: 22,
        marginBottom: 20,
        textAlign: 'center',
    },
    trustPillsContainer: {
        flexDirection: 'column',
        gap: 12,
    },
    trustPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    trustPillLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    trustPillValue: {
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
        flex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
        backgroundColor: '#FFF',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary[500],
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    activeTabText: {
        color: Colors.primary[500],
    },
    tabContent: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        minHeight: 400,
    },
    shopContainer: {
        paddingTop: 16,
    },
    filterSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: Colors.text.primary,
    },
    categoriesScroll: {
        marginBottom: 8,
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        marginRight: 8,
    },
    activeCategoryPill: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[200],
    },
    categoryPillText: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    activeCategoryPillText: {
        color: Colors.primary[600],
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
    },
    gridItem: {
        width: '50%',
        padding: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        fontSize: 15,
        color: Colors.text.tertiary,
    },
    policiesContainer: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },
    policyCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    policyRow: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
        paddingBottom: 16,
        marginBottom: 16,
    },
    policyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.secondary,
        marginBottom: 4,
    },
    policyDetail: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.text.primary,
        lineHeight: 22,
    },
    policySubDetail: {
        fontSize: 13,
        color: Colors.neutral[500],
        marginTop: 4,
    },
    noPoliciesText: {
        fontSize: 15,
        color: Colors.text.tertiary,
        textAlign: 'center',
        marginTop: 40,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    infoModalContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalDescription: {
        fontSize: 15,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalCloseButton: {
        backgroundColor: Colors.primary[500],
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    modalCloseButtonText: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: '700',
    },
    // Reviews Section Styles
    reviewsContainer: {
        padding: 20,
    },
    buyerReviewCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    buyerInfo: {
        flex: 1,
    },
    buyerRowName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewDate: {
        fontSize: 12,
        color: Colors.text.tertiary,
    },
    reviewComment: {
        fontSize: 14,
        color: Colors.text.secondary,
        lineHeight: 20,
        marginBottom: 10,
    },
    reviewedItemBadge: {
        backgroundColor: Colors.neutral[50],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    reviewedItemText: {
        fontSize: 11,
        color: Colors.text.tertiary,
        fontWeight: '500',
    },
    sellerReply: {
        backgroundColor: Colors.primary[50],
        borderRadius: 8,
        padding: 10,
        marginTop: 4,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary[300],
    },
    replyLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary[700],
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    replyContent: {
        fontSize: 13,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    // FAQ Styles
    faqSection: {
        marginTop: 24,
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    faqCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    faqQuestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    faqQuestionText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text.primary,
        flex: 1,
    },
    faqAnswerText: {
        fontSize: 14,
        color: Colors.text.secondary,
        lineHeight: 20,
        paddingLeft: 28,
    },
});
