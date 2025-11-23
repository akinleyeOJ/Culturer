// app/(auth)/callback.tsx
// This handles email confirmation and OAuth callbacks
import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have an access token in the URL
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;
        const type = params.type as string;

        if (accessToken && refreshToken) {
          // Set the session with the tokens
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Session error:", error);
            router.replace("/(auth)/auth");
            return;
          }

          // Handle different callback types
          if (type === "recovery") {
            // Password reset - navigate to reset password screen
            router.replace("/(auth)/reset-password");
          } else if (type === "signup") {
            // Email confirmed successfully
            router.replace("/(tabs)/Home");
          } else {
            // Regular OAuth callback or other types
            router.replace("/(tabs)/Home");
          }
        } else {
          // No tokens, redirect to auth
          router.replace("/(auth)/auth");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        router.replace("/(auth)/auth");
      }
    };

    handleCallback();
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF8F66" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
