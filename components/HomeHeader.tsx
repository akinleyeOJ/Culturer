import React from "react";
import { View, Text, StyleSheet, TextInput, Image } from "react-native";

interface HomeHeaderProps {
    userName?: string;
    userAvatar?: string;
}

const HomeHeader = ({ userName = "User", userAvatar }: HomeHeaderProps) => {

//determine greeting based on the time of day
const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 18) return "Good Afternoon";
    return "Good Evening";
}

// Get user initials for avatar fallback
const getUserInitials = () => {
    return userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
    return (
        <View style={styles.container}>
            {/* Greeting Row */}
            <View style={styles.greetingRow}>

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {userAvatar ? (
                        <Image source={{ uri: userAvatar }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{getUserInitials()}</Text>
                        </View>
                    )}
                </View>
                
                {/* Greetings Text */}
                <View style={styles.greetingTextContainer}>
                    <Text style={styles.greetingText}>{getGreeting()}</Text>
                    <Text style={styles.userName}>{userName}</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput style={styles.searchInput} placeholder="Search for anything" />
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: "#f8f9fa",
    },
    greetingRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 15,
    },
    avatarContainer: {
       marginRight: 12,
    },  
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 22.5,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#e9ecef",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#6c757d",
    },
    greetingTextContainer: {
        flex: 1,
    },
    greetingText: {
        fontSize: 14,
        marginBottom: 2,
        fontWeight: "600",
        color: "#212529",
    },
    userName: {
        fontSize: 14,
        color: "#212529",
        fontWeight: "700",
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
        color: "#212529",
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#212529",
    },
});

export default HomeHeader;