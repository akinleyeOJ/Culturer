import { Redirect } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

const Home = () => {
  return (
    <SafeAreaView>
      <Redirect href="/(auth)/onboarding" />
    </SafeAreaView>
  );
};

export default Home;
