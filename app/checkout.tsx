import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MagnifyingGlassIcon, XMarkIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import { Colors } from "../constants/color";
import CustomButton from "../components/Button";
import { DeliveryStep } from "../components/checkout/DeliveryStep";
import { PaymentStep } from "../components/checkout/PaymentStep";
import { ReviewStep } from "../components/checkout/ReviewStep";
import {
  type CheckoutAddress as Address,
  type CheckoutStep,
} from "../components/checkout/types";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { useCheckoutShipping } from "../lib/hooks/useCheckoutShipping";
import { supabase } from "../lib/supabase";
import { fetchCart, clearCart, CartItem } from "../lib/services/cartService";
import { trackProductSale } from "../lib/services/productService";
import { formatWeight, SHIPPING_LAUNCH_COUNTRY } from "../lib/shippingUtils";
import {
  ChevronLeftIcon,
  LockClosedIcon,
} from "react-native-heroicons/outline";
import { CheckCircleIcon as CheckCircleSolid } from "react-native-heroicons/solid";
import { useStripe } from "@stripe/stripe-react-native";
import { setPickupPointSelectionState } from "../lib/pickupPointSelectionStore";

const COUNTRIES = [{ name: SHIPPING_LAUNCH_COUNTRY, flag: "🇵🇱" }];

const LIVE_SHIPPING_APIS_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_LIVE_SHIPPING_APIS === "true" ||
  (!__DEV__ && process.env.EXPO_PUBLIC_ENABLE_LIVE_SHIPPING_APIS !== "false");

