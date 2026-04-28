// Supabase Edge Function: furgonetka-rates
// ----------------------------------------
// Fetches live shipping prices from Furgonetka for the carriers we support
// in Poland. Called from the buyer's DeliveryStep in the Expo app.
//
// Request body (from the React Native client):
// {
//   origin:      { postcode: string, city?: string, country_code?: 'PL' }
//   destination: { postcode: string, city?: string, country_code?: 'PL' }
//   parcel:      {
//     weight_grams: number,
//     dimensions_cm?: { width: number, depth: number, height: number },
//     value_pln?: number
//   }
//   carriers?:   string[]   // optional Furgonetka service allowlist
// }
//
// Response:
// {
//   success: true,
//   rates: [
//     {
//       carrier: 'dpd',
//       service_id: 12,
//       display_name: 'DPD',
//       service_type: 'home_delivery' | 'locker_pickup' | 'pickup_point',
//       price_pln: 20.76,
//       price_pln_adjusted: 16.49,        // post-discount, may equal price_pln
//       eta_days: 2,                      // null when unknown
//       requires_service_point: false,
//       quote_id: 'furg_dpd_12'
//     }
//   ],
//   source: 'furgonetka'
// }
//
// Implementation notes:
//   * Furgonetka's POST /packages/calculate-price returns prices for all
//     requested services in ONE call. We send the full carrier list and
//     filter the response.
//   * `pricing.price_gross` is what we display (VAT-inclusive PLN).
//   * `courier_details.avg_delivery_time` is in minutes; convert to days.
//   * We don't yet pass `receiver.point` (locker/parcelshop ID) — that's
//     a Phase 3.5 follow-up: after the buyer picks a service point we'll
//     re-quote with the point ID for an exact price (most carriers price
//     home vs locker identically, so this is a refinement, not a blocker).
//
//   * **Testing lockers in sandbox:** Furgonetka often returns no locker /
//     parcel-shop prices on sandbox accounts. Set the Supabase secret
//     `FURGONETKA_DEV_APPEND_LOCKER_FIXTURES=1` to append synthetic InPost +
//     DPD Pickup rows when the API returns none — use only on dev/staging.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callFurgonetka,
  corsHeaders,
  errorResponse,
  successResponse,
} from "../_shared/furgonetka.ts";

interface RateRequestBody {
  origin?: { postcode?: string; city?: string; country_code?: string };
  destination?: { postcode?: string; city?: string; country_code?: string };
  parcel?: {
    weight_grams?: number;
    dimensions_cm?: { width?: number; depth?: number; height?: number };
    value_pln?: number;
  };
  carriers?: string[];
}

interface CarrierMeta {
  display_name: string;
  service_type: "home_delivery" | "locker_pickup" | "pickup_point";
  requires_service_point: boolean;
}

