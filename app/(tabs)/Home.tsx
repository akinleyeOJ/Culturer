import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard, RecentlyViewedCard } from "../../components/Card";
import HomeHeader from "../../components/HomeHeader";
import { Colors } from "../../constants/color";
import {
  fetchForYouProducts,
  fetchHotProducts,
  fetchRecentlyViewed,
  clearRecentlyViewed,
  toggleFavorite,
  trackProductView,
  fetchWishlistCount
} from "../../lib/services/productService";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { supabase } from "../../lib/supabase";
import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";

interface Product {
  id: string;
  name: string;
  price: string;
  emoji: string;
  image?: string;
  rating: number;
  reviews: number;
  shipping: string;
  outOfStock: boolean;
  isFavorited?: boolean;
  badge?: "NEW" | "HOT" | null;
}

interface RecentlyViewedProduct {
  id: string;
  name: string;
  price: string;
  emoji: string;
  image?: string;
}

// Skeleton Card Components
const RecentlyViewedSkeleton = () => (
  <View style={styles.skeletonRecentlyViewed}>
    <View style={styles.skeletonRecentlyViewedImage} />
    <View style={styles.skeletonRecentlyViewedText} />
    <View style={styles.skeletonRecentlyViewedTextSmall} />
  </View>
);

const ProductCardSkeleton = ({ variant = "default" }: { variant?: "default" | "large" }) => (
  <View style={[styles.skeletonProductCard, variant === "large" && styles.skeletonProductCardLarge]}>
    <View style={[styles.skeletonProductImage, variant === "large" && styles.skeletonProductImageLarge]} />
    <View style={styles.skeletonProductContent}>
      <View style={styles.skeletonProductPrice} />
      <View style={styles.skeletonProductName} />
      <View style={styles.skeletonProductNameShort} />
      <View style={styles.skeletonProductRating} />
    </View>
  </View>
);

