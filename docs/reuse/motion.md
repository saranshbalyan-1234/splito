# Reuse record: motion and brand kit

Stream: motion (2026-10-26). Merge these rows into `docs/REUSE_MAP.md`.

Pinned sources:

- Bluesky `bluesky-social/social-app` at `4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT, `LICENSES/bluesky-social-app.txt`).
- Expensify `Expensify/App` at `a60491fded4b38f6c379d00f36b58f98ce79801c` (MIT, `LICENSES/expensify-app.txt`), read from a sparse clone. Nothing was vendored.

## Copied or adapted code

| Upstream path | Destination | Modification | License |
|---|---|---|---|
| bluesky-social/social-app@4e4ad9c `src/lib/custom-animations/PressableScale.tsx` | `apps/client/src/motion/PressableScale.tsx` | Reduced motion comes from `useShouldReduceMotion` (the OS setting plus the Animations preference) instead of Reanimated's `useReducedMotion`. Behaviour (0.98 scale on touch, 100 ms timing) is unchanged. `usePressScale` exposes the same shrink for rows and cards that are already `Link`s. Replaces the shell's copy at `src/lib/custom-animations/PressableScale.tsx`. | MIT |
| Expensify/App@a60491f `src/components/Lottie/index.tsx` | `apps/client/src/motion/Illustration/index.tsx` | Kept from Expensify: pause on navigation `blur` and resume on `focus`; an empty box of the same size when the animation fails; no autoplay under reduce motion. Added: a fixed `staticFrame` under reduce motion. Dropped: splash state, app state, network, interaction and side-modal gating, which Splito does not have. | MIT |
| Expensify/App@a60491f `src/components/Lottie/index.tsx` | `apps/client/src/motion/Illustration/index.web.tsx` | Same behaviour as the native file, but it renders with `lottie-web` (light SVG build) instead of lottie-react-native's dotLottie web player, which loads its WASM from a CDN and so breaks the offline PWA. Adds `data-testid` and `data-static`. | MIT |

## Patterns and values (no code copied)

| Source | Where it is used | What was taken | License |
|---|---|---|---|
| Expensify/App@a60491f `src/components/LottieAnimations/index.tsx` | `apps/client/src/motion/illustrations.ts` | The idea of one typed registry of animations with their metadata. | MIT |
| Expensify/App@a60491f `src/components/LoadingBar.tsx` | `apps/client/src/motion/Shimmer.tsx`, `apps/client/scripts/lottie.ts` (`EASE.inOut`) | The easing curve `cubic-bezier(0.65, 0, 0.35, 1)`. | MIT |
| Bluesky upstream idiom (`entering={FadeIn}`, `exiting={FadeOut}`, `layout={native(LinearTransition)}`, used across `src/`) | `apps/client/src/motion/listAnimations.ts` | The choice of presets, and layout transitions on native only. | MIT |
| `@bsky.app/alf` `dist/palette.js` (primary_500) | `apps/client/scripts/lottie.ts` (`VARIANTS.light`), `apps/client/scripts/brand.ts` (`BLUE`) | The brand blue `#006AFF`. Lottie tints mix it with white, which reproduces primary_400/300/200 exactly. | MIT |

## Used in place (already in the tree, not copied by this stream)

| Upstream path | Splito path | Used by |
|---|---|---|
| bluesky-social/social-app@4e4ad9c `src/components/anim/AnimatedCheck.tsx` | `apps/client/src/components/anim/AnimatedCheck.tsx` | `apps/client/src/motion/SuccessCheck.tsx` wraps it and adds `useHaptics().success()`. |

## Original Splito work (no upstream)

- `apps/client/scripts/brand.ts` and every PNG/SVG it writes: `apps/client/assets/brand/*.png`, `apps/client/public/*.png`, `apps/client/public/icons/*.png`, `apps/client/public/splash-mark*.svg`, `apps/client/public/manifest.json`. All are rendered from the four approved mark files (`apps/client/assets/brand/mark.svg`, `mark-white.svg`, `mark-dark.svg`, `mark-black.svg`), placed as-is; one-colour targets use `mark-dark.svg` as a luminance mask so the features stay knocked out.
- `apps/client/scripts/lottie.ts` and `apps/client/assets/lottie/*.json`: hand-built Lottie JSON, with `meta.g = "splito/scripts/lottie.ts"`. Each animation ships as `<name>.json` (blue and white) and `<name>-dark.json` (white and black). The `loading` animation draws the cat from `mark.svg`'s own paths.

## Third-party artwork

| Source | Splito path | Modification | License |
|---|---|---|---|
| Lucide `cat` icon (lucide-static v1.61.0) | `apps/client/assets/brand/mark*.svg`, `loading` in `apps/client/scripts/lottie.ts` | Filled, recoloured (blue and white, or black and white), eyes and nose knocked out. | ISC (`LICENSES/lucide.txt`) |
- `apps/client/src/motion/amountSteps.ts`, `AnimatedAmount/`, `Shimmer.tsx`, `useShouldReduceMotion.ts`, `listAnimations.ts`.

## Not copied (license or trademark)

- No Expensify `.lottie` or `.json` animation files, illustrations or images (`assets/animations/`, `assets/images/`).
- No Bluesky butterfly, logos, icon glyphs, `assets/` artwork, or the `src/Splash.tsx` logo path.

Expensify animations worth asking Expensify to license (their artwork is not covered by the MIT code license): `Fireworks` (expense saved, settle-up recorded), `FastMoney` and `Coin` (payments), `Safe`, `BankVault` and `Fingerprint` (PIN and biometric lock), `Plane` and `TripsEmptyState` (trips), `WorkspacePlanet` (groups), `PreferencesDJ` (settings), `ReviewingBankInfo` (sync in progress), `Hands` (invites).

## Studied, not adopted

- `src/components/IllustratedHeaderPageLayout.tsx` and `HeaderPageLayout.tsx`: these are tied to Expensify's page layout. Splito's `screens/EmptyState.tsx` plus `<Illustration>` cover the same need.
- `src/components/SkeletonViewContentLoader/*`: this needs `react-content-loader`. `Shimmer` pulses Bluesky's `Skeleton` blocks on the UI thread, with no new dependency.
- `src/components/ConfirmationPage/*`: a full-page success flow. `SuccessCheck` plus the `success` illustration let screens build the same thing.

## New dependency

| Package | Version | License | Why |
|---|---|---|---|
| `lottie-web` | 5.12.2 | MIT | Web Lottie player that works offline (see the Illustration row above). Native still uses `lottie-react-native` 7.5.0 (Apache-2.0), which was already a dependency. |
