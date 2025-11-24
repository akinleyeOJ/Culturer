import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl, ActivityIndicator } from "react-native";
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

const Home = () => {
  const { user } = useAuth();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);
  const [hotProducts, setHotProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
    // TODO: Navigate to product detail
    // router.push(`/(product)/${productId}`);
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

  // Calculate wishlist count from favorited products
  const wishlistCount = [...forYouProducts, ...hotProducts]
    .filter(p => p.isFavorited).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>Loading amazing products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HomeHeader
        userName={
          user?.user_metadata?.full_name || 
          user?.email?.split("@")[0] || 
          "User"
        }
        userAvatar="https://via.placeholder.com/150"
        wishlistCount={wishlistCount}
        onSearchPress={() => Alert.alert('Search', 'Search functionality coming soon!')}
        onWishlistPress={() => Alert.alert('Wishlist', 'Navigate to wishlist')}
      />

      <ScrollView 
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
      >
        {/* Recently Viewed section */}
        {user && recentlyViewed.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Viewed</Text>
              <TouchableOpacity 
                onPress={() => Alert.alert('Recently Viewed', 'View all recently viewed products')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMore}>View More ›</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {recentlyViewed.map((product) => (
                <RecentlyViewedCard
                  key={product.id}
                  name={product.name}
                  price={product.price}
                  emoji={product.emoji}
                  image={product.image}
                  onPress={() => handleProductPress(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* For You section - 2 ROW GRID */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For You 👀</Text>
            <TouchableOpacity 
              onPress={() => Alert.alert('For You', 'View all personalized products')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMore}>View More ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            snapToInterval={300} // Snap to show 2 cards at a time
            decelerationRate="fast"
            snapToAlignment="start"
          >
            <View>
              {/* Row 1 */}
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
              
              {/* Row 2 */}
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
          </ScrollView>
        </View>

        {/* Hot at Culturar section */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hot at Culturar 🔥</Text>
            <TouchableOpacity 
              onPress={() => Alert.alert('Hot Products', 'View all trending products')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMore}>View More ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {hotProducts.map((product) => (
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
            ))}
          </ScrollView>
        </View>

        {/* Spacer for bottom */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.neutral[600],
  },
  section: {
    marginBottom: 0,
    backgroundColor: '#fff',
    paddingVertical: 20,
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
    paddingRight: 16, // Changed from 60 to align better at the end
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  bottomSpacer: {
    height: 40, // Removed extra spacing
  },
});

export default Home;