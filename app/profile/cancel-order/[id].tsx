import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, CheckIcon } from 'react-native-heroicons/outline';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/color';

const CANCEL_REASONS = [
    'Changed my mind',
    'Found a better price elsewhere',
    'Ordered by mistake',
    'Shipping time is too long',
    'Incorrect shipping address',
    'Other'
];

const CancelOrderScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [otherReason, setOtherReason] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleCancelOrder = async () => {
        if (!selectedReason) {
            Alert.alert('Selection Required', 'Please select a reason for cancellation.');
            return;
        }

        const finalReason = selectedReason === 'Other' ? otherReason : selectedReason;
        if (selectedReason === 'Other' && !otherReason.trim()) {
            Alert.alert('Details Required', 'Please provide details for the cancellation reason.');
            return;
        }

        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order? This action cannot be undone.',
            [
                { text: 'No, keep it', style: 'cancel' },
                {
                    text: 'Yes, cancel order',
                    style: 'destructive',
                    onPress: performCancellation
                }
            ]
        );
    };

    const performCancellation = async () => {
        setLoading(true);
        try {
            // 1. Verify eligibility FIRST
            const { data: orderToCheck, error: fetchError } = await supabase
                .from('orders' as any)
                .select('status, user_id')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;
            const orderData = orderToCheck as any;
            if (!orderData) throw new Error("Order not found");

            if (orderData.user_id !== user?.id) {
                throw new Error("You do not have permission to cancel this order.");
            }
            if (orderData.status !== 'pending') {
                throw new Error(`Order status is '${orderData.status}', cannot cancel.`);
            }

            // 2. Perform Update
            const { data: updatedOrder, error: updateError } = await supabase
                .from('orders' as any)
                .update({
                    status: 'cancelled',
                    notes: `Cancellation Reason: ${selectedReason === 'Other' ? otherReason : selectedReason}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .maybeSingle();

            if (updateError) throw updateError;

            if (!updatedOrder) {
                throw new Error("Cancellation failed. Row Level Security violation likely.");
            }

            // 3. Notify Seller (Implementation depends on notification system)
            // We could add a notification here similar to checkout.tsx

            Alert.alert('Success', 'Your order has been cancelled successfully.');
            router.dismiss(2); // Go back to Order History, skipping Order Details
        } catch (error: any) {
            console.error('Error cancelling order:', error);
            Alert.alert('Cancellation Failed', error.message || 'Could not cancel the order.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cancel Order</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Why are you cancelling?</Text>
                <Text style={styles.subtitle}>Please select a reason for cancellation to help us improve.</Text>

                <View style={styles.reasonsList}>
                    {CANCEL_REASONS.map((reason) => (
                        <TouchableOpacity
                            key={reason}
                            style={[
                                styles.reasonItem,
                                selectedReason === reason && styles.selectedReasonItem
                            ]}
                            onPress={() => setSelectedReason(reason)}
                        >
                            <Text style={[
                                styles.reasonText,
                                selectedReason === reason && styles.selectedReasonText
                            ]}>{reason}</Text>
                            {selectedReason === reason && (
                                <CheckIcon size={20} color={Colors.primary[500]} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {selectedReason === 'Other' && (
                    <View style={styles.otherInputWrapper}>
                        <Text style={styles.inputLabel}>Please specify:</Text>
                        <TextInput
                            style={styles.otherInput}
                            placeholder="Tell us more..."
                            value={otherReason}
                            onChangeText={setOtherReason}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.confirmButton, !selectedReason && styles.disabledButton]}
                    onPress={handleCancelOrder}
                    disabled={loading || !selectedReason}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.confirmButtonText}>Confirm Cancellation</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        padding: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        lineHeight: 22,
        marginBottom: 24,
    },
    reasonsList: {
        marginBottom: 24,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: '#F9FAFB',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    selectedReasonItem: {
        backgroundColor: Colors.primary[50] + '30',
        borderColor: Colors.primary[500],
    },
    reasonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#4B5563',
    },
    selectedReasonText: {
        color: Colors.primary[600],
        fontWeight: '700',
    },
    otherInputWrapper: {
        marginTop: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
        marginLeft: 4,
    },
    otherInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        minHeight: 120,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    confirmButton: {
        backgroundColor: Colors.danger[500],
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: Colors.danger[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        backgroundColor: '#E5E7EB',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
});

export default CancelOrderScreen;
