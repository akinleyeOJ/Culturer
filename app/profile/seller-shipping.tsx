import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    AVAILABLE_ORIGIN_COUNTRIES,
    DEFAULT_SHIPPING_CONFIG,
    PROCESSING_TIMES,
    ZONE_OPTIONS,
    buildProviderConfigs,
    getCountryFlag,
    getLockedDefaultProvidersForMode,
    getSupportedLockerProviderNamesForCountry,
    hydrateShippingConfig,
    normalizeCountryName,
    type ShippingProviderMode,
    type SellerShippingConfig,
} from '../../lib/shippingUtils';
import { fetchSendcloudServicePointCarrierCodes } from '../../lib/services/sendcloudService';
import {
    ChevronLeftIcon,
    TruckIcon,
    ClockIcon,
    MapPinIcon,
    ChevronRightIcon,
    CheckCircleIcon as CheckCircleSolidIcon,
    GlobeAltIcon,
    InformationCircleIcon,
} from 'react-native-heroicons/outline';

export default function SellerShippingScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [shipping, setShipping] = useState<SellerShippingConfig>(DEFAULT_SHIPPING_CONFIG);
    const [sendcloudCarrierCodes, setSendcloudCarrierCodes] = useState<string[]>([]);
    const [servicePointCapabilitiesLoaded, setServicePointCapabilitiesLoaded] = useState(false);
    const supportedLockerProviderNames = useMemo(
        () => getSupportedLockerProviderNamesForCountry(shipping.origin_country, sendcloudCarrierCodes),
        [sendcloudCarrierCodes, shipping.origin_country]
    );
    const providersByMode = {
        home_delivery: shipping.providers.filter((provider) => provider.mode === 'home_delivery'),
        locker_pickup: shipping.providers.filter((provider) => provider.mode === 'locker_pickup'),
    };
    const lockedHomeProviders = getLockedDefaultProvidersForMode(shipping.origin_country, 'home_delivery');
    const lockedLockerProviders = getLockedDefaultProvidersForMode(
        shipping.origin_country,
        'locker_pickup',
        supportedLockerProviderNames
    );
    const lockedProviders = new Set([...lockedHomeProviders, ...lockedLockerProviders]);

    const fetchShippingSettings = useCallback(async () => {
        try {
            const [{ data }, carrierCapabilityResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('shop_shipping')
                    .eq('id', user!.id)
                    .single(),
                fetchSendcloudServicePointCarrierCodes(),
            ]);

            const carrierCodes = carrierCapabilityResult.success ? carrierCapabilityResult.carrierCodes : [];
            setSendcloudCarrierCodes(carrierCodes);
            setServicePointCapabilitiesLoaded(true);

            if (data) {
                if (data.shop_shipping) {
                    const saved = (data.shop_shipping as unknown) as Partial<SellerShippingConfig>;
                    const savedCountry = normalizeCountryName(saved.origin_country || '');
                    const liveSupportedLockerProviders = getSupportedLockerProviderNamesForCountry(savedCountry, carrierCodes);
                    setShipping(hydrateShippingConfig(saved, liveSupportedLockerProviders));
                    setHasUnsavedChanges(false);
                } else {
                    setShipping(DEFAULT_SHIPPING_CONFIG);
                    setHasUnsavedChanges(false);
                }
            }
        } catch (e) {
            console.error('Error fetching shipping settings:', e);
        } finally {
            setServicePointCapabilitiesLoaded(true);
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) fetchShippingSettings();
    }, [fetchShippingSettings, user]);

    const persistShipping = async (updatedSettings = shipping) => {
        if (!user) return;
        const normalizedSettings = hydrateShippingConfig(updatedSettings, supportedLockerProviderNames);
        try {
            setSaving(true);
            const { error } = await supabase
                .from('profiles')
                .update({ shop_shipping: normalizedSettings as any })
                .eq('id', user.id);

            if (error) throw error;
            setShipping(normalizedSettings);
            setHasUnsavedChanges(false);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateShipping = (updater: SellerShippingConfig | ((current: SellerShippingConfig) => SellerShippingConfig)) => {
        setShipping((current) => {
            const next = typeof updater === 'function'
                ? (updater as (current: SellerShippingConfig) => SellerShippingConfig)(current)
                : updater;
            const liveSupportedLockerProviders = getSupportedLockerProviderNamesForCountry(
                next.origin_country,
                sendcloudCarrierCodes
            );

            setHasUnsavedChanges(true);
            return hydrateShippingConfig(next, liveSupportedLockerProviders);
        });
    };

    const updateField = (field: keyof SellerShippingConfig, value: any) => {
        const newSettings = { ...shipping, [field]: value };
        updateShipping(newSettings);
    };

    // ─── Country Selection ───
    const handleCountrySelect = (countryName: string) => {
        const normalizedCountry = normalizeCountryName(countryName);

        const newSettings = {
            ...shipping,
            origin_country: normalizedCountry,
            providers: buildProviderConfigs(
                normalizedCountry,
                shipping.providers,
                getSupportedLockerProviderNamesForCountry(normalizedCountry, sendcloudCarrierCodes)
            ),
        };
        updateShipping(newSettings);
        setShowCountryModal(false);
    };

    const updateMode = (mode: ShippingProviderMode | 'local_pickup', enabled: boolean) => {
        if (
            shipping.origin_country &&
            (mode === 'home_delivery' || mode === 'locker_pickup') &&
            getLockedDefaultProvidersForMode(
                shipping.origin_country,
                mode,
                mode === 'locker_pickup' ? supportedLockerProviderNames : []
            ).length > 0
        ) {
            return;
        }

        updateShipping((current) => ({
            ...current,
            modes: {
                ...current.modes,
                [mode]: mode === 'local_pickup'
                    ? { enabled }
                    : { ...current.modes[mode], enabled },
            },
        }));
    };

    const toggleProvider = (providerName: string) => {
        if (lockedProviders.has(providerName)) {
            return;
        }

        updateShipping((current) => ({
            ...current,
            providers: current.providers.map((provider) =>
                provider.name === providerName
                    ? { ...provider, enabled: !provider.enabled }
                    : provider
            ),
        }));
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
                <TouchableOpacity
                    style={styles.headerSaveButton}
                    onPress={() => persistShipping()}
                    disabled={!hasUnsavedChanges || saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={Colors.primary[500]} />
                    ) : (
                        <Text
                            style={[
                                styles.headerSaveText,
                                (!hasUnsavedChanges || saving) && styles.headerSaveTextDisabled,
                            ]}
                        >
                            Save
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag">
                <View style={styles.infoBox}>
                    <InformationCircleIcon size={20} color={Colors.primary[600]} />
                    <Text style={styles.infoText}>
                        Choose which shipping modes you support, then enable providers per mode. Buyers only see options that match their address.
                    </Text>
                </View>

                {/* ─── Origin Address (Required for Shippo) ─── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SHIP FROM ADDRESS</Text>
                    <View style={styles.addressContainer}>
                        <TouchableOpacity
                            style={styles.countryPickerItem}
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

                        <View style={styles.addressForm}>
                            <TextInput
                                style={styles.addressInput}
                                placeholder="Street Address (Line 1)"
                                value={shipping.origin_street1}
                                onChangeText={(val) => updateShipping(prev => ({ ...prev, origin_street1: val }))}
                                placeholderTextColor={Colors.neutral[400]}
                            />
                            <View style={styles.addressRow}>
                                <TextInput
                                    style={[styles.addressInput, { flex: 2 }]}
                                    placeholder="City"
                                    value={shipping.origin_city}
                                    onChangeText={(val) => updateShipping(prev => ({ ...prev, origin_city: val }))}
                                    placeholderTextColor={Colors.neutral[400]}
                                />
                                <TextInput
                                    style={[styles.addressInput, { flex: 1, borderLeftWidth: 1, borderLeftColor: '#F3F4F6' }]}
                                    placeholder="ZIP Code"
                                    value={shipping.origin_zip}
                                    onChangeText={(val) => updateShipping(prev => ({ ...prev, origin_zip: val }))}
                                    placeholderTextColor={Colors.neutral[400]}
                                />
                            </View>
                            <TextInput
                                style={[styles.addressInput, { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}
                                placeholder="State / Province (if applicable)"
                                value={shipping.origin_state}
                                onChangeText={(val) => updateShipping(prev => ({ ...prev, origin_state: val }))}
                                placeholderTextColor={Colors.neutral[400]}
                            />
                        </View>
                        <View style={styles.infoBoxSub}>
                             <InformationCircleIcon size={16} color={Colors.neutral[500]} />
                             <Text style={styles.infoTextSub}>
                                This address is required for accurate courier rate calculations.
                             </Text>
                        </View>
                    </View>
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

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SHIPPING MODES AS A SELLER</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <TruckIcon size={22} color={Colors.text.primary} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Home Delivery</Text>
                            <Text style={styles.settingSubtitle}>
                                Buyers pay platform-calculated postage at checkout. Two popular country defaults stay on.
                            </Text>
                        </View>
                        <Switch
                            value={shipping.modes.home_delivery.enabled}
                            onValueChange={(value) => updateMode('home_delivery', value)}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                            disabled={lockedHomeProviders.length > 0}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <Text style={{ fontSize: 20 }}>📦</Text>
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Locker / Pickup Point</Text>
                            <Text style={styles.settingSubtitle}>Provider-specific pickup point selection with two country defaults locked on.</Text>
                        </View>
                        <Switch
                            value={shipping.modes.locker_pickup.enabled}
                            onValueChange={(value) => updateMode('locker_pickup', value)}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                            disabled={lockedLockerProviders.length > 0}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingIconBox}>
                            <MapPinIcon size={22} color={Colors.primary[600]} />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Local Pickup</Text>
                            <Text style={styles.settingSubtitle}>Let buyers collect items in person</Text>
                        </View>
                        <Switch
                            value={shipping.modes.local_pickup.enabled}
                            onValueChange={(value) => updateMode('local_pickup', value)}
                            trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                        />
                    </View>

                    {shipping.modes.local_pickup.enabled && (
                        <View style={[styles.settingItem, styles.nestedItem]}>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>Pickup Location Info</Text>
                                <Text style={styles.settingSubtitle}>General area only, not the full private address</Text>
                                <TextInput
                                    style={[styles.textInput, { marginTop: 8 }]}
                                    value={shipping.pickup_location}
                                    onChangeText={(text) => updateShipping((prev) => ({ ...prev, pickup_location: text }))}
                                    placeholder="Enter general area for pickup"
                                />
                            </View>
                        </View>
                    )}
                </View>

                {/* ─── Providers ─── */}
                {shipping.origin_country ? (
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>SHIPPING PROVIDERS</Text>
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            Default providers are selected based on popularity in the seller's country.
                        </Text>

                        {([
                            {
                                mode: 'home_delivery' as const,
                                title: 'Home Delivery Providers',
                                enabled: shipping.modes.home_delivery.enabled,
                                items: providersByMode.home_delivery,
                            },
                            {
                                mode: 'locker_pickup' as const,
                                title: 'Locker / Pickup Providers',
                                enabled: shipping.modes.locker_pickup.enabled,
                                items: providersByMode.locker_pickup,
                            },
                        ]).map((group) => (
                            <View key={group.mode} style={styles.providerGroup}>
                                <Text style={styles.providerGroupTitle}>{group.title}</Text>
                                {!group.enabled ? (
                                    <Text style={styles.providerGroupHint}>Turn this mode on above to configure available providers.</Text>
                                ) : group.mode === 'locker_pickup' && !servicePointCapabilitiesLoaded ? (
                                    <Text style={styles.providerGroupHint}>Loading live Sendcloud pickup-point carriers...</Text>
                                ) : group.items.length === 0 ? (
                                    <Text style={styles.providerGroupHint}>
                                        {group.mode === 'locker_pickup'
                                            ? 'No live Sendcloud pickup-point providers are enabled for this country right now.'
                                            : 'No suggested providers for this country yet. Add a custom provider.'}
                                    </Text>
                                ) : (
                                    <>
                                        {group.mode === 'locker_pickup' && (
                                            <Text style={styles.providerGroupHint}>
                                                Default providers are selected based on popularity in this country.
                                            </Text>
                                        )}
                                        {group.items.map((carrier) => {
                                        const isLockedDefault = lockedProviders.has(carrier.name);

                                        return (
                                            <View key={`${group.mode}-${carrier.name}`}>
                                                <View style={styles.carrierItem}>
                                                    <Text style={styles.carrierIcon}>{getCarrierIcon(carrier.type)}</Text>
                                                    <View style={styles.carrierContent}>
                                                        <View style={styles.carrierNameRow}>
                                                            <Text style={styles.carrierName}>{carrier.name}</Text>
                                                            {isLockedDefault && (
                                                                <View style={styles.defaultBadge}>
                                                                    <Text style={styles.defaultBadgeText}>Default</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={styles.carrierType}>
                                                            {carrier.type === 'locker' ? 'Locker / Pickup Point' : 'Home Delivery'}
                                                        </Text>
                                                    </View>
                                                    <Switch
                                                        value={carrier.enabled}
                                                        onValueChange={() => toggleProvider(carrier.name)}
                                                        trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                                                        disabled={isLockedDefault}
                                                    />
                                                </View>

                                                {carrier.enabled && isLockedDefault && (
                                                    <View style={styles.priceTierContainer}>
                                                        <Text style={styles.providerActionsHint}>
                                                            Selected by default based on carrier popularity in this country.
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.emptyCarrierBox}>
                            <TruckIcon size={32} color={Colors.neutral[400]} />
                            <Text style={styles.emptyCarrierText}>
                                Select your origin country above to see suggested providers
                            </Text>
                        </View>
                    </View>
                )}

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
                        data={AVAILABLE_ORIGIN_COUNTRIES}
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
    headerSaveButton: {
        minWidth: 48,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    headerSaveText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.primary[500],
    },
    headerSaveTextDisabled: {
        color: Colors.neutral[300],
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
    carrierNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    providerGroup: {
        marginBottom: 16,
    },
    providerGroupTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        paddingHorizontal: 20,
        marginBottom: 4,
    },
    providerGroupHint: {
        fontSize: 12,
        color: '#9CA3AF',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    priceTierContainer: {
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    providerActionsHint: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 16,
        paddingVertical: 8,
    },
    defaultBadge: {
        backgroundColor: '#EEF2FF',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    defaultBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4F46E5',
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
    modePickerRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    modePickerPill: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modePickerPillActive: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    modePickerPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
    },
    modePickerPillTextActive: {
        color: '#FFF',
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

    // ─── Address Form ───
    addressContainer: {
        marginHorizontal: 16,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        overflow: 'hidden',
        marginBottom: 8,
    },
    countryPickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    addressForm: {
        padding: 4,
    },
    addressInput: {
        padding: 12,
        fontSize: 14,
        color: '#111827',
    },
    addressRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    infoBoxSub: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    infoTextSub: {
        fontSize: 11,
        color: '#6B7280',
        flex: 1,
    },
});
