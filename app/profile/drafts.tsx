import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeftIcon, DocumentTextIcon, TrashIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUserDrafts, deleteListing } from '../../lib/services/productService';

const DraftsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [drafts, setDrafts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadDrafts = async () => {
        if (!user) return;
        try {
            const data = await fetchUserDrafts(user.id);
            setDrafts(data);
        } catch (error) {
            console.error('Error loading drafts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDrafts();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadDrafts();
    };

    const handleDeleteDraft = async (id: string) => {
        Alert.alert(
            'Delete Draft',
            'Are you sure you want to delete this draft?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteListing(id);
                            loadDrafts();
                        } catch (error) {
                            console.error('Error deleting draft:', error);
                            Alert.alert('Error', 'Could not delete draft.');
                        }
                    }
                }
            ]
        );
    };

    const renderDraftItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.draftCard}
            onPress={() => router.push({ pathname: '/profile/edit-listing', params: { draftId: item.id, type: 'draft' } } as any)}
        >
            <View style={styles.imageContainer}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.draftImage} />
                ) : (
                    <View style={styles.placeholderImage}>
                        <DocumentTextIcon size={32} color={Colors.neutral[300]} />
                    </View>
                )}
            </View>
            <View style={styles.draftInfo}>
                <Text style={styles.draftTitle} numberOfLines={1}>
                    {item.name || 'Untitled Draft'}
                </Text>
                <Text style={styles.draftPrice}>{item.price}</Text>
                <Text style={styles.draftDate}>
                    Saved {new Date(item.full_data.created_at).toLocaleDateString()}
                </Text>
            </View>
            <View style={styles.draftActions}>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDraft(item.id)}
                >
                    <TrashIcon size={18} color={Colors.danger[500]} />
                    <Text style={styles.deleteActionText}>Delete</Text>
                </TouchableOpacity>
                <View style={styles.resumeBadge}>
                    <Text style={styles.resumeText}>Resume</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Drafts</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={drafts}
                renderItem={renderDraftItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <DocumentTextIcon size={64} color={Colors.neutral[200]} />
                        <Text style={styles.emptyTitle}>No drafts yet</Text>
                        <Text style={styles.emptySub}>Start a new listing and save it as a draft to see it here.</Text>
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => router.push('/profile/create-listing' as any)}
                        >
                            <Text style={styles.createBtnText}>Create Listing</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    draftCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    imageContainer: {
        width: 70,
        height: 70,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    draftImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    draftInfo: {
        flex: 1,
        marginLeft: 12,
    },
    draftTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    draftPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[600],
        marginBottom: 4,
    },
    draftDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    resumeBadge: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    resumeText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary[600],
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        marginRight: 8,
    },
    deleteActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.danger[600],
        marginLeft: 4,
    },
    draftActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    createBtn: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DraftsScreen;
