import { HomeIcon, MagnifyingGlassIcon, HeartIcon, EnvelopeIcon, UserIcon } from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  HeartIcon as HeartIconSolid,
  EnvelopeIcon as EnvelopeIconSolid,
  UserIcon as UserIconSolid
} from 'react-native-heroicons/solid';
import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../../constants/color";
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Animated Tab Icon Component
const TabIcon = ({ focused, OutlineIcon, SolidIcon, color }: any) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.1 : 1, { damping: 15 }) }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {focused ? (
        <SolidIcon size={28} color={color} />
      ) : (
        <OutlineIcon size={28} color={color} />
      )}
    </Animated.View>
  );
};

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
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={HomeIcon}
              SolidIcon={HomeIconSolid}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Browse"
        options={{
          title: "Browse",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={MagnifyingGlassIcon}
              SolidIcon={MagnifyingGlassIconSolid}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Wishlist"
        options={{
          title: "Wishlist",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={HeartIcon}
              SolidIcon={HeartIconSolid}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Message"
        options={{
          title: "Message",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={EnvelopeIcon}
              SolidIcon={EnvelopeIconSolid}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={UserIcon}
              SolidIcon={UserIconSolid}
              color={color}
            />
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