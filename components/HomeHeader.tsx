import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from "react-native-reanimated";

interface HomeHeaderProps {
    userName?: string;
    userAvatar?: string;
    wishlistCount?: number;
    isScrolled?: boolean;
    onSearchPress?: () => void;
    onWishlistPress?: () => void;
}

const HomeHeader = ({ 
    userName = "User", 
    userAvatar,
    wishlistCount = 0,
    isScrolled = false,
    onSearchPress,
    onWishlistPress 
}: HomeHeaderProps) => {
    // Animation values for search box collapse
    const searchHeight = useSharedValue(48);
    const searchOpacity = useSharedValue(1);
    const searchIconOpacity = useSharedValue(0);
    const greetingOpacity = useSharedValue(1);
    const topBarMargin = useSharedValue(16);

    // Animate based on scroll state - smooth animation with immediate state update
    React.useEffect(() => {
        if (isScrolled) {
            // Collapse search box - keep greeting visible
            searchHeight.value = withTiming(0, { duration: 300 });
            searchOpacity.value = withTiming(0, { duration: 300 });
            searchIconOpacity.value = withTiming(1, { duration: 300 });
            topBarMargin.value = withTiming(0, { duration: 300 }); // Remove margin when scrolled
            // Keep greeting visible - don't fade it out
            greetingOpacity.value = 1;
        } else {
            // Expand search box - smooth slide back in
            searchHeight.value = withTiming(48, { duration: 300 });
            searchOpacity.value = withTiming(1, { duration: 300 });
            searchIconOpacity.value = withTiming(0, { duration: 300 });
            topBarMargin.value = withTiming(16, { duration: 300 }); // Restore margin when not scrolled
            greetingOpacity.value = 1;
        }
    }, [isScrolled, searchHeight, searchOpacity, searchIconOpacity, greetingOpacity, topBarMargin]);

    // Animated styles
    const searchContainerStyle = useAnimatedStyle(() => ({
        height: searchHeight.value,
        opacity: searchOpacity.value,
        marginBottom: 0, // No margin - let container padding handle spacing
    }));

    const searchIconStyle = useAnimatedStyle(() => ({
        opacity: searchIconOpacity.value,
    }));

    const greetingStyle = useAnimatedStyle(() => ({
        opacity: greetingOpacity.value,
    }));

    const topBarStyle = useAnimatedStyle(() => ({
        marginBottom: topBarMargin.value,
    }));

    // Memoize greeting to prevent it from changing on every render
    // Use a stable seed based on date + hour so it stays consistent within the same hour
    const greeting = useMemo(() => {
        const date = new Date();
        const hours = date.getHours();
        // Use date + hour as seed for consistent greeting per hour
        const seed = date.getDate() + date.getMonth() + hours;
        
        // Late night (12 AM - 4 AM)
        if (hours >= 0 && hours < 4) {
            const greetings = ["Burning the midnight oil I see", "Hey there, night owl", "Still awake"];
            return greetings[seed % greetings.length];
        }
        // Early morning (4 AM - 6 AM)
        if (hours >= 4 && hours < 6) {
            const greetings = ["Rise and shine", "Early bird", "Good morning"];
            return greetings[seed % greetings.length];
        }
        // Morning (6 AM - 9 AM)
        if (hours >= 6 && hours < 9) {
            const greetings = ["Good morning", "Morning sunshine", "Wakey wakey", "Hello there"];
            return greetings[seed % greetings.length];
        }
        // Late morning (9 AM - 12 PM)
        if (hours >= 9 && hours < 12) {
            const greetings = ["Getting productive", "Good morning", "Hello there"];
            return greetings[seed % greetings.length];
        }
        // Afternoon (12 PM - 5 PM)
        if (hours >= 12 && hours < 17) {
            const greetings = ["Good afternoon", "Afternoon vibes", "Hey there"];
            return greetings[seed % greetings.length];
        }
        // Evening (5 PM - 9 PM)
        if (hours >= 17 && hours < 21) {
            const greetings = ["Good evening", "Hello there, evening explorer", "It's golden hour", "Getting dark out there"];
            return greetings[seed % greetings.length];
        }
        // Night (9 PM - 12 AM)
        const greetings = ["Good night", "Late night browsing", "Cozy evening?", "Moonlight shopping?"];
        return greetings[seed % greetings.length];
    }, []); // Calculate once on mount - greeting stays stable during session
    
    const getUserInitials = () => {
        return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.topBar, topBarStyle]}>
                <View style={styles.leftSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getUserInitials()}</Text>
                    </View>
                    <Animated.View style={[styles.greetingContainer, greetingStyle]}>
                        <Text style={styles.greetingLabel}>{greeting},</Text>
                        <Text style={styles.userName}>{userName}</Text>
                    </Animated.View>
                </View>
                
                <View style={styles.rightSection}>
                    {/* Search icon when scrolled */}
                    <Animated.View style={[styles.searchIconButton, searchIconStyle]}>
                        <TouchableOpacity onPress={onSearchPress} style={styles.searchIconButtonTouchable}>
                            <FontAwesome name="search" size={20} color="#4A4A4A" />
                        </TouchableOpacity>
                    </Animated.View>
                    <TouchableOpacity onPress={onWishlistPress} style={styles.heartButton}>
                        <FontAwesome name="heart-o" size={22} color="#4A4A4A" />
                        {wishlistCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{wishlistCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Animated.View style={[styles.searchContainerWrapper, searchContainerStyle]}>
                <TouchableOpacity 
                    style={styles.searchContainer}
                    onPress={onSearchPress}
                    activeOpacity={0.7}
                >
                    <FontAwesome name="search" size={16} color="#4A4A4A" style={styles.searchIcon} />
                    <Text style={styles.searchPlaceholder}>What are you looking for today?</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 5,
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
        position: "relative",
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
    rightSection: {
        flexDirection: "row",
        alignItems: "center",
    },
    searchIconButton: {
        marginRight: 8,
        opacity: 0,
    },
    searchIconButtonTouchable: {
        padding: 8,
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
    searchContainerWrapper: {
        overflow: "hidden",
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