// Supabase Edge Function: furgonetka-service-points
// --------------------------------------------------
// Native-first proxy for Furgonetka's pickup-point search. Used by the
// React Native carrier picker when the buyer chose a carrier whose
// `requires_service_point` is true (InPost Paczkomat, DPD Pickup,
// DHL Parcelshop, FedEx Punkt, Orlen Paczka, Poczta Polska point, GLS,
// UPS Access Point, Furgonetka Punkt, etc.).
//
// Endpoint contract (verified live against the sandbox 2026-04):
//
//   POST {FURGONETKA_API_BASE}/points/map
//   Headers:
//     Accept:        application/vnd.furgonetka.v1+json
//     Content-Type:  application/vnd.furgonetka.v1+json
//     (no Authorization required — endpoint is public)
//
//   Body:
//     {
//       providers: ["inpost", "dpd", ...],
//       location: {
//         address?:     { country_code, postcode, city, province? },
//         coordinates?: { latitude, longitude }
//       },
//       filters: {
//         services:           string[],
//         limit:              number,
//         country_codes:      string[],
//         show_other_points:  boolean,
//         point_types?:       string[],
//         type?:              "parcel_machine" | "service_point" | null
//       }
//     }
//
// Response:
//   {
//     recentlySelectedPoints: [],
//     points: [
//       {
//         code:           "KRA05H",
//         name:           "InPost Paczkomat KRA05H",
//         service:        "inpost",                  // carrier code
//         type:           "PACZKOMAT",               // carrier-internal type
//         service_type:   "parcel_machine" | "service_point",
//         coordinates:    { latitude, longitude },
//         address:        { street, house_number, postcode, city, country_code, province },
//         opening_hours:  { monday: { start_hour, end_hour } | null, ... },
//         distance:       0.5359,                    // km from search centre
//         cod:            true,
//         description:    "Lokal",
//         max_supported_weight: number | null,
//         is_send_point:    boolean,
//         is_delivery_point: boolean,
//         furgonetka_point: boolean,
//         original_point_id: string | null,
//         phone, email, photos, ...
//       }
//     ]
//   }
//
// Client request body (from the React Native app):
//   {
//     carriers:     string[],     // one or more, e.g. ['inpost','dpd']
//     postcode?:    string,
//     city?:        string,
//     country_code?: string,      // default 'PL'
//     lat?:         number,
//     lng?:         number,
//     point_type?:  'parcel_machine' | 'service_point',
//     limit?:       number        // default 30, capped at 200
//   }
//
// Client response:
//   {
//     success: true,
//     points: [
//       {
//         id, carrier, carrier_display, name, address, city, postcode,
//         country_code, lat, lng, opening_hours, cod, point_type,
//         distance_km, furgonetka_point
//       }
//     ],
//     center: { lat, lng } | null,
//     debug?: {...}                // when ?debug=1
//   }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  errorResponse,
  FURGONETKA_API_BASE,
  successResponse,
} from "../_shared/furgonetka.ts";

// Map of supported Furgonetka carrier codes -> friendly display names.
// (Same set as the rates function; kept in sync manually.)
const CARRIER_REGISTRY: Record<string, string> = {
  allegro: "Allegro One Punkt",
  dhl: "DHL Parcelshop",
  dpd: "DPD Pickup",
  fedex: "FedEx Punkt",
  furgonetkapunkt: "Furgonetka Punkt",
  gls: "GLS",
  inpost: "InPost Paczkomat",
  meest: "Meest",
  orlen: "ORLEN Paczka",
  poczta: "Poczta Polska",
  ups: "UPS Access Point",
};

/** Rates/checkout use `dpd_pickup`; Furgonetka `/points/map` expects `dpd`. */
const PROVIDER_ALIASES: Record<string, string> = {
  dpd_pickup: "dpd",
};

const toPointsMapProvider = (code: string): string => {
  const k = code.toLowerCase();
  return PROVIDER_ALIASES[k] ?? k;
};

interface PointSearchBody {
  carriers?: string[];
  carrier?: string;
  postcode?: string;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  point_type?: "parcel_machine" | "service_point";
  limit?: number;
}

interface FurgonetkaAddress {
  street?: string;
  house_number?: string | null;
  postcode?: string;
  city?: string;
  country_code?: string;
  province?: string;
}

interface FurgonetkaOpeningHours {
  start_hour?: string;
  end_hour?: string;
}

interface FurgonetkaPoint {
  code?: string;
  name?: string;
  service?: string;
  type?: string;
  service_type?: "parcel_machine" | "service_point";
  coordinates?: { latitude?: number; longitude?: number };
  address?: FurgonetkaAddress;
  opening_hours?: Record<string, FurgonetkaOpeningHours | null>;
  distance?: number;
  cod?: boolean;
  description?: string;
  max_supported_weight?: number | null;
  is_send_point?: boolean;
  is_delivery_point?: boolean;
  furgonetka_point?: boolean;
  original_point_id?: string | null;
  holiday?: boolean;
}

interface PointsMapResponse {
  recentlySelectedPoints?: FurgonetkaPoint[];
  points?: FurgonetkaPoint[];
}

