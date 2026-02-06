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
  Dimensions,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Colors } from "../constants/color";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { fetchWishlist, toggleFavorite, trackProductView } from "../lib/services/productService";
import { addToCart } from "../lib/services/cartService";
import { CATEGORIES } from "../constants/categories";
import { CartToast } from "../components/CartToast";
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
  ChevronLeftIcon,
  XMarkIcon,
  ShareIcon,
  CheckCircleIcon as CheckCircleIconOutline,
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
  originalPrice?: string;
  image?: string;
  shipping?: string;
  rating?: number;
  reviews?: number;
  outOfStock?: boolean;
  category?: string | null;
  condition?: string;
  culture?: string;
}

// Right Action Component for Swipeable
const RightAction = ({ progress, dragX, onDelete }: { progress: any, dragX: any, onDelete: () => void }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.05, 0.1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      dragX.value,
      [-100, 0],
      [0, 100],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateX }] };
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

// Wishlist Item Component
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
    if (isSelectionMode) return null;
    return <RightAction progress={progress} dragX={dragX} onDelete={onDelete} />;
  }, [isSelectionMode, onDelete]);

  const priceDropPercent = useMemo(() => {
    if (item.originalPrice && item.price) {
      const oldP = parseFloat(item.originalPrice.replace(/[^0-9.]/g, ''));
      const newP = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      if (oldP > newP) return Math.round(((oldP - newP) / oldP) * 100);
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
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); onMenuPress(); }} hitSlop={10} style={{ padding: 4 }}>
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

        {item.shipping && <Text style={styles.shipping}>+ {item.shipping}</Text>}

        <View style={styles.footerRow}>
          <Text style={styles.watchers}>{item.reviews} reviews · {item.rating?.toFixed(1)} ★</Text>
          {!isSelectionMode ? (
            <TouchableOpacity
              style={[styles.addToCartButton, item.outOfStock && styles.addToCartButtonDisabled]}
              onPress={(e) => { e.stopPropagation(); if (!item.outOfStock) onAddToCart(); }}
              disabled={item.outOfStock}
            >
              <Text style={[styles.addToCartText, item.outOfStock && styles.addToCartTextDisabled]}>
                {item.outOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}
              </Text>
            </TouchableOpacity>
          ) : (
            item.outOfStock && <Text style={styles.stockWarning}>Out of Stock</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (isSelectionMode) {
    return (
      <TouchableOpacity onPress={onToggleSelection} onLongPress={onLongPress} activeOpacity={1}>
        {ItemContent}
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => { if (swipeableRef.current) onSwipeStart(swipeableRef.current); }}
      overshootRight={false}
      rightThreshold={40}
    >
      <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.9}>
        {ItemContent}
      </TouchableOpacity>
    </Swipeable>
  );
};

