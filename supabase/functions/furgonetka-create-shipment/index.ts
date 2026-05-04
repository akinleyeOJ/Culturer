// Supabase Edge Function: furgonetka-create-shipment
// ---------------------------------------------------
// Called after a buyer's payment_intent.succeeded (by stripe-webhook)
// or manually from the seller's order-details screen.
//
// Request body: { order_id: string }
//
// Success response (JSON, HTTP 200): { success: true, order_id, stub, ... }
//   * stub: true  — order validated; Furgonetka label + `shipments` row (Phase 4) not yet implemented
//   * stub: false — `shipment_db_id` = public.shipments.id, label/tracking fields filled
//
// Maps to `lib/services/furgonetkaService.ts` `FurgonetkaCreateShipmentApiBody`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  errorResponse,
  successResponse,
} from "../_shared/furgonetka.ts";
import { getSupabaseAdmin, getSupabaseUserClient } from "../_shared/supabaseAdmin.ts";

const STUB_MESSAGE =
  "furgonetka-create-shipment: order validated; Furgonetka label API and shipments row are not implemented yet (Phase 4).";

const parseDetails = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
};

const lockerFromDetails = (
  d: Record<string, unknown>,
): { id?: string } | null => {
  const locker = d.locker;
  if (!locker || typeof locker !== "object" || Array.isArray(locker)) {
    return null;
  }
  return locker as { id?: string };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id || "").trim();
    if (!orderId) {
      return errorResponse("order_id is required");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole =
      authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;

    const admin = getSupabaseAdmin();

    if (!isServiceRole) {
      if (!authHeader.startsWith("Bearer ")) {
        return errorResponse("Missing authorization", 401);
      }
      const userClient = getSupabaseUserClient(authHeader);
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user?.id) {
        return errorResponse("Invalid session", 401);
      }

      const { data: orderRow, error: orderErr } = await admin
        .from("orders")
        .select("seller_id")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr || !orderRow) {
        return errorResponse("Order not found");
      }

      if (String(orderRow.seller_id || "") !== userData.user.id) {
        return errorResponse("Forbidden", 403);
      }
    }

    const { data: order, error: loadErr } = await admin
      .from("orders")
      .select(
        "id, status, seller_id, shipping_method_details, carrier_name, tracking_number, stripe_payment_intent_id, payment_intent_id",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (loadErr || !order) {
      return errorResponse("Order not found");
    }

    if (String(order.tracking_number || "").trim().length > 0) {
      return errorResponse(
        "This order already has a tracking number; use order details to view the label.",
      );
    }

    const { data: existingShipment } = await admin
      .from("shipments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingShipment) {
      return errorResponse("A shipment record already exists for this order");
    }

    const st = String(order.status || "").toLowerCase();
    if (st !== "paid" && st !== "confirmed") {
      return errorResponse(
        "Order must be paid before creating a shipment (status paid or confirmed).",
      );
    }

    const details = parseDetails(order.shipping_method_details);
    const shipType = String(details.type || "").toLowerCase();

    if (shipType === "local_pickup") {
      return errorResponse(
        "Local pickup orders do not use a courier label from Furgonetka.",
      );
    }

    if (shipType === "locker_pickup") {
      const lid = String(lockerFromDetails(details)?.id || "").trim();
      if (!lid) {
        return errorResponse(
          "This order is missing a pickup point (locker) on the shipping details.",
        );
      }
    }

    if (!shipType && !order.carrier_name) {
      return errorResponse("Order is missing shipping method details.");
    }

    // TODO(phase-4):
    //   - Load seller profile (shop_shipping origin), resolve buyer email
    //   - Map shipping_method_details (furgonetka_carrier, service_id, quote_id, locker) -> REST body
    //   - callFurgonetka POST /shipments (or the correct v1 path)
    //   - INSERT into public.shipments, UPDATE orders.status if needed
    //   - Return stub: false with non-null label fields

    return successResponse({
      order_id: orderId,
      stub: true,
      message: STUB_MESSAGE,
      shipment_db_id: null,
      furgonetka_shipment_id: null,
      furgonetka_quote_id: null,
      tracking_number: null,
      tracking_url: null,
      label_url: null,
      qr_code_url: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("furgonetka-create-shipment error:", message);
    return errorResponse(message);
  }
});
