import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "../../constants/color";
import { supabase } from "../../lib/supabase";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const SignIn = () => {
  // Toggle between sign-in and sign-up mode
  const [isSignUp, setIsSignUp] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Calculate slide distance based on actual container width
  const slideDistance = containerWidth > 0 ? (containerWidth - 8) / 2 : 0;

  // Sign In fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Sign Up fields
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Animation on toggle change
  useEffect(() => {
    // Configure layout animation
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        300,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );

    // Slide animation for toggle indicator
    Animated.spring(slideAnim, {
      toValue: isSignUp ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();

    // Fade animation for content
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSignUp, slideAnim, fadeAnim]);

  const handleToggle = (signUp: boolean) => {
    // Scale animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsSignUp(signUp);
  };

  const handleContinue = async () => {
    if (loading) return; // Prevent multiple submissions

    if (isSignUp) {
      // Sign Up validation
      if (!name || !email || !password || !confirmPassword) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }
      if (password.length < 8) {
        Alert.alert("Error", "Password must be at least 8 characters");
        return;
      }
      // Check for uppercase letter
      if (!/[A-Z]/.test(password)) {
        Alert.alert(
          "Error",
          "Password must contain at least one uppercase letter",
        );
        return;
      }
      // Check for number
      if (!/[0-9]/.test(password)) {
        Alert.alert("Error", "Password must contain at least one number");
        return;
      }
      // Check for special character
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        Alert.alert(
          "Error",
          "Password must contain at least one special character (!@#$%^&*)",
        );
        return;
      }
      if (!agreeToTerms) {
        Alert.alert("Error", "Please agree to the terms and conditions");
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) throw error;

        Alert.alert(
          "Success",
          "Account created successfully! Please check your email to verify your account.",
          [
            {
              text: "OK",
              onPress: () => {
                // Switch to sign in mode
                handleToggle(false);
              },
            },
          ],
        );
      } catch (error: any) {
        Alert.alert("Sign Up Error", error.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    } else {
      // Sign In validation
      if (!email || !password) {
        Alert.alert("Error", "Please enter email and password");
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        // Navigate to the home screen after successful login
        router.replace("/(tabs)/Home");
      } catch (error: any) {
        Alert.alert("Sign In Error", error.message || "Invalid credentials");
      } finally {
        setLoading(false);
      }
    }
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
          <View
            style={styles.toggleContainer}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setContainerWidth(width);
            }}
          >
            {/* Animated sliding background indicator */}
            <Animated.View
              style={[
                styles.toggleIndicator,
                {
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, slideDistance],
                      }),
                    },
                  ],
                },
              ]}
            />

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => handleToggle(false)}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.toggleButtonContent,
                  { transform: [{ scale: !isSignUp ? scaleAnim : 1 }] },
                ]}
              >
                <Text style={styles.toogleIcon}>🔓</Text>
                <Text
                  style={[
                    styles.toggleText,
                    !isSignUp && styles.toggleTextActive,
                  ]}
                >
                  Login
                </Text>
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => handleToggle(true)}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.toggleButtonContent,
                  { transform: [{ scale: isSignUp ? scaleAnim : 1 }] },
                ]}
              >
                <Text style={styles.toogleIcon}>👤</Text>
                <Text
                  style={[
                    styles.toggleText,
                    isSignUp && styles.toggleTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Form Container */}
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            {isSignUp && (
              <>
                <Text style={styles.formTitle}>Create an Account</Text>
                <Text style={styles.formSubtitle}>
                  Join our community and start exploring
                </Text>
              </>
            )}

            {/* Name Input - Sign Up Only */}
            {isSignUp && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                    autoCorrect={false}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
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
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                </TouchableOpacity>
              </View>
              {isSignUp && (
                <Text style={styles.passwordHint}>
                  Must be at least 8 characters with one uppercase letter, one
                  number, and one special character (!@#$%^&*)
                </Text>
              )}
            </View>

            {/* Confirm Password - Sign Up Only */}
            {isSignUp && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="***********"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Text>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Remember Me and Forgot Password - Sign In Only */}
            {!isSignUp && (
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
                  <Text style={styles.forgotPasswordText}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Terms and Conditions - Sign Up Only */}
            {isSignUp && (
              <TouchableOpacity
                style={styles.termsContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreeToTerms && styles.checkboxChecked,
                  ]}
                >
                  {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{" "}
                  <Text style={styles.termsLink}>Terms & Conditions</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (loading || (isSignUp && !agreeToTerms)) &&
                  styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={loading || (isSignUp && !agreeToTerms)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.continueButtonIcon}>✉️</Text>
                  <Text style={styles.continueButtonText}>
                    {isSignUp ? "Create Account" : "Continue with Email"}
                  </Text>
                </>
              )}
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
                {isSignUp ? "Sign up" : "Continue"} with Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialLoginButton}
              onPress={() => handleSocialLogin("Apple")}
            >
              <Text style={styles.socialLoginButtonIcon}>🍎</Text>
              <Text style={styles.socialLoginButtonText}>
                {isSignUp ? "Sign up" : "Continue"} with Apple
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
    position: "relative",
  },
  toggleIndicator: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    width: "49.8%",
    backgroundColor: Colors.primary[500],
    borderRadius: 20,
    shadowColor: Colors.primary[500],
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    zIndex: 1,
  },
  toggleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: "transparent",
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
  passwordHint: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[700],
  },
  termsLink: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: "600",
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
  continueButtonDisabled: {
    backgroundColor: Colors.neutral[400],
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
