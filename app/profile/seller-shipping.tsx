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
    FlatList,
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
    PlusIcon,
    GlobeAltIcon,
    InformationCircleIcon,
    XMarkIcon,
} from 'react-native-heroicons/outline';

// ─── Country → Carrier Mapping ───────────────────────────
const COUNTRY_CARRIERS: Record<string, { name: string; type: 'home' | 'locker' | 'pickup' }[]> = {
    'Poland': [
        { name: 'InPost Locker 24/7', type: 'locker' },
        { name: 'InPost Home Delivery', type: 'home' },
        { name: 'DHL', type: 'home' },
        { name: 'DPD', type: 'home' },
        { name: 'Poczta Polska', type: 'home' },
    ],
    'United Kingdom': [
        { name: 'Royal Mail', type: 'home' },
        { name: 'Evri (Hermes)', type: 'home' },
        { name: 'DPD', type: 'home' },
        { name: 'UPS', type: 'home' },
        { name: 'DHL', type: 'home' },
    ],
    'Germany': [
        { name: 'DHL', type: 'home' },
        { name: 'Hermes', type: 'home' },
        { name: 'DPD', type: 'home' },
        { name: 'GLS', type: 'home' },
        { name: 'UPS', type: 'home' },
    ],
    'Italy': [
        { name: 'Poste Italiane', type: 'home' },
        { name: 'BRT (Bartolini)', type: 'home' },
        { name: 'DHL', type: 'home' },
        { name: 'GLS', type: 'home' },
        { name: 'UPS', type: 'home' },
    ],
    'France': [
        { name: 'Colissimo', type: 'home' },
        { name: 'Mondial Relay', type: 'locker' },
        { name: 'Chronopost', type: 'home' },
        { name: 'DHL', type: 'home' },
        { name: 'DPD', type: 'home' },
    ],
    'Spain': [
        { name: 'Correos', type: 'home' },
        { name: 'SEUR', type: 'home' },
        { name: 'DHL', type: 'home' },
        { name: 'GLS', type: 'home' },
        { name: 'MRW', type: 'home' },
    ],
    'Netherlands': [
        { name: 'PostNL', type: 'home' },
        { name: 'DHL', type: 'home' },
        { name: 'DPD', type: 'home' },
        { name: 'UPS', type: 'home' },
        { name: 'GLS', type: 'home' },
    ],
};

const AVAILABLE_COUNTRIES = [
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'United Kingdom', flag: '🇬🇧' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Greece', flag: '🇬🇷' },
].sort((a, b) => a.name.localeCompare(b.name));

// ─── Types ───
interface CarrierConfig {
    name: string;
    type: 'home' | 'locker' | 'pickup';
    enabled: boolean;
    price_small: number;
    price_medium: number;
    price_large: number;
}

interface ShopShipping {
    processing_time: string;
    origin_country: string;
    local_pickup: boolean;
    pickup_location: string;
    carriers: CarrierConfig[];
    shipping_zones: ('domestic' | 'eu' | 'worldwide')[];
}

const PROCESSING_TIMES = [
    '1 business day',
    '1-2 business days',
    '3-5 business days',
    '1-2 weeks',
    '2-4 weeks',
];

const ZONE_OPTIONS: { key: 'domestic' | 'eu' | 'worldwide'; label: string; desc: string }[] = [
    { key: 'domestic', label: 'Domestic', desc: 'Ship within your country' },
    { key: 'eu', label: 'European Union', desc: 'Ship to EU countries (no customs)' },
    { key: 'worldwide', label: 'Worldwide', desc: 'Ship globally (customs may apply)' },
];

const DEFAULT_SHIPPING: ShopShipping = {
    processing_time: '3-5 business days',
    origin_country: '',
    local_pickup: false,
    pickup_location: '',
    carriers: [],
    shipping_zones: ['domestic'],
};

