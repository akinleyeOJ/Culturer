import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeftIcon, StarIcon, PaperAirplaneIcon } from 'react-native-heroicons/solid';
import { StarIcon as StarOutline } from 'react-native-heroicons/outline';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/color';
import { fetchSellerReviews, replyToReview, ReviewWithDetails } from '../../lib/services/reviewService';

const SellerReviewsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadReviews = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await fetchSellerReviews(user.id);
            setReviews(data);
        } catch (error) {
            console.error('Failed to load reviews:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadReviews();
    }, [loadReviews]);

    const averageRating = reviews.length > 0
        ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
        : '0.0';

    const handleReplySubmit = async (reviewId: string) => {
        if (!replyText.trim()) return;
        setIsSubmitting(true);

        const { success } = await replyToReview(reviewId, replyText.trim());

        if (success) {
            // Optimistically update UI
            setReviews(prev => prev.map(r =>
                r.id === reviewId ? {
                    ...r,
                    seller_reply: replyText.trim(),
                    seller_replied_at: new Date().toISOString()
                } : r
            ));
            setReplyingTo(null);
            setReplyText('');
        } else {
            Alert.alert('Error', 'Failed to post reply. Please try again.');
        }
        setIsSubmitting(false);
    };

    const renderStars = (rating: number) => {
        return (
            <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(star => (
                    star <= rating
                        ? <StarIcon key={star} size={14} color="#F59E0B" />
                        : <StarOutline key={star} size={14} color="#D1D5DB" />
                ))}
            </View>
        );
    };

    const renderReviewItem = ({ item }: { item: ReviewWithDetails }) => {
        const isReplying = replyingTo === item.id;

        return (
            <View style={styles.reviewCard}>
                {/* Header: Product Info & Stars */}
                <View style={styles.cardHeader}>
                    <Image
                        source={{ uri: item.product_image || 'https://via.placeholder.com/40' }}
                        style={styles.productBadge}
                    />
                    <View style={styles.cardHeaderInfo}>
                        <Text style={styles.buyerName}>{item.buyer_name}</Text>
                        <Text style={styles.productName} numberOfLines={1}>For {item.product_name}</Text>
                    </View>
                    <View style={styles.ratingBox}>
                        {renderStars(item.rating)}
                        <Text style={styles.dateText}>
                            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {/* Review Body */}
                <Text style={styles.commentText}>
                    {item.comment || "No written feedback provided."}
                </Text>

                {/* Seller Reply Section */}
                {item.seller_reply ? (
                    <View style={styles.replyBox}>
                        <Text style={styles.replyLabel}>Your Reply</Text>
                        <Text style={styles.replyText}>{item.seller_reply}</Text>
                    </View>
                ) : (
                    <View style={styles.actionRow}>
                        {!isReplying ? (
                            <TouchableOpacity
                                style={styles.replyButton}
                                onPress={() => {
                                    setReplyingTo(item.id);
                                    setReplyText('');
                                }}
                            >
                                <Text style={styles.replyButtonText}>Reply to buyer</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.replyInputContainer}>
                                <TextInput
                                    style={styles.replyInput}
                                    placeholder="Type your response..."
                                    value={replyText}
                                    onChangeText={setReplyText}
                                    multiline
                                    autoFocus
                                    maxLength={500}
                                />
                                <View style={styles.replyActionButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelReplyBtn}
                                        onPress={() => setReplyingTo(null)}
                                        disabled={isSubmitting}
                                    >
                                        <Text style={styles.cancelReplyText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sendReplyBtn, (!replyText.trim() || isSubmitting) && styles.sendReplyBtnDisabled]}
                                        onPress={() => handleReplySubmit(item.id)}
                                        disabled={!replyText.trim() || isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={styles.sendReplyText}>Post Reply</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reviews</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {isLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={Colors.primary[500]} />
                    </View>
                ) : reviews.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <View style={styles.emptyIconCircle}>
                            <StarOutline size={32} color={Colors.text.tertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
                        <Text style={styles.emptySub}>When buyers review your items,{'\n'}they will appear here.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={reviews}
                        keyExtractor={item => item.id}
                        renderItem={renderReviewItem}
                        contentContainerStyle={styles.listContent}
                        ListHeaderComponent={
                            <View style={styles.summaryContainer}>
                                <View style={styles.summaryStat}>
                                    <StarIcon size={32} color="#F59E0B" />
                                    <View style={styles.summaryTextGroup}>
                                        <Text style={styles.summaryValue}>{averageRating}</Text>
                                        <Text style={styles.summaryLabel}>Average Rating</Text>
                                    </View>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryStat}>
                                    <Text style={[styles.summaryValue, { fontSize: 28 }]}>{reviews.length}</Text>
                                    <Text style={styles.summaryLabel}>Total Reviews</Text>
                                </View>
                            </View>
                        }
                    />
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    summaryStat: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    summaryTextGroup: {
        alignItems: 'flex-start',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },
    summaryLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    reviewCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    productBadge: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    cardHeaderInfo: {
        flex: 1,
    },
    buyerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    productName: {
        fontSize: 13,
        color: '#6B7280',
    },
    ratingBox: {
        alignItems: 'flex-end',
    },
    dateText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    commentText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
        marginBottom: 16,
    },
    replyBox: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary[500],
    },
    replyLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary[600],
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    replyText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
    actionRow: {
        marginTop: 4,
    },
    replyButton: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 100,
    },
    replyButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    replyInputContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    replyInput: {
        fontSize: 14,
        color: '#111827',
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    replyActionButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cancelReplyBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    cancelReplyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    sendReplyBtn: {
        backgroundColor: Colors.primary[500],
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    sendReplyBtnDisabled: {
        opacity: 0.5,
    },
    sendReplyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
});

export default SellerReviewsScreen;
