# Project Notes - Claude Code Context

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
- [ ] Set up development environment ✅ (DONE)
- [ ] Create basic 5-screen app structure (Home, Browse, Wishlist, Messages, Profile)
- [ ] Implement bottom tab navigation
- [ ] Learn basic styling and flexbox
- [ ] Build reusable components (Button, Card)

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

## Next Immediate Steps
- [ ] Create basic 5-screen structure with bottom navigation
- [ ] Set up placeholder content for each screen
- [ ] Add basic styling and safe area handling

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
*Last updated: 2025-09-29*
*This file helps Claude Code understand project context across sessions*