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
import { ChevronLeftIcon, ShareIcon, MinusIcon, PlusIcon, ShoppingBagIcon, ChatBubbleLeftIcon } from 'react-native-heroicons/outline';
import { HeartIcon as HeartOutline } from 'react-native-heroicons/outline';
import { HeartIcon as HeartSolid } from 'react-native-heroicons/solid';
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
            if (user) {
                await trackProductView(user.id, id);
            }

            // Load recommendations
            const [seller, similar] = await Promise.all([
                fetchSellerProducts(productData.seller_id || 'seller-1', id, 6, user?.id),
                fetchSimilarProducts(
                    id,
                    productData.category,
                    parseFloat(productData.price.replace('$', '')),
                    8,
                    user?.id
                ),
            ]);

            setSellerProducts(seller);
            setSimilarProducts(similar);
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
                            <TouchableOpacity onPress={handleToggleFavorite}>
                                {product.isFavorited ? (
                                    <HeartSolid size={24} color="#EF4444" />
                                ) : (
                                    <HeartOutline size={24} color={Colors.text.secondary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {product.condition && (
                            <View style={styles.conditionBadge}>
                                <Text style={styles.conditionText}>{product.condition}</Text>
                            </View>
                        )}

                        <Text style={styles.price}>{product.price}</Text>
                    </View>

                    {/* Seller Card */}
                    <SellerCard
                        sellerName={product.seller_name}
                        sellerAvatar={product.seller_avatar}
                        sellerRating={product.seller_rating}
                        sellerReviewsCount={product.seller_reviews_count}
                        sellerLocation={product.seller_location}
                        onVisitShop={() => Alert.alert('Visit Shop', 'Navigate to seller shop')}
                    />

                    {/* Details */}
                    <View style={styles.section}>
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

                        {product.description && (
                            <Text style={styles.description}>{product.description}</Text>
                        )}
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

                    {/* Other items by seller */}
                    {sellerProducts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Other items by this seller</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
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
                                        style={{ width: 160, marginRight: 12 }}
                                    />
                                ))}
                            </ScrollView>
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
    conditionBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.secondary[100],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 8,
    },
    conditionText: {
        color: Colors.secondary[500],
        fontSize: 12,
        fontWeight: '600',
    },
    price: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text.primary,
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
});

export default ItemDetail;
