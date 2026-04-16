# Project Notes - Claude Code Context

## ⚠️ Agent Behaviour Rule
- Make **targeted edits only** — never overwrite entire files
- Use `edit` mode with minimal diffs, not `overwrite`
- Keep responses concise — no full code blocks in chat

## Project Overview
- **Name**: Culturer (cultural marketplace app)
- **Type**: React Native app using Expo
- **Main Entry**: expo-router/entry
- **Current Status**: Development setup and iOS simulator configuration
- **Target**: Job-ready by June 2026 (18-month learning journey)

## App Concept - Culturer
A comprehensive cultural marketplace app with the following core features:
- **Authentication**: Login/register with JWT token storage
- **Navigation**: Bottom tabs (Home, Browse, Wishlist, Messages, Profile)
- **Core Screens**:
  - Home: Recently viewed, personalized recommendations
  - Browse: Search, categories, filters for cultural items
  - Wishlist: Saved items with notifications
  - Messages: Real-time chat between users
  - Profile: User info, settings, personal listings
- **Supporting Features**:
  - Item detail screens with actions
  - Add/edit listing functionality
  - Cart and checkout system
  - Settings and preferences

## Tech Stack
- **Framework**: React Native 0.81.4 with Expo SDK 54
- **Router**: Expo Router v6
- **UI**: React Navigation (bottom tabs)
- **Package Manager**: npm

## Key Dependencies
- `expo`: ^54.0.10
- `react`: 19.1.0
- `react-native`: 0.81.4
- `@expo/metro-runtime`: ~6.1.2 (added to fix TurboModule issues)
- `expo-router`: ~6.0.8
- `@react-navigation/bottom-tabs`: ^7.0.0
- `react-native-reanimated`: ~4.1.0
- `react-native-swiper`: ^1.6.0
- `react-native-webview`: 13.15.0

## Issues Resolved
1. **TurboModule PlatformConstants Error**: Fixed by installing missing `@expo/metro-runtime` dependency
2. **Dependency Version Mismatches**: Resolved using `npm install --legacy-peer-deps`
3. **iOS Simulator Setup**: Configured iPhone 15 simulator through Xcode
4. **InPost Courier not working**: Removed `liveShippingApisEnabled` guard from `useCheckoutShipping` — Edge Function returns static rates when no ShipX credentials, so rates always fetch
5. **InPost live rate ID mismatch**: Fixed `inpost-handler` Edge Function to use positional/input-based IDs instead of relying on ShipX to echo back our custom IDs
6. **InPost Locker not appearing at checkout**: Two bugs fixed in `shippingUtils.ts`:
   - `DEFAULT_SHIPPING_CONFIG.origin_country` changed from `''` to `SHIPPING_LAUNCH_COUNTRY` ('Poland')
   - `hydrateShippingConfig` mode-enabled logic now uses `inferredLockerEnabled ? true : savedModes?.locker_pickup?.enabled ?? false` — prevents stale `false` blocking locked defaults
7. **Registry key mismatch**: `normalizeCarrierLookupValue` strips `/` and `()` but registry keys used raw chars — fixed keys to normalized forms: `'inpost locker 24 7'`, `'evri hermes'`, `'dhl servicepoint locker'`
8. **Sendcloud unusable for Poland**: Sendcloud does not accept Poland as origin country — Sendcloud calls are dead weight for current setup, plan to replace with Apaczka

## Development Environment
- **Platform**: macOS (Darwin 23.1.0)
- **Xcode**: 15.4 (Build 15F31d)
- **iOS Simulator**: iPhone 15 (iOS 17.2)
- **Node Package Manager**: npm with legacy peer deps support

## Scripts Available
- `npm start` or `expo start`: Start development server
- `expo start --ios`: Launch iOS simulator
- `expo start --clear`: Start with cleared Metro cache
- `npm run lint`: Run ESLint

## Architecture Notes
- Using Expo Router for navigation
- Bottom tab navigation structure
- TypeScript support configured
- Jest testing setup with expo preset

## Storage & State Considerations Discussed
- **AsyncStorage**: Discussed for persistent storage (user preferences, auth tokens, offline data)
- **iOS Components**: Considered react-native-elements and iOS-native components for better UX
- **Recommendation**: Start with Expo built-ins, add storage when needed for real features

## Learning Timeline (18 months to job-ready)
### Phase 1: Foundation (Weeks 1-4) - Current Focus
- [x] Set up development environment ✅ (DONE)
- [x] Create basic 5-screen app structure (Home, Browse, Wishlist, Message, Profile) ✅ (DONE)
- [x] Implement bottom tab navigation ✅ (DONE)
- [x] Debug routing issues and understand file-based routing ✅ (DONE)
- [x] Set up app entry point with redirect ✅ (DONE)
- [x] Learn basic styling and flexbox ✅ (DONE)
- [ ] Build reusable components (Button, Card) - NEXT FOCUS
- [ ] Add real content to each screen

### Phase 2: Core Features (Weeks 5-8)
- [ ] Build authentication system (login/register forms)
- [ ] Connect to backend API for data
- [ ] Implement state management (Context API/Redux)
- [ ] Display items with FlatList
- [ ] Add search functionality

