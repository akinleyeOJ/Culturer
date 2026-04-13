import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { ChevronDownIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { sellerShipsToZone, type CarrierConfig, type SellerShippingConfig, type ShippingZone } from '../../lib/shippingUtils';
import { type PickupPointResult } from '../../lib/services/pickupPointService';
import { type CheckoutAddress } from './types';

interface DeliveryStepProps {
    styles: any;
    email: string;
    setEmail: (value: string) => void;
    savedAddresses: CheckoutAddress[];
    selectedAddressIndex: number | null;
    clearAddressForm: () => void;
    fillAddressForm: (address: CheckoutAddress) => void;
    setSelectedAddressIndex: (value: number | null) => void;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    address1: string;
    setAddress1: (value: string) => void;
    address2: string;
    setAddress2: (value: string) => void;
    city: string;
    setCity: (value: string) => void;
    zipCode: string;
    setZipCode: (value: string) => void;
    country: string;
    setCountry: (value: string) => void;
    phone: string;
    setPhone: (value: string) => void;
    setShowCountryPicker: (value: boolean) => void;
    handleSaveAddress: () => void;
    handleDeleteAddress: () => void;
    totalWeightGrams: number;
    formattedWeight: string;
    sellerShipping: SellerShippingConfig | null;
    shippingZone: ShippingZone;
    liveShippingApisEnabled: boolean;
    loadingRates: boolean;
    integratedCarrierOptions: CarrierConfig[];
    selectedCarrier: CarrierConfig | null;
    setSelectedCarrier: (carrier: CarrierConfig | null) => void;
    selectedLocker: PickupPointResult | null;
    setSelectedLocker: (pickupPoint: PickupPointResult | null) => void;
    clearPickupPointDraft: () => void;
    onOpenPickupPointPicker: () => void;
    orderNote: string;
    setOrderNote: (value: string) => void;
}

export function DeliveryStep({
    styles,
    email,
    setEmail,
    savedAddresses,
    selectedAddressIndex,
    clearAddressForm,
    fillAddressForm,
    setSelectedAddressIndex,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    address1,
    setAddress1,
    address2,
    setAddress2,
    city,
    setCity,
    zipCode,
    setZipCode,
    country,
    setCountry,
    phone,
    setPhone,
    setShowCountryPicker,
    handleSaveAddress,
    handleDeleteAddress,
    totalWeightGrams,
    formattedWeight,
    sellerShipping,
    shippingZone,
    liveShippingApisEnabled,
    loadingRates,
    integratedCarrierOptions,
    selectedCarrier,
    setSelectedCarrier,
    selectedLocker,
    setSelectedLocker,
    clearPickupPointDraft,
    onOpenPickupPointPicker,
    orderNote,
    setOrderNote,
}: DeliveryStepProps) {
    const sellerShipsToCurrentZone = sellerShipping ? sellerShipsToZone(sellerShipping, shippingZone) : true;

    return (
        <View style={styles.stepContainer}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.formGroup}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shipping Address</Text>

                <View style={{ marginBottom: 16 }}>
                    <Text style={styles.formLabel}>Saved Addresses</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        <TouchableOpacity
                            style={[styles.savedAddressCard, selectedAddressIndex === null && styles.savedAddressCardSelected]}
                            onPress={clearAddressForm}
                        >
                            <Text style={[styles.savedAddressText, selectedAddressIndex === null && styles.savedAddressTextSelected]}>+ New Address</Text>
                        </TouchableOpacity>
                        {savedAddresses.map((addr, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.savedAddressCard, selectedAddressIndex === index && styles.savedAddressCardSelected]}
                                onPress={() => {
                                    fillAddressForm(addr);
                                    setSelectedAddressIndex(index);
                                }}
                            >
                                <Text style={[styles.savedAddressText, selectedAddressIndex === index && styles.savedAddressTextSelected]}>
                                    {addr.label || `${addr.firstName} (${addr.city})`}
                                </Text>
                                <Text style={{ fontSize: 10, color: Colors.text.secondary, marginTop: 2 }} numberOfLines={1}>
                                    {addr.line1}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="First Name"
                        value={firstName}
                        onChangeText={setFirstName}
                    />
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Last Name"
                        value={lastName}
                        onChangeText={setLastName}
                    />
                </View>
                <View style={[styles.row, { zIndex: 100 }]}>
                    <GooglePlacesAutocomplete
                        placeholder="Search or enter Address Line 1"
                        onPress={(data, details = null) => {
                            if (details) {
                                let streetNumber = '';
                                let route = '';
                                let locality = '';
                                let postalCode = '';
                                let countryCode = '';

                                details.address_components.forEach((component) => {
                                    const types = component.types;
                                    if (types.includes('street_number')) streetNumber = component.long_name;
                                    if (types.includes('route')) route = component.long_name;
                                    if (types.includes('locality')) locality = component.long_name;
                                    if (types.includes('postal_code')) postalCode = component.long_name;
                                    if (types.includes('country')) countryCode = component.short_name;
                                });

                                setAddress1(`${streetNumber} ${route}`.trim() || data.description);
                                if (locality) setCity(locality);
                                if (postalCode) setZipCode(postalCode);
                                if (countryCode) setCountry(countryCode);
                            } else {
                                setAddress1(data.description);
                            }
                        }}
                        query={{
                            key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                            language: 'en',
                        }}
                        fetchDetails={true}
                        styles={{
                            container: { flex: 0, width: '100%', marginBottom: 12 },
                            textInputContainer: { width: '100%' },
                            textInput: styles.input,
                            listView: {
                                position: 'absolute',
                                top: 48,
                                zIndex: 1000,
                                elevation: 5,
                                backgroundColor: 'white',
                                borderRadius: 10,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                            },
                        }}
                        textInputProps={{
                            value: address1,
                            onChangeText: setAddress1,
                            placeholderTextColor: Colors.neutral[400]
                        }}
                    />
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Address Line 2 (Optional)"
                    value={address2}
                    onChangeText={setAddress2}
                />

                <Text style={styles.formLabel}>Country</Text>
                <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={() => setShowCountryPicker(true)}
                >
                    <Text style={styles.countrySelectorText}>{country}</Text>
                    <ChevronDownIcon size={20} color={Colors.text.secondary} />
                </TouchableOpacity>

                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="City"
                        value={city}
                        onChangeText={setCity}
                    />
                    <TextInput
                        style={[styles.input, styles.halfInput]}
                        placeholder="Zip / Postal Code"
                        value={zipCode}
                        onChangeText={setZipCode}
                    />
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                        style={[styles.actionButton, { width: '45%', backgroundColor: Colors.primary[500] }]}
                        onPress={handleSaveAddress}
                    >
                        <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                            {selectedAddressIndex !== null ? 'Update' : 'Save Address'}
                        </Text>
                    </TouchableOpacity>

                    {selectedAddressIndex !== null && (
                        <TouchableOpacity
                            style={[styles.actionButton, { width: '45%', backgroundColor: Colors.danger[50], borderWidth: 1, borderColor: Colors.danger[200] }]}
                            onPress={handleDeleteAddress}
                        >
                            <Text style={[styles.actionButtonText, { color: Colors.danger[500] }]}>Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shipping Method</Text>

                {totalWeightGrams > 0 && (
                    <View style={styles.weightSummaryRow}>
                        <Text style={styles.weightSummaryLabel}>📦 Estimated Package Weight</Text>
                        <Text style={styles.weightSummaryValue}>{formattedWeight}</Text>
                    </View>
                )}

                {sellerShipping && country && (
                    <View style={[styles.zoneInfoBox, shippingZone === 'international' && { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                        <Text style={styles.zoneInfoText}>
                            {shippingZone === 'domestic'
                                ? `🏠 Domestic shipping within ${country}`
                                : shippingZone === 'eu'
                                    ? `🇪🇺 EU shipping — no customs duties`
                                    : `🌍 International shipping — import duties or taxes may apply upon delivery`
                            }
                        </Text>
                    </View>
                )}

                {!liveShippingApisEnabled && sellerShipping?.modes.home_delivery.enabled && (
                    <View style={styles.apiCostHintBox}>
                        <Text style={styles.apiCostHintText}>
                            Direct carrier integrations are off in this environment.
                        </Text>
                    </View>
                )}

                {sellerShipping && (
                    <View style={styles.apiCostHintBox}>
                        <Text style={styles.apiCostHintText}>
                            Live shipping quotes appear only for delivery options that can return a real provider rate for this route.
                        </Text>
                    </View>
                )}

                {loadingRates ? (
                    <View style={styles.loadingRatesBox}>
                        <ActivityIndicator color={Colors.primary[500]} size="small" />
                        <Text style={styles.loadingRatesText}>Checking direct carrier availability...</Text>
                    </View>
                ) : null}

                {integratedCarrierOptions.length > 0 && (
                    <>
                        <Text style={styles.subSectionTitle}>
                            Integrated Delivery Options
                        </Text>
                        {integratedCarrierOptions.map((carrier) => {
                            const isSelected = selectedCarrier?.name === carrier.name;
                            return (
                                <TouchableOpacity
                                    key={carrier.name}
                                    style={[styles.radioOption, isSelected && styles.radioOptionSelected]}
                                    onPress={() => {
                                        setSelectedCarrier(carrier);
                                        if (carrier.type !== 'locker') {
                                            setSelectedLocker(null);
                                            clearPickupPointDraft();
                                        }
                                    }}
                                >
                                    <View style={styles.radioRow}>
                                        <View style={styles.radioCircle}>
                                            {isSelected && <View style={styles.radioDot} />}
                                        </View>
                                        <View>
                                            <Text style={styles.radioTitle}>{carrier.name}</Text>
                                            <Text style={styles.radioSubtitle}>
                                                {carrier.type === 'locker' ? 'Locker / Pickup Point' :
                                                    carrier.type === 'pickup'
                                                        ? (sellerShipping?.pickup_location
                                                            ? `Collect in person • ${sellerShipping.pickup_location}`
                                                            : 'Store Pickup')
                                                        : 'Home Delivery'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.radioPrice}>
                                        {carrier.type === 'pickup' ? 'Free' : 'Quoted at checkout'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                {!loadingRates && integratedCarrierOptions.length === 0 && (
                    <View style={styles.loadingRatesBox}>
                        <Text style={styles.loadingRatesText}>
                            No direct carrier integrations are live for this route yet.
                        </Text>
                    </View>
                )}

                {selectedCarrier?.type === 'locker' && (
                    <View style={styles.lockerSection}>
                        <Text style={styles.lockerTitle}>📮 Select Pickup Point</Text>
                        <Text style={styles.lockerSubtitle}>Open a separate search screen to find pickup points near the typed location.</Text>

                        <TouchableOpacity style={styles.pickupLauncher} onPress={onOpenPickupPointPicker}>
                            <View style={styles.pickupLauncherRow}>
                                <View style={styles.pickupLauncherCopy}>
                                    <Text style={styles.pickupLauncherTitle}>
                                        {selectedLocker ? 'Change Pickup Point' : 'Select Pickup Point'}
                                    </Text>
                                    <Text style={styles.pickupLauncherSubtitle}>
                                        {selectedLocker
                                            ? `${selectedLocker.id} • ${selectedLocker.address}`
                                            : `Search ${selectedCarrier.name} pickup points near the buyer's delivery area`}
                                    </Text>
                                </View>
                                <ChevronDownIcon size={18} color={Colors.neutral[500]} style={{ transform: [{ rotate: '-90deg' }] }} />
                            </View>
                        </TouchableOpacity>

                        {selectedLocker && (
                            <View style={styles.lockerConfirm}>
                                <Text style={styles.lockerConfirmText}>
                                    ✅ Delivering to: {selectedLocker.id} — {selectedLocker.address}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {sellerShipping && country && !sellerShipsToCurrentZone && (
                    <View style={[styles.zoneInfoBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <Text style={[styles.zoneInfoText, { color: '#DC2626' }]}>
                            ⚠️ This seller doesn't ship to {country}. Please contact them or choose a different address.
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Add any special instructions/notes for delivery"
                    multiline
                    numberOfLines={3}
                    value={orderNote}
                    onChangeText={setOrderNote}
                />
            </View>
        </View>
    );
}
