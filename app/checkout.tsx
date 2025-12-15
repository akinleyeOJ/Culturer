import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useRouter } from 'expo-router';
import { Colors } from '../constants/color';
import CustomButton from '../components/Button';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchCart, clearCart, CartItem } from '@/lib/services/cartService';
import { LockClosedIcon, ChevronLeftIcon, CheckCircleIcon, CreditCardIcon } from 'react-native-heroicons/outline';

// Types 
type CheckoutStep = 1 | 2 | 3;
type ShippingMethod = 'standard' | 'express';

const Checkout = () => {
   const router = useRouter()
   const { user } = useAuth()
   const { refreshCartCount } = useCart()

   // State management 
   const [step, setStep] = useState<CheckoutStep>(1)
   const [loading, setLoading] = useState(true)
   const [processing, setProcessing] = useState(false)

   // Data 
   const [cartItems, setCartItems] = useState<CartItem[]>([])

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

   // Payment State
   const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
   const [cardNumber, setCardNumber] = useState('');
   const [cardExpiry, setCardExpiry] = useState('');
   const [cardCvv, setCardCvv] = useState('');
};

// Data Loading 
useEffect(() => {
   const loadData = async () => {
      if (!user) return;
      const items = await fetchCart(user.id);
      setCartItems(items);

      // prefill form data if available 
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

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
    const subtotal = cartItems.reduce((sum, items) => sum + (items.product.price * items.quantity), 0);
    const shippingCost = shippingMethod === 'express' ? 15:00 : 0:00;
    //tax calc
    const taxRate = subtotal * 0.10;
    const total = subtotal + shippingCost + taxRate;

    return { subtotal, shippingCost, taxRate, total };
}, [cartItems, shippingMethod]);

// Handlers 
const handleNextStep = () => {
   if (step === 1) {
      if (!address1 || ! city || !zip || !firstName || !lastName) {
        Alert.alert('Missing Information', 'Please fill in all required shipping fields');
        return;
      }
      setStep(2);
    } else if (step === 2 ){
        //validate payment info 
        if (cardNumber.length < 12 || !cardExpiry || cardCvv.length < 3) {
            Alert.alert('Missing Information', 'Please fill in all required payment fields');
            return;
        }
        setStep(3);
    }
}

const handlePlaceOrder = async () => {
    if (!user) return;
    setProcessing(true);
    
    try {
        // 1.create order record
        const { data: order, error: orderError } = await supabase.from('orders').insert({
           user.id: user.id, 
           seller_id: cartItems[0]?.product.seller_id || 'system',
           subtotal: totals.subtotal,
           shipping_cost: totals.shippingCost,
           tax_rate: totals.taxRate,
           total: totals.total,
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

    // 2.create order items 
    const orderItemsData = cartItmes.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.product.price,
        product_name: item.product.name,
        product_image: item.product.image_url || item.product.image?.[0]
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);   

         if (itemsError) throw itemsError   
    // 3.clear cart
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
       <TouchableOpacity onPress={() => step > 1 ? setStep((s) => s - 1 as CheckoutStep) :router.back()} style={styles.backButton}>
           <ChevronLeftIcon size={24} color={Colors.text.primary} />
       </TouchableOpacity>
       <View style={styles.headerTitleContainer}>
           <Text style={styles.headerTitle}>Checkout</Text>
           <LockClosedIcon size={14} color={Colors.text.secondary} style={{marginLeft: 4}} />
       </View>
       <View style={{ width: 24 }} />
   </View>   
);

const renderProgressBar = () => (
    <View style={styles.progressContainer}>
        <View style={styles.progressTextContainer}>
            <Text style={[styles.progressText, step === 1 && styles.progressTextActive]}>1. Delivery</Text>
            <Text style={styles.progressTextSeperator}>-</Text>
            <Text style={[styles.progressText, step === 2 && styles.progressTextActive]}>2. Payment</Text>
            <Text style={styles.progressTextSeperator}>-</Text>
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
        {/* Customer Information  */}
    <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <TextInput 
                style={styles.formInput}

            />
        <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Full Name</Text>
            <TextInput style={styles.formInput} 
                        placeholder="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
            />
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
                    placeholder="Zip/ Postal Code"
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
                        <Text styles={styles.radioTitle}>Standard Delivery</Text>
                        <Text styles={styles.radioSubtitle}>Est. 3-5 Business Days</Text>
                    </View>
                    {/* Need to setup shipping for free/ using Courier integration. Api maybe */}
                    <Text style={styles.radioPrice}>Free</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.radioOption, shippingMethod === 'express' && styles.radioOptionSelected]}
                onPress={() => setShippingMethod('standard')}
            >
                <View style={styles.radioRow}>
                    <View style={styles.radioCircle}>
                        {shippingMethod === 'express' && <View style={styles.radioDot} />}
                    </View>
                    <View>
                        <Text styles={styles.radioTitle}>Express Delivery</Text>
                        <Text styles={styles.radioSubtitle}>Est. 1-2 Business Days</Text>
                    </View>
                </View>
                {/* Need to setup shipping for free/ using Courier integration. Api maybe */}
                <Text style={styles.radioPrice}>Free</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.radioOption, shippingMethod === 'express' && styles.radioOptionSelected]}
                onPress={() => setShippingMethod('express')}
            >
                <View style={styles.radioRow}>
                    <View style={styles.radioRow}>
                        {shippingMethod === 'express' && <View style={styles.radioDot} />}
                    </View>
                    <View>
                        <Text style={styles.radioTitle}>Express Delivery</Text>
                        <Text style={styles.radioSubtitle}>Est. 1-2 days</Text>
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
                    value={orderNotes}
                    onChangeText={setOrderNotes}
                />
            </View>
        </View>
    );
    {/* Payment Form - Step 2 */}

    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setBillingSameAsShipping(!billingSameAsShipping)}
                >
                    <View style={[styles.checkbox, billingSameAsShipping && StyleSheet.checkboxActive]}>
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
                <View styles={StyleSheet.cardInputContainer}>
                    <View style={StyleSheet.inputWrapper}>
                        <CreditCardIcon color={Colors.neutral[500]} size={20} />
                        <TextInput
                            style={styles.cardInput}
                            placeholder="Card Number"
                            value={cardNumber}
                            onChangeText={setCardNumber}
                            keyboardType="numeric"
                            maxLength={10}
                        />
                    </View>
                    <View style={styles.row}>
                        <View style={[StyleSheet.inputWrapper, StyleSheet.halfInput]}>
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
                <View style={StyleSheet.secureBadge}>
                    <LockClosedIcon size={12} color={Colors.success[700]} />
                    <Text style={styles.secureText}>Payments are secure and encrypted</Text>
                </View>
            </View>
        </View>
    );

    {/* Review Order - Step 3 */}
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
                <Text style={styles.sectionTitle}>Order Totals</Text>
                <View style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>Subtotal</Text>
                    <Text style={styles.reviewItemPrice}>${totals.subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>Shipping</Text>
                    <Text style={styles.reviewItemPrice}>${totals.shippingCost.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>Tax</Text>
                    <Text style={styles.reviewItemPrice}>${totals.taxRate.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>Total</Text>
                    <Text style={styles.reviewItemPrice}>${totals.total.toFixed(2)}</Text>
                </View>
            </View>
        </View>
    );

    

const styles = StyleSheet.create({
    
});

export default Checkout;
