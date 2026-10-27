# Reuse record - dates and number formats (F-115)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`. No Bluesky glyphs, illustrations, logos or `assets/images` are copied.

Bluesky search: Bluesky has no timezone, date-format or number-format preference, so the preference wiring is
Splito's. What it does have was reused.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/locale/i18n.ts` (native polyfill) | `src/locale/i18n.ts` | Already adapted; F-115 adds the `en-IN`, `de` and `fr` number-format locale data (and `de`, `fr` plural rules) so the Number format preference and en-IN devices format correctly on Hermes (audit M17). |
| `src/state/shell/tick-every-minute.tsx` | same | Unchanged. Not used for "today": it re-renders every consumer each minute. `useToday` (`src/locale/useDates.ts`) is a separate shared store that re-renders only when the date changes (ARCHITECTURE § 10), written from scratch on `useSyncExternalStore` plus AppState, as Bluesky has no date-change store. |
| `src/components/activity/SectionHeader.tsx` | `src/screens/Notifications/components/PageList.tsx` (SectionHeader) | Header day now comes from a calendar date in the Timezone preference, not device midnight. |

Written from scratch (no Bluesky equivalent): `locale/dates.ts` (`formatDay`, `todayIn` with calendar-day offset,
`daysBetween`), `locale/timeZones.ts` (bundled canonical IANA list), the `isTimeZone` preference validator.
