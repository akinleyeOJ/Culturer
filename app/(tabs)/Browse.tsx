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
  Alert,
  FlatList
} from "react-native";
// Removed SafeAreaView import as we use View now
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "../../constants/color";
import { ProductCard } from "../../components/Card";
import BrowseHeader from "../../components/BrowseHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { fetchAllProducts, toggleFavorite, fetchWishlistCount } from "../../lib/services/productService";
import { CATEGORIES } from "../../constants/categories";

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

const Browse = () => {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ search?: string; category?: string; subcategory?: string }>();

  // Helper to get initial category from params
  const getInitialCategory = () => {
    if (params.category) {
      return CATEGORIES.find(c => c.name === params.category || c.id === params.category)?.id || "all";
    }
    return "all";
  };

  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Initialize state directly from params
  const [selectedCategory, setSelectedCategory] = useState(getInitialCategory());
  const [searchQuery, setSearchQuery] = useState(params.search || "");

  // Track the latest request
  const lastRequestId = useRef(0);

  // Handle incoming params updates
  useEffect(() => {
    if (params.search !== undefined && params.search !== searchQuery) {
      setSearchQuery(params.search);
      setSelectedCategory("all");
    }

    if (params.category) {
      const categoryId = CATEGORIES.find(c => c.name === params.category || c.id === params.category)?.id || "all";
      if (categoryId !== selectedCategory) {
        setSelectedCategory(categoryId);
        setSearchQuery(""); 
      }
    }
  }, [params.search, params.category]);

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadWishlistCount = async () => {
    if (!user) {
      setWishlistCount(0);
      return;
    }
    const count = await fetchWishlistCount(user.id);
    setWishlistCount(count);
  };

  const loadProducts = async (reset = false) => {
    if (!reset && (isLoading || !hasMore)) return;

    const currentRequestId = ++lastRequestId.current;
    
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

      if (currentRequestId !== lastRequestId.current) return;

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
      if (currentRequestId === lastRequestId.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setRefreshing(false);
        setHasLoadedOnce(true);
      }
    }
  };

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

    setProducts(currentProducts =>
      currentProducts.map(p =>
        p.id === productId
          ? { ...p, isFavorited: !p.isFavorited }
          : p
      )
    );

    const { success } = await toggleFavorite(user.id, productId);

    if (success) {
      loadWishlistCount();
    } else {
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

  useEffect(() => {
    loadProducts(true);
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

  // --- Components for FlatList ---

  // 1. Header Component (Categories, Clear Search, Filter)
  const ListHeader = () => (
    <View>
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

      {/* Clear Search Button */}
      {searchQuery && (
        <View style={styles.clearSearchContainer}>
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery("")}
          >
            <FontAwesome name="times-circle" size={14} color={Colors.neutral[500]} style={{ marginRight: 6 }} />
            <Text style={styles.clearSearchText}>Clear search: "{searchQuery}"</Text>
          </TouchableOpacity>
        </View>
      )}

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
    </View>
  );

  // 2. Footer Component (Load More / Empty State)
  const ListFooter = () => (
    <View style={styles.footerContainer}>
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

      {!isLoading && hasLoadedOnce && products.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No items found</Text>
          <Text style={styles.emptyStateSubtext}>Try a different search term or category</Text>
        </View>
      )}
    </View>
  );

  // 3. Render Item
  const renderItem = ({ item }: { item: Product }) => (
    <ProductCard
      key={item.id}
      name={item.name}
      price={item.price}
      image={item.image}
      emoji={item.emoji}
      rating={item.rating}
      reviews={item.reviews}
      shipping={item.shipping}
      isLiked={item.isFavorited}
      onLike={() => handleToggleFavorite(item.id)}
      style={{ width: COLUMN_WIDTH, marginBottom: 16 }}
      onPress={() => { }}
    />
  );

  return (
    <View style={styles.container}>
      <BrowseHeader
        wishlistCount={wishlistCount}
        isScrolled={isScrolled}
        onWishlistPress={() => Alert.alert('Wishlist', 'Navigate to wishlist')}
      />

      <Animated.FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        
        // Refresh Control
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[500]}
          />
        }
        
        // Scroll Animation Props
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll
          }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
  footerContainer: {
    paddingHorizontal: 16,
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
  clearSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  clearSearchText: {
    fontSize: 13,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
});

export default Browse;