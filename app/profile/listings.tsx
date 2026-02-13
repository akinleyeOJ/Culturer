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
import { ChevronLeftIcon, XMarkIcon, PlusIcon, TagIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, CheckCircleIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUserActiveListings, deleteListing, createListing } from '../../lib/services/productService';
import { CATEGORIES } from '../../constants/categories';
import { SectionList, TextInput as RNTextInput } from 'react-native';

const ListingsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [allListings, setAllListings] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadListings = async () => {
        if (!user) return;
        try {
            const data = await fetchUserActiveListings(user.id);
            setAllListings(data);
            groupAndSetSections(data, searchQuery);
        } catch (error) {
            console.error('Error loading listings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const groupAndSetSections = (data: any[], query: string) => {
        const filtered = data.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        );

        // Group by category
        const groups: { [key: string]: any[] } = {};
        filtered.forEach(item => {
            const categoryId = item.category || 'other';
            if (!groups[categoryId]) groups[categoryId] = [];
            groups[categoryId].push(item);
        });

        const sectionData = Object.keys(groups).map(catId => {
            const category = CATEGORIES.find(c => c.id === catId);
            return {
                title: category ? category.name : catId.charAt(0).toUpperCase() + catId.slice(1),
                data: groups[catId]
            };
        }).sort((a, b) => a.title.localeCompare(b.title));

        setSections(sectionData);
    };

    React.useEffect(() => {
        groupAndSetSections(allListings, searchQuery);
    }, [searchQuery, allListings]);

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

    const handleMarkAsSold = async (item: any) => {
        Alert.alert(
            'Mark as Sold',
            'This will set the quantity to 0 and hide the item from public search results. You can still reactivate it later by editing the quantity.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark as Sold',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const productData = item.full_data;
                            await createListing({
                                ...productData,
                                stock_quantity: 0,
                                status: 'active'
                            });
                            await loadListings();
                        } catch (error) {
                            console.error('Error marking as sold:', error);
                            Alert.alert('Error', 'Failed to update listing.');
                        } finally {
                            setLoading(false);
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
                    <Image source={{ uri: item.image }} style={[styles.image, item.full_data.stock_quantity === 0 && { opacity: 0.5 }]} />
                ) : (
                    <View style={styles.placeholderImage}>
                        <TagIcon size={32} color={Colors.neutral[300]} />
                    </View>
                )}
                {item.full_data.stock_quantity === 0 && (
                    <View style={styles.soldBadgeOverlay}>
                        <Text style={styles.soldBadgeText}>SOLD</Text>
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
                {item.full_data.stock_quantity > 0 && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleMarkAsSold(item)}
                    >
                        <CheckCircleIcon size={20} color={Colors.success[500]} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push({ pathname: '/profile/edit-listing', params: { draftId: item.id, type: 'active' } } as any)}
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

    const renderSectionHeader = ({ section: { title } }: any) => (
        <View style={styles.sectionHeader}>
            <TagIcon size={18} color={Colors.primary[500]} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitleText}>{title}</Text>
        </View>
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
                <Text style={styles.headerTitle}>My Listings</Text>
                <TouchableOpacity
                    onPress={() => router.push('/profile/create-listing' as any)}
                    style={styles.addButton}
                >
                    <PlusIcon size={24} color={Colors.primary[500]} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MagnifyingGlassIcon size={20} color={Colors.neutral[400]} />
                    <RNTextInput
                        style={styles.searchInput}
                        placeholder="Search your listings..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={Colors.neutral[400]}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={{ color: Colors.primary[500], fontWeight: '600' }}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderListingItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <TagIcon size={64} color={Colors.neutral[200]} />
                        <Text style={styles.emptyTitle}>
                            {searchQuery ? 'No matching listings' : 'No active listings'}
                        </Text>
                        <Text style={styles.emptySub}>
                            {searchQuery ? `We couldn't find any listings matching "${searchQuery}"` : 'List an item to start selling on Culturar.'}
                        </Text>

                        {!searchQuery && (
                            <View style={styles.emptyActions}>
                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={() => router.push('/sell')}
                                >
                                    <Text style={styles.createBtnText}>Create Listing</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.secondaryBtn}
                                    onPress={() => router.push('/profile/drafts')}
                                >
                                    <Text style={styles.secondaryBtnText}>View Drafts</Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
    addButton: {
        padding: 8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingTop: 8,
        flexGrow: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingVertical: 12,
        marginTop: 8,
        marginBottom: 8,
    },
    sectionTitleText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.neutral[500],
        letterSpacing: 0.5,
        textTransform: 'uppercase',
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
    soldBadgeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    soldBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
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
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#111827',
    },
    emptyActions: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
    },
    secondaryBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    secondaryBtnText: {
        color: Colors.neutral[700],
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ListingsScreen;
