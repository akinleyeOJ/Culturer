# Refactor Plan: Migrate Shipping to Furgonetka.pl

Single-broker migration for all Polish carriers + Stripe Connect escrow. Touches buyer and seller flows end-to-end.

---

## 1. Current state — what we rip out vs. keep

### Keep
- Supabase (auth, `profiles`, `orders`, `order_items`, `products`)
- Stripe (payments) — but upgrade to **Stripe Connect + manual capture** for escrow
- `app/cart.tsx`, `app/checkout.tsx` skeleton, `components/checkout/*` UI shell
- `app/pickup-points.tsx` UX (repurpose for Furgonetka service-points)
- `lib/shippingUtils.ts` zone/tier/weight logic (still useful)
- `supabase/functions/create-payment-intent` (modify, not replace)

### Remove / deprecate
- `supabase/functions/sendcloud-handler/`
- `supabase/functions/shippo-handler/` + `shippo-webhook/`
- `lib/services/sendcloudService.ts`, `lib/sendcloudCarrierMap.ts`
- Multi-adapter logic in `lib/shippingProviders/registry.ts` (Furgonetka is the single broker)
- Direct InPost ShipX integration in `supabase/functions/inpost-handler/` (Furgonetka handles InPost)

### Replace / add
- New Furgonetka Edge Functions (rates, labels, tracking webhook, service-points)
- New `shipments` + `tracking_events` tables
- Stripe Connect onboarding for sellers + manual-capture escrow flow
- Furgonetka "Koszyk" WebView widget embedded at checkout for carrier/locker selection

---

## 2. Target architecture

```
Expo RN app (buyer + seller UI)
        │
        ▼
Supabase  ─────►  Edge Functions  ─────►  Furgonetka REST API
  (DB + Auth)      - furgonetka-rates       (labels, tracking, all PL carriers)
                   - furgonetka-create-shipment
                   - furgonetka-webhook  ◄── Furgonetka webhooks (scan events)
                   - stripe-*  (Connect onboarding, PI, transfers)
        │
        ▼
Supabase Realtime ──► app subscribes to tracking_events for live timeline
```

### Four layers
1. **Checkout carrier selection** — **Native RN picker** fed by `furgonetka-rates` + `furgonetka-service-points` Edge Functions. All UI owned by us (cards, map, markers) for brand consistency. Selection written to `orders.shipping_method_details`.
2. **Label generation** — post-payment Edge Function calls `POST /api/rest/shipments` → stores `tracking_number`, `label_url`, `qr_code_url` in `shipments`.
3. **Tracking** — Furgonetka webhook → Supabase Edge Function → inserts into `tracking_events` → Supabase Realtime pushes to buyer + seller.
4. **Escrow** — Stripe Connect with `capture_method: 'manual'`; `delivered` webhook triggers Transfer to seller's connected account after buyer confirms or auto-release after N days.

---

## 3. Database migrations

New SQL files in `database/`:

```sql
-- shipments (one-to-one with orders for v1, one-to-many later)
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  furgonetka_shipment_id text,
  tracking_number text,
  carrier text,                          -- inpost | dpd | dhl | gls | poczta
  service_point_id text,                 -- locker/pickup point chosen by buyer
  label_url text,
  qr_code_url text,                      -- for InPost mobile drop-off
  status text,                           -- label_created | dropped_off | in_transit | out_for_delivery | delivered
  estimated_delivery timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references shipments(id) on delete cascade,
  status text,
  description text,
  location text,
  event_timestamp timestamptz,
  raw_payload jsonb,
  created_at timestamptz default now()
);

-- RLS: buyer (orders.user_id) + seller (orders.seller_id) can read their own rows.
-- Webhook Edge Function uses service role to insert.

-- Extend orders
alter table orders
  add column stripe_payment_intent_id text,
  add column stripe_transfer_id text,
  add column escrow_status text default 'pending', -- pending | held | released | refunded
  add column buyer_confirmed_at timestamptz;

-- Extend profiles for Stripe Connect
alter table profiles
  add column stripe_connect_account_id text,
  add column stripe_connect_onboarded boolean default false,
  add column furgonetka_sender_id text;  -- if we register sellers as senders in Furgonetka
```

---

## 4. Edge Functions (new / rewritten)

