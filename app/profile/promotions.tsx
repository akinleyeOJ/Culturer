import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Dimensions, Modal, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    PlusIcon,
    ReceiptPercentIcon,
    TicketIcon,
    InformationCircleIcon,
    ChevronRightIcon,
    ChartBarIcon,
    CalendarIcon,
    TagIcon,
    SparklesIcon,
    CheckIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    GiftIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const PromotionsScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'ended'>('active');
    const [isLoading, setIsLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [step, setStep] = useState(1); // 1: Type, 2: Select Items, 3: Configure
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [discountValue, setDiscountValue] = useState('10');
    const [flashDuration, setFlashDuration] = useState('24');
    const [bundleMinQty, setBundleMinQty] = useState('2');
    const [searchQuery, setSearchQuery] = useState('');
    const [promoType, setPromoType] = useState<'sale' | 'flash' | 'coupon' | 'bundle'>('sale');

    const fetchProducts = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('seller_id', user.id)
                .eq('status', 'active');

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching items:', error);
            Alert.alert('Error', 'Could not load your items.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateStart = (type: 'sale' | 'flash' | 'coupon' | 'bundle') => {
        setPromoType(type);
        setStep(1);
        setSelectedProducts([]);
        setSearchQuery('');
        setIsCreateModalVisible(true);
        fetchProducts();
    };

    const toggleProductSelection = (id: string) => {
        setSelectedProducts(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleApplyPromotion = async () => {
        if (selectedProducts.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one item.');
            return;
        }

        setIsLoading(true);
        try {
            // In a real app, we'd create a record in a 'promotions' table
            // and update the 'products' table with discounted prices.
            // For MVP, we'll simulate success.

            Alert.alert(
                'Success!',
                `Your ${promoType} has been created for ${selectedProducts.length} items.`,
                [{ text: 'Great', onPress: () => setIsCreateModalVisible(false) }]
            );

            setSelectedProducts([]);
            setStep(1);
        } catch (error) {
            Alert.alert('Error', 'Failed to create promotion.');
        } finally {
            setIsLoading(false);
        }
    };

    const PromoCategory = ({ icon: Icon, title, subtitle, color, onPress }: any) => (
        <TouchableOpacity style={styles.categoryCard} onPress={onPress}>
            <View style={[styles.categoryIconBox, { backgroundColor: color + '10' }]}>
                <Icon size={24} color={color} />
            </View>
            <View style={styles.categoryContent}>
                <Text style={styles.categoryTitle}>{title}</Text>
                <Text style={styles.categorySub}>{subtitle}</Text>
            </View>
            <PlusIcon size={20} color={Colors.neutral[400]} />
        </TouchableOpacity>
    );

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
                <ReceiptPercentIcon size={48} color={Colors.neutral[300]} />
            </View>
            <Text style={styles.emptyTitle}>No active promotions</Text>
            <Text style={styles.emptyText}>
                Boost your sales by creating discounts, coupons, or featured listing boosts.
            </Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => handleCreateStart('sale')}>
                <Text style={styles.createBtnText}>Start Marketing</Text>
            </TouchableOpacity>
        </View>
    );

    const renderCreateModal = () => (
        <Modal
            visible={isCreateModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setIsCreateModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, step === 2 && { height: 'auto', paddingBottom: 60 }]}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>
                                {step === 1 ? 'Select Items' : `Launch ${promoType === 'flash' ? 'Flash Sale' : promoType === 'bundle' ? 'Bundle Deal' : promoType === 'sale' ? 'Sale' : 'Coupon'}`}
                            </Text>
                            {step === 2 && <Text style={styles.modalSubHeader}>{selectedProducts.length} items selected</Text>}
                        </View>
                        <TouchableOpacity onPress={() => setIsCreateModalVisible(false)} style={styles.modalCloseBtn}>
                            <XMarkIcon size={20} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {step === 1 ? (
                        <View style={styles.modalBody}>
                            <Text style={styles.modalSub}>Select which items to promote</Text>

                            {/* Search Bar */}
                            <View style={styles.searchBarContainer}>
                                <MagnifyingGlassIcon size={20} color={Colors.neutral[400]} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search your items..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor={Colors.neutral[400]}
                                />
                                {searchQuery !== '' && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <XMarkIcon size={20} color={Colors.neutral[400]} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {isLoading ? (
                                <View style={{ height: 200, justifyContent: 'center' }}>
                                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                                </View>
                            ) : (
                                <FlatList
                                    data={products.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                                    keyExtractor={(item) => item.id}
                                    style={{ maxHeight: 400 }}
                                    renderItem={({ item }) => {
                                        const isInPromo = item.discount_percentage && item.discount_percentage > 0;
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.productSelectItem,
                                                    selectedProducts.includes(item.id) && styles.productSelected,
                                                    isInPromo && styles.productDisabled
                                                ]}
                                                onPress={() => !isInPromo && toggleProductSelection(item.id)}
                                                disabled={isInPromo}
                                            >
                                                <Image source={{ uri: item.images?.[0] }} style={[styles.productMiniImage, isInPromo && { opacity: 0.5 }]} />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={[styles.productSelectName, isInPromo && { color: '#9CA3AF' }]} numberOfLines={1}>{item.name}</Text>
                                                    <Text style={styles.productSelectPrice}>€{item.price}</Text>
                                                    {isInPromo && (
                                                        <View style={styles.promoBadge}>
                                                            <Text style={styles.promoBadgeText}>Already in promotion</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {!isInPromo && (
                                                    <View style={[
                                                        styles.checkbox,
                                                        selectedProducts.includes(item.id) && styles.checkboxActive
                                                    ]}>
                                                        {selectedProducts.includes(item.id) && <CheckIcon size={14} color="#FFF" />}
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyListText}>No active items found.</Text>
                                    }
                                />
                            )}
                            <TouchableOpacity
                                style={[styles.modalActionBtn, selectedProducts.length === 0 && styles.disabledBtn]}
                                onPress={() => setStep(2)}
                                disabled={selectedProducts.length === 0}
                            >
                                <Text style={styles.modalActionBtnText}>Next: Configure</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView style={styles.modalBody} bounces={false}>
                            {promoType === 'coupon' ? (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Coupon Code Name</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. SUMMER24"
                                        autoCapitalize="characters"
                                    />
                                </View>
                            ) : null}

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Discount Percentage (%)</Text>
                                <View style={styles.percentageInputRow}>
                                    <TextInput
                                        style={styles.textInput}
                                        value={discountValue}
                                        onChangeText={setDiscountValue}
                                        keyboardType="numeric"
                                        placeholder="e.g. 15"
                                    />
                                    <Text style={styles.inputSuffix}>%</Text>
                                </View>
                            </View>

                            {promoType === 'flash' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Flash Sale Duration (Hours)</Text>
                                    <View style={styles.percentageInputRow}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={flashDuration}
                                            onChangeText={setFlashDuration}
                                            keyboardType="numeric"
                                            placeholder="24"
                                        />
                                        <Text style={styles.inputSuffix}>hrs</Text>
                                    </View>
                                </View>
                            )}

                            {promoType === 'bundle' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Minimum Items to Buy</Text>
                                    <View style={styles.percentageInputRow}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={bundleMinQty}
                                            onChangeText={setBundleMinQty}
                                            keyboardType="numeric"
                                            placeholder="2"
                                        />
                                        <Text style={styles.inputSuffix}>items</Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.previewBox}>
                                <Text style={styles.previewTitle}>Example Price Impact:</Text>
                                <Text style={styles.previewText}>
                                    €100.00 → <Text style={styles.salePrice}>€{(100 * (1 - parseInt(discountValue || '0') / 100)).toFixed(2)}</Text>
                                </Text>
                            </View>

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity style={styles.modalBackBtn} onPress={() => setStep(1)}>
                                    <Text style={styles.modalBackBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalActionBtn}
                                    onPress={handleApplyPromotion}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.modalActionBtnText}>Launch {promoType === 'flash' ? 'Flash Sale' : promoType === 'bundle' ? 'Bundle Deal' : 'Promotion'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );

    return (
        <>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Promotions Hub</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Marketing Insights Card */}
                    <View style={styles.insightsCard}>
                        <View style={styles.insightsHeader}>
                            <SparklesIcon size={20} color={Colors.primary[600]} />
                            <Text style={styles.insightsTitle}>Marketing Powerup</Text>
                        </View>
                        <Text style={styles.insightsText}>
                            Items with promotions see more engagements and sales from buyers looking for cultural treasures.
                        </Text>
                    </View>

                    {/* Categories */}
                    <Text style={styles.sectionTitle}>Marketing Tools</Text>
                    <PromoCategory
                        icon={ReceiptPercentIcon}
                        title="Sale Events"
                        subtitle="Apply percentage discounts to your items"
                        color={Colors.primary[600]}
                        onPress={() => handleCreateStart('sale')}
                    />
                    <PromoCategory
                        icon={CalendarIcon}
                        title="Flash Sales"
                        subtitle="Limited-time price drops with countdowns"
                        color="#F97316"
                        onPress={() => handleCreateStart('flash')}
                    />
                    <PromoCategory
                        icon={GiftIcon}
                        title="Bundle Deals"
                        subtitle="Buy more, save more discounts"
                        color="#8B5CF6"
                        onPress={() => handleCreateStart('bundle')}
                    />
                    <PromoCategory
                        icon={TicketIcon}
                        title="Coupon Codes"
                        subtitle="Custom codes to share on social media"
                        color="#EC4899"
                        onPress={() => handleCreateStart('coupon')}
                    />

                    {/* Tabs for active promos */}
                    <View style={styles.tabSection}>
                        <Text style={styles.sectionTitle}>Manage Promotions</Text>
                        <View style={styles.tabBar}>
                            {(['active', 'scheduled', 'ended'] as const).map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[styles.tab, activeTab === tab && styles.activeTab]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Active Content */}
                    <EmptyState />

                    {/* Tips Section */}
                    <View style={styles.tipCard}>
                        <InformationCircleIcon size={20} color={Colors.neutral[500]} />
                        <View style={styles.tipContent}>
                            <Text style={styles.tipTitle}>Bundle Suggestion</Text>
                            <Text style={styles.tipText}>
                                Try "Buy 2, Get 10% Off" to increase your average order value.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
            {renderCreateModal()}
        </>
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
    insightsCard: {
        backgroundColor: Colors.primary[50],
        padding: 10,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    insightsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    insightsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[700],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    insightsText: {
        fontSize: 13,
        color: Colors.primary[900],
        lineHeight: 18,
    },
    boldText: {
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 8,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    categoryIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryContent: {
        flex: 1,
        marginLeft: 14,
    },
    categoryTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    categorySub: {
        fontSize: 12,
        color: '#6B7280',
    },
    tabSection: {
        marginTop: 16,
        marginBottom: 16,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        padding: 4,
        borderRadius: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#111827',
    },
    emptyContainer: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderStyle: 'dashed',
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    createBtn: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    tipCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginTop: 24,
        gap: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 2,
    },
    tipText: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 18,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalSubHeader: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 20,
    },
    modalSub: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    productSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginBottom: 8,
    },
    productSelected: {
        borderColor: Colors.primary[500],
        backgroundColor: Colors.primary[50],
    },
    productMiniImage: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    productSelectName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    productSelectPrice: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    emptyListText: {
        textAlign: 'center',
        color: '#9CA3AF',
        padding: 20,
    },
    modalActionBtn: {
        backgroundColor: Colors.primary[500],
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    modalActionBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    disabledBtn: {
        backgroundColor: '#E5E7EB',
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    percentageInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 16,
    },
    textInput: {
        flex: 1,
        height: 52,
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    inputSuffix: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6B7280',
        marginLeft: 8,
    },
    previewBox: {
        backgroundColor: '#F3F4F6',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    previewTitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    previewText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    salePrice: {
        color: Colors.primary[600],
        fontWeight: '800',
    },
    modalBtnRow: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBackBtn: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    modalBackBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    // Search Bar Styles
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        marginLeft: 8,
        fontSize: 14,
        color: '#111827',
    },
    // Promotion Guard Styles
    productDisabled: {
        opacity: 0.6,
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
    },
    promoBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    promoBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#92400E',
    },
});

export default PromotionsScreen;
