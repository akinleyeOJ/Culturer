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
  ShareIcon,
  CheckBadgeIcon,
  ShieldCheckIcon
} from "react-native-heroicons/outline";
import { supabase } from "../../lib/supabase";
import { FontAwesome } from "@expo/vector-icons";

interface UserStats {
  followers: number;
  following: number;
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

      // 1. Fetch Followers count
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // 2. Fetch Following count
      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      // Update member since
      if (user.created_at) {
        const year = new Date(user.created_at).getFullYear();
        setMemberSince(year.toString());
      }

      setStats({
        followers: followersCount || 0,
        following: followingCount || 0,
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
      if (!user) return;
      
      const displayName = profile?.full_name || profile?.display_name || user.email?.split('@')[0] || 'User';
      const shareUrl = `culturar://seller/${user.id}`;
      
      await Share.share({
        message: `Check out ${displayName}'s profile on Culturar!\n\n${shareUrl}`,
        url: shareUrl,
        title: `${displayName}'s Culturar Profile`
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
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
        keyboardDismissMode="on-drag"
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
              <Text style={styles.followStatsText}>
                <Text style={{ fontWeight: '700', color: Colors.text.primary }}>{stats?.followers || 0}</Text> followers • <Text style={{ fontWeight: '700', color: Colors.text.primary }}>{stats?.following || 0}</Text> following
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
          <MenuItem
            icon={CheckBadgeIcon}
            label="Identity Verification"
            subtitle={profile?.is_verified ? "Your identity is verified" : "Confirm your identity to build trust"}
            onPress={() => router.push('/profile/verification')}
            showBorder={false}
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
            onPress={() => router.push('/profile/culture-interests' as any)}
          />
          <MenuItem
            icon={CreditCardIcon}
            label="Payments"
            subtitle="Manage your saved payment methods"
            onPress={() => router.push('/profile/payments' as any)}
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

        {/* Admin Section (Visible only to admins) */}
        {profile?.role === 'admin' && (
          <View style={styles.section}>
            <SectionHeader title="Admin" />
            <MenuItem
              icon={ShieldCheckIcon}
              label="Verification Review"
              subtitle="Review pending identity documents"
              onPress={() => router.push('/admin/verifications' as any)}
              showBorder={false}
            />
          </View>
        )}

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
    marginBottom: 4, // Reduced from 24 to keep it tight
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
    marginBottom: 4,
  },
  followStatsText: {
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
    marginBottom: 8, // Reduced from 24 since stats are gone
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