| Function | Purpose | Replaces |
|---|---|---|
| `furgonetka-rates` | POST `/api/rest/pricing` — live rates for all PL carriers given origin/dest/parcel | `inpost-handler` calculate-rates, `sendcloud-handler` |
| `furgonetka-service-points` | Proxy `/api/rest/service_points` for InPost/DPD/GLS/Orlen Paczka lockers | `inpost-handler` search-points |
| `furgonetka-create-shipment` | Called post-payment: `POST /api/rest/shipments` → writes row into `shipments`, updates `orders.status='shipped'` | `inpost-handler` create-shipment-from-order |
| `furgonetka-webhook` | Receives scan events from Furgonetka → inserts into `tracking_events`, updates `shipments.status`, fires delivery-released flow when `delivered` | new |
| `stripe-connect-onboard` | Creates Stripe Connect Express account + onboarding link for seller | new |
| `stripe-webhook` (modify) | On `payment_intent.succeeded` → set `orders.status='paid'`, trigger `furgonetka-create-shipment` | existing |
| `stripe-release-escrow` | Called on `delivered` + cooldown → `stripe.transfers.create` to seller's connected account | new |
| `create-payment-intent` (modify) | Add `capture_method: 'manual'`, `transfer_data.destination`, `application_fee_amount` | existing |

### Secrets to add in Supabase
```
FURGONETKA_API_TOKEN
FURGONETKA_WEBHOOK_SECRET
STRIPE_CONNECT_CLIENT_ID
PLATFORM_FEE_PERCENT        # e.g. 5 (for 5% marketplace fee)
ESCROW_AUTO_RELEASE_DAYS    # e.g. 2
```

---

## 5. Client-side refactor

### Shared
- **New** `lib/services/furgonetkaService.ts` — thin wrappers for rates / create-shipment / service-points.
- **Collapse** `lib/shippingProviders/registry.ts` from 24 adapters → 1 Furgonetka adapter + `local_pickup`.
- **Simplify** `lib/shippingUtils.ts`: remove per-provider price tiers (Furgonetka returns live rates); keep zones, weight tiers, locked defaults.
- **Delete** `lib/services/sendcloudService.ts`, `lib/sendcloudCarrierMap.ts`.

### Buyer flow
| File | Change |
|---|---|
| `app/cart.tsx` | No change — passes cart to checkout |
| `app/checkout.tsx` | Replace custom carrier grid with **native carrier picker** fed by `furgonetka-rates`. WebView is explicitly rejected. |
| `app/pickup-points.tsx` | Rewire data source from `inpost-handler`/`sendcloud-handler` to `furgonetka-service-points`. Keep native map UI; extend to render DPD/DHL/GLS/Orlen points (not just InPost lockers) with carrier-specific marker icons. |
| `components/checkout/DeliveryStep.tsx` | Drop provider-selection grid. Replace with **native carrier cards** (logo, price, ETA, "Select point" CTA if locker/pickup type). Selected carrier expands inline; tapping "Select point" routes to `pickup-points.tsx`. |
| `components/checkout/PaymentStep.tsx` | Unchanged UX; PI now uses `capture_method: 'manual'` |
| `components/checkout/ReviewStep.tsx` | Show selected carrier + service point from Furgonetka payload |
| `lib/hooks/useCheckoutShipping.ts` | Rewrite: fetch rates from `furgonetka-rates` only; remove multi-provider aggregation, Sendcloud capability checks, InPost direct path |
| `app/order-confirmation.tsx` | Subscribe to `tracking_events` via Supabase Realtime |
| `app/profile/order-details/[id].tsx` | Add live tracking timeline component driven by `tracking_events` |
| **New** `components/TrackingTimeline.tsx` | Vertical timeline of scan events |
| **New** `app/profile/confirm-delivery/[id].tsx` | "I got my item" button → releases escrow early |

### Seller flow
| File | Change |
|---|---|
| `app/profile/seller-shipping.tsx` | Huge simplification: remove per-carrier price config (Furgonetka returns live quotes). Keep: origin address, processing time, zones served, which Furgonetka carriers to offer (InPost / DPD / DHL / GLS+Orlen / Poczta toggles), InPost ReadyToShip default. |
| `app/profile/seller-hub.tsx` | Add "Stripe Connect" onboarding card (blocks selling until done) |
| `app/profile/payouts.tsx` | Show escrow state per order (held / released), upcoming payout from Stripe Connect |
| `app/profile/order-details/[id].tsx` (seller view) | Replace "Create InPost shipment" button with "Generate shipping label" → calls `furgonetka-create-shipment`; show QR/PDF for drop-off |
| **New** `app/profile/stripe-connect.tsx` | Onboarding redirect + status screen |
| `app/profile/orders.tsx` | No structural change, but show Furgonetka carrier + live status |

