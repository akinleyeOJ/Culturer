import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    ArrowPathIcon,
    BanknotesIcon,
    ShoppingBagIcon,
    ArrowTrendingUpIcon,
    EyeIcon,
    HeartIcon,
    GlobeAltIcon,
    TruckIcon,
    ClipboardDocumentCheckIcon
} from 'react-native-heroicons/outline';
import {
    GlobeAltIcon as GlobeSolidIcon,
    ArrowUpIcon,
    ArrowDownIcon,
} from 'react-native-heroicons/solid';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSellerAnalytics, DateRange } from '../../lib/services/productService';
import { supabase } from '../../lib/supabase';

const SellerAnalyticsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [range, setRange] = useState<DateRange>('7days');
    const [data, setData] = useState<any>(null);

    const loadAnalytics = useCallback(async (showLoading = true) => {
        if (!user) return;
        if (showLoading) setLoading(true);
        const result = await fetchSellerAnalytics(user.id, range);
        if (result) {
            setData(result);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user, range]);

    useEffect(() => {
        loadAnalytics();
    }, [range, user]);

    // Real-time listener
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('analytics_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'listing_analytics',
                    filter: `seller_id=eq.${user.id}`
                },
                () => {
                    // Refresh data quietly when a new event occurs
                    loadAnalytics(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAnalytics(false);
    };

    const SummaryCard = ({ icon: Icon, label, value, color, unit = '', trend = '' }: any) => {
        const isPositive = trend.startsWith('+');
        const isNegative = trend.startsWith('-');
        const trendColor = isPositive ? Colors.success[500] : isNegative ? '#EF4444' : '#9CA3AF';

        return (
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.cardLabel}>{label}</Text>
                    <Icon size={18} color={color} />
                </View>
                <Text style={styles.cardValue}>{unit}{value}</Text>
                {trend && range !== 'all' ? (
                    <View style={styles.trendRow}>
                        <ArrowTrendingUpIcon
                            size={10}
                            color={trendColor}
                            style={{ transform: [{ rotate: isNegative ? '180deg' : '0deg' }] }}
                        />
                        <Text style={[styles.trendText, { color: trendColor }]}>{trend}</Text>
                    </View>
                ) : null}
            </View>
        );
    };

    const DateFilter = () => (
        <View style={styles.filterRow}>
            {(['7days', '30days', 'year'] as const).map((r) => (
                <TouchableOpacity
                    key={r}
                    style={[styles.filterBtn, range === r && { backgroundColor: Colors.primary[500] }]}
                    onPress={() => setRange(r)}
                >
                    <Text style={[styles.filterBtnText, range === r && styles.filterBtnTextActive]}>
                        {r === '7days' ? 'Last 7 days' : r === '30days' ? 'Last 30 days' : 'This Year'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Listing Analytics</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <ArrowPathIcon size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <DateFilter />

                {/* Summary Section */}
                <View style={styles.summaryGrid}>
                    <SummaryCard
                        icon={BanknotesIcon}
                        label="Total Revenue"
                        unit="€"
                        value={(data?.summary.revenue || 0).toFixed(2)}
                        color={Colors.primary[500]}
                        trend={data?.summary.trends.revenue}
                    />
                    <SummaryCard
                        icon={ShoppingBagIcon}
                        label="Total Sales"
                        value={data?.summary.sales || 0}
                        color={Colors.primary[500]}
                        trend={data?.summary.trends.sales}
                    />
                    <SummaryCard
                        icon={ArrowTrendingUpIcon}
                        label="Conversion Rate"
                        value={(data?.summary.views > 0 ? (data.summary.sales / data.summary.views * 100).toFixed(1) : '0') + '%'}
                        color={Colors.primary[500]}
                        trend={data?.summary.trends.conversion}
                    />
                    <SummaryCard
                        icon={EyeIcon}
                        label="Shop Views"
                        value={data?.summary.views || 0}
                        color={Colors.primary[500]}
                        trend={data?.summary.trends.views}
                    />
                </View>

                {/* Fulfillment Tracking */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Fulfillment</Text>
                    <View style={styles.fulfillmentRow}>
                        <TouchableOpacity
                            style={styles.fulfillmentCard}
                            onPress={() => router.push('/profile/orders?tab=selling&status=paid')}
                        >
                            <View style={[styles.fulfillmentIcon, { backgroundColor: '#F8F9FA' }]}>
                                <ClipboardDocumentCheckIcon size={20} color={Colors.primary[500]} />
                            </View>
                            <View>
                                <Text style={styles.fulfillmentValue}>{data?.fulfillment?.toShip || 0}</Text>
                                <Text style={styles.fulfillmentLabel}>To Ship</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.fulfillmentCard}
                            onPress={() => router.push('/profile/orders?tab=selling&status=shipped')}
                        >
                            <View style={[styles.fulfillmentIcon, { backgroundColor: '#F8F9FA' }]}>
                                <TruckIcon size={20} color={Colors.primary[500]} />
                            </View>
                            <View>
                                <Text style={styles.fulfillmentValue}>{data?.fulfillment?.inTransit || 0}</Text>
                                <Text style={styles.fulfillmentLabel}>In Transit</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Traffic Trends Chart */}
                <View style={styles.section}>
                    <View style={styles.titleRow}>
                        <Text style={styles.sectionTitle}>Traffic Trends</Text>
                    </View>
                    <View style={styles.chartContainer}>
                        <View style={styles.vBarChart}>
                            {data?.trends.map((item: any, idx: number) => {
                                const maxVal = Math.max(...data.trends.map((t: any) => t.value), 1);
                                const height = (item.value / maxVal) * 100;

                                // Show all labels for 7 days, every 5th for 30 days, every month for year
                                const showLabel =
                                    range === '7days' ||
                                    (range === '30days' && idx % 5 === 0) ||
                                    (range === 'year') ||
                                    idx === data.trends.length - 1;

                                return (
                                    <View key={idx} style={[styles.vBarColumn, range === '30days' && { marginHorizontal: 0 }]}>
                                        <View style={[styles.vBarTrack, range === '30days' && { width: 8 }]}>
                                            <View style={[
                                                styles.vBarFill,
                                                { height: `${Math.max(height, 5)}%` },
                                                item.value === maxVal && item.value > 0 && { backgroundColor: Colors.primary[500] }
                                            ]} />
                                        </View>
                                        {showLabel && (
                                            <View style={styles.vBarLabelContainer}>
                                                <Text style={styles.vBarLabel} numberOfLines={1}>{item.label}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Cultures Reached */}
                <View style={styles.section}>
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>Cultures Reached</Text>
                            <Text style={styles.sectionSubtitle}>Discover which traditions resonate with your buyers</Text>
                        </View>
                        <GlobeAltIcon size={20} color={Colors.primary[500]} />
                    </View>
                    <View style={styles.cultureGrid}>
                        {data?.culturalReach.length > 0 ? data.culturalReach.map((item: any, idx: number) => (
                            <View key={idx} style={styles.cultureCard}>
                                <Text style={styles.cultureName}>{item.name}</Text>
                                <Text style={styles.cultureCount}>{item.count} interactions</Text>
                            </View>
                        )) : (
                            <View style={styles.emptyContainer}>
                                <GlobeSolidIcon size={24} color="#D1D5DB" />
                                <Text style={styles.emptyText}>Share your listings to start tracking cultural engagement</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Top Listings */}
                <View style={styles.section}>
                    <View style={styles.titleRow}>
                        <Text style={styles.sectionTitle}>Top Listings</Text>
                    </View>

                    {data?.productStats.length > 0 ? data.productStats.map((item: any) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.listingItem}
                            onPress={() => router.push(`/item/${item.id}`)}
                        >
                            <Image
                                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop' }}
                                style={styles.listingImage}
                            />
                            <View style={styles.listingMeta}>
                                <Text style={styles.listingName} numberOfLines={1}>{item.name}</Text>
                                <View style={styles.listingStats}>
                                    <View style={styles.miniStat}>
                                        <EyeIcon size={12} color="#9CA3AF" />
                                        <Text style={styles.miniStatText}>{item.views}</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                        <HeartIcon size={12} color="#9CA3AF" />
                                        <Text style={styles.miniStatText}>{item.saves}</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                        <ShoppingBagIcon size={12} color="#9CA3AF" />
                                        <Text style={styles.miniStatText}>{item.sales}</Text>
                                    </View>
                                </View>
                            </View>
                            <Text style={styles.listingPrice}>€{item.price}</Text>
                        </TouchableOpacity>
                    )) : (
                        <Text style={styles.emptyText}>No listings yet</Text>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    refreshBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    filterRow: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        padding: 4,
        borderRadius: 12,
        marginBottom: 20,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    filterBtnActive: {
        backgroundColor: Colors.primary[500],
    },
    filterBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterBtnTextActive: {
        color: '#fff',
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    summaryCard: {
        width: (Dimensions.get('window').width - 44) / 2,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    cardValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 4,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.success[500],
    },
    section: {
        marginBottom: 24,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111827',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
        fontWeight: '500',
    },
    seeFullReport: {
        fontSize: 14,
        color: '#5856D6',
        fontWeight: '600',
    },
    chartContainer: {
        backgroundColor: '#fff',
        paddingTop: 20,
        paddingBottom: 30,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    vBarChart: {
        flexDirection: 'row',
        height: 120,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    vBarColumn: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    vBarTrack: {
        flex: 1,
        width: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    vBarFill: {
        width: '100%',
        backgroundColor: '#E5E7EB',
        borderRadius: 6,
    },
    vBarMax: {
        backgroundColor: Colors.primary[500],
    },
    vBarLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    vBarLabelContainer: {
        position: 'absolute',
        bottom: -20,
        width: 30,
        alignItems: 'center',
    },
    cultureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    cultureCard: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: Colors.primary[50],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    cultureName: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary[800],
    },
    cultureCount: {
        fontSize: 11,
        color: Colors.primary[600],
    },
    listingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    listingImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    listingMeta: {
        flex: 1,
        marginLeft: 12,
    },
    listingName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    listingStats: {
        flexDirection: 'row',
        gap: 12,
    },
    miniStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    miniStatText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    listingPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    emptyContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        maxWidth: 200,
    },
    fulfillmentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    fulfillmentCard: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    fulfillmentIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fulfillmentValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    fulfillmentLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    }
});

export default SellerAnalyticsScreen;
