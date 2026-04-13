import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/color';
import { type CartItem } from '../../lib/services/cartService';
import { type CarrierConfig } from '../../lib/shippingUtils';

interface ReviewStepProps {
    styles: any;
    cartItems: CartItem[];
    promoCode: string;
    setPromoCode: (value: string) => void;
    handleApplyCoupon: () => void;
    checkingCoupon: boolean;
    appliedDiscount: any;
    totals: {
        subtotal: number;
        shippingCost: number;
        tax: number;
        discount: number;
        total: number;
    };
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    selectedCarrier: CarrierConfig | null;
    cardNumber: string;
    selectedSavedCardId: string | null;
    savedCards: any[];
    onEditDelivery: () => void;
    onEditPayment: () => void;
}

export function ReviewStep({
    styles,
    cartItems,
    promoCode,
    setPromoCode,
    handleApplyCoupon,
    checkingCoupon,
    appliedDiscount,
    totals,
    firstName,
    lastName,
    address1,
    city,
    selectedCarrier,
    cardNumber,
    selectedSavedCardId,
    savedCards,
    onEditDelivery,
    onEditPayment,
}: ReviewStepProps) {
    const selectedSavedCard = selectedSavedCardId
        ? savedCards.find((card) => card.id === selectedSavedCardId)
        : null;

    const shippingMethodLabel = selectedCarrier?.name
        ? selectedCarrier.name
        : 'No shipping selected';

    const paymentLabel = selectedSavedCard
        ? `${selectedSavedCard.brand?.toUpperCase?.() || 'CARD'} ${selectedSavedCard.last4 || ''}`.trim()
        : `Card ending in ${cardNumber.slice(-4) || '****'}`;

    return (
        <View style={styles.stepContainer}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Summary</Text>
                {cartItems.map((item) => (
                    <View key={item.id} style={styles.reviewItem}>
                        <Image
                            source={
                                item.product.image_url
                                    ? { uri: item.product.image_url }
                                    : { uri: "https://via.placeholder.com/60" }
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

            <View style={styles.recapContainer}>
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Ship To</Text>
                        <Text style={styles.recapValue}>{firstName} {lastName}</Text>
                        <Text style={styles.recapValue}>{address1}, {city}</Text>
                    </View>
                    <TouchableOpacity onPress={onEditDelivery}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Method</Text>
                        <Text style={styles.recapValue}>{shippingMethodLabel}</Text>
                    </View>
                    <TouchableOpacity onPress={onEditDelivery}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.recapRow}>
                    <View>
                        <Text style={styles.recapLabel}>Payment</Text>
                        <Text style={styles.recapValue}>{paymentLabel}</Text>
                    </View>
                    <TouchableOpacity onPress={onEditPayment}>
                        <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.termsText}>
                By clicking Place Order, you agree to our Terms & Conditions.
            </Text>
        </View>
    );
}