const Checkout = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const {
    productId,
    quantity: paramQuantity,
    orderId,
  } = useLocalSearchParams<{
    productId?: string;
    quantity?: string;
    orderId?: string;
  }>();

  // State management
  const [step, setStep] = useState<CheckoutStep>(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Data
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Mobile Payments
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<
    number | null
  >(null);

  // Form State
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [orderNote, setOrderNote] = useState("");

  // Payment State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "card" | "apple_pay" | "p24"
  >("card");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [saveCard, setSaveCard] = useState(false);

  // Stripe hooks
  const { createPaymentMethod } = useStripe();
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [stripePaymentMethodId, setStripePaymentMethodId] = useState<
    string | null
  >(null);

  // Filter/Modal State
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");

  // Promo Code State
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // Saved Cards State
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(
    null,
  );
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    if (country !== SHIPPING_LAUNCH_COUNTRY) {
      setCountry(SHIPPING_LAUNCH_COUNTRY);
    }
  }, [country]);

  const {
    sellerShipping,
    shippingZone,
    selectedCarrier,
    setSelectedCarrier,
    totalWeightGrams,
    cartWeightTier,
    selectedLocker,
    setSelectedLocker,
    lockerSearch,
    setLockerSearch,
    lockerSearchContext,
    setLockerSearchContext,
    loadingRates,
    integratedCarrierOptions,
    shippingCost,
  } = useCheckoutShipping({
    cartItems,
    email,
    country,
    city,
    zipCode,
    address1,
    address2,
    firstName,
    lastName,
    phone,
    step,
    liveShippingApisEnabled: LIVE_SHIPPING_APIS_ENABLED,
  });

  // Fetch Saved Cards
  const fetchSavedCards = useCallback(async () => {
    if (!user) return;
    setLoadingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-payment-methods",
        {
          body: { userId: user.id },
        },
      );
      if (error) throw error;
      if (data?.paymentMethods) {
        setSavedCards(data.paymentMethods);
        // Optionally auto-select the first card
        // if (data.paymentMethods.length > 0) setSelectedSavedCardId(data.paymentMethods[0].id);
      }
    } catch (e) {
      console.error("Error fetching cards:", e);
    }
    setLoadingCards(false);
  }, [user]);

  useEffect(() => {
    if (step === 2 && selectedPaymentMethod === "card") {
      fetchSavedCards();
    }
  }, [fetchSavedCards, selectedPaymentMethod, step]);

  // Handle Back Navigation
  // Handle Back Navigation
  useEffect(() => {
    // Disable native swipe gesture on steps > 1 to prevent accidental exit
    // This forces the user to use the custom UI back button for inter-step navigation
    navigation.setOptions({
      gestureEnabled: step === 1,
    });
  }, [step, navigation]);

  // Data Loading
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);

      console.log(
        "Checkout loadData - productId:",
        productId,
        "quantity:",
        paramQuantity,
      );

      if (productId) {
        // Direct "Buy Now" flow
        try {
          // Fetch product
          const { data: p, error: pError } = await supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .single();

          if (pError || !p) {
            console.error("Error fetching product for Buy Now:", pError);
            setLoading(false);
            return;
          }

          // Fetch seller profile separately to get full_name and is_shop_live
          let sellerName = "Seller";
          if (p.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, is_shop_live")
              .eq("id", p.user_id)
              .single();

            if (profile) {
              if (profile.is_shop_live === false) {
                Alert.alert(
                  "Shop on Break",
                  "The seller is currently away. This item cannot be purchased right now.",
                );
                router.back();
                return;
              }
              if (profile.full_name) sellerName = profile.full_name;
            }
          }

          const quantity = paramQuantity
            ? parseInt(paramQuantity as string)
            : 1;

          if (p.stock_quantity <= 0) {
            Alert.alert("Sold Out", "Sorry, this item was just sold.");
            router.back();
            return;
          }

          if (quantity > p.stock_quantity) {
            Alert.alert(
              "Limited Stock",
              `Sorry, only ${p.stock_quantity} available.`,
            );
            router.back();
            return;
          }

          const priceNum =
            typeof p.price === "string"
              ? parseFloat((p.price as string).replace("$", ""))
              : p.price;

          console.log("Setting direct purchase item:", {
            id: p.id,
            name: p.name,
            price: priceNum,
            quantity,
          });

          const discount = p.discount_percentage || 0;
          const effectivePrice =
            discount > 0 ? priceNum * (1 - discount / 100) : priceNum;
          setCartItems([
            {
              id: p.id,
              product_id: p.id,
              user_id: user.id,
              quantity: quantity,
              created_at: new Date().toISOString(),
              product: {
                id: p.id,
                name: p.name,
                price: effectivePrice,
                image_url: p.image_url || undefined,
                seller_id: p.user_id,
                seller_name: sellerName,
                emoji: p.emoji || "📦",
                shipping: p.shipping || "Standard",
                out_of_stock: p.out_of_stock || false,
                stock_quantity: p.stock_quantity || 1,
              },
            },
          ]);
        } catch (err) {
          console.error("Exception in Buy Now loadData:", err);
        }
      } else if (orderId) {
        // Resume Pending Order Flow
        try {
          console.log("Resuming pending order:", orderId);
          const { data: orderItems, error: itemsError } = await supabase
            .from("order_items" as any)
            .select("*, products(*)")
            .eq("order_id", orderId);

          if (itemsError || !orderItems) {
            console.error("Error fetching order items:", itemsError);
            setLoading(false);
            return;
          }

          // Map to CartItem format
          const mappedItems = orderItems.map((item: any) => {
            const p = item.products;
            const priceNum =
              typeof p.price === "string"
                ? parseFloat((p.price as string).replace("$", ""))
                : p.price;

            const discount2 = p.discount_percentage || 0;
            const effectivePrice2 =
              discount2 > 0 ? priceNum * (1 - discount2 / 100) : priceNum;
            return {
              id: item.id,
              product_id: item.product_id,
              user_id: user.id,
              quantity: item.quantity,
              created_at: item.created_at || new Date().toISOString(),
              product: {
                id: p.id,
                name: p.name,
                price: effectivePrice2,
                image_url: p.image_url || undefined,
                seller_id: p.user_id,
                seller_name: "Seller",
                emoji: p.emoji || "📦",
                shipping: p.shipping || "Standard",
                out_of_stock: p.out_of_stock || false,
                stock_quantity: p.stock_quantity || 1,
              },
            } as CartItem;
          });

          setCartItems(mappedItems);
        } catch (err) {
          console.error("Exception in Resume Order loadData:", err);
        }
      } else {
        const items = await fetchCart(user.id);
        setCartItems(items);
      }

      // Prefill form data if available
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, saved_address, payment_methods")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
      }

      console.log("Profile query result:", { profile, error: profileError });

      if (user.email) setEmail(user.email);

      if (profile?.full_name) {
        const names = profile.full_name.split(" ");
        setFirstName(names[0]);
        if (names.length > 1) setLastName(names.slice(1).join(" "));
      }

      // Load saved address if available
      if (profile?.saved_address) {
        const rawAddr = profile.saved_address as any;
        console.log("Raw saved_address from DB:", rawAddr);
        // Handle legacy single object or new array
        let addrs: Address[] = [];
        if (Array.isArray(rawAddr)) {
          addrs = rawAddr;
        } else if (rawAddr.line1) {
          addrs = [rawAddr];
        }

        console.log("Parsed addresses:", addrs);
        setSavedAddresses(addrs);

        // Pre-select the first one if available
        if (addrs.length > 0) {
          fillAddressForm(addrs[0]);
          setSelectedAddressIndex(0);
        }
      } else {
        console.log("No saved_address found in profile");
      }

      // Load saved payment info if available (partial)
      if (profile?.payment_methods) {
        const pm = profile.payment_methods as any;
        if (pm.cardHolder) setCardHolderName(pm.cardHolder);
      }

      // Log successful load for debugging
      console.log("Profile loaded:", profile);

      // CHECKOUT DRAFT (Local Persistence) - Overrides profile if exists
      try {
        const draftJson = await AsyncStorage.getItem("checkout_draft");
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.email) setEmail(draft.email);
          if (draft.firstName) setFirstName(draft.firstName);
          if (draft.lastName) setLastName(draft.lastName);
          if (draft.address1) setAddress1(draft.address1);
          if (draft.address2) setAddress2(draft.address2);
          if (draft.city) setCity(draft.city);
          if (draft.zipCode) setZipCode(draft.zipCode);
          if (draft.country) setCountry(draft.country);
          if (draft.phone) setPhone(draft.phone);
          // Payment - only restore if not empty
          if (draft.cardHolderName) setCardHolderName(draft.cardHolderName);
          if (draft.cardNumber) setCardNumber(draft.cardNumber);
          if (draft.cardExpiry) setCardExpiry(draft.cardExpiry);
        }
      } catch (e) {
        console.log("Failed to load draft", e);
      }

      setLoading(false);
    };
    loadData();
  }, [orderId, paramQuantity, productId, router, user]);

  // Switch Payment Method if Country Changes (P24 only for Poland)
  useEffect(() => {
    if (country !== "Poland" && selectedPaymentMethod === "p24") {
      setSelectedPaymentMethod("card");
    }
  }, [country, selectedPaymentMethod]);

  // Auto-Save Draft to AsyncStorage
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const draft = {
          email,
          firstName,
          lastName,
          address1,
          address2,
          city,
          zipCode,
          country,
          phone,
          cardHolderName,
          cardNumber,
          cardExpiry,
        };
        await AsyncStorage.setItem("checkout_draft", JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [
    email,
    firstName,
    lastName,
    address1,
    address2,
    city,
    zipCode,
    country,
    phone,
    cardHolderName,
    cardNumber,
    cardExpiry,
  ]);

  // Address Management
  const fillAddressForm = (addr: Address) => {
    setFirstName(addr.firstName || "");
    setLastName(addr.lastName || "");
    setAddress1(addr.line1 || "");
    setAddress2(addr.line2 || "");
    setCity(addr.city || "");
    setZipCode(addr.zipCode || "");
    setCountry(addr.country || "");
    setPhone(addr.phone || "");
  };

  const clearAddressForm = () => {
    setFirstName("");
    setLastName("");
    setAddress1("");
    setAddress2("");
    setCity("");
    setZipCode("");
    setCountry("");
    setPhone("");
    setSelectedAddressIndex(null);
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!address1 || !city || !zipCode || !firstName || !lastName) {
      Alert.alert("Missing Fields", "Please fill in all address fields.");
      return;
    }

    // Limit to 4 addresses
    if (selectedAddressIndex === null && savedAddresses.length >= 4) {
      Alert.alert(
        "Limit Reached",
        "You can only save up to 4 addresses. Please delete an old one to add a new address.",
      );
      return;
    }

    const newAddr: Address = {
      firstName,
      lastName,
      line1: address1,
      line2: address2,
      city,
      zipCode,
      country,
      phone,
      label: `${firstName} ${lastName}`,
    };

    let updatedList = [...savedAddresses];
    if (selectedAddressIndex !== null && selectedAddressIndex >= 0) {
      // Update existing
      updatedList[selectedAddressIndex] = newAddr;
    } else {
      // Add new
      updatedList.push(newAddr);
    }

    console.log("Saving addresses:", updatedList);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        saved_address: updatedList as any,
      })
      .eq("id", user.id)
      .select();

    if (error) {
      console.error("Error saving address:", error);
      if (
        error.message &&
        error.message.includes("Could not find the 'saved_address' column")
      ) {
        Alert.alert(
          "System Error",
          'The "saved_address" column is missing in the database. Please contact support or run migrations.',
        );
      } else {
        Alert.alert("Error", `Failed to save address: ${error.message}`);
      }
    } else {
      console.log("Address saved successfully:", data);
      setSavedAddresses(updatedList);
      if (selectedAddressIndex === null) {
        // If we just added a new one, select it
        setSelectedAddressIndex(updatedList.length - 1);
      }
      Alert.alert("Success", "Address saved successfully.");
    }
  };

  const handleDeleteAddress = async () => {
    if (!user || selectedAddressIndex === null) return;

    const updatedList = savedAddresses.filter(
      (_, i) => i !== selectedAddressIndex,
    );

    const { error } = await supabase
      .from("profiles")
      .update({
        saved_address: updatedList as any,
      })
      .eq("id", user.id);

    if (error) {
      Alert.alert("Error", "Failed to delete address.");
    } else {
      setSavedAddresses(updatedList);
      clearAddressForm();
      Alert.alert("Success", "Address removed.");
    }
  };

  // Total cost calculations
  const hasIntegratedShippingOptions = integratedCarrierOptions.length > 0;

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    const resolvedShippingCost = shippingCost;

    const tax = subtotal * 0.1; // 10% Tax

    let discountAmount = 0;
    if (appliedDiscount) {
      const discountableSubtotal = appliedDiscount.seller_id
        ? cartItems
            .filter(
              (item) => item.product.seller_id === appliedDiscount.seller_id,
            )
            .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
        : subtotal;

      if (appliedDiscount.discount_type === "percentage") {
        discountAmount =
          discountableSubtotal * (appliedDiscount.discount_value / 100);
      } else {
        discountAmount = Math.min(
          Number(appliedDiscount.discount_value),
          discountableSubtotal,
        );
      }
    }

    const total = Math.max(
      0,
      subtotal + resolvedShippingCost + tax - discountAmount,
    );

    return {
      subtotal,
      shippingCost: resolvedShippingCost,
      tax,
      discount: discountAmount,
      total,
    };
  }, [appliedDiscount, cartItems, shippingCost]);

  // Filtered Countries
  const filteredCountries = useMemo(() => {
    if (!searchCountry) return COUNTRIES;
    return COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(searchCountry.toLowerCase()),
    );
  }, [searchCountry]);

  // Render Country Modal
  const renderCountryModal = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCountryPicker(false)}
            style={styles.circleBtn}
          >
            <ChevronLeftIcon size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select country</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchContainer}>
          <MagnifyingGlassIcon size={20} color={Colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={searchCountry}
            onChangeText={setSearchCountry}
            autoCorrect={false}
          />
          {searchCountry.length > 0 && (
            <TouchableOpacity onPress={() => setSearchCountry("")}>
              <XMarkIcon size={20} color={Colors.neutral[400]} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.name}
          renderItem={({ item, index }) => {
            const firstLetter = item.name[0];
            const prevLetter =
              index > 0 ? filteredCountries[index - 1].name[0] : null;
            const showHeader = firstLetter !== prevLetter;

            return (
              <View>
                {showHeader && (
                  <Text style={styles.countrySectionHeader}>{firstLetter}</Text>
                )}
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setCountry(item.name);
                    setShowCountryPicker(false);
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>
                      {item.flag}
                    </Text>
                    <Text style={styles.countryName}>{item.name}</Text>
                  </View>
                  {country === item.name && (
                    <CheckCircleSolid size={20} color={Colors.primary[500]} />
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );

  // Handlers
  const isPolishZip = /^\d{2}-\d{3}$/.test(zipCode);

  const isStepValid = () => {
    if (step === 1) {
      const hasBasicInfo = !!(
        email &&
        address1 &&
        city &&
        zipCode &&
        firstName &&
        lastName &&
        country &&
        phone
      );
      if (!hasBasicInfo) return false;
      if (!isPolishZip) return false;

      if (hasIntegratedShippingOptions) {
        if (!selectedCarrier) return false;
        if (selectedCarrier?.type === "locker" && !selectedLocker) return false;
        if (
          selectedCarrier?.type !== "pickup" &&
          selectedCarrier?.quote_status !== "ready"
        )
          return false;
      } else {
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (selectedPaymentMethod === "card") {
        if (selectedSavedCardId) return true;
        return !!(cardHolderName.trim() && cardDetails?.complete);
      }
      return true; // Apple Pay/P24 handled during placement
    }

    return true;
  };

  const handleNextStep = async () => {
    if (step === 1) {
      // 1. Basic Address Validation
      if (
        !email ||
        !address1 ||
        !city ||
        !zipCode ||
        !firstName ||
        !lastName ||
        !country ||
        !phone
      ) {
        Alert.alert(
          "Information Needed",
          "Please complete your contact and shipping information to continue.",
        );
        return;
      }

      // 2. Polish postcode format
      if (!isPolishZip) {
        Alert.alert(
          "Invalid Postcode",
          "Please enter a valid Polish postcode in the format XX-XXX (e.g. 00-001).",
        );
        return;
      }

      // 3. Shipping Method Validation
      if (hasIntegratedShippingOptions) {
        if (!selectedCarrier) {
          Alert.alert(
            "Carrier Selection",
            "Please select a shipping option for your order.",
          );
          return;
        }

        // Locker validation
        if (selectedCarrier?.type === "locker" && !selectedLocker) {
          Alert.alert(
            "Pickup Point",
            "Please select a pickup point/locker for this carrier.",
          );
          return;
        }

        if (
          selectedCarrier?.type !== "pickup" &&
          selectedCarrier?.quote_status !== "ready"
        ) {
          Alert.alert(
            "Live Quote Needed",
            "This delivery option does not have a live quote yet. Please choose a different option or complete pickup point selection first.",
          );
          return;
        }
      } else {
        Alert.alert(
          "No Shipping Options",
          "No direct carrier shipping options are available for this route yet. Please try a different delivery address.",
        );
        return;
      }

      setStep(2);
    } else if (step === 2) {
      // Validate payment info
      if (selectedPaymentMethod === "card") {
        // Use Saved Card if selected
        if (selectedSavedCardId) {
          setStripePaymentMethodId(selectedSavedCardId);
          setStep(3);
          return;
        }

        if (!cardHolderName.trim()) {
          Alert.alert(
            "Cardholder Name",
            "Please enter the name exactly as it appears on your card.",
          );
          return;
        }
        if (!cardDetails?.complete) {
          Alert.alert(
            "Payment Details",
            "Please enter your complete card information.",
          );
          return;
        }

        // Create Payment Method HERE (Before CardField Unmounts!)
        setProcessing(true);
        const pmId = await createStripePaymentMethod();
        setProcessing(false);

        if (!pmId) {
          // Error is shown in createStripePaymentMethod
          return;
        }
        setStripePaymentMethodId(pmId);
      }

      // For Apple Pay and Przelewy24, validation happens during payment process
      setStep(3);
    }
  };

  const createStripePaymentMethod = async () => {
    if (selectedPaymentMethod !== "card") {
      return null;
    }

    try {
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: "Card",
        paymentMethodData: {
          billingDetails: {
            name: cardHolderName,
            email: user?.email || "",
          },
        },
      });

      if (error) {
        console.error("Error creating payment method:", error);
        Alert.alert("Payment Error", error.message);
        return null;
      }

      console.log("Payment method created:", paymentMethod.id);
      return paymentMethod.id;
    } catch (err) {
      console.error("Exception creating payment method:", err);
      Alert.alert("Payment Error", "Failed to process card details");
      return null;
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    setProcessing(true);

    try {
      // 1. Get Payment Method ID
      let paymentMethodId = stripePaymentMethodId;

      // Should already have it from step 2, but just in case check flow
      if (selectedPaymentMethod === "card" && !paymentMethodId) {
        Alert.alert(
          "Error",
          "Card details lost. Please go back and re-enter card.",
        );
        setProcessing(false);
        return;
      }

      const shippingAddressObj = {
        line1: address1,
        line2: address2,
        city,
        zipCode,
        country,
        phone,
        firstName,
        lastName,
      };

      // Save Payment Method preference (Token only)
      if (saveCard && paymentMethodId) {
        await supabase
          .from("profiles")
          .update({
            payment_methods: {
              last4: cardDetails?.last4 || "xxxx",
              brand: cardDetails?.brand || "card",
              stripe_payment_method_id: paymentMethodId,
            },
          })
          .eq("id", user.id);
      }

      // 2. Create or Retrieve Order
      let orderIdToUse = orderId;
      let order: any;

      if (orderIdToUse) {
        // Determine if we are resuming a pending order
        const { data: existingOrder, error: fetchError } = await supabase
          .from("orders" as any)
          .select("*")
          .eq("id", orderIdToUse)
          .single();

        if (fetchError || !existingOrder) {
          // Fallback to creating new if not found (shouldn't happen)
          orderIdToUse = undefined;
        } else {
          order = existingOrder;
          // Update shipping info if changed during resume
          await supabase
            .from("orders" as any)
            .update({
              shipping_address: shippingAddressObj,
              payment_method: selectedPaymentMethod,
              carrier_name: selectedCarrier?.name || null,
              shipping_method_details: selectedCarrier
                ? {
                    carrier: selectedCarrier.name,
                    type:
                      selectedCarrier?.type === "locker"
                        ? "locker_pickup"
                        : selectedCarrier?.type === "pickup"
                          ? "local_pickup"
                          : "home_delivery",
                    pricing_mode:
                      selectedCarrier?.type === "pickup"
                        ? "local_pickup"
                        : "provider_direct",
                    quote_amount: selectedCarrier?.quote_amount ?? null,
                    quote_currency: selectedCarrier?.quote_currency ?? null,
                    quote_id: selectedCarrier?.quote_id ?? null,
                    weight_tier: cartWeightTier,
                    total_weight_grams: totalWeightGrams,
                    handling_fee: 0,
                    locker:
                      selectedCarrier?.type === "locker" && selectedLocker
                        ? {
                            id: selectedLocker.id,
                            address: selectedLocker.address,
                          }
                        : null,
                  }
                : null,
            })
            .eq("id", orderIdToUse);
        }
      }

      if (!orderIdToUse) {
        const { data: newOrder, error: orderError } = await supabase
          .from("orders" as any)
          .insert({
            user_id: user.id,
            seller_id: cartItems[0]?.product.seller_id || "system",
            subtotal: totals.subtotal,
            shipping_cost: totals.shippingCost,
            tax: totals.tax,
            total_amount: totals.total,
            status: "pending",
            shipping_address: shippingAddressObj,
            payment_method: selectedPaymentMethod,
            notes: orderNote,
            carrier_name: selectedCarrier?.name || null,
            shipping_zone: shippingZone,
            shipping_method_details: selectedCarrier
              ? {
                  carrier: selectedCarrier.name,
                  type:
                    selectedCarrier?.type === "locker"
                      ? "locker_pickup"
                      : selectedCarrier?.type === "pickup"
                        ? "local_pickup"
                        : "home_delivery",
                  pricing_mode:
                    selectedCarrier?.type === "pickup"
                      ? "local_pickup"
                      : "provider_direct",
                  quote_amount: selectedCarrier?.quote_amount ?? null,
                  quote_currency: selectedCarrier?.quote_currency ?? null,
                  quote_id: selectedCarrier?.quote_id ?? null,
                  weight_tier: cartWeightTier,
                  total_weight_grams: totalWeightGrams,
                  handling_fee: 0,
                  locker:
                    selectedCarrier?.type === "locker" && selectedLocker
                      ? {
                          id: selectedLocker.id,
                          address: selectedLocker.address,
                        }
                      : null,
                }
              : null,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        order = newOrder;

        // 3. Create Order Items ONLY for new orders
        const orderItemsData = cartItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product.price,
          product_name: item.product.name,
          product_image: item.product.image_url || item.product.images?.[0],
        }));

        const { error: itemsError } = await supabase
          .from("order_items" as any)
          .insert(orderItemsData);
        if (itemsError) throw itemsError;
      }

      // 4. Process Payment (Wrapper for Edge Function)
      if (selectedPaymentMethod === "card" && paymentMethodId) {
        console.log("Processing payment...");
        const { data: paymentResult, error: paymentError } =
          await supabase.functions.invoke("create-payment-intent", {
            body: {
              amount: totals.total,
              currency: "eur",
              paymentMethodId: paymentMethodId,
              orderId: order.id,
              userId: user.id, // Pass User ID for Customer creation
              email: user.email, // Pass User Email
              saveCard: saveCard, // Pass Switch State
              metadata: {
                customerEmail: user.email,
                customerName: `${firstName} ${lastName}`,
              },
            },
          });

        if (paymentError || !paymentResult?.success) {
          console.error("Payment failed:", paymentError || paymentResult);
          // Note: Order status will stay 'pending' (or be handled by backend cleanup)
          // We cannot update it here due to RLS security
          setProcessing(false);
          router.push({
            pathname: "/payment-failed",
            params: {
              reason:
                paymentResult?.error || "Your payment could not be processed.",
            },
          });
          return;
        }

        console.log("Payment successful:", paymentResult.paymentIntentId);

        // Update Order Status to Paid immediately upon success AND refresh created_at so it shows as new
        await supabase
          .from("orders" as any)
          .update({
            status: "paid",
            payment_intent_id: paymentResult.paymentIntentId,
            created_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        // Track Sales for each item
        for (const item of cartItems) {
          if (item.product_id && item.product.seller_id) {
            await trackProductSale(item.product_id, item.product.seller_id);
          }
        }
      }

      // 5. Payment Success
      // Note: Order status is updated by Stripe Webhook
      // We cannot update it here due to RLS security

      // 6. Notifications
      try {
        // To Buyer
        await supabase.from("notifications" as any).insert({
          user_id: user.id,
          type: "order",
          title: "Order Confirmed!",
          body: `Your order for ${cartItems[0]?.product.name}${cartItems.length > 1 ? ` and ${cartItems.length - 1} other items` : ""} has been placed.`,
          data: { orderId: order.id },
        });

        // To Seller(s)
        const uniqueSellers = Array.from(
          new Set(cartItems.map((item) => item.product.seller_id)),
        );
        for (const sellerId of uniqueSellers) {
          if (sellerId && sellerId !== "system") {
            await supabase.from("notifications" as any).insert({
              user_id: sellerId,
              type: "order",
              title: "Item Sold!",
              body: `Good news! Someone just purchased your item. Time to ship!`,
              data: { orderId: order.id },
            });
          }
        }
      } catch (notifErr) {
        console.error("Error creating post-checkout notifications:", notifErr);
      }

      // 7. Cleanup
      if (!productId) {
        await clearCart(user.id);
      }
      await AsyncStorage.removeItem("checkout_draft");
      await refreshCartCount();

      setStripePaymentMethodId(null); // Clear stored ID
      setProcessing(false);

      // Navigate to Success Screen
      router.replace({
        pathname: "/order-confirmation",
        params: { orderId: order.id },
      });
    } catch (error: any) {
      console.error(error);
      setProcessing(false);
      Alert.alert("Order Failed", error.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  // Render Components
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() =>
          step > 1 ? setStep((s) => (s - 1) as CheckoutStep) : router.back()
        }
        style={styles.circleBtn}
      >
        <ChevronLeftIcon size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Checkout</Text>
        <LockClosedIcon
          size={14}
          color={Colors.text.secondary}
          style={{ marginLeft: 4 }}
        />
      </View>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTextContainer}>
        <Text
          style={[styles.progressText, step === 1 && styles.progressTextActive]}
        >
          1. Delivery
        </Text>
        <Text style={styles.progressTextSeperator}>—</Text>
        <Text
          style={[styles.progressText, step === 2 && styles.progressTextActive]}
        >
          2. Payment
        </Text>
        <Text style={styles.progressTextSeperator}>—</Text>
        <Text
          style={[styles.progressText, step === 3 && styles.progressTextActive]}
        >
          3. Review
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[styles.progressIndicator, { width: `${(step / 3) * 100}%` }]}
        />
      </View>
    </View>
  );

  const handleApplyCoupon = async () => {
    if (!promoCode) return;
    setCheckingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons" as any)
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        Alert.alert(
          "Invalid Coupon",
          "This code does not exist or has expired.",
        );
        setAppliedDiscount(null);
        setCheckingCoupon(false);
        return;
      }

      const couponData = data as any;

      // Verify coupon belongs to a seller whose items are in the cart
      const cartSellerIds = cartItems.map((item) => item.product.seller_id);
      if (
        couponData.seller_id &&
        !cartSellerIds.includes(couponData.seller_id)
      ) {
        Alert.alert(
          "Invalid Coupon",
          "This coupon doesn't apply to items in your cart.",
        );
        setAppliedDiscount(null);
        setCheckingCoupon(false);
        return;
      }

      setAppliedDiscount(couponData);
      Alert.alert("Success", `Coupon applied: ${couponData.code}`);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to apply coupon.");
    }
    setCheckingCoupon(false);
  };

  const openPickupPointPicker = () => {
    if (!selectedCarrier) return;

    setPickupPointSelectionState({
      carrierName: selectedCarrier.name,
      selection: selectedLocker,
      search: lockerSearch,
      context: lockerSearchContext,
    });
    router.push({
      pathname: "/pickup-points",
      params: {
        carrierName: selectedCarrier.name,
        address1,
        city,
        zipCode,
        country,
      },
    } as any);
  };

  const clearPickupPointDraft = () => {
    setLockerSearch("");
    setLockerSearchContext(null);
    setPickupPointSelectionState({
      carrierName: "",
      selection: null,
      search: "",
      context: null,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0 && !processing && !productId) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Your cart is empty.</Text>
          <CustomButton
            title="Go Back"
            onPress={() => router.back()}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {renderHeader()}
        {renderProgressBar()}

        <ScrollView
          keyboardShouldPersistTaps="always"
          contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
          keyboardDismissMode="on-drag"
        >
          {step === 1 && (
            <DeliveryStep
              styles={styles}
              email={email}
              setEmail={setEmail}
              savedAddresses={savedAddresses}
              selectedAddressIndex={selectedAddressIndex}
              clearAddressForm={clearAddressForm}
              fillAddressForm={fillAddressForm}
              setSelectedAddressIndex={setSelectedAddressIndex}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              address1={address1}
              setAddress1={setAddress1}
              address2={address2}
              setAddress2={setAddress2}
              city={city}
              setCity={setCity}
              zipCode={zipCode}
              setZipCode={setZipCode}
              country={country}
              setCountry={setCountry}
              phone={phone}
              setPhone={setPhone}
              setShowCountryPicker={setShowCountryPicker}
              handleSaveAddress={handleSaveAddress}
              handleDeleteAddress={handleDeleteAddress}
              totalWeightGrams={totalWeightGrams}
              formattedWeight={formatWeight(totalWeightGrams)}
              sellerShipping={sellerShipping}
              shippingZone={shippingZone}
              liveShippingApisEnabled={LIVE_SHIPPING_APIS_ENABLED}
              loadingRates={loadingRates}
              integratedCarrierOptions={integratedCarrierOptions}
              selectedCarrier={selectedCarrier}
              setSelectedCarrier={setSelectedCarrier}
              selectedLocker={selectedLocker}
              setSelectedLocker={setSelectedLocker}
              clearPickupPointDraft={clearPickupPointDraft}
              onOpenPickupPointPicker={openPickupPointPicker}
              orderNote={orderNote}
              setOrderNote={setOrderNote}
            />
          )}
          {step === 2 && (
            <PaymentStep
              styles={styles}
              country={country}
              selectedPaymentMethod={selectedPaymentMethod}
              setSelectedPaymentMethod={setSelectedPaymentMethod}
              loadingCards={loadingCards}
              savedCards={savedCards}
              selectedSavedCardId={selectedSavedCardId}
              setSelectedSavedCardId={setSelectedSavedCardId}
              saveCard={saveCard}
              setSaveCard={setSaveCard}
              cardHolderName={cardHolderName}
              setCardHolderName={setCardHolderName}
              setCardDetails={setCardDetails}
            />
          )}
          {step === 3 && (
            <ReviewStep
              styles={styles}
              cartItems={cartItems}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              handleApplyCoupon={handleApplyCoupon}
              checkingCoupon={checkingCoupon}
              appliedDiscount={appliedDiscount}
              totals={totals}
              firstName={firstName}
              lastName={lastName}
              address1={address1}
              city={city}
              selectedCarrier={selectedCarrier}
              cardNumber={cardNumber}
              selectedSavedCardId={selectedSavedCardId}
              savedCards={savedCards}
              onEditDelivery={() => setStep(1)}
              onEditPayment={() => setStep(2)}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 3 ? (
            <CustomButton
              title={step === 1 ? "Continue to Payment" : "Review Order"}
              onPress={handleNextStep}
              style={{
                backgroundColor: !isStepValid()
                  ? Colors.neutral[300]
                  : Colors.primary[500],
              }}
            />
          ) : (
            <CustomButton
              title={
                processing ? "Processing..." : `Pay €${totals.total.toFixed(2)}`
              }
              onPress={handlePlaceOrder}
              disabled={processing}
            />
          )}
        </View>
        {renderCountryModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  progressContainer: {
    paddingVertical: 16,
    backgroundColor: Colors.neutral[50],
  },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between", // Distribute evenly
    paddingHorizontal: 24, // Add some padding
    marginBottom: 8,
  },
  progressText: {
    fontSize: 15, // Bigger font
    color: Colors.neutral[400],
    fontWeight: "600",
  },
  progressTextActive: {
    color: Colors.primary[500],
  },
  progressTextSeperator: {
    marginHorizontal: 8,
    color: Colors.neutral[300],
  },
  progressBar: {
    height: 4, // Slightly thicker
    backgroundColor: Colors.neutral[200],
    marginHorizontal: 24, // Match text container padding
    borderRadius: 2,
    overflow: "hidden",
  },
  progressIndicator: {
    height: "100%",
    backgroundColor: Colors.primary[500],
  },
  content: {
    padding: 20,
  },
  stepContainer: {
    gap: 24,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: Colors.text.primary,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
    color: Colors.text.secondary,
  },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    marginBottom: 12,
  },
  radioOptionSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.neutral[400],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioDot: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary[500],
  },
  radioTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  radioSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  radioPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    borderColor: Colors.primary[500],
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxLabel: {
    fontSize: 15,
    color: Colors.text.primary,
  },
  cardInputContainer: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 16,
    backgroundColor: Colors.neutral[50],
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    marginBottom: 12,
    paddingBottom: 4,
  },
  cardInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text.primary,
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 6,
  },
  secureText: {
    fontSize: 12,
    color: Colors.success[700],
    fontWeight: "500",
  },
  reviewItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  reviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  paymentIconContainer: {
    width: 40,
    height: 28,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cardBrandBadge: {
    width: 20,
    height: 12,
    borderRadius: 2,
  },
  cardBrandLogo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    height: 20,
  },
  reviewItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  reviewItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  reviewItemMeta: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  reviewItemPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  costValue: {
    fontSize: 15,
    color: Colors.text.primary,
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary[500],
  },
  recapContainer: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 8,
    padding: 16,
  },
  recapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  recapLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  recapValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: "500",
  },
  editLink: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral[200],
    marginVertical: 12,
  },
  termsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: "center",
    marginTop: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: Colors.neutral[200],
    backgroundColor: "#fff",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  pillContainer: {
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  savedAddressCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    backgroundColor: "#fff",
    minWidth: 100,
    alignItems: "flex-start",
  },
  savedAddressCardSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  savedAddressText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text.primary,
  },
  savedAddressTextSelected: {
    color: Colors.primary[700],
  },
  pillSelected: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary[500],
  },
  pillText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  pillTextSelected: {
    color: Colors.primary[600],
    fontWeight: "600",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    backgroundColor: Colors.neutral[50],
    marginBottom: 16,
  },
  countrySelectorText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? 20 : 0,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.neutral[100],
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text.primary,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  countryName: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  countrySectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text.secondary,
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Shipping Zone & Weight Styles
  weightSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  weightSummaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  weightSummaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  zoneInfoBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  zoneInfoText: {
    fontSize: 13,
    color: "#166534",
    lineHeight: 18,
  },
  apiCostHintBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  apiCostHintText: {
    fontSize: 13,
    color: "#1D4ED8",
    lineHeight: 18,
  },

  // Locker Selection Styles
  lockerSection: {
    marginTop: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  lockerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  lockerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  pickupLauncher: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 14,
  },
  pickupLauncherRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pickupLauncherCopy: {
    flex: 1,
  },
  pickupLauncherTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  pickupLauncherSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 17,
  },
  lockerAutocompleteWrap: {
    position: "relative",
    zIndex: 30,
    marginBottom: 8,
  },
  lockerSearchIcon: {
    position: "absolute",
    left: 12,
    top: 14,
    zIndex: 2,
  },
  lockerAutocompleteContainer: {
    flex: 0,
    width: "100%",
  },
  lockerAutocompleteInputContainer: {
    width: "100%",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
  },
  lockerAutocompleteInput: {
    height: 46,
    marginTop: 0,
    marginBottom: 0,
    paddingLeft: 34,
    paddingRight: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFF",
    borderRadius: 10,
  },
  lockerAutocompleteList: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 6,
    backgroundColor: "#FFF",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  lockerSearchFallbackInput: {
    height: 46,
    width: "100%",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingLeft: 34,
    paddingRight: 12,
    fontSize: 15,
    color: "#111827",
  },
  lockerAutocompleteHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  lockerStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  lockerStatusText: {
    fontSize: 13,
    color: "#6B7280",
  },
  lockerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  lockerItemSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  lockerItemContent: {
    flex: 1,
  },
  lockerId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  lockerAddress: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
  lockerHint: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 2,
  },
  lockerCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary[500],
    justifyContent: "center",
    alignItems: "center",
  },
  lockerConfirm: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  lockerConfirmText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "500",
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.neutral[500],
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loadingRatesBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary[50],
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  loadingRatesText: {
    marginLeft: 10,
    fontSize: 13,
    color: Colors.primary[700],
    fontWeight: "600",
  },
});

export default Checkout;
