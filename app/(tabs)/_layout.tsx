import { HomeIcon, MagnifyingGlassIcon, TagIcon, EnvelopeIcon, UserIcon } from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  TagIcon as TagIconSolid,
  EnvelopeIcon as EnvelopeIconSolid,
  UserIcon as UserIconSolid
} from 'react-native-heroicons/solid';
import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../../constants/color";
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useInbox } from "../../contexts/InboxContext";

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
  const { totalUnread } = useInbox();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Redirect href="/(auth)/auth" />;
  }

  // Optional: Force redirect to profile on initial load if desired
  // <Redirect href="/(tabs)/profile" />

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: Colors.primary[500] }} initialRouteName="profile">
      <Tabs.Screen
        name="home"
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
        name="browse"
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
        name="sell"
        options={{
          title: "Sell",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              OutlineIcon={TagIcon}
              SolidIcon={TagIconSolid}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          headerShown: false,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#FF3B30',
            color: '#FFF',
            fontSize: 10,
            fontWeight: 'bold',
          },
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
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
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