// Typed client wrappers around the Furgonetka Edge Functions:
//   - furgonetka-rates           (live shipping rates)
//   - furgonetka-service-points  (locker / pickup-point search)
//   - furgonetka-create-shipment (label generation; phase 4)
//
// Used by:
//   - lib/hooks/useCheckoutShipping.ts        (rate fetching)
//   - app/pickup-points.tsx                   (point search)
//   - app/profile/order-details/[id].tsx      (label generation)

import { supabase } from "../supabase";

// ---------- Types ----------

export type FurgonetkaServiceType =
  | "home_delivery"
  | "locker_pickup"
  | "pickup_point";

export interface FurgonetkaRate {
  /** Lowercase Furgonetka service code (`inpost`, `dpd`, `dhl`, …). */
  carrier: string;
  /** Numeric service id from Furgonetka (used when creating the shipment). */
  service_id: number | null;
  /** Friendly UI label, already in our canonical casing. */
  display_name: string;
  service_type: FurgonetkaServiceType;
  /** VAT-inclusive PLN price as Furgonetka returned it. */
  price_pln: number;
  /** Post-discount PLN price; usually equal to `price_pln`. */
  price_pln_adjusted: number;
  /** Best-effort delivery ETA in days. `null` when Furgonetka didn't provide. */
  eta_days: number | null;
  /** True for lockers / parcelshops where the buyer must pick a point. */
  requires_service_point: boolean;
  /** Stable id we use to round-trip the chosen carrier through checkout. */
  quote_id: string;
}

export interface FurgonetkaRatesResponse {
  success: true;
  rates: FurgonetkaRate[];
  source: "furgonetka";
  debug?: unknown;
}

export interface FurgonetkaRatesError {
  success: false;
  rates: [];
  error: string;
}

export interface FurgonetkaRatesRequest {
  origin: { postcode: string; city?: string; country_code?: string };
  destination: { postcode: string; city?: string; country_code?: string };
  parcel: {
    weight_grams: number;
    dimensions_cm?: { width: number; depth: number; height: number };
    value_pln?: number;
  };
  /** Optional — only for diagnostics. Prefer omitting this and filtering
   * client-side: Furgonetka only prices the services you list here, so a
   * mismatched allowlist yields an empty response even when other carriers
   * would quote. */
  carriers?: string[];
}

export interface FurgonetkaServicePoint {
  id: string;
  carrier: string;
  carrier_display: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  country_code: string;
  lat: number | null;
  lng: number | null;
  opening_hours?: string;
  cod: boolean;
  point_type: "parcel_machine" | "service_point";
  /** Distance in km from the search centre (when coords were supplied). */
  distance_km: number | null;
  furgonetka_point: boolean;
}

export interface FurgonetkaServicePointsResponse {
  success: true;
  points: FurgonetkaServicePoint[];
  center: { lat: number; lng: number } | null;
  source: "furgonetka";
}

export interface FurgonetkaServicePointsRequest {
  carriers: string[];
  postcode?: string;
  city?: string;
  query?: string;
  lat?: number;
  lng?: number;
  point_type?: "parcel_machine" | "service_point";
  country_code?: string;
  limit?: number;
}

export interface FurgonetkaCreateShipmentResponse {
  success: true;
  shipment_id: string;
  furgonetka_shipment_id: string;
  tracking_number: string;
  tracking_url: string;
  label_url: string;
  qr_code_url?: string | null;
}

// ---------- API calls ----------

const invoke = async <T>(name: string, body: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || `Furgonetka call ${name} failed`);
  }
  return data as T;
};

/**
 * Fetch live rates for a parcel from Furgonetka. Always returns a typed
 * result — failures are converted to `{ success: false, rates: [], error }`
 * so callers can render gracefully without try/catch.
 */
