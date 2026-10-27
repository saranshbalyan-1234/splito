# Reuse record - feedback stream (F-226)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`. Icons are Lucide (ISC); no Bluesky glyphs, illustrations, logos or
`assets/images` are copied.

## Bluesky search

Searched `src/` for feedback, shake and image-picker code. Bluesky's Feedback is only a footer button / drawer item
that opens an external form (`src/view/shell/Drawer.tsx` `onPressFeedback`, `FEEDBACK_FORM_URL`) and a footer link in
`src/view/shell/desktop/RightNav.tsx`; it has no in-app form, no list and no shake gesture. Its image picker
(`src/lib/media/picker.shared.ts`, `picker.web.tsx`) is the model for attaching a picture.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/features/feedback/pickAttachment.ts` | `src/lib/media/picker.shared.ts` (`openPicker`) | One image from the library; `base64: true` and `quality: 0.5` so the picture is stored inside the feedback record as a data URI (the picker's cache file can be purged); size cap and a typed result instead of Bluesky's `Toast` inside the picker |
| `src/features/feedback/pickAttachment.web.ts` | `src/lib/media/picker.web.tsx` / `picker.shared.ts` | Bluesky's web picker is expo-image-picker's file input; this uses a plain file input, then scales to 1280 px and re-encodes to JPEG on a canvas (blob URLs die with the tab) |

The drawer footer button (`navigation/Drawer.tsx`) follows Bluesky's `DrawerFooter` Feedback button (message icon,
`secondary` solid small button); its action opens the in-app sheet instead of a URL.

## Written for Splito (no Bluesky equivalent)

`src/features/feedback/FeedbackSheet.tsx` (on the shared `FormSheet`), `FeedbackList.tsx`, `FeedbackProvider.tsx`
(one global sheet, mounted in the shell as Bluesky mounts its global dialogs), `useShake.ts` (expo-sensors
accelerometer), `email.ts`, `appInfo.ts`, `userAgent.ts`, `labels.ts`, `attachment.ts`;
`packages/sync/src/feedback.ts` (entity, whitelist of app info, `mailto:` draft).

## Edited shared files

`navigation/Drawer.tsx` (Feedback footer button), `screens/Settings/index.tsx` (Support section, "About and data"
renamed "Data"), `screens/Settings/SettingsSection.tsx` (`/settings/feedback` page),
`components/settings/prefControls.tsx` (`shakeToFeedback` row, `feedback.includeAppInfo` has none),
`view/shell/index.tsx` + `index.web.tsx` (`FeedbackProvider`), `state/session.ts` (account type gains `email`),
`env/common.ts` (`FEEDBACK_EMAIL`), `packages/sync/src/{mutations,types,index,preferences}.ts`.
