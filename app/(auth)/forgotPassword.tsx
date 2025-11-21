import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "../../constants/color";
import { supabase } from "../../lib/supabase";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (loading) return;

        // Validation
        if (!email.trim()) {
            Alert.alert("Error", "Please enter your email address");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert("Error", "Please enter a valid email address");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), 
            {
                redirectTo: "https://culturar.netlify.app/forgotpassword",
            }
          );

          if (error) { throw error; }

         // Navigate to password reset sent screen
         router.push({
            pathname: "/(auth)/password-reset-sent",
            params: { email: email.trim() },
         });
        } catch (error: any) {
            Alert.alert(
                "Error", 
                error.message || "Failed to send reset email. Please try again"
            );
        } finally {
            setLoading(false);
        }
    }

  return (  
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.KeyboardView}
      >
       {/* back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* header section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔐</Text>
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your email to reset your password</Text>
          </View>

          {/* email input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
          </View>

          {/* send reset linkbutton */}
          <TouchableOpacity 
             style={[styles.resetButton, loading && styles.resetButtonDisabled, ]}
             onPress={handleForgotPassword} disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.resetButtonIcon}>📨</Text>
                <Text style={styles.resetButtonText}>Send Reset Link</Text>
              </>
              
            )}
          </TouchableOpacity>
          
          {/* back to sign in */}
          <TouchableOpacity style={styles.backToSignIn} onPress={() => router.back()} disabled={loading} >
            <Text style={styles.backToSignInIcon}>←</Text>
            <Text style={styles.backToSignInText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  KeyboardView: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primary[500],
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
    // color: Colors.primary[500],
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.secondary[900],
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.neutral[600],
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: Colors.neutral[100],
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: Colors.neutral[700],
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary[500],
    gap: 8,
    marginBottom: 20,
  },
  resetButtonDisabled: {
    backgroundColor: Colors.neutral[400],
  },
  resetButtonIcon: {
    fontSize: 18,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  backToSignIn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  backToSignInIcon: {
    fontSize: 16,
    color: Colors.primary[500],
  },
  backToSignInText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.primary[500],
  },
});

export default ForgotPassword;