// Map of Furgonetka `service` codes -> UI metadata. Add/adjust as we learn
// which service identifiers Furgonetka actually returns for our account.
const CARRIER_REGISTRY: Record<string, CarrierMeta> = {
  inpost: {
    display_name: "InPost Paczkomat",
    service_type: "locker_pickup",
    requires_service_point: true,
  },
  inpost_kurier: {
    display_name: "InPost Courier",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  dpd: {
    display_name: "DPD",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  dpd_pickup: {
    display_name: "DPD Pickup",
    service_type: "pickup_point",
    requires_service_point: true,
  },
  dhl: {
    display_name: "DHL",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  gls: {
    display_name: "GLS",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  orlen: {
    display_name: "ORLEN Paczka",
    service_type: "pickup_point",
    requires_service_point: true,
  },
  poczta: {
    display_name: "Poczta Polska",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  fedex: {
    display_name: "FedEx",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  ups: {
    display_name: "UPS",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  ups_access_point: {
    display_name: "UPS Access Point",
    service_type: "pickup_point",
    requires_service_point: true,
  },
  geis: {
    display_name: "Geis",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  ruch: {
    display_name: "Ruch",
    service_type: "pickup_point",
    requires_service_point: true,
  },
  allegro: {
    display_name: "Allegro One Box",
    service_type: "locker_pickup",
    requires_service_point: true,
  },
  furgonetkapunkt: {
    display_name: "Furgonetka Punkt",
    service_type: "pickup_point",
    requires_service_point: true,
  },
  meest: {
    display_name: "Meest",
    service_type: "home_delivery",
    requires_service_point: false,
  },
  ambroexpress: {
    display_name: "Ambro Express",
    service_type: "home_delivery",
    requires_service_point: false,
  },
};

const DEFAULT_CARRIERS = Object.keys(CARRIER_REGISTRY);

interface ServicePriceRow {
  service_id?: number;
  service?: string;
  available?: boolean;
  errors?: Array<{ message?: string }>;
  pricing?: {
    price_gross?: number;
    price_net?: number;
    adjusted_price?: number;
  };
  lowest_price?: { price_gross?: number };
  courier_details?: {
    avg_delivery_time?: number; // minutes
    parcel_locker_pickup_days?: number;
    service_point_pickup_days?: number;
  };
}

interface CalculatePriceResponse {
  services_prices?: ServicePriceRow[];
}

const CULTURAR_PICKUP = {
  name: Deno.env.get("FURGONETKA_PICKUP_NAME") || "Culturar",
  company: Deno.env.get("FURGONETKA_PICKUP_COMPANY") || "Culturar",
  street: Deno.env.get("FURGONETKA_PICKUP_STREET") || "ul. Marszałkowska 1",
  postcode: Deno.env.get("FURGONETKA_PICKUP_POSTCODE") || "00-001",
  city: Deno.env.get("FURGONETKA_PICKUP_CITY") || "Warszawa",
  country_code: Deno.env.get("FURGONETKA_PICKUP_COUNTRY") || "PL",
  email: Deno.env.get("FURGONETKA_PICKUP_EMAIL") || "shipping@culturar.app",
  phone: Deno.env.get("FURGONETKA_PICKUP_PHONE") || "+48000000000",
};

const buildPackagePayload = (req: RateRequestBody, carriers: string[] | null) => {
  const dims = req.parcel?.dimensions_cm || {};
  const weightKg = Math.max(0.1, (req.parcel?.weight_grams || 0) / 1000);

  // Use the buyer-supplied origin if it has a postcode; otherwise fall
  // back to Culturar's default pickup address (used when the seller hasn't
  // configured their own pickup point yet).
  const originPostcode = (req.origin?.postcode || "").trim();
  const pickup = originPostcode
    ? {
        ...CULTURAR_PICKUP,
        postcode: originPostcode,
        city: req.origin?.city || CULTURAR_PICKUP.city,
        country_code: req.origin?.country_code || "PL",
      }
    : CULTURAR_PICKUP;

  const receiver = {
    name: "Buyer",
    company: "",
    street: "ul. Buyer 1",
    postcode: (req.destination?.postcode || "").trim(),
    city: req.destination?.city || "Warszawa",
    country_code: req.destination?.country_code || "PL",
    email: "buyer@example.com",
    phone: "+48000000001",
  };

  const payload: Record<string, unknown> = {
    package: {
      pickup,
      receiver,
      sender: {
        name: pickup.name,
        company: pickup.company,
        street: pickup.street,
        postcode: pickup.postcode,
        city: pickup.city,
        country_code: pickup.country_code,
        email: pickup.email,
        phone: pickup.phone,
      },
      type: "package",
      parcels: [
        {
          width: Math.max(1, Math.round(dims.width || 20)),
          depth: Math.max(1, Math.round(dims.depth || 20)),
          height: Math.max(1, Math.round(dims.height || 10)),
          weight: Number(weightKg.toFixed(2)),
          value: Math.max(0, Math.round(req.parcel?.value_pln || 0)),
          quantity: 1,
        },
      ],
    },
  };

  if (carriers && carriers.length > 0) {
    payload.services = {
      service: carriers,
      service_id: carriers.map(() => null),
    };
  }

  return payload;
};

const minutesToDays = (mins?: number): number | null => {
  if (!mins || mins <= 0) return null;
  return Math.max(1, Math.round(mins / 1440));
};

const mapPriceRow = (row: ServicePriceRow) => {
  const code = (row.service || "").toLowerCase();
  const meta: CarrierMeta = CARRIER_REGISTRY[code] || {
    display_name: row.service || "Unknown",
    service_type: "home_delivery",
    requires_service_point: false,
  };

  const priceGross =
    row.pricing?.price_gross ?? row.lowest_price?.price_gross ?? 0;
  const adjusted = row.pricing?.adjusted_price ?? priceGross;

  return {
    carrier: code,
    service_id: row.service_id ?? null,
    display_name: meta.display_name,
    service_type: meta.service_type,
    price_pln: Number(priceGross.toFixed(2)),
    price_pln_adjusted: Number(adjusted.toFixed(2)),
    eta_days: minutesToDays(row.courier_details?.avg_delivery_time),
    requires_service_point: meta.requires_service_point,
    quote_id: `furg_${code}_${row.service_id ?? "0"}`,
  };
};

/** Dev/staging only: append fake locker rows when sandbox omits them. */
const appendLockerFixturesIfEnabled = (
  rates: ReturnType<typeof mapPriceRow>[],
): { rates: ReturnType<typeof mapPriceRow>[]; appended: boolean } => {
  const flag = (Deno.env.get("FURGONETKA_DEV_APPEND_LOCKER_FIXTURES") || "")
    .trim()
    .toLowerCase();
  if (flag !== "1" && flag !== "true" && flag !== "yes") {
    return { rates, appended: false };
  }
  const hasPoint = rates.some((r) => r.requires_service_point);
  if (hasPoint) return { rates, appended: false };

  const codes = new Set(rates.map((r) => r.carrier));
  const extra: ReturnType<typeof mapPriceRow>[] = [];
  const fixturePln: Record<string, number> = {
    inpost: 12.99,
    dpd_pickup: 15.49,
  };

  const pushFixture = (carrier: string) => {
    if (codes.has(carrier)) return;
    const meta = CARRIER_REGISTRY[carrier];
    if (!meta?.requires_service_point) return;
    const pln = fixturePln[carrier] ?? 13.99;
    extra.push({
      carrier,
      service_id: null,
      display_name: meta.display_name,
      service_type: meta.service_type,
      price_pln: pln,
      price_pln_adjusted: pln,
      eta_days: 2,
      requires_service_point: true,
      quote_id: `dev_fixture_${carrier}`,
    });
    codes.add(carrier);
  };
  pushFixture("inpost");
  pushFixture("dpd_pickup");
  return { rates: [...rates, ...extra], appended: extra.length > 0 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RateRequestBody = await req.json().catch(() => ({}));

    const originPostcode = body.origin?.postcode?.trim();
    const destPostcode = body.destination?.postcode?.trim();

    if (!destPostcode) {
      return errorResponse("destination postcode is required");
    }
    // origin postcode is optional — falls back to Culturar's default pickup.
    if (originPostcode === undefined) {
      return errorResponse("origin postcode is required");
    }

    // Use explicit carrier list if provided, else send NO filter so we
    // get whatever Furgonetka considers active on this account. This is
    // also handy for diagnostics: we can see the actual service codes
    // the account supports.
    const explicitCarriers = body.carriers
      ?.map((c) => c.toLowerCase())
      .filter((c) => CARRIER_REGISTRY[c] !== undefined);

    const requested =
      explicitCarriers && explicitCarriers.length > 0
        ? explicitCarriers
        : null; // null = no filter, ask Furgonetka for everything

    const payload = buildPackagePayload(body, requested);

    const response = await callFurgonetka<CalculatePriceResponse>({
      path: "/packages/calculate-price",
      method: "POST",
      body: payload,
      mediaType: "application/vnd.furgonetka.v1+json",
    });

    const allRows = response.services_prices || [];

    let rates = allRows
      .filter(
        (row) =>
          row.available !== false &&
          (!row.errors || row.errors.length === 0) &&
          (row.pricing?.price_gross || row.lowest_price?.price_gross),
      )
      .map(mapPriceRow);

    const { rates: withFixtures, appended: fixtureRatesAppended } =
      appendLockerFixturesIfEnabled(rates);
    rates = withFixtures;

    // Diagnostics: when no rates come back, the client (and the curl
    // smoke test) gets a row-by-row reason so we can see *why* every
    // carrier was dropped without having to hit Furgonetka logs.
    const url = new URL(req.url);
    const wantDebug =
      url.searchParams.get("debug") === "1" || rates.length === 0;

    const debug = wantDebug
      ? {
          requested_carriers: requested,
          returned_count: allRows.length,
          fixture_rates_appended: fixtureRatesAppended,
          dropped: allRows.map((row) => ({
            service: row.service,
            service_id: row.service_id,
            available: row.available,
            error_messages: (row.errors || []).map((e) => e.message),
            price_gross:
              row.pricing?.price_gross ?? row.lowest_price?.price_gross ?? null,
          })),
        }
      : fixtureRatesAppended
        ? { fixture_rates_appended: true as const }
        : undefined;

    return successResponse({ rates, source: "furgonetka", debug });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("furgonetka-rates error:", message);
    return errorResponse(message);
  }
});
