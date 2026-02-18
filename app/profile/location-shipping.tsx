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
    Modal,
    FlatList,
    Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    ChevronLeftIcon,
    PlusIcon,
    TrashIcon,
    MapPinIcon,
    PencilSquareIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ChevronRightIcon,
    HomeIcon
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from 'react-native-heroicons/solid';

interface Address {
    firstName: string;
    lastName: string;
    line1: string;
    line2?: string;
    city: string;
    zipCode: string;
    country: string;
    phone: string;
    label?: string;
    isPrimary?: boolean;
}

interface ShippingPreferences {
    local_pickup: boolean;
    delivery_speed: 'standard' | 'express' | 'any';
}

const COUNTRIES = [
    { name: "Austria", flag: "🇦🇹" }, { name: "Belgium", flag: "🇧🇪" }, { name: "Bulgaria", flag: "🇧🇬" },
    { name: "Croatia", flag: "🇭🇷" }, { name: "Cyprus", flag: "🇨🇾" }, { name: "Czech Republic", flag: "🇨🇿" },
    { name: "Denmark", flag: "🇩🇰" }, { name: "Estonia", flag: "🇪🇪" }, { name: "Finland", flag: "🇫🇮" },
    { name: "France", flag: "🇫🇷" }, { name: "Germany", flag: "🇩🇪" }, { name: "Greece", flag: "🇬🇷" },
    { name: "Hungary", flag: "🇭🇺" }, { name: "Ireland", flag: "🇮🇪" }, { name: "Italy", flag: "🇮🇹" },
    { name: "Latvia", flag: "🇱🇻" }, { name: "Lithuania", flag: "🇱🇹" }, { name: "Luxembourg", flag: "🇱🇺" },
    { name: "Malta", flag: "🇲🇹" }, { name: "Netherlands", flag: "🇳🇱" }, { name: "Poland", flag: "🇵🇱" },
    { name: "Portugal", flag: "🇵🇹" }, { name: "Romania", flag: "🇷🇴" }, { name: "Slovakia", flag: "🇸🇰" },
    { name: "Slovenia", flag: "🇸🇮" }, { name: "Spain", flag: "🇪🇸" }, { name: "Sweden", flag: "🇸🇪" },
    { name: "United Kingdom", flag: "🇬🇧" }
].sort((a, b) => a.name.localeCompare(b.name));

