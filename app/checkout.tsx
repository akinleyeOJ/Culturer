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

// Delivery Form 
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
         
    </View>
  </View>

);


const styles = StyleSheet.create({
    
});

export default Checkout;
