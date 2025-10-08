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
    setLikedProducts((prev) => prev.includes(itemId)
      ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleProductPress = (productId: number) => {
    console.log(`Product ${productId} pressed`);
  };


  return (
   <SafeAreaView style={styles.container}>
    {/* Home Header section*/}
    <HomeHeader userName="John Doe" userAvatar="https://via.placeholder.com/150" />
    
    <ScrollView showsVerticalScrollIndicator={false}>
    {/* Recently Viewed section*/}

    </ScrollView>
    

    
   </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Home;
