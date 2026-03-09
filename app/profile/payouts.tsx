import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    FlatList,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    BanknotesIcon,
    CurrencyDollarIcon,
    ClockIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    CreditCardIcon,
    ChevronRightIcon,
    InformationCircleIcon,
    ArrowTrendingUpIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

interface Transaction {
    id: string;
    type: 'earning' | 'payout';
    amount: number;
    description: string;
    date: string;
    status: 'completed' | 'pending' | 'failed';
}

const PayoutsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [balance, setBalance] = useState({ available: 0, pending: 0 });
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const fetchFinancialData = useCallback(async (showLoading = true) => {
        if (!user) return;
        if (showLoading) setLoading(true);

        try {
            // 1. Fetch orders to calculate real earnings
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('total_amount, status, created_at')
                .eq('seller_id', user.id)
                .in('status', ['paid', 'shipped', 'delivered']);

            if (ordersError) throw ordersError;

            const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

            // Mocking split between available and pending for demo
            setBalance({
                available: totalRevenue * 0.7,
                pending: totalRevenue * 0.3
            });

            // 2. Mock Transactions for Premium UI Feel
            const mockTransactions: Transaction[] = (orders || []).map((o, idx) => ({
                id: `txn-${idx}`,
                type: 'earning',
                amount: o.total_amount,
                description: `Sale of Listing #${idx + 101}`,
                date: o.created_at,
                status: o.status === 'delivered' ? 'completed' : 'pending'
            }));

            // Add a mock payout if there's revenue
            if (totalRevenue > 100) {
                mockTransactions.unshift({
                    id: 'payout-1',
                    type: 'payout',
                    amount: 50.00,
                    description: 'Monthly payout to Bank Account',
                    date: new Date(Date.now() - 86400000 * 2).toISOString(),
                    status: 'completed'
                });
            }

            setTransactions(mockTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        } catch (error) {
            console.error('Error fetching financial data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchFinancialData();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFinancialData(false);
    };

    const BalanceCard = () => (
        <View style={styles.balanceCard}>
            <View style={styles.balanceMain}>
                <View>
                    <Text style={styles.balanceLabel}>Available for payout</Text>
                    <Text style={styles.balanceValue}>€{balance.available.toFixed(2)}</Text>
                </View>
                <View style={styles.balanceIconBox}>
                    <BanknotesIcon size={32} color={Colors.primary[600]} />
                </View>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.pendingRow}>
                <View style={styles.pendingItem}>
                    <ClockIcon size={14} color={Colors.neutral[500]} />
                    <Text style={styles.pendingText}>Pending: <Text style={styles.pendingValue}>€{balance.pending.toFixed(2)}</Text></Text>
                </View>
                <TouchableOpacity style={styles.payoutBtn}>
                    <Text style={styles.payoutBtnText}>Payout Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const NextPayoutCard = () => (
        <View style={styles.nextPayoutCard}>
            <View style={styles.nextPayoutHeader}>
                <Text style={styles.nextPayoutTitle}>Next payout scheduled</Text>
                <InformationCircleIcon size={18} color={Colors.neutral[400]} />
            </View>
            <View style={styles.nextPayoutContent}>
                <View>
                    <Text style={styles.nextPayoutDate}>March 15, 2026</Text>
                    <Text style={styles.nextPayoutSub}>Estimated arrival in 3-5 days</Text>
                </View>
                <Text style={styles.nextPayoutAmount}>€{(balance.available * 0.5).toFixed(2)}</Text>
            </View>
        </View>
    );

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const isEarning = item.type === 'earning';
        const Icon = isEarning ? ArrowTrendingUpIcon : CreditCardIcon;
        const statusColor = item.status === 'completed' ? Colors.success[500] : item.status === 'pending' ? Colors.primary[500] : Colors.danger[500];

        return (
            <View style={styles.transactionItem}>
                <View style={[styles.txnIconBox, { backgroundColor: isEarning ? Colors.primary[50] : Colors.neutral[50] }]}>
                    <Icon size={20} color={isEarning ? Colors.primary[600] : Colors.neutral[600]} />
                </View>
                <View style={styles.txnContent}>
                    <View style={styles.txnHeader}>
                        <Text style={styles.txnTitle}>{item.description}</Text>
                        <Text style={[styles.txnAmount, { color: isEarning ? Colors.success[600] : Colors.text.primary }]}>
                            {isEarning ? '+' : '-'}€{item.amount.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.txnFooter}>
                        <Text style={styles.txnDate}>{new Date(item.date).toLocaleDateString()}</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payouts & Earnings</Text>
                <TouchableOpacity style={styles.circleBtn}>
                    <ArrowPathIcon size={20} color={Colors.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <BalanceCard />
                <NextPayoutCard />

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Payment Method</Text>
                    <TouchableOpacity>
                        <Text style={styles.editBtn}>Edit</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.paymentMethodCard}>
                    <View style={styles.bankIconBox}>
                        <BanknotesIcon size={24} color={Colors.primary[600]} />
                    </View>
                    <View style={styles.bankInfo}>
                        <Text style={styles.bankTitle}>Standard Bank Account</Text>
                        <Text style={styles.bankSub}>Ending in •••• 4521</Text>
                    </View>
                    <ChevronRightIcon size={20} color={Colors.neutral[400]} />
                </TouchableOpacity>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <TouchableOpacity>
                        <Text style={styles.viewAllBtn}>View All</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={item => item.id}
                    scrollEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <CurrencyDollarIcon size={48} color={Colors.neutral[200]} />
                            <Text style={styles.emptyText}>No financial activity yet</Text>
                        </View>
                    }
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
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
        backgroundColor: '#FFF',
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
        color: '#111827',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    balanceCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    balanceMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    balanceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 6,
    },
    balanceValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111827',
    },
    balanceIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
    },
    balanceDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginBottom: 16,
    },
    pendingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pendingText: {
        fontSize: 13,
        color: '#6B7280',
    },
    pendingValue: {
        fontWeight: '700',
        color: '#374151',
    },
    payoutBtn: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    payoutBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    nextPayoutCard: {
        backgroundColor: '#FFF9F5',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    nextPayoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    nextPayoutTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9A3412',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nextPayoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    nextPayoutDate: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    nextPayoutSub: {
        fontSize: 12,
        color: '#6B7280',
    },
    nextPayoutAmount: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.primary[600],
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    editBtn: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    viewAllBtn: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    paymentMethodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    bankIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    bankInfo: {
        flex: 1,
        marginLeft: 12,
    },
    bankTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    bankSub: {
        fontSize: 13,
        color: '#6B7280',
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    txnIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txnContent: {
        flex: 1,
        marginLeft: 12,
    },
    txnHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    txnTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    txnAmount: {
        fontSize: 15,
        fontWeight: '800',
    },
    txnFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    txnDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 12,
        color: '#9CA3AF',
        fontSize: 14,
    }
});

export default PayoutsScreen;
