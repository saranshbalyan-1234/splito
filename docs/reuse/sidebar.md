# Reuse record - desktop sidebar (owner rules 13, 15, 12)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`) through `createIcon`.

| Splito file / piece | Upstream file / piece | Splito changes |
|---|---|---|
| `src/view/shell/desktop/LeftNav.tsx` - `NavItem` | `src/view/shell/desktop/LeftNav.tsx` - `NavItem` | Splito routes and Lucide glyphs; selection computed once by the nav (for the indicator) and passed in; no soft reset |
| `src/view/shell/desktop/LeftNav.tsx` - `ProfileCard` | `src/view/shell/desktop/LeftNav.tsx` - `ProfileCard` | Opens Splito's account drawer instead of the account-switcher menu; name and "Saved on this device" shown at rest (owner spec) with a chevron in place of the hover-only ellipsis; Bluesky's text sizes (`text_sm` bold, `text_xs`) and `rounded_full` hover |
| `src/view/shell/desktop/LeftNav.tsx` - `ComposeBtn` | `src/view/shell/desktop/LeftNav.tsx` - `ComposeBtn` | "Add expense" with a plus; prefills the open friend or group |
| `src/view/shell/desktop/LeftNav.tsx` - `DesktopLeftNav` | `src/view/shell/desktop/LeftNav.tsx` - `DesktopLeftNav` | `LEFT_NAV_STANDARD_WIDTH` / `LEFT_NAV_MINIMAL_WIDTH` and `p_lg` kept; pinned to the window edge, full height, hairline right border; content scrolls in a `ScrollView`, footer pinned below it; minimal mode hides recent groups and the footer |
| `src/view/shell/desktop/LeftNav.tsx` - `RecentGroups` | `src/view/shell/desktop/Feeds.tsx` - `FeedItem` rows and "More feeds" link | Five groups by latest activity (`sortGroups(..., 'recent')`), 24px group tile, my balance chip (positive / negative tint, compact amount, full amount in the label); "See all" opens Groups; rows inset to the nav glyph column |
| `src/view/shell/desktop/LeftNav.tsx` - `Footer` | `src/view/shell/desktop/RightNav.tsx` - footer links | Help, About, Privacy routes inside Settings instead of external URLs |
| `src/view/shell/desktop/LeftNav.tsx` - `ActiveIndicator` | `src/view/com/pager/TabBar.tsx` - item layouts + animated indicator | Written for Splito (Bluesky's sidebar has none): a 4px bar on the sidebar's left edge springs (Reanimated, UI thread) to the selected item's measured layout; jumps under reduced motion / motion pref |
| `src/view/shell/desktop/composeButtonLayout.ts` | `src/view/shell/desktop/composeButtonLayout.ts` | The labelled pill spans the nav column (owner rule 13) |
| `src/components/brand/Logo.tsx` - `LogoMark`, `withWordmark` | owner-provided `assets-owner/logo-owner-provided.svg` | The mark is the owner-provided SVG path (owner rule 21), always `#1185fe`. **It is Bluesky's butterfly, a Bluesky trademark; the owner chose it for development only and it must be replaced before any public build** (one component, one path constant). The "Splito" wordmark (written) takes the theme text colour (owner rules 15, 20) |
| `src/components/HeaderAvatar.tsx` | `src/components/Layout/Header/index.tsx` (MenuButton) | Renders an empty slot when the sidebar shows (the sidebar card opens the drawer) |
| `src/components/settings/AboutSettings.tsx` - `HelpSettings`, `PrivacySettings` | `src/screens/Settings/AboutSettings.tsx` (screen frame) | Written: short Help and Privacy pages for the footer links (the drawer's Help link landed on "page doesn't exist") |
