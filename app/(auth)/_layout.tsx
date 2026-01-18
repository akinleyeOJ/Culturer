import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";

const AuthLayout = () => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF8F66" />
      </View>
    );
  }

  // Redirect to Home if already logged in
  // Exception: Allow callback screen even when logged in (needed for password reset)
  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  // User is not authenticated, show auth screens
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="callback" options={{ headerShown: false }} />
      <Stack.Screen name="forgotPassword" options={{ headerShown: false }} />
      <Stack.Screen name="password-reset-sent" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="splash" options={{ headerShown: false }} />
    </Stack>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default AuthLayout;
