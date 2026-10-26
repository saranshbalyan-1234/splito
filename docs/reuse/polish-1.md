# Reuse record - polish-1 (design-judge fixes, ui/r1-polish-1)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`) through `createIcon`.

| Splito file / piece | Upstream file / piece | Splito changes |
|---|---|---|
| `src/screens/SignIn.tsx` | `src/screens/Login/LoginForm.tsx`, `src/screens/Login/FormContainer.tsx` | Label-over-field layout, `TextField.Icon`, Admonition, large Back / Next buttons kept; steps are method -> email or phone -> 6-digit code; no auth server, so each path ends on an honest "Sign-in arrives with sync" Admonition and nothing claims a code was sent |
| `src/state/session.ts` | `src/state/session` (`useSession().hasSession`) | Hook shape only; always signed out until the auth backend (BACKLOG F-2101..F-2105) |
| `src/navigation/Drawer.tsx` - `MenuItem` badge | `src/view/shell/Drawer.tsx` - `MenuItem` count badge | Copied verbatim (inset, `align_end`, top -4, right offset by count length) |
| `src/navigation/Drawer.tsx` - footer | `src/view/shell/Drawer.tsx` - `ExtraLinks` footer | Adds "Sign in" (primary) while signed out; Help and About share one solid secondary style; hairline above |
| `src/screens/Settle/index.tsx` - footnote | `#/components/Admonition` (Bluesky) | The "Splito never moves money" note is an info Admonition |
| `src/components/BalanceText.tsx` - `SettledPill` | `src/components/Pills.tsx` - pill shape | Muted rounded pill with a check for a settled balance |
| `src/components/activity/ActivityItem.tsx` - row "..." | `src/view/com/notifications/NotificationFeedItem.tsx` (always-visible overflow) | The menu button is visible on every platform; web quick actions still fade in on hover |

Written from scratch (no Bluesky equivalent):

- `packages/domain/src/adjustments.ts` (percent charges, money), `packages/domain/src/contact.ts` (sign-in field checks), `groupTotals` and `assignedFraction` - money and validation rules live in the domain.
- `src/components/Dialog/drawerDismiss.ts` - the phone drawer's close decision as one pure, unit-tested function (the drawer itself is preview-shell's, see `preview-shell.md`).
- Itemize charge rows (amount / % segmented toggle uses Bluesky's `SegmentedControl`), the split progress bar (Reanimated width), Overview currency chip and per-cell captions, group tile initials with a kind badge (the badge follows Bluesky's notification avatar badge).