// Custom Bottom Sheet for Actions
const ActionSheet = ({ visible, onClose, item, onEnableNotifications, onRemove }: any) => {
  if (!visible || !item) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
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

const Wishlist = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { cartCount, refreshCartCount } = useCart();
  const params = useLocalSearchParams(); // Get navigation params

  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Multiple Selection State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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

  // Sync params with local state
  useEffect(() => {
    if (params.search !== undefined) {
      setSearchQuery(params.search as string);
    }
    if (params.categories) {
      const cats = (params.categories as string).split(',').filter(Boolean);
      if (cats.length > 0) setSelectedCategories(cats);
    }
    if (params.resetFilters) {
      // Logic handled via filters useMemo, no state reset needed for these except maybe categories if we want to reset them
    }
  }, [params]);

  // Derived filters from params
  const filters = useMemo(() => ({
    minPrice: params.minPrice as string,
    maxPrice: params.maxPrice as string,
    condition: params.condition as string,
    shipping: params.shipping as string,
    culture: params.culture as string,
    sortBy: (params.sortBy as string) || 'newest'
  }), [params]);

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
        if (index % 3 === 0) {
          const currentPrice = parseFloat(item.price.replace(/[^0-9.]/g, ''));
          const originalPrice = currentPrice * 1.2;
          return { ...item, originalPrice: `$${originalPrice.toFixed(2)}` };
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
      return () => { openSwipeableRef.current?.close(); };
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

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    Alert.alert("Delete selected items?", `Remove ${selectedItems.size} items from wishlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          if (!user) return;
          const itemIds = Array.from(selectedItems);
          setWishlistItems(prev => prev.filter(p => !selectedItems.has(p.id)));
          setIsSelectionMode(false);
          setSelectedItems(new Set());
          await Promise.all(itemIds.map(id => toggleFavorite(user.id, id)));
          setToastMessage(`Removed ${itemIds.length} items`);
          setToastVisible(true);
        }
      }
    ]);
  };

  const handleBulkAddToCart = async () => {
    if (selectedItems.size === 0 || !user) return;
    const itemIds = Array.from(selectedItems);
    const validIds = itemIds.filter(id => !wishlistItems.find(p => p.id === id)?.outOfStock);
    if (validIds.length === 0) {
      Alert.alert("Unavailable", "All selected items are out of stock.");
      return;
    }
    for (const id of validIds) {
      await addToCart(user.id, id, 1);
    }
    refreshCartCount();
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setToastMessage(`Added ${validIds.length} items to cart`);
    setToastAction(() => () => router.push('/cart'));
    setToastActionLabel("View Cart");
    setToastVisible(true);
  };

  const handleShare = async () => {
    try {
      const itemsList = wishlistItems.map(i => `• ${i.name} - ${i.price}`).join('\n');
      await Share.share({ message: `Check out my Wishlist on Culturar! ✨\n\n${itemsList}`, title: "My Culturar Wishlist" });
    } catch (error) { console.error(error); }
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

  const filteredItems = useMemo(() => {
    let result = wishlistItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedCategories.length > 0) {
        if (!item.category) return false;
        const itemCatLower = item.category.toLowerCase();
        const hasMatch = selectedCategories.some(selectedId => {
          const catDef = CATEGORIES.find(c => c.id === selectedId);
          return catDef && (itemCatLower === catDef.id || itemCatLower === catDef.name.toLowerCase());
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
  ].filter(Boolean).length, [filters]);

  const handleFilterPress = () => {
    router.push({
      pathname: '/filter',
      params: {
        returnPath: '/wishlist',
        search: searchQuery,
        categories: selectedCategories.join(','),
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        condition: filters.condition,
        shipping: filters.shipping,
        culture: filters.culture,
        sortBy: filters.sortBy
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CartToast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        onViewCart={toastAction}
        actionLabel={toastActionLabel}
      />

      <View style={styles.header}>
        {isSelectionMode ? (
          <View style={styles.selectionTopBar}>
            <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }} style={styles.closeButton}>
              <XMarkIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedItems.size} Selected</Text>
            <TouchableOpacity onPress={() => {
              if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
              else setSelectedItems(new Set(filteredItems.map(i => i.id)));
            }}>
              <Text style={styles.selectAllText}>{selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.topBar}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeftIcon size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Wishlist</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
                <ShareIcon size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/cart')} style={styles.cartButton}>
                <ShoppingBagIcon size={24} color={Colors.text.primary} />
                {cartCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>}
              </TouchableOpacity>
            </View>
          </View>
        )}

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategories.length === 0 && styles.categoryChipActive]}
              onPress={() => setSelectedCategories([])}
            >
              <Text style={[styles.categoryText, selectedCategories.length === 0 && styles.categoryTextActive]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
                onPress={() => toggleCategory(cat.id)}
              >
                <Text style={[styles.categoryText, selectedCategories.includes(cat.id) && styles.categoryTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.filterRow, isSelectionMode && { opacity: 0.5 }]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultsText}>{filteredItems.length} items</Text>
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
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
                setSelectedItems(prev => {
                  const next = new Set(prev);
                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                  return next;
                });
              } else {
                if (user) trackProductView(user.id, item.id);
                router.push(`/item/${item.id}`);
              }
            }}
            onLongPress={() => {
              if (!isSelectionMode) {
                setIsSelectionMode(true);
                setSelectedItems(new Set([item.id]));
              }
            }}
            onToggleSelection={() => {
              setSelectedItems(prev => {
                const next = new Set(prev);
                next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                return next;
              });
            }}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} enabled={!isSelectionMode} />}
        ListEmptyComponent={!loading ? <View style={styles.emptyState}><Text style={styles.emptyText}>No saved items found.</Text></View> : null}
      />

      {isSelectionMode && (
        <View style={styles.bottomActionBar}>
          <TouchableOpacity style={[styles.bottomActionBtn, selectedItems.size === 0 && styles.bottomActionBtnDisabled]} onPress={handleBulkDelete} disabled={selectedItems.size === 0}>
            <TrashIcon size={20} color={selectedItems.size > 0 ? Colors.danger[500] : Colors.neutral[400]} />
            <Text style={[styles.bottomActionText, { color: selectedItems.size > 0 ? Colors.danger[500] : Colors.neutral[400] }]}>Delete ({selectedItems.size})</Text>
          </TouchableOpacity>
          <View style={styles.bottomActionSeparator} />
          <TouchableOpacity style={[styles.bottomActionBtn, selectedItems.size === 0 && styles.bottomActionBtnDisabled]} onPress={handleBulkAddToCart} disabled={selectedItems.size === 0}>
            <ShoppingBagIcon size={20} color={selectedItems.size > 0 ? Colors.primary[500] : Colors.neutral[400]} />
            <Text style={[styles.bottomActionText, { color: selectedItems.size > 0 ? Colors.primary[500] : Colors.neutral[400] }]}>To Cart ({selectedItems.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        item={selectedActionItem}
        onEnableNotifications={() => { setActionSheetVisible(false); setToastMessage("Notifications enabled"); setToastVisible(true); }}
        onRemove={() => { if (selectedActionItem) removeItem(selectedActionItem.id); }}
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
    backgroundColor: Colors.primary[50],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  selectAllText: {
    color: Colors.primary[500],
    fontSize: 14,
    fontWeight: '600',
  },
  cartButton: {
    position: 'relative',
    padding: 4,
  },
  iconBtn: {
    padding: 4,
  },
  closeButton: {
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
    gap: 4,
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
    paddingBottom: 80,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  cardSelected: {
    backgroundColor: Colors.primary[50],
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
    gap: 2,
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
    shadowOffset: { width: 0, height: -2 },
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
  },
});

export default Wishlist;