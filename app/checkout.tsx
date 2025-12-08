import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/color';
import CustomButton from '../components/Button';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Checkout = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { refreshCartCount } = useCart(); // You might need a clearCart function here later
    
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePlaceOrder = async () => {
        if (!user) return;
        if (!address || !city) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);

        try {
            // 1. Fetch current cart items
            const { data: cartItems, error: cartError } = await supabase
                .from('cart')
                .select('*, product:products(*)')
                .eq('user_id', user.id);

            if (cartError || !cartItems?.length) throw new Error("Cart is empty or failed to load");

            // 2. Calculate totals (simplified)
            const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            const total = subtotal * 1.1; // +10% tax

            // 3. Create Order Record (simplified - normally you'd group by seller)
            // Note: This matches your cart_schema.sql orders table
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    seller_id: cartItems[0].product.seller_id, // Simplified: assuming 1 seller for now
                    subtotal: subtotal,
                    total_amount: total,
                    status: 'pending',
                    shipping_address: { address, city }
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 4. Move items to order_items and clear cart
            // (You would implement this transaction logic here)

            Alert.alert('Success', 'Order placed successfully!');
            router.replace('/(tabs)/Home');
            
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Checkout</Text>
                
                <View style={styles.section}>
                    <Text style={styles.label}>Shipping Address</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Street Address" 
                        value={address}
                        onChangeText={setAddress}
                    />
                    <TextInput 
                        style={styles.input} 
                        placeholder="City" 
                        value={city}
                        onChangeText={setCity}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Payment</Text>
                    <View style={styles.placeholder}>
                        <Text style={{color: Colors.text.secondary}}>Stripe Integration Coming Soon</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <CustomButton 
                    title={loading ? "Processing..." : "Place Order"} 
                    onPress={handlePlaceOrder}
                    disabled={loading}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    section: { marginBottom: 24 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    input: { 
        borderWidth: 1, 
        borderColor: Colors.neutral[300], 
        borderRadius: 8, 
        padding: 12, 
        marginBottom: 12 
    },
    placeholder: {
        padding: 20,
        backgroundColor: Colors.neutral[100],
        borderRadius: 8,
        alignItems: 'center'
    },
    footer: { padding: 20, borderTopWidth: 1, borderColor: Colors.neutral[200] }
});

export default Checkout;