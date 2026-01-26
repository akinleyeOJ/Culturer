import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeftIcon, InboxStackIcon } from 'react-native-heroicons/outline';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/color';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'all';

interface Order {
    id: string;
    created_at: string;
    total_amount: number;
    status: string;
    order_items: {
        product_name: string;
        product_image: string;
        price: number;
        quantity: number;
    }[];
}

const OrdersScreen = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');
    const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            let query = supabase
                .from('orders' as any)
                .select(`
          id,
          created_at,
          total_amount,
          status,
          order_items (
            product_name,
            product_image,
            price,
            quantity
          )
        `);

            if (activeTab === 'buying') {
                query = query.eq('user_id', user.id);
            } else {
                query = query.eq('seller_id', user.id);
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data as unknown as Order[]);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, activeTab, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return '#F59E0B';
            case 'paid': return '#3B82F6';
            case 'shipped': return '#8B5CF6';
            case 'delivered': return Colors.success[500];
            case 'cancelled': return Colors.danger[500];
            default: return '#6B7280';
        }
    };

    const renderOrderItem = ({ item }: { item: Order }) => {
        const mainItem = item.order_items[0];
        const otherItemsCount = item.order_items.length - 1;

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => router.push(`/profile/order-details/${item.id}` as any)}
            >
                <View style={styles.orderHeader}>
                    <Text style={styles.orderDate}>
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.orderContent}>
                    <Image
                        source={{ uri: mainItem?.product_image }}
                        style={styles.productThumbnail}
                    />
                    <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={1}>
                            {mainItem?.product_name}
                        </Text>
                        {otherItemsCount > 0 && (
                            <Text style={styles.otherItemsText}>
                                + {otherItemsCount} other item{otherItemsCount > 1 ? 's' : ''}
                            </Text>
                        )}
                        <Text style={styles.orderTotal}>
                            ${item.total_amount.toFixed(2)}
                        </Text>
                    </View>
                    <ChevronLeftIcon size={20} color="#adb5bd" style={{ transform: [{ rotate: '180deg' }] }} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <InboxStackIcon size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
                {statusFilter === 'all'
                    ? "You haven't placed any orders yet."
                    : `You don't have any ${statusFilter} orders.`}
            </Text>
            <TouchableOpacity
                style={styles.shopButton}
                onPress={() => router.push('/browse' as any)}
            >
                <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
        </View>
    );

    const filters: OrderStatus[] = ['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order History</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'buying' && styles.activeTab]}
                    onPress={() => setActiveTab('buying')}
                >
                    <Text style={[styles.tabText, activeTab === 'buying' && styles.activeTabText]}>Buying</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'selling' && styles.activeTab]}
                    onPress={() => setActiveTab('selling')}
                >
                    <Text style={[styles.tabText, activeTab === 'selling' && styles.activeTabText]}>Selling</Text>
                </TouchableOpacity>
            </View>

            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterContainer}
                >
                    {filters.map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[
                                styles.filterChip,
                                statusFilter === filter && styles.activeFilterChip
                            ]}
                            onPress={() => setStatusFilter(filter)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                statusFilter === filter && styles.activeFilterChipText
                            ]}>
                                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    initialNumToRender={10}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary[500]}
                        />
                    }
                />
            )}
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
        borderRadius: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: Colors.primary[500],
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTabText: {
        color: Colors.primary[500],
    },
    filterContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activeFilterChip: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
    },
    activeFilterChipText: {
        color: '#FFF',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
        flexGrow: 1,
    },
    orderCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    orderDate: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    orderContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productThumbnail: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    otherItemsText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    orderTotal: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.primary[600],
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 40,
        marginBottom: 24,
    },
    shopButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 14,
    },
    shopButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
});

export default OrdersScreen;
