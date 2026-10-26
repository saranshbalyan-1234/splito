# Release checklist

Blocking items that must be closed before any public release (public web deploy, TestFlight/App Store, Play Store).

- [ ] **Replace the logo.** The current mark (`assets-owner/logo-owner-provided.svg`) is Bluesky's butterfly trademark, used at the owner's request for development only. Bluesky's ASSETS.md excludes its marks from the MIT licence and app stores reject look-alike apps. Replace it with an original mark in the single logo source file/component and regenerate the brand kit (`apps/client/scripts/brand.ts`).
- [ ] Remove dev-only switches from release builds (EXPO_PUBLIC_DEMO, EXPO_PUBLIC_TOUR) - verify they are inert in production.
- [ ] Real authentication and sync live (no "arrives with sync" placeholders shipped as features).
