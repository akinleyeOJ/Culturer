import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from "react-native";
import { MagnifyingGlassIcon, HeartIcon, ShoppingBagIcon } from "react-native-heroicons/outline";
import { Colors } from "../constants/color";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BrowseHeaderProps {
    userName?: string;
    userAvatar?: string;
    wishlistCount?: number;
    cartCount?: number;
    isScrolled?: boolean;
    onWishlistPress?: () => void;
    onCartPress?: () => void;
}

const BrowseHeader = ({
    userName = "User",
    userAvatar,
    wishlistCount = 0,
    cartCount = 0,
    isScrolled = false,
    onWishlistPress,
    onCartPress
}: BrowseHeaderProps) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleSearchPress = () => {
        router.push('/search');
    };

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


    return (
        <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
            <Animated.View style={[styles.topBar, { marginBottom: topBarMargin }]}>
                <View style={styles.leftSection}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerText}>Discover</Text>
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
                            onPress={handleSearchPress}
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
                    onPress={handleSearchPress}
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
    headerTextContainer: {
        flex: 1,
    },
    headerText: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text.primary,
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
        top: -4,
        right: -4,
        backgroundColor: Colors.primary[500],
        borderRadius: 10,
        minWidth: 25,
        height: 20,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: "#FFFFFF",
    },
    badgeText: {
        fontSize: 10,
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

export default BrowseHeader;