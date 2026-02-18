import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Switch,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
    ChevronLeftIcon,
    EllipsisHorizontalIcon,
    ChevronRightIcon,
    PlusIcon,
    EyeIcon,
    ShoppingBagIcon,
    DocumentTextIcon,
    TruckIcon,
    ClipboardDocumentListIcon,
    BanknotesIcon,
    ReceiptPercentIcon,
    StarIcon,
    LanguageIcon,
    ChartBarIcon,
    InformationCircleIcon,
    MapPinIcon,
    TagIcon,
    UserCircleIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SellerStats {
    totalItems: number;
    activeItems: number;
    totalOrders: number;
    followers: number;
    rating: number;
}

const SellerHubScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [stats, setStats] = useState<SellerStats>({
        totalItems: 0,
        activeItems: 0,
        totalOrders: 0,
        followers: 5, // Mocked for design
        rating: 4.9 // Mocked for design
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isShopLive, setIsShopLive] = useState(true);

    const [profile, setProfile] = useState<any>(null);

    const fetchSellerStats = async () => {
        if (!user) return;
        try {
            // 1. Fetch Profile Details
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
            }

            // 2. Count active items
            const { count: activeCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', user.id)
                .eq('status', 'active');

            // 3. Count total items
            const { count: totalCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', user.id);

            // 4. Fetch real order count
            const { count: orderCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', user.id);

            setStats(prev => ({
                ...prev,
                activeItems: activeCount || 0,
                totalItems: totalCount || 0,
                totalOrders: orderCount || 0,
            }));
        } catch (error) {
            console.error('Error fetching seller stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSellerStats();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchSellerStats();
    };

    const StatsSection = () => (
        <View style={styles.statsContainer}>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalItems}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.activeItems}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalOrders}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.followers}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.rating}</Text>
                <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Rating</Text>
            </View>
        </View>
    );

    const MenuSection = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    const MenuItem = ({ icon: Icon, title, subtitle, badge, onPress, isLast = false }: any) => (
        <TouchableOpacity
            style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]}
            onPress={onPress}
        >
            <View style={styles.menuIconBox}>
                <Icon size={24} color={Colors.text.primary} />
            </View>
            <View style={styles.menuTextBox}>
                <View style={styles.menuTitleRow}>
                    <Text style={styles.menuTitle}>{title}</Text>
                    {badge && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
            </View>
            <ChevronRightIcon size={20} color={Colors.neutral[400]} />
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
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Seller profile</Text>
                <TouchableOpacity style={styles.circleBtn}>
                    <EllipsisHorizontalIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Profile Overview */}
                <View style={styles.profileOverview}>
                    <View style={styles.profileRow}>
                        {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
                            <Image
                                source={{ uri: profile?.avatar_url || user?.user_metadata?.avatar_url }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }]}>
                                <UserCircleIcon size={50} color="#9CA3AF" />
                            </View>
                        )}
                        <View style={styles.profileMain}>
                            <Text style={styles.shopName}>{profile?.full_name || user?.user_metadata?.full_name || 'Your Shop'}</Text>
                            <View style={styles.locationRow}>
                                <MapPinIcon size={14} color="#6B7280" />
                                <Text style={styles.locationText}>{profile?.location || 'Location not set'}</Text>
                            </View>

                            {profile?.cultures && profile.cultures.length > 0 && (
                                <View style={styles.headerCultures}>
                                    {profile.cultures.map((c: string) => (
                                        <View key={c} style={styles.headerCultureBadge}>
                                            <Text style={styles.headerCultureText}>{c}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text style={styles.shopDescription} numberOfLines={2}>
                                {profile?.bio || user?.user_metadata?.bio || 'Add Profile Bio Here.'}
                            </Text>
                        </View>
                        <View style={styles.shopStatusBox}>
                            <View style={[styles.statusBadge, isShopLive ? styles.statusBadgeLive : styles.statusBadgePaused]}>
                                <Text style={styles.statusBadgeText}>{isShopLive ? 'Shop live' : 'Shop paused'}</Text>
                            </View>
                            <Switch
                                value={isShopLive}
                                onValueChange={setIsShopLive}
                                trackColor={{ false: '#E5E7EB', true: Colors.primary[200] }}
                                thumbColor={isShopLive ? Colors.primary[500] : '#9CA3AF'}
                                ios_backgroundColor="#E5E7EB"
                            />
                        </View>
                    </View>
                    {!isShopLive && (
                        <Text style={styles.pauseNote}>Pause your shop when you are away</Text>
                    )}
                </View>

                {/* Stats Row */}
                <StatsSection />

                {/* Sections */}
                <MenuSection
                    title="Shop setup"
                    subtitle="Keep your public shop page clear and welcoming for buyers."
                >
                    <MenuItem
                        icon={ShoppingBagIcon}
                        title="Shop details"
                        subtitle="Name, cover image, bio, and cultures represented"
                        onPress={() => router.push('/profile/edit')}
                    />
                    <MenuItem
                        icon={ClipboardDocumentListIcon}
                        title="Shop policies"
                        subtitle="Returns, exchanges, and communication rules"
                        onPress={() => router.push('/profile/shop-policies')}
                    />
                    <MenuItem
                        icon={TruckIcon}
                        title="Shipping & pickup"
                        subtitle="Regions, delivery times, and local pickup options"
                        onPress={() => router.push('/profile/seller-shipping')}
                        isLast
                    />
                </MenuSection>

                <MenuSection title="Selling tools" subtitle="Manage listings, pricing, and how you get paid.">
                    <MenuItem
                        icon={TagIcon}
                        title="Listings manager"
                        subtitle="Edit prices, availability, and cultural tags"
                        badge={`${stats.activeItems} active`}
                        onPress={() => router.push('/profile/listings')}
                    />
                    <MenuItem
                        icon={ChartBarIcon}
                        title="Listings analytics"
                        subtitle="Track views, saves and conversion rates"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon={BanknotesIcon}
                        title="Payouts & earnings"
                        subtitle="Balance, payout methods, and currency"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon={ReceiptPercentIcon}
                        title="Promotions"
                        subtitle="Discounts, bundles, and featured boosts"
                        onPress={() => { }}
                        isLast
                    />
                </MenuSection>

                <MenuSection
                    title="Reputation"
                    subtitle="Build trust with buyers across cultures."
                >
                    <MenuItem
                        icon={StarIcon}
                        title="Reviews"
                        subtitle="Read feedback and respond to buyers"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon={LanguageIcon}
                        title="Languages & regions"
                        subtitle="Preferred languages and cultural focus"
                        onPress={() => { }}
                        isLast
                    />
                </MenuSection>

                {/* Preview Card */}
                <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>Preview how buyers see you</Text>
                    <Text style={styles.previewSub}>
                        Check your public shop page to be sure photos, descriptions, and cultural context feel right for your audience.
                    </Text>
                </View>
            </ScrollView>

            {/* Sticky Footer */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.viewShopBtn}>
                    <EyeIcon size={20} color={Colors.text.primary} />
                    <Text style={[styles.btnText, { color: Colors.text.primary }]}>View public shop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.addListingBtn}
                    onPress={() => router.push('/profile/create-listing')}
                >
                    <PlusIcon size={20} color="#FFF" />
                    <Text style={[styles.btnText, { color: '#FFF' }]}>Add listing</Text>
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    profileOverview: {
        padding: 16,
        paddingBottom: 24,
        backgroundColor: '#FFF',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F3F4F6',
    },
    profileMain: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    shopName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    shopDescription: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        marginTop: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    locationText: {
        fontSize: 12,
        color: '#6B7280',
    },
    headerCultures: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    headerCultureBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    headerCultureText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4B5563',
    },
    shopStatusBox: {
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    statusBadgeLive: {
        backgroundColor: '#DCFCE7',
    },
    statusBadgePaused: {
        backgroundColor: '#F3F4F6',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#166534',
    },
    pauseNote: {
        fontSize: 11,
        color: '#9CA3AF',
        textAlign: 'right',
        position: 'absolute',
        bottom: 8,
        right: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF9F5',
        marginHorizontal: 16,
        marginBottom: 24,
        paddingVertical: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#FED7AA',
        marginHorizontal: 8,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 9,
        color: '#6B7280',
        fontWeight: '700',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        paddingHorizontal: 16,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    sectionContent: {
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F3F4F6',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    menuTextBox: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    menuTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    menuTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    badge: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    previewCard: {
        margin: 16,
        padding: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    previewTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    previewSub: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        height: 100,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    viewShopBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF',
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 4,
        paddingHorizontal: 4,
    },
    addListingBtn: {
        flex: 1.3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary[500],
        height: 52,
        borderRadius: 12,
        gap: 8,
    },
    btnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

export default SellerHubScreen;
