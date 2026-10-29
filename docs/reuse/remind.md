# Reuse record - remind stream (F-1118, F-1119, F-1907)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT) and
`Expensify/App@44387bc7` (MIT). Paths are relative to `apps/client/`. Icons are Lucide (ISC); no Bluesky or
Expensify glyphs, illustrations or logos are copied.

## Bluesky and Expensify search

Searched Bluesky `src/lib/notifications/`, `src/lib/hooks/usePermissions.ts` and
`src/screens/Settings/NotificationSettings/`, and Expensify `src/libs/Notification/LocalNotification/`.
Bluesky's notifications are push-token registration with a server; Expensify's local notifications are a
no-op on mobile and a browser `Notification` on web. Neither schedules a local notification for a later time, so
scheduling, the plan and the web ticker are written for Splito.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/lib/notifications/index.ts` | `src/lib/notifications/notifications.ts` (expo-notifications import, permission calls) | No push token or server call; local scheduling (date, daily, weekly, monthly triggers), the Android channel, tap and arrival listeners |
| `src/features/remind/TimeField.web.tsx` | `src/components/forms/DateField/index.web.tsx` | The same `unstable_createElement` input, with `type="time"` and a plain `HH:MM` string |

The permission primer follows Bluesky's `usePermissions.ts` shape (ask only when needed, a denied state with
Open Settings) in `src/lib/notifications/usePermission.ts` and `src/features/remind/RemindMeSheet.tsx`.
Expensify's `BrowserNotifications.ts` is the model for `showNow` in `src/lib/notifications/index.web.ts`
(check permission, then `new Notification`, click focuses the page).

## Written for Splito (no upstream equivalent)

`packages/sync/src/reminders.ts` (the `reminders` store, schema v4), `src/lib/remind/` (message builder,
owed amounts, share, when), `src/lib/notifications/plan.ts`, `sync.ts`, `storage.ts`, `src/data/remind.ts`,
`src/features/remind/` (menu items, host, the two sheets, the Person list, the engine),
`src/components/settings/NotifyRemindersPref.tsx`.

## Edited shared files

`src/App.tsx` (`<RemindHost />` beside `PwaHost`), `src/screens/Person/index.tsx` (two mounts),
`src/screens/Group/components/GroupRows.tsx` (`OweRow` menu) with its one `remind` prop in
`src/screens/Group/index.tsx`, `src/screens/Settle/components/TransferRow.tsx`,
`src/components/settings/prefControls.tsx` (three map lines), `src/components/activity/ActivityItem.tsx` and
`icons.ts` (the reminder rows), `packages/sync/src/preferences.ts` (`notify.reminders`; the `notify.recurring` and
`notify.digest` placeholders were retired in F-251), `app.config.ts` (the expo-notifications plugin).
