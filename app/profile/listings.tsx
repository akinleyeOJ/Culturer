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
import { ChevronLeftIcon, TagIcon, TrashIcon, PencilSquareIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUserActiveListings, deleteListing } from '../../lib/services/productService';

const ListingsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadListings = async () => {
        if (!user) return;
        try {
            const data = await fetchUserActiveListings(user.id);
            setListings(data);
        } catch (error) {
            console.error('Error loading listings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadListings();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadListings();
    };

    const handleDeleteListing = async (id: string) => {
        Alert.alert(
            'Delete Listing',
            'Are you sure you want to delete this listing? This will remove it from the marketplace.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteListing(id);
                            loadListings();
                        } catch (error) {
                            console.error('Error deleting listing:', error);
                            Alert.alert('Error', 'Could not delete listing.');
                        }
                    }
                }
            ]
        );
    };

    const renderListingItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } } as any)}
        >
            <View style={styles.imageContainer}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.image} />
                ) : (
                    <View style={styles.placeholderImage}>
                        <TagIcon size={32} color={Colors.neutral[300]} />
                    </View>
                )}
            </View>
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.price}>{item.price}</Text>
                <View style={styles.stockContainer}>
                    <Text style={styles.stockText}>
                        Qty: {item.full_data.stock_quantity || 1}
                    </Text>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push({ pathname: '/sell', params: { draftId: item.id } } as any)}
                >
                    <PencilSquareIcon size={20} color={Colors.primary[600]} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteListing(item.id)}
                >
                    <TrashIcon size={20} color={Colors.danger[500]} />
                </TouchableOpacity>
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
                <Text style={styles.headerTitle}>Your Listings</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={listings}
                renderItem={renderListingItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <TagIcon size={64} color={Colors.neutral[200]} />
                        <Text style={styles.emptyTitle}>No active listings</Text>
                        <Text style={styles.emptySub}>List an item to start selling on Culturar.</Text>
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => router.push('/sell')}
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
    card: {
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
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    price: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary[600],
        marginBottom: 4,
    },
    stockContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockText: {
        fontSize: 12,
        color: '#6B7280',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
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

export default ListingsScreen;