### Delete
- `supabase/functions/sendcloud-handler/`
- `supabase/functions/shippo-handler/`
- `supabase/functions/shippo-webhook/`
- `supabase/functions/inpost-handler/` (after Furgonetka create-shipment is verified in prod)
- `lib/services/sendcloudService.ts`
- `lib/sendcloudCarrierMap.ts`

---

## 6. Phased execution

### Phase 1 — Foundation (week 1)
1. Sign up for Furgonetka API access, get sandbox token
2. Create `shipments` + `tracking_events` tables with RLS
3. Extend `orders` + `profiles` with Stripe Connect + escrow columns
4. Scaffold 4 new Edge Functions with stubs

### Phase 2 — Stripe Connect escrow (week 1–2)
5. Build seller Connect onboarding (`app/profile/stripe-connect.tsx` + edge fn)
6. Modify `create-payment-intent` → `capture_method: manual`, `transfer_data.destination`
7. Block seller listing creation until `stripe_connect_onboarded = true`

### Phase 3 — Furgonetka rates + native checkout (weeks 2–3)
8. Implement `furgonetka-rates` + `furgonetka-service-points` Edge Functions
9. Rewrite `useCheckoutShipping.ts` (Furgonetka-only, single rates source)
10. Build **native carrier picker** in `DeliveryStep.tsx`:
    - `CarrierCard` component (logo, display name, price, ETA days, "Select point" CTA for locker/pickup types, tick indicator when selected)
    - Render list sorted by price ascending; pre-select cheapest
    - Skeleton loader while `furgonetka-rates` is fetching
    - Empty state + retry when no rates returned (out of zone / invalid postcode)
11. Extend `app/pickup-points.tsx` to be carrier-aware:
    - Accept `carrier` param (`inpost` | `dpd` | `dhl` | `gls` | `orlen` | `poczta`)
    - Fetch points from `furgonetka-service-points` with that carrier filter
    - Render carrier-specific marker icons (InPost yellow locker, DPD red, DHL yellow+red, etc.)
    - Keep existing search-by-postcode + map-pan UX
    - Write selection back via existing `pickupPointSelectionStore`
12. Design assets: source official carrier logos (SVG) + brand colours for markers. Store in `assets/carriers/`.

### Phase 4 — Label generation post-payment (week 3)
13. Implement `furgonetka-create-shipment` Edge Function
14. Trigger it from `stripe-webhook` on `payment_intent.succeeded`
15. Seller receives push + sees QR/PDF in order details
16. Delete `inpost-handler/createShipmentFromOrder.ts`

### Phase 5 — Tracking + realtime (week 4)
17. Implement `furgonetka-webhook` Edge Function (HMAC verify via `FURGONETKA_WEBHOOK_SECRET`)
18. Build `TrackingTimeline.tsx` component
19. Wire Supabase Realtime subscription in order-details + order-confirmation
20. Register webhook URL in Furgonetka dashboard

### Phase 6 — Escrow release (week 4)
21. On `tracking_events` insert where `status='delivered'`: start auto-release timer
22. Buyer "Confirm received" button → immediate release via `stripe-release-escrow`
23. Cron / scheduled Edge Function releases after `ESCROW_AUTO_RELEASE_DAYS`
24. Show escrow state in seller payouts screen

### Phase 7 — Cleanup (week 5)
25. Delete Sendcloud + Shippo + InPost-direct edge functions
26. Delete unused services/registry entries
27. Update `CLAUDE.md` "Shipping Architecture" section
28. Remove old env vars (`INPOST_SHIPX_TOKEN`, etc.)

---

## 7. Decisions

1. **Carrier picker UI: NATIVE (locked in).** All carrier + service-point selection is rendered in React Native. No WebView. Adds ~1 week vs. Koszyk WebView but gives full brand control, native performance, and a portfolio-worthy checkout.
2. **Escrow auto-release window** — 2 days (Vinted-style), 7 days (safe), or 14 days (eBay-style)? *(still needed)*
3. **Marketplace fee %** — Culturer's cut (for `application_fee_amount`). *(still needed)*
4. **Keep InPost direct as fallback** or go all-in on Furgonetka? Recommend all-in. *(still needed)*
5. **Sandbox first?** Build against Furgonetka sandbox, then swap to prod token in Supabase secrets. *(still needed)*

Default answers for the remaining four (if no override): `2 days, 5%, all-in, sandbox first`.

---

## 8. Carrier scope (for reference — from screenshots)

MVP carriers to offer at checkout, in priority order:

