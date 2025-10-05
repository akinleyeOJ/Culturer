import React, {useState} from "react";
import { View, StyleSheet, Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/Button";
import {ProductCard, RecentlyViewedCard} from "../../components/Card";

const Home = () => {
  const handleButtonPress = () => {
    Alert.alert("Button Pressed");
  };

  return (
    <View style={styles.container}>
      <Text>Home</Text>
    </View>
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
