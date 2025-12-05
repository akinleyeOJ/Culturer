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
  AppState,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShoppingBagIcon, ArrowRightOnRectangleIcon, UserPlusIcon, UserIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from "react-native-heroicons/outline";
import FontAwesome from "@expo/vector-icons/FontAwesome"; // Keep for Apple icon
import { Colors } from "../../constants/color";
import { supabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const AuthScreen = () => {
  const router = useRouter();
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

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength++;
    return strength;
  };

  // Handle password change with strength calculation
  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    if (isSignUp) {
      setPasswordStrength(calculatePasswordStrength(pwd));
    }
  };

  // Listen for deep link when returning from email confirmation
  useEffect(() => {
    // Check if user just came back from email confirmation
    const checkEmailVerification = async () => {
      try {
        // Refresh the session from the server to get latest email confirmation status
        const {
          data: { session },
        } = await supabase.auth.refreshSession();

        // If user has a session, check if they're OAuth or email user
        if (session?.user) {
          const hasOAuthIdentity = session.user.identities?.some(
            (identity) =>
              identity.provider === "google" || identity.provider === "apple",
          );

          // OAuth users don't need email confirmation, navigate directly
          if (hasOAuthIdentity) {
            console.log("OAuth user detected, navigating to home...");
            router.replace("/(tabs)/Home");
            return;
          }

          // For email users, check if email is confirmed
          if (session.user.email_confirmed_at) {
            console.log("Email confirmed! Navigating to home...");
            router.replace("/(tabs)/Home");
          } else {
            console.log("Email not yet confirmed");
          }
        }
      } catch (error) {
        console.error("Error checking email verification:", error);
      }
    };

    checkEmailVerification();

    // Listen for deep links
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      console.log("Deep link received:", url);
      if (url.includes("auth/success")) {
        // User confirmed email, refresh session
        setTimeout(() => checkEmailVerification(), 500);
      }
    });

    // Listen for app state changes (when user returns to app from browser)
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          console.log("App came to foreground, checking email verification");
          // Add small delay to ensure network request completes
          setTimeout(() => checkEmailVerification(), 500);
        }
      },
    );

    return () => {
      linkingSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

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

    // Clear password when switching from sign-in to sign-up
    if (!isSignUp && signUp) {
      setPassword("");
      setConfirmPassword("");
    }

    setIsSignUp(signUp);
    // Reset password strength when switching modes
    if (!signUp) {
      setPasswordStrength(0);
    }
  };

  const handleContinue = async () => {
    if (loading) return;

    if (isSignUp) {
      // Sign Up validation
      if (!name || !email || !password || !confirmPassword) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }
      if (name.trim().length < 2) {
        Alert.alert("Error", "Name must be at least 2 characters");
        return;
      }
      if (name.trim().length > 50) {
        Alert.alert("Error", "Name must be less than 50 characters");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        Alert.alert("Error", "Please enter a valid email address");
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
      if (!/[A-Z]/.test(password)) {
        Alert.alert(
          "Error",
          "Password must contain at least one uppercase letter",
        );
        return;
      }
      if (!/[0-9]/.test(password)) {
        Alert.alert("Error", "Password must contain at least one number");
        return;
      }
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
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
            },
            emailRedirectTo: "https://culturar.netlify.app",
          },
        });

        console.log("=== SIGNUP RESPONSE ===");
        console.log("Error:", error);
        console.log("Has User:", !!data.user);
        console.log("Has Session:", !!data.session);
        console.log("User ID:", data.user?.id);
        console.log("User Email:", data.user?.email);
        console.log("Email Confirmed:", data.user?.email_confirmed_at);
        console.log("Created At:", data.user?.created_at);
        console.log("Identities Count:", data.user?.identities?.length);
        console.log(
          "Identities:",
          JSON.stringify(data.user?.identities, null, 2),
        );
        console.log("Session:", data.session ? "EXISTS" : "NULL");
        console.log("=====================");

        if (error) {
          if (
            error.message.toLowerCase().includes("already") ||
            error.message.toLowerCase().includes("exist") ||
            error.message.toLowerCase().includes("registered")
          ) {
            Alert.alert(
              "Account Exists",
              "This email is already registered. Please sign in instead or use 'Continue with Google' if you signed up with Google.",
            );
            return;
          }
          throw error;
        }

        // Check if user was created recently (within last 5 seconds)
        // If user exists but was created long ago, it's an existing account
        if (data.user && data.user.created_at) {
          const createdDate = new Date(data.user.created_at);
          const now = new Date();
          const ageInSeconds = (now.getTime() - createdDate.getTime()) / 1000;

          console.log("User age:", ageInSeconds, "seconds");

          // If user was created more than 5 seconds ago, it's an existing account
          if (ageInSeconds > 5) {
            console.log(
              "User account is old - this is account linking, not new signup",
            );
            Alert.alert(
              "Account Exists",
              "This email is already registered. Please sign in or use 'Continue with Google' if you signed up with Google.",
            );
            return;
          }
        }

        // CRITICAL CHECK: If session is returned, user already exists
        // For new signups with email confirmation enabled, session should be null
        if (data.session) {
          console.log("Session returned - this indicates existing account");

          // Check if user has Google OAuth
          const hasOAuthIdentity = data.user?.identities?.some(
            (identity) =>
              identity.provider === "google" || identity.provider === "apple",
          );

          if (hasOAuthIdentity) {
            Alert.alert(
              "Account Exists",
              "This email is already registered with Google. Please use 'Continue with Google' to sign in.",
            );
          } else {
            Alert.alert(
              "Account Exists",
              "This email is already registered. Please sign in instead.",
            );
          }
          return;
        }

        // Check if user has no identities or only non-email identities
        // This catches the case where signup silently fails for existing OAuth accounts
        if (data.user) {
          const identities = data.user.identities || [];
          console.log("Checking identities. Count:", identities.length);

          // If user returned but NO identities at all, it's suspicious
          if (identities.length === 0) {
            console.log("No identities returned - likely existing account");
            Alert.alert(
              "Account Exists",
              "This email is already registered. Please sign in or use 'Continue with Google' if you signed up with Google.",
            );
            return;
          }

          const hasEmailIdentity = identities.some(
            (identity) => identity.provider === "email",
          );

          const hasOAuthIdentity = identities.some(
            (identity) =>
              identity.provider === "google" || identity.provider === "apple",
          );

          console.log("Has Email Identity:", hasEmailIdentity);
          console.log("Has OAuth Identity:", hasOAuthIdentity);

          // If user has OAuth but NO email identity, account linking happened
          if (hasOAuthIdentity && !hasEmailIdentity) {
            console.log(
              "OAuth exists but no email identity - account linking detected",
            );
            Alert.alert(
              "Account Exists",
              "This email is already registered with Google. Please use 'Continue with Google' to sign in.",
            );
            return;
          }
        }

        // Additional check: Look at identity creation times
        if (
          data.user &&
          data.user.identities &&
          data.user.identities.length > 1
        ) {
          // If user has multiple identities, check if email identity is newest
          const emailIdentity = data.user.identities.find(
            (i) => i.provider === "email",
          );
          const oauthIdentity = data.user.identities.find(
            (i) => i.provider === "google" || i.provider === "apple",
          );

          if (
            emailIdentity &&
            oauthIdentity &&
            emailIdentity.created_at &&
            oauthIdentity.created_at
          ) {
            const emailCreated = new Date(emailIdentity.created_at);
            const oauthCreated = new Date(oauthIdentity.created_at);

            // If OAuth identity is older, user had Google account first
            if (oauthCreated < emailCreated) {
              console.log("OAuth identity existed first - blocking signup");
              Alert.alert(
                "Account Exists",
                "This email is already registered with Google. Please use 'Continue with Google' to sign in.",
              );
              return;
            }
          }
        }

        Alert.alert(
          "Success! 📧",
          "Please check your email to verify your account. Click the confirmation link in the email we just sent you.",
          [
            {
              text: "OK",
              onPress: () => {
                // Don't switch to sign in mode, stay here
                // User will come back after clicking email link
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
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        Alert.alert("Error", "Please enter a valid email address");
        return;
      }

      setLoading(true);
      try {
        const { error, data } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Check for unconfirmed email
          if (error.message.toLowerCase().includes("email not confirmed")) {
            Alert.alert(
              "Email Not Confirmed",
              "Please check your email and click the confirmation link to verify your account. Check your spam folder if you don't see it.",
              [
                {
                  text: "Resend Email",
                  onPress: async () => {
                    try {
                      const { error } = await supabase.auth.resend({
                        type: "signup",
                        email: email.trim(),
                      });
                      if (error) throw error;
                      Alert.alert(
                        "Success",
                        "Confirmation email sent! Please check your inbox.",
                      );
                    } catch (err: any) {
                      Alert.alert("Error", err.message);
                    }
                  },
                },
                { text: "OK" },
              ],
            );
            return;
          }

          if (
            error.message.toLowerCase().includes("invalid") ||
            error.message.toLowerCase().includes("credentials")
          ) {
            Alert.alert(
              "Sign In Failed",
              "Invalid email or password. If you signed up with Google, please use 'Continue with Google' instead.",
            );
            return;
          }
          throw error;
        }

        // Check if email is confirmed
        if (data.user && !data.user.email_confirmed_at) {
          Alert.alert(
            "Email Not Confirmed",
            "Please verify your email before signing in. Check your inbox for the confirmation link.",
            [
              {
                text: "Resend Email",
                onPress: async () => {
                  try {
                    const { error } = await supabase.auth.resend({
                      type: "signup",
                      email: email.trim(),
                    });
                    if (error) throw error;
                    Alert.alert(
                      "Success",
                      "Confirmation email sent! Please check your inbox.",
                    );
                  } catch (err: any) {
                    Alert.alert("Error", err.message);
                  }
                },
              },
              { text: "OK" },
            ],
          );
          // Sign them out since email isn't confirmed
          await supabase.auth.signOut();
          return;
        }

        // Navigate to the home screen after successful login
        router.replace("/(tabs)/Home");
      } catch (error: any) {
        Alert.alert("Sign In Error", error.message || "Invalid credentials");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    if (loading) return;

    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: "culturar://auth/callback",
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          "culturar://auth/callback",
        );

        if (result.type === "success") {
          const params = new URLSearchParams(result.url.split("#")[1]);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            // FIX: Check user identities BEFORE setting session to prevent "Home screen flash"
            const {
              data: { user },
            } = await supabase.auth.getUser(access_token);

            if (user && user.identities) {
              const hasEmailProvider = user.identities.some(
                (identity) => identity.provider === "email",
              );
              const hasOAuthProvider = user.identities.some(
                (identity) =>
                  identity.provider === "google" ||
                  identity.provider === "apple",
              );

              // Check if we have conflicting providers (Email + Social)
              // This means an account exists with email, but they are trying to login with Social
              if (hasEmailProvider && hasOAuthProvider) {
                // DO NOT set the session here. Just show the alert.
                Alert.alert(
                  "Account Exists",
                  "This email is already registered. Please sign in with your email and password instead.",
                );
                return; // Stop execution here
              }
            }

            // Only set session if no conflict found
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            router.replace("/(tabs)/Home");
          }
        } else if (result.type === "cancel") {
          Alert.alert("Cancelled", "Sign in was cancelled");
        }
      }
    } catch (error: any) {
      console.error("OAuth Error", error);

      let errorMessage = "Failed to authenticate";
      if (error.message.toLowerCase().includes("already")) {
        errorMessage =
          "This email is already registered with email/password. Please use email sign-in instead.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Sign In Error", errorMessage);
    } finally {
      setLoading(false);
    }
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
            <ShoppingBagIcon size={40} color={Colors.primary[500]} />
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
                <ArrowRightOnRectangleIcon
                  size={16}
                  color={!isSignUp ? "#fff" : "#666"}
                />
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
                <UserPlusIcon
                  size={16}
                  color={isSignUp ? "#fff" : "#666"}
                />
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
                  <UserIcon size={18} color={Colors.neutral[500]} style={styles.inputIcon} />
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
                <EnvelopeIcon size={18} color={Colors.neutral[500]} style={styles.inputIcon} />
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
                <LockClosedIcon size={18} color={Colors.neutral[500]} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="***********"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={handlePasswordChange}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <EyeIcon size={18} color={Colors.neutral[500]} />
                  ) : (
                    <EyeSlashIcon size={18} color={Colors.neutral[500]} />
                  )}
                </TouchableOpacity>
              </View>
              {isSignUp && password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.passwordStrengthBars}>
                    <View
                      style={[
                        styles.strengthBar,
                        passwordStrength >= 1 && styles.strengthBarWeak,
                      ]}
                    />
                    <View
                      style={[
                        styles.strengthBar,
                        passwordStrength >= 2 && styles.strengthBarMedium,
                      ]}
                    />
                    <View
                      style={[
                        styles.strengthBar,
                        passwordStrength >= 3 && styles.strengthBarGood,
                      ]}
                    />
                    <View
                      style={[
                        styles.strengthBar,
                        passwordStrength >= 4 && styles.strengthBarStrong,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.strengthText,
                      passwordStrength === 1 && styles.strengthTextWeak,
                      passwordStrength === 2 && styles.strengthTextMedium,
                      passwordStrength === 3 && styles.strengthTextGood,
                      passwordStrength === 4 && styles.strengthTextStrong,
                    ]}
                  >
                    {passwordStrength === 0 && "Too weak"}
                    {passwordStrength === 1 && "Weak"}
                    {passwordStrength === 2 && "Medium"}
                    {passwordStrength === 3 && "Good"}
                    {passwordStrength === 4 && "Strong"}
                  </Text>
                </View>
              )}
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
                  <LockClosedIcon size={18} color={Colors.neutral[500]} style={styles.inputIcon} />
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
                    {showPassword ? (
                      <EyeIcon size={18} color={Colors.neutral[500]} />
                    ) : (
                      <EyeSlashIcon size={18} color={Colors.neutral[500]} />
                    )}
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

                <TouchableOpacity onPress={() => router.push("/(auth)/forgotPassword")}>
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
                  <EnvelopeIcon size={18} color="#fff" />
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
              onPress={() => handleSocialLogin("google")}
            >
              <Image
                source={{
                  uri: "https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_18dp.png",
                }}
                style={styles.googleLogo}
                resizeMode="contain"
              />
              <Text style={styles.socialLoginButtonText}>
                {isSignUp ? "Continue" : "Continue"} with Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialLoginButton}
              onPress={() => handleSocialLogin("apple")}
            >
              <FontAwesome name="apple" size={25} color="#000000" />
              <Text style={styles.socialLoginButtonText}>
                {isSignUp ? "Continue" : "Continue"} with Apple
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
    gap: 8,
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
  passwordStrengthContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  passwordStrengthBars: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.neutral[300],
    borderRadius: 2,
  },
  strengthBarWeak: {
    backgroundColor: "#ef4444",
  },
  strengthBarMedium: {
    backgroundColor: "#9eed90",
  },
  strengthBarGood: {
    backgroundColor: "#0cda2b",
  },
  strengthBarStrong: {
    backgroundColor: "#10b981",
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.neutral[500],
  },
  strengthTextWeak: {
    color: "#ef4444",
  },
  strengthTextMedium: {
    color: "#9eed90",
  },
  strengthTextGood: {
    color: "#0cda2b",
  },
  strengthTextStrong: {
    color: "#10b981",
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
  googleLogo: {
    left: 4,
    width: 20,
    height: 20,
  },
  socialLoginButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.neutral[700],
  },
});

export default AuthScreen;