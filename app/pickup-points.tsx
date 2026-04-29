import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
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
  Alert,
  useWindowDimensions,
  InputAccessoryView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  MapPinIcon,
} from "react-native-heroicons/outline";
import * as Location from "expo-location";
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
import type { PickupResultsMapHandle } from "../components/pickup/PickupResultsMap.types";

// Metro splits web vs native; `tsc` does not resolve `.web` / `.native` filenames.
/* eslint-disable import/no-commonjs, @typescript-eslint/no-require-imports */
const PickupResultsMap =
  Platform.OS === "web"
    ? require("../components/pickup/PickupResultsMap.web").default
    : require("../components/pickup/PickupResultsMap.native").default;
/* eslint-enable import/no-commonjs, @typescript-eslint/no-require-imports */

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_INPUT_ACCESSORY_ID = "pickupPointsSearchAccessory";

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

/** Build a Nominatim query from checkout shipping fields — more specific than a bare street fragment. */
const buildDeliveryGeocodeQuery = (fb: {
  query: string;
  city: string;
  postalCode: string;
  country: string;
}): string | null => {
  const line = fb.query.trim();
  const city = fb.city.trim();
  const pc = fb.postalCode.trim();
  const country = fb.country.trim() || "Poland";
  if (line && city) {
    const mid = pc ? `${pc} ${city}` : city;
    return `${line}, ${mid}, ${country}`;
  }
  if (city && pc) return `${pc} ${city}, ${country}`;
  if (line && pc) return `${line}, ${pc}, ${country}`;
  return null;
};

const canGeocodeDelivery = (fb: {
  query: string;
  city: string;
  postalCode: string;
}): boolean => {
  const line = fb.query.trim();
  const city = fb.city.trim();
  const pc = fb.postalCode.trim();
  return !!(line && city) || !!(city && pc) || !!(line && pc);
};

const ESTIMATED_ROW_OFFSET = 124;