### Phase 3: Advanced Features (Weeks 9-12)
- [ ] Real-time messaging system
- [ ] Image upload functionality
- [ ] Push notifications
- [ ] Wishlist/favorites system
- [ ] Smooth animations

### Phase 4: Polish & Deploy (Weeks 13-16)
- [ ] Performance optimization
- [ ] Testing (Jest, Detox)
- [ ] App store deployment
- [ ] Analytics and monitoring

## What We've Accomplished ✅
- [x] Set up complete development environment (Xcode, iOS simulator, dependencies)
- [x] Created 5-screen app structure with working navigation
- [x] Implemented bottom tab navigation with FontAwesome icons
- [x] Debugged and fixed routing issues (learned file-based routing)
- [x] Set up proper app entry point with redirect
- [x] Learned Expo Router fundamentals and route groups vs actual routes

## Issues Debugged & Resolved
4. **Unmatched Route Error**: Fixed file name/layout name mismatches (Message.tsx vs "Messages")
5. **Redirect Path Error**: Learned difference between route groups `(tabs)` and actual routes `/Home`

## Shipping Architecture (Current)

### Carriers & APIs
- **InPost Locker 24/7** → InPost ShipX API (`inpost_locker_standard`) ✅ working
- **InPost Home Delivery** → InPost ShipX API (`inpost_courier_standard`) ✅ working
- **DHL / UPS / FedEx / DPD / GLS** → No live rate API yet (show in seller settings but can't quote)
- **Sendcloud** → ❌ Does not support Poland as origin — remove/replace with **Apaczka**
- **Apaczka** (apaczka.pl) → 🔜 Recommended replacement for Sendcloud for Polish sellers

### Static Rates (when no ShipX credentials)
- Locker small/medium/large: PLN 16.49 / 18.49 / 20.49
- Courier small/medium/large: PLN 19.49 / 20.49 / 25.49
- Defined in `supabase/functions/inpost-handler/index.ts`

### Key Files
- `lib/hooks/useCheckoutShipping.ts` — rate fetching, carrier options, locker state
- `lib/shippingUtils.ts` — carrier templates, `hydrateShippingConfig`, locked defaults
- `lib/shippingProviders/registry.ts` — adapter lookup (keys must be normalized forms)
- `supabase/functions/inpost-handler/index.ts` — InPost ShipX proxy + static fallback
- `supabase/functions/sendcloud-handler/index.ts` — unused for Poland
- `app/pickup-points.tsx` — InPost locker picker screen (industry-standard UX)
- `app/profile/seller-shipping.tsx` — seller shipping config screen
- `components/checkout/DeliveryStep.tsx` — checkout carrier selection UI

### Locked Default Providers (Poland)
- Home delivery: InPost Home Delivery, DHL (top 2 from templates)
- Locker pickup: InPost Locker 24/7
- Locked defaults are always forced `enabled: true` regardless of saved config

### Tracking (Planned)
- `getTrackingUrl()` in `shippingUtils.ts` generates external carrier tracking links
- `orders` table has: `tracking_number`, `tracking_url`, `label_url`, `shipping_status`
- Plan: `order_tracking_events` table + webhook edge function (Apaczka/InPost ShipX) + in-app timeline

## Current App Structure
```
app/
├── index.tsx (redirects to /Home)
├── _layout.tsx (main app layout)
├── (tabs)/
│   ├── _layout.tsx (tab navigation with 5 tabs)
│   ├── Home.tsx ✅
│   ├── Browse.tsx ✅
│   ├── Wishlist.tsx ✅
│   ├── Message.tsx ✅
│   └── Profile.tsx ✅
└── (auth)/
    ├── _layout.tsx
    ├── sign-in.tsx
    ├── sign-up.tsx
    └── onboarding.tsx
```

## Environment Variables Required
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
EXPO_PUBLIC_ENABLE_LIVE_SHIPPING_APIS=false   # true in prod
```
Supabase Edge Function secrets (set in Supabase dashboard):
```
INPOST_SHIPX_TOKEN=...
INPOST_SHIPX_ORGANIZATION_ID=...
```
Always restart with `npx expo start --clear` after changing `.env`.

## Next Steps - Shipping
- [ ] Replace Sendcloud with **Apaczka** (`apaczka.pl`) for DPD/DHL/GLS live rates + tracking (Poland)
- [ ] Build `order_tracking_events` table + webhook edge function for live in-app tracking
- [ ] Add tracking timeline UI to `order-details/[id].tsx`
- [ ] Wire up Apaczka for seller label generation on mark-as-shipped flow

## Troubleshooting Notes
- If TurboModule errors occur: ensure `@expo/metro-runtime` is installed
- If iOS simulator fails: check Xcode iOS runtimes are installed
- If dependency conflicts: use `--legacy-peer-deps` flag
- Clear Metro cache with `expo start --clear` for odd build issues

## Git Status
- Current branch: master
- Modified files: package.json, package-lock.json (dependency updates)
- Recent commits focus on package.json fixes and custom components

---
*Last updated: 2025-07-14 — shipping session: InPost locker + courier fixes, pickup point UX*
*This file helps Claude Code understand project context across sessions*