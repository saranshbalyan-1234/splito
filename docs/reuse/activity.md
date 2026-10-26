# Reuse record - activity stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied. Merge these rows into `docs/REUSE_MAP.md`.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/activity/ActivityItem.tsx` | `src/screens/Notifications/components/NotificationItem/Item/Root.tsx`, `Item/Avatar.tsx`, `Item/text.tsx` (Notifications v2 row); actions pattern from `src/screens/Messages/components/ChatListItem.tsx` | One row per change in the local audit history. Avatar is initials (no photos), so the kind badge is 20px (upstream 24) and sits further out on the corner, clear of the letters; badge tones are primary or neutral only (green/red are kept for money direction). A muted money line (total, group, "you lent/borrowed" coloured by direction) replaces the post preview. Unread rows keep upstream's tint and add the chat list's 8px unread dot. Swipe actions come from the `swipeLeft`/`swipeRight` preferences; web shows them as hover/focus buttons plus a "More actions" menu (always visible on phones and touch screens, as the chat list's menu); native long-press opens the same menu as a bottom sheet; screen-reader actions on native. Times are relative today and the time of day under earlier day headers |
| `src/components/activity/LoadingSkeleton.tsx` | `src/screens/Notifications/components/NotificationItem/LoadingSkeleton.tsx` | One skeleton kind (badged avatar, headline, money line, time) matching the Splito row |
| `src/components/activity/SectionHeader.tsx` | `src/screens/Notifications/components/PageList.tsx` (`SectionHeader`, `getBorderColor`) | One header per local day (Today, Yesterday, weekday, then date) instead of Today / Earlier |
| `src/lib/custom-animations/GestureActionView.tsx` | `src/lib/custom-animations/GestureActionView.tsx` | Fixes upstream's right swipe: release tested `hitSecond` for the first action, so a right swipe with only a first action never fired |
| `src/lib/custom-animations/GestureActionView.web.tsx` | `src/lib/custom-animations/GestureActionView.web.tsx` | - |
| `src/lib/custom-animations/GestureActionView.shared.ts` | `src/lib/custom-animations/GestureActionView.shared.ts` | - |

Removed: `src/view/com/notifications/NotificationFeedItem.tsx` (the legacy v1 row the shell stream adapted); Activity now uses the v2 row above.

Not copied: Bluesky's notification badge glyphs (licensed Central icons; Lucide used instead), `PreviewableUserAvatar` hover cards, follow buttons, post embeds, the refresh pill and the tab pager (Splito's feed is local, so there is nothing to refresh or page).
