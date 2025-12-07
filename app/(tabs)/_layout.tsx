import { HomeIcon, MagnifyingGlassIcon, HeartIcon, EnvelopeIcon, UserIcon } from 'react-native-heroicons/outline';
import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../../constants/color";

export default function TabLayout() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  // // Redirect to auth if not logged in
  // if (!user) {
  //   return <Redirect href="/(auth)/auth" />;
  // }

  // User is authenticated, show tabs
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: Colors.primary[500] }}>
      <Tabs.Screen
        name="Home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <HomeIcon size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Browse"
        options={{
          title: "Browse",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MagnifyingGlassIcon size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Wishlist"
        options={{
          title: "Wishlist",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <HeartIcon size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Message"
        options={{
          title: "Message",
          tabBarIcon: ({ color }) => (
            <EnvelopeIcon size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <UserIcon size={28} color={color} />
          ),
        }}
      />
    </Tabs>
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