export default function SellerShippingScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [showAddCarrierModal, setShowAddCarrierModal] = useState(false);
    const [customCarrierName, setCustomCarrierName] = useState('');

    const [shipping, setShipping] = useState<ShopShipping>(DEFAULT_SHIPPING);

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
                    const saved = (data.shop_shipping as unknown) as ShopShipping;
                    // Merge with defaults for backward compatibility
                    setShipping({
                        ...DEFAULT_SHIPPING,
                        ...saved,
                        carriers: saved.carriers || [],
                        shipping_zones: saved.shipping_zones || ['domestic'],
                    });
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

    // ─── Country Selection ───
    const handleCountrySelect = (countryName: string) => {
        // Get suggested carriers for this country
        const suggested = COUNTRY_CARRIERS[countryName] || [];
        const carrierConfigs: CarrierConfig[] = suggested.map(c => ({
            name: c.name,
            type: c.type,
            enabled: false,
            price_small: 0,
            price_medium: 0,
            price_large: 0,
        }));

        // Keep any existing custom carriers
        const existingCustom = shipping.carriers.filter(
            c => !suggested.some(s => s.name === c.name)
        );

        const newSettings = {
            ...shipping,
            origin_country: countryName,
            carriers: [...carrierConfigs, ...existingCustom],
        };
        setShipping(newSettings);
        handleSave(newSettings);
        setShowCountryModal(false);
    };

    // ─── Carrier Toggle ───
    const toggleCarrier = (index: number) => {
        const newCarriers = [...shipping.carriers];
        newCarriers[index] = { ...newCarriers[index], enabled: !newCarriers[index].enabled };
        const newSettings = { ...shipping, carriers: newCarriers };
        setShipping(newSettings);
        handleSave(newSettings);
    };

    // ─── Update Carrier Price ───
    const updateCarrierPrice = (index: number, tier: 'price_small' | 'price_medium' | 'price_large', value: string) => {
        const newCarriers = [...shipping.carriers];
        newCarriers[index] = { ...newCarriers[index], [tier]: parseFloat(value) || 0 };
        setShipping({ ...shipping, carriers: newCarriers });
    };

    const saveCarrierPrice = () => {
        handleSave(shipping);
    };

    // ─── Add Custom Carrier ───
    const addCustomCarrier = () => {
        if (!customCarrierName.trim()) return;
        const newCarrier: CarrierConfig = {
            name: customCarrierName.trim(),
            type: 'home',
            enabled: true,
            price_small: 0,
            price_medium: 0,
            price_large: 0,
        };
        const newSettings = {
            ...shipping,
            carriers: [...shipping.carriers, newCarrier],
        };
        setShipping(newSettings);
        handleSave(newSettings);
        setCustomCarrierName('');
        setShowAddCarrierModal(false);
    };

    // ─── Remove Custom Carrier ───
    const removeCarrier = (index: number) => {
        Alert.alert('Remove Carrier', `Remove "${shipping.carriers[index].name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: () => {
                    const newCarriers = shipping.carriers.filter((_, i) => i !== index);
                    const newSettings = { ...shipping, carriers: newCarriers };
                    setShipping(newSettings);
                    handleSave(newSettings);
                }
            },
        ]);
    };

    // ─── Zone Toggle ───
    const toggleZone = (zone: 'domestic' | 'eu' | 'worldwide') => {
        let newZones = [...shipping.shipping_zones];
        if (newZones.includes(zone)) {
            // Don't allow removing domestic
            if (zone === 'domestic') return;
            newZones = newZones.filter(z => z !== zone);
        } else {
            newZones.push(zone);
        }
        updateField('shipping_zones', newZones);
    };

    const getCarrierIcon = (type: string) => {
        switch (type) {
            case 'locker': return '📦';
            case 'pickup': return '🏪';
            default: return '🚚';
        }
    };

    const getCountryFlag = (name: string) => {
        return AVAILABLE_COUNTRIES.find(c => c.name === name)?.flag || '🌍';
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
                <Text style={styles.headerTitle}>Shipping & Postage</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.infoBox}>
                    <InformationCircleIcon size={20} color={Colors.primary[600]} />
                    <Text style={styles.infoText}>
                        Configure your shipping carriers and rates. These options will appear to buyers at checkout.
                    </Text>
                </View>

                {/* ─── Origin Country ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SHIP FROM</Text>
                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={() => setShowCountryModal(true)}
                    >
                        <View style={styles.settingIconBox}>
                            <Text style={{ fontSize: 20 }}>
                                {shipping.origin_country ? getCountryFlag(shipping.origin_country) : '🌍'}
                            </Text>
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Origin Country</Text>
                            <Text style={styles.settingValue}>
                                {shipping.origin_country || 'Select your country'}
                            </Text>
                        </View>
                        <ChevronRightIcon size={20} color={Colors.neutral[400]} />
                    </TouchableOpacity>
                </View>

                {/* ─── Processing Time ─── */}
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
                </View>

                {/* ─── Shipping Zones ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SHIPPING ZONES</Text>
                    {ZONE_OPTIONS.map((zone) => (
                        <View key={zone.key} style={styles.settingItem}>
                            <View style={styles.settingIconBox}>
                                <GlobeAltIcon size={22} color={Colors.text.primary} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>{zone.label}</Text>
                                <Text style={styles.settingSubtitle}>{zone.desc}</Text>
                            </View>
                            <Switch
                                value={shipping.shipping_zones.includes(zone.key)}
                                onValueChange={() => toggleZone(zone.key)}
                                trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                                disabled={zone.key === 'domestic'}
                            />
                        </View>
                    ))}
                </View>

                {/* ─── Carriers ─── */}
                {shipping.origin_country ? (
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>SHIPPING CARRIERS</Text>
                            <TouchableOpacity
                                style={styles.addBtn}
                                onPress={() => setShowAddCarrierModal(true)}
                            >
                                <PlusIcon size={16} color={Colors.primary[500]} />
                                <Text style={styles.addBtnText}>Add Custom</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Toggle carriers you use, set prices per package size
                        </Text>

                        {shipping.carriers.map((carrier, index) => (
                            <View key={`${carrier.name}-${index}`}>
                                <View style={styles.carrierItem}>
                                    <Text style={styles.carrierIcon}>{getCarrierIcon(carrier.type)}</Text>
                                    <View style={styles.carrierContent}>
                                        <Text style={styles.carrierName}>{carrier.name}</Text>
                                        <Text style={styles.carrierType}>
                                            {carrier.type === 'locker' ? 'Locker / Pickup Point' :
                                                carrier.type === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={carrier.enabled}
                                        onValueChange={() => toggleCarrier(index)}
                                        trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                                    />
                                </View>

                                {/* Price Tiers (shown when enabled) */}
                                {carrier.enabled && (
                                    <View style={styles.priceTierContainer}>
                                        {[
                                            { key: 'price_small' as const, label: 'Small (S)', desc: 'Jewelry, T-shirts' },
                                            { key: 'price_medium' as const, label: 'Medium (M)', desc: 'Shoes, Books' },
                                            { key: 'price_large' as const, label: 'Large (L)', desc: 'Coats, Electronics' },
                                        ].map((tier) => (
                                            <View key={tier.key} style={styles.priceTierRow}>
                                                <View style={styles.priceTierInfo}>
                                                    <Text style={styles.priceTierLabel}>{tier.label}</Text>
                                                    <Text style={styles.priceTierDesc}>{tier.desc}</Text>
                                                </View>
                                                <View style={styles.priceInputRow}>
                                                    <Text style={styles.currencyPrefix}>€</Text>
                                                    <TextInput
                                                        style={styles.priceInput}
                                                        value={carrier[tier.key] > 0 ? carrier[tier.key].toString() : ''}
                                                        onChangeText={(val) => updateCarrierPrice(index, tier.key, val)}
                                                        onBlur={saveCarrierPrice}
                                                        keyboardType="decimal-pad"
                                                        placeholder="0.00"
                                                        placeholderTextColor={Colors.neutral[400]}
                                                    />
                                                </View>
                                            </View>
                                        ))}

                                        {/* Remove button for custom carriers */}
                                        {!COUNTRY_CARRIERS[shipping.origin_country]?.some(
                                            c => c.name === carrier.name
                                        ) && (
                                            <TouchableOpacity
                                                style={styles.removeCarrierBtn}
                                                onPress={() => removeCarrier(index)}
                                            >
                                                <Text style={styles.removeCarrierText}>Remove carrier</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.emptyCarrierBox}>
                            <TruckIcon size={32} color={Colors.neutral[400]} />
                            <Text style={styles.emptyCarrierText}>
                                Select your origin country above to see suggested carriers
                            </Text>
                        </View>
                    </View>
                )}

                {/* ─── Local Pickup ─── */}
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

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ─── Processing Time Modal ─── */}
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

            {/* ─── Country Selection Modal ─── */}
            <Modal
                visible={showCountryModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowCountryModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCountryModal(false)} style={styles.circleBtn}>
                            <ChevronLeftIcon size={24} color={Colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Select Your Country</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <FlatList
                        data={AVAILABLE_COUNTRIES}
                        keyExtractor={(item) => item.name}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.countryItem}
                                onPress={() => handleCountrySelect(item.name)}
                            >
                                <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
                                <Text style={styles.countryName}>{item.name}</Text>
                                {shipping.origin_country === item.name && (
                                    <CheckCircleSolidIcon size={20} color={Colors.primary[500]} />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* ─── Add Custom Carrier Modal ─── */}
            <Modal
                visible={showAddCarrierModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAddCarrierModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAddCarrierModal(false)}
                >
                    <View style={styles.bottomSheet}>
                        <Text style={styles.bottomSheetTitle}>Add Custom Carrier</Text>
                        <Text style={styles.bottomSheetSubtitle}>
                            Enter the name of a carrier not on the suggested list
                        </Text>

                        <TextInput
                            style={styles.customCarrierInput}
                            value={customCarrierName}
                            onChangeText={setCustomCarrierName}
                            placeholder="e.g. FedEx, TNT, Local Courier"
                            placeholderTextColor={Colors.neutral[400]}
                            autoFocus
                        />

                        <TouchableOpacity
                            style={[
                                styles.addCarrierConfirmBtn,
                                !customCarrierName.trim() && styles.addCarrierConfirmBtnDisabled,
                            ]}
                            onPress={addCustomCarrier}
                            disabled={!customCarrierName.trim()}
                        >
                            <Text style={styles.addCarrierConfirmText}>Add Carrier</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => {
                                setCustomCarrierName('');
                                setShowAddCarrierModal(false);
                            }}
                        >
                            <Text style={styles.closeBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        paddingHorizontal: 20,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#9CA3AF',
        paddingHorizontal: 20,
        marginBottom: 12,
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

    // ─── Carriers ───
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    addBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary[500],
    },
    carrierItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    carrierIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    carrierContent: {
        flex: 1,
    },
    carrierName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    carrierType: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 1,
    },

    // ─── Price Tiers ───
    priceTierContainer: {
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    priceTierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    priceTierInfo: {
        flex: 1,
    },
    priceTierLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    priceTierDesc: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 1,
    },
    priceInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 90,
    },
    currencyPrefix: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginRight: 4,
    },
    priceInput: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        padding: 0,
    },
    removeCarrierBtn: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    removeCarrierText: {
        fontSize: 13,
        color: Colors.danger[500],
        fontWeight: '600',
    },

    // ─── Empty State ───
    emptyCarrierBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        margin: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyCarrierText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 20,
    },

    // ─── Modals ───
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
    customCarrierInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
        marginBottom: 16,
    },
    addCarrierConfirmBtn: {
        backgroundColor: Colors.primary[500],
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    addCarrierConfirmBtnDisabled: {
        backgroundColor: Colors.neutral[300],
    },
    addCarrierConfirmText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },

    // ─── Country Modal ───
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    countryName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
});
