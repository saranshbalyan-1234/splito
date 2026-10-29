# Reuse record - tax classes and charges stream (F-403)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT) for UI components;
`Expensify/App@44387bc7` (MIT) for the tax-rate picker pattern only. The charge maths
(`packages/domain/src/charges.ts`) is Splito's own: neither app handles per-item tax classes, scoped
charges or stacking. Paths are relative to `apps/client/`. Icons are Lucide (ISC); no artwork is copied.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/settings/TaxClassesEditor.tsx` | `src/screens/SavedFeeds.tsx` (move up/down, drag list) via Splito's `CategoriesEditor.tsx` | Tax classes: name only, hide, reorder (drag, arrows on web); Standard cannot be removed |
| `src/components/settings/TaxClassDialog.tsx` | `src/screens/Profile/Header/EditProfileDialog.tsx` (dirty close) via `CategoryDialog.tsx` | Name-only form sheet |
| `src/components/split/charges/ChargeSheet.tsx` | Expensify `src/pages/workspace/taxes/` (tax rate form), UI from Bluesky `Dialog` / `TextField` / `Toggle` | Name, kind, rate or amount, scope (all / classes / items), stacks, prices include tax; phone drawer, desktop popup |
| `src/components/split/charges/ItemClass.tsx` | Expensify `src/components/TaxPicker.tsx` (pattern) | Class chip per item, radio picker sheet, multi-select bar |
| `src/components/split/charges/ChargesSection.tsx` | Bluesky `DraggableList` rows | Preset chips, dashed merchant suggestion, drag-reorder charge rows, Save as preset |
| `src/components/split/charges/Reconciliation.tsx` | - | Items + charges + round-off = total; red gap with Add as round-off / Check items |
| `src/screens/Expense/components/ChargedBreakdown.tsx` | - | Items by class, charge scopes, per-person charge shares |
