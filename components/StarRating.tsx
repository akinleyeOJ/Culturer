import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StarIcon as StarSolid } from 'react-native-heroicons/solid';
import { StarIcon as StarOutline } from 'react-native-heroicons/outline';
import { View as MaskedView } from 'react-native'; // Placeholder if we needed distinct half-star, but we can simulate or use a library. 
// Since we are using heroicons, we don't have a "Half Star" icon by default. 
// A common trick is to overlay two stars or just map 0-5. 
// For simplicity and performance without extra assets, we will use a logic:
// 4.5 -> 4 Full, 1 Half (simulated or just full if close, but user asked for 4.5 specifically).
// Actually, Heroicons doesn't have half star. 
// I will simulate it by rendering a background gray star and a foreground colored star clipped 50%.

import { Colors } from '../constants/color';

interface StarRatingProps {
    rating: number;
    size?: number;
    color?: string;
    maxStars?: number;
}

export const StarRating = ({
    rating,
    size = 14,
    color = "#F59E0B", // Amber/Gold
    maxStars = 5
}: StarRatingProps) => {

    // Create an array of stars to render
    const stars = [];

    for (let i = 1; i <= maxStars; i++) {
        if (rating >= i) {
            // Full Star
            stars.push(
                <StarSolid key={i} size={size} color={color} />
            );
        } else if (rating >= i - 0.5) {
            // Half Star
            // We simulate half star by stacking
            stars.push(
                <View key={i} style={{ width: size, height: size }}>
                    <View style={{ position: 'absolute', left: 0, top: 0 }}>
                        <StarOutline size={size} color={color} />
                    </View>
                    <View style={{ width: size / 2, overflow: 'hidden', position: 'absolute', left: 0, top: 0 }}>
                        <StarSolid size={size} color={color} />
                    </View>
                </View>
            );
        } else {
            // Empty Star (Outline)
            stars.push(
                <StarOutline key={i} size={size} color={Colors.neutral[400]} />
            );
        }
    }

    return (
        <View style={styles.container}>
            {stars.map((star, index) => (
                <View key={index} style={{ marginRight: 1 }}>
                    {star}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
