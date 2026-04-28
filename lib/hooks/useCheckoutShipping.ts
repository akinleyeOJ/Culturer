// Checkout shipping hook (Furgonetka-only).
// ------------------------------------------
// Strategy: one Edge Function call (`furgonetka-rates`) returns every
// available carrier+price for the route, so this hook collapses what used
// to be a multi-provider orchestration into a single fetch.
//
// To avoid touching every consumer, the return shape is kept compatible
// with the legacy hook: `integratedCarrierOptions` is a `CarrierConfig[]`
// where each entry already carries its quote (`quote_amount`, `quote_id`,
// `quote_status`, `quote_currency`).
//
// Carriers that require a service point (lockers / parcel-shops) get
// `type: "locker"` and `quote_status: "requires_pickup_point"` until the
// buyer picks a point in the pickup-points screen, after which they flip
// to `"ready"`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../supabase";
import { type CartItem } from "../services/cartService";
import {
  fetchFurgonetkaRates,
  type FurgonetkaRate,
} from "../services/furgonetkaService";
import { type PickupPointResult } from "../services/pickupPointService";
import { type PickupPointSearchContext } from "../services/pickupPointService";
import {
  buildLocalPickupOption,
  DEFAULT_SHIPPING_CONFIG,
  detectShippingZone,
  FURGONETKA_CARRIER_CATALOG,
  getEffectiveFurgonetkaCarriers,
  SHIPPING_LAUNCH_COUNTRY,
  WEIGHT_TIER_GRAMS,
  type CarrierConfig,
  type SellerShippingConfig,
  type ShippingZone,
  type WeightTier,
} from "../shippingUtils";
import {
  clearPickupPointSelectionState,
  getPickupPointSelectionState,
} from "../pickupPointSelectionStore";

interface UseCheckoutShippingParams {
  cartItems: CartItem[];
  email: string;
  country: string;
  city: string;
  zipCode: string;
  address1: string;
  address2: string;
  firstName: string;
  lastName: string;
  phone: string;
  step: 1 | 2 | 3;
  /** Kept for parity with the old hook; Furgonetka rates are always live. */
  liveShippingApisEnabled: boolean;
}

type QuoteStatus =
  | "ready"
  | "loading"
  | "requires_pickup_point"
  | "missing_address"
  | "unavailable";

const WEIGHT_TIER_DIMENSIONS: Record<
  WeightTier,
  { width: number; depth: number; height: number }
> = {
  mini: { width: 15, depth: 10, height: 5 },
  small: { width: 20, depth: 15, height: 8 },
  medium: { width: 30, depth: 20, height: 15 },
  large: { width: 40, depth: 30, height: 25 },
};

const PL_POSTCODE_RE = /^\d{2}-\d{3}$/;

/** Same bar as checkout step-1: need these before we hit Furgonetka for quotes. */
const isBuyerAddressCompleteForQuotes = (p: {
  country: string;
  zipCode: string;
  city: string;
  address1: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}) =>
  p.country === SHIPPING_LAUNCH_COUNTRY &&
  PL_POSTCODE_RE.test(p.zipCode.trim()) &&
  p.city.trim().length >= 2 &&
  p.address1.trim().length >= 3 &&
  p.firstName.trim().length >= 1 &&
  p.lastName.trim().length >= 1 &&
  p.phone.replace(/\D/g, "").length >= 9 &&
  p.email.trim().includes("@") &&
  p.email.trim().length > 3;

const rateToCarrierConfig = (
  rate: FurgonetkaRate,
  status: QuoteStatus,
): CarrierConfig => ({
  name: rate.display_name,
  type: rate.requires_service_point ? "locker" : "home",
  mode: rate.requires_service_point ? "locker_pickup" : "home_delivery",
  enabled: true,
  price_small: rate.price_pln_adjusted,
  price_medium: rate.price_pln_adjusted,
  price_large: rate.price_pln_adjusted,
  is_custom: false,
  quote_amount: rate.price_pln_adjusted,
  quote_currency: "PLN",
  quote_id: rate.quote_id,
  quote_status: status,
});

