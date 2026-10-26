# Reuse record - preview shell (avatar drawer, header rule set, Activity tab)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`) through
`createIcon`; no Bluesky glyphs, illustrations, logos or `assets/images` are copied. New
dependency: `react-native-drawer-layout@5.0.0-alpha.19` (MIT, React Navigation), the version
Bluesky pins, for the native drawer.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/navigation/Drawer.tsx` | `src/view/shell/Drawer.tsx` | Account card shows name, "Saved on this device" and friend / group counts (no handle or followers); rows People, Groups, Analytics, Activity (Bluesky's unread count from its Notifications row), Profile, Settings, then a Dark theme switch (the `theme` preference); footer Help and About in place of Feedback and Help; filled glyph and bold label for the current page; no invite, OTA notice, sign-up card or extra links |
| `src/state/shell/drawer-open.tsx` | `src/state/shell/drawer-open.tsx` | - |
| `src/state/shell/index.tsx` | `src/state/shell/index.tsx` | Drawer-open provider mounted; drawer-swipe, onboarding and color-mode providers still removed |
| `src/view/shell/index.web.tsx` | `src/view/shell/index.web.tsx` | Drawer layout kept and shown at every width (the avatar opens it on desktop too); focus trap and Escape (Radix, as Splito's web dialogs); scrim above the sticky headers; no slide under reduced motion |
| `src/view/shell/index.tsx` | `src/view/shell/index.tsx` | `react-native-drawer-layout` drawer kept; opens at every width, swipe-to-open on phones at a tab root only |
| `src/components/HeaderAvatar.tsx` | `src/components/Layout/Header/index.tsx (MenuButton)` | The account avatar (32px) in the hamburger's slot; opens the drawer |
| `src/components/Layout/Header/index.tsx` | `src/components/Layout/Header/index.tsx` | Title centred on every platform; `Sticky` wrapper that hides on scroll on phones; `ActionButton` for a page's one header action; `MenuButton` replaced by `HeaderAvatar`; title / subtitle take a test ID |
| `src/components/Layout/MainScrollProvider.tsx` | `src/view/com/util/MainScrollProvider.tsx` | One header mode per screen (mounted by `Layout.Screen`) instead of Home's; native slides the in-flow header with a margin; listener set in place of EventEmitter |
| `src/components/TabBar.tsx` | `src/view/com/pager/TabBar.web.tsx` | Fixed row of equal tabs (no scroller), same on native; the tabs split the full content width beside the sidebar; optional per-tab test IDs |
| `src/screens/Activity.tsx` | `src/view/screens/Notifications.tsx` | Named Activity, a tab at `/activity` (`/notifications` redirects); avatar / "Activity" / Mark all read header with the tabs inside the sticky header; tabs All and From others filter one list (no pager); rows, day sections, read state and swipe actions from `#/components/activity` (see `activity.md`) |
| `src/components/Dialog/drawer.web.tsx` | `src/components/Lightbox/pager/ImagePager.tsx` (dismiss swipe), `src/components/Dialog/index.tsx` (Handle) | Web phone drawer (below 800px) shared by Dialog, Prompt, FormSheet, Menu and the composer route: rises on Bluesky's `DISMISS_CANCEL_SPRING`, handle drag via pointer events and Reanimated shared values, closes past 30% of its height or on a downward flick (through the dialog's close, so "Discard changes?" still asks), scrim follows the sheet, sits above the browser keyboard (`visualViewport`), safe-area bottom padding; reduced motion fades in and closes at once |
| `src/components/Dialog/index.web.tsx` | `src/components/Dialog/index.web.tsx` | Below 800px `Inner` is the bottom drawer (handle, drag to close, slide-out before unmount, close callbacks after it); centred popup from 800px up |
| `src/components/Menu/index.web.tsx` | `src/components/Menu/index.web.tsx`, `src/components/Menu/index.tsx` | Below 800px the menu opens in the Dialog drawer with Bluesky's native rows and groups instead of the Radix dropdown |
| `src/components/Composer/index.web.tsx` | `src/view/shell/Composer.web.tsx` | Below 800px the composer route (Add / Edit expense, Add friend, New group) is the same drawer |
