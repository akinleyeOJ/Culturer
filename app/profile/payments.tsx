import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeftIcon,
    PlusIcon,
    CreditCardIcon,
    TrashIcon,
    XMarkIcon,
    CheckCircleIcon
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from 'react-native-heroicons/solid';

interface PaymentMethod {
    id: string;
    brand: 'visa' | 'mastercard' | 'amex' | 'discover';
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

    // Add New Card State
    const [showAddModal, setShowAddModal] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVC, setCardCVC] = useState('');
    const [cardName, setCardName] = useState('');

    useEffect(() => {
        if (user) fetchPaymentMethods();
    }, [user]);

    const fetchPaymentMethods = async () => {
        if (!user) return;
        try {
            // 1. Try fetching from Stripe via Edge Function
            const { data, error } = await supabase.functions.invoke('get-payment-methods', {
                body: { userId: user.id }
            });

            if (data?.paymentMethods) {
                const mappedCards = data.paymentMethods
                    .filter((pm: any) => pm.type === 'card' && pm.card)
                    .map((pm: any) => ({
                        id: pm.id,
                        brand: pm.card.brand,
                        last4: pm.card.last4,
                        expMonth: pm.card.exp_month?.toString().padStart(2, '0') || '12',
                        expYear: pm.card.exp_year?.toString().slice(-2) || '25',
                        isDefault: false
                    }));
                setCards(mappedCards);
            } else {
                // Fallback to local profile data if no Stripe data found (legacy)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('payment_methods')
                    .eq('id', user.id)
                    .single();

                if (profile?.payment_methods) {
                    // Check if it's the old single object or new array
                    const pm = profile.payment_methods as any;
                    if (Array.isArray(pm)) {
                        setCards(pm);
                    } else if (pm.last4) {
                        // Single card legacy format
                        setCards([{
                            id: 'legacy_card',
                            brand: pm.brand || 'card',
                            last4: pm.last4,
                            expMonth: '12', // Placeholder
                            expYear: '25', // Placeholder
                            isDefault: true
                        }]);
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching cards:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCard = async () => {
        Alert.alert(
            "Add Card",
            "To ensure the highest security standards, new payment methods can only be added securely during the checkout process.",
            [{ text: "OK" }]
        );
        setShowAddModal(false);
    };

    const handleDeleteCard = async (id: string) => {
        Alert.alert(
            "Remove Card",
            "Are you sure you want to remove this payment method?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        const updatedCards = cards.filter(c => c.id !== id);
                        try {
                            setSaving(true);
                            const { error } = await supabase.from('profiles').update({
                                payment_methods: updatedCards as any
                            }).eq('id', user!.id);

                            if (error) throw error;
                            setCards(updatedCards);
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSetDefault = async (id: string) => {
        const updatedCards = cards.map(c => ({
            ...c,
            isDefault: c.id === id
        }));

        try {
            setCards(updatedCards); // Optimistic
            const { error } = await supabase.from('profiles').update({
                payment_methods: updatedCards as any
            }).eq('id', user!.id);

            if (error) throw error;
        } catch (e: any) {
            Alert.alert('Error', 'Failed to update default card');
        }
    };

    const getCardBrand = (number: string): PaymentMethod['brand'] => {
        if (number.startsWith('4')) return 'visa';
        if (number.startsWith('5')) return 'mastercard';
        if (number.startsWith('3')) return 'amex';
        return 'visa'; // Default fallback
    };

    const resetForm = () => {
        setCardNumber('');
        setCardExpiry('');
        setCardCVC('');
        setCardName('');
    };

    const getBrandIcon = (brand: string) => {
        // Simple text fallback or require actual images
        // using heroicons for generic currently
        return <CreditCardIcon size={24} color={Colors.text.primary} />;
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

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.description}>
                    Manage your saved payment methods for faster checkout.
                </Text>

                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    <View>
                        {cards.map(card => (
                            <View key={card.id} style={styles.cardItem}>
                                <TouchableOpacity
                                    style={styles.cardContent}
                                    onPress={() => handleSetDefault(card.id)}
                                >
                                    <View style={styles.cardIconBox}>
                                        {getBrandIcon(card.brand)}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.row}>
                                            <Text style={styles.cardLast4}>•••• •••• •••• {card.last4}</Text>
                                            {card.isDefault && (
                                                <View style={styles.defaultBadge}>
                                                    <Text style={styles.defaultText}>Default</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.cardExp}>Expires {card.expMonth}/{card.expYear}</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDeleteCard(card.id)}
                                >
                                    <TrashIcon size={20} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addNewButton} onPress={() => setShowAddModal(true)}>
                            <View style={styles.plusIconBg}>
                                <PlusIcon size={16} color="#FFF" />
                            </View>
                            <Text style={styles.addNewText}>Add New Card</Text>
                        </TouchableOpacity>

                        <Text style={styles.securityNote}>
                            To ensure security, please add new cards during checkout.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Add Card Modal */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.circleBtn}>
                            <XMarkIcon size={24} color={Colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Add New Card</Text>
                        <TouchableOpacity onPress={handleAddCard} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color={Colors.primary[500]} /> : (
                                <Text style={styles.saveText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.formContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Card Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0000 0000 0000 0000"
                                keyboardType="number-pad"
                                value={cardNumber}
                                onChangeText={setCardNumber}
                                maxLength={19}
                            />
                        </View>

                        <View style={styles.rowGap}>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>Expiry Date</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="MM/YY"
                                    keyboardType="number-pad"
                                    value={cardExpiry}
                                    onChangeText={setCardExpiry}
                                    maxLength={5}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>CVC</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="123"
                                    keyboardType="number-pad"
                                    value={cardCVC}
                                    onChangeText={setCardCVC}
                                    maxLength={4}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Cardholder Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Name on card"
                                value={cardName}
                                onChangeText={setCardName}
                            />
                        </View>

                        <View style={styles.infoBox}>
                            <CheckCircleSolidIcon size={20} color={Colors.success[500]} />
                            <Text style={styles.infoText}>Your payment information is encrypted and secure.</Text>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

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
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    securityNote: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 16,
        marginBottom: 32,
    },
    content: {
        padding: 16,
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardIconBox: {
        width: 48,
        height: 32,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardLast4: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginRight: 8,
    },
    cardExp: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    defaultBadge: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary[200],
    },
    defaultText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.primary[700],
    },
    deleteBtn: {
        padding: 8,
        marginLeft: 8,
    },
    addNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        marginTop: 8,
    },
    plusIconBg: {
        width: 24,
        height: 24,
        borderRadius: 12, // Circle
        backgroundColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addNewText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    formContent: {
        padding: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
    },
    rowGap: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    halfInput: {
        flex: 1,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
        gap: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#065F46',
        flex: 1,
    },
});
