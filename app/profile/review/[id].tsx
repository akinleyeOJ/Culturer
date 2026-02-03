import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeftIcon, StarIcon } from 'react-native-heroicons/solid';
import { StarIcon as StarOutlineIcon } from 'react-native-heroicons/outline';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/color';

const ReviewProductScreen = () => {
    const { id, orderId, productName, productImage, price } = useLocalSearchParams<{
        id: string; // product_id
        orderId: string;
        productName: string;
        productImage: string;
        price: string;
    }>();

    const router = useRouter();
    const { user } = useAuth();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a star rating.');
            return;
        }

        setSubmitting(true);
        try {
            if (!user) throw new Error('Not authenticated');

            // 1. Insert Review
            const { error: reviewError } = await supabase
                .from('reviews' as any)
                .insert({
                    user_id: user.id,
                    product_id: id,
                    rating: rating,
                    comment: comment,
                });

            if (reviewError) throw reviewError;

            // 2. Update Product Stats (Naive approach: Backend triggers usually handle this, but if not...)
            // Ideally we call a database function. For now, we'll just insert and assume DB handles aggregations or triggers.
            // If you need manual update:
            // Fetch current stats -> calc new avg -> update. 
            // Better: Let's assume the backend or a scheduled job handles it, OR we can implement a quick incrementrpc.
            // For now, simple insert is safest.

            Alert.alert('Review Submitted', 'Thank you for your feedback!', [
                { text: 'OK', onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error('Error submitting review:', error);
            if (error.code === '23505') { // Unique violation
                Alert.alert('Already Reviewed', 'You have already reviewed this product.');
            } else {
                Alert.alert('Error', 'Failed to submit review. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Write a Review</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Product Summary */}
                <View style={styles.productCard}>
                    <Image
                        source={{ uri: productImage || 'https://via.placeholder.com/100' }}
                        style={styles.productImage}
                    />
                    <View style={styles.productInfo}>
                        <Text style={styles.productName}>{productName}</Text>
                        <Text style={styles.productPrice}>${Number(price).toFixed(2)}</Text>
                    </View>
                </View>

                {/* Rating Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Rate this product</Text>
                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => setRating(star)}
                                style={styles.starButton}
                            >
                                {rating >= star ? (
                                    <StarIcon size={36} color="#F59E0B" />
                                ) : (
                                    <StarOutlineIcon size={36} color="#D1D5DB" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Comment Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Your Experience</Text>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="What did you like or dislike? How was the quality?"
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                        value={comment}
                        onChangeText={setComment}
                    />
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.disabledButton]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        padding: 24,
    },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 32,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
    },
    productInfo: {
        marginLeft: 16,
        flex: 1,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 14,
        color: '#6B7280',
    },
    section: {
        marginBottom: 32,
    },
    label: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 16,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    starButton: {
        padding: 4,
    },
    commentInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        minHeight: 120,
        color: '#111827',
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    submitButton: {
        backgroundColor: Colors.primary[500],
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
});

export default ReviewProductScreen;
