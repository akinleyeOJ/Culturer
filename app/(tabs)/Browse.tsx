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
import { XCircleIcon, AdjustmentsHorizontalIcon } from 'react-native-heroicons/outline';
import { Colors } from "../../constants/color";
import { ProductCard, ProductCardSkeleton } from "../../components/Card";
import BrowseHeader from "../../components/BrowseHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { fetchProducts, toggleFavorite, fetchWishlistCount, trackProductView } from "../../lib/services/productService";
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
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    search?: string;
    category?: string;
    subcategory?: string;
    sortBy?: string;
    minPrice?: string;
    maxPrice?: string;
    condition?: string;
    shipping?: string;
    culture?: string;
    resetFilters?: string;
  }>();

  // Helper to get initial categories from params
  const getInitialCategories = () => {
    if (params.category) {
      const categoryId = CATEGORIES.find(c => c.name === params.category || c.id === params.category)?.id;
      return categoryId ? [categoryId] : [];
    }
    return [];
  };

  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Initialize state directly from params - now an array
  const [selectedCategories, setSelectedCategories] = useState<string[]>(getInitialCategories());
  const [searchQuery, setSearchQuery] = useState(params.search || "");
  const [sortBy, setSortBy] = useState<any>(params.sortBy || "newest");
  const [minPrice, setMinPrice] = useState(params.minPrice ? Number(params.minPrice) : undefined);
  const [maxPrice, setMaxPrice] = useState(params.maxPrice ? Number(params.maxPrice) : undefined);
  const [condition, setCondition] = useState(params.condition as string || undefined);
  const [shipping, setShipping] = useState(params.shipping as string || undefined);
  const [culture, setCulture] = useState(params.culture as string || undefined);

  // Track the latest request
  const lastRequestId = useRef(0);

  // Handle incoming params updates
  useEffect(() => {
    if (params.search !== undefined && params.search !== searchQuery) {
      setSearchQuery(params.search);
      setSelectedCategories([]);
    }
  }, [params.search]);

  useEffect(() => {
    // Only apply category from params if it's actually changing (from navigation)
    if (params.category) {
      const categoryId = CATEGORIES.find(c => c.name === params.category || c.id === params.category)?.id;
      if (categoryId && !selectedCategories.includes(categoryId)) {
        console.log('useEffect setting category from params:', params.category);
        setSelectedCategories([categoryId]);
        setSearchQuery("");
      }
    }
  }, [params.category]);

  useEffect(() => {
    if (params.sortBy) {
      setSortBy(params.sortBy);
      if (!params.search) {
        setSearchQuery("");
      }
    }
    if (params.minPrice) setMinPrice(Number(params.minPrice));
    if (params.maxPrice) setMaxPrice(Number(params.maxPrice));
    if (params.condition) setCondition(params.condition as string);
    if (params.shipping) setShipping(params.shipping as string);
    if (params.culture) setCulture(params.culture as string);

    // Reset filters if explicitly requested
    if (params.resetFilters) {
      setSortBy("newest");
      setMinPrice(undefined);
      setMaxPrice(undefined);
      setCondition(undefined);
      setShipping(undefined);
      setCulture(undefined);
    }
  }, [params.sortBy, params.minPrice, params.maxPrice, params.condition, params.shipping, params.culture, params.resetFilters]);

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
      const { products: newProducts, count } = await fetchProducts(
        currentPage,
        12,
        {
          categories: selectedCategories,
          searchQuery,
          sortBy,
          minPrice,
          maxPrice,
          condition,
          shipping,
          culture
        },
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

  const handleProductPress = async (productId: string) => {
    if (user) {
      await trackProductView(user.id, productId);
    }
    router.push(`/item/${productId}`);
  };

  useEffect(() => {
    loadProducts(true);
  }, [selectedCategories, searchQuery, user, sortBy, minPrice, maxPrice, condition, shipping, culture]);

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
  const ListHeader = React.useMemo(() => (
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
                selectedCategories.includes(category.id) && styles.categoryChipActive
              ]}
              onPress={() => {
                console.log('Category clicked:', category.id, 'Current:', selectedCategories);
                if (selectedCategories.includes(category.id)) {
                  // Remove this category
                  console.log('Removing category:', category.id);
                  setSelectedCategories(selectedCategories.filter(c => c !== category.id));
                } else {
                  // Add this category
                  console.log('Adding category:', category.id);
                  setSelectedCategories([...selectedCategories, category.id]);
                }
              }}
            >
              <Text style={[
                styles.categoryText,
                selectedCategories.includes(category.id) && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Active Filters / Search */}
      {(searchQuery || sortBy !== 'newest' || minPrice !== undefined || maxPrice !== undefined || condition !== undefined || shipping !== undefined || culture !== undefined) && (
        <View style={styles.activeFiltersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersContent}>
            {/* Clear Search */}
            {searchQuery ? (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => {
                  setSearchQuery("");
                  router.setParams({ search: undefined });
                }}
              >
                <XCircleIcon size={14} color={Colors.neutral[500]} style={{ marginRight: 6 }} />
                <Text style={styles.clearSearchText}>Search: "{searchQuery}"</Text>
              </TouchableOpacity>
            ) : null}

            {/* Reset Filters */}
            {(sortBy !== 'newest' || minPrice !== undefined || maxPrice !== undefined || condition !== undefined || shipping !== undefined || culture !== undefined) && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => {
                  setSortBy('newest');
                  setMinPrice(undefined);
                  setMaxPrice(undefined);
                  setCondition(undefined);
                  setShipping(undefined);
                  setCulture(undefined);
                  router.setParams({
                    sortBy: undefined,
                    minPrice: undefined,
                    maxPrice: undefined,
                    condition: undefined,
                    shipping: undefined,
                    culture: undefined
                  });
                }}
              >
                <XCircleIcon size={14} color={Colors.neutral[500]} style={{ marginRight: 6 }} />
                <Text style={styles.clearSearchText}>Filters Active</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Results & Filter Row */}
      <View style={styles.filterRow}>
        <Text style={styles.resultsText}>
          {totalCount} results
        </Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => router.push({
            pathname: '/filter',
            params: {
              search: searchQuery,
              categories: selectedCategories.join(','),
              minPrice: minPrice?.toString(),
              maxPrice: maxPrice?.toString(),
              condition,
              shipping,
              culture,
              sortBy
            }
          })}
        >
          <AdjustmentsHorizontalIcon size={14} color={Colors.primary[500]} style={styles.filterIcon} />
          <Text style={styles.filterButtonText}>Filter</Text>
          {(sortBy !== 'newest' || minPrice !== undefined || maxPrice !== undefined || condition !== undefined || shipping !== undefined || culture !== undefined) && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {[
                  sortBy !== 'newest',
                  minPrice !== undefined,
                  maxPrice !== undefined,
                  condition !== undefined,
                  shipping !== undefined,
                  culture !== undefined
                ].filter(Boolean).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  ), [selectedCategories, searchQuery, sortBy, minPrice, maxPrice, condition, shipping, culture, totalCount]);

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
      onPress={() => handleProductPress(item.id)}
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
        data={isLoading && products.length === 0 ? Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}`, skeleton: true } as any)) : products}
        renderItem={({ item }) => {
          if (item.skeleton) {
            return <ProductCardSkeleton style={{ width: COLUMN_WIDTH, marginBottom: 16 }} />;
          }
          return renderItem({ item });
        }}
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
  activeFiltersContainer: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  activeFiltersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  clearSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  clearSearchText: {
    fontSize: 13,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  filterBadge: {
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default Browse;