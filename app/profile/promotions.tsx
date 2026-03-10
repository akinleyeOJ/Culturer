import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Dimensions, Modal, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
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
    MagnifyingGlassIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const PromotionsScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [step, setStep] = useState(1); // 1: Type, 2: Select Items, 3: Configure
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [discountValue, setDiscountValue] = useState('10');
    const [flashDuration, setFlashDuration] = useState('24');
    const [couponCode, setCouponCode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [promoType, setPromoType] = useState<'sale' | 'flash' | 'coupon'>('sale');
    const [activePromotions, setActivePromotions] = useState<any[]>([]);
    const [activeCoupons, setActiveCoupons] = useState<any[]>([]);

    const fetchActivePromotions = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, images, discount_percentage, promotion_ends_at')
                .eq('seller_id', user.id)
                .gt('discount_percentage', 0);
            if (!error) setActivePromotions(data || []);
        } catch (e) {
            console.error('Error fetching active promotions:', e);
        }
    }, [user]);

    const fetchActiveCoupons = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('coupons' as any)
                .select('*')
                .eq('seller_id', user.id)
                .eq('is_active', true);
            if (!error) setActiveCoupons((data as any[]) || []);
        } catch (e) {
            console.error('Error fetching active coupons:', e);
        }
    }, [user]);

    useEffect(() => { fetchActivePromotions(); fetchActiveCoupons(); }, [user]);
    useFocusEffect(useCallback(() => { fetchActivePromotions(); fetchActiveCoupons(); }, [fetchActivePromotions, fetchActiveCoupons]));

    const fetchProducts = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('seller_id', user.id)
                .eq('status', 'active')
                .or('out_of_stock.is.null,out_of_stock.eq.false');

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching items:', error);
            Alert.alert('Error', 'Could not load your items.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateStart = (type: 'sale' | 'flash' | 'coupon') => {
        setPromoType(type);
        setStep(type === 'coupon' ? 2 : 1);
        setSelectedProducts([]);
        setSearchQuery('');
        setCouponCode('');
        setDiscountValue('');
        setIsCreateModalVisible(true);
        if (type !== 'coupon') fetchProducts();
    };

    const toggleProductSelection = (id: string) => {
        setSelectedProducts(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleApplyPromotion = async () => {
        if (promoType !== 'coupon' && selectedProducts.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one item.');
            return;
        }

        const discount = parseInt(discountValue || '0');
        if (discount <= 0 || discount > 100) {
            Alert.alert('Invalid Discount', 'Please enter a discount between 1 and 100.');
            return;
        }

        if (promoType === 'coupon' && !couponCode.trim()) {
            Alert.alert('Code Required', 'Please enter a coupon code name.');
            return;
        }

        if (promoType === 'flash') {
            const hours = parseInt(flashDuration || '0');
            if (hours < 1 || hours > 72) {
                Alert.alert('Invalid Duration', 'Flash sale duration must be between 1 and 72 hours.');
                return;
            }
        }

        setIsLoading(true);
        try {
            if (promoType === 'coupon') {
                // Insert coupon into coupons table
                const { error } = await supabase
                    .from('coupons' as any)
                    .insert({
                        code: couponCode.toUpperCase().trim(),
                        discount_type: 'percentage',
                        discount_value: discount,
                        seller_id: user!.id,
                        is_active: true,
                    } as any);

                if (error) throw error;
                await fetchActiveCoupons();

                Alert.alert(
                    'Coupon Created! 🎟️',
                    `Code "${couponCode.toUpperCase().trim()}" is now active for ${discount}% off.`,
                    [{ text: 'Great', onPress: () => setIsCreateModalVisible(false) }]
                );
            } else {
                // Sale or Flash — update product discount_percentage
                const updatePayload: any = { discount_percentage: discount };

                // Flash sales get an expiry timestamp
                if (promoType === 'flash') {
                    const hours = parseInt(flashDuration || '24');
                    const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
                    updatePayload.promotion_ends_at = endsAt;
                } else {
                    updatePayload.promotion_ends_at = null;
                }

                const { error } = await supabase
                    .from('products')
                    .update(updatePayload)
                    .in('id', selectedProducts);

                if (error) throw error;
                await fetchActivePromotions();

                Alert.alert(
                    'Promotion Live! 🎉',
                    `${discount}% off applied to ${selectedProducts.length} item${selectedProducts.length > 1 ? 's' : ''}.`,
                    [{ text: 'Great', onPress: () => setIsCreateModalVisible(false) }]
                );
            }

            setSelectedProducts([]);
            setCouponCode('');
            setStep(1);
        } catch (error: any) {
            console.error('Error applying promotion:', error);
            if (error?.code === '23505') {
                Alert.alert('Duplicate Code', 'A coupon with this code already exists.');
            } else {
                Alert.alert('Error', 'Failed to create promotion. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivateCoupon = (couponId: string, code: string) => {
        Alert.alert(
            'Deactivate Coupon',
            `Deactivate coupon "${code}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Deactivate',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('coupons' as any)
                                .update({ is_active: false } as any)
                                .eq('id', couponId);
                            if (error) throw error;
                            await fetchActiveCoupons();
                        } catch (e) {
                            Alert.alert('Error', 'Could not deactivate coupon.');
                        }
                    }
                }
            ]
        );
    };

    const handleEndPromotion = (productId: string, productName: string) => {
        Alert.alert(
            'End Promotion',
            `Remove the discount from "${productName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Promotion',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('products')
                                .update({ discount_percentage: 0, promotion_ends_at: null })
                                .eq('id', productId);
                            if (error) throw error;
                            await fetchActivePromotions();
                            await fetchProducts();
                        } catch (e) {
                            Alert.alert('Error', 'Could not end promotion.');
                        }
                    }
                }
            ]
        );
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
                                {step === 1 ? 'Select Items' : `Launch ${promoType === 'flash' ? 'Flash Sale' : promoType === 'sale' ? 'Sale' : 'Coupon'}`}
                            </Text>
                            {step === 2 && <Text style={styles.modalSubHeader}>{selectedProducts.length} items selected</Text>}
                        </View>
                        <TouchableOpacity onPress={() => setIsCreateModalVisible(false)} style={styles.modalCloseBtn}>
                            <XMarkIcon size={20} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {step === 1 ? (
                        <ScrollView style={styles.modalBody} bounces={false}>
                            <View style={styles.selectHeaderRow}>
                                <Text style={styles.modalSub}>Select which items to promote</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        const selectableIds = products
                                            .filter(p => {
                                                if (promoType === 'sale' || promoType === 'flash') {
                                                    return !(p.discount_percentage && p.discount_percentage > 0);
                                                }
                                                return true;
                                            })
                                            .map(p => p.id);
                                        if (selectedProducts.length === selectableIds.length) {
                                            setSelectedProducts([]);
                                        } else {
                                            setSelectedProducts(selectableIds);
                                        }
                                    }}
                                >
                                    <Text style={styles.selectAllText}>
                                        {selectedProducts.length === products.filter(p => {
                                            if (promoType === 'sale' || promoType === 'flash') {
                                                return !(p.discount_percentage && p.discount_percentage > 0);
                                            }
                                            return true;
                                        }).length ? 'Deselect All' : 'Select All'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

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
                                products.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => {
                                    const isInPromo = (promoType === 'sale' || promoType === 'flash') && !!(item.discount_percentage && item.discount_percentage > 0);
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
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
                                })
                            )}
                            {!isLoading && products.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                <Text style={styles.emptyListText}>No active items found.</Text>
                            )}
                            <TouchableOpacity
                                style={[styles.modalActionBtn, selectedProducts.length === 0 && styles.disabledBtn]}
                                onPress={() => setStep(2)}
                                disabled={selectedProducts.length === 0}
                            >
                                <Text style={styles.modalActionBtnText}>Next: Configure</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        <ScrollView style={styles.modalBody} bounces={false}>
                            {promoType === 'coupon' ? (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Coupon Code Name</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. SUMMER24"
                                        autoCapitalize="characters"
                                        value={couponCode}
                                        onChangeText={setCouponCode}
                                    />
                                </View>
                            ) : null}

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Discount Percentage (%)</Text>
                                <View style={styles.percentageInputRow}>
                                    <TextInput
                                        style={styles.textInput}
                                        value={discountValue}
                                        onChangeText={(text) => setDiscountValue(text.replace(/[^0-9]/g, ''))}
                                        keyboardType="numeric"
                                        placeholder="e.g. 15"
                                        maxLength={2}
                                    />
                                    <Text style={styles.inputSuffix}>%</Text>
                                </View>
                            </View>

                            {promoType === 'flash' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Flash Sale Duration (1-72 Hours)</Text>
                                    <View style={styles.percentageInputRow}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={flashDuration}
                                            onChangeText={(text) => setFlashDuration(text.replace(/[^0-9]/g, ''))}
                                            keyboardType="numeric"
                                            placeholder="24"
                                            maxLength={2}
                                        />
                                        <Text style={styles.inputSuffix}>hrs</Text>
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
                                {promoType !== 'coupon' && (
                                    <TouchableOpacity style={styles.modalBackBtn} onPress={() => setStep(1)}>
                                        <Text style={styles.modalBackBtnText}>Back</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.modalActionBtn}
                                    onPress={handleApplyPromotion}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.modalActionBtnText}>Launch</Text>
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
                        icon={TicketIcon}
                        title="Coupon Codes"
                        subtitle="Custom codes to share on social media"
                        color="#EC4899"
                        onPress={() => handleCreateStart('coupon')}
                    />

                    {/* Active Promotions */}
                    <Text style={styles.sectionTitle}>Active Promotions</Text>
                    {(activePromotions.length > 0 || activeCoupons.length > 0) ? (
                        <>
                            {activePromotions.map((item) => (
                                <View key={item.id} style={styles.activePromoItem}>
                                    <Image source={{ uri: item.images?.[0] }} style={styles.activePromoImage} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.productSelectName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.productSelectPrice}>
                                            €{(item.price * (1 - item.discount_percentage / 100)).toFixed(2)}{' '}
                                            <Text style={{ textDecorationLine: 'line-through', color: '#9CA3AF' }}>€{item.price}</Text>
                                        </Text>
                                        <View style={styles.promoBadge}>
                                            <Text style={styles.promoBadgeText}>{item.discount_percentage}% OFF</Text>
                                        </View>
                                        {item.promotion_ends_at && (() => {
                                            const remaining = new Date(item.promotion_ends_at).getTime() - Date.now();
                                            if (remaining <= 0) return <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>⚡ Expired</Text>;
                                            const hours = Math.floor(remaining / (1000 * 60 * 60));
                                            const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                                            return <Text style={{ fontSize: 11, color: '#F97316', marginTop: 2 }}>⚡ Ends in {hours}h {mins}m</Text>;
                                        })()}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.endPromoBtn}
                                        onPress={() => handleEndPromotion(item.id, item.name)}
                                    >
                                        <Text style={styles.endPromoBtnText}>End</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {activeCoupons.map((coupon: any) => (
                                <View key={coupon.id} style={styles.activePromoItem}>
                                    <View style={styles.couponIconBox}>
                                        <TicketIcon size={22} color="#EC4899" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.productSelectName}>{coupon.code}</Text>
                                        <View style={[styles.promoBadge, { backgroundColor: '#FCE7F3' }]}>
                                            <Text style={[styles.promoBadgeText, { color: '#BE185D' }]}>{coupon.discount_value}% OFF COUPON</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.endPromoBtn}
                                        onPress={() => handleDeactivateCoupon(coupon.id, coupon.code)}
                                    >
                                        <Text style={styles.endPromoBtnText}>End</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </>
                    ) : (
                        <EmptyState />
                    )}

                    {/* Tips Section */}
                    <View style={styles.tipCard}>
                        <InformationCircleIcon size={20} color={Colors.neutral[500]} />
                        <View style={styles.tipContent}>
                            <Text style={styles.tipTitle}>Pro Tip</Text>
                            <Text style={styles.tipText}>
                                Share coupon codes on social media to drive traffic and boost sales.
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
        maxHeight: '85%',
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
        flex: 3,
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
        flex: 2,
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
    selectHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    selectAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[600],
    },
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
    // Active Promotion Styles
    activePromoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginBottom: 8,
    },
    activePromoImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    couponIconBox: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#FDF2F8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    endPromoBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
    },
    endPromoBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#DC2626',
    },
});

export default PromotionsScreen;
