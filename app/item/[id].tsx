import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Share,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, ShareIcon, MinusIcon, PlusIcon, ShoppingBagIcon, ChatBubbleLeftIcon, StarIcon as StarOutline } from 'react-native-heroicons/outline';
import { HeartIcon as HeartOutline } from 'react-native-heroicons/outline';
import { HeartIcon as HeartSolid, StarIcon as StarSolid } from 'react-native-heroicons/solid';
import { Colors } from '../../constants/color';
import { ImageCarousel } from '../../components/ImageCarousel';
import { SellerCard } from '../../components/SellerCard';
import { ProductCard } from '../../components/Card';
import CustomButton from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
    fetchProductById,
    fetchSellerProducts,
    fetchSimilarProducts,
    toggleFavorite,
    trackProductView,
} from '../../lib/services/productService';
import { fetchProductReviews, fetchSellerReviews, ReviewWithDetails } from '../../lib/services/reviewService';
import { addToCart } from '../../lib/services/cartService';
import { useCart } from '../../contexts/CartContext';
import { CartToast } from '../../components/CartToast';
import { supabase } from '../../lib/supabase';

const ItemDetail = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { refreshCartCount, cartCount } = useCart();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [product, setProduct] = useState<any>(null);
    const [sellerProducts, setSellerProducts] = useState<any[]>([]);
    const [similarProducts, setSimilarProducts] = useState<any[]>([]);
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);

    const isOwnListing = user?.id && product?.seller_id && user.id === product.seller_id;

    useEffect(() => {
        loadProductData();
    }, [id]);

    const loadProductData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            const productData = await fetchProductById(id, user?.id);

            if (!productData) {
                Alert.alert('Error', 'Product not found');
                router.back();
                return;
            }

            setProduct(productData);

            // Track view
            if (user && productData.seller_id) {
                await trackProductView(user.id, id, productData.seller_id);
            }

            // Load recommendations and reviews
            const [seller, similar, productReviews] = await Promise.all([
                fetchSellerProducts(productData.seller_id || 'seller-1', id, 6, user?.id),
                fetchSimilarProducts(
                    id,
                    productData.category,
                    parseFloat(productData.price.replace('$', '')),
                    8,
                    user?.id
                ),
                fetchProductReviews(id)
            ]);

            setSellerProducts(seller);
            setSimilarProducts(similar);
            setReviews(productReviews);
        } catch (error) {
            console.error('Error loading product:', error);
            Alert.alert('Error', 'Failed to load product details');
        } finally {
            setLoading(false);
        }
    };

    const handleBuyNow = () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in to purchase items');
            return;
        }

        router.push({
            pathname: '/checkout',
            params: {
                productId: id,
                quantity: quantity
            }
        });
    };

    const handleToggleFavorite = async () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist');
            return;
        }

        const { success, isFavorited } = await toggleFavorite(user.id, id);
        if (success) {
            setProduct({ ...product, isFavorited });
        }
    };

    const handleToggleRecommendationFavorite = async (productId: string) => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in to add items to your wishlist');
            return;
        }

        const { success, isFavorited } = await toggleFavorite(user.id, productId);
        if (success) {
            // Update seller products
            setSellerProducts(currentProducts =>
                currentProducts.map(p =>
                    p.id === productId ? { ...p, isFavorited } : p
                )
            );
            // Update similar products
            setSimilarProducts(currentProducts =>
                currentProducts.map(p =>
                    p.id === productId ? { ...p, isFavorited } : p
                )
            );
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out ${product.name} on Culturar!`,
                url: `culturar://item/${id}`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const [toastVisible, setToastVisible] = useState(false);

    const handleAddToCart = async () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in to add items to cart');
            return;
        }

        const { success } = await addToCart(user.id, id, quantity);
        if (success) {
            await refreshCartCount(); // Update the cart count immediately
            setToastVisible(true);
        } else {
            Alert.alert('Error', 'Failed to add item to cart. Please try again.');
        }
    };

    const incrementQuantity = () => {
        if (quantity < (product?.stock_quantity || 10)) {
            setQuantity(quantity + 1);
        }
    };

    const decrementQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    const handleMessageSeller = async () => {
        if (!user || !product) {
            if (!user) Alert.alert('Sign In Required', 'Please sign in to message sellers');
            return;
        }

        try {
            // Check if conversation already exists
            const { data: existingConversation } = await supabase
                .from('conversations' as any)
                .select('id')
                .eq('product_id', id)
                .eq('buyer_id', user.id)
                .single() as any;

            if (existingConversation) {
                // Navigate to existing conversation
                router.push(`/conversation/${existingConversation.id}` as any);
            } else {
                // Create new conversation
                const { data: newConversation, error } = await supabase
                    .from('conversations' as any)
                    .insert({
                        product_id: id,
                        buyer_id: user.id,
                        seller_id: product.seller_id,
                    })
                    .select('id')
                    .single() as any;

                if (error) throw error;

                if (newConversation) {
                    router.push(`/conversation/${newConversation.id}` as any);
                }
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
            Alert.alert('Error', 'Failed to start conversation. Please try again.');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    if (!product) {
        return null;
    }

    const isInStock = !product.outOfStock && product.stock_quantity > 0;
    const stockText = product.stock_quantity <= 5 && isInStock
        ? `In stock - Limited quantities`
        : isInStock
            ? 'In stock'
            : 'Sold out';

    const renderStars = (rating: number) => {
        return (
            <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(star => (
                    star <= rating
                        ? <StarSolid key={star} size={14} color="#F59E0B" />
                        : <StarOutline key={star} size={14} color="#D1D5DB" />
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <CartToast
                visible={toastVisible}
                message="Product added to cart"
                onHide={() => setToastVisible(false)}
                onViewCart={() => {
                    setToastVisible(false);
                    router.push('/cart');
                }}
            />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleShare} style={styles.circleBtn}>
                        <ShareIcon size={22} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/cart')} style={[styles.circleBtn, { marginLeft: 8 }]}>
                        <ShoppingBagIcon size={22} color={Colors.text.primary} />
                        {cartCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{cartCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Image Carousel */}
                <ImageCarousel images={product.images} emoji={product.emoji} />

                {/* Content */}
                <View style={styles.content}>
                    {/* Stock Badge */}
                    <View style={[styles.stockBadge, !isInStock && styles.soldOutBadge]}>
                        <Text style={[styles.stockText, !isInStock && styles.soldOutText]}>
                            {stockText}
                        </Text>
                    </View>

                    {/* Product Info */}
                    <View style={styles.productInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.productName}>{product.name}</Text>
                            {!isOwnListing && (
                                <TouchableOpacity onPress={handleToggleFavorite}>
                                    {product.isFavorited ? (
                                        <HeartSolid size={24} color="#EF4444" />
                                    ) : (
                                        <HeartOutline size={24} color={Colors.text.secondary} />
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.priceRow}>
                            <Text style={styles.price}>{product.price}</Text>
                            {product.originalPrice && (
                                <Text style={styles.originalPrice}>{product.originalPrice}</Text>
                            )}
                            {product.discount_percentage ? (
                                <View style={styles.discountBadge}>
                                    <Text style={styles.discountText}>-{product.discount_percentage}%</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                    {/* Details section: Description FIRST, then standard attributes */}
                    <View style={styles.section}>
                        {product.description && (
                            <View style={[styles.descriptionContainer, { marginTop: 0, marginBottom: 20 }]}>
                                <Text style={styles.sectionTitle}>Description</Text>
                                <Text style={styles.description}>{product.description}</Text>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>Details</Text>
                        <View style={styles.detailsGrid}>
                            {product.cultural_origin && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Origin:</Text>
                                    <Text style={styles.detailValue}>{product.cultural_origin}</Text>
                                </View>
                            )}
                            {product.dimensions && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Dimensions:</Text>
                                    <Text style={styles.detailValue}>{product.dimensions}</Text>
                                </View>
                            )}
                            {product.condition && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Condition:</Text>
                                    <Text style={styles.detailValue}>{product.condition}</Text>
                                </View>
                            )}
                            {product.category && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Category:</Text>
                                    <Text style={styles.detailValue}>{product.category}</Text>
                                </View>
                            )}
                            {product.returns_policy && (
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Returns:</Text>
                                    <Text style={styles.detailValue}>{product.returns_policy}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Location & Shipping */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Location & shipping</Text>
                        <View style={styles.shippingInfo}>
                            {product.pickup_available && (
                                <Text style={styles.shippingText}>• Local pickup: Available</Text>
                            )}
                            <Text style={styles.shippingText}>
                                • Shipping: {product.free_shipping ? 'Free' : product.shipping} · {product.shipping_days_min}-{product.shipping_days_max} days
                            </Text>
                        </View>
                    </View>

                    {/* Seller Card */}
                    <SellerCard
                        sellerName={product.seller_name}
                        sellerAvatar={product.seller_avatar}
                        sellerRating={product.seller_rating}
                        sellerReviewsCount={product.seller_reviews_count}
                        sellerLocation={product.seller_location}
                        isVerified={product.is_verified}
                        onVisitShop={() => router.push(`/seller/${product.seller_id}` as any)}
                    />

                    {/* Shop Details */}
                    {(product.seller_cultures?.length > 0 || product.seller_spoken_languages?.length > 0 || product.seller_shipping_regions?.length > 0) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Shop details</Text>
                            <View style={styles.detailsGrid}>
                                {product.seller_cultures && product.seller_cultures.length > 0 && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Cultures:</Text>
                                        <Text style={styles.detailValue}>
                                            {product.seller_cultures
                                                .map((c: string) => c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
                                                .join(', ')}
                                        </Text>
                                    </View>
                                )}
                                {product.seller_spoken_languages && product.seller_spoken_languages.length > 0 && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Speaks:</Text>
                                        <Text style={styles.detailValue}>{product.seller_spoken_languages.join(', ')}</Text>
                                    </View>
                                )}
                                {product.seller_shipping_regions && product.seller_shipping_regions.length > 0 && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Ships to:</Text>
                                        <Text style={styles.detailValue}>{product.seller_shipping_regions.join(', ')}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Product Reviews */}
                    {reviews.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.reviewsHeaderRow}>
                                <Text style={styles.sectionTitle}>Product Reviews</Text>
                                <View style={styles.reviewsBadge}>
                                    <StarSolid size={14} color="#F59E0B" />
                                    <Text style={styles.reviewsBadgeText}>
                                        {(reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                                    </Text>
                                </View>
                            </View>

                            {reviews.slice(0, showAllReviews ? reviews.length : 5).map(review => (
                                <View key={review.id} style={styles.publicReviewCard}>
                                    <View style={styles.publicReviewHeader}>
                                        <View style={styles.buyerInfo}>
                                            <View style={styles.buyerAvatar}>
                                                <Text style={styles.buyerInitials}>
                                                    {review.buyer_name.substring(0, 1).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={styles.publicBuyerName}>{review.buyer_name}</Text>
                                                <Text style={styles.publicReviewDate}>
                                                    {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </Text>
                                            </View>
                                        </View>
                                        {renderStars(review.rating)}
                                    </View>

                                    <Text style={styles.publicCommentText}>{review.comment || 'No written feedback provided.'}</Text>

                                    {review.seller_reply && (
                                        <View style={styles.publicSellerReplyBox}>
                                            <View style={styles.replyHeaderRow}>
                                                <Text style={styles.replySellerName}>{product.seller_name} (Seller)</Text>
                                            </View>
                                            <Text style={styles.replySellerText}>{review.seller_reply}</Text>
                                        </View>
                                    )}
                                </View>
                            ))}

                            {reviews.length > 5 && !showAllReviews && (
                                <TouchableOpacity 
                                    style={styles.loadMoreBtn}
                                    onPress={() => setShowAllReviews(true)}
                                >
                                    <Text style={styles.loadMoreText}>Load more reviews ({reviews.length - 5} more)</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Other items by seller */}
                    {sellerProducts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Other items by this seller</Text>
                            <View style={styles.sellerProductsGrid}>
                                {sellerProducts.map((item) => (
                                    <ProductCard
                                        key={item.id}
                                        name={item.name}
                                        price={item.price}
                                        image={item.image}
                                        emoji={item.emoji}
                                        rating={item.rating}
                                        reviews={item.reviews}
                                        shipping={item.shipping}
                                        isLiked={item.isFavorited}
                                        onLike={() => handleToggleRecommendationFavorite(item.id)}
                                        onPress={() => router.push(`/item/${item.id}`)}
                                        style={styles.gridProductCard}
                                        hideFavoriteButton={user?.id === item.seller_id}
                                    />
                                ))}
                            </View>
                            <TouchableOpacity 
                                style={styles.viewAllListingsBtn}
                                onPress={() => router.push(`/seller/${product.seller_id}` as any)}
                            >
                                <Text style={styles.viewAllListingsText}>View all seller's listings</Text>
                            </TouchableOpacity>
                        </View>
                    )}


                    {/* Similar items */}
                    {similarProducts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>You might also like</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                                {similarProducts.map((item) => (
                                    <ProductCard
                                        key={item.id}
                                        name={item.name}
                                        price={item.price}
                                        image={item.image}
                                        emoji={item.emoji}
                                        rating={item.rating}
                                        reviews={item.reviews}
                                        shipping={item.shipping}
                                        isLiked={item.isFavorited}
                                        onLike={() => handleToggleRecommendationFavorite(item.id)}
                                        onPress={() => router.push(`/item/${item.id}`)}
                                        style={{ width: 160, marginRight: 12 }}
                                        hideFavoriteButton={user?.id === item.seller_id}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={{ height: 130 }} />
                </View>
            </ScrollView>

            {/* Bottom Section */}
            {!isOwnListing ? (
                <View style={styles.bottomContainer}>
                    {isInStock && (
                        <View style={styles.quantityRow}>
                            <Text style={styles.quantityLabel}>Quantity</Text>
                            <View style={styles.quantitySelector}>
                                <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton}>
                                    <MinusIcon size={16} color={Colors.text.primary} />
                                </TouchableOpacity>
                                <Text style={styles.quantityText}>{quantity}</Text>
                                <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}>
                                    <PlusIcon size={16} color={Colors.text.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.bottomBar}>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={handleMessageSeller}
                        >
                            <ChatBubbleLeftIcon size={20} color={Colors.primary[500]} />
                        </TouchableOpacity>
                        {isInStock ? (
                            <>
                                <CustomButton
                                    title="Add to cart"
                                    onPress={handleAddToCart}
                                    style={styles.addToCartButton}
                                    bgVariant="outline"
                                    textVariant="primary"
                                />
                                <CustomButton
                                    title="Buy Now"
                                    onPress={handleBuyNow}
                                    style={styles.buyNowButton}
                                />
                            </>
                        ) : (
                            <CustomButton
                                title="Sold Out"
                                onPress={() => { }}
                                style={styles.soldOutButton}
                                bgVariant="secondary"
                                disabled
                            />
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.bottomContainer}>
                    <View style={styles.bottomBar}>
                        <CustomButton
                            title="Edit Listing"
                            onPress={() => router.push({ pathname: '/profile/edit-listing', params: { draftId: product.id, type: 'active' } } as any)}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    stockBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.success[500],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginBottom: 12,
    },
    soldOutBadge: {
        backgroundColor: Colors.neutral[300],
    },
    stockText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    soldOutText: {
        color: Colors.text.secondary,
    },
    productInfo: {
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    productName: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text.primary,
        marginRight: 12,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    price: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    originalPrice: {
        fontSize: 16,
        color: Colors.text.tertiary,
        textDecorationLine: 'line-through',
        marginBottom: 3,
    },
    discountBadge: {
        backgroundColor: Colors.danger[500],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    discountText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 12,
    },
    detailsGrid: {
        gap: 12,
        marginBottom: 16,
    },
    detailItem: {
        flexDirection: 'row',
    },
    detailLabel: {
        fontSize: 14,
        color: Colors.text.secondary,
        width: 100,
    },
    detailValue: {
        flex: 1,
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    descriptionContainer: {
        marginTop: 20,
    },
    descriptionHeader: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: Colors.text.secondary,
        lineHeight: 20,
    },
    shippingInfo: {
        gap: 8,
    },
    shippingText: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    // Review Styles
    reviewsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    reviewsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    reviewsBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#D97706',
    },
    publicReviewCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    publicReviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    buyerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    buyerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary[100],
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyerInitials: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[700],
    },
    publicBuyerName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    publicReviewDate: {
        fontSize: 12,
        color: Colors.text.tertiary,
    },
    publicCommentText: {
        fontSize: 14,
        color: Colors.text.secondary,
        lineHeight: 20,
    },
    publicSellerReplyBox: {
        marginTop: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary[400],
    },
    replyHeaderRow: {
        marginBottom: 4,
    },
    replySellerName: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    replySellerText: {
        fontSize: 13,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    horizontalScroll: {
        paddingRight: 16,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[200],
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 0,
    },
    quantityLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        gap: 12,
    },
    messageButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.primary[200],
    },
    addToCartButton: {
        flex: 1.5,
        borderWidth: 1,
        borderColor: Colors.neutral[300],
    },
    buyNowButton: {
        flex: 1.2,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        borderRadius: 24,
        paddingHorizontal: 4,
        backgroundColor: '#F9F9F9',
    },
    quantityButton: {
        padding: 8,
    },
    quantityText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text.primary,
        minWidth: 28,
        textAlign: 'center',
    },
    soldOutButton: {
        flex: 1,
    },
    badge: {
        position: "absolute",
        top: -4,
        right: -4,
        backgroundColor: Colors.primary[500],
        borderRadius: 10,
        minWidth: 25,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: "#FFFFFF",
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    loadMoreBtn: {
        marginTop: 8,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    loadMoreText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    sellerProductsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        // Removed gap for compatibility with older RN versions
    },
    gridProductCard: {
        width: '48.5%', // Slightly more width but allowing for space-between
        marginRight: 0, // Explicitly reset common card margins
        marginBottom: 12,
    },
    viewAllListingsBtn: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    viewAllListingsText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text.primary,
    },
});

export default ItemDetail;
