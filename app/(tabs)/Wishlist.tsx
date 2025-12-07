import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Image,
  Alert,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../../constants/color";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { fetchWishlist, toggleFavorite, trackProductView } from "../../lib/services/productService";
import { addToCart } from "../../lib/services/cartService";
import { CATEGORIES } from "../../constants/categories";
import { CartToast } from "../../components/CartToast";
import CustomButton from "../../components/Button";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ShoppingBagIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  BellIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import { Swipeable } from "react-native-gesture-handler";

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Product {
  id: string;
  name: string;
  price: string;
  image?: string;
  shipping?: string;
  rating?: number;
  reviews?: number;
  outOfStock?: boolean;
  category?: string | null;
  // Extra fields for filtering simulation
  condition?: string;
  culture?: string;
}

const WishlistItem = ({
  item,
  onPress,
  onDelete,
  onMenuPress,
  onSwipeStart,
  onAddToCart,
}: {
  item: Product,
  onPress: () => void,
  onDelete: () => void,
  onMenuPress: () => void,
  onSwipeStart: (ref: Swipeable) => void,
  onAddToCart: () => void,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (_progress: any, _dragX: any) => {
    return (
      <View style={styles.deleteActionContainer}>
        <TouchableOpacity onPress={onDelete} style={styles.deleteAction}>
          <View style={styles.deleteContent}>
            <TrashIcon color="white" size={24} />
            <Text style={styles.deleteText}>Delete</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current) onSwipeStart(swipeableRef.current);
      }}
      overshootRight={false}
      rightThreshold={40}
    >
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.imageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} />
          ) : (
            <View style={[styles.image, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
              <Text>No Image</Text>
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
            <TouchableOpacity onPress={(e) => {
              e.stopPropagation();
              onMenuPress();
            }} hitSlop={10} style={{ padding: 4 }}>
              <EllipsisHorizontalIcon size={24} color={Colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.price}>{item.price}</Text>

          {item.shipping && (
            <Text style={styles.shipping}>+ {item.shipping}</Text>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.watchers}>{item.reviews} reviews · {item.rating?.toFixed(1)} ★</Text>

            <TouchableOpacity
              style={[
                styles.addToCartButton,
                item.outOfStock && styles.addToCartButtonDisabled
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (!item.outOfStock) onAddToCart();
              }}
              disabled={item.outOfStock}
            >
              <Text style={[
                styles.addToCartText,
                item.outOfStock && styles.addToCartTextDisabled
              ]}>
                {item.outOfStock ? 'OUT OF STOCK' : 'TO CART'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

// Custom Bottom Sheet for Actions
const ActionSheet = ({ visible, onClose, item, onEnableNotifications, onRemove }: any) => {
  if (!visible || !item) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.actionSheetContainer}>
          <View style={styles.dragHandle} />
          <Text style={styles.actionSheetTitle} numberOfLines={1}>{item.name}</Text>

          <TouchableOpacity style={styles.actionItem} onPress={onEnableNotifications}>
            <BellIcon size={24} color={Colors.text.primary} />
            <Text style={styles.actionText}>Enable Notifications</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.actionItem} onPress={onRemove}>
            <TrashIcon size={24} color={Colors.danger[500]} />
            <Text style={[styles.actionText, { color: Colors.danger[500] }]}>Remove from Wishlist</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Custom Drawer for Filter Modal (Slide from right)
const FilterDrawer = ({ visible, onClose, onApply, initialFilters }: any) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [minPrice, setMinPrice] = useState(initialFilters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice || '');
  const [condition, setCondition] = useState(initialFilters.condition || '');
  const [shipping, setShipping] = useState(initialFilters.shipping || '');
  const [culture, setCulture] = useState(initialFilters.culture || '');
  const [sortBy, setSortBy] = useState(initialFilters.sortBy || 'newest');

  const conditions = ['new', 'like_new', 'good', 'fair'];
  const sortOptions = [
    { label: 'Newest Arrivals', value: 'newest' },
    { label: 'Most Popular (Trending)', value: 'popularity' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
  ];

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setShipping('');
    setCulture('');
    setSortBy('newest');
  };

  useEffect(() => {
    if (visible) {
      // Initialize state before opening
      setMinPrice(initialFilters.minPrice || '');
      setMaxPrice(initialFilters.maxPrice || '');
      setCondition(initialFilters.condition || '');
      setShipping(initialFilters.shipping || '');
      setCulture(initialFilters.culture || '');
      setSortBy(initialFilters.sortBy || 'newest');

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} zIndex={1000}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[
          styles.drawerBackdrop,
          { opacity: backdropAnim }
        ]} />
      </TouchableWithoutFeedback>

      {/* Drawer Content */}
      <Animated.View style={[
        styles.drawerContent,
        { transform: [{ translateX: slideAnim }] }
      ]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.filterHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XMarkIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.filterHeaderTitle}>Filters & Sort</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.filterContent}>
            {/* Sort By */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sort By</Text>
              <View style={styles.chipContainer}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, sortBy === option.value && styles.activeChip]}
                    onPress={() => setSortBy(option.value)}
                  >
                    <Text style={[styles.chipText, sortBy === option.value && styles.activeChipText]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price Range</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  keyboardType="numeric"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
                <Text style={styles.priceDash}>-</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  keyboardType="numeric"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
            </View>

            {/* Condition */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Condition</Text>
              <View style={styles.chipContainer}>
                {conditions.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, condition === c && styles.activeChip]}
                    onPress={() => setCondition(condition === c ? '' : c)}
                  >
                    <Text style={[styles.chipText, condition === c && styles.activeChipText]}>
                      {c.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Culture / Region */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Culture / region</Text>
              <View style={styles.chipContainer}>
                {['All cultures', 'Africa', 'Asia', 'Latin America', 'Middle East', 'Europe', 'Pacific'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      (culture === c || (c === 'All cultures' && !culture)) && styles.activeChip
                    ]}
                    onPress={() => setCulture(c === 'All cultures' ? '' : c)}
                  >
                    <Text style={[
                      styles.chipText,
                      (culture === c || (c === 'All cultures' && !culture)) && styles.activeChipText
                    ]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Shipping */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping</Text>
              <View style={styles.chipContainer}>
                {['All', 'Free Shipping', 'Express Available', 'Pickup Available'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      (shipping === s || (s === 'All' && !shipping)) && styles.activeChip
                    ]}
                    onPress={() => setShipping(s === 'All' ? '' : s)}
                  >
                    <Text style={[
                      styles.chipText,
                      (shipping === s || (s === 'All' && !shipping)) && styles.activeChipText
                    ]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.filterFooter}>
            <CustomButton
              title="Apply Filters"
              onPress={() => {
                onApply({ minPrice, maxPrice, condition, shipping, culture, sortBy });
                onClose();
              }}
              style={{ width: '100%' }}
            />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const Wishlist = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { cartCount, refreshCartCount } = useCart();

  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Multiple Selection State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Filter State
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    condition: '',
    shipping: '',
    culture: '',
    sortBy: 'newest'
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Action Sheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<Product | null>(null);

  // Track open swipeable
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      setWishlistItems([]);
      return;
    }

    if (!refreshing) setLoading(true);

    try {
      const items = await fetchWishlist(user.id);
      setWishlistItems(items);
    } catch (error) {
      console.error("Failed to load wishlist", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      return () => {
        openSwipeableRef.current?.close();
      };
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const removeItem = async (productId: string) => {
    if (!user) return;

    // Close helpers
    openSwipeableRef.current?.close();
    setActionSheetVisible(false);

    const previousItems = [...wishlistItems];
    setWishlistItems(prev => prev.filter(p => p.id !== productId));

    const { success } = await toggleFavorite(user.id, productId);
    if (!success) {
      setWishlistItems(previousItems);
      Alert.alert("Error", "Failed to remove item");
    }
  };

  const handleAddToCart = async (item: Product) => {
    if (!user) return;

    const { success } = await addToCart(user.id, item.id, 1);
    if (success) {
      refreshCartCount();
      // Show Toast instead of Alert
      setToastMessage("Added to cart");
      setToastVisible(true);
    } else {
      Alert.alert("Error", "Failed to add to cart");
    }
  };

  const handleMenuPress = (item: Product) => {
    setSelectedActionItem(item);
    setActionSheetVisible(true);
  };

  const handleSwipeStart = (ref: Swipeable) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) {
        return prev.filter(c => c !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  const filteredItems = useMemo(() => {
    let result = wishlistItems.filter(item => {
      // 1. Search
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Categories
      if (selectedCategories.length > 0) {
        if (!item.category) return false;
        // Check if any of the selected categories match (id or name)
        const itemCatLower = item.category.toLowerCase();
        const hasMatch = selectedCategories.some(selectedId => {
          const catDef = CATEGORIES.find(c => c.id === selectedId);
          if (!catDef) return false;
          return itemCatLower === catDef.id || itemCatLower === catDef.name.toLowerCase();
        });
        if (!hasMatch) return false;
      }

      // 3. Filters
      if (filters.minPrice) {
        const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        if (price < parseFloat(filters.minPrice)) return false;
      }
      if (filters.maxPrice) {
        const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        if (price > parseFloat(filters.maxPrice)) return false;
      }
      if (filters.shipping && filters.shipping !== 'All') {
        // Simulating shipping filter: usually data is needed
        if (filters.shipping === 'Free Shipping' && item.shipping !== 'Free') return false;
      }
      // Note: Condition and Culture are not in the basic Product interface for wishlist list view
      // We assume if they were there, we'd filter. Skipping for now as mock data might not have it.

      return true;
    });

    // 4. Sort
    if (filters.sortBy) {
      result = [...result].sort((a, b) => {
        const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
        const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));

        switch (filters.sortBy) {
          case 'price_asc': return priceA - priceB;
          case 'price_desc': return priceB - priceA;
          // 'newest' and 'popularity' usually require backend date/popularity metrics
          // For now, assuming wishlist order is vaguely recent
          default: return 0;
        }
      });
    }

    return result;
  }, [wishlistItems, searchQuery, selectedCategories, filters]);

  const activeFilterCount = useMemo(() => {
    return [
      filters.minPrice,
      filters.maxPrice,
      filters.condition,
      filters.shipping,
      filters.culture,
      filters.sortBy !== 'newest'
    ].filter(Boolean).length;
  }, [filters]);

  // Keep state active longer for animation purposes on close, or just rely on 'visible' prop to hide
  // But we want to animate out, so we need to render it as long as the animation is running. 
  // The 'visible' prop in FilterDrawer handles hiding content after animation? 
  // No, in my implementation above: if !visible return null. This breaks exit animation.
  // I need to delay the unmount. Or simpler: Always render it but translate it off screen.
  // For performance, better to use a state 'renderDrawer' which is set to false after exit anim?
  // Let's refine FilterDrawer to handle exit animation correctly.
  // Actually, easiest way is to let Wishlist keep it 'visible' but manage the closing.
  // Wait, if !visible return null immediately removes it. So exit animation won't play.
  // Rewriting FilterDrawer slightly to handle this:
  // It needs to be always rendered or using a persistent state.
  // Let's modify Wishlist to just pass visible to it, and FilterDrawer manages internal visibility?
  // No, standard pattern is conditional rendering + AnimatePresence (not in RN core easily).
  // I will make it always return the view, but pointerEvents='none' if hidden and translate offscreen.

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CartToast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        onViewCart={() => router.push('/cart')}
      />

      {/* Persistent Drawer with internal visibility logic or just always rendered hidden */}
      <FilterDrawer
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={setFilters}
        initialFilters={filters}
      />

      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>Wishlists</Text>

          <TouchableOpacity onPress={() => router.push('/cart')} style={styles.cartButton}>
            <ShoppingBagIcon size={24} color={Colors.text.primary} />
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MagnifyingGlassIcon size={20} color={Colors.neutral[500]} />
            <TextInput
              style={styles.input}
              placeholder="Search in Wishlists"
              placeholderTextColor={Colors.neutral[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <XCircleIcon size={20} color={Colors.neutral[500]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories Horizontal Scroll */}
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategories.length === 0 && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategories([])}
            >
              <Text style={[
                styles.categoryText,
                selectedCategories.length === 0 && styles.categoryTextActive
              ]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategories.includes(cat.id) && styles.categoryChipActive
                ]}
                onPress={() => toggleCategory(cat.id)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategories.includes(cat.id) && styles.categoryTextActive
                ]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          {/* Reuse logic for results count if needed, or just keep simple for now */}
          <View style={{ flex: 1 }}>
            <Text style={styles.resultsText}>{filteredItems.length} items</Text>
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <AdjustmentsHorizontalIcon size={14} color={Colors.primary[500]} style={styles.filterIcon} />
            <Text style={styles.filterButtonText}>Filter</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={({ item }) => (
          <WishlistItem
            item={item}
            onPress={() => {
              if (user) trackProductView(user.id, item.id);
              router.push(`/item/${item.id}`);
            }}
            onDelete={() => removeItem(item.id)}
            onMenuPress={() => handleMenuPress(item)}
            onSwipeStart={(ref) => handleSwipeStart(ref)}
            onAddToCart={() => handleAddToCart(item)}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[500]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No saved items found.</Text>
            </View>
          ) : null
        }
      />

      {/* Custom Action Sheet Modal */}
      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        item={selectedActionItem}
        onEnableNotifications={() => {
          setActionSheetVisible(false);
          setToastMessage("Notifications enabled");
          setToastVisible(true);
        }}
        onRemove={() => {
          if (selectedActionItem) removeItem(selectedActionItem.id);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  cartButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary[500],
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text.primary,
    height: 24,
    padding: 0,
  },
  categoriesContainer: {
    marginBottom: 12,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4
  },
  filterIcon: {
    marginRight: 0,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginRight: 4,
  },
  filterBadge: {
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  imageContainer: {
    marginRight: 16,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 20,
    marginRight: 8,
    fontWeight: '400',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 4,
  },
  shipping: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  watchers: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  addToCartButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  addToCartText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addToCartTextDisabled: {
    color: Colors.text.secondary,
  },
  stockWarning: {
    fontSize: 12,
    color: Colors.danger[500],
    fontWeight: '600',
  },
  deleteActionContainer: {
    width: 100,
    backgroundColor: Colors.danger[500],
  },
  deleteAction: {
    flex: 1,
    backgroundColor: Colors.danger[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: 'white',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: Colors.neutral[500],
    fontSize: 16,
  },
  // Modal / ActionSheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral[300],
    alignSelf: 'center',
    borderRadius: 2,
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral[100],
  },
  // Drawer Styles
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '85%',
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  filterHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  resetText: {
    color: Colors.primary[500],
    fontWeight: '600',
  },
  filterContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    backgroundColor: '#fff',
  },
  activeChip: {
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[500],
  },
  chipText: {
    color: Colors.text.secondary,
  },
  activeChipText: {
    color: Colors.primary[700],
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  priceDash: {
    marginHorizontal: 10,
    color: Colors.neutral[500],
  },
  filterFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
});

export default Wishlist;
