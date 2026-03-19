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
    Pressable,
    Switch, // Ensure Image is imported for logos if needed
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/color';
import CustomButton from '../components/Button';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchCart, clearCart, CartItem } from '../lib/services/cartService';
import { trackProductSale } from '../lib/services/productService';
import {
    detectShippingZone,
    WEIGHT_TIER_GRAMS,
    formatWeight,
    getCarrierPrice,
    getEnabledCarriers,
    sellerShipsToZone,
    type ShippingZone,
    type WeightTier,
    type SellerShippingConfig,
    type CarrierConfig,
} from '../lib/shippingUtils';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    FadeInDown,
} from 'react-native-reanimated';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import {
    ChevronLeftIcon,
    DevicePhoneMobileIcon,
    CreditCardIcon,
    LockClosedIcon,
    BanknotesIcon
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolid } from 'react-native-heroicons/solid';
import { CardField, useStripe } from '@stripe/stripe-react-native';

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
type ShippingMethod = 'standard' | 'express' | 'carrier';

interface Address {
    line1: string;
    line2: string;
    city: string;
    zipCode: string;
    country: string;
    phone: string;
    firstName: string;
    lastName: string;
    label?: string; // e.g. "Home", "Office"
}

const Checkout = () => {
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useAuth();
    const { refreshCartCount } = useCart();
    const { productId, quantity: paramQuantity, orderId } = useLocalSearchParams<{ productId?: string, quantity?: string, orderId?: string }>();

    // State management 
    const [step, setStep] = useState<CheckoutStep>(1);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Data 
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    // Mobile Payments
    const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
    const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [country, setCountry] = useState('');
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
    const [orderNote, setOrderNote] = useState('');
    const [saveAddress, setSaveAddress] = useState(false);

    // Shipping Zone & Carrier State
    const [sellerShipping, setSellerShipping] = useState<SellerShippingConfig | null>(null);
    const [shippingZone, setShippingZone] = useState<ShippingZone>('domestic');
    const [selectedCarrier, setSelectedCarrier] = useState<CarrierConfig | null>(null);
    const [totalWeightGrams, setTotalWeightGrams] = useState(0);
    const [cartWeightTier, setCartWeightTier] = useState<WeightTier>('medium');

    // Locker Selection State
    const [lockerSearch, setLockerSearch] = useState('');
    const [selectedLocker, setSelectedLocker] = useState<{ id: string; address: string; hint: string } | null>(null);
    const [lockerResults, setLockerResults] = useState<{ id: string; address: string; hint: string }[]>([]);

    // Payment State
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'apple_pay' | 'p24'>('card');
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [saveCard, setSaveCard] = useState(false);

    // Stripe hooks
    const { createPaymentMethod } = useStripe();
    const [cardDetails, setCardDetails] = useState<any>(null);
    const [stripePaymentMethodId, setStripePaymentMethodId] = useState<string | null>(null);

    // Filter/Modal State
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [searchCountry, setSearchCountry] = useState('');

    // Promo Code State
    const [promoCode, setPromoCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
    const [checkingCoupon, setCheckingCoupon] = useState(false);

    // Saved Cards State
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
    const [loadingCards, setLoadingCards] = useState(false);

    // Fetch Saved Cards
    const fetchSavedCards = async () => {
        if (!user) return;
        setLoadingCards(true);
        try {
            const { data, error } = await supabase.functions.invoke('get-payment-methods', {
                body: { userId: user.id }
            });
            if (error) throw error;
            if (data?.paymentMethods) {
                setSavedCards(data.paymentMethods);
                // Optionally auto-select the first card
                // if (data.paymentMethods.length > 0) setSelectedSavedCardId(data.paymentMethods[0].id);
            }
        } catch (e) {
            console.error('Error fetching cards:', e);
        }
        setLoadingCards(false);
    };

    useEffect(() => {
        if (step === 2 && selectedPaymentMethod === 'card') {
            fetchSavedCards();
        }
    }, [step, selectedPaymentMethod]);

    // Handle Back Navigation
    // Handle Back Navigation
    useEffect(() => {
        // Disable native swipe gesture on steps > 1 to prevent accidental exit
        // This forces the user to use the custom UI back button for inter-step navigation
        navigation.setOptions({
            gestureEnabled: step === 1
        });
    }, [step, navigation]);

    // Data Loading 
    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            setLoading(true);

            console.log('Checkout loadData - productId:', productId, 'quantity:', paramQuantity);

            if (productId) {
                // Direct "Buy Now" flow
                try {
                    // Fetch product
                    const { data: p, error: pError } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', productId)
                        .single();

                    if (pError || !p) {
                        console.error('Error fetching product for Buy Now:', pError);
                        setLoading(false);
                        return;
                    }

                    // Fetch seller profile separately
                    let sellerName = 'Seller';
                    if (p.user_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', p.user_id)
                            .single();
                        if (profile?.full_name) sellerName = profile.full_name;
                    }

                    const quantity = paramQuantity ? parseInt(paramQuantity as string) : 1;

                    if (p.stock_quantity <= 0) {
                        Alert.alert('Sold Out', 'Sorry, this item was just sold.');
                        router.back();
                        return;
                    }

                    if (quantity > p.stock_quantity) {
                        Alert.alert('Limited Stock', `Sorry, only ${p.stock_quantity} available.`);
                        router.back();
                        return;
                    }

                    const priceNum = typeof p.price === 'string'
                        ? parseFloat((p.price as string).replace('$', ''))
                        : p.price;

                    console.log('Setting direct purchase item:', { id: p.id, name: p.name, price: priceNum, quantity });

                    const discount = p.discount_percentage || 0;
                    const effectivePrice = discount > 0 ? priceNum * (1 - discount / 100) : priceNum;
                    setCartItems([{
                        id: p.id,
                        product_id: p.id,
                        user_id: user.id,
                        quantity: quantity,
                        created_at: new Date().toISOString(),
                        product: {
                            id: p.id,
                            name: p.name,
                            price: effectivePrice,
                            image_url: p.image_url || undefined,
                            seller_id: p.user_id,
                            seller_name: sellerName,
                            emoji: p.emoji || '📦',
                            shipping: p.shipping || 'Standard',
                            out_of_stock: p.out_of_stock || false,
                            stock_quantity: p.stock_quantity || 1
                        }
                    }]);
                } catch (err) {
                    console.error('Exception in Buy Now loadData:', err);
                }
            } else if (orderId) {
                // Resume Pending Order Flow
                try {
                    console.log('Resuming pending order:', orderId);
                    const { data: orderItems, error: itemsError } = await supabase
                        .from('order_items' as any)
                        .select('*, products(*)')
                        .eq('order_id', orderId);

                    if (itemsError || !orderItems) {
                        console.error('Error fetching order items:', itemsError);
                        setLoading(false);
                        return;
                    }

                    // Map to CartItem format
                    const mappedItems = orderItems.map((item: any) => {
                        const p = item.products;
                        const priceNum = typeof p.price === 'string'
                            ? parseFloat((p.price as string).replace('$', ''))
                            : p.price;

                        const discount2 = p.discount_percentage || 0;
                        const effectivePrice2 = discount2 > 0 ? priceNum * (1 - discount2 / 100) : priceNum;
                        return {
                            id: item.id,
                            product_id: item.product_id,
                            user_id: user.id,
                            quantity: item.quantity,
                            created_at: item.created_at || new Date().toISOString(),
                            product: {
                                id: p.id,
                                name: p.name,
                                price: effectivePrice2,
                                image_url: p.image_url || undefined,
                                seller_id: p.user_id,
                                seller_name: 'Seller',
                                emoji: p.emoji || '📦',
                                shipping: p.shipping || 'Standard',
                                out_of_stock: p.out_of_stock || false,
                                stock_quantity: p.stock_quantity || 1
                            }
                        } as CartItem;
                    });

                    setCartItems(mappedItems);
                } catch (err) {
                    console.error('Exception in Resume Order loadData:', err);
                }
            } else {
                const items = await fetchCart(user.id);
                setCartItems(items);
            }

            // Prefill form data if available 
            const { data: profile, error: profileError } = await supabase.from('profiles')
                .select('full_name, saved_address, payment_methods')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Error loading profile:', profileError);
            }

            console.log('Profile query result:', { profile, error: profileError });

            if (user.email) setEmail(user.email);

            if (profile?.full_name) {
                const names = profile.full_name.split(' ');
                setFirstName(names[0]);
                if (names.length > 1) setLastName(names.slice(1).join(' '));
            }

            // Load saved address if available
            if (profile?.saved_address) {
                const rawAddr = profile.saved_address as any;
                console.log('Raw saved_address from DB:', rawAddr);
                // Handle legacy single object or new array
                let addrs: Address[] = [];
                if (Array.isArray(rawAddr)) {
                    addrs = rawAddr;
                } else if (rawAddr.line1) {
                    addrs = [rawAddr];
                }

                console.log('Parsed addresses:', addrs);
                setSavedAddresses(addrs);

                // Pre-select the first one if available
                if (addrs.length > 0) {
                    fillAddressForm(addrs[0]);
                    setSelectedAddressIndex(0);
                }
            } else {
                console.log('No saved_address found in profile');
            }

            // Load saved payment info if available (partial)
            if (profile?.payment_methods) {
                const pm = profile.payment_methods as any;
                if (pm.cardHolder) setCardHolderName(pm.cardHolder);
            }

            // Log successful load for debugging
            console.log('Profile loaded:', profile);

            // CHECKOUT DRAFT (Local Persistence) - Overrides profile if exists
            try {
                const draftJson = await AsyncStorage.getItem('checkout_draft');
                if (draftJson) {
                    const draft = JSON.parse(draftJson);
                    if (draft.email) setEmail(draft.email);
                    if (draft.firstName) setFirstName(draft.firstName);
                    if (draft.lastName) setLastName(draft.lastName);
                    if (draft.address1) setAddress1(draft.address1);
                    if (draft.address2) setAddress2(draft.address2);
                    if (draft.city) setCity(draft.city);
                    if (draft.zipCode) setZipCode(draft.zipCode);
                    if (draft.country) setCountry(draft.country);
                    if (draft.phone) setPhone(draft.phone);
                    if (draft.shippingMethod) setShippingMethod(draft.shippingMethod);
                    // Payment - only restore if not empty
                    if (draft.cardHolderName) setCardHolderName(draft.cardHolderName);
                    if (draft.cardNumber) setCardNumber(draft.cardNumber);
                    if (draft.cardExpiry) setCardExpiry(draft.cardExpiry);
                }
            } catch (e) {
                console.log('Failed to load draft', e);
            }

            setLoading(false);
        };
        loadData();
    }, [user, productId, paramQuantity, orderId]);

    // Switch Payment Method if Country Changes (P24 only for Poland)
    useEffect(() => {
        if (country !== 'Poland' && selectedPaymentMethod === 'p24') {
            setSelectedPaymentMethod('card');
        }
    }, [country]);

    // ─── Fetch Seller Shipping Config & Detect Zone ───
    useEffect(() => {
        const fetchSellerShipping = async () => {
            if (cartItems.length === 0) return;

            // Get the first seller's ID (MVP: single-seller cart)
            const sellerId = cartItems[0]?.product?.seller_id;
            if (!sellerId || sellerId === 'system') return;

            try {
                const { data: profile, error } = await supabase
                    .from('profiles' as any)
                    .select('shipping_settings')
                    .eq('id', sellerId)
                    .single();

                if (!error && (profile as any)?.shipping_settings) {
                    const config = (profile as any).shipping_settings as SellerShippingConfig;
                    setSellerShipping(config);

                    // Auto-select first enabled carrier
                    const enabledCarriers = getEnabledCarriers(config);
                    if (enabledCarriers.length > 0 && !selectedCarrier) {
                        setSelectedCarrier(enabledCarriers[0]);
                        setShippingMethod('carrier');
                    }
                }
            } catch (err) {
                console.error('Error fetching seller shipping config:', err);
            }
        };

        fetchSellerShipping();
    }, [cartItems]);

    // ─── Zone Detection (when country or seller changes) ───
    useEffect(() => {
        if (!country || !sellerShipping) return;
        const zone = detectShippingZone(sellerShipping.origin_country, country);
        setShippingZone(zone);
    }, [country, sellerShipping]);

    // ─── Weight Calculation ───
    useEffect(() => {
        if (cartItems.length === 0) return;

        // Fetch weight tiers for all products
        const fetchWeights = async () => {
            const productIds = cartItems.map(item => item.product_id);
            const { data: products } = await supabase
                .from('products')
                .select('id, weight_tier')
                .in('id', productIds);

            let totalGrams = 0;
            let maxTier: WeightTier = 'small';
            const tierOrder: WeightTier[] = ['small', 'medium', 'large'];

            cartItems.forEach(item => {
                const product = products?.find((p: any) => p.id === item.product_id);
                const tier = (product?.weight_tier as WeightTier) || 'medium';
                totalGrams += WEIGHT_TIER_GRAMS[tier] * item.quantity;

                if (tierOrder.indexOf(tier) > tierOrder.indexOf(maxTier)) {
                    maxTier = tier;
                }
            });

            setTotalWeightGrams(totalGrams);
            setCartWeightTier(maxTier); // Use the largest tier in cart for pricing
        };

        fetchWeights();
    }, [cartItems]);

    // Auto-Save Draft to AsyncStorage
    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                const draft = {
                    email, firstName, lastName, address1, address2,
                    city, zipCode, country, phone, shippingMethod,
                    cardHolderName, cardNumber, cardExpiry
                };
                await AsyncStorage.setItem('checkout_draft', JSON.stringify(draft));
            } catch (e) {
                // ignore
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeout);
    }, [email, firstName, lastName, address1, address2, city, zipCode, country, phone, shippingMethod, cardHolderName, cardNumber, cardExpiry]);

    // Address Management
    const fillAddressForm = (addr: Address) => {
        setFirstName(addr.firstName || '');
        setLastName(addr.lastName || '');
        setAddress1(addr.line1 || '');
        setAddress2(addr.line2 || '');
        setCity(addr.city || '');
        setZipCode(addr.zipCode || '');
        setCountry(addr.country || '');
        setPhone(addr.phone || '');
    };

    const clearAddressForm = () => {
        setFirstName('');
        setLastName('');
        setAddress1('');
        setAddress2('');
        setCity('');
        setZipCode('');
        setCountry('');
        setPhone('');
        setSelectedAddressIndex(null);
    };

    const handleSaveAddress = async () => {
        if (!user) return;
        if (!address1 || !city || !zipCode || !firstName || !lastName) {
            Alert.alert('Missing Fields', 'Please fill in all address fields.');
            return;
        }

        // Limit to 4 addresses
        if (selectedAddressIndex === null && savedAddresses.length >= 4) {
            Alert.alert('Limit Reached', 'You can only save up to 4 addresses. Please delete an old one to add a new address.');
            return;
        }

        const newAddr: Address = {
            firstName, lastName, line1: address1, line2: address2,
            city, zipCode, country, phone,
            label: `${firstName} ${lastName}`
        };

        let updatedList = [...savedAddresses];
        if (selectedAddressIndex !== null && selectedAddressIndex >= 0) {
            // Update existing
            updatedList[selectedAddressIndex] = newAddr;
        } else {
            // Add new
            updatedList.push(newAddr);
        }

        console.log('Saving addresses:', updatedList);

        const { data, error } = await supabase.from('profiles').update({
            saved_address: updatedList as any
        }).eq('id', user.id).select();

        if (error) {
            console.error('Error saving address:', error);
            if (error.message && error.message.includes("Could not find the 'saved_address' column")) {
                Alert.alert('System Error', 'The "saved_address" column is missing in the database. Please contact support or run migrations.');
            } else {
                Alert.alert('Error', `Failed to save address: ${error.message}`);
            }
        } else {
            console.log('Address saved successfully:', data);
            setSavedAddresses(updatedList);
            if (selectedAddressIndex === null) {
                // If we just added a new one, select it
                setSelectedAddressIndex(updatedList.length - 1);
            }
            Alert.alert('Success', 'Address saved successfully.');
        }
    };

    const handleDeleteAddress = async () => {
        if (!user || selectedAddressIndex === null) return;

        const updatedList = savedAddresses.filter((_, i) => i !== selectedAddressIndex);

        const { error } = await supabase.from('profiles').update({
            saved_address: updatedList as any
        }).eq('id', user.id);

        if (error) {
            Alert.alert('Error', 'Failed to delete address.');
        } else {
            setSavedAddresses(updatedList);
            clearAddressForm();
            Alert.alert('Success', 'Address removed.');
        }
    };



    // Total cost calculations 
    const totals = useMemo(() => {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        
        // Use selected carrier price or fallback to old logic
        let shippingCost = 0;
        if (selectedCarrier) {
            shippingCost = getCarrierPrice(selectedCarrier, cartWeightTier);
        } else if (shippingMethod === 'express') {
            shippingCost = 15.00;
        }
        
        const tax = subtotal * 0.10; // 10% Tax

        let discountAmount = 0;
        if (appliedDiscount) {
            const discountableSubtotal = appliedDiscount.seller_id
                ? cartItems
                    .filter(item => item.product.seller_id === appliedDiscount.seller_id)
                    .reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
                : subtotal;

            if (appliedDiscount.discount_type === 'percentage') {
                discountAmount = discountableSubtotal * (appliedDiscount.discount_value / 100);
            } else {
                discountAmount = Math.min(Number(appliedDiscount.discount_value), discountableSubtotal);
            }
        }

        const total = Math.max(0, subtotal + shippingCost + tax - discountAmount);

        return { subtotal, shippingCost, tax, discount: discountAmount, total };
    }, [cartItems, shippingMethod, appliedDiscount, selectedCarrier, cartWeightTier]);

    // Formatters
    const formatCardNumber = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        const truncated = cleaned.slice(0, 16); // Limit to 16 digits
        const groups = truncated.match(/.{1,4}/g) || [];
        setCardNumber(groups.join(' '));
    };

    const formatExpiryDate = (text: string) => {
        // Simple and robust masking for MM/YY
        let cleaned = text.replace(/\D/g, '');

        // 1. Handle auto-prefixing '0' if user types 2-9 as first char
        if (cleaned.length === 1 && parseInt(cleaned) > 1) {
            cleaned = '0' + cleaned;
        }

        // 2. Limit length to 4 digits (MMYY)
        if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);

        // 3. Format with Slash
        // Logic: If we have at least 2 digits, we want "MM/..."
        if (cleaned.length >= 2) {
            const month = parseInt(cleaned.slice(0, 2));
            // If invalid month ( > 12 or 00), handle it strategy?
            // Strategy: Strict blocking. If > 12, just drop the last char (fail to type it)
            if (month > 12 || month === 0) {
                // Valid month check failure.
                // If typing "1[3]", it effectively ignores the 3
                cleaned = cleaned.slice(0, 1);
            } else {
                // Valid month. Add slash.
                setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
                return;
            }
        }

        setCardExpiry(cleaned);
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
                    <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.circleBtn}>
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
    const handleNextStep = async () => {
        if (step === 1) {
            if (!address1 || !city || !zipCode || !firstName || !lastName || !country) {
                Alert.alert('Missing Information', 'Please fill in all required shipping fields');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // Validate payment info
            if (selectedPaymentMethod === 'card') {

                // Use Saved Card if selected
                if (selectedSavedCardId) {
                    setStripePaymentMethodId(selectedSavedCardId);
                    setStep(3);
                    return;
                }

                if (!cardHolderName.trim()) {
                    Alert.alert('Missing Information', 'Please enter cardholder name');
                    return;
                }
                if (!cardDetails?.complete) {
                    Alert.alert('Invalid Card', 'Please enter valid card details');
                    return;
                }

                // Create Payment Method HERE (Before CardField Unmounts!)
                setProcessing(true);
                const pmId = await createStripePaymentMethod();
                setProcessing(false);

                if (!pmId) {
                    // Error is shown in createStripePaymentMethod
                    return;
                }
                setStripePaymentMethodId(pmId);
            }

            // For Apple Pay and Przelewy24, validation happens during payment process
            setStep(3);
        }
    };

    const createStripePaymentMethod = async () => {
        if (selectedPaymentMethod !== 'card') {
            return null;
        }

        try {
            const { paymentMethod, error } = await createPaymentMethod({
                paymentMethodType: 'Card',
                paymentMethodData: {
                    billingDetails: {
                        name: cardHolderName,
                        email: user?.email || '',
                    },
                },
            });

            if (error) {
                console.error('Error creating payment method:', error);
                Alert.alert('Payment Error', error.message);
                return null;
            }

            console.log('Payment method created:', paymentMethod.id);
            return paymentMethod.id;
        } catch (err) {
            console.error('Exception creating payment method:', err);
            Alert.alert('Payment Error', 'Failed to process card details');
            return null;
        }
    };

    const handlePlaceOrder = async () => {
        if (!user) return;
        setProcessing(true);

        try {
            // 1. Get Payment Method ID
            let paymentMethodId = stripePaymentMethodId;

            // Should already have it from step 2, but just in case check flow
            if (selectedPaymentMethod === 'card' && !paymentMethodId) {
                Alert.alert('Error', 'Card details lost. Please go back and re-enter card.');
                setProcessing(false);
                return;
            }

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

            // Save Address if requested (Appends to list)
            if (saveAddress) {
                const updatedAddresses = [...savedAddresses, shippingAddressObj];
                // Check for duplicates roughly to avoid spam
                const isDuplicate = savedAddresses.some(a =>
                    a.line1 === shippingAddressObj.line1 &&
                    a.zipCode === shippingAddressObj.zipCode
                );

                if (!isDuplicate) {
                    await supabase.from('profiles').update({
                        saved_address: updatedAddresses
                    }).eq('id', user.id);
                }
            }

            // Save Payment Method preference (Token only)
            if (saveCard && paymentMethodId) {
                await supabase.from('profiles').update({
                    payment_methods: {
                        last4: cardDetails?.last4 || 'xxxx',
                        brand: cardDetails?.brand || 'card',
                        stripe_payment_method_id: paymentMethodId
                    }
                }).eq('id', user.id);
            }

            // 2. Create or Retrieve Order
            let orderIdToUse = orderId;
            let order: any;

            if (orderIdToUse) {
                // Determine if we are resuming a pending order
                const { data: existingOrder, error: fetchError } = await supabase
                    .from('orders' as any)
                    .select('*')
                    .eq('id', orderIdToUse)
                    .single();

                if (fetchError || !existingOrder) {
                    // Fallback to creating new if not found (shouldn't happen)
                    orderIdToUse = undefined;
                } else {
                    order = existingOrder;
                    // Update shipping info if changed during resume
                    await supabase.from('orders' as any).update({
                        shipping_address: shippingAddressObj,
                        payment_method: selectedPaymentMethod
                    }).eq('id', orderIdToUse);
                }
            }

            if (!orderIdToUse) {
                const { data: newOrder, error: orderError } = await supabase.from('orders' as any).insert({
                    user_id: user.id,
                    seller_id: cartItems[0]?.product.seller_id || 'system',
                    subtotal: totals.subtotal,
                    shipping_cost: totals.shippingCost,
                    tax: totals.tax,
                    total_amount: totals.total,
                    status: 'pending',
                    shipping_address: shippingAddressObj,
                    payment_method: selectedPaymentMethod,
                    notes: orderNote,
                    carrier_name: selectedCarrier?.name || null,
                    shipping_zone: shippingZone,
                    shipping_method_details: selectedCarrier ? {
                        carrier: selectedCarrier.name,
                        type: selectedCarrier.type,
                        weight_tier: cartWeightTier,
                        total_weight_grams: totalWeightGrams,
                    } : null,
                })
                    .select()
                    .single();

                if (orderError) throw orderError;
                order = newOrder;

                // 3. Create Order Items ONLY for new orders
                const orderItemsData = cartItems.map(item => ({
                    order_id: order.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.product.price,
                    product_name: item.product.name,
                    product_image: item.product.image_url || item.product.images?.[0]
                }));

                const { error: itemsError } = await supabase.from('order_items' as any).insert(orderItemsData);
                if (itemsError) throw itemsError;
            }



            // 4. Process Payment (Wrapper for Edge Function)
            if (selectedPaymentMethod === 'card' && paymentMethodId) {
                console.log('Processing payment...');
                const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
                    body: {
                        amount: totals.total,
                        currency: 'eur',
                        paymentMethodId: paymentMethodId,
                        orderId: order.id,
                        userId: user.id,          // Pass User ID for Customer creation
                        email: user.email,        // Pass User Email
                        saveCard: saveCard,       // Pass Switch State
                        metadata: {
                            customerEmail: user.email,
                            customerName: `${firstName} ${lastName}`,
                        }
                    }
                });

                if (paymentError || !paymentResult?.success) {
                    console.error('Payment failed:', paymentError || paymentResult);
                    // Note: Order status will stay 'pending' (or be handled by backend cleanup)
                    // We cannot update it here due to RLS security
                    setProcessing(false);
                    router.push({
                        pathname: '/payment-failed',
                        params: { reason: paymentResult?.error || 'Your payment could not be processed.' }
                    });
                    return;
                }

                console.log('Payment successful:', paymentResult.paymentIntentId);

                // Update Order Status to Paid immediately upon success AND refresh created_at so it shows as new
                await supabase.from('orders' as any)
                    .update({
                        status: 'paid',
                        payment_intent_id: paymentResult.paymentIntentId,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', order.id);

                // Track Sales for each item
                for (const item of cartItems) {
                    if (item.product_id && item.product.seller_id) {
                        await trackProductSale(item.product_id, item.product.seller_id);
                    }
                }
            }

            // 5. Payment Success
            // Note: Order status is updated by Stripe Webhook
            // We cannot update it here due to RLS security

            // 6. Notifications
            try {
                // To Buyer
                await supabase.from('notifications' as any).insert({
                    user_id: user.id,
                    type: 'order',
                    title: 'Order Confirmed!',
                    body: `Your order for ${cartItems[0]?.product.name}${cartItems.length > 1 ? ` and ${cartItems.length - 1} other items` : ''} has been placed.`,
                    data: { orderId: order.id }
                });

                // To Seller(s)
                const uniqueSellers = Array.from(new Set(cartItems.map(item => item.product.seller_id)));
                for (const sellerId of uniqueSellers) {
                    if (sellerId && sellerId !== 'system') {
                        await supabase.from('notifications' as any).insert({
                            user_id: sellerId,
                            type: 'order',
                            title: 'Item Sold!',
                            body: `Good news! Someone just purchased your item. Time to ship!`,
                            data: { orderId: order.id }
                        });
                    }
                }
            } catch (notifErr) {
                console.error('Error creating post-checkout notifications:', notifErr);
            }

            // 7. Cleanup
            if (!productId) {
                await clearCart(user.id);
            }
            await AsyncStorage.removeItem('checkout_draft');
            await refreshCartCount();

            setStripePaymentMethodId(null); // Clear stored ID
            setProcessing(false);

            // Navigate to Success Screen
            router.replace({
                pathname: '/order-confirmation',
                params: { orderId: order.id }
            });

        } catch (error: any) {
            console.error(error);
            setProcessing(false);
            Alert.alert('Order Failed', error.message || 'Something went wrong.');
        } finally {
            setProcessing(false);
        }
    };

    // Render Components 
    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => step > 1 ? setStep((s) => s - 1 as CheckoutStep) : router.back()} style={styles.circleBtn}>
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

                {/* Saved Addresses Section - Always visible to ensure user knows feature exists */}
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
                                // Extract address components
                                let streetNumber = '';
                                let route = '';
                                let locality = '';
                                let postalCode = '';
                                let countryCode = '';

                                details.address_components.forEach(component => {
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

            {/* Shipping Method */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shipping Method</Text>

                {/* Weight Summary */}
                {totalWeightGrams > 0 && (
                    <View style={styles.weightSummaryRow}>
                        <Text style={styles.weightSummaryLabel}>📦 Estimated Package Weight</Text>
                        <Text style={styles.weightSummaryValue}>{formatWeight(totalWeightGrams)}</Text>
                    </View>
                )}

                {/* Zone Info */}
                {sellerShipping && country && (
                    <View style={[styles.zoneInfoBox, 
                        shippingZone === 'international' && { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }
                    ]}>
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

                {/* Dynamic Carrier Options (from seller config) */}
                {sellerShipping && getEnabledCarriers(sellerShipping).length > 0 ? (
                    <>
                        {getEnabledCarriers(sellerShipping).map((carrier) => {
                            const price = getCarrierPrice(carrier, cartWeightTier);
                            const isSelected = selectedCarrier?.name === carrier.name;
                            return (
                                <TouchableOpacity
                                    key={carrier.name}
                                    style={[styles.radioOption, isSelected && styles.radioOptionSelected]}
                                    onPress={() => {
                                        setSelectedCarrier(carrier);
                                        setShippingMethod('carrier');
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
                                                    carrier.type === 'pickup' ? 'Store Pickup' : 'Home Delivery'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.radioPrice}>
                                        {price === 0 ? 'Free' : `€${price.toFixed(2)}`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </>
                ) : (
                    /* Fallback: Standard/Express (legacy) */
                    <>
                        <TouchableOpacity
                            style={[styles.radioOption, shippingMethod === 'standard' && styles.radioOptionSelected]}
                            onPress={() => { setShippingMethod('standard'); setSelectedCarrier(null); }}
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
                            onPress={() => { setShippingMethod('express'); setSelectedCarrier(null); }}
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
                    </>
                )}

                {/* Locker Selection (when carrier type = locker) */}
                {selectedCarrier?.type === 'locker' && (
                    <View style={styles.lockerSection}>
                        <Text style={styles.lockerTitle}>📮 Select Pickup Point</Text>
                        <Text style={styles.lockerSubtitle}>Search by city or zip code to find available lockers</Text>
                        
                        <View style={styles.lockerSearchRow}>
                            <MagnifyingGlassIcon size={18} color="#9CA3AF" />
                            <TextInput
                                style={styles.lockerSearchInput}
                                placeholder={`Search ${selectedCarrier.name} lockers...`}
                                placeholderTextColor="#9CA3AF"
                                value={lockerSearch}
                                onChangeText={(text: string) => {
                                    setLockerSearch(text);
                                    if (text.length >= 2) {
                                        const prefix = selectedCarrier.name.toUpperCase().slice(0, 3);
                                        const searchCity = city || 'City';
                                        const mockLockers = [
                                            { id: `${prefix}001`, address: `${searchCity}, Main Street 15`, hint: 'Near the shopping centre entrance' },
                                            { id: `${prefix}002`, address: `${searchCity}, Station Road 8`, hint: 'Next to the train station' },
                                            { id: `${prefix}003`, address: `${searchCity}, Market Square 3`, hint: 'By the supermarket parking lot' },
                                            { id: `${prefix}004`, address: `${searchCity}, Park Avenue 22`, hint: 'Opposite the park gate' },
                                            { id: `${prefix}005`, address: `${searchCity}, University Lane 1`, hint: 'Inside the campus lobby' },
                                        ].filter(l =>
                                            l.address.toLowerCase().includes(text.toLowerCase()) ||
                                            l.id.toLowerCase().includes(text.toLowerCase())
                                        );
                                        setLockerResults(mockLockers.length > 0 ? mockLockers : [
                                            { id: `${prefix}001`, address: `${text}, Central Location`, hint: 'Main locker point' },
                                        ]);
                                    } else {
                                        setLockerResults([]);
                                    }
                                }}
                                autoCorrect={false}
                            />
                        </View>

                        {/* Locker Results */}
                        {lockerResults.map((locker) => (
                            <TouchableOpacity
                                key={locker.id}
                                style={[
                                    styles.lockerItem,
                                    selectedLocker?.id === locker.id && styles.lockerItemSelected,
                                ]}
                                onPress={() => setSelectedLocker(locker)}
                            >
                                <View style={styles.lockerItemContent}>
                                    <Text style={styles.lockerId}>{locker.id}</Text>
                                    <Text style={styles.lockerAddress}>{locker.address}</Text>
                                    <Text style={styles.lockerHint}>{locker.hint}</Text>
                                </View>
                                {selectedLocker?.id === locker.id && (
                                    <View style={styles.lockerCheck}>
                                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}

                        {/* Selected Locker Confirmation */}
                        {selectedLocker && (
                            <View style={styles.lockerConfirm}>
                                <Text style={styles.lockerConfirmText}>
                                    ✅ Delivering to: {selectedLocker.id} — {selectedLocker.address}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Seller doesn't ship to this zone */}
                {sellerShipping && country && !sellerShipsToZone(sellerShipping, shippingZone) && (
                    <View style={[styles.zoneInfoBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <Text style={[styles.zoneInfoText, { color: '#DC2626' }]}>
                            ⚠️ This seller doesn't ship to {country}. Please contact them or choose a different address.
                        </Text>
                    </View>
                )}
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
            {/* Payment Method Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Payment Method</Text>

                {/* Apple Pay */}
                <TouchableOpacity
                    style={[styles.radioOption, selectedPaymentMethod === 'apple_pay' && styles.radioOptionSelected]}
                    onPress={() => setSelectedPaymentMethod('apple_pay')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {selectedPaymentMethod === 'apple_pay' && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.paymentIconContainer}>
                                <DevicePhoneMobileIcon size={24} color={'#000'} />
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Apple Pay</Text>
                                <Text style={styles.radioSubtitle}>Finalise payment with Apple Pay</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>



                {/* Przelewy24 (includes Blik) - Show ONLY for Poland */}
                {country === 'Poland' && (
                    <TouchableOpacity
                        style={[styles.radioOption, selectedPaymentMethod === 'p24' && styles.radioOptionSelected]}
                        onPress={() => setSelectedPaymentMethod('p24')}
                    >
                        <View style={styles.radioRow}>
                            <View style={styles.radioCircle}>
                                {selectedPaymentMethod === 'p24' && <View style={styles.radioDot} />}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={[styles.paymentIconContainer, { backgroundColor: '#d4145a', borderColor: '#d4145a' }]}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>P24</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.radioTitle}>Przelewy24</Text>
                                    <Text style={styles.radioSubtitle} numberOfLines={1} ellipsizeMode="tail">Blik, bank transfers & more</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Bank Card (Credit/Debit) */}
                <TouchableOpacity
                    style={[styles.radioOption, selectedPaymentMethod === 'card' && styles.radioOptionSelected]}
                    onPress={() => setSelectedPaymentMethod('card')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {selectedPaymentMethod === 'card' && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.paymentIconContainer}>
                                <CreditCardIcon size={24} color={Colors.neutral[800]} />
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Bank card</Text>
                                <Text style={styles.radioSubtitle}>Use a credit or debit card</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Card Details Form - ONLY SHOW IF CARD SELECTED */}
            {selectedPaymentMethod === 'card' && (
                <View style={[styles.section, { marginTop: -12 }]}>
                    {/* Saved Cards Selection */}
                    {!loadingCards && savedCards && savedCards.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.sectionTitle}>Saved Cards</Text>
                            {savedCards.map((card) => (
                                <TouchableOpacity
                                    key={card.id}
                                    style={[
                                        styles.radioOption,
                                        selectedSavedCardId === card.id && styles.radioOptionSelected,
                                        { marginBottom: 8 }
                                    ]}
                                    onPress={() => {
                                        setSelectedSavedCardId(card.id);
                                        setSaveCard(false);
                                    }}
                                >
                                    <View style={styles.radioRow}>
                                        <View style={styles.radioCircle}>
                                            {selectedSavedCardId === card.id && <View style={styles.radioDot} />}
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <CreditCardIcon size={24} color={Colors.neutral[800]} />
                                            <View>
                                                <Text style={styles.radioTitle}>
                                                    {card.brand.toUpperCase()} {card.last4}
                                                </Text>
                                                <Text style={styles.radioSubtitle}>{card.exp_month}/{card.exp_year}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[styles.radioOption, selectedSavedCardId === null && styles.radioOptionSelected]}
                                onPress={() => setSelectedSavedCardId(null)}
                            >
                                <View style={styles.radioRow}>
                                    <View style={styles.radioCircle}>
                                        {selectedSavedCardId === null && <View style={styles.radioDot} />}
                                    </View>
                                    <Text style={styles.radioTitle}>Use a new card</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedSavedCardId === null && (
                        <View style={styles.cardInputContainer}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.sectionTitle}>Card Details</Text>
                                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                    {/* Visa Logo */}
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff' }]}>
                                        <Text style={{ color: '#1A1F71', fontSize: 10, fontWeight: '700', fontStyle: 'italic' }}>VISA</Text>
                                    </View>
                                    {/* Mastercard Logo */}
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff', flexDirection: 'row', paddingHorizontal: 4 }]}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5F00', marginRight: -2 }} />
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F79E1B' }} />
                                    </View>
                                    {/* Maestro Logo */}
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff', flexDirection: 'row', paddingHorizontal: 4 }]}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0099DF', marginRight: -2 }} />
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CC0000' }} />
                                    </View>
                                </View>
                            </View>


                            {/* Stripe CardField - Secure PCI-compliant card input */}
                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>Card Information</Text>
                                <CardField
                                    postalCodeEnabled={false}
                                    placeholders={{
                                        number: '4242 4242 4242 4242',
                                        expiration: 'MM/YY',
                                        cvc: 'CVC',
                                    }}
                                    cardStyle={{
                                        backgroundColor: '#FFFFFF',
                                        textColor: Colors.text.primary,
                                        borderColor: Colors.neutral[300],
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        fontSize: 16,
                                    }}
                                    style={{
                                        width: '100%',
                                        height: 50,
                                        marginTop: 8,
                                    }}
                                    onCardChange={(details) => {
                                        setCardDetails(details);
                                        console.log('Card complete:', details.complete);
                                    }}
                                />
                            </View>

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

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' }}>
                                <Text style={{ ...styles.formLabel, marginBottom: 0 }}>Save for future purchases</Text>
                                <Switch
                                    value={saveCard}
                                    onValueChange={setSaveCard}
                                    trackColor={{ false: Colors.neutral[200], true: Colors.success[500] }}
                                    thumbColor={'#FFFFFF'}
                                />
                            </View>



                            <View style={styles.secureBadge}>
                                <LockClosedIcon size={12} color={Colors.success[700]} />
                                <Text style={styles.secureText}>Payments are secure and encrypted</Text>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );

    const handleApplyCoupon = async () => {
        if (!promoCode) return;
        setCheckingCoupon(true);
        try {
            const { data, error } = await supabase
                .from('coupons' as any)
                .select('*')
                .eq('code', promoCode.toUpperCase())
                .eq('is_active', true)
                .single();

            if (error || !data) {
                Alert.alert('Invalid Coupon', 'This code does not exist or has expired.');
                setAppliedDiscount(null);
                setCheckingCoupon(false);
                return;
            }

            const couponData = data as any;

            // Verify coupon belongs to a seller whose items are in the cart
            const cartSellerIds = cartItems.map(item => item.product.seller_id);
            if (couponData.seller_id && !cartSellerIds.includes(couponData.seller_id)) {
                Alert.alert('Invalid Coupon', 'This coupon doesn\'t apply to items in your cart.');
                setAppliedDiscount(null);
                setCheckingCoupon(false);
                return;
            }

            setAppliedDiscount(couponData);
            Alert.alert('Success', `Coupon applied: ${couponData.code}`);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to apply coupon.');
        }
        setCheckingCoupon(false);
    };

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

            {/* Promo Code */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Discount Code</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChangeText={(text) => setPromoCode(text.toUpperCase())}
                        autoCapitalize="characters"
                    />
                    <TouchableOpacity
                        style={{ backgroundColor: Colors.primary[500], padding: 12, borderRadius: 8 }}
                        onPress={handleApplyCoupon}
                        disabled={checkingCoupon}
                    >
                        {checkingCoupon ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Apply</Text>}
                    </TouchableOpacity>
                </View>
                {appliedDiscount && (
                    <Text style={{ color: Colors.success[500], marginTop: 4, fontWeight: '600' }}>
                        Coupon applied: {appliedDiscount.code}
                    </Text>
                )}
            </View>

            {/* Order Totals */}
            <View style={styles.section}>
                <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Subtotal</Text>
                    <Text style={styles.costValue}>${totals.subtotal.toFixed(2)}</Text>
                </View>
                {appliedDiscount && (
                    <View style={styles.costRow}>
                        <Text style={[styles.costLabel, { color: Colors.success[500] }]}>Discount</Text>
                        <Text style={[styles.costValue, { color: Colors.success[500] }]}>- ${totals.discount.toFixed(2)}</Text>
                    </View>
                )}
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

    if (cartItems.length === 0 && !processing && !productId) {
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

                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
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
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
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
        justifyContent: 'space-between', // Distribute evenly
        paddingHorizontal: 24, // Add some padding
        marginBottom: 8,
    },
    progressText: {
        fontSize: 15, // Bigger font
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
        height: 4, // Slightly thicker
        backgroundColor: Colors.neutral[200],
        marginHorizontal: 24, // Match text container padding
        borderRadius: 2,
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
    paymentIconContainer: {
        width: 40,
        height: 28,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    cardBrandBadge: {
        width: 20,
        height: 12,
        borderRadius: 2,
    },
    cardBrandLogo: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 32,
        height: 20,
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
    savedAddressCard: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        backgroundColor: '#fff',
        minWidth: 100,
        alignItems: 'flex-start',
    },
    savedAddressCardSelected: {
        borderColor: Colors.primary[500],
        backgroundColor: Colors.primary[50],
    },
    savedAddressText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    savedAddressTextSelected: {
        color: Colors.primary[700],
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
    },
    actionButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Shipping Zone & Weight Styles
    weightSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    weightSummaryLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    weightSummaryValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    zoneInfoBox: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    zoneInfoText: {
        fontSize: 13,
        color: '#166534',
        lineHeight: 18,
    },

    // Locker Selection Styles
    lockerSection: {
        marginTop: 12,
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    lockerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    lockerSubtitle: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 12,
    },
    lockerSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
    },
    lockerSearchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: '#111827',
    },
    lockerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        marginBottom: 6,
    },
    lockerItemSelected: {
        borderColor: Colors.primary[500],
        backgroundColor: Colors.primary[50],
    },
    lockerItemContent: {
        flex: 1,
    },
    lockerId: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    lockerAddress: {
        fontSize: 13,
        color: '#4B5563',
        marginTop: 2,
    },
    lockerHint: {
        fontSize: 11,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 2,
    },
    lockerCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockerConfirm: {
        marginTop: 8,
        padding: 10,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    lockerConfirmText: {
        fontSize: 13,
        color: '#166534',
        fontWeight: '500',
    },
});

export default Checkout;