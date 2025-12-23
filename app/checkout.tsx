import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    Alert,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
    Pressable
} from 'react-native';
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Colors } from '../constants/color';
import CustomButton from '../components/Button';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchCart, clearCart, CartItem } from '../lib/services/cartService';
import {
    LockClosedIcon,
    ChevronLeftIcon,
    CreditCardIcon
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolid } from 'react-native-heroicons/solid';

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

// Types 
type CheckoutStep = 1 | 2 | 3;
type ShippingMethod = 'standard' | 'express';

const Checkout = () => {
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useAuth();
    const { refreshCartCount } = useCart();

    // State management 
    const [step, setStep] = useState<CheckoutStep>(1);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Data 
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    // Form State
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [country, setCountry] = useState('Ireland');
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
    const [orderNote, setOrderNote] = useState('');
    const [saveAddress, setSaveAddress] = useState(false);

    // Payment State
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [saveCard, setSaveCard] = useState(false);

    // Filter/Modal State
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [searchCountry, setSearchCountry] = useState('');

    // Handle Back Navigation
    const stepRef = React.useRef(step);
    useEffect(() => {
        stepRef.current = step;
        // **** i addeded this Disable native swipe gesture on steps > 1 to prevent accidental exit, This forces the user to use the custom UI back button for inter-step navigation
        navigation.setOptions({
            gestureEnabled: step === 1
        });
    }, [step, navigation]);

    useEffect(() => {
        const onBeforeRemove = (e: any) => {
            // Check current step using ref
            if (stepRef.current > 1) {
                // Prevent default behavior of leaving the screen
                e.preventDefault();
                // Go back one step instead
                setStep((prev) => (prev - 1) as CheckoutStep);
            }
        };

        const unsubscribe = navigation.addListener('beforeRemove', onBeforeRemove);
        return unsubscribe;
    }, [navigation]);

    // Data Loading 
    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const items = await fetchCart(user.id);
            setCartItems(items);

            // Prefill form data if available 
            const { data: profile } = await supabase.from('profiles')
                .select('full_name, saved_address, payment_methods')
                .eq('id', user.id)
                .single();

            if (user.email) setEmail(user.email);

            if (profile?.full_name) {
                const names = profile.full_name.split(' ');
                setFirstName(names[0]);
                if (names.length > 1) setLastName(names.slice(1).join(' '));
            }

            // Load saved address if available
            if (profile?.saved_address) {
                const addr = profile.saved_address as any;
                if (addr.line1) setAddress1(addr.line1);
                if (addr.line2) setAddress2(addr.line2);
                if (addr.city) setCity(addr.city);
                if (addr.zipCode) setZipCode(addr.zipCode);
                if (addr.country) setCountry(addr.country);
                if (addr.phone) setPhone(addr.phone);
                if (addr.firstName) setFirstName(addr.firstName);
                if (addr.lastName) setLastName(addr.lastName);
            }

            setLoading(false);
        };
        loadData();
    }, [user]);

    // Zip Code Change Handling (Mock City Autofill)
    useEffect(() => {
        if (!zipCode) return;

        // Mock UK/Ireland logic
        const cleanZip = zipCode.replace(/\s/g, '').toUpperCase();

        const mockCities: Record<string, string> = {
            'SW1': 'London', 'M1': 'Manchester', 'B1': 'Birmingham',
            'D01': 'Dublin', 'D02': 'Dublin', 'T12': 'Cork',
            'EH1': 'Edinburgh', 'G1': 'Glasgow', 'CF10': 'Cardiff',
            'BT1': 'Belfast', '75001': 'Paris', '10115': 'Berlin',
            '00185': 'Rome', '28013': 'Madrid', '1000': 'Brussels'
        };

        // Check for partial match prefix
        const mathedPrefix = Object.keys(mockCities).find(prefix => cleanZip.startsWith(prefix));
        if (mathedPrefix) {
            setCity(mockCities[mathedPrefix]);
        }
    }, [zipCode]);

    // Total cost calculations 
    const totals = useMemo(() => {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const shippingCost = shippingMethod === 'express' ? 15.00 : 0.00;
        const tax = subtotal * 0.10; // 10% Tax
        const total = subtotal + shippingCost + tax;

        return { subtotal, shippingCost, tax, total };
    }, [cartItems, shippingMethod]);

    // Formatters
    const formatCardNumber = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        const truncated = cleaned.slice(0, 16); // Limit to 16 digits
        const groups = truncated.match(/.{1,4}/g) || [];
        setCardNumber(groups.join(' '));
    };

    const formatExpiryDate = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 3) {
            setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
        } else {
            setCardExpiry(cleaned);
        }
    };

    // Filtered Countries
    const filteredCountries = useMemo(() => {
        if (!searchCountry) return COUNTRIES;
        return COUNTRIES.filter(c => c.name.toLowerCase().includes(searchCountry.toLowerCase()));
    }, [searchCountry]);

    // Render Country Modal
    const renderCountryModal = () => (
        <Modal
            visible={showCountryPicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowCountryPicker(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select country</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.searchContainer}>
                    <MagnifyingGlassIcon size={20} color={Colors.neutral[400]} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search"
                        value={searchCountry}
                        onChangeText={setSearchCountry}
                        autoCorrect={false}
                    />
                    {searchCountry.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchCountry('')}>
                            <XMarkIcon size={20} color={Colors.neutral[400]} />
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={filteredCountries}
                    keyExtractor={(item) => item.name}
                    renderItem={({ item, index }) => {
                        const firstLetter = item.name[0];
                        const prevLetter = index > 0 ? filteredCountries[index - 1].name[0] : null;
                        const showHeader = firstLetter !== prevLetter;

                        return (
                            <View>
                                {showHeader && (
                                    <Text style={styles.countrySectionHeader}>{firstLetter}</Text>
                                )}
                                <TouchableOpacity
                                    style={styles.countryItem}
                                    onPress={() => {
                                        setCountry(item.name);
                                        setShowCountryPicker(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
                                        <Text style={styles.countryName}>{item.name}</Text>
                                    </View>
                                    {country === item.name && (
                                        <CheckCircleSolid size={20} color={Colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            </View>
        </Modal>
    );

    // Handlers 
    const handleNextStep = () => {
        if (step === 1) {
            if (!address1 || !city || !zipCode || !firstName || !lastName || !country) {
                Alert.alert('Missing Information', 'Please fill in all required shipping fields');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // Validate payment info 
            if (cardNumber.replace(/\s/g, '').length < 16 || cardExpiry.length < 5 || cardCvv.length < 3 || !cardHolderName) {
                Alert.alert('Missing Information', 'Please fill in all required payment fields');
                return;
            }
            setStep(3);
        }
    };

    const handlePlaceOrder = async () => {
        if (!user) return;
        setProcessing(true);

        try {
            const shippingAddressObj = {
                line1: address1,
                line2: address2,
                city,
                zipCode,
                country,
                phone,
                firstName,
                lastName,
            };

            // Save Address if requested
            if (saveAddress) {
                await supabase.from('profiles').update({
                    saved_address: shippingAddressObj
                }).eq('id', user.id);
            }

            // Save Payment Method if requested (STORING SENSITIVE DATA IN RAW FORM IS BAD PRACTICE - DEMO ONLY)
            if (saveCard) {
                // In production: Tokenize this with Stripe/PayPal and store the token.
                // Here we just mock saving "preference" or basic non-sensitive info
                await supabase.from('profiles').update({
                    payment_methods: { last4: cardNumber.slice(-4), cardHolder: cardHolderName }
                }).eq('id', user.id);
            }

            // 1. Create order record
            const { data: order, error: orderError } = await supabase.from('orders').insert({
                user_id: user.id,
                seller_id: cartItems[0]?.product.seller_id || 'system',
                subtotal: totals.subtotal,
                shipping_cost: totals.shippingCost,
                tax: totals.tax, // Changed from tax_rate to tax to match DB schema
                total_amount: totals.total, // Changed to total_amount to match DB schema
                status: 'confirmed',
                shipping_address: shippingAddressObj,
                payment_method: 'card',
                notes: orderNote,
            })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create order items 
            const orderItemsData = cartItems.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.product.price,
                product_name: item.product.name,
                product_image: item.product.image_url || item.product.images?.[0]
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
            if (itemsError) throw itemsError;

            // 3. Clear cart
            await clearCart(user.id);
            await refreshCartCount();

            Alert.alert('Order Placed', 'Your order has been placed successfully!', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/Home') }
            ]);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Order Failed', error.message || 'Something went wrong.');
        } finally {
            setProcessing(false);
        }
    };

    // Render Components 
    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => step > 1 ? setStep((s) => s - 1 as CheckoutStep) : router.back()} style={styles.backButton}>
                <ChevronLeftIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Checkout</Text>
                <LockClosedIcon size={14} color={Colors.text.secondary} style={{ marginLeft: 4 }} />
            </View>
            <View style={{ width: 24 }} />
        </View>
    );

    const renderProgressBar = () => (
        <View style={styles.progressContainer}>
            <View style={styles.progressTextContainer}>
                <Text style={[styles.progressText, step === 1 && styles.progressTextActive]}>1. Delivery</Text>
                <Text style={styles.progressTextSeperator}>—</Text>
                <Text style={[styles.progressText, step === 2 && styles.progressTextActive]}>2. Payment</Text>
                <Text style={styles.progressTextSeperator}>—</Text>
                <Text style={[styles.progressText, step === 3 && styles.progressTextActive]}>3. Review</Text>
            </View>
            <View style={styles.progressBar}>
                <View style={[styles.progressIndicator, { width: `${(step / 3) * 100}%` }]} />
            </View>
        </View>
    );

    // Delivery Form - Step 1
    const renderDeliveryStep = () => (
        <View style={styles.stepContainer}>
            {/* Customer Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.formGroup}>
                    <TextInput style={styles.input}
                        placeholder="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            </View>

            {/* Shipping Address */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shipping Address</Text>
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
                <TextInput
                    style={styles.input}
                    placeholder="Address Line 1"
                    value={address1}
                    onChangeText={setAddress1}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Address Line 2 (Optional)"
                    value={address2}
                    onChangeText={setAddress2}
                />

                {/* Country Selection */}
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

                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setSaveAddress(!saveAddress)}
                >
                    <View style={[styles.checkbox, saveAddress && styles.checkboxActive]}>
                        {saveAddress && <CheckCircleSolid size={20} color={Colors.primary[500]} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Save this address for later</Text>
                </TouchableOpacity>
            </View>

            {/* Shipping Method */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shipping Method</Text>

                <TouchableOpacity
                    style={[styles.radioOption, shippingMethod === 'standard' && styles.radioOptionSelected]}
                    onPress={() => setShippingMethod('standard')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {shippingMethod === 'standard' && <View style={styles.radioDot} />}
                        </View>
                        <View>
                            <Text style={styles.radioTitle}>Standard Delivery</Text>
                            <Text style={styles.radioSubtitle}>Est. 3-5 Business Days</Text>
                        </View>
                    </View>
                    <Text style={styles.radioPrice}>Free</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.radioOption, shippingMethod === 'express' && styles.radioOptionSelected]}
                    onPress={() => setShippingMethod('express')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {shippingMethod === 'express' && <View style={styles.radioDot} />}
                        </View>
                        <View>
                            <Text style={styles.radioTitle}>Express Delivery</Text>
                            <Text style={styles.radioSubtitle}>Est. 1-2 Business Days</Text>
                        </View>
                    </View>
                    <Text style={styles.radioPrice}>$15.00</Text>
                </TouchableOpacity>
            </View>

            {/* Notes */}
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

    // Payment Form - Step 2
    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setBillingSameAsShipping(!billingSameAsShipping)}
                >
                    <View style={[styles.checkbox, billingSameAsShipping && styles.checkboxActive]}>
                        {billingSameAsShipping && <CheckCircleSolid size={20} color={Colors.primary[500]} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Billing address same as shipping</Text>
                </TouchableOpacity>

                {!billingSameAsShipping && (
                    <Text style={{ marginTop: 10, color: Colors.text.secondary, fontStyle: 'italic' }}>
                        (Billing address form would appear here)
                    </Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Details</Text>

                {/* Cardholder Name */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={styles.formLabel}>Cardholder's Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. John Doe"
                        value={cardHolderName}
                        onChangeText={setCardHolderName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Card Number */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={styles.formLabel}>Card Number</Text>
                    <View style={[styles.inputWrapper, { borderWidth: 1, borderColor: Colors.neutral[300], borderRadius: 8, paddingHorizontal: 12 }]}>
                        <CreditCardIcon color={Colors.neutral[500]} size={24} />
                        <TextInput
                            style={[styles.cardInput, { paddingVertical: 12 }]}
                            placeholder="0000 0000 0000 0000"
                            value={cardNumber}
                            onChangeText={formatCardNumber} // Use formatter
                            keyboardType="numeric"
                            maxLength={19} // 16 digits + 3 spaces
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.halfInput]}>
                        <Text style={styles.formLabel}>Expiry Date</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChangeText={formatExpiryDate} // Use formatter
                            keyboardType="numeric"
                            maxLength={5}
                        />
                    </View>
                    <View style={[styles.halfInput]}>
                        <Text style={styles.formLabel}>Security Code</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="123"
                            value={cardCvv}
                            onChangeText={setCardCvv}
                            keyboardType="numeric"
                            maxLength={3}
                            secureTextEntry
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.checkboxRow, { marginTop: 8 }]}
                    onPress={() => setSaveCard(!saveCard)}
                >
                    <View style={[styles.checkbox, saveCard && styles.checkboxActive]}>
                        {saveCard && <CheckCircleSolid size={20} color={Colors.primary[500]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.checkboxLabel}>Agree to save these card details for faster checkout.</Text>
                        <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 4 }}>You can remove the card anytime in Settings, under Payments.</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.secureBadge}>
                    <LockClosedIcon size={12} color={Colors.success[700]} />
                    <Text style={styles.secureText}>Payments are secure and encrypted</Text>
                </View>
            </View>
        </View>
    );

    // Review Order - Step 3
    const renderReviewStep = () => (
        <View style={styles.stepContainer}>
            {/* Order Summary */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Summary</Text>
                {cartItems.map((item) => (
                    <View key={item.id} style={styles.reviewItem}>
                        <Image
                            source={
                                item.product.image_url
                                    ? { uri: item.product.image_url }
                                    : { uri: "https://via.placeholder.com/60" } // Fallback
                            }
                            style={styles.reviewImage}
                        />
                        <View style={styles.reviewItemDetails}>
                            <Text style={styles.reviewItemName} numberOfLines={1}>{item.product.name}</Text>
                            <Text style={styles.reviewItemMeta}>Qty: {item.quantity}</Text>
                        </View>
                        <Text style={styles.reviewItemPrice}>${(item.product.price * item.quantity).toFixed(2)}</Text>
                    </View>
                ))}
            </View>

            {/* Order Totals */}
            <View style={styles.section}>
                <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Subtotal</Text>
                    <Text style={styles.costValue}>${totals.subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Shipping</Text>
                    <Text style={styles.costValue}>${totals.shippingCost.toFixed(2)}</Text>
                </View>
                <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Tax</Text>
                    <Text style={styles.costValue}>${totals.tax.toFixed(2)}</Text>
                </View>
                <View style={[styles.costRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total To Pay</Text>
                    <Text style={styles.totalValue}>${totals.total.toFixed(2)}</Text>
                </View>
            </View>

            {/* Details Recap */}
            <View style={styles.recapContainer}>
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Ship To</Text>
                        <Text style={styles.recapValue}>{firstName} {lastName}</Text>
                        <Text style={styles.recapValue}>{address1}, {city}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(1)}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Method</Text>
                        <Text style={styles.recapValue}>
                            {shippingMethod === 'standard' ? 'Standard Delivery' : 'Express Delivery'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(1)}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Payment</Text>
                        <Text style={styles.recapValue}>Card ending in {cardNumber.slice(-4) || '****'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep(2)}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.termsText}>
                By clicking Place Order, you agree to our Terms & Conditions.
            </Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </SafeAreaView>
        );
    }

    if (cartItems.length === 0 && !processing) {
        return (
            <SafeAreaView style={styles.container}>
                {renderHeader()}
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Your cart is empty.</Text>
                    <CustomButton title="Go Back" onPress={() => router.back()} style={{ marginTop: 20 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {renderHeader()}
                {renderProgressBar()}

                <ScrollView contentContainerStyle={styles.content}>
                    {step === 1 && renderDeliveryStep()}
                    {step === 2 && renderPaymentStep()}
                    {step === 3 && renderReviewStep()}
                </ScrollView>

                <View style={styles.footer}>
                    {step < 3 ? (
                        <CustomButton
                            title={step === 1 ? "Continue to Payment" : "Review Order"}
                            onPress={handleNextStep}
                        />
                    ) : (
                        <CustomButton
                            title={processing ? "Processing..." : `Pay $${totals.total.toFixed(2)}`}
                            onPress={handlePlaceOrder}
                            disabled={processing}
                        />
                    )}
                </View>
                {renderCountryModal()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    backButton: {
        padding: 4,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    progressContainer: {
        paddingVertical: 16,
        backgroundColor: Colors.neutral[50],
    },
    progressTextContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 8,
    },
    progressText: {
        fontSize: 13,
        color: Colors.neutral[400],
        fontWeight: '600',
    },
    progressTextActive: {
        color: Colors.primary[500],
    },
    progressTextSeperator: {
        marginHorizontal: 8,
        color: Colors.neutral[300],
    },
    progressBar: {
        height: 2,
        backgroundColor: Colors.neutral[200],
        marginHorizontal: 40,
        borderRadius: 1,
        overflow: 'hidden',
    },
    progressIndicator: {
        height: '100%',
        backgroundColor: Colors.primary[500],
    },
    content: {
        padding: 20,
    },
    stepContainer: {
        gap: 24,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
        color: Colors.text.primary,
    },
    formGroup: {
        marginBottom: 12,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
        color: Colors.text.secondary,
    },
    formInput: {
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        backgroundColor: '#fff',
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 15,
        backgroundColor: '#fff',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        marginBottom: 12,
    },
    radioOptionSelected: {
        borderColor: Colors.primary[500],
        backgroundColor: Colors.primary[50],
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    radioCircle: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.neutral[400],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    radioDot: {
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary[500],
    },
    radioTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    radioSubtitle: {
        fontSize: 13,
        color: Colors.text.secondary,
    },
    radioPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    checkbox: {
        width: 20,
        height: 20,
        marginRight: 10,
        borderWidth: 2,
        borderColor: Colors.neutral[300],
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        borderColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxLabel: {
        fontSize: 15,
        color: Colors.text.primary,
    },
    cardInputContainer: {
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        padding: 16,
        backgroundColor: Colors.neutral[50],
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
        marginBottom: 12,
        paddingBottom: 4,
    },
    cardInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: Colors.text.primary,
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        gap: 6,
    },
    secureText: {
        fontSize: 12,
        color: Colors.success[700],
        fontWeight: '500',
    },
    reviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    reviewImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: Colors.neutral[100],
    },
    reviewItemDetails: {
        flex: 1,
        marginLeft: 12,
    },
    reviewItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    reviewItemMeta: {
        fontSize: 13,
        color: Colors.text.secondary,
        marginTop: 4,
    },
    reviewItemPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    costRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    costLabel: {
        fontSize: 15,
        color: Colors.text.secondary,
    },
    costValue: {
        fontSize: 15,
        color: Colors.text.primary,
    },
    totalRow: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[200],
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.primary[500],
    },
    recapContainer: {
        backgroundColor: Colors.neutral[50],
        borderRadius: 8,
        padding: 16,
    },
    recapRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    recapLabel: {
        fontSize: 12,
        color: Colors.text.secondary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    recapValue: {
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    editLink: {
        fontSize: 14,
        color: Colors.primary[500],
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.neutral[200],
        marginVertical: 12,
    },
    termsText: {
        fontSize: 12,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginTop: 16,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderColor: Colors.neutral[200],
        backgroundColor: '#fff',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: Colors.text.secondary,
    },
    pillContainer: {
        marginBottom: 16,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.neutral[100],
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    pillSelected: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[500],
    },
    pillText: {
        fontSize: 14,
        color: Colors.text.primary,
    },
    pillTextSelected: {
        color: Colors.primary[600],
        fontWeight: '600',
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        borderRadius: 8,
        padding: 12,
        backgroundColor: Colors.neutral[50],
        marginBottom: 16,
    },
    countrySelectorText: {
        fontSize: 16,
        color: Colors.text.primary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? 20 : 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.neutral[100],
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: Colors.text.primary,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    countryName: {
        fontSize: 16,
        color: Colors.text.primary,
    },
    countrySectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text.secondary,
        backgroundColor: Colors.neutral[50],
        paddingHorizontal: 20,
        paddingVertical: 8,
    }
});

export default Checkout;