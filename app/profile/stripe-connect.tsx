import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ChevronLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from "react-native-heroicons/outline";
import { Colors } from "../../constants/color";
import { useAuth } from "../../contexts/AuthContext";
import {
  createStripeConnectOnboardingLink,
  emptyStripeConnectStatus,
  fetchStripeConnectStatus,
  type StripeConnectStatus,
} from "../../lib/services/stripeConnectService";

const humaniseRequirement = (raw: string): string =>
  raw
    .replace(/^.*\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

export default function StripeConnectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ return?: string; refresh?: string }>();

  const [status, setStatus] = useState<StripeConnectStatus>(
    emptyStripeConnectStatus(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadStatus = useCallback(
    async (showSpinner = true) => {
      if (!user) return;
      if (showSpinner) setLoading(true);
      try {
        const next = await fetchStripeConnectStatus();
        setStatus(next);
      } catch (error) {
        console.error("stripe-connect status error:", error);
        Alert.alert(
          "Couldn't load payout status",
          error instanceof Error ? error.message : "Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void loadStatus(true);
    }, [loadStatus]),
  );

  const handleStartOnboarding = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { onboardingUrl } = await createStripeConnectOnboardingLink();
      const canOpen = await Linking.canOpenURL(onboardingUrl);
      if (!canOpen) throw new Error("Unable to open the onboarding page.");
      await Linking.openURL(onboardingUrl);
    } catch (error) {
      Alert.alert(
        "Couldn't start onboarding",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setStarting(false);
    }
  }, [starting]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadStatus(false);
  };

  const isReturning = params.return === "1";
  const allRequirements = [
    ...status.requirementsPastDue,
    ...status.requirementsCurrentlyDue.filter(
      (item) => !status.requirementsPastDue.includes(item),
    ),
  ];

  const renderBadge = () => {
    if (status.onboarded) {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <CheckCircleIcon size={16} color={Colors.success[700]} />
          <Text style={[styles.badgeText, { color: Colors.success[700] }]}>
            Payouts active
          </Text>
        </View>
      );
    }
    if (status.accountId) {
      return (
        <View style={[styles.badge, styles.badgeWarning]}>
          <ExclamationTriangleIcon size={16} color={Colors.warning[700]} />
          <Text style={[styles.badgeText, { color: Colors.warning[700] }]}>
            Action needed
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeNeutral]}>
        <LockClosedIcon size={16} color={Colors.neutral[700]} />
        <Text style={[styles.badgeText, { color: Colors.neutral[700] }]}>
          Not set up
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeftIcon size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payouts</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadStatus(true)}
          disabled={loading}
        >
          <ArrowPathIcon size={22} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <BanknotesIcon size={28} color={Colors.primary[700]} />
          </View>
          <Text style={styles.heroTitle}>Get paid with Stripe</Text>
          <Text style={styles.heroSubtitle}>
            Culturer uses Stripe to hold buyer payments securely and release
            them to your bank after delivery. You only need to onboard once.
          </Text>
          <View style={styles.badgeRow}>{renderBadge()}</View>
        </View>

        {isReturning && !status.onboarded ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Thanks for returning! Tap "Refresh status" if it still says action
              needed — Stripe can take a moment to confirm your details.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary[700]} />
          </View>
        ) : status.onboarded ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>You're all set</Text>
            <Text style={styles.cardBody}>
              Payouts will be sent to your connected bank account after each
              buyer confirms delivery (or automatically after 2 days). You can
              update your details anytime from Stripe.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.secondaryOutlineButton]}
              onPress={handleStartOnboarding}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color={Colors.primary[700]} />
              ) : (
                <>
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: Colors.primary[700] },
                    ]}
                  >
                    Manage Stripe account
                  </Text>
                  <ArrowTopRightOnSquareIcon
                    size={16}
                    color={Colors.primary[700]}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {status.accountId ? "Finish setting up payouts" : "Start payouts"}
            </Text>
            <Text style={styles.cardBody}>
              Stripe will ask for a few details (legal name, date of birth,
              bank account) — it takes about 3 minutes. You can't receive
              payouts until this is complete.
            </Text>
            {allRequirements.length ? (
              <View style={styles.requirementsBlock}>
                <Text style={styles.requirementsHeading}>
                  Outstanding items
                </Text>
                {allRequirements.slice(0, 6).map((item) => (
                  <Text key={item} style={styles.requirementItem}>
                    • {humaniseRequirement(item)}
                  </Text>
                ))}
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartOnboarding}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color={Colors.text.primary} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {status.accountId
                      ? "Continue onboarding"
                      : "Set up payouts"}
                  </Text>
                  <ArrowTopRightOnSquareIcon
                    size={16}
                    color={Colors.text.primary}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoHeading}>How the money moves</Text>
          <Text style={styles.infoText}>
            1. Buyer pays at checkout — funds are authorised on their card.
          </Text>
          <Text style={styles.infoText}>
            2. You ship the item via Furgonetka.
          </Text>
          <Text style={styles.infoText}>
            3. On delivery confirmation (or after 2 days), Stripe captures the
            payment and transfers it to your bank, minus Culturer's 5%
            marketplace fee.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  hero: {
    alignItems: "center",
    paddingVertical: 24,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary[100],
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  badgeRow: {
    marginTop: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeSuccess: { backgroundColor: Colors.success[100] },
  badgeWarning: { backgroundColor: Colors.warning[100] },
  badgeNeutral: { backgroundColor: Colors.neutral[100] },
  badgeText: { fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  requirementsBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    gap: 4,
  },
  requirementsHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: 6,
  },
  requirementItem: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  primaryButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  secondaryOutlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.primary[400],
  },
  infoCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    gap: 6,
  },
  infoHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
