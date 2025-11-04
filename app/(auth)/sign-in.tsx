import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "../../constants/color";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // const [isLoading, setIsLoading] = useState(false);

  const handleContinue = () => {
    //Implement actual authentication logic here
    console.log("Sign in:", { email, password, rememberMe });
    // Navigate to the home screen after successful login
    router.replace("/(tabs)/Home");
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`${provider} Auth Pressed`);
    // Implement social login logic here
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.KeyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🛍️</Text>
            <Text style={styles.appName}>Culturar</Text>
          </View>

          {/* Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <View style={[styles.toggleButton, styles.toggleButtonActive]}>
              <Text style={styles.toogleIcon}>🔓</Text>
              <Text style={[styles.toggleText, styles.toggleTextActive]}>
                Login
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => router.replace("/(auth)/sign-up")}
            >
              <Text style={styles.toogleIcon}>👤</Text>
              <Text style={styles.toggleText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Log in to your account</Text>
            <Text style={styles.formSubtitle}>
              Access your messages, wishlists, and listings
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="***********"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  // onSubmitEditing={handleContinue}
                  returnKeyType="done"
                  onFocus={() => setShowPassword(true)}
                  onBlur={() => setShowPassword(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me and Forgot Password */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberMeText}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonIcon}>✉️</Text>
              <Text style={styles.continueButtonText}>Continue with Email</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login Buttons */}
            <TouchableOpacity
              style={styles.socialLoginButton}
              onPress={() => handleSocialLogin("Google")}
            >
              <Text style={styles.socialLoginButtonIcon}>🔒</Text>
              <Text style={styles.socialLoginButtonText}>
                Continue with Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialLoginButton}
              onPress={() => handleSocialLogin("Apple")}
            >
              <Text style={styles.socialLoginButtonIcon}>🍎</Text>
              <Text style={styles.socialLoginButtonText}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 25,
  },
  logoIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.primary[500],
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: Colors.neutral[100],
    borderRadius: 25,
    padding: 4,
    marginBottom: 30,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  toogleIcon: {
    fontSize: 16,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#fff",
  },
  formContainer: {
    flex: 1,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary[500],
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginBottom: 25,
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
  eyeIcon: {
    padding: 5,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  checkmark: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
  },
  rememberMeText: {
    fontSize: 14,
    color: Colors.neutral[700],
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: "600",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: Colors.primary[500],
    gap: 8,
  },
  continueButtonIcon: {
    fontSize: 18,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.neutral[300],
  },
  dividerText: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginHorizontal: 15,
  },
  socialLoginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.neutral[100],
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  socialLoginButtonIcon: {
    fontSize: 20,
  },
  socialLoginButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.neutral[700],
  },
});

export default SignIn;