export default function PickupPointsScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.min(
    268,
    Math.max(200, Math.round(windowHeight * 0.32)),
  );

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
  const [locating, setLocating] = useState(false);

  const requestIdRef = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<PickupPointResult>>(null);
  const mapRef = useRef<PickupResultsMapHandle>(null);

  const mapPoints = useMemo(
    () =>
      results.filter(
        (p) =>
          typeof p.latitude === "number" &&
          typeof p.longitude === "number" &&
          !Number.isNaN(p.latitude) &&
          !Number.isNaN(p.longitude),
      ),
    [results],
  );

  const getEmptyResultsMessage = useCallback(
    (autoLoaded: boolean) =>
      autoLoaded
        ? `No ${carrierName} lockers found near your delivery address. Try searching by city or postcode.`
        : "No pickup points found. Try a different search.",
    [carrierName],
  );

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
    const hasGpsContext = searchContext?.latitude != null;
    const isTyping = search.trim().length >= MIN_SEARCH_LENGTH;
    const shouldFetch = isTyping || hasFallback || hasGpsContext;

    if (!shouldFetch) {
      setResults([]);
      setHasSearched(false);
      setIsNearbyLoad(false);
      setLoading(false);
      return;
    }

    const isAutoLoad = !isTyping && (hasFallback || hasGpsContext);
    const delay = isTyping ? SEARCH_DEBOUNCE_MS : 0;

    setLoading(true);
    setIsNearbyLoad(isAutoLoad);

    const timer = setTimeout(async () => {
      try {
        setError(null);

        // Reference point for distance + InPost relative_point:
        // 1) Explicit GPS from "Use my location"
        // 2) Geocode full checkout delivery address (NOT the locker search box) —
        //    typing "lukowa" alone resolves to the village Łukowa, which wrongly
        //    makes Warszawa Łukowa 1 look hundreds of km away.
        // 3) Fall back to geocoding search / city / postcode only when no delivery hint.
        let coords =
          searchContext?.latitude != null && searchContext?.longitude != null
            ? { lat: searchContext.latitude, lng: searchContext.longitude }
            : null;

        // When the user is typing their own search, do NOT anchor on the
        // checkout delivery address first — that made nonsense queries still
        // show points near Warsaw. Auto-load (empty search) still uses delivery.
        if (!isTyping) {
          if (!coords && canGeocodeDelivery(fallbackAddress)) {
            const deliveryQ = buildDeliveryGeocodeQuery(fallbackAddress);
            if (deliveryQ) coords = await geocodeQuery(deliveryQ);
          }
        }

        if (!coords) {
          const queryToGeocode = isTyping
            ? search.trim()
            : search.trim() ||
              fallbackAddress.postalCode ||
              fallbackAddress.city;
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
  }, [
    carrierName,
    fallbackAddress,
    getEmptyResultsMessage,
    search,
    searchContext,
  ]);

  const handleNearMe = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Needed",
          "Enable location access in your device Settings to find pickup points nearest to you.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;

      let areaLabel: string | null = null;
      let cityForContext: string | undefined;
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Culturer/1.0" },
        });
        const data = await res.json();
        const addr = data?.address as Record<string, string> | undefined;
        cityForContext = (addr?.city ||
          addr?.town ||
          addr?.village ||
          addr?.municipality) as string | undefined;

        const road = [addr?.road || addr?.pedestrian, addr?.house_number]
          .filter(Boolean)
          .join(" ")
          .trim();
        const district =
          addr?.suburb ||
          addr?.neighbourhood ||
          addr?.quarter ||
          addr?.city_district;
        const pc = addr?.postcode?.trim();

        if (road && district && cityForContext) {
          areaLabel = `${road} · ${district}`;
        } else if (road && cityForContext) {
          areaLabel = pc
            ? `${road}, ${pc} ${cityForContext}`
            : `${road}, ${cityForContext}`;
        } else if (district && cityForContext) {
          areaLabel = `${district}, ${cityForContext}`;
        } else if (typeof data?.display_name === "string") {
          const parts = data.display_name
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          areaLabel = parts.slice(0, 3).join(" · ");
        } else if (cityForContext) {
          areaLabel = pc ? `${pc} · ${cityForContext}` : cityForContext;
        } else if (pc) {
          areaLabel = pc;
        }
        if (areaLabel && areaLabel.length > 64)
          areaLabel = `${areaLabel.slice(0, 61)}…`;
      } catch {
        areaLabel = null;
      }

      const resolvedLabel = areaLabel || "your current location";

      setSearch("");
      setSearchContext({
        latitude,
        longitude,
        city: cityForContext,
        areaLabel: resolvedLabel,
      });
      setError(null);
    } catch {
      Alert.alert(
        "Location Error",
        "Could not get your current location. Please search by city or postcode instead.",
      );
    } finally {
      setLocating(false);
    }
  };

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
    setHasSearched(false);
    setResults([]);
    setError(null);
    // Delay focus slightly so the TextInput is mounted when GPS label clears
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const formatDistance = (km?: number) => {
    if (km == null) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const scrollListToItem = useCallback(
    (item: PickupPointResult) => {
      const index = results.findIndex((p) => p.id === item.id);
      if (index < 0) return;
      listRef.current?.scrollToOffset({
        offset: Math.max(0, index * ESTIMATED_ROW_OFFSET - 56),
        animated: true,
      });
    },
    [results],
  );

  const onMarkerSelect = useCallback(
    (item: PickupPointResult) => {
      Keyboard.dismiss();
      setSelectedPickupPoint(item);
      scrollListToItem(item);
    },
    [scrollListToItem],
  );

  /** One line for list header / chrome when results are “near” an auto anchor. */
  const locationHeaderLine = useMemo(() => {
    if (searchContext?.latitude != null) {
      return (
        searchContext.areaLabel || searchContext.city || "your current position"
      );
    }
    const fa = fallbackAddress;
    const pcCity = [fa.postalCode, fa.city].filter(Boolean).join(" ").trim();
    if (pcCity) return pcCity;
    if (fa.query && fa.city) return `${fa.query}, ${fa.city}`.slice(0, 64);
    return fa.city || fa.postalCode || null;
  }, [searchContext, fallbackAddress]);

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

  // ─── Result row (list + map selection stay in sync) ─────────────────────
  const renderItem = ({ item }: { item: PickupPointResult }) => {
    const isSelected = selectedPickupPoint?.id === item.id;
    const distance = formatDistance(item.distanceKm);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          Keyboard.dismiss();
          setSelectedPickupPoint(item);
          if (
            typeof item.latitude === "number" &&
            typeof item.longitude === "number"
          ) {
            mapRef.current?.focusOn(item.latitude, item.longitude);
          }
        }}
        activeOpacity={0.72}
      >
        <View
          style={[styles.cardAccent, isSelected && styles.cardAccentSelected]}
        />
        <View style={styles.cardInner}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleBlock}>
              <Text
                style={[styles.pointId, isSelected && styles.pointIdSelected]}
                numberOfLines={1}
              >
                {item.id}
              </Text>
              <Text
                style={[
                  styles.pointAddress,
                  isSelected && styles.pointAddressSelected,
                ]}
                numberOfLines={2}
              >
                {item.address}
              </Text>
            </View>
            {distance ? (
              <View
                style={[
                  styles.distancePill,
                  isSelected && styles.distancePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.distancePillText,
                    isSelected && styles.distancePillTextSelected,
                  ]}
                >
                  {distance}
                </Text>
              </View>
            ) : null}
          </View>
          {!!item.hint && item.hint !== item.id && (
            <Text
              style={[styles.pointMeta, isSelected && styles.pointMetaSelected]}
              numberOfLines={2}
            >
              {item.hint}
            </Text>
          )}
        </View>
        {isSelected ? (
          <CheckCircleIcon size={22} color={Colors.primary[500]} />
        ) : (
          <View style={styles.cardChevronSpacer} />
        )}
      </TouchableOpacity>
    );
  };

  // ─── List header ─────────────────────────────────────────────────────────
  const renderListHeader = () => {
    if (!hasSearched || loading || results.length === 0) return null;

    const title =
      isNearbyLoad && locationHeaderLine
        ? `Near ${locationHeaderLine}`
        : `${results.length} location${results.length !== 1 ? "s" : ""}`;

    return (
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderKicker}>Pickup points</Text>
        <Text style={styles.listHeaderTitle}>{title}</Text>
        {isNearbyLoad ? (
          <Text style={styles.listHeaderSub}>
            Refine the search above to move to another area.
          </Text>
        ) : Platform.OS !== "web" && mapPoints.length > 0 ? (
          <Text style={styles.listHeaderSub}>
            Tap a map pin or a row — both stay in sync.
          </Text>
        ) : (
          <Text style={styles.listHeaderSub}>
            Choose the location that works best for you.
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={SEARCH_INPUT_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardAccessoryBtn}
              hitSlop={12}
            >
              <Text style={styles.keyboardAccessoryDone}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeftIcon size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Pickup Point</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Search Bar ── */}
      <View
        style={[
          styles.searchContainer,
          searchContext?.latitude != null && styles.searchContainerGps,
        ]}
      >
        <MagnifyingGlassIcon
          size={18}
          color={
            searchContext?.latitude != null
              ? Colors.primary[500]
              : Colors.neutral[400]
          }
          style={styles.searchIcon}
        />
        {/* When GPS is active, show city label as non-editable chip */}
        {searchContext?.latitude != null && !search ? (
          <Text style={styles.gpsLabel} numberOfLines={2}>
            📍 {searchContext.areaLabel || searchContext.city || "Near me"}
          </Text>
        ) : (
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
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
            inputAccessoryViewID={
              Platform.OS === "ios" ? SEARCH_INPUT_ACCESSORY_ID : undefined
            }
            clearButtonMode="never"
          />
        )}
        {(search.length > 0 || searchContext?.latitude != null) && (
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <XMarkIcon size={16} color={Colors.neutral[400]} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Near Me Button ── */}
      <TouchableOpacity
        style={styles.nearMeBtn}
        onPress={handleNearMe}
        disabled={locating}
        activeOpacity={0.75}
      >
        {locating ? (
          <ActivityIndicator
            size="small"
            color={Colors.primary[500]}
            style={{ marginRight: 6 }}
          />
        ) : (
          <MapPinIcon
            size={15}
            color={Colors.primary[500]}
            style={{ marginRight: 5 }}
          />
        )}
        <Text style={styles.nearMeBtnText}>
          {locating ? "Getting location…" : "Use my location"}
        </Text>
      </TouchableOpacity>

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

      {/* ── Results: map + list ─────────────────────────────────────────── */}
      <View style={styles.mainColumn}>
        {hasSearched &&
          !loading &&
          results.length > 0 &&
          Platform.OS !== "web" &&
          mapPoints.length > 0 && (
            <View style={styles.mapSection}>
              <Text style={styles.mapSectionKicker}>Map</Text>
              <Text style={styles.mapSectionSubtitle}>
                Tap a pin to select. The list scrolls to the same location.
              </Text>
              <PickupResultsMap
                ref={mapRef}
                height={mapHeight}
                results={results}
                selectedPickupPoint={selectedPickupPoint}
                onMarkerSelect={onMarkerSelect}
              />
            </View>
          )}

        {hasSearched &&
          !loading &&
          results.length > 0 &&
          Platform.OS === "web" &&
          mapPoints.length > 0 && (
            <View style={styles.webMapBanner}>
              <MapPinIcon size={16} color={Colors.primary[600]} />
              <Text style={styles.webMapBannerText}>
                Interactive map is available on iOS and Android. Use the list
                below to choose a point.
              </Text>
            </View>
          )}

        {hasSearched &&
          !loading &&
          results.length > 0 &&
          Platform.OS !== "web" &&
          mapPoints.length === 0 && (
            <View style={styles.noCoordsBanner}>
              <Text style={styles.noCoordsBannerText}>
                Map preview isn’t available for these results. Choose a location
                from the list.
              </Text>
            </View>
          )}

        <FlatList
          ref={listRef}
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          style={styles.resultList}
          contentContainerStyle={[
            styles.listContent,
            results.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

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
  keyboardAccessory: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ECEFF1",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.neutral[300],
  },
  keyboardAccessoryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  keyboardAccessoryDone: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary[600],
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
    alignItems: "flex-start",
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
  searchContainerGps: {
    borderColor: Colors.primary[300] || Colors.primary[200],
    backgroundColor: Colors.primary[50] || "#FFF5F0",
  },
  gpsLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary[600] || Colors.primary[500],
    fontWeight: "500",
    padding: 0,
    lineHeight: 20,
  },
  searchIcon: {
    marginRight: 8,
    marginTop: Platform.OS === "ios" ? 3 : 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    padding: 0,
    minHeight: 22,
    paddingTop: Platform.OS === "ios" ? 1 : 4,
  },
  clearBtn: {
    marginLeft: 6,
    marginTop: Platform.OS === "ios" ? 2 : 4,
    padding: 2,
  },
  nearMeBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.primary[50] || "#FFF5F0",
    borderWidth: 1,
    borderColor: Colors.primary[200] || Colors.primary[100],
  },
  nearMeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary[600] || Colors.primary[500],
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

  // ── Main column (map + scrollable list) ─────────────────────────────────
  mainColumn: {
    flex: 1,
    minHeight: 0,
  },
  mapSection: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  mapSectionKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mapSectionSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  webMapBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  webMapBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  noCoordsBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  noCoordsBannerText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  resultList: {
    flex: 1,
  },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },

  // ── List header ──────────────────────────────────────────────────────────
  listHeader: {
    paddingTop: 2,
    paddingBottom: 14,
  },
  listHeaderKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.75,
    marginBottom: 4,
  },
  listHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  listHeaderSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    lineHeight: 18,
  },

  // ── Result row ──────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: Colors.primary[300],
    backgroundColor: Colors.primary[50],
    shadowColor: Colors.primary[500],
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 14,
    backgroundColor: Colors.neutral[100],
  },
  cardAccentSelected: {
    backgroundColor: Colors.primary[500],
  },
  cardInner: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  pointId: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  pointIdSelected: {
    color: Colors.primary[800],
  },
  pointAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginTop: 6,
  },
  pointAddressSelected: {
    color: Colors.text.primary,
  },
  distancePill: {
    marginTop: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  distancePillSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: Colors.primary[200],
  },
  distancePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.text.secondary,
  },
  distancePillTextSelected: {
    color: Colors.primary[700],
  },
  pointMeta: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 8,
    lineHeight: 16,
  },
  pointMetaSelected: {
    color: Colors.neutral[600],
  },
  cardChevronSpacer: {
    width: 22,
    height: 22,
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
