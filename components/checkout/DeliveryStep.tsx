import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { ChevronDownIcon } from "react-native-heroicons/outline";
import { Colors } from "../../constants/color";
import {
  sellerShipsToZone,
  SHIPPING_LAUNCH_COUNTRY,
  type CarrierConfig,
  type SellerShippingConfig,
  type ShippingZone,
} from "../../lib/shippingUtils";
import { type PickupPointResult } from "../../lib/services/pickupPointService";
import { type CheckoutAddress } from "./types";

const PLACEHOLDER_TEXT_COLOR = Colors.neutral[600];

const normalizePolishPostalFromPlaces = (raw: string) => {
  const digits = String(raw).replace(/\D/g, "").slice(0, 5);
  return digits.length === 5
    ? `${digits.slice(0, 2)}-${digits.slice(2)}`
    : String(raw).trim();
};

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
  ratesError: string | null;
  /** Why we are not calling Furgonetka yet (address incomplete, seller zip, etc.) */
  ratesBlockedReason: string | null;
  buyerReadyForQuotes: boolean;
  hasLiveCarrierQuotes: boolean;
  /** When seller enabled lockers but API returned none — explains why only home delivery appears */
  lockerRatesHint: string | null;
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
  ratesError,
  ratesBlockedReason,
  buyerReadyForQuotes,
  hasLiveCarrierQuotes,
  lockerRatesHint,
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
  void liveShippingApisEnabled;

  const sellerShipsToCurrentZone = sellerShipping
    ? sellerShipsToZone(sellerShipping, shippingZone)
    : true;

  const [zipTouched, setZipTouched] = useState(false);
  const isPolishZip = /^\d{2}-\d{3}$/.test(zipCode);
  const showZipError = zipTouched && zipCode.length > 0 && !isPolishZip;

  // Auto-format: strip non-digits, insert dash after 2nd digit → XX-XXX
  const handleZipChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 5);
    const formatted =
      digits.length >= 3 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
    setZipCode(formatted);
  };

  const getCarrierPriceLabel = (carrier: CarrierConfig) => {
    if (carrier.type === "pickup") return "Free";
    if (carrier.quote_status === "loading") return "Loading...";
    if (
      carrier.type === "locker" &&
      carrier.quote_status === "requires_pickup_point"
    ) {
      return "Pick point first";
    }
    if (carrier.quote_status === "missing_address") return "Enter address";
    if (
      carrier.quote_status === "ready" &&
      typeof carrier.quote_amount === "number"
    ) {
      return `${carrier.quote_currency || "PLN"} ${carrier.quote_amount.toFixed(2)}`;
    }
    return "Unavailable";
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.formGroup}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            <TouchableOpacity
              style={[
                styles.savedAddressCard,
                selectedAddressIndex === null &&
                  styles.savedAddressCardSelected,
              ]}
              onPress={clearAddressForm}
            >
              <Text
                style={[
                  styles.savedAddressText,
                  selectedAddressIndex === null &&
                    styles.savedAddressTextSelected,
                ]}
              >
                + New Address
              </Text>
            </TouchableOpacity>
            {savedAddresses.map((addr, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.savedAddressCard,
                  selectedAddressIndex === index &&
                    styles.savedAddressCardSelected,
                ]}
                onPress={() => {
                  fillAddressForm(addr);
                  setSelectedAddressIndex(index);
                }}
              >
                <Text
                  style={[
                    styles.savedAddressText,
                    selectedAddressIndex === index &&
                      styles.savedAddressTextSelected,
                  ]}
                >
                  {addr.label || `${addr.firstName} (${addr.city})`}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: Colors.text.secondary,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
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
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Last Name"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
        <View style={[styles.row, { zIndex: 100 }]}>
          <GooglePlacesAutocomplete
            placeholder="Search or enter Address Line 1"
            onPress={(data, details = null) => {
              if (details) {
                let streetNumber = "";
                let route = "";
                let locality = "";
                let postalCode = "";
                let countryCode = "";

                details.address_components.forEach((component) => {
                  const types = component.types;
                  if (types.includes("street_number"))
                    streetNumber = component.long_name;
                  if (types.includes("route")) route = component.long_name;
                  if (types.includes("locality"))
                    locality = component.long_name;
                  if (types.includes("postal_code"))
                    postalCode = component.long_name;
                  if (types.includes("country"))
                    countryCode = component.short_name;
                });

                setAddress1(
                  `${streetNumber} ${route}`.trim() || data.description,
                );
                if (locality) setCity(locality);
                if (postalCode)
                  setZipCode(normalizePolishPostalFromPlaces(postalCode));
                if (countryCode) {
                  const cc = String(countryCode).toUpperCase();
                  setCountry(cc === "PL" ? SHIPPING_LAUNCH_COUNTRY : cc);
                }
              } else {
                setAddress1(data.description);
              }
            }}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
              language: "en",
            }}
            fetchDetails={true}
            styles={{
              container: { flex: 0, width: "100%", marginBottom: 12 },
              textInputContainer: { width: "100%" },
              textInput: styles.input,
              listView: {
                position: "absolute",
                top: 48,
                zIndex: 1000,
                elevation: 5,
                backgroundColor: "white",
                borderRadius: 10,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              },
            }}
            textInputProps={{
              value: address1,
              onChangeText: setAddress1,
              placeholderTextColor: PLACEHOLDER_TEXT_COLOR,
            }}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Address Line 2 (Optional)"
          placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
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
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
            value={city}
            onChangeText={setCity}
          />
          <View style={deliveryStyles.zipWrapper}>
            <TextInput
              style={[
                styles.input,
                styles.halfInput,
                showZipError && deliveryStyles.inputError,
              ]}
              placeholder="Zip (XX-XXX)"
              placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
              value={zipCode}
              onChangeText={handleZipChange}
              onBlur={() => setZipTouched(true)}
              keyboardType="numeric"
              maxLength={6}
            />
            {showZipError && (
              <Text style={deliveryStyles.zipErrorText}>
                Format: XX-XXX (e.g. 00-001)
              </Text>
            )}
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 12,
            marginTop: 8,
          }}
        >
          <TouchableOpacity
            style={[
              styles.actionButton,
              { width: "45%", backgroundColor: Colors.primary[500] },
            ]}
            onPress={handleSaveAddress}
          >
            <Text style={[styles.actionButtonText, { color: "#fff" }]}>
              {selectedAddressIndex !== null ? "Update" : "Save Address"}
            </Text>
          </TouchableOpacity>

          {selectedAddressIndex !== null && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  width: "45%",
                  backgroundColor: Colors.danger[50],
                  borderWidth: 1,
                  borderColor: Colors.danger[200],
                },
              ]}
              onPress={handleDeleteAddress}
            >
              <Text
                style={[styles.actionButtonText, { color: Colors.danger[500] }]}
              >
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shipping Method</Text>

        {totalWeightGrams > 0 && (
          <View style={styles.weightSummaryRow}>
            <Text style={styles.weightSummaryLabel}>
              📦 Estimated Package Weight
            </Text>
            <Text style={styles.weightSummaryValue}>{formattedWeight}</Text>
          </View>
        )}

        {sellerShipping && country && (
          <View
            style={[
              styles.zoneInfoBox,
              shippingZone === "international" && {
                backgroundColor: "#FFF7ED",
                borderColor: "#FFEDD5",
              },
            ]}
          >
            <Text style={styles.zoneInfoText}>
              {shippingZone === "domestic"
                ? `🏠 Domestic shipping within ${country}`
                : shippingZone === "eu"
                  ? `🇪🇺 EU shipping — no customs duties`
                  : `🌍 International shipping — import duties or taxes may apply upon delivery`}
            </Text>
          </View>
        )}

        {sellerShipping && (
          <>
            {ratesError ? (
              <View
                style={[
                  styles.apiCostHintBox,
                  {
                    backgroundColor: "#FEF2F2",
                    borderColor: "#FECACA",
                  },
                ]}
              >
                <Text style={[styles.apiCostHintText, { color: "#B91C1C" }]}>
                  {ratesError}
                </Text>
              </View>
            ) : ratesBlockedReason ? (
              <View
                style={[
                  styles.apiCostHintBox,
                  {
                    backgroundColor: "#FFFBEB",
                    borderColor: "#FDE68A",
                  },
                ]}
              >
                <Text style={[styles.apiCostHintText, { color: "#92400E" }]}>
                  {ratesBlockedReason}
                </Text>
              </View>
            ) : (
              <View style={styles.apiCostHintBox}>
                <Text style={styles.apiCostHintText}>
                  Live carrier prices load automatically once your delivery address
                  is complete (name, email, phone, street, city, postcode).
                </Text>
              </View>
            )}
          </>
        )}

        {loadingRates ? (
          <View style={styles.loadingRatesBox}>
            <ActivityIndicator color={Colors.primary[500]} size="small" />
            <Text style={styles.loadingRatesText}>
              Fetching live carrier rates…
            </Text>
          </View>
        ) : null}

        {!loadingRates &&
        !ratesError &&
        buyerReadyForQuotes &&
        !ratesBlockedReason &&
        !hasLiveCarrierQuotes &&
        integratedCarrierOptions.some((c) => c.type === "pickup") ? (
          <View style={styles.loadingRatesBox}>
            <Text style={styles.loadingRatesText}>
              No courier returned a price for this route yet. Check the postcode
              or try again in a moment. Local Pickup is still available below.
            </Text>
          </View>
        ) : null}

        {integratedCarrierOptions.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>Delivery Options</Text>
            {lockerRatesHint ? (
              <View style={styles.apiCostHintBox}>
                <Text style={styles.apiCostHintText}>{lockerRatesHint}</Text>
              </View>
            ) : null}
            {integratedCarrierOptions.map((carrier) => {
              const isSelected = selectedCarrier?.name === carrier.name;
              return (
                <TouchableOpacity
                  key={carrier.name}
                  style={[
                    styles.radioOption,
                    isSelected && styles.radioOptionSelected,
                  ]}
                  onPress={() => {
                    const prevName = selectedCarrier?.name;
                    setSelectedCarrier(carrier);
                    if (carrier.type !== "locker") {
                      setSelectedLocker(null);
                      clearPickupPointDraft();
                    } else if (prevName && prevName !== carrier.name) {
                      // Different locker network (e.g. InPost → DPD): old point is invalid.
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
                        {carrier.type === "locker"
                          ? "Locker / Pickup Point"
                          : carrier.type === "pickup"
                            ? sellerShipping?.pickup_location
                              ? `Collect in person • ${sellerShipping.pickup_location}`
                              : "Store Pickup"
                            : "Home Delivery"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.radioPrice}>
                    {getCarrierPriceLabel(carrier)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {!loadingRates &&
        integratedCarrierOptions.length === 0 &&
        !ratesBlockedReason &&
        !ratesError &&
        buyerReadyForQuotes && (
          <View style={styles.loadingRatesBox}>
            <Text style={styles.loadingRatesText}>
              No shipping options are available for this order yet.
            </Text>
          </View>
        )}

        {selectedCarrier?.type === "locker" && (
          <View style={styles.lockerSection}>
            <Text style={styles.lockerTitle}>📮 Select Pickup Point</Text>
            <Text style={styles.lockerSubtitle}>
              Open a separate search screen to find pickup points near the typed
              location.
            </Text>

            <TouchableOpacity
              style={styles.pickupLauncher}
              onPress={onOpenPickupPointPicker}
            >
              <View style={styles.pickupLauncherRow}>
                <View style={styles.pickupLauncherCopy}>
                  <Text style={styles.pickupLauncherTitle}>
                    {selectedLocker
                      ? "Change Pickup Point"
                      : "Select Pickup Point"}
                  </Text>
                  <Text style={styles.pickupLauncherSubtitle}>
                    {selectedLocker
                      ? `${selectedLocker.id} • ${selectedLocker.address}`
                      : `Search ${selectedCarrier.name} pickup points near the buyer's delivery area`}
                  </Text>
                </View>
                <ChevronDownIcon
                  size={18}
                  color={Colors.neutral[500]}
                  style={{ transform: [{ rotate: "-90deg" }] }}
                />
              </View>
            </TouchableOpacity>

            {selectedLocker && (
              <View style={styles.lockerConfirm}>
                <Text style={styles.lockerConfirmText}>
                  ✅ Delivering to: {selectedLocker.id} —{" "}
                  {selectedLocker.address}
                </Text>
              </View>
            )}
          </View>
        )}

        {sellerShipping && country && !sellerShipsToCurrentZone && (
          <View
            style={[
              styles.zoneInfoBox,
              { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
            ]}
          >
            <Text style={[styles.zoneInfoText, { color: "#DC2626" }]}>
              ⚠️ This seller doesn't ship to {country}. Please contact them or
              choose a different address.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          placeholder="Add any special instructions/notes for delivery"
          placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
          multiline
          numberOfLines={3}
          value={orderNote}
          onChangeText={setOrderNote}
        />
      </View>
    </View>
  );
}

const deliveryStyles = StyleSheet.create({
  zipWrapper: {
    flex: 1,
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
  },
  zipErrorText: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 3,
    marginLeft: 2,
  },
});
