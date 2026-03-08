import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    ArrowTrendingUpIcon,
    EyeIcon,
    HeartIcon,
    ShoppingBagIcon,
    BanknotesIcon,
    ArrowPathIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSellerAnalytics } from '../../lib/services/productService';

const SellerAnalyticsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);

    const loadAnalytics = async () => {
        if (!user) return;
        setLoading(true);
        const result = await fetchSellerAnalytics(user.id);
        if (result) {
            setData(result);
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        loadAnalytics();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAnalytics();
    };

    const SummaryCard = ({ icon: Icon, label, value, color, unit = '' }: any) => (
        <View style={styles.summaryCard}>
            <View style={[styles.iconBox, { backgroundColor: color + '10' }]}>
                <Icon size={22} color={color} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardValue}>{unit}{value}</Text>
                <Text style={styles.cardLabel}>{label}</Text>
            </View>
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
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Summary Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Performance Overview</Text>
                    <View style={styles.summaryGrid}>
                        <SummaryCard
                            icon={EyeIcon}
                            label="Total Views"
                            value={data?.summary.views || 0}
                            color={Colors.primary[500]}
                        />
                        <SummaryCard
                            icon={HeartIcon}
                            label="Total Saves"
                            value={data?.summary.saves || 0}
                            color="#EF4444"
                        />
                        <SummaryCard
                            icon={ShoppingBagIcon}
                            label="Total Sales"
                            value={data?.summary.sales || 0}
                            color={Colors.success[500]}
                        />
                        <SummaryCard
                            icon={BanknotesIcon}
                            label="Revenue"
                            unit="€"
                            value={(data?.summary.revenue || 0).toFixed(2)}
                            color={Colors.secondary[500]}
                        />
                    </View>
                </View>

                {/* Conversion Insights */}
                <View style={styles.insightBox}>
                    <View style={styles.insightHeader}>
                        <ArrowTrendingUpIcon size={20} color={Colors.primary[600]} />
                        <Text style={styles.insightTitle}>Conversion Insight</Text>
                    </View>
                    <Text style={styles.insightText}>
                        Your average conversion rate is <Text style={styles.bold}>
                            {data?.summary.views > 0 ? ((data.summary.sales / data.summary.views) * 100).toFixed(1) : 0}%
                        </Text>.
                        {data?.summary.sales > 0 ? " You're doing great! " : " Try updating photos or descriptions to boost interest."}
                    </Text>
                </View>

                {/* Popularity Chart */}
                {data?.productStats.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Views by Product</Text>
                        <View style={styles.chartContainer}>
                            {data.productStats.slice(0, 5).map((item: any) => {
                                const maxViews = Math.max(...data.productStats.map((p: any) => p.views), 1);
                                const barWidth = (item.views / maxViews) * 100;
                                return (
                                    <View key={item.id} style={styles.chartRow}>
                                        <Text style={styles.chartLabel} numberOfLines={1}>{item.name}</Text>
                                        <View style={styles.barBackground}>
                                            <View style={[styles.barFill, { width: `${barWidth}%` }]} />
                                            <Text style={styles.barValue}>{item.views}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Listing Breakdown */}
                <View style={styles.section}>
                    <View style={styles.titleRow}>
                        <Text style={styles.sectionTitle}>Breakdown by Listing</Text>
                        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                            <ArrowPathIcon size={16} color={Colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {data?.productStats.length > 0 ? (
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.col, { flex: 2 }]}>Product</Text>
                                <Text style={styles.col}>Views</Text>
                                <Text style={styles.col}>Saves</Text>
                                <Text style={styles.col}>Sales</Text>
                            </View>
                            {data.productStats.map((item: any) => (
                                <View key={item.id} style={styles.tableRow}>
                                    <View style={[styles.col, { flex: 2 }]}>
                                        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.convText}>{item.conversion.toFixed(1)}% Conv.</Text>
                                    </View>
                                    <Text style={styles.colValue}>{item.views}</Text>
                                    <Text style={styles.colValue}>{item.saves}</Text>
                                    <Text style={styles.colValue}>{item.sales}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No active listings yet.</Text>
                        </View>
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
        backgroundColor: '#FAFAFA',
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
        backgroundColor: '#fff',
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
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    summaryCard: {
        width: (Dimensions.get('window').width - 44) / 2,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardContent: {
        gap: 2,
    },
    cardValue: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    cardLabel: {
        fontSize: 12,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    insightBox: {
        backgroundColor: Colors.primary[50],
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.primary[100],
        marginBottom: 24,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    insightTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[800],
    },
    insightText: {
        fontSize: 13,
        color: Colors.primary[900],
        lineHeight: 18,
    },
    bold: {
        fontWeight: '800',
    },
    chartContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    chartRow: {
        marginBottom: 12,
    },
    chartLabel: {
        fontSize: 12,
        color: Colors.text.secondary,
        marginBottom: 4,
        fontWeight: '500',
    },
    barBackground: {
        height: 24,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        overflow: 'hidden',
    },
    barFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: Colors.primary[200],
        borderRadius: 12,
    },
    barValue: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.primary[700],
        marginLeft: 'auto',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    refreshBtn: {
        padding: 4,
    },
    table: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    col: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    colValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
        textAlign: 'left',
    },
    productName: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 2,
    },
    convText: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.success[600],
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    emptyText: {
        color: Colors.text.secondary,
        fontSize: 14,
    }
});

export default SellerAnalyticsScreen;
