// app/(auth)/callback.tsx
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
        // Check if we have tokens in the URL
        const { access_token, refresh_token } = params;

        if (access_token && refresh_token) {
          // Set the session with the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: access_token as string,
            refresh_token: refresh_token as string,
          });

          if (error) {
            throw error;
          }

          console.log("Auth callback successful:", data);
          // Navigate to home******
          router.replace("/(tabs)/Home");
        } else {
          // No tokens, redirect to auth
          console.log("No tokens found, redirecting to auth");
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
