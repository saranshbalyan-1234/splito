# Reuse record - shell stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/view/shell/desktop/LeftNav.tsx` | `src/view/shell/desktop/LeftNav.tsx` | Pinned to the window's left edge (no centred column); Splito logo on top; tab items from the `tabs` preference plus Settings; "New post" pill labelled Add expense; account card removed (the account avatar opens the drawer from the top left of each header, see `HeaderAvatar`); no Notifications item (the header bell, see `NotificationsBell`) |
| `src/view/shell/desktop/composeButtonLayout.ts` | `src/view/shell/desktop/composeButtonLayout.ts` | - |
| `src/view/shell/bottom-bar/BottomBar.tsx` | `src/view/shell/bottom-bar/BottomBar.tsx` | Splito tabs from the `tabs` preference (People, Groups, Analytics); no centre button; account switching, chat and badges removed |
| `src/view/shell/bottom-bar/BottomBarWeb.tsx` | `src/view/shell/bottom-bar/BottomBarWeb.tsx` | As BottomBar |
| `src/view/shell/bottom-bar/BottomBarStyles.tsx` | `src/view/shell/bottom-bar/BottomBarStyles.tsx` | - |
| `src/view/shell/createNativeStackNavigatorWithAuth.tsx` | `src/view/shell/createNativeStackNavigatorWithAuth.tsx` | Auth gates removed; main content offset by the sidebar width; footer height reset off phones |
| `src/view/shell/index.tsx` | `src/view/shell/index.tsx` | Composer, global dialogs, OTA and push hooks removed; the drawer (react-native-drawer-layout, as upstream) also opens on tablets from the avatar, swipe only on phones at a tab root |
| `src/view/shell/index.web.tsx` | `src/view/shell/index.web.tsx` | Composer and global dialogs removed; the drawer opens at every width (not only below the tablet breakpoint), with Escape to close and a focus trap (`@radix-ui/react-focus-scope`, as the web Dialog) |
| `src/view/shell/Drawer.tsx` | `src/view/shell/Drawer.tsx` | Profile card shows name and "Saved on this device"; items People, Groups, Analytics, Profile, Settings, Notifications (unread badge); a Dark theme switch (the `theme` preference); footer About (Settings > About) and Help (a short how-it-works prompt); sign-up card, feeds, lists, chat, analytics metrics and invite dialog removed |
| `src/state/shell/drawer-open.tsx` | `src/state/shell/drawer-open.tsx` | Hotkey scope handling removed (Splito has no global hotkeys) |
| `src/components/TabBar.tsx` | `src/view/com/pager/TabBar.web.tsx` | Used on every platform without the Pager: a press switches the tab; no horizontal scroller or drag-following indicator (two short tabs always fit) |
| `src/components/NotificationsBell.tsx` | `src/view/shell/bottom-bar/BottomBar.tsx (Btn notification badge)` | Bluesky's bell with its unread badge as a header icon button on every top-level page; counts only unread changes by other people |
| `src/components/Composer/index.tsx` | `src/view/shell/Composer.tsx` | A route body (the stack presents it like the composer modal) instead of a state-driven overlay |
| `src/components/Composer/index.web.tsx` | `src/view/shell/Composer.web.tsx` | Rendered through the shell portal from the `/expense/new` route; fills the height on phones |
| `src/components/Composer/TopBar.tsx` | `src/view/com/composer/Composer.tsx (ComposerTopBar)` | Cancel / Save pill only (drafts, thread and publishing stages removed) |
| `src/view/com/util/fab/FAB.tsx` | `src/view/com/util/fab/FAB.tsx` | - |
| `src/view/com/util/fab/FAB.web.tsx` | `src/view/com/util/fab/FAB.web.tsx` | - |
| `src/view/com/util/fab/FABInner.tsx` | `src/view/com/util/fab/FABInner.tsx` | - |
| `src/state/shell/minimal-mode.tsx` | `src/state/shell/minimal-mode.tsx` | - |
| `src/lib/hooks/useMinimalShellTransform.ts` | `src/lib/hooks/useMinimalShellTransform.ts` | - |
| `src/state/shell/index.tsx` | `src/state/shell/index.tsx` | Drawer, onboarding and color-mode providers removed |
| `src/state/shell/tick-every-minute.tsx` | `src/state/shell/tick-every-minute.tsx` | - |
| `src/navigation/Navigation.tsx` | `src/Navigation.tsx` | Splito route table; tablets put the sidebar beside content; Add expense presented as the composer |
| `src/routes.ts` | `src/routes.ts` | Splito route table (`ROUTE_PATHS`), shared with both linking configs |
| `src/lib/routes/router.ts` | `src/lib/routes/router.ts` | - |
| `src/lib/routes/helpers.ts` | `src/lib/routes/helpers.ts` | Splito tab names |
| `src/lib/hooks/useNavigationTabState.ts` | `src/lib/hooks/useNavigationTabState.ts` | Splito tab names |
| `src/lib/hooks/useNavigationDeduped.ts` | `src/lib/hooks/useNavigationDeduped.ts` | - |
| `src/lib/hooks/useDedupe.ts` | `src/lib/hooks/useDedupe.ts` | - |
| `src/lib/hooks/useWebMediaQueries.tsx` | `src/lib/hooks/useWebMediaQueries.tsx` | - |
| `src/lib/hooks/useWebScrollRestoration.ts` | `src/lib/hooks/useWebScrollRestoration.ts` | - |
| `src/lib/hooks/useWebScrollRestoration.native.ts` | `src/lib/hooks/useWebScrollRestoration.native.ts` | - |
| `src/lib/hooks/useTimeAgo.ts` | `src/lib/hooks/useTimeAgo.ts` | - |
| `src/lib/numbers.ts` | `src/lib/numbers.ts` | - |
| `src/lib/constants.ts` | `src/lib/constants.ts (subset)` | Subset |
| `src/alf/breakpoints.ts` | `src/alf/breakpoints.ts` | Labels from 1000px, icon rail 800-999px; no right rail or centre offset |
| `src/alf/breakpoints.shared.ts` | `src/alf/breakpoints.shared.ts` | As above; tablet content is never centred |
| `src/alf/themes.ts` | `src/alf/themes.ts` | Bluesky blue default; emerald optional accent |
| `src/components/Layout/index.tsx` | `src/components/Layout/index.tsx` | `Center` is full width; centre-column borders removed |
| `src/components/Layout/Header/index.tsx` | `src/components/Layout/Header/index.tsx` | Full width (no centre-column max width or offset) |
| `src/components/FeedCard.tsx` | `src/components/FeedCard.tsx` | - |
| `src/screens/Groups/components/GroupRow.tsx` | `src/components/FeedCard.tsx (list card layout)` | Group row: square avatar, title, byline, balance per currency |
| `src/components/ProfileCard.tsx` | `src/components/ProfileCard.tsx` | Takes a local name instead of an AT Protocol profile |
| `src/components/Pills.tsx` | `src/components/Pills.tsx` | - |
| `src/components/Fill.tsx` | `src/components/Fill.tsx` | - |
| `src/components/MediaInsetBorder.tsx` | `src/components/MediaInsetBorder.tsx` | - |
| `src/components/SubtleHover.tsx` | `src/components/SubtleHover.tsx` | - |
| `src/components/HeaderAvatar.tsx` | `src/components/Layout/Header/index.tsx (MenuButton)` | The 32px account avatar in the menu button's place at the left of each top-level header; it opens the drawer at every width |
| `src/screens/Profile.tsx` | `src/screens/Settings/Settings.tsx` | Profile page, opened from the header avatar menu (back button header): account block, Analytics / Settings / About rows, sign-in row marked "Coming with sync" |
| `src/screens/Settings/components/SettingsList.tsx` | `src/screens/Settings/components/SettingsList.tsx` | `LinkItem` built on `#/view/com/util/Link` |
| `src/view/com/home/HomeHeaderLayout.tsx` | `src/view/com/home/HomeHeaderLayout.tsx` | - |
| `src/view/com/home/HomeHeaderLayout.web.tsx` | `src/view/com/home/HomeHeaderLayout.web.tsx` | Desktop drops the centred logo (the sidebar carries it); the row holds the account avatar at the right |
| `src/view/com/home/HomeHeaderLayoutMobile.tsx` | `src/view/com/home/HomeHeaderLayoutMobile.tsx` | Drawer button removed; the feeds button's slot holds the account avatar |
| `src/view/com/util/EmptyState.tsx` | `src/view/com/util/EmptyState.tsx` | Optional animated `Illustration` in place of the icon |
| `src/view/com/util/Link.tsx` | `src/view/com/util/Link.tsx` | App routes only |
| `src/view/com/util/PressableWithHover.tsx` | `src/view/com/util/PressableWithHover.tsx` | - |
| `src/view/com/util/TimeElapsed.tsx` | `src/view/com/util/TimeElapsed.tsx` | - |
| `src/view/com/util/UserAvatar.tsx` | `src/view/com/util/UserAvatar.tsx` | Initials instead of images and licensed glyphs |
| `src/view/com/util/WebAuxClickWrapper.tsx` | `src/view/com/util/WebAuxClickWrapper.tsx` | - |
| `src/locale/i18n.ts` | `src/locale/i18n.ts` | English and Hindi compiled catalogs only |
| `lingui.config.ts` | `lingui.config.ts` | `en`, `hi`; English fallback |