export const fetchFurgonetkaRates = async (
  req: FurgonetkaRatesRequest,
): Promise<FurgonetkaRatesResponse | FurgonetkaRatesError> => {
  try {
    const data = await invoke<FurgonetkaRatesResponse>(
      "furgonetka-rates",
      req,
    );
    return {
      success: true,
      rates: Array.isArray(data.rates) ? data.rates : [],
      source: "furgonetka",
      debug: (data as { debug?: unknown }).debug,
    };
  } catch (err: any) {
    if (__DEV__) {
      console.warn(
        "[furgonetkaService] fetchFurgonetkaRates failed:",
        err?.message || err,
      );
    }
    return {
      success: false,
      rates: [],
      error: err?.message || "Failed to load shipping rates",
    };
  }
};

/**
 * Search for service points (lockers / parcel-shops) for one or more
 * carriers near a given address.
 */
export const fetchFurgonetkaServicePoints = async (
  req: FurgonetkaServicePointsRequest,
): Promise<{
  success: boolean;
  points: FurgonetkaServicePoint[];
  center: { lat: number; lng: number } | null;
  error?: string;
}> => {
  try {
    const data = await invoke<FurgonetkaServicePointsResponse>(
      "furgonetka-service-points",
      req,
    );
    return {
      success: true,
      points: Array.isArray(data.points) ? data.points : [],
      center: data.center ?? null,
    };
  } catch (err: any) {
    if (__DEV__) {
      console.warn(
        "[furgonetkaService] fetchFurgonetkaServicePoints failed:",
        err?.message || err,
      );
    }
    return {
      success: false,
      points: [],
      center: null,
      error: err?.message || "Failed to load pickup points",
    };
  }
};

/**
 * Generate a shipping label for an already-paid order. Called by the seller
 * from the order-details screen; the Edge Function picks the carrier the
 * buyer chose at checkout and re-quotes with the locker id (if any).
 */
export const createFurgonetkaShipment = async (orderId: string) => {
  try {
    const data = await invoke<FurgonetkaCreateShipmentResponse>(
      "furgonetka-create-shipment",
      { order_id: orderId },
    );
    return {
      success: true as const,
      shipment_id: data.shipment_id,
      furgonetka_shipment_id: data.furgonetka_shipment_id,
      tracking_number: data.tracking_number,
      tracking_url: data.tracking_url,
      label_url: data.label_url,
      qr_code_url: data.qr_code_url ?? null,
    };
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Failed to create shipment",
    };
  }
};

// ---------- UI helpers ----------

/** Carrier codes whose `requires_service_point` is true in our registry. */
export const CARRIERS_REQUIRING_POINT = new Set([
  "inpost",
  "dpd_pickup",
  "orlen",
  "ups_access_point",
  "ruch",
  "fedex",
]);

/** Convenience predicate. */
export const carrierRequiresServicePoint = (rate: FurgonetkaRate): boolean =>
  rate.requires_service_point;

/**
 * Translate a UI carrier display name (whatever lives on `CarrierConfig.name`)
 * into the lowercase Furgonetka service code expected by the points search.
 * Returns `null` for carriers that aren't routed through Furgonetka points
 * (e.g. local pickup, or generic "DHL" home delivery without a parcelshop).
 */
export const carrierDisplayNameToFurgonetkaCode = (
  name: string,
): string | null => {
  const n = (name || "").toLowerCase().trim();
  if (!n) return null;

  // Lockers / parcelshops — points search applies.
  if (n.includes("paczkomat") || n.includes("inpost locker")) return "inpost";
  if (n === "inpost" || n === "inpost paczkomat") return "inpost";
  if (n.includes("dpd pickup")) return "dpd_pickup";
  if (n.includes("dhl parcelshop") || n.includes("dhl pop")) return "dhl";
  if (n.includes("fedex punkt")) return "fedex";
  if (n.includes("furgonetka punkt")) return "furgonetkaPunkt";
  if (n.includes("orlen") || n.includes("ruch")) return "orlen";
  if (n.includes("ups access")) return "ups";
  if (n === "gls parcelshop" || n === "gls pickup") return "gls";
  if (n === "poczta polska point" || n === "poczta") return "poczta";
  if (n === "meest") return "meest";
  if (n.includes("allegro one")) return "allegro";
  if (n.includes("ambro")) return "ambroexpress";

  return null;
};
