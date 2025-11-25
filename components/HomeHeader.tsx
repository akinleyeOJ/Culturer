import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

interface HomeHeaderProps {
    userName?: string;
    userAvatar?: string;
    wishlistCount?: number;
    onSearchPress?: () => void;
    onWishlistPress?: () => void;
}

const HomeHeader = ({ 
    userName = "User", 
    userAvatar,
    wishlistCount = 0,
    onSearchPress,
    onWishlistPress 
}: HomeHeaderProps) => {

    const getGreeting = () => {
        const hours = new Date().getHours();
        if (hours < 12) return "Good Morning";
        if (hours < 18) return "Good Afternoon";
        return "Good Evening";
    }

    const getUserInitials = () => {
        return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <View style={styles.leftSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getUserInitials()}</Text>
                    </View>
                    <View style={styles.greetingContainer}>
                        <Text style={styles.greetingLabel}>{getGreeting()},</Text>
                        <Text style={styles.userName}>{userName}</Text>
                    </View>
                </View>
                
                <TouchableOpacity onPress={onWishlistPress} style={styles.heartButton}>
                    <FontAwesome name="heart-o" size={22} color="#4A4A4A" />
                    {wishlistCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{wishlistCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
                style={styles.searchContainer}
                onPress={onSearchPress}
                activeOpacity={0.7}
            >
                <FontAwesome name="search" size={16} color="#4A4A4A" style={styles.searchIcon} />
                <Text style={styles.searchPlaceholder}>What are you looking for today?</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E5E5",
    },
    topBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    leftSection: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#8B5CF6", // Purple color
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    greetingContainer: {
        flex: 1,
    },
    greetingLabel: {
        fontSize: 14,
        fontWeight: "400",
        color: "#9CA3AF", // Light gray
        marginBottom: 2,
    },
    userName: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1F2937", // Dark gray
    },
    heartButton: {
        padding: 8,
        position: "relative",
    },
    badge: {
        position: "absolute",
        top: 2,
        right: 2,
        backgroundColor: "#EF4444", // Red color
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 5,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "#E5E5E5",
    },  
    searchIcon: {
        marginRight: 12,
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 14,
        color: "#9CA3AF", // Light gray
    },
});

export default HomeHeader;