| Carrier | Type | Share of PL market |
|---|---|---|
| InPost | Lockers (25k APMs) | 32.9% |
| DPD | Courier + 2,600 pickup points | 23.2% |
| DHL | 15k ServicePoints + courier | 10.4% |
| Poczta Polska | Post offices + home | 9.9% |
| GLS + Orlen Paczka | Shared locker network (15k APMs) | 5.9% + 4.3% |

All routed through Furgonetka — single integration, single label format, single tracking webhook.

---

## 9. Native carrier picker — detailed spec

Since we've committed to native-first, here's the exact contract the picker must fulfil.

### 9.1 Data flow
```
DeliveryStep.tsx
    │  (sends origin postcode + destination + parcel tier + weight)
    ▼
useCheckoutShipping hook
    │
    ▼
furgonetka-rates Edge Function  ───►  Furgonetka REST /api/rest/pricing
    │
    ◄── returns: [{ carrier_id, display_name, service_type, price_pln, eta_days, requires_service_point }, ...]
    │
DeliveryStep renders <CarrierCard> list
    │
    ├─► if requires_service_point && tapped "Select point":
    │       router.push('/pickup-points?carrier=inpost&postcode=00-001')
    │           │
    │           ▼
    │       pickup-points.tsx
    │           │
    │           ▼
    │       furgonetka-service-points Edge Function  ───►  /api/rest/service_points?carrier=inpost
    │           │
    │           ▼
    │       native MapView + marker list → selection stored in pickupPointSelectionStore
    │           │
    │           ▼
    │       router.back() → DeliveryStep reads store on focus
    │
    └─► on final "Continue":
        orders.shipping_method_details = {
          carrier: 'inpost',
          service: 'locker_pickup',
          service_point_id: '...',
          service_point_name: 'Paczkomat WAW123',
          price_pln: 16.49,
          furgonetka_quote_id: '...'
        }
```

### 9.2 New / changed client files

| File | Role |
|---|---|
| `components/checkout/CarrierCard.tsx` *(new)* | Pure presentation: logo, display name, price, ETA badge, "Select point" chip if locker/pickup, radio tick |
| `components/checkout/CarrierList.tsx` *(new)* | Maps rates → `CarrierCard[]`, handles selection state, skeleton + empty + error states |
| `components/checkout/ServicePointSummary.tsx` *(new)* | Inline card under selected carrier showing chosen locker/point (name, address, change CTA) |
| `components/checkout/DeliveryStep.tsx` | Replace provider-grid with `<CarrierList>` + `<ServicePointSummary>` |
| `app/pickup-points.tsx` | Extend to be carrier-aware (accepts `?carrier=` param); render carrier-specific marker assets |
| `lib/hooks/useCheckoutShipping.ts` | Rewrite: single `furgonetkaRates` source; drop quoteMap/multi-adapter machinery |
| `lib/services/furgonetkaService.ts` *(new)* | `fetchRates()`, `fetchServicePoints()`, `createShipment()` — typed wrappers |
| `lib/shippingProviders/registry.ts` | Collapse to 2 entries: `furgonetka` + `local_pickup`. Keep `ShippingProviderAdapter` type as escape hatch. |
| `assets/carriers/inpost.svg`, `dpd.svg`, `dhl.svg`, `gls.svg`, `orlen.svg`, `poczta.svg` *(new)* | Official logos for cards |
| `assets/carriers/markers/*.png` *(new)* | Branded map pin icons for `pickup-points.tsx` |

### 9.3 CarrierCard visual spec (guiding principles)
- Height 72px, 12px border radius, 1px neutral border, white bg, tick indicator on right
- Left: 40×40 carrier logo in rounded square with carrier brand-tint background (e.g. InPost yellow at 10% opacity)
- Middle: bold display name ("InPost Paczkomat"), small grey subtitle ("Locker pickup · 1–2 days")
- Right: bold price "16.49 zł", small radio tick
- Expanded state (selected): adds inline `ServicePointSummary` or address summary below
- Follow existing `Colors` constants from `constants/color.ts` — do **not** hardcode hex values

### 9.4 Ordering & selection rules
- Rates sorted by `price_pln` ascending
- Auto-select cheapest on mount *only if* no existing selection (i.e. don't override user choice on re-render)
- Disable card + show inline warning if `requires_service_point` and no selection made yet (card is tappable to open picker, but "Continue" button is blocked)
- If Furgonetka returns zero rates → render empty state with "Check postcode" CTA that focuses the postcode field

### 9.5 Out of scope for v1 (parking lot)
- Per-carrier ETA calendars / same-day filtering
- Seller-side carrier exclusions (already handled by `seller-shipping.tsx` toggles)
- Multi-parcel orders (v1 assumes single parcel per order)
- International rates (v1 is PL-domestic only)
