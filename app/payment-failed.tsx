import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { XCircleIcon } from 'react-native-heroicons/solid';
import { ArrowPathIcon, LifebuoyIcon } from 'react-native-heroicons/outline';
import { Colors } from '../constants/color';

export default function PaymentFailed() {
    const router = useRouter();
    const { reason } = useLocalSearchParams();

    // Handle back button
    useEffect(() => {
        const backAction = () => {
            router.back(); // Go back to checkout to try again
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

                {/* Failure Animation Area */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <XCircleIcon size={100} color={Colors.danger[500]} />
                    </View>
                    <Text style={styles.title}>Payment Failed</Text>
                    <Text style={styles.subtitle}>
                        {reason || "We couldn't process your payment. Please try again."}
                    </Text>
                </View>

                {/* Info Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Common Solutions</Text>
                    <View style={styles.step}>
                        <View style={styles.bullet} />
                        <Text style={styles.stepText}>Check if your card details are correct.</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.bullet} />
                        <Text style={styles.stepText}>Ensure you have sufficient funds.</Text>
                    </View>
                    <View style={styles.step}>
                        <View style={styles.bullet} />
                        <Text style={styles.stepText}>Try a different payment method.</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.back()}
                >
                    <ArrowPathIcon size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => console.log('Support')}
                >
                    <LifebuoyIcon size={20} color={Colors.neutral[600]} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryButtonText}>Contact Support</Text>
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
        paddingTop: 80,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        marginBottom: 24,
        shadowColor: Colors.danger[500],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 28,
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
        paddingHorizontal: 20,
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
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.danger[400],
        marginRight: 12,
    },
    stepText: {
        fontSize: 14,
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
        borderColor: Colors.neutral[200],
    },
    secondaryButtonText: {
        color: Colors.neutral[700],
        fontWeight: '600',
        fontSize: 16,
    },
});
