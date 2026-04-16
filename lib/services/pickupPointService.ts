import { fetchSendcloudServicePoints } from "./sendcloudService";
import { fetchInPostPointPayloads } from "./inpostService";
import { providerSupportsPickupSearch } from "../shippingProviders/registry";

export interface PickupPointResult {
  id: string;
  address: string;
  hint: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
}

export interface PickupPointSearchContext {
  query?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

const INPOST_POINTS_API = "https://api-shipx-pl.easypack24.net/v1/points";

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const looksLikePostalCode = (value: string) =>
  /^\d{2}-?\d{3}$/.test(value.trim());

const formatPolishPostalCode = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 5
    ? `${digits.slice(0, 2)}-${digits.slice(2)}`
    : value.trim();
};

const inferCitySearchFromQuery = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  const withoutPostalCode = normalized.replace(/\b\d{2}-?\d{3}\b/g, " ");
  const beforeNumber = withoutPostalCode.split(/\d/, 1)[0]?.trim() ?? "";
  return beforeNumber
    .replace(/[^\p{L}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const scorePickupPoint = (pickupPoint: PickupPointResult, query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedAddress = normalizeSearchValue(
    `${pickupPoint.id} ${pickupPoint.address} ${pickupPoint.hint}`,
  );

  if (!normalizedQuery) return 0;
  if (normalizedAddress === normalizedQuery) return 1000;
  if (normalizedAddress.startsWith(normalizedQuery)) return 750;
  if (normalizedAddress.includes(normalizedQuery)) return 500;

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .reduce(
      (score, token) => score + (normalizedAddress.includes(token) ? 100 : 0),
      0,
    );
};

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

const calculateDistanceKm = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) => {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(toLatitude - fromLatitude);
  const dLon = degreesToRadians(toLongitude - fromLongitude);
  const lat1 = degreesToRadians(fromLatitude);
  const lat2 = degreesToRadians(toLatitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const mapInPostPoint = (item: any): PickupPointResult => ({
  id: item.name,
  address: item.address?.line2
    ? `${item.address.line2}, ${item.address.line1}`
    : `${item.address_details.city}, ${item.address_details.street} ${item.address_details.building_number}`,
  hint: item.location_description || item.name,
  latitude: item.location?.latitude,
  longitude: item.location?.longitude,
});

const dedupeInPostPayloads = (payloads: any[]) => {
  const dedupedPickupPoints = new Map<string, PickupPointResult>();

  payloads.forEach((payload: any) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    items.forEach((item: any) => {
      const pickupPoint = mapInPostPoint(item);
      dedupedPickupPoints.set(pickupPoint.id, pickupPoint);
    });
  });

  return Array.from(dedupedPickupPoints.values());
};

const sortPickupPoints = (
  pickupPoints: PickupPointResult[],
  context: PickupPointSearchContext,
) => {
  const hasCoordinates =
    typeof context.latitude === "number" &&
    typeof context.longitude === "number";
  const query = context.query?.trim() || "";

  const withDistance = pickupPoints.map((pickupPoint) => {
    if (
      hasCoordinates &&
      typeof pickupPoint.latitude === "number" &&
      typeof pickupPoint.longitude === "number"
    ) {
      return {
        ...pickupPoint,
        distanceKm: calculateDistanceKm(
          context.latitude!,
          context.longitude!,
          pickupPoint.latitude,
          pickupPoint.longitude,
        ),
      };
    }

    return pickupPoint;
  });

  return withDistance.sort((a, b) => {
    if (typeof a.distanceKm === "number" && typeof b.distanceKm === "number") {
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
    }

    if (query) {
      return scorePickupPoint(b, query) - scorePickupPoint(a, query);
    }

    return a.id.localeCompare(b.id);
  });
};

const buildInPostSearchUrls = (
  context: PickupPointSearchContext,
  fallbackAddress?: PickupPointSearchContext,
) => {
  const query = context.query?.trim() || "";
  const city = context.city?.trim() || fallbackAddress?.city?.trim() || "";
  const postalCode =
    context.postalCode?.trim() || fallbackAddress?.postalCode?.trim() || "";
  const addressQuery = fallbackAddress?.query?.trim() || "";
  const inferredCity = inferCitySearchFromQuery(query);

  const queryCandidates = Array.from(
    new Set(
      [
        query,
        looksLikePostalCode(query) ? formatPolishPostalCode(query) : "",
        looksLikePostalCode(postalCode)
          ? formatPolishPostalCode(postalCode)
          : "",
        city,
        inferredCity,
        addressQuery,
      ].filter(Boolean),
    ),
  );

  const textUrls = Array.from(
    new Set(
      queryCandidates.flatMap((candidate) => {
        const urls = [
          `${INPOST_POINTS_API}?query=${encodeURIComponent(candidate)}&per_page=25`,
        ];

        if (city && candidate.toLowerCase() !== city.toLowerCase()) {
          urls.unshift(
            `${INPOST_POINTS_API}?query=${encodeURIComponent(candidate)}&city=${encodeURIComponent(city)}&per_page=25`,
          );
        }

        return urls;
      }),
    ),
  );

  // When GPS coordinates are available, prepend InPost's proximity endpoint so
  // results are fetched by actual location rather than relying purely on text
  // matching (which can return wrong-city results when a postal code happens to
  // match another area, e.g. "94107" matching Łódź 94-107).
  if (
    typeof context.latitude === "number" &&
    typeof context.longitude === "number"
  ) {
    const proximityUrl = `${INPOST_POINTS_API}?relative_point=${context.latitude},${context.longitude}&max_distance=25&per_page=25`;
    return [proximityUrl, ...textUrls.filter((u) => u !== proximityUrl)];
  }

  return textUrls;
};

export const fetchPickupPoints = async (
  carrierName: string,
  context: PickupPointSearchContext,
  fallbackAddress?: PickupPointSearchContext,
) => {
  if (!providerSupportsPickupSearch(carrierName)) {
    return [];
  }

  const query = context.query?.trim() || "";
  const city = context.city?.trim() || fallbackAddress?.city?.trim() || "";
  const postalCode =
    context.postalCode?.trim() || fallbackAddress?.postalCode?.trim() || "";
  const country =
    context.country?.trim() || fallbackAddress?.country?.trim() || "";
  const hasNearbyFallback = !!city || looksLikePostalCode(postalCode);

  if (query.length < 3 && !hasNearbyFallback) {
    return [];
  }

  if (carrierName.includes("InPost")) {
    const searchUrls = buildInPostSearchUrls(context, fallbackAddress);
    const proxiedResult = await fetchInPostPointPayloads({ searchUrls });

    if (proxiedResult.success) {
      const pickupPoints = dedupeInPostPayloads(proxiedResult.payloads);
      if (pickupPoints.length > 0) {
        return sortPickupPoints(pickupPoints, context).slice(0, 8);
      }
    }

    const responses = await Promise.all(
      searchUrls.map((url) => fetch(url).then((response) => response.json())),
    );
    const pickupPoints = dedupeInPostPayloads(responses);
    return sortPickupPoints(pickupPoints, context).slice(0, 8);
  }

  const sendcloudAddressQuery = query || postalCode || city;
  if (country && sendcloudAddressQuery) {
    const sendcloudResult = await fetchSendcloudServicePoints({
      carrierName,
      country,
      address: sendcloudAddressQuery,
    });

    if (sendcloudResult.success && sendcloudResult.servicePoints.length > 0) {
      const mapped = sendcloudResult.servicePoints.map((servicePoint) => ({
        id: servicePoint.name,
        address: servicePoint.address,
        hint: servicePoint.hint,
        latitude: servicePoint.latitude,
        longitude: servicePoint.longitude,
      }));

      return sortPickupPoints(mapped, context).slice(0, 8);
    }
  }

  return [];
};