export const useCheckoutShipping = ({
  cartItems,
  email,
  country,
  city,
  zipCode,
  address1,
  address2: _address2,
  firstName,
  lastName,
  phone,
  step,
  liveShippingApisEnabled,
}: UseCheckoutShippingParams) => {
  const [sellerShipping, setSellerShipping] =
    useState<SellerShippingConfig | null>(null);
  const [shippingZone, setShippingZone] = useState<ShippingZone>("domestic");
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierConfig | null>(
    null,
  );
  const [totalWeightGrams, setTotalWeightGrams] = useState(0);
  const [cartWeightTier, setCartWeightTier] = useState<WeightTier>("medium");
  const [selectedLocker, setSelectedLocker] =
    useState<PickupPointResult | null>(null);
  const [lockerSearch, setLockerSearch] = useState("");
  const [lockerSearchContext, setLockerSearchContext] =
    useState<PickupPointSearchContext | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rates, setRates] = useState<FurgonetkaRate[]>([]);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const isPolandDomesticRoute =
    sellerShipping?.origin_country === SHIPPING_LAUNCH_COUNTRY &&
    country === SHIPPING_LAUNCH_COUNTRY;

  const buyerReadyForQuotes = useMemo(
    () =>
      isBuyerAddressCompleteForQuotes({
        country,
        zipCode,
        city,
        address1,
        firstName,
        lastName,
        phone,
        email,
      }),
    [country, zipCode, city, address1, firstName, lastName, phone, email],
  );

  const sellerOriginPostcode = (sellerShipping?.origin_zip || "").trim();
  const sellerShipFromPostcodeInvalid =
    sellerOriginPostcode.length > 0 &&
    !PL_POSTCODE_RE.test(sellerOriginPostcode);

  const ratesBlockedReason = useMemo((): string | null => {
    if (cartItems.length === 0) return null;
    const sid = cartItems[0]?.product?.seller_id;
    if (!sid || sid === "system") {
      return "Live carrier quotes are not available for this cart.";
    }
    if (!sellerShipping) {
      return "Loading the seller's shipping settings…";
    }
    if (!isPolandDomesticRoute) {
      return "Live Furgonetka quotes are only available for delivery within Poland.";
    }
    if (sellerShipFromPostcodeInvalid) {
      return "The seller's ship-from postcode must be XX-XXX (Polish format). They can fix it in Profile → Seller Shipping.";
    }
    if (!PL_POSTCODE_RE.test(zipCode.trim())) {
      return "Enter a valid Polish delivery postcode (XX-XXX) to see carriers.";
    }
    if (!buyerReadyForQuotes) {
      return "Complete your name, email, phone, street address, and city above — then we'll fetch live carrier prices.";
    }
    return null;
  }, [
    buyerReadyForQuotes,
    cartItems,
    isPolandDomesticRoute,
    sellerShipFromPostcodeInvalid,
    sellerShipping,
    zipCode,
  ]);

  // ----- 1. Load seller shipping config (origin address) -----
  useEffect(() => {
    if (cartItems.length === 0) return;
    const sellerId = cartItems[0]?.product?.seller_id;
    if (!sellerId || sellerId === "system") return;

    let cancelled = false;
    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles" as any)
          .select("shop_shipping")
          .eq("id", sellerId)
          .single();
        if (cancelled) return;
        if (!error && (profile as any)) {
          const raw = (profile as any).shop_shipping as
            | SellerShippingConfig
            | undefined;
          if (raw && typeof raw === "object") {
            setSellerShipping(raw);
          } else {
            setSellerShipping(DEFAULT_SHIPPING_CONFIG);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching seller shipping config:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  // ----- 2. Compute zone -----
  useEffect(() => {
    if (!country || !sellerShipping) return;
    setShippingZone(detectShippingZone(sellerShipping.origin_country, country));
  }, [country, sellerShipping]);

  // ----- 3. Compute parcel weight + dimensions from cart -----
  useEffect(() => {
    if (cartItems.length === 0) return;
    let cancelled = false;

    (async () => {
      const productIds = cartItems.map((item) => item.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, weight_tier")
        .in("id", productIds);

      if (cancelled) return;

      let totalGrams = 0;
      let maxTier: WeightTier = "small";
      const tierOrder: WeightTier[] = ["mini", "small", "medium", "large"];

      cartItems.forEach((item) => {
        const product = products?.find((p: any) => p.id === item.product_id);
        const tier = (product?.weight_tier as WeightTier) || "medium";
        totalGrams += WEIGHT_TIER_GRAMS[tier] * item.quantity;
        if (tierOrder.indexOf(tier) > tierOrder.indexOf(maxTier)) {
          maxTier = tier;
        }
      });

      setTotalWeightGrams(totalGrams);
      setCartWeightTier(maxTier);
    })();

    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  // ----- 4. Fetch live Furgonetka rates -----
  useEffect(() => {
    if (!sellerShipping || !isPolandDomesticRoute || step < 1) {
      setRates([]);
      setLoadingRates(false);
      setRatesError(null);
      return;
    }

    const destPostcode = zipCode.trim();
    const originPostcode = (sellerShipping.origin_zip || "").trim();
    const hasValidDest = PL_POSTCODE_RE.test(destPostcode);
    const hasValidOrigin =
      PL_POSTCODE_RE.test(originPostcode) || originPostcode.length === 0;

    if (
      !hasValidDest ||
      !hasValidOrigin ||
      sellerShipFromPostcodeInvalid ||
      !buyerReadyForQuotes
    ) {
      setRates([]);
      setLoadingRates(false);
      setRatesError(null);
      return;
    }

    let cancelled = false;
    setLoadingRates(true);
    setRatesError(null);

    (async () => {
      const dimensions = WEIGHT_TIER_DIMENSIONS[cartWeightTier];
      const cartValuePln = cartItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.product?.price) || 0) * (Number(item.quantity) || 0),
        0,
      );

      const result = await fetchFurgonetkaRates({
        origin: {
          postcode: originPostcode || destPostcode,
          city: sellerShipping.origin_city || "",
          country_code: "PL",
        },
        destination: {
          postcode: destPostcode,
          city: city.trim() || "Warszawa",
          country_code: "PL",
        },
        parcel: {
          weight_grams: Math.max(100, totalWeightGrams || 1000),
          dimensions_cm: dimensions,
          value_pln: Math.round(cartValuePln) || 0,
        },
        // Intentionally omit `carriers` here: Furgonetka's calculate-price API
        // only returns rows for the services you ask for. If the platform
        // account doesn't have an agreement for e.g. InPost yet, asking for
        // InPost+DPD alone yields an *empty* response even though FedEx/DHL
        // would quote. We fetch everything Furgonetka returns, then filter
        // client-side to the seller's enabled list.
      });

      if (cancelled) return;

      if (!result.success) {
        setRates([]);
        setLoadingRates(false);
        setRatesError(result.error);
        return;
      }

      const allowed = new Set(
        getEffectiveFurgonetkaCarriers(sellerShipping).map((c) =>
          c.toLowerCase(),
        ),
      );
      const filtered = (result.rates || []).filter((r) =>
        allowed.has(r.carrier.toLowerCase()),
      );
      setRates(filtered);
      setLoadingRates(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    sellerShipping,
    isPolandDomesticRoute,
    zipCode,
    city,
    cartItems,
    totalWeightGrams,
    cartWeightTier,
    step,
    buyerReadyForQuotes,
    sellerShipFromPostcodeInvalid,
  ]);

  // ----- 5b. Explain missing locker / parcel-shop rows when seller enabled them -----
  const lockerRatesHint = useMemo((): string | null => {
    if (!sellerShipping || !buyerReadyForQuotes || rates.length === 0) {
      return null;
    }
    const enabled = new Set(
      getEffectiveFurgonetkaCarriers(sellerShipping).map((c) =>
        c.toLowerCase(),
      ),
    );
    const wantsLockerOrPoint = FURGONETKA_CARRIER_CATALOG.some(
      (c) =>
        enabled.has(c.code) &&
        (c.service_type === "locker_pickup" ||
          c.service_type === "pickup_point"),
    );
    if (!wantsLockerOrPoint) return null;
    if (rates.some((r) => r.requires_service_point)) return null;
    return "Lockers and parcel shops are turned on for this seller, but Furgonetka did not return prices for those services on this route. That almost always means the Culturer Furgonetka account does not have the right carrier agreements yet (common in sandbox). The home‑delivery options above are still live quotes.";
  }, [buyerReadyForQuotes, rates, sellerShipping]);

  // ----- 5. Build CarrierConfig[] for the UI from live rates -----
  const integratedCarrierOptions: CarrierConfig[] = useMemo(() => {
    if (!sellerShipping) return [];

    const live = rates.map((rate) => {
      const status: QuoteStatus =
        rate.requires_service_point && !selectedLocker?.id
          ? "requires_pickup_point"
          : "ready";
      return rateToCarrierConfig(rate, status);
    });

    const localPickup =
      isPolandDomesticRoute && sellerShipping
        ? buildLocalPickupOption(sellerShipping)
        : null;

    return [...live, ...(localPickup ? [localPickup] : [])];
  }, [rates, selectedLocker, sellerShipping, isPolandDomesticRoute]);

  // ----- 6. Reset selection if it disappears from the new options list -----
  useEffect(() => {
    if (!selectedCarrier) return;
    if (
      !integratedCarrierOptions.some(
        (carrier) => carrier.name === selectedCarrier.name,
      )
    ) {
      setSelectedCarrier(null);
      setSelectedLocker(null);
      setLockerSearch("");
      setLockerSearchContext(null);
      clearPickupPointSelectionState();
    }
  }, [integratedCarrierOptions, selectedCarrier]);

  // ----- 7. Re-hydrate locker selection when returning from picker screen -----
  useFocusEffect(
    useCallback(() => {
      const pickupState = getPickupPointSelectionState();
      if (
        pickupState.carrierName &&
        selectedCarrier?.type === "locker" &&
        pickupState.carrierName === selectedCarrier.name
      ) {
        setSelectedLocker(pickupState.selection);
        setLockerSearch(pickupState.search);
        setLockerSearchContext(pickupState.context);
      }
    }, [selectedCarrier]),
  );

  // ----- 8. Final shipping cost the cart should add to the total -----
  const shippingCost = useMemo(() => {
    if (!selectedCarrier) return 0;
    if (selectedCarrier.type === "pickup") return 0;
    const fresh = integratedCarrierOptions.find(
      (c) => c.name === selectedCarrier.name,
    );
    const amount = fresh?.quote_amount ?? selectedCarrier.quote_amount;
    return Number(amount) || 0;
  }, [integratedCarrierOptions, selectedCarrier]);

  // `liveShippingApisEnabled` is intentionally accepted but no longer toggles
  // anything — Furgonetka is always-live. Reference it once so eslint-no-unused
  // doesn't fire and consumers keep their existing prop wiring.
  void liveShippingApisEnabled;

  return {
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
    ratesError,
    ratesBlockedReason,
    buyerReadyForQuotes,
    hasLiveCarrierQuotes: rates.length > 0,
    lockerRatesHint,
  };
};
