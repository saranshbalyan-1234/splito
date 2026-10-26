# Reuse record: amount stream (F-310, F-402, F-1801)

Upstreams: Bluesky `social-app@4e4ad9c` (MIT) at `../upstream/social-app`; Expensify App (MIT). The local
Expensify clone named in the task (`../upstream/App`) does not exist on this machine, so Expensify's
`BigNumberPad.tsx`, `NumberWithSymbolForm.tsx` and `libs/MoneyRequestUtils.ts` were read from GitHub `main`
as behaviour descriptions only; no Expensify source, icons or styles were copied.

| Splito file | Source | What was taken | Changed |
|---|---|---|---|
| `apps/client/src/components/split/AmountKeypad.tsx` | Expensify `src/components/BigNumberPad.tsx` (behaviour) | 4 x 3 phone pad with the decimal key and delete on the bottom row; delete repeats every 100 ms while held; interval cleared on unmount | Built on Bluesky `Button`; added the + − × ÷ column, a 000 key and the Done / "= Use result" key; Lucide `Delete` glyph |
| `apps/client/src/components/split/amountKeys.ts` | Expensify `NumberWithSymbolForm.tsx` `updateValueNumberPad` + `MoneyRequestUtils.validateAmount` / `addLeadingZero` (behaviour) | Keys insert at the selection; delete removes before the caret or the range; a key that would break the number (second decimal mark, more decimals than the currency) is dropped; "." on an empty number becomes "0." | Operators (Splito's calculator), per-operand decimal checks, locale decimal mark |
| `apps/client/src/components/split/fields.tsx` `AmountField` | Expensify `NumberWithSymbolForm` (behaviour) | `showSoftInputOnFocus={false}` / `inputMode="none"` while the pad shows; refocus the input from a key | Existing Splito field; keypad only at phone widths and behind `amount.keypad` |
| `apps/client/src/components/MoneyDirection.tsx` | - (written: Bluesky has no money direction) | - | Follows Bluesky's icon prop API via `createIcon` (Lucide `ArrowDownLeft` / `ArrowUpRight`) |
| `apps/client/src/components/split/SplitEditor.tsx` `CashRounding` | Bluesky `Toggle.Item` + `Toggle.Platform`, `Button` chips (already in the file) | Switch row and radio chips | Copy and layout only |
| `apps/client/src/components/settings/prefControls.tsx` (5 rows) | Bluesky Settings rows via the existing `SwitchPref` / `RadioPref` / `SegmentedPref` | - | New rows only |

Bluesky search (2026-10-26): `grep -ri "numberpad\|keypad\|numpad\|BigNumber" src/` - none (Bluesky has no
money or numeric entry beyond the age gate's date picker). Searched `src/components/forms/` for a calculator or
amount field - none. Toggle, Button, Settings rows and icon API were reused from the copies already in Splito.
Written from scratch: domain parsing/rounding (`packages/domain`, no Bluesky equivalent), the keypad key rules
(Expensify behaviour), the money-direction palette.
