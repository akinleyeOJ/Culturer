// app/(tabs)/Profile.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../../constants/color";
import {
  PencilSquareIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ShoppingBagIcon,
  HeartIcon,
  TagIcon,
  GlobeAltIcon,
  MapPinIcon,
  BellIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ArrowLeftOnRectangleIcon,
  BuildingStorefrontIcon,
  ShareIcon
} from "react-native-heroicons/outline";
import { supabase } from "../../lib/supabase";
import { FontAwesome } from "@expo/vector-icons";

interface UserStats {
  listings: number;
  orders: number;
  rating: number;
}

const Profile = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [memberSince, setMemberSince] = useState("2024");

  const [profile, setProfile] = useState<any>(null);

  const fetchStats = async () => {
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

      // 2. Fetch Orders count
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 3. Fetch Listings count (only active)
      const { count: listingsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .eq('status', 'active');

      // Update member since
      if (user.created_at) {
        const year = new Date(user.created_at).getFullYear();
        setMemberSince(year.toString());
      }

      setStats({
        orders: ordersCount || 0,
        listings: listingsCount || 0,
        rating: 4.9,
      });

    } catch (e) {
      console.error("Error fetching stats", e);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [user])
  );

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my profile on Culturar!`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error("Error signing out:", error);
            }
          }
        }
      ]
    );
  };

  const MenuItem = ({ icon: Icon, label, subtitle, onPress, showBorder = true }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, !showBorder && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <View style={styles.menuIconBox}>
        <Icon size={22} color={Colors.text.primary} />
      </View>
      <View style={styles.menuTextContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <ChevronRightIcon size={18} color={Colors.neutral[400]} />
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleShareProfile}>
          <ShareIcon size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <Image
                source={{ uri: profile?.avatar_url || user?.user_metadata?.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary[100] }]}>
                <UserCircleIcon size={40} color={Colors.primary[500]} />
              </View>
            )}
            <View style={styles.profileText}>
              <Text style={styles.name}>
                {profile?.full_name || (isInitialLoading ? ' ' : (user?.user_metadata?.full_name || 'User'))}
              </Text>
              <Text style={styles.subText}>
                Member since {memberSince} • {profile?.location || (isInitialLoading ? ' ' : (user?.user_metadata?.location || 'Earth'))}
              </Text>
              {/* Social Links Row */}
              <View style={styles.socialsRow}>
                {profile?.instagram_handle && (
                  <TouchableOpacity style={styles.socialIcon}>
                    <FontAwesome name="instagram" size={18} color="#E1306C" />
                  </TouchableOpacity>
                )}
                {profile?.facebook_handle && (
                  <TouchableOpacity style={styles.socialIcon}>
                    <FontAwesome name="facebook" size={18} color="#1877F2" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/profile/edit' as any)}
            >
              <PencilSquareIcon size={16} color={Colors.text.primary} />
              <Text style={styles.actionBtnText}>Edit profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleShareProfile}
            >
              <ShareIcon size={16} color={Colors.text.primary} />
              <Text style={styles.actionBtnText}>Share profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/profile/settings' as any)}
            >
              <Cog6ToothIcon size={16} color={Colors.text.primary} />
              <Text style={styles.actionBtnText}>Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats ? stats.listings : '--'}</Text>
              <Text style={styles.statLabel}>Active listings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats ? stats.orders : '--'}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats ? stats.rating.toFixed(1) : '--'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <MenuItem
            icon={ShoppingBagIcon}
            label="Order history"
            subtitle="View purchases, receipts and returns"
            onPress={() => router.push('/profile/orders' as any)}
          />
          <MenuItem
            icon={HeartIcon}
            label="Wishlists"
            subtitle="Saved items and cultural collections"
            onPress={() => router.push('/wishlist' as any)}
            showBorder={false}
          />
          <MenuItem
            icon={MapPinIcon}
            label="Location & Shipping"
            subtitle="Default addresses and delivery methods"
            onPress={() => router.push('/profile/location-shipping' as any)}
          />
        </View>

        {/* Seller Section */}
        <View style={styles.section}>
          <SectionHeader title="Seller profile" />
          <MenuItem
            icon={BuildingStorefrontIcon}
            label="Seller profile"
            subtitle="Manage your public shop page and selling details"
            onPress={() => router.push('/profile/seller-hub')}
          />
          <MenuItem
            icon={TagIcon}
            label="My listings"
            subtitle="Manage prices, stock and active items"
            onPress={() => router.push('/profile/listings' as any)}
          />
          <MenuItem
            icon={DocumentTextIcon}
            label="My drafts"
            subtitle="Resume and publish saved listings"
            onPress={() => router.push('/profile/drafts' as any)}
            showBorder={false}
          />
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <SectionHeader title="Preferences" />
          <MenuItem
            icon={GlobeAltIcon}
            label="Culture & Interests"
            subtitle="Personalize your discovery experience"
            onPress={() => router.push('/profile/settings' as any)}
          />
          <MenuItem
            icon={CreditCardIcon}
            label="Payments"
            subtitle="Manage your saved payment methods"
            onPress={() => router.push('/profile/settings' as any)}
            showBorder={false}
          />
        </View>

        {/* Help & Legal */}
        <View style={styles.section}>
          <SectionHeader title="Help & Legal" />
          <MenuItem
            icon={QuestionMarkCircleIcon}
            label="Help Center"
            subtitle="FAQs and customer support"
            onPress={() => { }}
          />
          <MenuItem
            icon={DocumentTextIcon}
            label="Terms & Privacy Policy"
            subtitle="Rules and safety information"
            onPress={() => { }}
            showBorder={false}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <ArrowLeftOnRectangleIcon size={24} color={Colors.danger[600]} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0 (Build 2026.1)</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 0,
  },
  profileCard: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 24,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary[100],
  },
  profileText: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  socialsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  socialIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF9F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#FED7AA',
    marginHorizontal: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginBottom: 24,
    paddingVertical: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC', // Neutral greyish background from design
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger[100],
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger[600],
  }
});

export default Profile;