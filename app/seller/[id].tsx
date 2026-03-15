import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/color';
import { ChevronLeftIcon, MagnifyingGlassIcon, CheckBadgeIcon } from 'react-native-heroicons/outline';
import { MapPinIcon, GlobeAltIcon, LanguageIcon, StarIcon } from 'react-native-heroicons/solid';

import { useAuth } from '../../contexts/AuthContext';
import { fetchPublicSellerProfile, getFollowStatus, toggleFollowSeller } from '../../lib/services/profileService';
import { fetchSellerInventory, FilterOptions } from '../../lib/services/productService';
import { ProductCard } from '../../components/Card';

const { width } = Dimensions.get('window');

type StoreTab = 'shop' | 'policies';

export default function PublicSellerProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [seller, setSeller] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<StoreTab>('shop');
    
    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followActionLoading, setFollowActionLoading] = useState(false);
    
    // Inventory State
    const [inventory, setInventory] = useState<any[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterOptions>({});
    
    // Categories derived from the fetched inventory
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        loadProfile();
        checkFollowStatus();
    }, [id]);

    useEffect(() => {
        if (id) loadInventory();
    }, [id, searchQuery, selectedCategory]);

    const loadProfile = async () => {
        const data = await fetchPublicSellerProfile(id);
        setSeller(data);
        setLoading(false);
    };

    const checkFollowStatus = async () => {
        if (!user || user.id === id) return;
        const status = await getFollowStatus(user.id, id);
        setIsFollowing(status);
    };

    const loadInventory = async () => {
        setInventoryLoading(true);
        const appliedFilters: FilterOptions = {
            searchQuery: searchQuery || undefined,
            categories: selectedCategory ? [selectedCategory] : undefined,
        };
        
        const { products } = await fetchSellerInventory(id, 0, 100, appliedFilters, user?.id);
        setInventory(products);
        
        // Extract unique categories from all products exactly once
        if (!searchQuery && !selectedCategory && products.length > 0) {
            const uniqueCats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
            setAvailableCategories(uniqueCats as string[]);
        }
        
        setInventoryLoading(false);
    };

    const handleFollowPress = async () => {
        if (!user) {
            // Need to sign in to follow
            return;
        }
        setFollowActionLoading(true);
        const result = await toggleFollowSeller(user.id, id, isFollowing);
        if (result.success) {
            setIsFollowing(result.isFollowing);
            setSeller((prev: any) => ({
                ...prev,
                follower_count: prev.follower_count + (result.isFollowing ? 1 : -1)
            }));
        }
        setFollowActionLoading(false);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    if (!seller) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Seller not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Header / Banner Area */}
                <View style={styles.bannerContainer}>
                    {seller.cover_url ? (
                        <Image source={{ uri: seller.cover_url }} style={styles.coverImage} />
                    ) : (
                        <View style={[styles.coverImage, { backgroundColor: Colors.primary[100] }]} />
                    )}
                    
                    {/* Fixed Navbar Overlay */}
                    <SafeAreaView edges={['top']} style={styles.navbarOverlay}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonOverlay}>
                            <ChevronLeftIcon size={20} color="#000" />
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>

                {/* Profile Card Overlay */}
                <View style={styles.profileMetaContainer}>
                    <View style={styles.avatarWrapper}>
                        {seller.avatar_url ? (
                            <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: Colors.neutral[200], justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={styles.avatarText}>{seller.full_name?.substring(0, 1) || '?'}</Text>
                            </View>
                        )}
                        <View style={styles.verifiedBadge}>
                            <CheckBadgeIcon size={18} color={Colors.primary[500]} />
                        </View>
                    </View>

                    <Text style={styles.sellerName}>{seller.full_name}</Text>
                    
                    <View style={styles.badgesRow}>
                        {seller.location && (
                            <View style={styles.metaBadge}>
                                <MapPinIcon size={14} color={Colors.text.secondary} />
                                <Text style={styles.metaBadgeText}>{seller.location}</Text>
                            </View>
                        )}
                        <View style={styles.metaBadge}>
                            <StarIcon size={14} color="#F59E0B" />
                            <Text style={styles.metaBadgeText}>
                                {seller.average_rating > 0 ? seller.average_rating.toFixed(1) : 'New'} ({seller.review_count})
                            </Text>
                        </View>
                        <View style={styles.metaBadge}>
                            <Text style={styles.metaBadgeText}>
                                {seller.follower_count} {seller.follower_count === 1 ? 'follower' : 'followers'}
                            </Text>
                        </View>
                    </View>

                    {/* Follow Action */}
                    {user?.id !== seller.id && (
                        <TouchableOpacity 
                            style={[styles.followButton, isFollowing && styles.followingButton]}
                            onPress={handleFollowPress}
                            disabled={followActionLoading}
                        >
                            {followActionLoading ? (
                                <ActivityIndicator size="small" color={isFollowing ? Colors.text.primary : '#FFF'} />
                            ) : (
                                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                                    {isFollowing ? 'Following' : 'Follow shop'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bio & Trust Dimensions */}
                <View style={styles.bioSection}>
                    {seller.bio && (
                        <Text style={styles.bioText}>{seller.bio}</Text>
                    )}

                    <View style={styles.trustPillsContainer}>
                        {seller.cultures && seller.cultures.length > 0 && (
                            <View style={styles.trustPill}>
                                <GlobeAltIcon size={16} color={Colors.primary[600]} />
                                <Text style={styles.trustPillLabel}>Focus: </Text>
                                <Text style={styles.trustPillValue}>
                                    {seller.cultures.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
                                </Text>
                            </View>
                        )}
                        {seller.spoken_languages && seller.spoken_languages.length > 0 && (
                            <View style={styles.trustPill}>
                                <LanguageIcon size={16} color={Colors.primary[600]} />
                                <Text style={styles.trustPillLabel}>Speaks: </Text>
                                <Text style={styles.trustPillValue}>{seller.spoken_languages.join(', ')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
                        onPress={() => setActiveTab('shop')}
                    >
                        <Text style={[styles.tabText, activeTab === 'shop' && styles.activeTabText]}>Shop</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'policies' && styles.activeTab]}
                        onPress={() => setActiveTab('policies')}
                    >
                        <Text style={[styles.tabText, activeTab === 'policies' && styles.activeTabText]}>Policies</Text>
                    </TouchableOpacity>
                </View>

                {/* Content Area */}
                <View style={styles.tabContent}>
                    {activeTab === 'shop' ? (
                        <View style={styles.shopContainer}>
                            {/* Search & Filters */}
                            <View style={styles.filterSection}>
                                <View style={styles.searchBar}>
                                    <MagnifyingGlassIcon size={20} color={Colors.text.tertiary} />
                                    <TextInput 
                                        style={styles.searchInput}
                                        placeholder="Search shop..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholderTextColor={Colors.text.tertiary}
                                    />
                                </View>

                                {availableCategories.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                                        <TouchableOpacity 
                                            style={[styles.categoryPill, !selectedCategory && styles.activeCategoryPill]}
                                            onPress={() => setSelectedCategory(null)}
                                        >
                                            <Text style={[styles.categoryPillText, !selectedCategory && styles.activeCategoryPillText]}>All items</Text>
                                        </TouchableOpacity>
                                        
                                        {availableCategories.map(cat => (
                                            <TouchableOpacity 
                                                key={cat}
                                                style={[styles.categoryPill, selectedCategory === cat && styles.activeCategoryPill]}
                                                onPress={() => setSelectedCategory(cat)}
                                            >
                                                <Text style={[styles.categoryPillText, selectedCategory === cat && styles.activeCategoryPillText]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* Inventory Grid */}
                            {inventoryLoading ? (
                                <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                            ) : inventory.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No items found in this shop.</Text>
                                </View>
                            ) : (
                                <View style={styles.grid}>
                                    {inventory.map(item => (
                                        <View key={item.id} style={styles.gridItem}>
                                            <ProductCard 
                                                name={item.name}
                                                price={item.price}
                                                originalPrice={item.originalPrice}
                                                image={item.image}
                                                emoji={item.emoji}
                                                rating={item.rating}
                                                reviews={item.reviews}
                                                shipping={item.shipping}
                                                outOfStock={item.status === 'sold' || item.outOfStock}
                                                showSoldOutOverlay={item.status === 'sold'}
                                                hideFavoriteButton={true}
                                                onPress={() => router.push(`/item/${item.id}`)}
                                            />
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.policiesContainer}>
                            {seller.shop_policies ? (
                                <Text style={styles.policyText}>{JSON.stringify(seller.shop_policies, null, 2)}</Text>
                            ) : (
                                <Text style={styles.emptyText}>This seller hasn't added formal shop policies yet.</Text>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        height: 44,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: Colors.text.secondary,
    },
    bannerContainer: {
        width: '100%',
        height: 180,
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    navbarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonOverlay: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    profileMetaContainer: {
        backgroundColor: '#FFF',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 24,
        marginTop: -30,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 5,
    },
    avatarWrapper: {
        position: 'relative',
        marginTop: -32,
        marginBottom: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 4,
        borderColor: '#FFF',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.neutral[500],
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 2,
    },
    sellerName: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    badgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaBadgeText: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    followButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
        width: '80%',
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.neutral[300],
    },
    followButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    followingButtonText: {
        color: Colors.text.primary,
    },
    bioSection: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        backgroundColor: '#F9FAFB',
    },
    bioText: {
        fontSize: 15,
        color: Colors.text.secondary,
        lineHeight: 22,
        marginBottom: 20,
        textAlign: 'center',
    },
    trustPillsContainer: {
        flexDirection: 'column',
        gap: 12,
    },
    trustPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    trustPillLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    trustPillValue: {
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
        flex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
        backgroundColor: '#FFF',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary[500],
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    activeTabText: {
        color: Colors.primary[500],
    },
    tabContent: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        minHeight: 400,
    },
    shopContainer: {
        paddingTop: 16,
    },
    filterSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: Colors.text.primary,
    },
    categoriesScroll: {
        marginBottom: 8,
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.neutral[200],
        marginRight: 8,
    },
    activeCategoryPill: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[200],
    },
    categoryPillText: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    activeCategoryPillText: {
        color: Colors.primary[600],
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
    },
    gridItem: {
        width: '50%',
        padding: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        fontSize: 15,
        color: Colors.text.tertiary,
    },
    policiesContainer: {
        padding: 20,
        backgroundColor: '#FFF',
        minHeight: 300,
    },
    policyText: {
        fontSize: 15,
        color: Colors.text.secondary,
        lineHeight: 24,
    },
});
