# Reuse record - shell stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/view/shell/desktop/LeftNav.tsx` | `src/view/shell/desktop/LeftNav.tsx` | Pinned to the window's left edge (no centred column); Splito logo on top; tab items from the `tabs` preference plus Settings; "New post" pill labelled Add expense; account card removed (the account avatar sits at the top left of the content and opens the drawer, see `preview-shell.md`); no Activity item |
| `src/view/shell/desktop/composeButtonLayout.ts` | `src/view/shell/desktop/composeButtonLayout.ts` | - |
| `src/view/shell/bottom-bar/BottomBar.tsx` | `src/view/shell/bottom-bar/BottomBar.tsx` | Splito tabs from the `tabs` preference; no centre button; account switching, chat and badges removed |
| `src/view/shell/bottom-bar/BottomBarWeb.tsx` | `src/view/shell/bottom-bar/BottomBarWeb.tsx` | As BottomBar |
| `src/view/shell/bottom-bar/BottomBarStyles.tsx` | `src/view/shell/bottom-bar/BottomBarStyles.tsx` | - |
| `src/view/shell/createNativeStackNavigatorWithAuth.tsx` | `src/view/shell/createNativeStackNavigatorWithAuth.tsx` | Auth gates removed; main content offset by the sidebar width; footer height reset off phones |
| `src/view/shell/index.tsx` | `src/view/shell/index.tsx` | Composer, global dialogs, OTA and push hooks removed (drawer: see `preview-shell.md`) |
| `src/view/shell/index.web.tsx` | `src/view/shell/index.web.tsx` | As above |
| `src/components/Composer/index.tsx` | `src/view/shell/Composer.tsx` | A route body (the stack presents it like the composer modal) instead of a state-driven overlay |
| `src/components/Composer/index.web.tsx` | `src/view/shell/Composer.web.tsx` | Rendered through the shell portal from the `/expense/new` route; fills the height on phones |
| `src/components/Composer/TopBar.tsx` | `src/view/com/composer/Composer.tsx (ComposerTopBar)` | Cancel / Save pill only (drafts, thread and publishing stages removed) |
| `src/view/com/util/fab/FAB.tsx` | `src/view/com/util/fab/FAB.tsx` | - |
| `src/view/com/util/fab/FAB.web.tsx` | `src/view/com/util/fab/FAB.web.tsx` | - |
| `src/view/com/util/fab/FABInner.tsx` | `src/view/com/util/fab/FABInner.tsx` | - |
| `src/state/shell/minimal-mode.tsx` | `src/state/shell/minimal-mode.tsx` | - |
| `src/lib/hooks/useMinimalShellTransform.ts` | `src/lib/hooks/useMinimalShellTransform.ts` | - |
| `src/state/shell/index.tsx` | `src/state/shell/index.tsx` | Onboarding and color-mode providers removed (drawer: see `preview-shell.md`) |
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
| `src/components/Layout/Header/index.tsx` | `src/components/Layout/Header/index.tsx` | Full width (no centre-column max width or offset); header rule set in `preview-shell.md` |
| `src/components/FeedCard.tsx` | `src/components/FeedCard.tsx` | - |
| `src/screens/Groups/components/GroupRow.tsx` | `src/components/FeedCard.tsx (list card layout)` | Group row: square avatar, title, byline, balance per currency |
| `src/components/ProfileCard.tsx` | `src/components/ProfileCard.tsx` | Takes a local name instead of an AT Protocol profile |
| `src/components/Pills.tsx` | `src/components/Pills.tsx` | - |
| `src/components/Fill.tsx` | `src/components/Fill.tsx` | - |
| `src/components/MediaInsetBorder.tsx` | `src/components/MediaInsetBorder.tsx` | - |
| `src/components/SubtleHover.tsx` | `src/components/SubtleHover.tsx` | - |
| `src/screens/Profile.tsx` | `src/screens/Settings/Settings.tsx` | Profile page, opened from the drawer (back button header): account block, Analytics / Settings / About rows, sign-in row marked "Coming with sync" |
| `src/screens/Settings/components/SettingsList.tsx` | `src/screens/Settings/components/SettingsList.tsx` | `LinkItem` built on `#/view/com/util/Link` |
| `src/view/com/notifications/NotificationFeedItem.tsx` | `src/view/com/notifications/NotificationFeedItem.tsx` | Notifications rows with Bluesky's unread tint; list enter/exit animations; loading row adapted from `src/view/com/util/LoadingPlaceholder.tsx` (NotificationLoadingPlaceholder) with a neutral circle for its licensed glyph |
| `src/view/com/util/EmptyState.tsx` | `src/view/com/util/EmptyState.tsx` | Optional animated `Illustration` in place of the icon |
| `src/view/com/util/Link.tsx` | `src/view/com/util/Link.tsx` | App routes only |
| `src/view/com/util/PressableWithHover.tsx` | `src/view/com/util/PressableWithHover.tsx` | - |
| `src/view/com/util/TimeElapsed.tsx` | `src/view/com/util/TimeElapsed.tsx` | - |
| `src/view/com/util/UserAvatar.tsx` | `src/view/com/util/UserAvatar.tsx` | Initials instead of images and licensed glyphs |
| `src/view/com/util/WebAuxClickWrapper.tsx` | `src/view/com/util/WebAuxClickWrapper.tsx` | - |
| `src/locale/i18n.ts` | `src/locale/i18n.ts` | English and Hindi compiled catalogs only |
| `lingui.config.ts` | `lingui.config.ts` | `en`, `hi`; English fallback |
