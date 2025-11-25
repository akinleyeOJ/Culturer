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
  toggleFavorite,
  trackProductView 
} from "../../lib/services/productService";
import { useAuth } from "../../contexts/AuthContext";

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
  const { user } = useAuth();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);
  const [hotProducts, setHotProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load all products
  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const [recentlyViewedData, forYouData, hotData] = await Promise.all([
        user ? fetchRecentlyViewed(user.id) : Promise.resolve([]),
        fetchForYouProducts(user?.id),
        fetchHotProducts(user?.id),
      ]);

      setRecentlyViewed(recentlyViewedData);
      setForYouProducts(forYouData);
      setHotProducts(hotData);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle favorite toggle with optimistic update
  const handleLike = async (productId: string) => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to favorite products");
      return;
    }

    // Optimistically update UI
    const updateProducts = (products: Product[]) => 
      products.map(p => 
        p.id === productId ? { ...p, isFavorited: !p.isFavorited } : p
      );

    setForYouProducts(prev => updateProducts(prev));
    setHotProducts(prev => updateProducts(prev));

    try {
      const result = await toggleFavorite(user.id, productId);
      
      if (!result.success) {
        // Revert on error
        setForYouProducts(prev => updateProducts(prev));
        setHotProducts(prev => updateProducts(prev));
        Alert.alert('Error', 'Failed to update favorite. Please try again.');
      }
    } catch (error) {
      // Revert on error
      setForYouProducts(prev => updateProducts(prev));
      setHotProducts(prev => updateProducts(prev));
      console.error('Error toggling favorite:', error);
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
    Alert.alert('Product', `Opening product: ${productId}`);
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, []);

  // Calculate wishlist count from favorited products
  const wishlistCount = useMemo(() => {
    const allProducts = [...forYouProducts, ...hotProducts];
    const favoritedProducts = allProducts.filter(p => p.isFavorited);
    const uniqueFavoritedIds = new Set(favoritedProducts.map(p => p.id));
    return uniqueFavoritedIds.size;
  }, [forYouProducts, hotProducts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HomeHeader
        userName={
          user?.user_metadata?.full_name || 
          user?.email?.split("@")[0] || 
          "User"
        }
        userAvatar="https://via.placeholder.com/150"
        wishlistCount={wishlistCount}
        isScrolled={isScrolled}
        onSearchPress={() => Alert.alert('Search', 'Search functionality coming soon!')}
        onWishlistPress={() => Alert.alert('Wishlist', 'Navigate to wishlist')}
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
        {user && (
          <View style={styles.recentlyViewedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Viewed</Text>
              {!loading && recentlyViewed.length > 0 && (
                <TouchableOpacity 
                  onPress={() => Alert.alert('Recently Viewed', 'View all recently viewed products')}
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
                Array.from({ length: 4 }).map((_, i) => (
                  <RecentlyViewedSkeleton key={`rv-skeleton-${i}`} />
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
                    <ProductCardSkeleton key={`foryou-skeleton-1-${i}`} />
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ProductCardSkeleton key={`foryou-skeleton-2-${i}`} />
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
                      onLike={() => handleLike(product.id)}
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
                      onLike={() => handleLike(product.id)}
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
                onPress={() => Alert.alert('Hot Products', 'View all trending products')}
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
                <ProductCardSkeleton key={`hot-skeleton-${i}`} variant="large" />
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
                  onLike={() => handleLike(product.id)}
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

// ... keep your existing styles the same
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