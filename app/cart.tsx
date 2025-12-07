import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon, ShoppingBagIcon } from 'react-native-heroicons/outline';
import { Colors } from '../constants/color';
import { useAuth } from '../contexts/AuthContext';
import {
    fetchCart,
    groupCartBySeller,
    updateCartQuantity,
    removeFromCart,
    calculateCartTotals,
    type CartItem,
    type GroupedCart,
} from '../lib/services/cartService';
import CustomButton from '../components/Button';

const Cart = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [groupedCart, setGroupedCart] = useState<GroupedCart>({});
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (user) {
            loadCart();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadCart = async () => {
        if (!user) return;

        setLoading(true);
        const items = await fetchCart(user.id);
        setCartItems(items);
        setGroupedCart(groupCartBySeller(items));
        setLoading(false);
    };

    const handleUpdateQuantity = async (cartItemId: string, newQuantity: number, stockQuantity: number) => {
        if (newQuantity > stockQuantity) {
            Alert.alert('Stock Limit', `Only ${stockQuantity} items available`);
            return;
        }

        setUpdating(true);
        const { success } = await updateCartQuantity(cartItemId, newQuantity);
        if (success) {
            await loadCart();
        }
        setUpdating(false);
    };

    const handleRemoveItem = async (cartItemId: string, productName: string) => {
        Alert.alert(
            'Remove Item',
            `Remove "${productName}" from cart?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setUpdating(true);
                        const { success } = await removeFromCart(cartItemId);
                        if (success) {
                            await loadCart();
                        }
                        setUpdating(false);
                    },
                },
            ]
        );
    };

    const handleCheckout = () => {
        // TODO: Navigate to checkout screen
        Alert.alert('Checkout', 'Checkout functionality coming soon!');
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <ShoppingBagIcon size={80} color={Colors.neutral[300]} />
                    <Text style={styles.emptyTitle}>Sign in to view cart</Text>
                    <Text style={styles.emptySubtitle}>Please sign in to add items to your cart</Text>
                    <CustomButton
                        title="Sign In"
                        onPress={() => router.push('/(auth)/auth')}
                        style={{ marginTop: 20, width: 200 }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    const totals = calculateCartTotals(groupedCart);
    const isEmpty = cartItems.length === 0;

    if (isEmpty) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Cart</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <ShoppingBagIcon size={80} color={Colors.neutral[300]} />
                    <Text style={styles.emptyTitle}>Your cart is empty</Text>
                    <Text style={styles.emptySubtitle}>Add items to get started</Text>
                    <CustomButton
                        title="Start Shopping"
                        onPress={() => router.push('/(tabs)/Browse')}
                        style={{ marginTop: 20, width: 200 }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Cart ({totals.itemCount})</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <XMarkIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Delivery/Pickup Toggle (Future feature) */}
                {/* <View style={styles.deliveryToggle}>
                    <TouchableOpacity style={styles.deliveryButton}>
                        <Text style={styles.deliveryButtonText}>Delivery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.deliveryButton, styles.deliveryButtonInactive]}>
                        <Text style={[styles.deliveryButtonText, styles.deliveryButtonTextInactive]}>Pickup</Text>
                    </TouchableOpacity>
                </View> */}

                {/* Cart Items Grouped by Seller */}
                {Object.entries(groupedCart).map(([sellerId, sellerGroup]) => (
                    <View key={sellerId} style={styles.sellerSection}>
                        {/* Seller Header */}
                        <View style={styles.sellerHeader}>
                            <Text style={styles.sellerName}>{sellerGroup.sellerName}</Text>
                            <TouchableOpacity>
                                <Text style={styles.viewShop}>View Shop →</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Seller Items */}
                        {sellerGroup.items.map((item) => (
                            <View key={item.id} style={styles.cartItem}>
                                {/* Product Image */}
                                <View style={styles.itemImage}>
                                    {item.product.image_url || item.product.images?.[0] ? (
                                        <Image
                                            source={{ uri: item.product.image_url || item.product.images?.[0] }}
                                            style={styles.productImage}
                                        />
                                    ) : (
                                        <Text style={styles.productEmoji}>{item.product.emoji}</Text>
                                    )}
                                </View>

                                {/* Product Info */}
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {item.product.name}
                                    </Text>
                                    <Text style={styles.itemPrice}>
                                        ${item.product.price.toFixed(2)}
                                    </Text>
                                    {item.product.out_of_stock && (
                                        <Text style={styles.outOfStockText}>Out of Stock</Text>
                                    )}
                                </View>

                                {/* Quantity Controls */}
                                <View style={styles.quantityControls}>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => handleRemoveItem(item.id, item.product.name)}
                                        disabled={updating}
                                    >
                                        <TrashIcon size={18} color={Colors.neutral[500]} />
                                    </TouchableOpacity>

                                    <View style={styles.quantitySelector}>
                                        <TouchableOpacity
                                            style={styles.quantityBtn}
                                            onPress={() => handleUpdateQuantity(item.id, item.quantity - 1, item.product.stock_quantity)}
                                            disabled={updating || item.quantity <= 1}
                                        >
                                            <MinusIcon size={16} color={Colors.text.primary} />
                                        </TouchableOpacity>

                                        <Text style={styles.quantityText}>{item.quantity}</Text>

                                        <TouchableOpacity
                                            style={styles.quantityBtn}
                                            onPress={() => handleUpdateQuantity(item.id, item.quantity + 1, item.product.stock_quantity)}
                                            disabled={updating || item.product.out_of_stock}
                                        >
                                            <PlusIcon size={16} color={Colors.text.primary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}

                        {/* Seller Subtotal */}
                        <View style={styles.sellerSubtotal}>
                            <Text style={styles.subtotalLabel}>Subtotal</Text>
                            <Text style={styles.subtotalAmount}>${sellerGroup.subtotal.toFixed(2)}</Text>
                        </View>
                        {sellerGroup.shipping > 0 && (
                            <View style={styles.sellerSubtotal}>
                                <Text style={styles.subtotalLabel}>Shipping</Text>
                                <Text style={styles.subtotalAmount}>${sellerGroup.shipping.toFixed(2)}</Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Spacer for bottom bar */}
                <View style={{ height: 200 }} />
            </ScrollView>

            {/* Bottom Summary */}
            <View style={styles.bottomBar}>
                <View style={styles.totalSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Shipping</Text>
                        <Text style={styles.totalValue}>${totals.shipping.toFixed(2)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tax (10%)</Text>
                        <Text style={styles.totalValue}>${totals.tax.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.grandTotalLabel}>Total</Text>
                        <Text style={styles.grandTotalValue}>${totals.total.toFixed(2)}</Text>
                    </View>
                </View>

                <CustomButton
                    title="Continue to Checkout"
                    onPress={handleCheckout}
                    disabled={updating}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
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
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    scrollView: {
        flex: 1,
    },
    sellerSection: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingBottom: 16,
    },
    sellerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    sellerName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    viewShop: {
        fontSize: 14,
        color: Colors.primary[500],
        fontWeight: '600',
    },
    cartItem: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#FFF5F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    productEmoji: {
        fontSize: 32,
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: 14,
        color: Colors.text.secondary,
        marginBottom: 4,
    },
    outOfStockText: {
        fontSize: 12,
        color: Colors.danger[500],
        fontWeight: '600',
    },
    quantityControls: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    quantityButton: {
        padding: 8,
    },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        overflow: 'hidden',
    },
    quantityBtn: {
        padding: 8,
        backgroundColor: '#fff',
    },
    quantityText: {
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
        minWidth: 40,
        textAlign: 'center',
    },
    sellerSubtotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    subtotalLabel: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    subtotalAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    bottomBar: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[200],
    },
    totalSection: {
        marginBottom: 16,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    totalLabel: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    totalValue: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    grandTotalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[200],
    },
    grandTotalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.primary[500],
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text.primary,
        marginTop: 20,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
});

export default Cart;
