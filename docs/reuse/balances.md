# Reuse record: balances and settle consistency (F-113)

Upstreams: Bluesky `social-app@4e4ad9c` (MIT) at `../upstream/social-app`; Expensify App (MIT). No new upstream
file was copied: every piece of UI below is a Bluesky component already in Splito.

| Splito file | Source | What was taken | Changed |
|---|---|---|---|
| `apps/client/src/screens/Group/index.tsx` (outside-rules note) | Bluesky `src/components/Admonition.tsx` (copy already at `#/components/Admonition`) | `Outer type="warning"`, `Row`, `Icon`, `Content`, `Text`, `Button` | Copy only |
| `apps/client/src/screens/Settle/index.tsx` (outside-rules note) | same | Admonition `warning` in place of `error` | Copy only |
| `apps/client/src/components/split/PeopleDialog.tsx` (`lockedNote`) | Bluesky `src/components/forms/Toggle/index.tsx` `Toggle.Item disabled` (copy already in Splito) | Disabled item for the payer, with a second text line | Optional `lockedNote` prop; absent keeps the old behaviour |

Bluesky search (2026-10-27): `grep -rn "Admonition" src/` (warning notes), Toggle `disabled` items in
`src/components/forms/Toggle/`. Written from scratch (no Bluesky equivalent): `balanceSides` /
`isSettledBalance` / `directPlan` and the transit cost and consent rules in `packages/domain`, `deleteWriteOffs`
in `packages/sync`, `withPeople` / `formPayers` in `components/split/form.ts`, `writeOffParties` in
`components/activity/feed.ts`.
