import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "../../constants/color";
import { ProductCard } from "../../components/Card";
import BrowseHeader from "../../components/BrowseHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useFocusEffect } from "expo-router";
import { fetchAllProducts, toggleFavorite, fetchWishlistCount } from "../../lib/services/productService";

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // 2 columns with padding

// Interfaces
interface Product {
  id: string;
  name: string;
  price: string;
  emoji: string;
  image?: string;
  rating: number;
  reviews: number;
  shipping: string;
  outOfStock?: boolean;
  category?: string;
  isFavorited?: boolean;
  badge?: "NEW" | "HOT" | null;
}

// Mock Data
const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'art', name: 'Art 🎨' },
  { id: 'music', name: 'Music 🎵' },
  { id: 'fashion', name: 'Fashion 👗' },
  { id: 'tech', name: 'Tech 💻' },
  { id: 'home', name: 'Home 🏠' },
];

const Browse = () => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  // Fetch wishlist count
  const loadWishlistCount = async () => {
    if (!user) {
      setWishlistCount(0);
      return;
    }
    const count = await fetchWishlistCount(user.id);
    setWishlistCount(count);
  };

  // Fetch products
  const loadProducts = async (reset = false) => {
    if (isLoading || (reset ? false : !hasMore)) return;

    const currentPage = reset ? 0 : page;
    if (reset) {
      setIsLoading(true);
      setPage(0);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { products: newProducts, count } = await fetchAllProducts(
        currentPage,
        12,
        selectedCategory,
        searchQuery,
        user?.id
      );

      if (reset) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setTotalCount(count);
      setHasMore(newProducts.length === 12);
      setPage(currentPage + 1);
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  };

  // Reload products and wishlist count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadWishlistCount();
      if (products.length > 0) {
        loadProducts(true);
      }
    }, [user])
  );

  const handleToggleFavorite = async (productId: string) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to save items to your wishlist");
      return;
    }

    // Optimistic update
    setProducts(currentProducts =>
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
      setProducts(currentProducts =>
        currentProducts.map(p =>
          p.id === productId
            ? { ...p, isFavorited: !p.isFavorited }
            : p
        )
      );
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, user]);

  const handleLoadMore = () => {
    loadProducts(false);
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    scrollDirection.current = offsetY > lastScrollY.current ? 'down' : 'up';
    lastScrollY.current = offsetY;

    if (animationTimeout.current) {
      clearTimeout(animationTimeout.current);
    }

    animationTimeout.current = setTimeout(() => {
      const scrollThreshold = 60;

      if (scrollDirection.current === 'down') {
        if (offsetY > scrollThreshold && !isScrolled) {
          setIsScrolled(true);
        }
      } else {
        if (offsetY <= scrollThreshold && isScrolled) {
          setIsScrolled(false);
        } else if (offsetY <= 10 && isScrolled) {
          setIsScrolled(false);
        }
      }
    }, 10);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrowseHeader
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
        scrollEventThrottle={16}
      >
        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results & Filter Row */}
        <View style={styles.filterRow}>
          <Text style={styles.resultsText}>
            {totalCount} results
          </Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => Alert.alert('Filter', 'Filter options coming soon!')}
          >
            <FontAwesome name="sliders" size={14} color={Colors.primary[500]} style={styles.filterIcon} />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {/* Product Grid */}
        <View style={styles.gridContent}>
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                price={product.price}
                image={product.image}
                emoji={product.emoji}
                rating={product.rating}
                reviews={product.reviews}
                shipping={product.shipping}
                isLiked={product.isFavorited}
                onLike={() => handleToggleFavorite(product.id)}
                style={{ width: COLUMN_WIDTH, marginBottom: 16, marginRight: 0 }}
                onPress={() => { }}
              />
            ))}
          </View>

          {hasMore && products.length > 0 && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <View style={styles.loadMoreContent}>
                  <Text style={styles.loadMoreText}>Loading...</Text>
                </View>
              ) : (
                <Text style={styles.loadMoreText}>Load More</Text>
              )}
            </TouchableOpacity>
          )}

          {!isLoading && products.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No items found</Text>
              <Text style={styles.emptyStateSubtext}>Try a different search term or category</Text>
            </View>
          )}
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
    paddingTop: 16,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  categoryChipActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  categoryTextActive: {
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.neutral[500],
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 0, // Remove double padding
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  loadMoreButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 7,
  },
  loadMoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary[500],
  },
});

export default Browse;
