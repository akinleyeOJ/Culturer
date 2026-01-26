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
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, CheckCircleIcon } from 'react-native-heroicons/outline';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/color';

const ISSUE_TYPES = [
    'Missing item',
    'Item not as described',
    'Damaged item',
    'Did not receive order',
    'Payment issue',
    'Return/Refund request',
    'Other'
];

const OrderIssueScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [selectedIssue, setSelectedIssue] = useState<string>('');
    const [details, setDetails] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!selectedIssue) {
            Alert.alert('Selection Required', 'Please select the type of issue you are having.');
            return;
        }

        if (details.trim().length < 10) {
            Alert.alert('More Information', 'Please provide a bit more detail about your issue (at least 10 characters).');
            return;
        }

        setLoading(true);
        try {
            // Create a support ticket / message in the database
            // For now, we'll log it or send a notification to system
            const { error } = await supabase.from('notifications' as any).insert({
                user_id: 'system', // or a dedicated support ID
                type: 'system',
                title: `Order Issue: #${id?.slice(0, 8).toUpperCase()}`,
                body: `User ${user?.email} reported: ${selectedIssue}. Details: ${details}`,
                data: { orderId: id, issueType: selectedIssue, userEmail: user?.email }
            });

            if (error) throw error;

            setSubmitted(true);
        } catch (error) {
            console.error('Error submitting issue:', error);
            Alert.alert('Submission Failed', 'Something went wrong. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.successContainer}>
                    <View style={styles.successIconWrapper}>
                        <CheckCircleIcon size={80} color={Colors.success[500]} />
                    </View>
                    <Text style={styles.successTitle}>Report Submitted</Text>
                    <Text style={styles.successSubtitle}>
                        We've received your request regarding order #{id?.slice(0, 8).toUpperCase()}.
                        Our support team will review this and get back to you within 24-48 hours.
                    </Text>
                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order Help</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.title}>How can we help?</Text>
                    <Text style={styles.subtitle}>Select the issue you're experiencing with your order.</Text>

                    <View style={styles.issueSection}>
                        <Text style={styles.inputLabel}>Issue Type</Text>
                        <View style={styles.issueTypeContainer}>
                            {ISSUE_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.issueTypeChip,
                                        selectedIssue === type && styles.activeIssueTypeChip
                                    ]}
                                    onPress={() => setSelectedIssue(type)}
                                >
                                    <Text style={[
                                        styles.issueTypeText,
                                        selectedIssue === type && styles.activeIssueTypeText
                                    ]}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.detailsSection}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={styles.detailsInput}
                            placeholder="Tell us exactly what happened..."
                            value={details}
                            onChangeText={setDetails}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoText}>
                            💡 Pro Tip: Contacting the seller directly is often the fastest way to resolve shipping or item issues.
                        </Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.submitButton, (!selectedIssue || details.length < 10) && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={loading || !selectedIssue || details.length < 10}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Report</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        lineHeight: 22,
        marginBottom: 32,
    },
    issueSection: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 12,
    },
    issueTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    issueTypeChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activeIssueTypeChip: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    issueTypeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
    },
    activeIssueTypeText: {
        color: '#FFF',
    },
    detailsSection: {
        marginBottom: 24,
    },
    detailsInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        minHeight: 150,
    },
    infoCard: {
        backgroundColor: Colors.primary[50] + '40',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    infoText: {
        fontSize: 14,
        color: Colors.primary[700],
        fontWeight: '500',
        lineHeight: 20,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    submitButton: {
        backgroundColor: Colors.primary[500],
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#E5E7EB',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    successIconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.success[500] + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 12,
    },
    successSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    doneButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 14,
    },
    doneButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
});

export default OrderIssueScreen;
