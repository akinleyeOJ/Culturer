import React, { ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from "react-native";

interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
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

// const shippingStyle =
//     shipping === "Free shipping"
//       ? styles.shippingFree
//       : styles.shippingPaid;


return (
    <Card style={[styles.productCard, style]} onPress={onPress} activeOpacity={onPress ? 0.7 :1}>
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
            <Text style={styles.cardName} numberOflines={1}>{name}</Text>

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
        <TouchableOpacity style={styles.recentlyViewedCard} onPress={onPress} activeOpacity={onPress ? 0.7 :1}>
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
    shadowRadius: 3.84,
    elevation: 5,
  },
});