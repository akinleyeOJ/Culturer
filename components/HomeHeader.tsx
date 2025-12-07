import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from "react-native";
import { MagnifyingGlassIcon, HeartIcon, ShoppingBagIcon } from "react-native-heroicons/outline";

interface HomeHeaderProps {
    userName?: string;
    userAvatar?: string;
    wishlistCount?: number;
    cartCount?: number;
    isScrolled?: boolean;
    onSearchPress?: () => void;
    onWishlistPress?: () => void;
    onCartPress?: () => void;
}

const HomeHeader = ({
    userName = "User",
    userAvatar,
    wishlistCount = 0,
    cartCount = 0,
    isScrolled = false,
    onSearchPress,
    onWishlistPress,
    onCartPress
}: HomeHeaderProps) => {
    // Single animation progress value for perfect synchronization
    const animationProgress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animationProgress, {
            toValue: isScrolled ? 1 : 0,
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-in-out curve
            useNativeDriver: false, // Need false for height/margin
        }).start();
    }, [isScrolled]);

    // Interpolate all values from single progress
    const searchBarHeight = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [48, 0], // Search bar height collapses from 48 to 0
    });

    const searchBarOpacity = animationProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 0.3, 0], // More gradual fade out
    });

    const searchBarScale = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.8], // More noticeable scale down
    });

    const searchContainerMargin = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [12, 0], // Margin collapses
    });

    const searchContainerPadding = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0], // Keep padding consistent
    });

    const topBarMargin = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 8], // Reduce top bar margin when scrolled
    });

    const searchIconOpacity = animationProgress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1, 1], // Fade in quickly during first 30% of animation
    });

    const searchIconScale = animationProgress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0.8, 1, 1], // Pop in effect early
    });

    // Control search bar visibility and pointer events
    const searchBarPointerEvents = isScrolled ? 'none' : 'auto';

    // Memoize greeting
    const greeting = useMemo(() => {
        const date = new Date();
        const hours = date.getHours();
        const seed = date.getDate() + date.getMonth() + hours;

        if (hours >= 0 && hours < 4) {
            const greetings = ["Burning the midnight oil I see", "Hey there, night owl", "Still awake"];
            return greetings[seed % greetings.length];
        }
        if (hours >= 4 && hours < 6) {
            const greetings = ["Good morning"];
            return greetings[seed % greetings.length];
        }
        if (hours >= 6 && hours < 9) {
            const greetings = ["Good morning", "Morning sunshine", "Wakey wakey", "Hello there"];
            return greetings[seed % greetings.length];
        }
        if (hours >= 9 && hours < 12) {
            const greetings = ["Getting productive", "Good morning", "Hello there"];
            return greetings[seed % greetings.length];
        }
        if (hours >= 12 && hours < 17) {
            const greetings = ["Good afternoon", "Afternoon vibes", "Hey there"];
            return greetings[seed % greetings.length];
        }
        if (hours >= 17 && hours < 21) {
            const greetings = ["Good evening", "Hello there, evening explorer", "It's golden hour", "Getting dark out there"];
            return greetings[seed % greetings.length];
        }
        const greetings = ["Good night", "Late night browsing", "Cozy evening?", "Moonlight shopping?"];
        return greetings[seed % greetings.length];
    }, []);

    const getUserInitials = () => {
        return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.topBar, { marginBottom: topBarMargin }]}>
                <View style={styles.leftSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getUserInitials()}</Text>
                    </View>
                    <View style={styles.greetingContainer}>
                        <Text style={styles.greetingLabel}>{greeting},</Text>
                        <Text style={styles.userName}>{userName}</Text>
                    </View>
                </View>

                <View style={styles.rightSection}>
                    {/* Search icon when scrolled - with pop animation */}
                    <Animated.View
                        style={{
                            opacity: searchIconOpacity,
                            transform: [{ scale: searchIconScale }],
                        }}
                    >
                        <TouchableOpacity
                            onPress={onSearchPress}
                            style={styles.searchIconButton}
                        >
                            <MagnifyingGlassIcon size={20} color="#4A4A4A" />
                        </TouchableOpacity>
                    </Animated.View>
                    <TouchableOpacity onPress={onWishlistPress} style={styles.heartButton}>
                        <HeartIcon size={22} color="#4A4A4A" />
                        {wishlistCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{wishlistCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onCartPress} style={styles.cartButton}>
                        <ShoppingBagIcon size={22} color="#4A4A4A" />
                        {cartCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{cartCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* Search bar with smooth collapse and expand */}
            <Animated.View
                style={[
                    styles.searchContainerWrapper,
                    {
                        height: searchBarHeight,
                        marginBottom: searchContainerMargin,
                        paddingVertical: searchContainerPadding,
                        opacity: searchBarOpacity,
                    }
                ]}
                pointerEvents={searchBarPointerEvents}
            >
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={onSearchPress}
                    activeOpacity={0.7}
                >
                    <Animated.View style={[
                        styles.searchButtonContent,
                        {
                            transform: [{ scale: searchBarScale }],
                        }
                    ]}>
                        <MagnifyingGlassIcon size={16} color="#4A4A4A" style={styles.searchIcon} />
                        <Text style={styles.searchPlaceholder}>What are you looking for today?</Text>
                    </Animated.View>
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
        backgroundColor: "#8B5CF6",
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
        padding: 8,
        marginRight: 8,
    },
    greetingLabel: {
        fontSize: 14,
        fontWeight: "400",
        color: "#9CA3AF",
        marginBottom: 2,
    },
    userName: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1F2937",
    },
    heartButton: {
        padding: 8,
        position: "relative",
    },
    cartButton: {
        padding: 8,
        position: "relative",
        marginLeft: 4,
    },
    badge: {
        position: "absolute",
        top: 2,
        right: 2,
        backgroundColor: "#EF4444",
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
        overflow: 'hidden',
    },
    searchButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E5E5",
        height: 48,
    },
    searchButtonContent: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 14,
        color: "#9CA3AF",
    },
});

export default HomeHeader;