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
    Alert,
    ScrollView,
    SectionList,
    Modal,
    TextInput as RNTextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeftIcon, XMarkIcon, PlusIcon, TagIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, CheckCircleIcon, AdjustmentsHorizontalIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUserActiveListings, deleteListing, createListing } from '../../lib/services/productService';
import { CATEGORIES } from '../../constants/categories';


const ListingsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [allListings, setAllListings] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    const STATUS_OPTIONS = [
        { id: 'all', label: 'All Status' },
        { id: 'active', label: 'Active' },
        { id: 'sold', label: 'Sold' },
        { id: 'out_of_stock', label: 'Out of Stock' },
    ];

    const loadListings = async () => {
        if (!user) return;
        try {
            const data = await fetchUserActiveListings(user.id);
            setAllListings(data);
            groupAndSetSections(data, searchQuery, selectedCategories, selectedStatus);
        } catch (error) {
            console.error('Error loading listings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const groupAndSetSections = (data: any[], query: string, categoryIds: string[], status: string) => {
        let filtered = data.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        );

        if (categoryIds.length > 0) {
            filtered = filtered.filter(item => categoryIds.includes(item.category));
        }

        if (status === 'active') {
            filtered = filtered.filter(item => item.full_data.stock_quantity > 0);
        } else if (status === 'sold' || status === 'out_of_stock') {
            filtered = filtered.filter(item => item.full_data.stock_quantity === 0);
        }

        // Group by category
        const groups: { [key: string]: any[] } = {};
        filtered.forEach(item => {
            const catId = item.category || 'other';
            if (!groups[catId]) groups[catId] = [];
            groups[catId].push(item);
        });

        const sectionData = Object.keys(groups).map(catId => {
            const category = CATEGORIES.find(c => c.id === catId);
            return {
                title: category ? category.name : catId.charAt(0).toUpperCase() + catId.slice(1),
                data: groups[catId].sort((a, b) => new Date(b.full_data.created_at).getTime() - new Date(a.full_data.created_at).getTime())
            };
        }).sort((a, b) => a.title.localeCompare(b.title));

        setSections(sectionData);
    };

    React.useEffect(() => {
        groupAndSetSections(allListings, searchQuery, selectedCategories, selectedStatus);
    }, [searchQuery, allListings, selectedCategories, selectedStatus]);

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
                <View style={styles.searchRow}>
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
                    <TouchableOpacity
                        style={[styles.filterIconButton, selectedCategories.length > 0 && styles.filterIconButtonActive]}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <AdjustmentsHorizontalIcon size={20} color={selectedCategories.length > 0 ? '#FFF' : Colors.text.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.filterBarContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterBar}
                    >
                        <View style={styles.filterSection}>
                            {STATUS_OPTIONS.map(status => (
                                <TouchableOpacity
                                    key={status.id}
                                    style={[styles.filterChip, selectedStatus === status.id && styles.filterChipActive]}
                                    onPress={() => setSelectedStatus(status.id)}
                                >
                                    <Text style={[styles.filterText, selectedStatus === status.id && styles.filterTextActive]}>
                                        {status.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
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
                            {searchQuery || selectedCategories.length > 0 || selectedStatus !== 'all' ? 'No matching listings' : 'No active listings'}
                        </Text>
                        <Text style={styles.emptySub}>
                            {searchQuery || selectedCategories.length > 0 || selectedStatus !== 'all'
                                ? "We couldn't find any listings matching your current filters"
                                : 'List an item to start selling on Culturar.'}
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

            {/* Category Modal */}
            <Modal
                visible={showCategoryModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCategoryModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Categories</Text>
                                <Text style={styles.modalSub}>Filter your listings by category</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalList}>
                            <TouchableOpacity
                                style={[styles.modalItem, selectedCategories.length === 0 && styles.modalItemActive]}
                                onPress={() => {
                                    setSelectedCategories([]);
                                }}
                            >
                                <View style={styles.modalItemContent}>
                                    <Text style={[styles.modalItemText, selectedCategories.length === 0 && styles.modalItemActiveText]}>
                                        All Categories
                                    </Text>
                                    {selectedCategories.length === 0 && (
                                        <CheckCircleIcon size={20} color={Colors.primary[600]} />
                                    )}
                                </View>
                            </TouchableOpacity>
                            {CATEGORIES.map(item => {
                                const isSelected = selectedCategories.includes(item.id);
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.modalItem, isSelected && styles.modalItemActive]}
                                        onPress={() => {
                                            if (isSelected) {
                                                setSelectedCategories(prev => prev.filter(id => id !== item.id));
                                            } else {
                                                setSelectedCategories(prev => [...prev, item.id]);
                                            }
                                        }}
                                    >
                                        <View style={styles.modalItemContent}>
                                            <Text style={[styles.modalItemText, isSelected && styles.modalItemActiveText]}>
                                                {item.name}
                                            </Text>
                                            {isSelected && (
                                                <CheckCircleIcon size={20} color={Colors.primary[600]} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.applyButton}
                                onPress={() => setShowCategoryModal(false)}
                            >
                                <Text style={styles.applyButtonText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
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
        flex: 1,
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
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingRight: 24,
    },
    filterBarContainer: {
        width: '100%',
    },
    filterSection: {
        flexDirection: 'row',
        gap: 8,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 12,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterTextActive: {
        color: '#FFF',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    filterIconButton: {
        width: 40,
        height: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterIconButtonActive: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        width: '100%',
        maxHeight: '70%',
        paddingBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalSub: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    modalList: {
        padding: 16,
    },
    modalItem: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 4,
    },
    modalItemActive: {
        backgroundColor: Colors.primary[50],
    },
    modalItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalItemText: {
        fontSize: 16,
        color: '#374151',
    },
    modalItemActiveText: {
        color: Colors.primary[700],
        fontWeight: '700',
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    applyButton: {
        backgroundColor: Colors.primary[500],
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ListingsScreen;
