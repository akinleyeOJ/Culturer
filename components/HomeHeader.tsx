import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Keyboard } from "react-native";

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

    const [showSearch, setShowSearch] = useState(false);
    const searchInputRef = useRef<TextInput>(null);

    const getGreeting = () => {
        const hours = new Date().getHours();
        if (hours < 12) return "Good Morning";
        if (hours < 18) return "Good Afternoon";
        return "Good Evening";
    }

    const getUserInitials = () => {
        return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }

    const handleSearchPress = () => {
        if (showSearch) {
            // Close search
            setShowSearch(false);
            Keyboard.dismiss();
        } else {
            // Open search
            setShowSearch(true);
        }
    };

    // Focus input when showSearch becomes true
    useEffect(() => {
        if (showSearch) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [showSearch]);

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.greetingText}>{getGreeting()}, {userName}</Text>
                
                <View style={styles.iconContainer}>
                    <TouchableOpacity 
                        onPress={handleSearchPress}
                        style={styles.iconButton}
                    >
                        <Text style={styles.icon}>🔍</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={onWishlistPress} style={styles.iconButton}>
                        <Text style={styles.icon}>🤍</Text>
                        {wishlistCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{wishlistCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {showSearch && (
                <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput 
                        ref={searchInputRef}
                        style={styles.searchInput} 
                        placeholder="Search for anything"
                        placeholderTextColor="#999"
                        keyboardType="default"
                        returnKeyType="search"
                        onBlur={() => setShowSearch(false)}  // Add this back
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: "#f8f9fa",
    },
    topBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    greetingText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#212529",
    },
    iconContainer: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
    },
    iconButton: {
        position: "relative",
        padding: 4,
    },
    icon: {
        fontSize: 22,
    },
    badge: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: "#ff6b6b",
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#fff",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },  
    searchIcon: {
        fontSize: 16,
        color: "#999",
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#212529",
        paddingVertical: 0,  // Add this - sometimes padding can interfere
        height: 40,  // Add explicit height
    },
});

export default HomeHeader;