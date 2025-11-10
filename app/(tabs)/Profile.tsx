// app/(tabs)/Profile.tsx
import React from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { router } from "expo-router";
import { Colors } from "../../constants/color";

const Profile = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/auth");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.name}>
            {user?.user_metadata?.full_name || "User"}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>🛍️</Text>
            <Text style={styles.menuText}>My Listings</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>📦</Text>
            <Text style={styles.menuText}>Orders</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Settings</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuText}>Help & Support</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>📄</Text>
            <Text style={styles.menuText}>Terms & Privacy</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
    color: "#6c757d",
  },
  section: {
    backgroundColor: "#fff",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 25,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#212529",
  },
  menuArrow: {
    fontSize: 24,
    color: "#adb5bd",
  },
  signOutButton: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#dc3545",
  },
  version: {
    textAlign: "center",
    color: "#adb5bd",
    fontSize: 12,
    marginTop: 20,
  },
});

export default Profile;
