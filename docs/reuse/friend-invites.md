# Reuse record - friend-invites stream (ARCHITECTURE 26.18)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every copied or adapted file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC) through `createIcon`; no Bluesky glyphs,
illustrations, logos or `assets/images` are copied (Bluesky's QR code embeds its PNG logo and the chat-invite
dialog a WebP illustration: neither is used; the QR centre is Splito's one `LogoMark`).

Dependencies taken from Bluesky's `package.json` at the same versions: `expo-contacts` (^58), `expo-clipboard`
(~58), `react-native-qrcode-styled` (^0.3.3), `libphonenumber-js` (^1.12, in `packages/sync`: `packages/domain` imports nothing, ARCHITECTURE 1).

## Copied / adapted files

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/invites/CopyTextButton.tsx` | `src/screens/Messages/components/CopyTextButton.tsx` | `useReducedMotion` -> Splito's `useShouldReduceMotion` (also honours the motion pref); no `useCallback` (React Compiler); Lucide copy glyph |
| `src/components/invites/InviteQrCode.tsx` | `src/components/StarterPack/QrCode.tsx` (`QrCodeInner`) | Same `react-native-qrcode-styled` styling (rounded pieces, accent eyes); error correction H with the accent `LogoMark` on a tile over the centre instead of the PNG logo; palette tokens only |
| `src/components/invites/InviteShare.tsx` | `src/screens/Messages/components/InviteLinkDialog.tsx` (Step.MANAGE: copy field + `StackedButton` row) and `src/components/StarterPack/QrCodeDialog.tsx` | QR above the copy field; Share via `lib/sharing`; optional "Send SMS / Send email" for a personal invite |
| `src/lib/sharing.ts` | `src/lib/sharing.ts` | No `expo-bluesky-swiss-army` (not shipped): RN `Share` on native, Web Share API or copy + toast on web; `openComposeLink` for `sms:` / `mailto:` |
| `src/screens/Invites/CreateInvite.tsx` | `src/screens/Messages/components/InviteLinkDialog.tsx` (Step.GENERATE -> Step.MANAGE) | A FormSheet route (26.8 layout) instead of a Dialog; options are max uses / expiry segmented controls and an approve-joins switch instead of join rules; fails closed offline (ARCHITECTURE 10) |
| `src/screens/Invites/InviteLinks.tsx` | `src/screens/Messages/JoinRequests.tsx` (rows with inline actions) and `InviteLinkDialog.tsx` (Step.CONFIRM_DISABLE copy) | A list of links (uses left, expiry) with QR, Copy and Revoke; revoke confirm is Bluesky `Prompt` (bottom sheet on phones) |
| `src/screens/Invites/Invite.tsx` | `src/screens/Messages/JoinRequest.tsx` (Wrapper card, preview, broken-link state) | In-app pushed page; Accept / Decline instead of Sign in / Create account; own-link and offline states |
| `src/screens/People/components/RequestsSection.tsx` | `src/screens/Messages/JoinRequests.tsx` (avatar, name, Accept / Reject buttons) | Incoming rows keep Bluesky's layout; Invites sent rows are compact (one line, round Resend and X) |
| `src/screens/AddFriend.tsx` | `src/components/contacts/screens/GetContacts.tsx` (permission check, denied alert -> primer, `expo-contacts/legacy`), `src/components/contacts/screens/PhoneInput.tsx` (one field, live validation) | One field for email or mobile; primer, which-one and invite are steps inside the sheet (one native modal, ARCHITECTURE 4) |
| `src/components/people/contactPicker/index.ts` | `src/components/contacts/screens/GetContacts.tsx` (`Contacts.getPermissionsAsync` / `requestPermissionsAsync`) | `presentContactPickerAsync` (one contact) instead of reading the whole book |
| `packages/sync/src/contact.ts` (parse, check, format; the `Contact` shape, kind detection and key stay in `packages/domain/src/contact.ts`) | `src/components/contacts/phone-number.ts` (`normalizePhoneNumber`) | Email or phone auto-detect; E.164 with region default; `libphonenumber-js` default (min) metadata instead of `/max` to keep the bundle small (so mobile-vs-landline type is not checked) |
| `app.config.ts` (`expo-contacts` plugin) | `app.config.js` | Splito's own permission string |

## Layouts followed (Splito code, Bluesky structure)

| Splito file | Bluesky source of the layout |
|---|---|
| `src/components/activity/ActivityItem.tsx` friend-request rows | `src/view/com/notifications/NotificationFeedItem.tsx` (`FollowBackButton` under a follow notification); Splito renders the buttons as a sibling of the row's pressable (ARCHITECTURE 2) |
| `src/components/people/PendingPeople.tsx` | `src/components/ProfileCard.tsx` row, disabled and muted |
| People header overflow, Group overflow item | `src/screens/Group` header Menu (itself Bluesky `Menu`) |

## Written from scratch (no Bluesky equivalent)

- `packages/sync/src/friends.ts`, `packages/sync/src/directory.ts`: friend requests, invite links, the directory
  client (Bluesky's follow graph and chat join links live on its server; Splito keeps them in the local store and
  outbox).
- `src/data/friends.ts`: the directory client choice (demo or offline), invite-link minting and URLs. Request and link reads are `data/hooks` projections (`useFriendRequests`, `usePendingRequests`, `useInviteLinks`, `useSortedInviteLinks`, `useAnswerFriendRequest`), so components never import `data/friends` (ARCHITECTURE 1 layer rule).
- `src/components/invites/describe.ts`: uses-left and expiry wording.
