import { Stack } from "expo-router";
import "../global.css";
import { AuthProvider } from "../contexts/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="search"
          options={{
            headerShown: false,
            // 'fade' makes the screen appear without sliding, allowing the keyboard 
            // to animate up from the bottom independently.
            animation: "fade",
            // Optional: You can also use 'none' for an instant appearance
            // animation: "none",
          }}
        />
        <Stack.Screen
          name="filter"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right'
          }}
        />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}