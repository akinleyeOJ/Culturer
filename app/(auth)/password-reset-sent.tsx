import React from "react";
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "../../constants/color";

const { width } = Dimensions.get("window");


const PasswordResetSent = () => {

  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.content}>
            {/* Success Icon  */}
            <View style={styles.iconContainer}>
                <View style={styles.checkmarkCircle}>
                    <Text style={styles.checkmark}>✓</Text>
                </View>
            </View>

            {/* Title  */}
            <Text style={styles.title}>Done</Text>

            {/* Reset Link Sent Message  */}
            <Text style={styles.message}> Password reset link has been sent to your email address, check your
            email and complete password reset. </Text>

            {/* Back to Sign In (OK) Button  */}
            <TouchableOpacity style={styles.okButton} onPress={() => router.back()}>
                <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.success[500],
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 40,
    },
    checkmarkCircle: {
        width: 120,
        height: 120,
        borderRadius: 60, // Changed to make it circular
        borderWidth: 4,
        borderColor: "#fff",
        backgroundColor: "rgba(255, 255, 255, 0.2)", 
        justifyContent: "center",
        alignItems: "center",
    },
    checkmark: {
        fontSize: 70,
        color: "#fff",
        fontWeight: "700",
    },
    title: {
        fontSize: 48,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 30,
    },
    message: {
        fontSize: 17,
        color: "#fff",
        textAlign: "center",
        lineHeight: 26,
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    okButton: {
        width: width - 80,
        backgroundColor: "#fff",
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      okButtonText: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.success[500],
      },
});

export default PasswordResetSent;