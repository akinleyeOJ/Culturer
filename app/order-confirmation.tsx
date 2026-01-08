import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircleIcon } from 'react-native-heroicons/solid';
import { HomeIcon, ShoppingBagIcon } from 'react-native-heroicons/outline';
import { Colors } from '../constants/color';

export default function OrderConfirmation() {
    const router = useRouter();
    const { orderId } = useLocalSearchParams();

    // Prevent back button from going back to checkout
    useEffect(() => {
        const backAction = () => {
            router.replace('/(tabs)/Home');
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Success Animation Area */}
                <View style={styles.successHeader}>
                    <View style={styles.iconContainer}>
                        <CheckCircleIcon size={120} color={Colors.success[500]} />
                    </View>
                    <Text style={styles.title}>Order Placed!</Text>
                    <Text style={styles.subtitle}>
                        Thank you for your purchase. Your order has been confirmed
                    </Text>
                    {orderId && (
                        <Text style={styles.orderId}>Order #{String(orderId).slice(0, 8).toUpperCase()}</Text>
                    )}
                </View>

                {/* Info Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>What happens next?</Text>
                    <View style={styles.step}>
                        <View style={styles.stepDot} />
                        <Text style={styles.stepText}>We sent a confirmation email to you.</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.stepDot} />
                        <Text style={styles.stepText}>The seller will prepare your package.</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.stepDot} />
                        <Text style={styles.stepText}>You'll be notified when it ships!</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/(tabs)/Home')}
                >
                    <HomeIcon size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Return Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.replace('/(tabs)/Browse')}
                >
                    <ShoppingBagIcon size={20} color={Colors.primary[600]} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 100,
    },
    successHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        marginBottom: 24,
        shadowColor: Colors.success[500],
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    orderId: {
        marginTop: 16,
        fontSize: 14,
        fontWeight: '600',
        color: Colors.neutral[500],
        backgroundColor: Colors.neutral[100],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        overflow: 'hidden',
    },
    card: {
        width: '100%',
        backgroundColor: Colors.neutral[50],
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.success[500],
        marginRight: 12,
    },
    stepText: {
        fontSize: 15,
        color: Colors.text.secondary,
    },
    footer: {
        padding: 24,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[100],
    },
    primaryButton: {
        backgroundColor: Colors.primary[500],
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: Colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButton: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.primary[200],
    },
    secondaryButtonText: {
        color: Colors.primary[600],
        fontWeight: '600',
        fontSize: 16,
    },
});
