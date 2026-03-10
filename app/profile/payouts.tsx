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
    ArrowTrendingUpIcon,
    ShoppingBagIcon,
    PlusIcon,
    GlobeAltIcon,
    ClipboardDocumentCheckIcon
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
    const [balance, setBalance] = useState({ available: 0, pending: 0, totalLifetime: 0 });
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [paymentMethods, setPaymentMethods] = useState([
        { id: '1', type: 'bank', name: 'Standard Bank Account', detail: '•••• 4521', isDefault: true },
        { id: '2', type: 'card', name: 'Visa Business', detail: '•••• 8829', isDefault: false }
    ]);

    const fetchFinancialData = useCallback(async (showLoading = true) => {
        if (!user) return;
        if (showLoading) setLoading(true);

        try {
            // 1. Fetch orders (Selling)
            const { data: sales, error: salesError } = await supabase
                .from('orders')
                .select('id, total_amount, status, created_at')
                .eq('seller_id', user.id);

            // 2. Fetch orders (Buying)
            const { data: purchases, error: purchaseError } = await supabase
                .from('orders')
                .select('id, total_amount, status, created_at')
                .eq('buyer_id', user.id);

            if (salesError || purchaseError) throw salesError || purchaseError;

            // Calculate metrics
            const totalRevenue = sales?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            const availableRev = sales?.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

            setBalance({
                available: availableRev * 0.9, // Simplified commission logic
                pending: (totalRevenue - availableRev) * 0.9,
                totalLifetime: totalRevenue * 1.0 // Total revenue before deductions
            });

            // 3. Consolidated Activity
            const combined: Transaction[] = [
                ...(sales || []).map((o: any) => ({
                    id: `sale-${o.id}`,
                    type: 'earning' as const,
                    amount: o.total_amount,
                    description: `Sale #${o.id.slice(0, 8)}`,
                    date: o.created_at,
                    status: (o.status === 'delivered' ? 'completed' : 'pending') as any
                })),
                ...(purchases || []).map((o: any) => ({
                    id: `buy-${o.id}`,
                    type: 'payout' as const,
                    amount: o.total_amount,
                    description: `Purchase #${o.id.slice(0, 8)}`,
                    date: o.created_at,
                    status: 'completed' as any
                }))
            ];

            setTransactions(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

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

            <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Total Lifetime</Text>
                    <Text style={styles.metricValue}>€{balance.totalLifetime.toFixed(2)}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Pending</Text>
                    <Text style={styles.metricValue}>€{balance.pending.toFixed(2)}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.mainPayoutBtn}>
                <Text style={styles.mainPayoutBtnText}>Request Payout</Text>
            </TouchableOpacity>
        </View>
    );

    const SettingsSection = ({ title, icon: Icon, children }: any) => (
        <View style={styles.settingsSection}>
            <View style={styles.settingsHeader}>
                <Icon size={20} color={Colors.neutral[600]} />
                <Text style={styles.settingsTitle}>{title}</Text>
            </View>
            {children}
        </View>
    );

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const isEarning = item.type === 'earning';
        const Icon = isEarning ? ArrowTrendingUpIcon : ShoppingBagIcon;
        const statusColor = item.status === 'completed' ? Colors.success[500] : item.status === 'pending' ? Colors.primary[500] : Colors.danger[500];

        return (
            <View style={styles.transactionItem}>
                <View style={[styles.txnIconBox, { backgroundColor: isEarning ? Colors.primary[50] : Colors.neutral[50] }]}>
                    <Icon size={20} color={isEarning ? Colors.primary[600] : Colors.neutral[600]} />
                </View>
                <View style={styles.txnContent}>
                    <View style={styles.txnHeader}>
                        <Text style={styles.txnTitle} numberOfLines={1}>{item.description}</Text>
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
                <Text style={styles.headerTitle}>Earnings Hub</Text>
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

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Payout Methods</Text>
                    <TouchableOpacity>
                        <PlusIcon size={20} color={Colors.primary[600]} />
                    </TouchableOpacity>
                </View>

                {paymentMethods.map((pm) => (
                    <TouchableOpacity key={pm.id} style={styles.paymentMethodCard}>
                        <View style={styles.bankIconBox}>
                            {pm.type === 'bank' ? <BanknotesIcon size={22} color={Colors.primary[600]} /> : <CreditCardIcon size={22} color={Colors.primary[600]} />}
                        </View>
                        <View style={styles.bankInfo}>
                            <Text style={styles.bankTitle}>{pm.name}</Text>
                            <Text style={styles.bankSub}>{pm.detail}</Text>
                        </View>
                        {pm.isDefault && (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultText}>Primary</Text>
                            </View>
                        )}
                        <ChevronRightIcon size={18} color={Colors.neutral[400]} />
                    </TouchableOpacity>
                ))}

                <View style={styles.complianceRow}>
                    <TouchableOpacity style={styles.complianceCard}>
                        <GlobeAltIcon size={20} color={Colors.neutral[600]} />
                        <View style={styles.complianceInfo}>
                            <Text style={styles.complianceTitle}>Preferred Currency</Text>
                            <Text style={styles.complianceSub}>Euro (€)</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.complianceCard}>
                        <ClipboardDocumentCheckIcon size={20} color={Colors.neutral[600]} />
                        <View style={styles.complianceInfo}>
                            <Text style={styles.complianceTitle}>Tax Documents</Text>
                            <Text style={styles.complianceSub}>2025 Forms</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <TouchableOpacity>
                        <Text style={styles.viewAllBtn}>History</Text>
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
                            <Text style={styles.emptyText}>No financial activity found</Text>
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
        marginBottom: 24,
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
        marginBottom: 20,
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    metricItem: {
        flex: 1,
    },
    metricLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4B5563',
    },
    metricDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 16,
    },
    mainPayoutBtn: {
        backgroundColor: Colors.primary[500],
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainPayoutBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    settingsSection: {
        marginBottom: 24,
    },
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    settingsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
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
        marginBottom: 12,
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
    defaultBadge: {
        backgroundColor: Colors.success[50],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 10,
    },
    defaultText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.success[600],
    },
    complianceRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    complianceCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 12,
        gap: 10,
    },
    complianceInfo: {
        flex: 1,
    },
    complianceTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4B5563',
    },
    complianceSub: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
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
        flex: 1,
        marginRight: 8,
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
