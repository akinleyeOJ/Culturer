import { Redirect } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

const Home = () => {
  return (
    <SafeAreaView>
      <Redirect href="/(auth)/auth" />
      {/* <Redirect href="/(auth)/splash" /> */}
      {/* <Redirect href="/(tabs)/Browse" /> */}
    </SafeAreaView>
  );
};

export default Home;
