import React, { ReactNode, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp, Image } from "react-native";
import { Colors } from "../constants/color";
import { HeartIcon as HeartOutline } from "react-native-heroicons/outline";
import { HeartIcon as HeartSolid } from "react-native-heroicons/solid";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from "react-native-reanimated";

interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

// Base Card Component
export const Card = ({ children, style, onPress }: CardProps) => {
  const CardWrapper = onPress ? TouchableOpacity : View;
  return (
    <CardWrapper style={[styles.card, style]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      {children}
    </CardWrapper>
  );
};

// Product Card Component
interface ProductCardProps extends CardProps {
  name: string;
  price: string;
  image?: string;
  emoji: string;
  rating: number;
  reviews: number;
  shipping: string;
  outOfStock?: boolean;
  onPress?: () => void;
  onLike?: () => void;
  isLiked?: boolean;
  variant?: "default" | "large";
  badge?: "NEW" | "HOT" | null;
}

export const ProductCard = ({
  name,
  price,
  image,
  emoji,
  rating,
  reviews,
  shipping,
  outOfStock = false,
  onPress,
  onLike,
  isLiked = false,
  style,
  variant = "default",
  badge = null,
}: ProductCardProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const prevLikedRef = useRef(isLiked);
  const hasSettledRef = useRef(false);

  // Wait for component to settle after initial data load before allowing animations
  useEffect(() => {
    // Give component time to settle after initial data load
    const timer = setTimeout(() => {
      hasSettledRef.current = true;
      prevLikedRef.current = isLiked;
    }, 300); // 300ms delay to allow data to load

    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  // Animate only when isLiked changes AFTER component has settled (user interaction)
  useEffect(() => {
    // Don't animate until component has settled after initial load
    if (!hasSettledRef.current) {
      prevLikedRef.current = isLiked;
      return;
    }

    // Only animate if the value actually changed (user clicked) AND it's being favorited (not unfavorited)
    if (prevLikedRef.current !== isLiked) {
      if (isLiked) {
        // Quick scale up and down animation when liked - fast timing-based animation
        scale.value = withSequence(
          withTiming(1.3, { duration: 150 }),
          withTiming(1, { duration: 150 })
        );
      } else {
        // Reset to original size immediately when unfavoriting (no animation)
        scale.value = 1;
      }
      // Update the ref to track the current state
      prevLikedRef.current = isLiked;
    }
  }, [isLiked, scale]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const renderStars = (rating: number) => {
    return "⭐".repeat(Math.floor(rating));
  };

  const cardStyle = variant === "large" ? styles.productCardLarge : styles.productCard;
  const imageStyle = variant === "large" ? styles.productCardImageLarge : styles.productCardImage;
  const emojiStyle = variant === "large" ? styles.productCardEmojiLarge : styles.productCardEmoji;

  return (
    <Card style={[cardStyle, style]} onPress={onPress}>
      <View style={imageStyle}>
        {image ? (
          <Image source={{ uri: image }} style={styles.productImage} />
        ) : (
          <Text style={emojiStyle}>{emoji}</Text>
        )}

        {/* Badge (NEW/HOT) */}
        {badge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}

        {/* Out of Stock Overlay */}
        {outOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardPrice}>{price}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{name}</Text>

        <View style={styles.ratingRow}>
          <Text style={styles.stars}>{renderStars(rating)}</Text>
          <Text style={styles.reviewText}>({reviews})</Text>
        </View>

        {/* Favorite Button - Bottom Right */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
          activeOpacity={0.7}
        >
          <Animated.View style={animatedIconStyle}>
            {isLiked ? (
              <HeartSolid size={14} color="#EF4444" />
            ) : (
              <HeartOutline size={14} color="#4A4A4A" />
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

// Recently Viewed Card Component
interface RecentlyViewedCardProps extends CardProps {
  name: string;
  price: string;
  image?: string;
  emoji: string;
  onPress: () => void;
}

export const RecentlyViewedCard = ({
  name,
  price,
  image,
  emoji,
  onPress
}: RecentlyViewedCardProps) => {
  return (
    <TouchableOpacity style={styles.recentlyViewedCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.recentlyViewedImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.productImage} />
        ) : (
          <Text style={styles.recentlyViewedEmoji}>{emoji}</Text>
        )}
      </View>
      <Text style={styles.recentlyViewedName} numberOfLines={1}>{name}</Text>
      <Text style={styles.recentlyViewedPrice}>{price}</Text>
    </TouchableOpacity>
  );
};

// Skeleton Loading Component
export const ProductCardSkeleton = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0.7, { duration: 1000 }),
      withTiming(0.3, { duration: 1000 })
    );
    // Loop animation
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <Animated.View style={[styles.card, styles.productCard, style, animatedStyle]}>
      {/* Image Placeholder */}
      <View style={[styles.productCardImage, { backgroundColor: '#E0E0E0' }]} />

      {/* Content Placeholder */}
      <View style={styles.cardContent}>
        {/* Price */}
        <View style={{ width: '40%', height: 20, backgroundColor: '#E0E0E0', marginBottom: 8, borderRadius: 4 }} />
        {/* Name */}
        <View style={{ width: '80%', height: 16, backgroundColor: '#E0E0E0', marginBottom: 4, borderRadius: 4 }} />
        <View style={{ width: '60%', height: 16, backgroundColor: '#E0E0E0', marginBottom: 8, borderRadius: 4 }} />

        {/* Rating */}
        <View style={{ width: '50%', height: 12, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Product Card - Default Size
  productCard: {
    width: 160,
    marginRight: 12,
  },
  productCardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productCardEmoji: {
    fontSize: 48,
  },

  // Product Card - Large Size (Hot Products)
  productCardLarge: {
    width: 200,
    marginRight: 15,
  },
  productCardImageLarge: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productCardEmojiLarge: {
    fontSize: 64,
  },

  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Badge (NEW/HOT)
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Out of Stock
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Card Content
  cardContent: {
    padding: 12,
    position: 'relative',
    minHeight: 120, // Ensure enough height for content + button
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 13,
    color: '#495057',
    marginBottom: 6,
    lineHeight: 18,
    minHeight: 36,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stars: {
    fontSize: 7.5,
    marginRight: 4,
  },
  reviewText: {
    fontSize: 10,
    color: '#6c757d',
  },

  // Favorite Button - Bottom Right
  favoriteButton: {
    position: 'absolute',
    bottom: 25,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  favoriteIcon: {
    fontSize: 10,
  },

  // Recently Viewed Card
  recentlyViewedCard: {
    width: 100,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recentlyViewedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  recentlyViewedEmoji: {
    fontSize: 32,
  },
  recentlyViewedName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 4,
    textAlign: 'center',
  },
  recentlyViewedPrice: {
    fontSize: 12,
    color: Colors.primary[500],
    fontWeight: '600',
  },
});