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
        
        // Late night (12 AM - 4 AM)
        if (hours >= 0 && hours < 4) {
            const greetings = ["Burning the midnight oil I see", "Hey there, night owl", "Still awake"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Early morning (4 AM - 6 AM)
        if (hours >= 4 && hours < 6) {
            const greetings = ["Rise and shine", "Early bird", "Good morning"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Morning (6 AM - 9 AM)
        if (hours >= 6 && hours < 9) {
            const greetings = ["Good morning", "Morning sunshine", "Wakey wakey", "Hello there"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Late morning (9 AM - 12 PM)
        if (hours >= 9 && hours < 12) {
            const greetings = ["Getting productive", "Good morning", "Hello there"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Afternoon (12 PM - 5 PM)
        if (hours >= 12 && hours < 17) {
            const greetings = ["Good afternoon", "Afternoon vibes", "Hey there"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Evening (5 PM - 9 PM)
        if (hours >= 17 && hours < 21) {
            const greetings = ["Good evening", "Hello there, evening explorer", "It's golden hour", "Getting dark out there"];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        // Night (9 PM - 12 AM)
        const greetings = ["Good night", "Late night browsing", "Cozy evening?", "Moonlight shopping?"];
        return greetings[Math.floor(Math.random() * greetings.length)];
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