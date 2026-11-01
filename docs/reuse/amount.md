# Reuse record: amount stream (F-310, F-402, F-1801)

Upstreams: Bluesky `social-app@4e4ad9c` (MIT) at `../upstream/social-app`; Expensify App (MIT). The local
Expensify clone named in the task (`../upstream/App`) does not exist on this machine, so Expensify's
`BigNumberPad.tsx`, `NumberWithSymbolForm.tsx` and `libs/MoneyRequestUtils.ts` were read from GitHub `main`
as behaviour descriptions only; no Expensify source, icons or styles were copied.

| Splito file | Source | What was taken | Changed |
|---|---|---|---|
| `apps/client/src/components/split/fields.tsx` `AmountField` | Expensify `NumberWithSymbolForm` (behaviour) | `showSoftInputOnFocus={false}` / `inputMode="none"` while the pad shows; refocus the input from a key | Existing Splito field; keypad only at phone widths and behind `amount.keypad` |
| `apps/client/src/components/MoneyDirection.tsx` | - (written: Bluesky has no money direction) | - | Follows Bluesky's icon prop API via `createIcon` (Lucide `ArrowDownLeft` / `ArrowUpRight`) |
| `apps/client/src/components/split/SplitEditor.tsx` `CashRounding` | Bluesky `Toggle.Item` + `Toggle.Platform`, `Button` chips (already in the file) | Switch row and radio chips | Copy and layout only |
| `apps/client/src/components/settings/prefControls.tsx` (5 rows) | Bluesky Settings rows via the existing `SwitchPref` / `RadioPref` / `SegmentedPref` | - | New rows only |

Bluesky search (2026-10-26): `grep -ri "numberpad\|keypad\|numpad\|BigNumber" src/` - none (Bluesky has no
money or numeric entry beyond the age gate's date picker). Searched `src/components/forms/` for a calculator or
amount field - none. Toggle, Button, Settings rows and icon API were reused from the copies already in Splito.
Written from scratch: domain parsing/rounding (`packages/domain`, no Bluesky equivalent), the keypad key rules
(Expensify behaviour), the money-direction palette.

## F-111 Amount entry and parsing correctness (2026-10-27)

| Splito file | Source | What was taken | Changed |
|---|---|---|---|
| `packages/domain/src/calc.ts` (`plainNumber` group check, `readNumber`, `amountInputText`, `numberReadings`, unary minus, comma percents) | - (written: Bluesky has no money parsing) | - | Audit fixes C1, C2, M1, M2, M7, M14, m8, m9 |
| `packages/domain/src/currency.ts` (prototype-free `CURRENCIES`) | - | - | Audit m13 |
| `packages/sync/src/search.ts` (amount tokens read in the user number format) | - | - | Audit M14 |
| `apps/client/src/components/split/form.ts`, `fields.tsx`, `SplitEditor.tsx`, `screens/EditExpense.tsx`, `components/people/RecordPaymentDialog.tsx`, `UpiPayDialog.tsx`, `features/settlement/CallItEvenDialog.tsx` | - | - | App-written amounts use the locale mark and a `decimal` reading (C1, C2); rows read decimals (M3) |

Bluesky search (2026-10-27): `grep -rni "decimal\|parseFloat\|Intl.NumberFormat" src/lib src/components/forms`
finds only count formatting (`src/lib/strings/` compact numbers); nothing reads typed money. Expensify's clone is
still absent at `../upstream/App`; `MoneyRequestUtils.ts` behaviour (strip grouping, one decimal mark) was
already the reference for F-310 and is unchanged.

Removed 2026-11-01 (owner 231): `AmountKeypad.tsx` and `amountKeys.ts`; the amount field opens the system number keyboard everywhere.
