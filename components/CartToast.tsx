import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircleIcon, ShoppingBagIcon } from 'react-native-heroicons/solid';
import { Colors } from '../constants/color';

interface ToastProps {
    visible: boolean;
    message: string;
    onHide: () => void;
    onViewCart?: () => void;
    actionLabel?: string;
    duration?: number;
}

export const CartToast = ({
    visible,
    message,
    onHide,
    onViewCart,
    actionLabel = "View Cart",
    duration = 3000
}: ToastProps) => {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        if (visible) {
            // Slide down
            Animated.spring(slideAnim, {
                toValue: insets.top + 10,
                useNativeDriver: true,
                friction: 8,
                tension: 40
            }).start();

            // Auto hide
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                hide();
            }, duration);
        } else {
            hide();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [visible]);

    const hide = () => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true
        }).start(() => {
            if (visible) onHide();
        });
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    <View style={styles.iconContainer}>
                        <CheckCircleIcon size={24} color={Colors.primary[500]} />
                    </View>
                    <Text style={styles.message}>{message}</Text>
                </View>

                {onViewCart && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={onViewCart}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>{actionLabel}</Text>
                        <ShoppingBagIcon size={16} color={Colors.primary[700]} />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 9999,
        backgroundColor: '#1F2937', // Dark grey background
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingVertical: 14,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    iconContainer: {
        marginRight: 12,
    },
    message: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    button: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100, // Pill shape
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buttonText: {
        color: Colors.primary[700],
        fontSize: 12,
        fontWeight: '700',
    }
});
