import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, ScrollView, Alert, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/Button";
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

// Type definitions
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

  // State for products
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);
  const [hotProducts, setHotProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load all products
  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch all sections in parallel
      const [recentlyViewedData, forYouData, hotData] = await Promise.all([
        user ? fetchRecentlyViewed(user.id) : [],
        fetchForYouProducts(user?.id),
        fetchHotProducts(user?.id),
      ]);

      setRecentlyViewed(recentlyViewedData);
      setForYouProducts(forYouData);
      setHotProducts(hotData);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };
  // Handle favorite toggle
  const handleLike = async (productId: string) => {
    if (!user) {
      // Show login prompt
      Alert.alert("Sign in required", "Please sign in to favorite products");
      return;
    }

    try {
      await toggleFavorite(user.id, productId);
      // Refresh products to update favorite status
      loadProducts();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Handle product press
  const handleProductPress = async (productId: string) => {
    if (user) {
      await trackProductView(user.id, productId);
    }
    // Navigate to product detail
    // router.push(`/product/${productId}`);
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
  const wishlistCount = [...forYouProducts, ...hotProducts].filter(p => p.isFavorited).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Home Header section*/}
      <HomeHeader
        userName={
          user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
        }
        userAvatar="https://via.placeholder.com/150"
        wishlistCount={wishlistCount}
        onSearchPress={() => console.log("Search pressed")}
        onWishlistPress={() => console.log("Wishlist pressed")}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Recently Viewed section - only show if user is logged in and has history */}
        {user && recentlyViewed.length > 0 && (
          <View style={styles.recentlyViewedContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Viewed</Text>

              <TouchableOpacity 
                onPress={() => console.log("View All Recently Viewed")}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMore}>View More ›</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentlyViewedScroll}
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

        {/* For You section*/}
        <View style={styles.forYouContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For You 👀</Text>

            <TouchableOpacity 
              onPress={() => console.log("View All For You")}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMore}>View More ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forYouScroll}
          >
            {forYouProducts.map((product) => (
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
                onPress={() => handleProductPress(product.id)}
                onLike={() => handleLike(product.id)}
                isLiked={product.isFavorited || false}
                variant="default"
              />
            ))}
          </ScrollView>
        </View>

        {/* Hot Products section*/}
        <View style={styles.hotProductsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hot at Culturar 🔥</Text>

            <TouchableOpacity 
              onPress={() => console.log("View Hot Products")}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMore}>View More ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hotProductsScroll}
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
                onPress={() => handleProductPress(product.id)}
                onLike={() => handleLike(product.id)}
                isLiked={product.isFavorited || false}
                variant="large"
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212529",
  },
  viewMore: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: "600",
  },

  // recently viewed styling
  recentlyViewedContainer: {
    marginBottom: 10,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },
  recentlyViewedScroll: {
    paddingLeft: 20,
    paddingRight: 20,
  },

  // for you styling
  forYouContainer: {
    marginBottom: 10,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
  },
  forYouScroll: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 12,
  },

  // hot products styling
  hotProductsContainer: {
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "#fff",
  },
  hotProductsScroll: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 15,
  },
});

export default Home;
