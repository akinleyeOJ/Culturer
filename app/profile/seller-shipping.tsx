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
    TruckIcon,
    ClockIcon,
    MapPinIcon,
    ChevronRightIcon,
    CheckCircleIcon as CheckCircleSolidIcon,
    CurrencyDollarIcon,
    InformationCircleIcon
} from 'react-native-heroicons/outline';

interface ShopShipping {
    processing_time: string;
    local_pickup: boolean;
    pickup_location: string;
    standard_shipping_price: number;
    express_shipping_enabled: boolean;
    express_shipping_price: number;
    shipping_origin: string;
}

const PROCESSING_TIMES = [
    '1 business day',
    '1-2 business days',
    '3-5 business days',
    '1-2 weeks',
    '2-4 weeks'
];

export default function SellerShippingScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [showProcessingModal, setShowProcessingModal] = useState(false);

    const [shipping, setShipping] = useState<ShopShipping>({
        processing_time: '3-5 business days',
        local_pickup: false,
        pickup_location: '',
        standard_shipping_price: 0,
        express_shipping_enabled: false,
        express_shipping_price: 15,
        shipping_origin: ''
    });

    useEffect(() => {
        if (user) fetchShippingSettings();
    }, [user]);

    const fetchShippingSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('shop_shipping, location')
                .eq('id', user!.id)
                .single();

            if (data) {
                if (data.shop_shipping) {
                    setShipping((data.shop_shipping as unknown) as ShopShipping);
                } else if (data.location) {
                    // Default origin if nothing set
                    setShipping(prev => ({ ...prev, shipping_origin: data.location || '' }));
                }
            }
        } catch (e) {
            console.error('Error fetching shipping settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (updatedSettings = shipping) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ shop_shipping: updatedSettings as any })
                .eq('id', user.id);

            if (error) throw error;
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const updateField = (field: keyof ShopShipping, value: any) => {
        const newSettings = { ...shipping, [field]: value };
        setShipping(newSettings);
        handleSave(newSettings);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
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
                <Text style={styles.headerTitle}>Shipping & Pickup</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.infoBox}>
                    <InformationCircleIcon size={20} color={Colors.primary[600]} />
                    <Text style={styles.infoText}>
                        Set your default shipping preferences. These will be applied to all your listings unless specified otherwise.
                    </Text>
                </View>

                {/* Processing Time */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DELIVERY ESTIMATES</Text>
                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={() => setShowProcessingModal(true)}
                    >
                        <View style={styles.settingIconBox}>
                            <ClockIcon size={22} color={Colors.text.primary} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Processing Time</Text>
                            <Text style={styles.settingValue}>{shipping.processing_time}</Text>
                        </View>
                        <ChevronRightIcon size={20} color={Colors.neutral[400]} />
                    </TouchableOpacity>

                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <MapPinIcon size={22} color={Colors.text.primary} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Shipping Origin</Text>
                            <TextInput
                                style={styles.textInput}
                                value={shipping.shipping_origin}
                                onChangeText={(text) => setShipping(prev => ({ ...prev, shipping_origin: text }))}
                                onBlur={() => handleSave()}
                                placeholder="City, Country"
                            />
                        </View>
                    </View>
                </View>

                {/* Shipping Rates */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SHIPPING RATES</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <TruckIcon size={22} color={Colors.text.primary} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Standard Shipping</Text>
                            <View style={styles.priceInputRow}>
                                <Text style={styles.currencyPrefix}>$</Text>
                                <TextInput
                                    style={styles.priceInput}
                                    value={shipping.standard_shipping_price.toString()}
                                    onChangeText={(val) => setShipping(prev => ({ ...prev, standard_shipping_price: parseFloat(val) || 0 }))}
                                    onBlur={() => handleSave()}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        </View>
                        {shipping.standard_shipping_price === 0 && (
                            <View style={styles.freeBadge}>
                                <Text style={styles.freeBadgeText}>FREE</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <TruckIcon size={22} color={Colors.primary[500]} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Express Shipping</Text>
                            <Text style={styles.settingSubtitle}>Offer faster delivery for a fee</Text>
                        </View>
                        <Switch
                            value={shipping.express_shipping_enabled}
                            onValueChange={(val) => updateField('express_shipping_enabled', val)}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    {shipping.express_shipping_enabled && (
                        <View style={[styles.settingItem, styles.nestedItem]}>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>Express Fee</Text>
                                <View style={styles.priceInputRow}>
                                    <Text style={styles.currencyPrefix}>$</Text>
                                    <TextInput
                                        style={styles.priceInput}
                                        value={shipping.express_shipping_price.toString()}
                                        onChangeText={(val) => setShipping(prev => ({ ...prev, express_shipping_price: parseFloat(val) || 0 }))}
                                        onBlur={() => handleSave()}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Local Pickup */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>LOCAL PICKUP</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <MapPinIcon size={22} color={Colors.primary[600]} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Allow Local Pickup</Text>
                            <Text style={styles.settingSubtitle}>Let buyers collect items in person</Text>
                        </View>
                        <Switch
                            value={shipping.local_pickup}
                            onValueChange={(val) => updateField('local_pickup', val)}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    {shipping.local_pickup && (
                        <View style={[styles.settingItem, styles.nestedItem]}>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>Pickup Location Info</Text>
                                <Text style={styles.settingSubtitle}>General area (e.g. Berlin Mitte)</Text>
                                <TextInput
                                    style={[styles.textInput, { marginTop: 8 }]}
                                    value={shipping.pickup_location}
                                    onChangeText={(text) => setShipping(prev => ({ ...prev, pickup_location: text }))}
                                    onBlur={() => handleSave()}
                                    placeholder="Enter general area for pickup"
                                />
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Processing Time Modal */}
            <Modal
                visible={showProcessingModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProcessingModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProcessingModal(false)}
                >
                    <View style={styles.bottomSheet}>
                        <Text style={styles.bottomSheetTitle}>Processing Time</Text>
                        <Text style={styles.bottomSheetSubtitle}>How long does it take you to ship an order?</Text>

                        {PROCESSING_TIMES.map((time) => (
                            <TouchableOpacity
                                key={time}
                                style={styles.sheetItem}
                                onPress={() => {
                                    updateField('processing_time', time);
                                    setShowProcessingModal(false);
                                }}
                            >
                                <Text style={[
                                    styles.sheetItemText,
                                    shipping.processing_time === time && styles.sheetItemTextActive
                                ]}>
                                    {time}
                                </Text>
                                {shipping.processing_time === time && (
                                    <CheckCircleSolidIcon size={24} color={Colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setShowProcessingModal(false)}
                        >
                            <Text style={styles.closeBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal components ... */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    center: {
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
        paddingBottom: 40,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: Colors.primary[50],
        padding: 16,
        margin: 16,
        borderRadius: 12,
        gap: 12,
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: Colors.primary[700],
        lineHeight: 18,
    },
    section: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        paddingHorizontal: 20,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    nestedItem: {
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 0,
        paddingLeft: 40,
    },
    settingIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    settingSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    settingValue: {
        fontSize: 14,
        color: Colors.primary[600],
        fontWeight: '600',
        marginTop: 2,
    },
    textInput: {
        fontSize: 14,
        color: '#111827',
        marginTop: 4,
        padding: 0,
    },
    priceInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    currencyPrefix: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginRight: 4,
    },
    priceInput: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        padding: 0,
    },
    freeBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    freeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#166534',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    bottomSheetTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    bottomSheetSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    sheetItemText: {
        fontSize: 16,
        color: '#4B5563',
        fontWeight: '500',
    },
    sheetItemTextActive: {
        color: Colors.primary[500],
        fontWeight: '700',
    },
    closeBtn: {
        marginTop: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    closeBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9CA3AF',
    },
});
