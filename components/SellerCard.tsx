import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../constants/color';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface SellerCardProps {
    sellerName: string;
    sellerAvatar?: string;
    sellerRating: number;
    sellerReviewsCount: number;
    sellerLocation?: string;
    onVisitShop: () => void;
}

export const SellerCard = ({
    sellerName,
    sellerAvatar,
    sellerRating,
    sellerReviewsCount,
    sellerLocation,
    onVisitShop,
}: SellerCardProps) => {
    const renderStars = (rating: number) => {
        return '⭐'.repeat(Math.floor(rating));
    };

    return (
        <View style={styles.container}>
            <View style={styles.sellerInfo}>
                {sellerAvatar ? (
                    <Image source={{ uri: sellerAvatar }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <FontAwesome name="user" size={20} color={Colors.neutral[500]} />
                    </View>
                )}

                <View style={styles.details}>
                    <Text style={styles.name}>{sellerName}</Text>
                    <View style={styles.ratingRow}>
                        <Text style={styles.stars}>{renderStars(sellerRating)}</Text>
                        <Text style={styles.reviewCount}>
                            {sellerRating.toFixed(1)} · {sellerReviewsCount} reviews
                        </Text>
                    </View>
                    {sellerLocation && (
                        <View style={styles.locationRow}>
                            <FontAwesome name="map-marker" size={12} color={Colors.neutral[500]} />
                            <Text style={styles.location}>{sellerLocation}</Text>
                        </View>
                    )}
                </View>
            </View>

            <TouchableOpacity style={styles.visitButton} onPress={onVisitShop}>
                <Text style={styles.visitButtonText}>Visit shop</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sellerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: Colors.neutral[200],
        justifyContent: 'center',
        alignItems: 'center',
    },
    details: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    stars: {
        fontSize: 10,
        marginRight: 4,
    },
    reviewCount: {
        fontSize: 12,
        color: Colors.neutral[600],
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    location: {
        fontSize: 12,
        color: Colors.neutral[500],
    },
    visitButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primary[500],
    },
    visitButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[500],
    },
});
