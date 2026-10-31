# Reuse record: consolidation P0-e (pickers, currency, joinList) and P0-h (chips, switches) (F-274)

Upstream: Bluesky `social-app@4e4ad9c` (MIT) at `../upstream/social-app`. Spec: `docs/reuse/consolidation.md`
findings 4, 13, 15, 30, 40, 44.

| Splito file | Source | What was taken | Changed |
|---|---|---|---|
| `src/components/forms/ChoiceChips.tsx` | Bluesky `src/components/forms/ToggleButton.tsx` | The Toggle semantics (a radio or checkbox group, one checked state) | ToggleButton is a joined segmented bar and deprecated in favour of SegmentedControl, so the chips are the existing `Button` pills (unchanged look) with `role`, `aria-checked` and one `selection` haptic |
| `src/components/forms/Toggle/index.tsx` (`SwitchRow`) | same file in Splito (copy of Bluesky `Toggle/index.tsx`) | `Item type="switch"`, `LabelText`, `Switch` | A labelled row with an optional hint, replacing 7 hand-built rows |
| `src/components/CurrencyDialog.tsx` | `src/components/settings/OptionDialog.tsx` (Bluesky `LanguageSelectDialog`, copy already in Splito) | The searchable single-choice list | Currency options with names in the app language |

Bluesky search (2026-10-31): `grep -rn "Intl.ListFormat\|ListFormat" src/` and `Intl.DisplayNames`: Bluesky has no
list-join or currency-name helper, so `locale/joinList.ts` and `locale/currencyName.ts` are written here (they wrap
Intl with a fallback for Hermes).
