import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeftIcon,
    ShieldCheckIcon,
    ArrowPathIcon,
    ClockIcon,
    DocumentTextIcon,
    ChatBubbleLeftRightIcon,
    TruckIcon,
    QuestionMarkCircleIcon,
    PlusIcon,
    InformationCircleIcon,
    SparklesIcon,
    TrashIcon,
    XMarkIcon
} from 'react-native-heroicons/outline';

interface FAQ {
    id?: string;
    question: string;
    answer: string;
}

interface ShopPolicies {
    accepts_returns: boolean;
    accepts_exchanges: boolean;
    accepts_cancellations: boolean;
    accepts_custom_returns: boolean;
    return_window_days: string;
    return_shipping_payer: 'buyer' | 'seller';
    processing_time: string;
    response_time: string;
    additional_terms: string;
    faqs: FAQ[];
}

export default function ShopPoliciesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [policies, setPolicies] = useState<ShopPolicies>({
        accepts_returns: true,
        accepts_exchanges: false,
        accepts_cancellations: true,
        accepts_custom_returns: false,
        return_window_days: '14',
        return_shipping_payer: 'buyer',
        processing_time: '1-3 days',
        response_time: 'Few hrs',
        additional_terms: '',
        faqs: []
    });

    // state for the FAQ Modal
    const [isFaqModalVisible, setIsFaqModalVisible] = useState(false);
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
    const [faqQuestion, setFaqQuestion] = useState('');
    const [faqAnswer, setFaqAnswer] = useState('');

    useEffect(() => {
        if (user) fetchPolicies();
    }, [user]);

    const fetchPolicies = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('shop_policies')
                .eq('id', user!.id)
                .single();

            if (data?.shop_policies) {
                setPolicies(data.shop_policies as ShopPolicies);
            }
        } catch (e) {
            console.error('Error fetching policies:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase
                .from('profiles')
                .update({ shop_policies: policies as any })
                .eq('id', user!.id);

            if (error) throw error;
            Alert.alert('Success', 'Shop policies updated.');
            router.back();
        } catch (e: any) {
            Alert.alert('Error', 'Failed to save policies.');
        } finally {
            setSaving(false);
        }
    };

    const togglePolicy = (key: keyof ShopPolicies) => {
        setPolicies(prev => ({ ...prev, [key]: !prev[key] as any }));
    };

    const handleSaveFaq = () => {
        if (!faqQuestion.trim() || !faqAnswer.trim()) {
            Alert.alert('Required', 'Please fill in both question and answer.');
            return;
        }

        setPolicies(prev => {
            const newFaqs = [...prev.faqs];
            if (editingFaqId) {
                // Update existing
                const index = newFaqs.findIndex(f => f.id === editingFaqId);
                if (index !== -1) {
                    newFaqs[index] = { ...newFaqs[index], question: faqQuestion, answer: faqAnswer };
                }
            } else {
                // Add new
                newFaqs.push({ id: Date.now().toString(), question: faqQuestion, answer: faqAnswer });
            }
            return { ...prev, faqs: newFaqs };
        });

        // Reset and Close
        closeFaqModal();
    };

    const deleteFaq = (id: string) => {
        Alert.alert(
            'Delete FAQ',
            'Are you sure you want to delete this FAQ?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => setPolicies(prev => ({ ...prev, faqs: prev.faqs.filter(f => f.id !== id) }))
                }
            ]
        );
    };

    const openFaqModal = (faq?: FAQ) => {
        if (faq) {
            setEditingFaqId(faq.id || null);
            setFaqQuestion(faq.question);
            setFaqAnswer(faq.answer);
        } else {
            setEditingFaqId(null);
            setFaqQuestion('');
            setFaqAnswer('');
        }
        setIsFaqModalVisible(true);
    };

    const closeFaqModal = () => {
        setIsFaqModalVisible(false);
        setEditingFaqId(null);
        setFaqQuestion('');
        setFaqAnswer('');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[500]} /></View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Shop Policies</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={Colors.primary[500]} /> : (
                        <Text style={styles.saveText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* RETURN & EXCHANGE SECTION */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>RETURNS & EXCHANGES</Text>
                    
                    <View style={styles.preferenceItem}>
                        <View style={styles.prefTextContainer}>
                            <Text style={styles.prefTitle}>Accept Returns</Text>
                            <Text style={styles.prefSubtitle}>Standard items can be returned</Text>
                        </View>
                        <Switch
                            value={policies.accepts_returns}
                            onValueChange={() => togglePolicy('accepts_returns')}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    <View style={styles.preferenceItem}>
                        <View style={styles.prefTextContainer}>
                            <Text style={styles.prefTitle}>Accept Exchanges</Text>
                            <Text style={styles.prefSubtitle}>Buyers can swap items for equal value</Text>
                        </View>
                        <Switch
                            value={policies.accepts_exchanges}
                            onValueChange={() => togglePolicy('accepts_exchanges')}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    {(policies.accepts_returns || policies.accepts_exchanges) && (
                        <>
                            <View style={styles.inputItem}>
                                <View style={styles.labelRow}>
                                    <ClockIcon size={18} color="#6B7280" />
                                    <Text style={styles.inputLabel}>Return Window (Days)</Text>
                                </View>
                                <View style={styles.presetsRow}>
                                    {['7', '14', '30', '90'].map((day) => (
                                        <TouchableOpacity
                                            key={day}
                                            style={[styles.presetBtn, policies.return_window_days === day && styles.presetBtnActive]}
                                            onPress={() => setPolicies(p => ({ ...p, return_window_days: day }))}
                                        >
                                            <Text style={[styles.presetText, policies.return_window_days === day && styles.presetTextActive]}>{day}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={[styles.inputItem, { borderBottomWidth: 0 }]}>
                                <View style={styles.labelRow}>
                                    <TruckIcon size={18} color="#6B7280" />
                                    <Text style={styles.inputLabel}>Return Shipping Policy</Text>
                                </View>
                                <View style={styles.presetsRow}>
                                    <TouchableOpacity
                                        style={[styles.presetBtn, policies.return_shipping_payer === 'buyer' && styles.presetBtnActive]}
                                        onPress={() => setPolicies(p => ({ ...p, return_shipping_payer: 'buyer' }))}
                                    >
                                        <Text style={[styles.presetText, policies.return_shipping_payer === 'buyer' && styles.presetTextActive]}>Buyer Pays</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.presetBtn, policies.return_shipping_payer === 'seller' && styles.presetBtnActive]}
                                        onPress={() => setPolicies(p => ({ ...p, return_shipping_payer: 'seller' }))}
                                    >
                                        <Text style={[styles.presetText, policies.return_shipping_payer === 'seller' && styles.presetTextActive]}>Seller Pays</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* DIGITAL & CUSTOM ITEMS SECTION */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>DIGITAL & CUSTOM ITEMS</Text>
                    <View style={[styles.preferenceItem, { borderBottomWidth: 0 }]}>
                        <View style={styles.prefTextContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SparklesIcon size={18} color={Colors.primary[600]} />
                                <Text style={styles.prefTitle}>Returns on Custom Work</Text>
                            </View>
                            <Text style={styles.prefSubtitle}>Includes personalized items and digital downloads</Text>
                        </View>
                        <Switch
                            value={policies.accepts_custom_returns}
                            onValueChange={() => togglePolicy('accepts_custom_returns')}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>
                    {!policies.accepts_custom_returns && (
                        <View style={styles.policyNotice}>
                            <InformationCircleIcon size={16} color="#6B7280" />
                            <Text style={styles.noticeText}>It's common to not accept returns for personalized or digital goods.</Text>
                        </View>
                    )}
                </View>

                {/* ORDER HANDLING SECTION */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>ORDER HANDLING</Text>
                    
                    <View style={styles.preferenceItem}>
                        <View style={styles.prefTextContainer}>
                            <Text style={styles.prefTitle}>Allow Cancellations</Text>
                            <Text style={styles.prefSubtitle}>Before the item is marked as shipped</Text>
                        </View>
                        <Switch
                            value={policies.accepts_cancellations}
                            onValueChange={() => togglePolicy('accepts_cancellations')}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    <View style={styles.inputItem}>
                        <View style={styles.labelRow}>
                            <ArrowPathIcon size={18} color="#6B7280" />
                            <Text style={styles.inputLabel}>Typical Processing Time</Text>
                        </View>
                        <View style={styles.presetsRow}>
                            {['1 day', '1-3 days', '4-7 days', '1 week'].map((time) => (
                                <TouchableOpacity
                                    key={time}
                                    style={[
                                        styles.presetBtn,
                                        policies.processing_time === time && styles.presetBtnActive
                                    ]}
                                    onPress={() => setPolicies(p => ({ ...p, processing_time: time }))}
                                >
                                    <Text style={[
                                        styles.presetText,
                                        policies.processing_time === time && styles.presetTextActive
                                    ]}>{time}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={[styles.inputItem, { borderBottomWidth: 0 }]}>
                        <View style={styles.labelRow}>
                            <ChatBubbleLeftRightIcon size={18} color="#6B7280" />
                            <Text style={styles.inputLabel}>Inquiry Response Time</Text>
                        </View>
                        <View style={styles.presetsRow}>
                            {['< 1 hr', 'Few hrs', '24 hrs', '48 hrs'].map((time) => (
                                <TouchableOpacity
                                    key={time}
                                    style={[
                                        styles.presetBtn,
                                        policies.response_time === time && styles.presetBtnActive
                                    ]}
                                    onPress={() => setPolicies(p => ({ ...p, response_time: time }))}
                                >
                                    <Text style={[
                                        styles.presetText,
                                        policies.response_time === time && styles.presetTextActive
                                    ]}>{time}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* FAQ SECTION */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>SHOP FAQ</Text>
                    {policies.faqs.length === 0 ? (
                        <View style={styles.emptyFaqState}>
                            <QuestionMarkCircleIcon size={40} color="#D1D5DB" />
                            <Text style={styles.emptyFaqText}>No FAQs yet</Text>
                            <Text style={styles.emptyFaqSubtext}>Add frequently asked questions to help your buyers</Text>
                        </View>
                    ) : (
                        policies.faqs.map((faq, index) => (
                            <View key={faq.id} style={[styles.faqItem, index === policies.faqs.length - 1 && { borderBottomWidth: 0 }]}>
                                <TouchableOpacity style={styles.faqHeader} onPress={() => openFaqModal(faq)}>
                                    <QuestionMarkCircleIcon size={18} color={Colors.primary[500]} />
                                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                                </TouchableOpacity>
                                <Text style={styles.faqAnswer}>{faq.answer}</Text>
                                <TouchableOpacity style={styles.deleteFaqBtn} onPress={() => deleteFaq(faq.id!)}>
                                    <TrashIcon size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                    <TouchableOpacity style={styles.addNewButton} onPress={() => openFaqModal()}>
                        <View style={styles.plusIconBg}><PlusIcon size={16} color="#FFF" /></View>
                        <Text style={styles.addNewText}>Add New FAQ</Text>
                    </TouchableOpacity>
                </View>

                {/* ADDITIONAL TERMS SECTION */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>ADDITIONAL TERMS</Text>
                    <View style={styles.textAreaContainer}>
                        <View style={styles.labelRow}>
                            <DocumentTextIcon size={18} color="#6B7280" />
                            <Text style={styles.inputLabel}>Custom Shop Rules</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={policies.additional_terms}
                            onChangeText={(text) => setPolicies(p => ({ ...p, additional_terms: text }))}
                            placeholder="Add specific cultural context or rules..."
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <ShieldCheckIcon size={20} color={Colors.primary[600]} />
                    <Text style={styles.infoText}>
                        Your policies are displayed on every item listing to help buyers shop with confidence.
                    </Text>
                </View>
            </ScrollView>

            {/* FAQ Modal - Bottom Sheet Style */}
            <Modal
                visible={isFaqModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeFaqModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={closeFaqModal}
                >
                    {/* Bottom sheet content */}
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.modalBottomSheet}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Drag handle */}
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingFaqId ? 'Edit FAQ' : 'New FAQ'}</Text>
                            <TouchableOpacity onPress={closeFaqModal}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalBody}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.inputGroup}>
                                <Text style={styles.modalLabel}>QUESTION</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Do you ship internationally?"
                                    value={faqQuestion}
                                    onChangeText={setFaqQuestion}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.modalLabel}>ANSWER</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalTextArea]}
                                    placeholder="Provide a clear answer..."
                                    value={faqAnswer}
                                    onChangeText={setFaqAnswer}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={closeFaqModal}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveFaqBtn}
                                    onPress={handleSaveFaq}
                                >
                                    <Text style={styles.saveFaqBtnText}>
                                        {editingFaqId ? 'Update FAQ' : 'Save FAQ'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
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
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    saveText: { fontSize: 16, fontWeight: '600', color: Colors.primary[600], paddingHorizontal: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingBottom: 40 },
    sectionContainer: {
        backgroundColor: '#FFF',
        marginTop: 24,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.neutral[500],
        marginBottom: 8,
        marginTop: 8,
        marginLeft: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    prefTextContainer: { flex: 1, marginRight: 16 },
    prefTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
    prefSubtitle: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
    inputItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    textAreaContainer: { padding: 16 },
    presetsRow: { flexDirection: 'row', gap: 10 },
    presetBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    presetBtnActive: { backgroundColor: Colors.primary[50], borderColor: Colors.primary[500] },
    presetText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    presetTextActive: { color: Colors.primary[700] },
    policyNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
    },
    noticeText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
    emptyFaqState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyFaqText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 12,
    },
    emptyFaqSubtext: {
        fontSize: 13,
        color: '#D1D5DB',
        marginTop: 4,
        textAlign: 'center',
    },
    faqItem: { 
        padding: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: '#F3F4F6', 
        position: 'relative' 
    },
    faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 32 },
    faqQuestion: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
    faqAnswer: { fontSize: 14, color: '#6B7280', marginTop: 6, marginLeft: 28, lineHeight: 22 },
    deleteFaqBtn: { position: 'absolute', top: 16, right: 12, padding: 4 },
    addNewButton: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    plusIconBg: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addNewText: { fontSize: 16, fontWeight: '600', color: Colors.primary[600] },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: Colors.primary[50],
        padding: 16,
        marginHorizontal: 16,
        marginTop: 24,
        borderRadius: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: Colors.primary[800],
        lineHeight: 20,
    },
    // Modal Styles - Bottom Sheet
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalBottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: 470, // Increased from 420 to fit buttons
        paddingBottom: 20, // Reduced from 40
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.neutral[300],
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    modalBody: {
        paddingHorizontal: 20,
        paddingTop: 20,
        maxHeight: 340, // Ensure scrolling works if content is tall
    },
    inputGroup: { marginBottom: 20 },
    modalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#111827',
    },
    modalTextArea: { minHeight: 120, textAlignVertical: 'top' },
    modalFooter: { flexDirection: 'row', gap: 12, marginTop: 10 },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelBtnText: { fontWeight: '700', color: '#4B5563', fontSize: 16 },
    saveFaqBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: Colors.primary[500],
        alignItems: 'center',
    },
    saveFaqBtnText: { fontWeight: '700', color: '#FFF', fontSize: 16 },
});