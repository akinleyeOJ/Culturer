import { supabase } from "../supabase";

interface FetchInPostPointPayloadsParams {
  searchUrls: string[];
}

export const fetchInPostPointPayloads = async ({
  searchUrls,
}: FetchInPostPointPayloadsParams) => {
  try {
    const sanitizedUrls = searchUrls
      .map((url) => String(url || "").trim())
      .filter(Boolean);

    if (sanitizedUrls.length === 0) {
      return {
        success: true,
        payloads: [] as any[],
      };
    }

    const { data, error } = await supabase.functions.invoke("inpost-handler", {
      body: {
        action: "search-points",
        urls: sanitizedUrls,
      },
    });

    if (error) throw error;
    if (!data?.success)
      throw new Error(data?.error || "Failed to fetch InPost pickup points");

    return {
      success: true,
      payloads: Array.isArray(data?.payloads) ? data.payloads : [],
    };
  } catch (err: any) {
    if (__DEV__) {
      console.warn(
        "InPost pickup-point lookup unavailable, falling back.",
        err?.message || err,
      );
    }

    return {
      success: false,
      payloads: [] as any[],
      error: err?.message || "InPost pickup-point lookup unavailable",
    };
  }
};

export interface InPostRateShipmentRequest {
  id: string;
  service: string;
  parcelTemplate: "mini" | "small" | "medium" | "large";
  receiver: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    postalCode: string;
    countryCode: "PL";
  };
  targetPoint?: string;
}

export interface InPostCalculatedRate {
  id: string;
  amount: number | null;
  currency: string;
  error?: string;
}

export const createInPostShipmentFromOrder = async (orderId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("inpost-handler", {
      body: {
        action: "create-shipment-from-order",
        order_id: orderId,
      },
    });

    if (error) throw error;

    if (!data?.success) {
      return {
        success: false as const,
        error: String(data?.error || "Failed to create InPost shipment"),
      };
    }

    return {
      success: true as const,
      tracking_number: String(data.tracking_number || ""),
      tracking_url: String(data.tracking_url || ""),
      inpost_shipment_id: data.inpost_shipment_id as number | undefined,
    };
  } catch (err: any) {
    return {
      success: false as const,
      error: err?.message || "Failed to create InPost shipment",
    };
  }
};

export const fetchInPostCalculatedRates = async (
  shipments: InPostRateShipmentRequest[],
) => {
  try {
    const sanitizedShipments = shipments.filter(Boolean);
    if (sanitizedShipments.length === 0) {
      return {
        success: true,
        rates: [] as InPostCalculatedRate[],
      };
    }

    const { data, error } = await supabase.functions.invoke("inpost-handler", {
      body: {
        action: "calculate-rates",
        shipments: sanitizedShipments,
      },
    });

    if (error) throw error;
    if (!data?.success)
      throw new Error(data?.error || "Failed to calculate InPost rates");

    return {
      success: true,
      rates: Array.isArray(data?.rates)
        ? (data.rates as InPostCalculatedRate[])
        : [],
    };
  } catch (err: any) {
    if (__DEV__) {
      console.warn("InPost rate lookup unavailable.", err?.message || err);
    }

    return {
      success: false,
      rates: [] as InPostCalculatedRate[],
      error: err?.message || "InPost rate lookup unavailable",
    };
  }
};
