// app/index.tsx
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { Colors } from "../constants/color";

const Index = () => {
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure auth state is loaded and prevent flickering
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (loading || !isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  // If user is logged in, go to Home
  if (user) {
    return <Redirect href="/(tabs)/Home" />;
  }

  // If not logged in, go to Splash screen (which flows to Onboarding -> Auth)
  return <Redirect href="/(auth)/splash" />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default Index;