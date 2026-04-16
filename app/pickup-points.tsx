import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
} from "react-native-heroicons/outline";
import { CheckCircleIcon } from "react-native-heroicons/solid";
import { Colors } from "../constants/color";
import {
  fetchPickupPoints,
  type PickupPointResult,
  type PickupPointSearchContext,
} from "../lib/services/pickupPointService";
import {
  getPickupPointSelectionState,
  setPickupPointSelectionState,
} from "../lib/pickupPointSelectionStore";

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;

// Free geocoding via OpenStreetMap Nominatim — no API key required
const geocodeQuery = async (
  query: string,
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=pl&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Culturer/1.0" } });
    const data = await res.json();
    if (data?.[0])
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
  return null;
};

export default function PickupPointsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    carrierName?: string;
    address1?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  }>();

  const carrierName = params.carrierName || "";
  const fallbackAddress = useMemo(
    () => ({
      query: typeof params.address1 === "string" ? params.address1 : "",
      city: typeof params.city === "string" ? params.city : "",
      postalCode: typeof params.zipCode === "string" ? params.zipCode : "",
      country: typeof params.country === "string" ? params.country : "",
    }),
    [params.address1, params.city, params.zipCode, params.country],
  );

  const seededState = getPickupPointSelectionState();
  const [search, setSearch] = useState(
    seededState.carrierName === carrierName ? seededState.search : "",
  );
  const [searchContext, setSearchContext] =
    useState<PickupPointSearchContext | null>(
      seededState.carrierName === carrierName ? seededState.context : null,
    );
  const [selectedPickupPoint, setSelectedPickupPoint] =
    useState<PickupPointResult | null>(
      seededState.carrierName === carrierName ? seededState.selection : null,
    );
  const [results, setResults] = useState<PickupPointResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isNearbyLoad, setIsNearbyLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const searchInputRef = useRef<TextInput>(null);

  const getEmptyResultsMessage = (autoLoaded: boolean) =>
    autoLoaded
      ? `No ${carrierName} lockers found near your delivery address. Try searching by city or postcode.`
      : "No pickup points found. Try a different search.";

  // Auto-focus search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Fetch pickup points when search or context changes
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const hasFallback = !!(fallbackAddress.city || fallbackAddress.postalCode);
    const isTyping = search.trim().length >= MIN_SEARCH_LENGTH;
    const shouldFetch = isTyping || hasFallback;

    if (!shouldFetch) {
      setResults([]);
      setHasSearched(false);
      setIsNearbyLoad(false);
      setLoading(false);
      return;
    }

    const isAutoLoad = !isTyping && hasFallback;
    const delay = isTyping ? SEARCH_DEBOUNCE_MS : 0;

    setLoading(true);
    setIsNearbyLoad(isAutoLoad);

    const timer = setTimeout(async () => {
      try {
        setError(null);

        // Geocode for distance calculation — works for both typed search and auto-load
        let coords =
          searchContext?.latitude != null
            ? { lat: searchContext.latitude, lng: searchContext.longitude! }
            : null;
        if (!coords) {
          const queryToGeocode =
            search.trim() || fallbackAddress.postalCode || fallbackAddress.city;
          if (queryToGeocode) {
            coords = await geocodeQuery(queryToGeocode);
          }
        }

        const pickupPoints = await fetchPickupPoints(
          carrierName,
          {
            query: search,
            city: searchContext?.city,
            postalCode: searchContext?.postalCode,
            country: searchContext?.country,
            latitude: coords?.lat,
            longitude: coords?.lng,
          },
          // Don't use fallback address when user is actively typing their own query
          isTyping ? undefined : fallbackAddress,
        );

        if (requestId !== requestIdRef.current) return;

        setResults(pickupPoints);
        setHasSearched(true);
        setError(
          pickupPoints.length === 0 ? getEmptyResultsMessage(isAutoLoad) : null,
        );
        setSelectedPickupPoint((current) =>
          current && !pickupPoints.some((p) => p.id === current.id)
            ? null
            : current,
        );
      } catch {
        if (requestId === requestIdRef.current) {
          setResults([]);
          setError("Could not load pickup points right now. Please try again.");
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [carrierName, fallbackAddress, search, searchContext]);

  const handleConfirm = () => {
    if (!selectedPickupPoint) return;
    setPickupPointSelectionState({
      carrierName,
      selection: selectedPickupPoint,
      search,
      context: searchContext,
    });
    router.back();
  };

  const handleClearSearch = () => {
    setSearch("");
    setSearchContext(null);
    setError(null);
    searchInputRef.current?.focus();
  };

  const formatDistance = (km?: number) => {
    if (km == null) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const contextCity =
    searchContext?.city || fallbackAddress.city || fallbackAddress.postalCode;

  // ─── Empty / Intro State ──────────────────────────────────────────────────
  const renderEmptyState = () => {
    if (loading) return null;

    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MapPinIcon size={40} color={Colors.primary[400]} />
          </View>
          <Text style={styles.emptyTitle}>Find a Pickup Point</Text>
          <Text style={styles.emptySubtitle}>
            Type a city, postcode, or street above to search for{" "}
            {carrierName || "nearby"} pickup lockers.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No lockers found</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      );
    }

    return null;
  };

  // ─── Result Card ─────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: PickupPointResult }) => {
    const isSelected = selectedPickupPoint?.id === item.id;
    const distance = formatDistance(item.distanceKm);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          Keyboard.dismiss();
          setSelectedPickupPoint(item);
        }}
        activeOpacity={0.75}
      >
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.lockerBadge,
              isSelected && styles.lockerBadgeSelected,
            ]}
          >
            <Text
              style={[
                styles.lockerBadgeText,
              ]}
            >
              📦
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text
              style={[styles.lockerId, isSelected && styles.lockerIdSelected]}
            >
              {item.id}
            </Text>
            {distance && (
              <View
                style={[
                  styles.distanceBadge,
                  isSelected && styles.distanceBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.distanceText,
                    isSelected && styles.distanceTextSelected,
                  ]}
                >
                  {distance}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.lockerAddress,
              isSelected && styles.lockerAddressSelected,
            ]}
          >
            {item.address}
          </Text>
          {!!item.hint && item.hint !== item.id && (
            <Text
              style={[
                styles.lockerHint,
                isSelected && styles.lockerHintSelected,
              ]}
            >
              {item.hint}
            </Text>
          )}
        </View>

        {isSelected && (
          <View style={styles.cardCheck}>
            <CheckCircleIcon size={24} color={Colors.primary[500]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── List Header ─────────────────────────────────────────────────────────
  const renderListHeader = () => {
    if (!hasSearched || loading || results.length === 0) return null;

    const label =
      isNearbyLoad && contextCity
        ? `📍 Nearest to ${contextCity}`
        : `${results.length} result${results.length !== 1 ? "s" : ""} found`;

    return (
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>{label}</Text>
        {isNearbyLoad && (
          <Text style={styles.listHeaderSub}>
            Search above to find lockers in a different area
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeftIcon size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Pickup Point</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <MagnifyingGlassIcon
          size={18}
          color={Colors.neutral[400]}
          style={styles.searchIcon}
        />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="City, postcode, or street…"
          placeholderTextColor={Colors.neutral[400]}
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            setSearchContext(null);
            setError(null);
          }}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <XMarkIcon size={16} color={Colors.neutral[400]} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Loading Bar ── */}
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>
            {isNearbyLoad
              ? `Finding ${carrierName} lockers nearby…`
              : "Searching…"}
          </Text>
        </View>
      )}

      {/* ── Results / Empty State ── */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          results.length === 0 && styles.listContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {selectedPickupPoint ? (
          <View style={styles.selectedSummary}>
            <View style={styles.selectedSummaryText}>
              <Text style={styles.selectedLabel}>Selected</Text>
              <Text style={styles.selectedId} numberOfLines={1}>
                {selectedPickupPoint.id} · {selectedPickupPoint.address}
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            !selectedPickupPoint && styles.confirmBtnDisabled,
          ]}
          disabled={!selectedPickupPoint}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.confirmBtnText,
              !selectedPickupPoint && styles.confirmBtnTextDisabled,
            ]}
          >
            {selectedPickupPoint
              ? "Confirm This Pickup Point"
              : "Select a Pickup Point"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 36,
  },

  // ── Search ───────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 11 : 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    padding: 0,
  },
  clearBtn: {
    marginLeft: 6,
    padding: 2,
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 8,
  },

  // ── List Header ──────────────────────────────────────────────────────────
  listHeader: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listHeaderSub: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },

  // ── Result Card ──────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    borderColor: Colors.primary[400],
    backgroundColor: Colors.primary[50] || "#EFF6FF",
    shadowColor: Colors.primary[500],
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardLeft: {
    marginRight: 12,
    paddingTop: 1,
  },
  lockerBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  lockerBadgeSelected: {
    backgroundColor: Colors.primary[100] || "#DBEAFE",
  },
  lockerBadgeText: {
    fontSize: 18,
  },
  cardBody: {
    flex: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  lockerId: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: 0.3,
    flex: 1,
    marginRight: 8,
  },
  lockerIdSelected: {
    color: Colors.primary[700] || Colors.primary[500],
  },
  distanceBadge: {
    backgroundColor: Colors.neutral[100],
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceBadgeSelected: {
    backgroundColor: Colors.primary[100] || "#DBEAFE",
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  distanceTextSelected: {
    color: Colors.primary[600] || Colors.primary[500],
  },
  lockerAddress: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  lockerAddressSelected: {
    color: Colors.primary[700] || Colors.text.secondary,
  },
  lockerHint: {
    fontSize: 12,
    color: Colors.neutral[400],
    fontStyle: "italic",
    marginTop: 3,
    lineHeight: 16,
  },
  lockerHintSelected: {
    color: Colors.primary[500],
  },
  cardCheck: {
    marginLeft: 10,
    alignSelf: "center",
  },

  // ── Empty State ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary[50] || "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary[50] || "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primary[200] || Colors.primary[100],
  },
  selectedSummaryText: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  selectedId: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  confirmBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.neutral[200],
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  confirmBtnTextDisabled: {
    color: Colors.neutral[400],
  },
});