const formatAddress = (a?: FurgonetkaAddress): string => {
  if (!a) return "";
  const street = [a.street, a.house_number].filter(Boolean).join(" ").trim();
  const cityLine = [a.postcode, a.city].filter(Boolean).join(" ").trim();
  return [street, cityLine].filter(Boolean).join(", ");
};

const formatOpeningHours = (
  hours?: Record<string, FurgonetkaOpeningHours | null>,
): string | undefined => {
  if (!hours) return undefined;
  const entries = Object.entries(hours);

  // 24/7 detection: every day open with start "00:00" and end >= "23:59".
  const allDays = entries.length === 7;
  const all247 =
    allDays &&
    entries.every(
      ([, h]) =>
        h?.start_hour === "00:00" &&
        (h.end_hour === "23:59" || h.end_hour === "24:00"),
    );
  if (all247) return "24/7";

  // Otherwise pick the first open day as a hint (e.g. "Mon–Fri 10:00–20:00"
  // would require deduping; keep it simple and show a representative slot).
  const firstOpen = entries.find(([, h]) => h && h.start_hour);
  if (firstOpen?.[1]?.start_hour && firstOpen[1].end_hour) {
    const openCount = entries.filter(([, h]) => h && h.start_hour).length;
    return `${firstOpen[1].start_hour}–${firstOpen[1].end_hour} (${openCount} day${openCount === 1 ? "" : "s"}/week)`;
  }
  return undefined;
};

const mapPoint = (p: FurgonetkaPoint) => {
  const carrier = (p.service || "").toLowerCase();
  const display = CARRIER_REGISTRY[carrier] || p.service || "Unknown";

  return {
    id: p.code || p.original_point_id || "",
    carrier,
    carrier_display: display,
    name: p.name || p.code || display,
    address: formatAddress(p.address),
    city: p.address?.city || "",
    postcode: p.address?.postcode || "",
    country_code: p.address?.country_code || "PL",
    lat: typeof p.coordinates?.latitude === "number"
      ? p.coordinates.latitude
      : null,
    lng: typeof p.coordinates?.longitude === "number"
      ? p.coordinates.longitude
      : null,
    opening_hours: formatOpeningHours(p.opening_hours),
    cod: Boolean(p.cod),
    point_type: p.service_type || "service_point",
    distance_km:
      typeof p.distance === "number" ? Number(p.distance.toFixed(2)) : null,
    furgonetka_point: Boolean(p.furgonetka_point),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PointSearchBody = await req.json().catch(() => ({}));

    // Accept either { carrier: "inpost" } or { carriers: [...] }.
    const requestedCarriers = Array.from(
      new Set(
        (
          body.carriers && body.carriers.length > 0
            ? body.carriers
            : body.carrier
              ? [body.carrier]
              : []
        )
          .map((c) => toPointsMapProvider(String(c).toLowerCase()))
          .filter((c) => CARRIER_REGISTRY[c] !== undefined),
      ),
    );

    if (requestedCarriers.length === 0) {
      return errorResponse(
        "at least one supported carrier is required (carriers: string[])",
      );
    }

    const country = (body.country_code || "PL").toUpperCase();
    const hasAddress = Boolean(body.postcode || body.city);
    const hasCoords =
      typeof body.lat === "number" && typeof body.lng === "number";

    if (!hasAddress && !hasCoords) {
      return errorResponse(
        "postcode/city or lat+lng is required to search service points",
      );
    }

    const limit = Math.max(1, Math.min(body.limit ?? 30, 200));

    const location: Record<string, unknown> = {};
    if (hasAddress) {
      location.address = {
        country_code: country,
        postcode: body.postcode || "",
        city: body.city || "",
      };
    }
    if (hasCoords) {
      location.coordinates = {
        latitude: body.lat,
        longitude: body.lng,
      };
    }

    const payload = {
      providers: requestedCarriers,
      location,
      filters: {
        services: requestedCarriers,
        limit,
        country_codes: [country],
        show_other_points: true,
        type: body.point_type ?? null,
      },
    };

    // The /points/map endpoint is public — no Authorization header needed.
    const response = await fetch(`${FURGONETKA_API_BASE}/points/map`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.furgonetka.v1+json",
        "Content-Type": "application/vnd.furgonetka.v1+json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as PointsMapResponse;

    if (!response.ok) {
      const errs = (data as { errors?: Array<{ message?: string }> }).errors;
      const message =
        errs?.[0]?.message ||
        `Furgonetka points search failed (${response.status})`;
      return errorResponse(message, 502);
    }

    const allPoints = data.points || [];
    const filtered = allPoints
      .filter((p) =>
        requestedCarriers.includes((p.service || "").toLowerCase()),
      )
      .slice(0, limit)
      .map(mapPoint);

    const url = new URL(req.url);
    const debug =
      url.searchParams.get("debug") === "1"
        ? {
            requested_carriers: requestedCarriers,
            returned_count: allPoints.length,
            kept_count: filtered.length,
            sample_raw_point: allPoints[0],
          }
        : undefined;

    return successResponse({
      points: filtered,
      center: hasCoords
        ? { lat: body.lat as number, lng: body.lng as number }
        : null,
      source: "furgonetka",
      debug,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("furgonetka-service-points error:", message);
    return errorResponse(message);
  }
});
