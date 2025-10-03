import React, { ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from "react-native";

interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

// Base Card Component
export const Card = ({ children, style, onPress }: CardProps) => {
    const CardWrapper = onPress ? TouchableOpacity : View;

    return (
        <CardWrapper style={[styles.card, style]} onPress={onPress} activeOpacity={onPress ? 0.7 :1}>
            {children}
        </CardWrapper>
    );
};

// Product Card Component
interface ProductCardProps extends CardProps {
    name: string;
    price: string;
    //Dont forget to add the image type
    image: string;
    emoji: string;
    rating: number;
    reviews: number;
    shipping: string;
    outOfStock?: boolean;
    onPress?: () => void;
    onLike?: () => void;
    isLiked?: boolean;
    //Dont forget to add isInWishlist and isInCart
    // isInWishlist: boolean;
    // isInCart: boolean;
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
    // isInWishlist = false, 
    // isInCart = false 
}: ProductCardProps) => { 
    const renderStars = (rating: number) => {
        const fullStars = Math.floor(rating);
        const hasHalfStars = rating % 1 >= 0.5;
        let starts = "";

        for (let i = 0; i < fullStars; i++) {
            starts += "⭐";
        }

        if (hasHalfStars && fullStars < 5) {
            starts += "⭐";
        }
        while (starts.length < 5) {
            starts += "⭐";
        }
        return starts;
    }

const shippingStyle =
    shipping === "Free shipping"
      ? styles.shippingFree
      : styles.shippingPaid;

return (
    <Card style={[styles.productCard, style]} onPress={onPress} >
        <View style={styles.productCardImage}>
            <Text style={styles.productCardEmoji}>{emoji}</Text>
            {outOfStock && (
                <View style={styles.outOfStockContainer}>
                    <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
            )}
        </View>
        <View style={styles.cardInfo}>
            <Text style={styles.cardPrice}>{price}</Text>
            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>

            <View style={styles.ratingContainer}>
                <Text style={styles.cardratingStars}>{renderStars(rating)}</Text>
                <Text style={styles.cardRatingText}>{reviews} reviews</Text>
            </View>

            <View style={[styles.shippingBadge, shippingStyle]}>
                <Text style={styles.shippingText}>🚚 {shipping}</Text>
            </View>
            
            <TouchableOpacity style={styles.likeButton} onPress={onLike}>
                <Text style={styles.likeIcon}>{isLiked ? "♥" : "♡"}</Text>
            </TouchableOpacity>
        </View>
    </Card>
 );
};

 //Recently Viewed Card Component
interface RecentlyViewedCardProps extends CardProps {
    name: string;
    price: string;
    image: string;
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
            <View style={styles.recentlyViewedCardImage}>
                <Text style={styles.recentlyViewedCardEmoji}>{emoji}</Text>
            </View>
            <Text style={styles.recentlyViewedCardName} numberOfLines={1}>{name}</Text>
            <Text style={styles.recentlyViewedCardPrice}>{price}</Text>
        </TouchableOpacity>
    );
};


const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  productCard: {
    width: "48%",
  },
  productCardImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
  },
  productCardEmoji: {
    fontSize: 40,
    textAlign: "center",
    marginBottom: 10,
  },
  outOfStockContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  outOfStockText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardInfo: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    gap: 5,
  },
  cardratingStars: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
  },
  cardRatingText: {
    fontSize: 12,
    color: "#000",
  },
  shippingBadge: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  shippingFree: {
    backgroundColor: "#e8f5e8",
  },
  shippingPaid: {
    backgroundColor: "#f5f5f5",
  },
  shippingText: {
    fontSize: 12,
    color: "#fff",
  },
  likeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  likeIcon: {
    fontSize: 14,
    color: "#000",
  },
  recentlyViewedCard: {
    width: 120,
    marginRight: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  recentlyViewedCardImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
  },
  recentlyViewedCardEmoji: {
    fontSize: 40
  },
  recentlyViewedCardName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#2d3436",
    marginBottom: 4,
    textAlign: "center",
  },
  recentlyViewedCardPrice: {
    fontSize: 10,
    color: "#ff6b6b",
    fontWeight: "500",
  },
});