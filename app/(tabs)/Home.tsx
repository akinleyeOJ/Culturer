import React, {useState} from "react";
import { View, StyleSheet, Alert, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/Button";
import {ProductCard, RecentlyViewedCard} from "../../components/Card";
import HomeHeader from "../../components/HomeHeader";
import { recentlyViewedProducts, forYouProducts, hotProducts } from "../../data/mockProducts";


const Home = () => {
  const [likedProducts, setLikedProducts] = useState<number[]>([]);

  const handleLike = (productId: number) => {
    setLikedProducts((prev) => prev.includes(productId)
      ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleProductPress = (productId: number) => {
    console.log(`Product ${productId} pressed`);
  };


  return (
   <SafeAreaView style={styles.container}>
    {/* Home Header section*/}
    <HomeHeader 
    userName="John Doe" 
    userAvatar="https://via.placeholder.com/150"
    wishlistCount={likedProducts.length}
    onSearchPress={() => console.log("Search pressed")}
    onWishlistPress={() => console.log("Wishlist pressed")}
    />
    
    <ScrollView showsVerticalScrollIndicator={false}>
    {/* Recently Viewed section*/}
    <View style={styles.recentlyViewedContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recently Viewed</Text>
        
        <CustomButton title="View All" onPress={() => console.log("View All Recently Viewed")}
                      bgVariant="outline"
                      textVariant="default"
                      style={styles.viewMoreButton} 
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentlyViewedScroll} 
      >
        {recentlyViewedProducts.map((product) => (
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

    {/* For You section*/}
    <View style={styles.forYouContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>For You 👀</Text>
        
        <CustomButton title="View All" onPress={() => console.log("View All For You")}
                      bgVariant="secondary"
                      textVariant="default"
                      style={styles.viewMoreButton} 
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
            isLiked={likedProducts.includes(product.id)} 
            variant="default"
          />
        ))}
      </ScrollView>
    </View>

    {/* Hot Products section*/}
    <View style={styles.hotProductsContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hot Products</Text>
        
        <CustomButton title="View All" onPress={() => console.log("View All Hot Products")}
                      bgVariant="secondary"
                      textVariant="secondary"
                      style={styles.viewMoreButton}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
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
            isLiked={likedProducts.includes(product.id)} 
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
  viewMoreButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

//recently viewed styling
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

//for you styling
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

//hot products styling
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