const Home = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { cartCount, refreshCartCount } = useCart();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);
  const [hotProducts, setHotProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [wishlistCount, setWishlistCount] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch wishlist count
  const loadWishlistCount = async () => {
    if (!user) {
      setWishlistCount(0);
      return;
    }
    const count = await fetchWishlistCount(user.id);
    setWishlistCount(count);
  };

  const handleClearHistory = async () => {
    if (!user) return;
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear your recently viewed items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const success = await clearRecentlyViewed(user.id);
            if (success) {
              setRecentlyViewed([]);
            }
          }
        }
      ]
    );
  };

  // Improved scroll handler with direction tracking
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    // Determine scroll direction
    scrollDirection.current = offsetY > lastScrollY.current ? 'down' : 'up';
    lastScrollY.current = offsetY;

    // Clear any existing timeout
    if (animationTimeout.current) {
      clearTimeout(animationTimeout.current);
    }

    // Use requestAnimationFrame for smoother updates
    animationTimeout.current = setTimeout(() => {
      const scrollThreshold = 60;

      // Different behavior based on scroll direction for better UX
      if (scrollDirection.current === 'down') {
        // When scrolling down, hide search bar quickly
        if (offsetY > scrollThreshold && !isScrolled) {
          setIsScrolled(true);
        }
      } else {
        // When scrolling up, show search bar with more sensitivity
        if (offsetY <= scrollThreshold && isScrolled) {
          setIsScrolled(false);
        } else if (offsetY <= 10 && isScrolled) {
          // Always show when very close to top
          setIsScrolled(false);
        }
      }
    }, 10); // Small delay to batch updates
  };

  const loadData = async () => {
    if (!user) return;

    try {
      const [recentlyViewedData, forYouData, hotData] = await Promise.all([
        fetchRecentlyViewed(user.id),
        fetchForYouProducts(user.id),
        fetchHotProducts(user.id),
      ]);

      setRecentlyViewed(recentlyViewedData);
      setForYouProducts(forYouData);
      setHotProducts(hotData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to save items to your wishlist");
      return;
    }

    // Optimistic update for both sections
    setForYouProducts(currentProducts =>
      currentProducts.map(p =>
        p.id === productId
          ? { ...p, isFavorited: !p.isFavorited }
          : p
      )
    );
    setHotProducts(currentProducts =>
      currentProducts.map(p =>
        p.id === productId
          ? { ...p, isFavorited: !p.isFavorited }
          : p
      )
    );

    const { success, isFavorited } = await toggleFavorite(user.id, productId);

    if (success) {
      // Update wishlist count
      loadWishlistCount();
    } else {
      // Revert if failed
      setForYouProducts(currentProducts =>
        currentProducts.map(p =>
          p.id === productId
            ? { ...p, isFavorited: !p.isFavorited }
            : p
        )
      );
      setHotProducts(currentProducts =>
        currentProducts.map(p =>
          p.id === productId
            ? { ...p, isFavorited: !p.isFavorited }
            : p
        )
      );
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  // Handle product press
  const handleProductPress = async (productId: string) => {
    if (user) {
      await trackProductView(user.id, productId);
      // Reload recently viewed
      const recentData = await fetchRecentlyViewed(user.id);
      setRecentlyViewed(recentData);
    }
    router.push(`/item/${productId}`);
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadWishlistCount();
  };

  // Load products on mount
  useEffect(() => {
    loadData();
    loadWishlistCount();
  }, [user]);

  // Reload wishlist count and recently viewed when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadWishlistCount();
      if (user) {
        fetchRecentlyViewed(user.id).then(setRecentlyViewed);
      }
    }, [user])
  );

  // Fetch display name
  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setDisplayName((data as any).display_name || user.email?.split('@')[0] || 'User');
      } else {
        setDisplayName(user.email?.split('@')[0] || 'User');
      }
    };

    fetchDisplayName();
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HomeHeader
        userName={displayName}
        userAvatar="https://via.placeholder.com/150"
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        isScrolled={isScrolled}
        onSearchPress={() => router.push('/search')}
        onWishlistPress={() => Alert.alert('Wishlist', 'Navigate to wishlist')}
        onCartPress={() => router.push('/cart')}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[500]}
          />
        }
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll
          }
        )}
        scrollEventThrottle={500}
      >
        {/* Recently Viewed section */}
        {user && (loading || recentlyViewed.length > 0) && (
          <View style={styles.recentlyViewedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Viewed</Text>
              {!loading && recentlyViewed.length > 0 && (
                <TouchableOpacity onPress={handleClearHistory}>
                  <Text style={{ color: Colors.neutral[500], fontSize: 14 }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <RecentlyViewedSkeleton key={`rv - skeleton - ${i} `} />
                ))
              ) : recentlyViewed.length > 0 ? (
                recentlyViewed.map((product) => (
                  <RecentlyViewedCard
                    key={product.id}
                    name={product.name}
                    price={product.price}
                    emoji={product.emoji}
                    image={product.image}
                    onPress={() => handleProductPress(product.id)}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No recently viewed items yet</Text>
                  <Text style={styles.emptySubtext}>Start browsing to see your history here</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* For You section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For You 👀</Text>
            {!loading && forYouProducts.length > 0 && (
              <TouchableOpacity
                onPress={() => Alert.alert('For You', 'View all personalized products')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMore}>View More ›</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            snapToInterval={300}
            decelerationRate="fast"
            snapToAlignment="start"
          >
            {loading ? (
              <View>
                <View style={styles.gridRow}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ProductCardSkeleton key={`foryou - skeleton - 1 - ${i} `} />
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ProductCardSkeleton key={`foryou - skeleton - 2 - ${i} `} />
                  ))}
                </View>
              </View>
            ) : forYouProducts.length > 0 ? (
              <View>
                <View style={styles.gridRow}>
                  {forYouProducts.filter((_, index) => index % 2 === 0).map((product) => (
                    <ProductCard
                      key={product.id}
                      name={product.name}
                      price={product.price}
                      emoji={product.emoji}
                      image={product.image}
                      rating={product.rating}
                      reviews={product.reviews}
                      shipping={product.shipping}
                      outOfStock={product.outOfStock}
                      badge={product.badge}
                      onPress={() => handleProductPress(product.id)}
                      onLike={() => handleToggleFavorite(product.id)}
                      isLiked={product.isFavorited || false}
                      variant="default"
                      style={{ width: 140 }}
                    />
                  ))}
                </View>

                <View style={styles.gridRow}>
                  {forYouProducts.filter((_, index) => index % 2 === 1).map((product) => (
                    <ProductCard
                      key={product.id}
                      name={product.name}
                      price={product.price}
                      emoji={product.emoji}
                      image={product.image}
                      rating={product.rating}
                      reviews={product.reviews}
                      shipping={product.shipping}
                      outOfStock={product.outOfStock}
                      badge={product.badge}
                      onPress={() => handleProductPress(product.id)}
                      onLike={() => handleToggleFavorite(product.id)}
                      isLiked={product.isFavorited || false}
                      variant="default"
                      style={{ width: 140 }}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products available</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Hot at Culturar section */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hot at Culturar 🔥</Text>
            {!loading && hotProducts.length > 0 && (
              <TouchableOpacity
                onPress={() => router.navigate({
                  pathname: '/(tabs)/Browse',
                  params: {
                    sortBy: 'popularity',
                    timestamp: Date.now()
                  }
                })}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMore}>View More ›</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <ProductCardSkeleton key={`hot - skeleton - ${i} `} variant="large" />
              ))
            ) : hotProducts.length > 0 ? (
              hotProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price={product.price}
                  emoji={product.emoji}
                  image={product.image}
                  rating={product.rating}
                  reviews={product.reviews}
                  shipping={product.shipping}
                  outOfStock={product.outOfStock}
                  badge="HOT"
                  onPress={() => handleProductPress(product.id)}
                  onLike={() => handleToggleFavorite(product.id)}
                  isLiked={product.isFavorited || false}
                  variant="large"
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hot products available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 0,
  },
  recentlyViewedSection: {
    marginBottom: 0,
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 0,
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: 5,
  },
  lastSection: {
    paddingBottom: 0,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  viewMore: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '600',
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    paddingRight: 6,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.neutral[600],
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.neutral[500],
    textAlign: 'center',
  },

  // Skeleton styles for Recently Viewed
  skeletonRecentlyViewed: {
    width: 100,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  skeletonRecentlyViewedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  skeletonRecentlyViewedText: {
    width: '80%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonRecentlyViewedTextSmall: {
    width: '60%',
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },

  // Skeleton styles for Product Cards
  skeletonProductCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  skeletonProductCardLarge: {
    width: 200,
    marginRight: 15,
  },
  skeletonProductImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E0E0E0',
  },
  skeletonProductImageLarge: {
    height: 200,
  },
  skeletonProductContent: {
    padding: 12,
  },
  skeletonProductPrice: {
    width: '50%',
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonProductName: {
    width: '100%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonProductNameShort: {
    width: '80%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonProductRating: {
    width: '60%',
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
});

export default Home;