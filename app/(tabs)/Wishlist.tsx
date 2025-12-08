import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Share,
  Platform,
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
  CheckCircleIcon as CheckCircleIconSolid,
  ArrowTrendingDownIcon,
} from "react-native-heroicons/solid";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ShoppingBagIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  BellIcon,
  XMarkIcon,
  ShareIcon,
  CheckCircleIcon as CheckCircleIconOutline,
  ArrowLeftIcon
} from "react-native-heroicons/outline";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Product {
  id: string;
  name: string;
  price: string;
  originalPrice?: string; // For price drop alert
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

// Separated and Cleaned RightAction Component
const RightAction = ({ progress, dragX, onDelete }: { progress: any, dragX: any, onDelete: () => void }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // 1. Handle Opacity: Ensure it's 0 at start to prevent flash
    const opacity = interpolate(
      progress.value,
      [0, 0.05, 0.1], // Start appearing only after 5% swipe
      [0, 0, 1],      // Stay invisible initially, then fade in
      Extrapolation.CLAMP
    );

    // 2. Handle Translation: Slide in from the right
    // dragX goes from 0 to -100 (leftwards)
    // We want translateX to go from 100 (offscreen right) to 0 (visible)
    const translateX = interpolate(
      dragX.value,
      [-100, 0],
      [0, 100],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  return (
    <Reanimated.View style={[styles.deleteActionContainer, animatedStyle]}>
      <TouchableOpacity onPress={onDelete} style={styles.deleteAction} activeOpacity={1}>
        <View style={styles.deleteContent}>
          <TrashIcon color="white" size={24} />
          <Text style={styles.deleteText}>Delete</Text>
        </View>
      </TouchableOpacity>
    </Reanimated.View>
  );
};

const WishlistItem = ({
  item,
  onPress,
  onDelete,
  onMenuPress,
  onSwipeStart,
  onAddToCart,
  isSelectionMode,
  isSelected,
  onLongPress,
  onToggleSelection,
}: {
  item: Product,
  onPress: () => void,
  onDelete: () => void,
  onMenuPress: () => void,
  onSwipeStart: (ref: any) => void,
  onAddToCart: () => void,
  isSelectionMode: boolean,
  isSelected: boolean,
  onLongPress: () => void,
  onToggleSelection: () => void,
}) => {
  const swipeableRef = useRef<any>(null);

  const renderRightActions = useCallback((progress: any, dragX: any) => {
    // Disable swipe actions in selection mode
    if (isSelectionMode) return null;

    return <RightAction progress={progress} dragX={dragX} onDelete={onDelete} />;
  }, [isSelectionMode, onDelete]);

  // Calculate price drop percentage if applicable
  const priceDropPercent = useMemo(() => {
    if (item.originalPrice && item.price) {
      const oldP = parseFloat(item.originalPrice.replace(/[^0-9.]/g, ''));
      const newP = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      if (oldP > newP) {
        return Math.round(((oldP - newP) / oldP) * 100);
      }
    }
    return 0;
  }, [item.price, item.originalPrice]);

  const ItemContent = (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      {isSelectionMode && (
        <View style={styles.selectionContainer}>
          {isSelected ? (
            <CheckCircleIconSolid size={24} color={Colors.primary[500]} />
          ) : (
            <CheckCircleIconOutline size={24} color={Colors.neutral[400]} />
          )}
        </View>
      )}

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
          {!isSelectionMode && (
            <TouchableOpacity onPress={(e) => {
              e.stopPropagation();
              onMenuPress();
            }} hitSlop={10} style={{ padding: 4 }}>
              <EllipsisHorizontalIcon size={24} color={Colors.neutral[500]} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price}</Text>
          {priceDropPercent > 0 && (
            <View style={styles.priceDropBadge}>
              <ArrowTrendingDownIcon size={12} color={Colors.success[700]} />
              <Text style={styles.priceDropText}>{priceDropPercent}% OFF</Text>
            </View>
          )}
        </View>

        {item.shipping && (
          <Text style={styles.shipping}>+ {item.shipping}</Text>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.watchers}>{item.reviews} reviews · {item.rating?.toFixed(1)} ★</Text>

          {!isSelectionMode ? (
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
                {item.outOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}
              </Text>
            </TouchableOpacity>
          ) : (
            item.outOfStock && (
              <Text style={styles.stockWarning}>Out of Stock</Text>
            )
          )}
        </View>
      </View>
    </View>
  );

  if (isSelectionMode) {
    return (
      <TouchableOpacity
        onPress={onToggleSelection}
        onLongPress={onLongPress}
        activeOpacity={1}
      >
        {ItemContent}
      </TouchableOpacity>
    );
  }

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
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.9}
      >
        {ItemContent}
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

// Custom Drawer for Filter Modal
const FilterDrawer = ({ visible, onClose, onApply, initialFilters }: any) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = useState(false);

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
      setIsVisible(true);
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
      ]).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible]);

  if (!isVisible && !visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[
          styles.drawerBackdrop,
          { opacity: backdropAnim }
        ]} />
      </TouchableWithoutFeedback>

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
            {/* Other sections... code reuse */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price Range</Text>
              <View style={styles.filterPriceRow}>
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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
  const [toastAction, setToastAction] = useState<(() => void) | undefined>(undefined);
  const [toastActionLabel, setToastActionLabel] = useState<string | undefined>(undefined);

  // Action Sheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<Product | null>(null);

  // Track open swipeable
  const openSwipeableRef = useRef<any | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      setWishlistItems([]);
      return;
    }

    if (!refreshing) setLoading(true);

    try {
      const items = await fetchWishlist(user.id);

      // Mock Price Drops for demo
      const enhancedItems = items.map((item, index) => {
        if (index % 3 === 0) { // Every 3rd item has a price drop
          const currentPrice = parseFloat(item.price.replace(/[^0-9.]/g, ''));
          const originalPrice = currentPrice * 1.2; // 20% higher
          return {
            ...item,
            originalPrice: `$${originalPrice.toFixed(2)}`
          };
        }
        return item;
      });

      setWishlistItems(enhancedItems);
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
    openSwipeableRef.current?.close();
    setActionSheetVisible(false);

    const previousItems = [...wishlistItems];
    setWishlistItems(prev => prev.filter(p => p.id !== productId));
    const { success } = await toggleFavorite(user.id, productId);
    if (!success) {
      setWishlistItems(previousItems);
      Alert.alert("Error", "Failed to remove item");
    } else {
      setToastMessage("Removed from wishlist");
      setToastAction(undefined);
      setToastActionLabel(undefined);
      setToastVisible(true);
    }
  };

  const handleAddToCart = async (item: Product) => {
    if (!user) return;
    const { success } = await addToCart(user.id, item.id, 1);
    if (success) {
      refreshCartCount();
      setToastMessage("Added to cart");
      setToastAction(() => () => router.push('/cart'));
      setToastActionLabel("View Cart");
      setToastVisible(true);
    } else {
      Alert.alert("Error", "Failed to add to cart");
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      "Delete selected items?",
      `Are you sure you want to remove ${selectedItems.size} items from your wishlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            if (!user) return;
            const itemIds = Array.from(selectedItems);

            // Optimistic update
            const previousItems = [...wishlistItems];
            setWishlistItems(prev => prev.filter(p => !selectedItems.has(p.id)));
            setIsSelectionMode(false);
            setSelectedItems(new Set());

            // Perform deletes
            const results = await Promise.all(itemIds.map(id => toggleFavorite(user.id, id)));
            const failures = results.filter(r => !r.success);

            if (failures.length > 0) {
              Alert.alert("Complete with errors", `Failed to delete ${failures.length} items`);
              // Reload to be safe
              loadData();
            } else {
              setToastMessage(`Removed ${itemIds.length} items`);
              setToastAction(undefined);
              setToastActionLabel(undefined);
              setToastVisible(true);
            }
          }
        }
      ]
    );
  };

  const handleBulkAddToCart = async () => {
    if (selectedItems.size === 0) return;
    if (!user) return;

    const itemIds = Array.from(selectedItems);
    const outOfStockIds = itemIds.filter(id => {
      const item = wishlistItems.find(p => p.id === id);
      return item?.outOfStock;
    });

    const validIds = itemIds.filter(id => !outOfStockIds.includes(id));

    const processAdd = async () => {
      if (validIds.length === 0) {
        setIsSelectionMode(false);
        setSelectedItems(new Set());
        return;
      }

      let successCount = 0;
      for (const id of validIds) {
        const res = await addToCart(user.id, id, 1);
        if (res.success) successCount++;
      }

      refreshCartCount();
      setIsSelectionMode(false);
      setSelectedItems(new Set());
      setToastMessage(`Added ${successCount} items to cart`);
      setToastAction(() => () => router.push('/cart'));
      setToastActionLabel("View Cart");
      setToastVisible(true);
    };

    if (outOfStockIds.length > 0) {
      if (validIds.length === 0) {
        Alert.alert("Unavailable", "All selected items are out of stock.");
        return;
      }
      Alert.alert(
        "Items Unavailable",
        `${outOfStockIds.length} items are out of stock. Add the remaining ${validIds.length} items?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Available", onPress: processAdd }
        ]
      );
    } else {
      processAdd();
    }
  };

  const handleShare = async () => {
    try {
      // Create a nice list of items
      const itemsList = wishlistItems.map(i => `• ${i.name} - ${i.price}`).join('\n');
      const message = `Check out my Wishlist on Culturar! ✨\n\n${itemsList}`;

      await Share.share({
        message,
        title: "My Culturar Wishlist"
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleMenuPress = (item: Product) => {
    setSelectedActionItem(item);
    setActionSheetVisible(true);
  };

  const handleSwipeStart = (ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) return prev.filter(c => c !== catId);
      return [...prev, catId];
    });
  };

  // Selection Logic
  const handleLongPress = (itemId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedItems(new Set([itemId]));
    }
  };

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      // Optional: Auto-exit if empty?
      // if (next.size === 0) setIsSelectionMode(false);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  };

  const filteredItems = useMemo(() => {
    let result = wishlistItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (selectedCategories.length > 0) {
        if (!item.category) return false;
        const itemCatLower = item.category.toLowerCase();
        const hasMatch = selectedCategories.some(selectedId => {
          const catDef = CATEGORIES.find(c => c.id === selectedId);
          if (!catDef) return false;
          return itemCatLower === catDef.id || itemCatLower === catDef.name.toLowerCase();
        });
        if (!hasMatch) return false;
      }

      if (filters.minPrice) {
        const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        if (price < parseFloat(filters.minPrice)) return false;
      }
      if (filters.maxPrice) {
        const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        if (price > parseFloat(filters.maxPrice)) return false;
      }
      return true;
    });

    if (filters.sortBy) {
      result = [...result].sort((a, b) => {
        const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
        const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
        switch (filters.sortBy) {
          case 'price_asc': return priceA - priceB;
          case 'price_desc': return priceB - priceA;
          default: return 0;
        }
      });
    }

    return result;
  }, [wishlistItems, searchQuery, selectedCategories, filters]);

  const activeFilterCount = useMemo(() => [
    filters.minPrice, filters.maxPrice, filters.condition,
    filters.shipping, filters.culture, filters.sortBy !== 'newest'
  ].filter(Boolean).length
    , [filters]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CartToast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        onViewCart={toastAction}
        actionLabel={toastActionLabel}
      />

      <FilterDrawer
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={setFilters}
        initialFilters={filters}
      />

      <View style={styles.header}>
        {/* Top Bar Changes based on Selection Mode */}
        {isSelectionMode ? (
          <View style={styles.selectionTopBar}>
            <TouchableOpacity onPress={exitSelectionMode} style={styles.closeButton}>
              <XMarkIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedItems.size} Selected</Text>
            <TouchableOpacity onPress={() => {
              // Select all
              if (selectedItems.size === filteredItems.length) {
                setSelectedItems(new Set());
              } else {
                setSelectedItems(new Set(filteredItems.map(i => i.id)));
              }
            }}>
              <Text style={styles.selectAllText}>
                {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.topBar}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Wishlist</Text>
            </View>

            <View style={styles.headerRight}>
              {/* Share Button */}
              <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
                <ShareIcon size={24} color={Colors.text.primary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/cart')} style={styles.cartButton}>
                <ShoppingBagIcon size={24} color={Colors.text.primary} />
                {cartCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{cartCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Standard Header Components (Search, Category, Filter) */}
        <View style={[styles.searchRow, isSelectionMode && { opacity: 0.5 }]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
          <View style={styles.searchBar}>
            <MagnifyingGlassIcon size={20} color={Colors.neutral[500]} />
            <TextInput
              style={styles.input}
              placeholder="Search in Wishlist"
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

        <View style={[styles.categoriesContainer, isSelectionMode && { opacity: 0.5 }]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
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

        <View style={[styles.filterRow, isSelectionMode && { opacity: 0.5 }]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
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
              if (isSelectionMode) {
                toggleSelection(item.id);
              } else {
                if (user) trackProductView(user.id, item.id);
                router.push(`/item/${item.id}`);
              }
            }}
            onLongPress={() => handleLongPress(item.id)}
            onToggleSelection={() => toggleSelection(item.id)}
            isSelectionMode={isSelectionMode}
            isSelected={selectedItems.has(item.id)}
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
            enabled={!isSelectionMode}
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

      {/* Bottom Action Bar for Selection Mode */}
      {isSelectionMode && (
        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            style={[styles.bottomActionBtn, selectedItems.size === 0 && styles.bottomActionBtnDisabled]}
            onPress={handleBulkDelete}
            disabled={selectedItems.size === 0}
          >
            <TrashIcon size={20} color={selectedItems.size > 0 ? Colors.danger[500] : Colors.neutral[400]} />
            <Text style={[styles.bottomActionText, { color: selectedItems.size > 0 ? Colors.danger[500] : Colors.neutral[400] }]}>Delete ({selectedItems.size})</Text>
          </TouchableOpacity>

          <View style={styles.bottomActionSeparator} />

          <TouchableOpacity
            style={[styles.bottomActionBtn, selectedItems.size === 0 && styles.bottomActionBtnDisabled]}
            onPress={handleBulkAddToCart}
            disabled={selectedItems.size === 0}
          >
            <ShoppingBagIcon size={20} color={selectedItems.size > 0 ? Colors.primary[500] : Colors.neutral[400]} />
            <Text style={[styles.bottomActionText, { color: selectedItems.size > 0 ? Colors.primary[500] : Colors.neutral[400] }]}>To Cart ({selectedItems.size})</Text>
          </TouchableOpacity>
        </View>
      )}

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
  selectionTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary[50], // Subtle hint
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  selectAllText: {
    color: Colors.primary[500],
    fontSize: 14,
    fontWeight: '600'
  },
  cartButton: {
    position: 'relative',
    padding: 4,
  },
  iconBtn: {
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
    paddingBottom: 80, // Space for bottom bar
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  cardSelected: {
    backgroundColor: Colors.primary[50], // Highlight selected item
  },
  selectionContainer: {
    justifyContent: 'center',
    marginRight: 12,
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  priceDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2
  },
  priceDropText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success[700],
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
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    // Removed duplicate width/bg as it's controlled by animated style mainly, 
    // but good to keep base style. 
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAction: {
    flex: 1,
    width: '100%',
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
  filterPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  // Bottom Action Bar
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  bottomActionBtnDisabled: {
    opacity: 0.5,
  },
  bottomActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActionSeparator: {
    width: 1,
    height: 24,
    backgroundColor: Colors.neutral[200],
  }
});

export default Wishlist;