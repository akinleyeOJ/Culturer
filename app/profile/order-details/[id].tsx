import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  ChevronLeftIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
  StarIcon,
  TruckIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  MapPinIcon,
} from "react-native-heroicons/outline";
import { supabase } from "../../../lib/supabase";
import { formatPln } from "../../../lib/formatPln";
import { getTrackingUrl } from "../../../lib/shippingUtils";
import { createInPostShipmentFromOrder } from "../../../lib/services/inpostService";
import { useAuth } from "../../../contexts/AuthContext";
import { Colors } from "../../../constants/color";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  user_id: string;
  seller_id: string;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total_amount: number;
  status:
    | "pending"
    | "paid"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "confirmed";
  shipping_address: {
    line1: string;
    line2?: string;
    city: string;
    zipCode: string;
    country: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  payment_method: string;
  carrier_name: string | null;
  tracking_number: string | null;
  tracking_url?: string | null;
  label_url?: string | null;
  shipping_status?: string | null;
  shipping_method_details: any | null;
  seller_name?: string;
  shipping_zone: string | null;
  created_at: string;
  updated_at?: string;
  order_items: OrderItem[];
}

const OrderDetailsScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTrackingNumber, setShipTrackingNumber] = useState("");
  const [shipProcessing, setShipProcessing] = useState(false);
  const [existingReviews, setExistingReviews] = useState<any[]>([]);

  // Common carriers for the dropdown
  const CARRIER_OPTIONS = [
    "InPost",
    "DHL",
    "DPD",
    "Royal Mail",
    "Evri",
    "UPS",
    "FedEx",
    "Poczta Polska",
    "Hermes",
    "GLS",
    "Poste Italiane",
    "BRT",
    "Colissimo",
    "Correos",
    "PostNL",
  ];

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders" as any)
        .select(
          `
          *,
          order_items (*)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      const fetchedOrder = data as any;

      // Fetch seller profile to get the name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", fetchedOrder.seller_id)
        .single();

      setOrder({
        ...fetchedOrder,
        seller_name: profileData?.full_name || "Seller",
      } as unknown as Order);

      // Fetch any reviews for this order
      const { data: reviewsData } = await supabase
        .from("reviews" as any)
        .select("*")
        .eq("order_id", id);

      if (reviewsData) {
        setExistingReviews(reviewsData);
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchOrderDetails();
    }, [fetchOrderDetails]),
  );

  const statusSteps = [
    { label: "Placed", status: "pending" },
    { label: "Paid", status: "paid" },
    { label: "Shipped", status: "shipped" },
    { label: "Delivered", status: "delivered" },
  ];

  const getStatusIndex = (status: string) => {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s === "cancelled") return -1;
    if (s === "confirmed") return 1; // Map confirmed to paid
    return statusSteps.findIndex((step) => step.status === s);
  };

  const currentStatusIndex = order ? getStatusIndex(order.status) : 0;

  const shippingMethodCard = useMemo(() => {
    if (!order) return null;
    const d = order.shipping_method_details as Record<string, unknown> | null;
    if (!d) return null;

    const type = String(d.type || "");
    const carrier = String(d.carrier || order.carrier_name || "");

    if (type === "locker_pickup") {
      const locker = d.locker as
        | { id?: string; address?: string | Record<string, unknown> }
        | undefined;
      const lockerId = locker?.id ? String(locker.id) : null;
      const lockerAddress =
        typeof locker?.address === "string"
          ? locker.address
          : locker?.address &&
              typeof locker.address === "object" &&
              "line1" in locker.address
            ? [(locker.address as any).line1, (locker.address as any).city]
                .filter(Boolean)
                .join(", ")
            : null;

      return {
        type: "locker" as const,
        carrier,
        lockerId,
        lockerAddress,
      };
    }

    if (type === "home_delivery") {
      return { type: "home" as const, carrier };
    }

    if (type === "local_pickup") {
      return { type: "local" as const, carrier };
    }

    return carrier ? { type: "other" as const, carrier } : null;
  }, [order]);

  const inPostAutoFulfillmentEligible = useMemo(() => {
    if (!order || user?.id !== order.seller_id) return false;
    const st = String(order.status || "").toLowerCase();
    if (st !== "paid" && st !== "confirmed") return false;
    if (order.tracking_number) return false;
    const d = order.shipping_method_details as Record<string, unknown> | null;
    const carrier = String(
      (d?.carrier as string) || order.carrier_name || "",
    ).toLowerCase();
    if (!carrier.includes("inpost")) return false;
    const t = String(d?.type || "");
    if (t === "local_pickup") return false;
    if (t === "locker_pickup") {
      const locker = d?.locker as { id?: string } | undefined;
      return Boolean(locker?.id);
    }
    if (t === "home_delivery") return true;
    return false;
  }, [order, user?.id]);

  const handleFinishPayment = () => {
    // Redirect back to checkout with this order context
    router.push({
      pathname: "/checkout",
      params: { orderId: order?.id },
    } as any);
  };

  const handleUpdateStatus = async (newStatus: Order["status"]) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("orders" as any)
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      Alert.alert("Status Updated", `Order marked as ${newStatus}.`);
      fetchOrderDetails();
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", "Failed to update order status");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsShipped = async () => {
    if (!shipCarrier.trim() || !shipTrackingNumber.trim()) {
      Alert.alert(
        "Required",
        "Please select a carrier and enter the tracking number.",
      );
      return;
    }
    try {
      setShipProcessing(true);
      const carrier = shipCarrier.trim();
      const tracking = shipTrackingNumber.trim();
      const trackingUrl = getTrackingUrl(carrier, tracking);

      const { error } = await supabase
        .from("orders" as any)
        .update({
          status: "shipped",
          carrier_name: carrier,
          tracking_number: tracking,
          ...(trackingUrl ? { tracking_url: trackingUrl } : {}),
        })
        .eq("id", id);

      if (error) throw error;

      setShowShipModal(false);
      setShipCarrier("");
      setShipTrackingNumber("");
      Alert.alert(
        "Shipped!",
        "Order marked as shipped. Buyer can now track their package.",
      );
      fetchOrderDetails();
    } catch (error) {
      console.error("Error marking as shipped:", error);
      Alert.alert("Error", "Failed to mark as shipped");
    } finally {
      setShipProcessing(false);
    }
  };

  const handleCreateInPostShipment = async () => {
    if (!order?.id) return;
    try {
      setShipProcessing(true);
      const result = await createInPostShipmentFromOrder(order.id);
      if (!result.success) {
        Alert.alert("InPost", result.error);
        return;
      }
      Alert.alert(
        "Shipment created",
        `Tracking number: ${result.tracking_number}\n\nThe buyer can track the parcel from this order screen.`,
      );
      fetchOrderDetails();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not create InPost shipment.");
    } finally {
      setShipProcessing(false);
    }
  };

  const handleContactUser = async () => {
    if (!order || !user) return;

    // If I'm the buyer, contact seller. If I'm seller, contact buyer.
    const isSeller = user.id === order.seller_id;
    const firstItem = order.order_items[0];

    // Helper to validate UUID
    const isUUID = (str: string) => {
      // Relaxed regex to accept any UUID version (just hex and dashes structure)
      const regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return regex.test(str);
    };

    // DEBUG: Temporary alert to see what the ID actually is
    // if (!isUUID(order.seller_id)) {
    //     Alert.alert("Debug Info", `Seller ID is: '${order.seller_id}' (Type: ${typeof order.seller_id})`);
    // }

    // If seller is "system" (platform) or invalid UUID, redirect to help/support instead of chat
    if (order.seller_id === "system" || !isUUID(order.seller_id)) {
      // "system" is not a valid UUID, so we can't create a chat record.
      // Redirect to the support/issue form instead.
      router.push(`/profile/order-issue/${order.id}` as any);
      return;
    }

    try {
      // New conversation template logic
      const initialMessage = isSeller
        ? `Hi, I'm contacting you regarding Order #${order.id.slice(0, 8)}`
        : `Hi, I have a question about my order #${order.id.slice(0, 8)}`;

      // Check for any conversation between these two users regarding this product
      // Since conversation roles are fixed (buyer_id is always the one who bought, seller_id is always the one who sold),
      // we can just query directly.
      const query = supabase
        .from("conversations" as any)
        .select("id")
        .eq("product_id", firstItem.product_id)
        .eq("buyer_id", order.user_id)
        .eq("seller_id", order.seller_id);

      const { data: conversations, error } = await query;

      if (error) throw error;

      if (conversations && conversations.length > 0) {
        const convId = (conversations[0] as any).id;
        router.push({
          pathname: `/conversation/${convId}`,
          params: { prefill: initialMessage },
        } as any);
        return;
      }

      // Create new conversation if none exists

      const { data: newConv, error: createError } = await supabase
        .from("conversations" as any)
        .insert({
          product_id: firstItem.product_id,
          buyer_id: order.user_id,
          seller_id: order.seller_id,
          // last_message: initialMessage, // Remove auto-send in inbox
        })
        .select()
        .single();

      if (createError) throw createError;

      if (newConv) {
        // Open the new conversation and pre-fill the message
        router.push({
          pathname: `/conversation/${(newConv as any).id}`,
          params: { prefill: initialMessage },
        } as any);
      }
    } catch (err) {
      console.error("Error opening chat:", err);
      Alert.alert("Error", "Could not open chat. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text>Order not found</Text>
      </View>
    );
  }

  const renderStatusBanner = () => {
    if (!order.shipping_status || order.status === "cancelled") return null;

    let bannerColor = Colors.primary[50];
    let textColor = Colors.primary[700];
    let icon = <TruckIcon size={20} color={Colors.primary[600]} />;
    let message = "";

    switch (order.shipping_status) {
      case "pre_transit":
        message = "Label prepared. Waiting for carrier pickup.";
        break;
      case "in_transit":
        message = "Your package is on its way!";
        bannerColor = "#EFF6FF";
        textColor = "#1E40AF";
        break;
      case "out_for_delivery":
        message = "Out for delivery! Your package will arrive today.";
        bannerColor = "#F0FDF4";
        textColor = "#166534";
        icon = <CheckCircleIcon size={20} color="#166534" />;
        break;
      case "delivered":
        message = "Delivered! Check your porch or mailbox.";
        bannerColor = "#F0FDF4";
        textColor = "#166534";
        icon = <CheckCircleIcon size={20} color="#166534" />;
        break;
      case "failure":
      case "returned":
        message = "Delivery issue: Package is being returned to sender.";
        bannerColor = "#FEF2F2";
        textColor = "#991B1B";
        icon = <XCircleIcon size={20} color="#991B1B" />;
        break;
      default:
        return null;
    }

    return (
      <View style={[styles.statusBanner, { backgroundColor: bannerColor }]}>
        {icon}
        <Text style={[styles.statusBannerText, { color: textColor }]}>
          {message}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeftIcon size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.headerDate}>
            {new Date(
              (order.status === "paid" || order.status === "confirmed") &&
              order.updated_at
                ? order.updated_at
                : order.created_at,
            ).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
      >
        {/* Status Banner */}
        {renderStatusBanner()}

        {/* Status Tracker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          {order.status === "cancelled" ? (
            <View style={styles.cancelledContainer}>
              <XCircleIcon size={24} color={Colors.danger[500]} />
              <Text style={styles.cancelledText}>This order was cancelled</Text>
            </View>
          ) : (
            <View style={styles.stepperContainer}>
              {statusSteps.map((step, index) => (
                <View key={step.label} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      index <= currentStatusIndex && styles.activeStepCircle,
                    ]}
                  >
                    {index <= currentStatusIndex && (
                      <View style={styles.innerCircle} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      index <= currentStatusIndex && styles.activeStepLabel,
                    ]}
                  >
                    {step.label}
                  </Text>
                  {index < statusSteps.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        index < currentStatusIndex && styles.activeStepLine,
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.order_items.map((item) => (
            <View key={item.id} style={styles.itemContainer}>
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => router.push(`/item/${item.product_id}` as any)}
              >
                <Image
                  source={{ uri: item.product_image }}
                  style={styles.itemImage}
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatPln(item.price)}</Text>
              </TouchableOpacity>
              {order.status === "delivered" &&
                user?.id === order.user_id &&
                (() => {
                  const hasReviewedItem = existingReviews.some(
                    (r) =>
                      r.product_id === item.product_id && r.type === "product",
                  );
                  return hasReviewedItem ? (
                    <View style={styles.reviewedBadge}>
                      <CheckCircleIcon size={16} color={Colors.success[500]} />
                      <Text style={styles.reviewedBadgeText}>
                        Reviewed Item
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() =>
                        router.push({
                          pathname: `/profile/review/${item.product_id}`,
                          params: {
                            orderId: order.id,
                            sellerId: order.seller_id,
                            type: "product",
                            productName: item.product_name,
                            productImage: item.product_image,
                            price: item.price.toString(),
                          },
                        } as any)
                      }
                    >
                      <StarIcon size={16} color={Colors.primary[500]} />
                      <Text style={styles.reviewButtonText}>
                        Write an Item Review
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
            </View>
          ))}
        </View>

        {/* Delivery Method */}
        {shippingMethodCard && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Method</Text>
            <View style={styles.deliveryMethodCard}>
              {shippingMethodCard.type === "locker" ? (
                <>
                  <View style={styles.deliveryMethodRow}>
                    <ArchiveBoxIcon size={20} color={Colors.primary[600]} />
                    <View style={styles.deliveryMethodTextWrap}>
                      <Text style={styles.deliveryMethodLabel}>
                        {shippingMethodCard.carrier || "InPost Locker"}
                      </Text>
                      <Text style={styles.deliveryMethodSub}>
                        Paczkomat® pickup
                      </Text>
                    </View>
                  </View>
                  {shippingMethodCard.lockerId && (
                    <View style={styles.lockerPointBox}>
                      <MapPinIcon size={16} color={Colors.neutral[500]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lockerPointId}>
                          {shippingMethodCard.lockerId}
                        </Text>
                        {shippingMethodCard.lockerAddress ? (
                          <Text style={styles.lockerPointAddress}>
                            {shippingMethodCard.lockerAddress}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  )}
                </>
              ) : shippingMethodCard.type === "home" ? (
                <View style={styles.deliveryMethodRow}>
                  <TruckIcon size={20} color={Colors.primary[600]} />
                  <View style={styles.deliveryMethodTextWrap}>
                    <Text style={styles.deliveryMethodLabel}>
                      {shippingMethodCard.carrier || "Home Delivery"}
                    </Text>
                    <Text style={styles.deliveryMethodSub}>
                      Delivered to your door
                    </Text>
                  </View>
                </View>
              ) : shippingMethodCard.type === "local" ? (
                <View style={styles.deliveryMethodRow}>
                  <MapPinIcon size={20} color={Colors.primary[600]} />
                  <View style={styles.deliveryMethodTextWrap}>
                    <Text style={styles.deliveryMethodLabel}>Local Pickup</Text>
                    <Text style={styles.deliveryMethodSub}>
                      Collect from seller
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.deliveryMethodRow}>
                  <TruckIcon size={20} color={Colors.primary[600]} />
                  <View style={styles.deliveryMethodTextWrap}>
                    <Text style={styles.deliveryMethodLabel}>
                      {shippingMethodCard.carrier}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Shipping Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {shippingMethodCard?.type === "locker"
              ? "Your Contact Address"
              : "Shipping Address"}
          </Text>
          <View style={styles.addressCard}>
            <Text style={styles.addressName}>
              {order.shipping_address.firstName}{" "}
              {order.shipping_address.lastName}
            </Text>
            <Text style={styles.addressLine}>
              {order.shipping_address.line1}
            </Text>
            {order.shipping_address.line2 && (
              <Text style={styles.addressLine}>
                {order.shipping_address.line2}
              </Text>
            )}
            <Text style={styles.addressLine}>
              {order.shipping_address.city}, {order.shipping_address.zipCode}
            </Text>
            <Text style={styles.addressLine}>
              {order.shipping_address.country}
            </Text>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPln(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>
              {formatPln(order.shipping_cost)}
            </Text>
          </View>
          {order.tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{formatPln(order.tax)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatPln(order.total_amount)}
            </Text>
          </View>
        </View>

        {/* Tracking Info (shown when shipped or delivered) */}
        {Boolean(order.tracking_number) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Shipping Information</Text>
            <View style={styles.trackingCard}>
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>Carrier</Text>
                <Text style={styles.trackingValue}>
                  {order.carrier_name || "—"}
                </Text>
              </View>
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>Tracking #</Text>
                <Text style={styles.trackingValue}>
                  {order.tracking_number}
                </Text>
              </View>
              {order.tracking_number &&
                (() => {
                  const url =
                    order.tracking_url ||
                    (order.carrier_name
                      ? getTrackingUrl(
                          order.carrier_name,
                          order.tracking_number,
                        )
                      : null);
                  return url ? (
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={() => Linking.openURL(url)}
                    >
                      <TruckIcon size={18} color="#FFF" />
                      <Text style={styles.trackButtonText}>
                        {user?.id === order.seller_id
                          ? "Track Shipment"
                          : "Track My Package"}
                      </Text>
                    </TouchableOpacity>
                  ) : null;
                })()}
            </View>
          </View>
        )}

        {/* Seller Label Visibility */}
        {user?.id === order.seller_id && order.label_url && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📄 Shipping Label</Text>
            <View style={styles.labelSuccessBox}>
              <Text style={[styles.labelSuccessText, { marginBottom: 8 }]}>
                Your label is ready for printing
              </Text>
              <TouchableOpacity
                style={[
                  styles.viewLabelBtn,
                  { backgroundColor: Colors.primary[600] },
                ]}
                onPress={() => Linking.openURL(order.label_url!)}
              >
                <Text style={styles.viewLabelBtnText}>
                  Download / Print Label (PDF)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Order Actions */}
        <View style={styles.actionSection}>
          {user?.id === order.seller_id ? (
            // Seller Actions
            <>
              <Text style={styles.actionTitle}>Seller Controls</Text>
              {currentStatusIndex === 1 && inPostAutoFulfillmentEligible && (
                <TouchableOpacity
                  style={[styles.primaryActionButton]}
                  onPress={handleCreateInPostShipment}
                  disabled={shipProcessing}
                >
                  {shipProcessing ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryActionButtonText}>
                      Create InPost shipment
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {currentStatusIndex === 1 && inPostAutoFulfillmentEligible && (
                <TouchableOpacity
                  style={[styles.actionButton, { marginBottom: 8 }]}
                  onPress={() => {
                    if (order.carrier_name) {
                      setShipCarrier(order.carrier_name);
                    }
                    setShowShipModal(true);
                  }}
                  disabled={shipProcessing}
                >
                  <TruckIcon size={20} color={Colors.text.primary} />
                  <Text style={styles.actionButtonText}>
                    Enter tracking manually
                  </Text>
                </TouchableOpacity>
              )}
              {currentStatusIndex === 1 && !inPostAutoFulfillmentEligible && (
                <TouchableOpacity
                  style={[styles.primaryActionButton]}
                  onPress={() => {
                    if (order.carrier_name) {
                      setShipCarrier(order.carrier_name);
                    }
                    setShowShipModal(true);
                  }}
                >
                  <Text style={styles.primaryActionButtonText}>
                    Mark as Shipped
                  </Text>
                </TouchableOpacity>
              )}
              {order.status === "shipped" && (
                <TouchableOpacity
                  style={[styles.primaryActionButton]}
                  onPress={() => handleUpdateStatus("delivered")}
                >
                  <Text style={styles.primaryActionButtonText}>
                    Mark as Delivered
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleContactUser}
              >
                <ChatBubbleLeftRightIcon
                  size={20}
                  color={Colors.text.primary}
                />
                <Text style={styles.actionButtonText}>Contact Buyer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  router.push(`/profile/order-issue/${order.id}` as any)
                }
              >
                <QuestionMarkCircleIcon size={20} color={Colors.text.primary} />
                <Text style={styles.actionButtonText}>
                  Need Help from Culturar?
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Buyer Actions
            <>
              {order.status === "pending" && (
                <View style={styles.pendingActionWrapper}>
                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={handleFinishPayment}
                  >
                    <Text style={styles.primaryActionButtonText}>
                      Complete Payment
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.pendingNote}>
                    Your check out was started but payment isn't confirmed yet.
                  </Text>
                </View>
              )}

              {order.status === "shipped" && (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => handleUpdateStatus("delivered")}
                >
                  <Text style={styles.primaryActionButtonText}>
                    Mark as Received
                  </Text>
                </TouchableOpacity>
              )}

              {order.status === "delivered" &&
                user?.id === order.user_id &&
                (() => {
                  const hasReviewedShop = existingReviews.some(
                    (r) => r.type === "shop",
                  );
                  return hasReviewedShop ? (
                    <View
                      style={[
                        styles.actionButton,
                        { backgroundColor: "#F3F4F6" },
                      ]}
                    >
                      <CheckCircleIcon size={20} color={Colors.success[500]} />
                      <Text
                        style={[
                          styles.actionButtonText,
                          { color: Colors.success[600] },
                        ]}
                      >
                        Shop Review Submitted
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: Colors.primary[50] },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: `/profile/review/shop`,
                          params: {
                            orderId: order.id,
                            sellerId: order.seller_id,
                            type: "shop",
                            shopName: order.seller_name || "this shop",
                          },
                        } as any)
                      }
                    >
                      <StarIcon size={20} color={Colors.primary[600]} />
                      <Text
                        style={[
                          styles.actionButtonText,
                          { color: Colors.primary[700] },
                        ]}
                      >
                        Rate Shop Experience
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleContactUser}
              >
                <ChatBubbleLeftRightIcon
                  size={20}
                  color={Colors.text.primary}
                />
                <Text style={styles.actionButtonText}>Contact Seller</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  router.push(`/profile/order-issue/${order.id}` as any)
                }
              >
                <QuestionMarkCircleIcon size={20} color={Colors.text.primary} />
                <Text style={styles.actionButtonText}>
                  Need Help from Culturar?
                </Text>
              </TouchableOpacity>

              {order.status === "pending" && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() =>
                    router.push(`/profile/cancel-order/${order.id}` as any)
                  }
                >
                  <XCircleIcon size={20} color={Colors.danger[500]} />
                  <Text
                    style={[styles.actionButtonText, styles.cancelButtonText]}
                  >
                    Cancel Order
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ─── Ship Order Modal ─── */}
      <Modal
        visible={showShipModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShipModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShipModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.bottomSheet}
          >
            <Text style={styles.bottomSheetTitle}>Ship This Order</Text>
            <Text style={styles.bottomSheetSubtitle}>
              Add the carrier and tracking number once the parcel has been
              handed over.
            </Text>

            <Text style={styles.shipFieldLabel}>Carrier</Text>
            {order.carrier_name ? (
              <View
                style={[
                  styles.carrierChip,
                  styles.carrierChipActive,
                  { alignSelf: "flex-start", marginVertical: 8 },
                ]}
              >
                <Text
                  style={[styles.carrierChipText, styles.carrierChipTextActive]}
                >
                  {order.carrier_name}
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carrierChipsScroll}
              >
                {CARRIER_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.carrierChip,
                      shipCarrier === c && styles.carrierChipActive,
                    ]}
                    onPress={() => setShipCarrier(c)}
                  >
                    <Text
                      style={[
                        styles.carrierChipText,
                        shipCarrier === c && styles.carrierChipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={[styles.shipFieldLabel, { marginTop: 16 }]}>
              Tracking Number
            </Text>
            <TextInput
              style={styles.trackingInput}
              value={shipTrackingNumber}
              onChangeText={setShipTrackingNumber}
              placeholder="e.g. 628000123456789"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[
                styles.confirmShipBtn,
                (!shipCarrier || !shipTrackingNumber.trim()) &&
                  styles.confirmShipBtnDisabled,
              ]}
              onPress={handleMarkAsShipped}
              disabled={
                !shipCarrier || !shipTrackingNumber.trim() || shipProcessing
              }
            >
              {shipProcessing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmShipBtnText}>Confirm Shipped</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelShipBtn}
              onPress={() => setShowShipModal(false)}
            >
              <Text style={styles.cancelShipBtnText}>Close</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: "#FFF",
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomColor: "#F3F4F6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  activeStepCircle: {
    borderColor: Colors.primary[500],
  },
  innerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary[500],
  },
  stepLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 8,
    fontWeight: "600",
  },
  activeStepLabel: {
    color: Colors.primary[500],
  },
  stepLine: {
    position: "absolute",
    top: 12,
    left: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "#D1D5DB",
    zIndex: 1,
  },
  activeStepLine: {
    backgroundColor: Colors.primary[500],
  },
  cancelledContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.danger[500] + "10",
    borderRadius: 12,
  },
  cancelledText: {
    marginLeft: 8,
    color: Colors.danger[500],
    fontWeight: "600",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  itemQty: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  deliveryMethodCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    padding: 12,
    gap: 10,
  },
  deliveryMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deliveryMethodTextWrap: {
    flex: 1,
  },
  deliveryMethodLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0C4A6E",
  },
  deliveryMethodSub: {
    fontSize: 13,
    color: "#075985",
    marginTop: 1,
  },
  lockerPointBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    padding: 10,
    marginTop: 2,
  },
  lockerPointId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0369A1",
    letterSpacing: 0.5,
  },
  lockerPointAddress: {
    fontSize: 13,
    color: "#075985",
    marginTop: 2,
  },
  addressCard: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  addressName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary[600],
  },
  actionSection: {
    padding: 16,
    marginTop: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryActionButton: {
    backgroundColor: Colors.primary[500],
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 12,
  },
  cancelButton: {
    borderColor: Colors.danger[500] + "30",
  },
  cancelButtonText: {
    color: Colors.danger[500],
  },
  pendingActionWrapper: {
    marginBottom: 20,
    backgroundColor: Colors.primary[50] + "30",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  pendingNote: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  itemContainer: {
    marginBottom: 16,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.primary[50], // subtle background
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary[500],
    marginLeft: 6,
  },

  // Tracking Section
  trackingCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  trackingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trackingLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  trackingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary[500],
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },

  // Ship Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  shipFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  carrierChipsScroll: {
    maxHeight: 44,
  },
  carrierChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  carrierChipActive: {
    backgroundColor: Colors.primary[500],
  },
  carrierChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  carrierChipTextActive: {
    color: "#FFF",
  },
  trackingInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  confirmShipBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  confirmShipBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  confirmShipBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  cancelShipBtn: {
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  cancelShipBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  reviewedBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.success[700],
    marginLeft: 6,
  },
  buyLabelBtn: {
    backgroundColor: Colors.primary[600],
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buyLabelBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  labelSuccessBox: {
    backgroundColor: "#F0FDF4",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginTop: 12,
  },
  labelSuccessText: {
    fontSize: 14,
    color: "#166534",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  viewLabelBtn: {
    backgroundColor: "#166534",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewLabelBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
});

export default OrderDetailsScreen;