export default function LocationShippingScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [preferences, setPreferences] = useState<ShippingPreferences>({
        local_pickup: false,
        delivery_speed: 'any'
    });

    // Edit/Add Mode
    const [isEditing, setIsEditing] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [line1, setLine1] = useState('');
    const [line2, setLine2] = useState('');
    const [city, setCity] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [country, setCountry] = useState('');
    const [phone, setPhone] = useState('');
    const [isPrimary, setIsPrimary] = useState(false);

    // Country Picker
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [searchCountry, setSearchCountry] = useState('');

    // Delivery Speed Modal
    const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('saved_address, shipping_preferences')
                .eq('id', user.id)
                .single();

            if (data) {
                const profileData = data as any;
                // Addresses
                if (profileData.saved_address) {
                    const loaded: any = Array.isArray(profileData.saved_address) ? profileData.saved_address : [profileData.saved_address];
                    const valid = loaded.filter((a: any) => a && a.line1);
                    setAddresses(valid as Address[]);
                }

                // Preferences
                if (profileData.shipping_preferences) {
                    setPreferences(profileData.shipping_preferences as ShippingPreferences);
                }
            }
        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (addr: Address, index: number) => {
        setFirstName(addr.firstName || '');
        setLastName(addr.lastName || '');
        setLine1(addr.line1 || '');
        setLine2(addr.line2 || '');
        setCity(addr.city || '');
        setZipCode(addr.zipCode || '');
        setCountry(addr.country || '');
        setPhone(addr.phone || '');
        setIsPrimary(addr.isPrimary || false);

        setEditIndex(index);
        setIsEditing(true);
    };

    const handleAddNew = () => {
        setFirstName('');
        setLastName('');
        setLine1('');
        setLine2('');
        setCity('');
        setZipCode('');
        setCountry('');
        setPhone('');
        setIsPrimary(addresses.length === 0); // Default to primary if likely first address

        setEditIndex(null);
        setIsEditing(true);
    };

    const handleSaveAddress = async () => {
        if (!firstName || !lastName || !line1 || !city || !zipCode || !country) {
            Alert.alert('Missing Fields', 'Please fill in all required fields.');
            return;
        }

        const newAddr: Address = {
            firstName, lastName, line1, line2, city, zipCode, country, phone,
            label: `${firstName} ${lastName}`,
            isPrimary
        };

        let updatedList = [...addresses];

        // Handle Primary logic: if this one is primary, set others to false
        if (isPrimary) {
            updatedList = updatedList.map(a => ({ ...a, isPrimary: false }));
        }

        if (editIndex !== null) {
            updatedList[editIndex] = newAddr;
        } else {
            updatedList.push(newAddr);
        }

        try {
            setSaving(true);
            const { error } = await supabase.from('profiles').update({
                saved_address: updatedList as any
            }).eq('id', user!.id);

            if (error) throw error;

            setAddresses(updatedList);
            setIsEditing(false);
            setEditIndex(null);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAddress = async (index: number) => {
        Alert.alert(
            "Delete Address",
            "Are you sure you want to delete this address?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const updatedList = addresses.filter((_, i) => i !== index);
                        try {
                            setSaving(true);
                            const { error } = await supabase.from('profiles').update({
                                saved_address: updatedList as any
                            }).eq('id', user!.id);

                            if (error) throw error;
                            setAddresses(updatedList);
                            if (editIndex === index) setIsEditing(false);
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

    const togglePreference = async (key: keyof ShippingPreferences) => {
        const newValue = !preferences[key]; // boolean toggle logic
        // For enum like delivery_speed, logic would differ if more than 2 options

        const newPrefs = { ...preferences, [key]: newValue };
        setPreferences(newPrefs);

        try {
            const { error } = await supabase.from('profiles').update({
                shipping_preferences: newPrefs as any
            } as any).eq('id', user!.id);

            if (error) throw error;
        } catch (e) {
            console.error('Error saving preference', e);
            setPreferences(preferences); // Revert
        }
    };

    const handleSetDefault = async (index: number) => {
        const updatedList = addresses.map((addr, i) => ({
            ...addr,
            isPrimary: i === index
        }));

        setAddresses(updatedList); // Optimistic update

        try {
            const { error } = await supabase.from('profiles').update({
                saved_address: updatedList as any
            }).eq('id', user!.id);

            if (error) throw error;
        } catch (e: any) {
            Alert.alert('Error', 'Failed to update default address');
            // Revert would go here if needed
        }
    };

    const handleUpdateDeliverySpeed = async (speed: 'standard' | 'express' | 'any') => {
        const newPrefs = { ...preferences, delivery_speed: speed };
        setPreferences(newPrefs);
        setShowDeliveryOptions(false);

        try {
            const { error } = await supabase.from('profiles').update({
                shipping_preferences: newPrefs as any
            } as any).eq('id', user!.id);

            if (error) throw error;
        } catch (e) {
            console.error('Error saving preference', e);
            // Revert if needed
        }
    };

    const filteredCountries = searchCountry
        ? COUNTRIES.filter(c => c.name.toLowerCase().includes(searchCountry.toLowerCase()))
        : COUNTRIES;

    // --- Render Form ---
    if (isEditing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.circleBtn}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{editIndex !== null ? 'Edit Address' : 'Add New Address'}</Text>
                    <TouchableOpacity onPress={handleSaveAddress} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color={Colors.primary[500]} /> : (
                            <Text style={styles.saveText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.formContent}>
                    <View style={styles.formSection}>
                        <Text style={styles.sectionLabel}>Contact</Text>
                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>First Name</Text>
                                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="John" />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>Last Name</Text>
                                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Doe" />
                            </View>
                        </View>
                        <View style={styles.fullInput}>
                            <Text style={styles.label}>Phone (Optional)</Text>
                            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+1 234 567 8900" keyboardType="phone-pad" />
                        </View>
                    </View>

                    <View style={styles.formSection}>
                        <Text style={styles.sectionLabel}>Address</Text>
                        <TouchableOpacity style={styles.countrySelector} onPress={() => setShowCountryPicker(true)}>
                            <View>
                                <Text style={styles.label}>Country / Region</Text>
                                <Text style={[styles.inputValue, !country && { color: '#9CA3AF' }]}>{country || 'Select Country'}</Text>
                            </View>
                            <ChevronRightIcon size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.fullInput}>
                            <Text style={styles.label}>Address Line 1</Text>
                            <TextInput style={styles.input} value={line1} onChangeText={setLine1} placeholder="Street address" />
                        </View>
                        <View style={styles.fullInput}>
                            <Text style={styles.label}>Address Line 2 (Optional)</Text>
                            <TextInput style={styles.input} value={line2} onChangeText={setLine2} placeholder="Apt, suite, etc." />
                        </View>
                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>City</Text>
                                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>Zip Code</Text>
                                <TextInput style={styles.input} value={zipCode} onChangeText={setZipCode} placeholder="12345" />
                            </View>
                        </View>

                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Set as default address</Text>
                            <Switch
                                value={isPrimary}
                                onValueChange={setIsPrimary}
                                trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                            />
                        </View>
                    </View>

                    {editIndex !== null && (
                        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteAddress(editIndex)}>
                            <Text style={styles.deleteText}>Delete Address</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                {/* Country Picker Modal */}
                <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet">
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.circleBtn}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Select Country</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={styles.searchBox}>
                            <MagnifyingGlassIcon size={20} color="#9CA3AF" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search country"
                                value={searchCountry}
                                onChangeText={setSearchCountry}
                            />
                        </View>
                        <FlatList
                            data={filteredCountries}
                            keyExtractor={item => item.name}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.countryItem} onPress={() => {
                                    setCountry(item.name);
                                    setShowCountryPicker(false);
                                }}>
                                    <Text style={styles.flag}>{item.flag}</Text>
                                    <Text style={styles.countryName}>{item.name}</Text>
                                    {country === item.name && <CheckCircleSolidIcon size={20} color={Colors.primary[500]} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }
    // --- Delivery Speed Modal ---
    const renderDeliveryModal = () => (
        <Modal
            visible={showDeliveryOptions}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeliveryOptions(false)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowDeliveryOptions(false)}
            >
                <View style={styles.bottomSheet}>
                    <Text style={styles.bottomSheetTitle}>Select Delivery Speed</Text>

                    <TouchableOpacity
                        style={styles.sheetItem}
                        onPress={() => handleUpdateDeliverySpeed('any')}
                    >
                        <View>
                            <Text style={styles.sheetItemTitle}>No Preference (Any)</Text>
                            <Text style={styles.sheetItemSubtitle}>Show all items regardless of speed</Text>
                        </View>
                        {preferences.delivery_speed === 'any' && <CheckCircleSolidIcon size={24} color={Colors.primary[500]} />}
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.sheetItem}
                        onPress={() => handleUpdateDeliverySpeed('standard')}
                    >
                        <View>
                            <Text style={styles.sheetItemTitle}>Standard Shipping</Text>
                            <Text style={styles.sheetItemSubtitle}>Regular delivery (3-5 business days)</Text>
                        </View>
                        {preferences.delivery_speed === 'standard' && <CheckCircleSolidIcon size={24} color={Colors.primary[500]} />}
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.sheetItem}
                        onPress={() => handleUpdateDeliverySpeed('express')}
                    >
                        <View>
                            <Text style={styles.sheetItemTitle}>Express Shipping Only</Text>
                            <Text style={styles.sheetItemSubtitle}>Only show items with fast delivery</Text>
                        </View>
                        {preferences.delivery_speed === 'express' && <CheckCircleSolidIcon size={24} color={Colors.primary[500]} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.closeButton} onPress={() => setShowDeliveryOptions(false)}>
                        <Text style={styles.closeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    // --- Main UI ---
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Location & Shipping</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* SAVED ADDRESSES SECTION */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>SAVED ADDRESSES</Text>

                        {addresses.map((addr, index) => (
                            <View key={index} style={styles.addressItem}>
                                {/* Radio Button for Default Selection */}
                                <TouchableOpacity
                                    style={styles.radioButton}
                                    onPress={() => handleSetDefault(index)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <View style={[
                                        styles.radioOuter,
                                        addr.isPrimary && styles.radioOuterSelected
                                    ]}>
                                        {addr.isPrimary && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.addressContentContainer}
                                    onPress={() => handleEdit(addr, index)}
                                >
                                    <View style={styles.addressIconBox}>
                                        <HomeIcon size={20} color={Colors.text.primary} />
                                    </View>
                                    <View style={styles.addressContent}>
                                        <View style={styles.addressHeaderRow}>
                                            <Text style={styles.addressLabel}>{addr.label || 'Home'}</Text>
                                            {addr.isPrimary && (
                                                <Text style={styles.primaryTag}>Primary</Text>
                                            )}
                                        </View>
                                        <Text style={styles.addressDetail} numberOfLines={1}>
                                            {addr.line1}, {addr.city}, {addr.country}
                                        </Text>
                                    </View>
                                    <ChevronRightIcon size={20} color={Colors.neutral[400]} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addNewButton} onPress={handleAddNew}>
                            <View style={styles.plusIconBg}>
                                <PlusIcon size={16} color="#FFF" />
                            </View>
                            <Text style={styles.addNewText}>Add New Address</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    {/* PREFERENCES SECTION */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>PREFERENCES</Text>

                        {/* Local Pickup */}
                        <View style={styles.preferenceItem}>
                            <View style={styles.prefTextContainer}>
                                <Text style={styles.prefTitle}>Local Pickup</Text>
                                <Text style={styles.prefSubtitle}>Show items available for pickup nearby</Text>
                            </View>
                            <Switch
                                value={preferences.local_pickup}
                                onValueChange={() => togglePreference('local_pickup')}
                                trackColor={{ false: '#D1D5DB', true: Colors.primary[500] }}
                            />
                        </View>

                        {/* Delivery Speed - Using as a clickable item currently, could become a modal/selector later */}
                        <TouchableOpacity style={styles.preferenceItem} onPress={() => setShowDeliveryOptions(true)}>
                            <View style={styles.prefTextContainer}>
                                <Text style={styles.prefTitle}>Delivery Speed</Text>
                                <Text style={styles.prefSubtitle}>Default preference for shipping</Text>
                            </View>
                            <View style={styles.prefRight}>
                                <Text style={styles.prefValue}>
                                    {preferences.delivery_speed === 'express' ? 'Express' : preferences.delivery_speed === 'any' ? 'Any' : 'Standard'}
                                </Text>
                                <ChevronRightIcon size={20} color={Colors.neutral[400]} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
            {renderDeliveryModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light gray background for the main view
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
        paddingHorizontal: 8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingBottom: 40,
    },
    sectionContainer: {
        backgroundColor: '#FFF',
        marginTop: 24,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF', // Gray-400 equivalent
        marginBottom: 8,
        marginTop: 8,
        marginLeft: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addressItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    radioButton: {
        padding: 4,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: Colors.primary[500],
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary[500],
    },
    addressContentContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressIconBox: {
        width: 40,
        height: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    addressContent: {
        flex: 1,
        marginRight: 8,
    },
    addressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    addressLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    primaryTag: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 8,
        fontWeight: '500',
    },
    addressDetail: {
        fontSize: 14,
        color: '#6B7280',
    },
    addNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    plusIconBg: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: Colors.primary[500], // Purple/Primary color
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginLeft: 8, // Align somewhat with the icon above but smaller
    },
    addNewText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[500],
    },
    divider: {
        height: 0,
    },

    // Preferences styles
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    prefTextContainer: {
        flex: 1,
        marginRight: 16,
    },
    prefTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    prefSubtitle: {
        fontSize: 13,
        color: '#9CA3AF',
    },
    prefRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    prefValue: {
        fontSize: 15,
        color: '#6B7280',
    },

    // Form Styles (reused mostly)
    formContent: {
        padding: 16,
    },
    formSection: {
        marginBottom: 24,
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    halfInput: {
        flex: 1,
    },
    fullInput: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    switchLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
    },
    countrySelector: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inputValue: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    deleteButton: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#FECACA',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40,
    },
    deleteText: {
        color: '#DC2626',
        fontWeight: '600',
        fontSize: 16,
    },
    // Modal
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
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
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
    flag: {
        fontSize: 24,
        marginRight: 16,
    },
    countryName: {
        fontSize: 16,
        color: '#111827',
        flex: 1,
    },
    // Modal Overlay
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    bottomSheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 20,
        textAlign: 'center',
    },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    sheetItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    sheetItemSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    closeButton: {
        marginTop: 20,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
});
