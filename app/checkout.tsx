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
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

// Types 
type CheckoutStep = 1 | 2 | 3;
type ShippingMethod = 'standard' | 'express';

const Checkout = () => {
    const router = useRouter();
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
    const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
    const [orderNote, setOrderNote] = useState('');

    // Payment State
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');

    // Data Loading 
    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            const items = await fetchCart(user.id);
            setCartItems(items);

            // Prefill form data if available 
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

            if (user.email) setEmail(user.email);

            if (profile?.full_name) {
                const names = profile.full_name.split(' ');
                setFirstName(names[0]);
                if (names.length > 1) setLastName(names.slice(1).join(' '));
            }
            setLoading(false);
        };
        loadData();
    }, [user]);

    // Total cost calculations 
    const totals = useMemo(() => {
        const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const shippingCost = shippingMethod === 'express' ? 15.00 : 0.00;
        const tax = subtotal * 0.10; // 10% Tax
        const total = subtotal + shippingCost + tax;

        return { subtotal, shippingCost, tax, total };
    }, [cartItems, shippingMethod]);

    // Handlers 
    const handleNextStep = () => {
        if (step === 1) {
            if (!address1 || !city || !zipCode || !firstName || !lastName) {
                Alert.alert('Missing Information', 'Please fill in all required shipping fields');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // Validate payment info 
            if (cardNumber.length < 12 || !cardExpiry || cardCvv.length < 3) {
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
            // 1. Create order record
            const { data: order, error: orderError } = await supabase.from('orders').insert({
                user_id: user.id,
                seller_id: cartItems[0]?.product.seller_id || 'system',
                subtotal: totals.subtotal,
                shipping_cost: totals.shippingCost,
                tax: totals.tax, // Changed from tax_rate to tax to match DB schema
                total_amount: totals.total, // Changed to total_amount to match DB schema
                status: 'confirmed',
                shipping_address: {
                    line1: address1,
                    line2: address2,
                    city,
                    zipCode,
                    phone,
                    firstName,
                    lastName,
                },
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
                <View style={styles.cardInputContainer}>
                    <View style={styles.inputWrapper}>
                        <CreditCardIcon color={Colors.neutral[500]} size={20} />
                        <TextInput
                            style={styles.cardInput}
                            placeholder="Card Number"
                            value={cardNumber}
                            onChangeText={setCardNumber}
                            keyboardType="numeric"
                            maxLength={19}
                        />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.inputWrapper, styles.halfInput]}>
                            <TextInput
                                style={styles.cardInput}
                                placeholder="MM/YY"
                                value={cardExpiry}
                                onChangeText={setCardExpiry}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                        </View>
                        <View style={[styles.inputWrapper, styles.halfInput]}>
                            <TextInput
                                style={styles.cardInput}
                                placeholder="CVV"
                                value={cardCvv}
                                onChangeText={setCardCvv}
                                keyboardType="numeric"
                                maxLength={3}
                                secureTextEntry
                            />
                        </View>
                    </View>
                </View>
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
});

export default Checkout;