import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    ChatBubbleLeftRightIcon,
    QuestionMarkCircleIcon,
    XCircleIcon,
    StarIcon
} from 'react-native-heroicons/outline';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/color';

interface OrderItem {
    id: string;
    product_id: string;
    product_name: string;
    product_image: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    user_id: string;
    seller_id: string;
    subtotal: number;
    shipping_cost: number;
    tax: number;
    total_amount: number;
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'confirmed';
    shipping_address: {
        line1: string;
        line2?: string;
        city: string;
        zipCode: string;
        country: string;
        firstName: string;
        lastName: string;
    };
    payment_method: string;
    created_at: string;
    updated_at?: string;
    order_items: OrderItem[];
}

const OrderDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('orders' as any)
                .select(`
          *,
          order_items (*)
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setOrder(data as unknown as Order);
        } catch (error) {
            console.error('Error fetching order details:', error);
            Alert.alert('Error', 'Failed to load order details');
        } finally {
            setLoading(false);
        }
    };

    const statusSteps = [
        { label: 'Placed', status: 'pending' },
        { label: 'Paid', status: 'paid' },
        { label: 'Shipped', status: 'shipped' },
        { label: 'Delivered', status: 'delivered' },
    ];

    const getStatusIndex = (status: string) => {
        if (!status) return 0;
        const s = status.toLowerCase();
        if (s === 'cancelled') return -1;
        if (s === 'confirmed') return 1; // Map confirmed to paid
        return statusSteps.findIndex(step => step.status === s);
    };

    const currentStatusIndex = order ? getStatusIndex(order.status) : 0;

    const handleFinishPayment = () => {
        // Redirect back to checkout with this order context
        router.push({
            pathname: '/checkout',
            params: { orderId: order?.id }
        } as any);
    };

    const handleUpdateStatus = async (newStatus: Order['status']) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('orders' as any)
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            Alert.alert('Status Updated', `Order marked as ${newStatus}.`);
            fetchOrderDetails();
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update order status');
        } finally {
            setLoading(false);
        }
    };

    const handleContactUser = async () => {
        if (!order || !user) return;

        // If I'm the buyer, contact seller. If I'm seller, contact buyer.
        const isSeller = user.id === order.seller_id;
        const targetUserId = isSeller ? order.user_id : order.seller_id;
        const firstItem = order.order_items[0];

        // Helper to validate UUID
        const isUUID = (str: string) => {
            // Relaxed regex to accept any UUID version (just hex and dashes structure)
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(str);
        };

        // DEBUG: Temporary alert to see what the ID actually is
        // if (!isUUID(order.seller_id)) {
        //     Alert.alert("Debug Info", `Seller ID is: '${order.seller_id}' (Type: ${typeof order.seller_id})`);
        // }

        // If seller is "system" (platform) or invalid UUID, redirect to help/support instead of chat
        if (order.seller_id === 'system' || !isUUID(order.seller_id)) {
            // "system" is not a valid UUID, so we can't create a chat record.
            // Redirect to the support/issue form instead.
            router.push(`/profile/order-issue/${order.id}` as any);
            return;
        }

        try {
            // Check for any conversation between these two users regarding this product
            // Since conversation roles are fixed (buyer_id is always the one who bought, seller_id is always the one who sold),
            // we can just query directly.
            const query = supabase
                .from('conversations' as any)
                .select('id')
                .eq('product_id', firstItem.product_id)
                .eq('buyer_id', order.user_id)
                .eq('seller_id', order.seller_id);

            const { data: conversations, error } = await query;

            if (error) throw error;

            if (conversations && conversations.length > 0) {
                router.push(`/conversation/${(conversations[0] as any).id}` as any);
                return;
            }

            // Create new conversation if none exists
            const initialMessage = isSeller
                ? `Hi, I'm contacting you regarding Order #${order.id.slice(0, 8)}`
                : `Hi, I have a question about my order #${order.id.slice(0, 8)}`;

            const { data: newConv, error: createError } = await supabase
                .from('conversations' as any)
                .insert({
                    product_id: firstItem.product_id,
                    buyer_id: order.user_id,
                    seller_id: order.seller_id,
                    last_message: initialMessage,
                })
                .select()
                .single();

            if (createError) throw createError;

            if (newConv) {
                // Also insert the message into the messages table so it appears in the chat
                await supabase.from('messages' as any).insert({
                    conversation_id: (newConv as any).id,
                    sender_id: user.id,
                    content: initialMessage,
                    is_read: false
                });

                router.push(`/conversation/${(newConv as any).id}` as any);
            }
        } catch (err) {
            console.error('Error opening chat:', err);
            Alert.alert('Error', 'Could not open chat. Please try again.');
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.centerContainer}>
                <Text>Order not found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.headerDate}>
                        {new Date((order.status === 'paid' || order.status === 'confirmed') && order.updated_at ? order.updated_at : order.created_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Tracker */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Status</Text>
                    {order.status === 'cancelled' ? (
                        <View style={styles.cancelledContainer}>
                            <XCircleIcon size={24} color={Colors.danger[500]} />
                            <Text style={styles.cancelledText}>This order was cancelled</Text>
                        </View>
                    ) : (
                        <View style={styles.stepperContainer}>
                            {statusSteps.map((step, index) => (
                                <View key={step.label} style={styles.stepItem}>
                                    <View style={[
                                        styles.stepCircle,
                                        index <= currentStatusIndex && styles.activeStepCircle
                                    ]}>
                                        {index <= currentStatusIndex && <View style={styles.innerCircle} />}
                                    </View>
                                    <Text style={[
                                        styles.stepLabel,
                                        index <= currentStatusIndex && styles.activeStepLabel
                                    ]}>{step.label}</Text>
                                    {index < statusSteps.length - 1 && (
                                        <View style={[
                                            styles.stepLine,
                                            index < currentStatusIndex && styles.activeStepLine
                                        ]} />
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Order Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {order.order_items.map((item) => (
                        <View key={item.id} style={styles.itemContainer}>
                            <TouchableOpacity
                                style={styles.itemRow}
                                onPress={() => router.push(`/item/${item.product_id}` as any)}
                            >
                                <Image source={{ uri: item.product_image }} style={styles.itemImage} />
                                <View style={styles.itemDetails}>
                                    <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                                    <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                                </View>
                                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                            </TouchableOpacity>
                            {/* Review Button - Only if delivered and I'm the buyer */}
                            {(order.status === 'delivered') && user?.id === order.user_id && (
                                <TouchableOpacity
                                    style={styles.reviewButton}
                                    onPress={() => router.push({
                                        pathname: `/profile/review/${item.product_id}`,
                                        params: {
                                            orderId: order.id,
                                            productName: item.product_name,
                                            productImage: item.product_image,
                                            price: item.price.toString()
                                        }
                                    } as any)}
                                >
                                    <StarIcon size={16} color={Colors.primary[500]} />
                                    <Text style={styles.reviewButtonText}>Write a Review</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>

                {/* Shipping Address */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shipping Address</Text>
                    <View style={styles.addressCard}>
                        <Text style={styles.addressName}>{order.shipping_address.firstName} {order.shipping_address.lastName}</Text>
                        <Text style={styles.addressLine}>{order.shipping_address.line1}</Text>
                        {order.shipping_address.line2 && <Text style={styles.addressLine}>{order.shipping_address.line2}</Text>}
                        <Text style={styles.addressLine}>
                            {order.shipping_address.city}, {order.shipping_address.zipCode}
                        </Text>
                        <Text style={styles.addressLine}>{order.shipping_address.country}</Text>
                    </View>
                </View>

                {/* Payment Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>${order.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Shipping</Text>
                        <Text style={styles.summaryValue}>${order.shipping_cost.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Tax</Text>
                        <Text style={styles.summaryValue}>${order.tax.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Order Actions */}
                <View style={styles.actionSection}>
                    {user?.id === order.seller_id ? (
                        // Seller Actions
                        <>
                            <Text style={styles.actionTitle}>Seller Controls</Text>
                            {order.status === 'paid' && (
                                <TouchableOpacity
                                    style={[styles.primaryActionButton]}
                                    onPress={() => handleUpdateStatus('shipped')}
                                >
                                    <Text style={styles.primaryActionButtonText}>Mark as Shipped</Text>
                                </TouchableOpacity>
                            )}
                            {order.status === 'shipped' && (
                                <TouchableOpacity
                                    style={[styles.primaryActionButton]}
                                    onPress={() => handleUpdateStatus('delivered')}
                                >
                                    <Text style={styles.primaryActionButtonText}>Mark as Delivered</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleContactUser}
                            >
                                <ChatBubbleLeftRightIcon size={20} color={Colors.text.primary} />
                                <Text style={styles.actionButtonText}>Contact Buyer</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        // Buyer Actions
                        <>
                            {order.status === 'pending' && (
                                <View style={styles.pendingActionWrapper}>
                                    <TouchableOpacity
                                        style={styles.primaryActionButton}
                                        onPress={handleFinishPayment}
                                    >
                                        <Text style={styles.primaryActionButtonText}>Complete Payment</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.pendingNote}>
                                        Your check out was started but payment isn't confirmed yet.
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleContactUser}
                            >
                                <ChatBubbleLeftRightIcon size={20} color={Colors.text.primary} />
                                <Text style={styles.actionButtonText}>Contact Seller</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push(`/profile/order-issue/${order.id}` as any)}
                            >
                                <QuestionMarkCircleIcon size={20} color={Colors.text.primary} />
                                <Text style={styles.actionButtonText}>Need Help from Culturar?</Text>
                            </TouchableOpacity>

                            {order.status === 'pending' && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.cancelButton]}
                                    onPress={() => router.push(`/profile/cancel-order/${order.id}` as any)}
                                >
                                    <XCircleIcon size={20} color={Colors.danger[500]} />
                                    <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel Order</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 8,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    headerDate: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    section: {
        backgroundColor: '#FFF',
        marginTop: 12,
        padding: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: '#F3F4F6',
        borderBottomColor: '#F3F4F6',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    stepperContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    stepItem: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    activeStepCircle: {
        borderColor: Colors.primary[500],
    },
    innerCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary[500],
    },
    stepLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 8,
        fontWeight: '600',
    },
    activeStepLabel: {
        color: Colors.primary[500],
    },
    stepLine: {
        position: 'absolute',
        top: 12,
        left: '50%',
        width: '100%',
        height: 2,
        backgroundColor: '#D1D5DB',
        zIndex: 1,
    },
    activeStepLine: {
        backgroundColor: Colors.primary[500],
    },
    cancelledContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: Colors.danger[500] + '10',
        borderRadius: 12,
    },
    cancelledText: {
        marginLeft: 8,
        color: Colors.danger[500],
        fontWeight: '600',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    itemDetails: {
        flex: 1,
        marginLeft: 12,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    itemQty: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    addressCard: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    addressName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    addressLine: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.primary[600],
    },
    actionSection: {
        padding: 16,
        marginTop: 12,
    },
    actionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    primaryActionButton: {
        backgroundColor: Colors.primary[500],
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: Colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryActionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 12,
    },
    cancelButton: {
        borderColor: Colors.danger[500] + '30',
    },
    cancelButtonText: {
        color: Colors.danger[500],
    },
    pendingActionWrapper: {
        marginBottom: 20,
        backgroundColor: Colors.primary[50] + '30',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    pendingNote: {
        fontSize: 13,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginTop: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContainer: {
        marginBottom: 16,
    },
    reviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 8,
        backgroundColor: Colors.primary[50], // subtle background
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    reviewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary[500],
        marginLeft: 6,
    },
});

export default OrderDetailsScreen;
