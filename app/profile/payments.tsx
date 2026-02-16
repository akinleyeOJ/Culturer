import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeftIcon,
    CreditCardIcon,
    TrashIcon,
    ShieldCheckIcon,
    PlusIcon,
    ChevronRightIcon
} from 'react-native-heroicons/outline';

interface PaymentMethod {
    id: string;
    brand: 'visa' | 'mastercard' | 'amex' | 'discover' | string;
    last4: string;
    expMonth: string;
    expYear: string;
    isDefault?: boolean;
}

export default function PaymentMethodsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cards, setCards] = useState<PaymentMethod[]>([]);

    useEffect(() => {
        if (user) fetchPaymentMethods();
    }, [user]);

    const fetchPaymentMethods = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data: stripeData } = await supabase.functions.invoke('get-payment-methods', {
                body: { userId: user.id }
            });

            const { data: profile } = await supabase
                .from('profiles')
                .select('payment_methods')
                .eq('id', user.id)
                .single();

            const profilePMs: any[] = Array.isArray(profile?.payment_methods) 
                ? profile.payment_methods 
                : (profile?.payment_methods ? [profile.payment_methods] : []);

            const checkIsDefault = (id: string) => {
                const found = profilePMs.find((p: any) => p.id === id);
                return !!found?.isDefault;
            };

            let allCards: PaymentMethod[] = [];
            if (stripeData?.paymentMethods) {
                allCards = stripeData.paymentMethods.map((pm: any) => ({
                    id: pm.id,
                    brand: pm.brand || 'card',
                    last4: pm.last4 || '****',
                    expMonth: pm.exp_month?.toString().padStart(2, '0') || '12',
                    expYear: pm.exp_year?.toString().slice(-2) || '25',
                    isDefault: checkIsDefault(pm.id)
                }));
            }

            const stripeIds = new Set(allCards.map(c => c.id));
            profilePMs.forEach((pm: any) => {
                if (pm.id && !stripeIds.has(pm.id)) {
                    allCards.push({
                        id: pm.id,
                        brand: pm.brand || 'card',
                        last4: pm.last4 || '****',
                        expMonth: pm.expMonth || '12',
                        expYear: pm.expYear || '25',
                        isDefault: !!pm.isDefault
                    });
                }
            });

            if (allCards.length > 0 && !allCards.some(c => c.isDefault)) {
                allCards[0].isDefault = true;
            }
            setCards(allCards);
        } catch (e) {
            console.error('Error fetching cards:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSetDefault = async (id: string) => {
        const updatedCards = cards.map(c => ({ ...c, isDefault: c.id === id }));
        try {
            setCards(updatedCards);
            await supabase.from('profiles').update({ payment_methods: updatedCards as any }).eq('id', user!.id);
        } catch (e) {
            console.error('Failed to update default card:', e);
        }
    };

    const handleAddNewCard = () => {
        Alert.alert(
            "Secure Addition",
            "To protect your data, new cards can only be added securely during the checkout process.",
            [{ text: "OK" }]
        );
    };

    const handleDeleteCard = async (id: string) => {
        Alert.alert("Remove Card", "Are you sure you want to remove this payment method?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                    const updatedCards = cards.filter(c => c.id !== id);
                    if (cards.find(c => c.id === id)?.isDefault && updatedCards.length > 0) {
                        updatedCards[0].isDefault = true;
                    }
                    try {
                        setSaving(true);
                        setCards(updatedCards);
                        await supabase.from('profiles').update({ payment_methods: updatedCards as any }).eq('id', user!.id);
                    } catch (e) {
                        fetchPaymentMethods();
                    } finally {
                        setSaving(false);
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Methods</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[500]} /></View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>SAVED CARDS</Text>

                        {cards.map((card) => (
                            <View key={card.id} style={styles.cardItem}>
                                {/* Radio button for uniformity with address screen */}
                                <TouchableOpacity
                                    style={styles.radioButton}
                                    onPress={() => handleSetDefault(card.id)}
                                >
                                    <View style={[styles.radioOuter, card.isDefault && styles.radioOuterSelected]}>
                                        {card.isDefault && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.cardContentContainer}>
                                    <View style={styles.iconBox}>
                                        <CreditCardIcon size={20} color={Colors.text.primary} />
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardLabel}>
                                            {card.brand.toUpperCase()} •••• {card.last4}
                                        </Text>
                                        <Text style={styles.cardDetail}>Expires {card.expMonth}/{card.expYear}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteCard(card.id)} style={styles.deleteBtn}>
                                        <TrashIcon size={18} color={Colors.neutral[400]} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.securitySection}>
                        <View style={styles.securityHeader}>
                            <ShieldCheckIcon size={20} color={Colors.success[600]} />
                            <Text style={styles.securityTitle}>Bank-Grade Security</Text>
                        </View>
                        <Text style={styles.securityText}>
                            We use Stripe to ensure your payment information is encrypted and never stored on our servers.
                        </Text>

                        <View style={styles.securityDivider} />

                        <View style={styles.securityHeader}>
                            <ShieldCheckIcon size={20} color={Colors.success[600]} />
                            <Text style={styles.securityTitle}>Secure Payments</Text>
                        </View>
                        <Text style={styles.securityText}>
                            To ensure the highest level of security, you can only add new payment methods securely during the checkout process.
                        </Text>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
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
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingBottom: 40 },
    sectionContainer: { padding: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.neutral[500], letterSpacing: 1, marginBottom: 16 },
    cardItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    radioButton: { paddingRight: 16 },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: { borderColor: Colors.primary[500] },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary[500] },
    cardContentContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    iconBox: {
        width: 40,
        height: 40,
        backgroundColor: '#FFF',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardInfo: { flex: 1 },
    cardLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    cardDetail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    deleteBtn: { padding: 4 },
    addNewButton: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 8 },
    plusIconBg: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addNewText: { fontSize: 15, fontWeight: '600', color: Colors.primary[600] },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
    securityDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16, marginVertical: 12 },
    securitySection: { padding: 20, backgroundColor: '#F0FDF4', margin: 16, borderRadius: 16 },
    securityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, },
    securityTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
    securityText: { fontSize: 13, color: '#15803d', lineHeight: 20 },
    securityBox: {
        backgroundColor: '#F0FDF4', // Light green
        padding: 16,
        borderRadius: 16,
        marginTop: 24,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
});