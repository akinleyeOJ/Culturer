-- ============================================
-- Furgonetka Migration (Phase 1)
-- ----------------------------------------------
-- Adds:
--   * shipments                 (1:1 with orders for v1)
--   * tracking_events           (append-only scan log)
--   * orders.stripe_payment_intent_id
--   * orders.stripe_transfer_id
--   * orders.escrow_status
--   * orders.buyer_confirmed_at
--   * orders.delivered_at
--   * profiles.stripe_connect_account_id
--   * profiles.stripe_connect_onboarded
--   * profiles.furgonetka_sender_id
--
-- Run this AFTER database/add_shipping_system.sql.
-- Idempotent — safe to re-run.
-- ============================================

-- ========== 1. ORDERS: escrow + stripe connect columns ==========

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

-- escrow_status lifecycle:
--   pending  -> order created, payment not yet captured
--   held     -> payment captured, funds sitting on platform account
--   released -> funds transferred to seller's connected account
--   refunded -> buyer refunded (dispute / cancel)
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;

-- Set by furgonetka-webhook when carrier reports `delivered`.
-- Starts the auto-release countdown.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx
    ON public.orders (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS orders_escrow_status_idx
    ON public.orders (escrow_status);

-- ========== 2. PROFILES: stripe connect + furgonetka sender ==========

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT FALSE;

-- If Furgonetka requires pre-registered sender records per seller,
-- we cache their ID here so we don't re-register on every shipment.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS furgonetka_sender_id TEXT;

-- ========== 3. SHIPMENTS ==========

CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,

    -- Furgonetka's identifiers
    furgonetka_shipment_id TEXT,
    furgonetka_quote_id TEXT,

    -- Carrier & service chosen by buyer
    carrier TEXT,              -- inpost | dpd | dhl | gls | orlen | poczta
    service_type TEXT,         -- locker_pickup | home_delivery | pickup_point
    service_point_id TEXT,     -- locker/pickup point chosen by buyer (if applicable)
    service_point_name TEXT,   -- human-readable label for UI
    service_point_address TEXT,

    -- Label artifacts
    tracking_number TEXT,
    tracking_url TEXT,
    label_url TEXT,
    qr_code_url TEXT,          -- InPost mobile drop-off QR

    -- Status lifecycle:
    --   label_created | dropped_off | in_transit | out_for_delivery | delivered | failed
    status TEXT DEFAULT 'label_created',

    -- Pricing snapshot at creation
    price_pln NUMERIC(10, 2),

    estimated_delivery TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shipments_order_id_unique_idx
    ON public.shipments (order_id);

CREATE INDEX IF NOT EXISTS shipments_tracking_number_idx
    ON public.shipments (tracking_number);

CREATE INDEX IF NOT EXISTS shipments_furgonetka_shipment_id_idx
    ON public.shipments (furgonetka_shipment_id);

-- ========== 4. TRACKING EVENTS ==========

CREATE TABLE IF NOT EXISTS public.tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,

    status TEXT NOT NULL,      -- label_created | dropped_off | in_transit | out_for_delivery | delivered | exception
    description TEXT,          -- human-readable message from carrier
    location TEXT,              -- city / depot name if provided

    event_timestamp TIMESTAMPTZ NOT NULL,

    -- Raw Furgonetka payload for debugging / future-proofing
    raw_payload JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tracking_events_shipment_id_idx
    ON public.tracking_events (shipment_id);

CREATE INDEX IF NOT EXISTS tracking_events_event_timestamp_idx
    ON public.tracking_events (event_timestamp DESC);

-- ========== 5. RLS ==========

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- Shipments: buyer or seller of the parent order can read
-- NOTE: In some Culturer schemas `orders.seller_id` is TEXT (UUID string) while
-- `auth.uid()` is UUID. Compare with an explicit cast guarded by a UUID-shaped regex.
DROP POLICY IF EXISTS "Shipments readable by buyer or seller" ON public.shipments;
CREATE POLICY "Shipments readable by buyer or seller" ON public.shipments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = shipments.order_id
              AND (
                  orders.user_id = auth.uid()
                  OR (
                      orders.seller_id ~ '^[0-9a-fA-F-]{36}$'
                      AND (orders.seller_id)::uuid = auth.uid()
                  )
              )
        )
    );

-- Inserts/updates only via service role (Edge Functions); no client policy.

-- Tracking events: same read rules via parent shipment -> order
DROP POLICY IF EXISTS "Tracking events readable by buyer or seller" ON public.tracking_events;
CREATE POLICY "Tracking events readable by buyer or seller" ON public.tracking_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shipments s
            JOIN public.orders o ON o.id = s.order_id
            WHERE s.id = tracking_events.shipment_id
              AND (
                  o.user_id = auth.uid()
                  OR (
                      o.seller_id ~ '^[0-9a-fA-F-]{36}$'
                      AND (o.seller_id)::uuid = auth.uid()
                  )
              )
        )
    );

-- ========== 6. REALTIME ==========

-- Enable realtime broadcast for tracking_events so buyer + seller
-- can subscribe to INSERTs and render a live timeline.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;

-- ========== 7. UPDATED_AT TRIGGER ==========

CREATE OR REPLACE FUNCTION public.set_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW(); 
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipments_set_updated_at ON public.shipments;
CREATE TRIGGER shipments_set_updated_at
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_shipments_updated_at();
