# Competitor teardown: expense splitting apps

Date: 2026-10-26. Research by web search and store/vendor pages. **[?]** means unverified, or sources disagree. Vendor pages that compare themselves with rivals (tricount.com, kittysplit.com) are marketing and are labelled where used. I could not reach Reddit threads directly, so the user voice below comes from App Store reviews, Trustpilot and review aggregators.

## 1. Feature matrix

| App | Offline | Friends without an account | Receipt scan / itemize | Multi-currency | Recurring | Settle-up logic | Payments | Analytics | Export | Free limits | Platforms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Splitwise** | Yes | Invite by email; Kittysplit claims every participant must sign up [?] | OCR + itemize (Pro) | 100+ currencies; conversion is Pro | Yes | Simplify debts | Venmo/PayPal (US), Paytm (IN), Splitwise Pay via Tink | Charts (Pro) | CSV, JSON backup | Daily expense cap (3–5/day reported), ads | iOS, Android, web |
| **Tricount (bunq)** | Yes | Yes: join by link, no signup | Photo attach only; no OCR found [?] | Yes | [?] | Who owes whom | bunq card adds expenses automatically; payment requests | Spending insights | [?] | "Free. No ads. No limits." | iOS, Android |
| **Settle Up** | Yes | Read-only web link for non-users | Receipt photo (Premium), no OCR | Live rates | Premium | Minimum transfers | None found (Lightning page [?]) | Premium | CSV free, Excel Premium | Ads; Premium features | iOS, Android, web |
| **Splid** | Yes (offline groups) | Yes, no registration | No | 150+, auto-convert | "New Payment" for periodic costs [?] | Simplify debts | None | [?] | PDF; Excel paid | 1 group free | iOS, Android |
| **Spliit (OSS)** | [?] PWA | No accounts at all; you pick "who you are" | AI receipt scan (self-host + OpenAI key) | Unclear | Planned (#5) | Balances + reimbursements | None | [?] | [?] | Free, open source | Web/PWA |
| **Kittysplit** | [?] | Yes, signup optional | Upload (paid) | Paid, 120+ | [?] | [?] | None | [?] | [?] | Free up to 9 people | Web, iOS, Android |
| **SplitMyExpenses** | [?] | [?] | AI itemize (Premium per App Store [?]) | [?] | [?] | [?] | [?] | [?] | CSV | Unlimited expenses (claimed) | iOS, Android, web [?] |
| **Expensify** | Partial [?] | SMS/email requests | Scan into chat, then split | Yes | n/a | Per-request | Expensify Wallet | Business-grade | Yes | Pricing for personal use [?] | All |
| **Venmo Groups** | No | No (Venmo users only) | No | No (US) | No | Auto-calc | Venmo | No | No | Free | iOS, Android |
| **Google Pay (IN)** | No | No | No | INR | No | Pay the creator only | UPI | No | No | Free; 20 people per bill | Android, iOS |
| **PhonePe** | No | No | No | INR | No | Per person or per group | UPI | No | No | Free | Android, iOS |
| **Cino** | No | No | No | EUR/GBP | n/a | Card splits at checkout | Virtual Mastercard | No | No | Free app | iOS, Android (EU/UK) |

Sources: [Splitwise Pro](https://www.splitwise.com/pro), [splitwise.com](https://www.splitwise.com/), [Splitwise changelog (APKMirror, 2026)](https://www.apkmirror.com/apk/splitwise/splitwise/splitwise-26-6-3-release/), [Splitwise on Wikipedia (Tink, 2024)](https://en.wikipedia.org/wiki/Splitwise), [tricount.com](https://tricount.com/), [Tricount help: bunq payments](https://help.tricount.com/articles/add-bunq-payments-as-expenses), [Settle Up App Store](https://apps.apple.com/us/app/settle-up-group-expenses/id737534985), [settleup.io](https://settleup.io/), [splid.app](https://splid.app/english), [Spliit GitHub](https://github.com/spliit-app/spliit), [Kittysplit vs Splitwise](https://www.kittysplit.com/en/splitwise-alternative), [Kittysplit currencies](https://blog.kittysplit.com/multiple-currency-expense-split/), [SplitMyExpenses listing](https://appshunter.io/ios/app/bill-splitter-splitmyexpenses/id6502963284), [Expensify help: split an expense](https://help.expensify.com/articles/new-expensify/expenses/Split-an-expense), [Venmo Groups (Nov 2023)](https://www.paymentsjournal.com/venmo-launches-venmo-groups-to-split-common-expenses), [Google Pay India help](https://support.google.com/pay/india/answer/11420982?hl=EN), [PhonePe help](https://cms.phonepe.com/en/myhelp/money-transfers/spilt-expense/what-split-expense-phonepe/), [Cino (TNW, Mar 2025)](https://thenextweb.com/news/cino-app-splits-bills-at-payment-raises-funding).

## 2. Gaps in Splito's spec (ranked by impact)

Splito's spec already covers most of what competitors charge for: OCR, itemizing, multi-currency, recurring, analytics, export, offline use and private friends. These are the real gaps.

1. **Friends who never install the app can still add expenses, from a link.** Tricount friends "join instantly (no account needed)" through a group link ([tricount](https://tricount.com/splitwise-vs-tricount)). Kittysplit works fully in a browser with optional signup, and Spliit asks "who are you" when a group opens. Splito v2 only has a *read-only* balance link. Users value this because one organizer otherwise has to type everyone's expenses. Proposal: a guest web editor scoped to one group, where the guest picks their name, plus server-side permissions.
2. **Splitwise importer.** Tricount ships one, which imports expenses and balances ([page](https://tricount.com/expense-tracker-features/splitwise-importer)), and Spliit has it planned (#22). Splitwise is the incumbent people want to leave, and re-typing history is the main thing stopping them. Splito's JSON import covers only Splito's own format.
3. **Payment links beyond UPI.** Splitwise has Venmo/PayPal (US) and Paytm (IN), Tricount has bunq, and receipt splitters such as Pita and Bill Bud open pre-filled Venmo requests ([search summary](https://apps.apple.com/us/app/pita-instant-bill-splitting/id1665353703)). Proposal: one pluggable "pay link" with a per-user handle for PayPal.me, Venmo, Revolut, Monzo, bunq.me, Cash App and Wise, alongside UPI. The exact deep-link formats per provider need checking [?].
4. **Free search from v1.** Splitwise paywalls "expense search" ([Pro](https://www.splitwise.com/pro)), while Spliit has it free (#51). Splito only has saved views, in v2.
5. **Guests claim their own items from a receipt link.** SplitTab sends a link where each friend picks their items and pays ([listing](https://apps.apple.com/us/app/id1598456465)). This fits Splito's balance link plus itemization, and it removes the organizer's "tap who had what" step.
6. **Automatic reminders.** Settle Up sends automatic payment reminders ([App Store](https://apps.apple.com/us/app/settle-up-group-expenses/id737534985)), and Google Pay shows who has paid and lets the creator nudge the rest. Splito v2 only drafts manual nudges. Add opt-in scheduled reminders.
7. **A "fewest payments" option.** Settle Up advertises "minimum number of transfers", and Splitwise and Splid advertise debt simplification. Splito's spec says "no promise of fewest transfers". When a group has no rules, users expect a minimal plan, so show the number of payments and offer a simplify toggle. Exact minimum is NP-hard in general, so use a heuristic and label it honestly.
8. **Split from a payment.** PhonePe lets you split from the payment confirmation screen and from payment history ([design blog, Dec 2023](https://www.phonepe.com/blog/design/phonepes-split-expenses-streamlining-group-transactions-with-ease/)). Tricount auto-adds bunq card spend, and Splitwise Pro imports transactions (US only). Splito equivalent: share a UPI or bank screenshot into Splito and get a pre-filled draft, reusing v2 OCR and the share extension.
9. **Category auto-suggest from the title.** Spliit offers this as an option (via OpenAI). Splito can do it with a local keyword map that works offline and learns from the user's edits.
10. **Shareable trip summary in v1.** Splid sends PDF summaries over WhatsApp and email ([Packing Light, Aug 2026](https://packinglighttravel.com/?p=9731)). Splito has a trip PDF in v2; a lightweight text or image summary in v1 would be cheap.
11. **Delete and edit permissions per group.** One third-party review says Tricount lets "other users delete anything without permission" [?] ([search summary](https://ca.trustpilot.com/review/tricount.com)). Splito has roles and undo; add a per-group setting for who can edit or delete, and a "close trip" lock after settle-up.
12. **Minor:** a time on each expense (Splittr), a public API (Settle Up), distance/mileage entries (Expensify).

## 3. Simplicity and looks: patterns worth copying

- **Never block the first expense on signup or invites.** Splid: "no registration", and a group can be made "without sending invitations". Its screen is called "less cluttered than Tricount's" ([Packing Light](https://packinglighttravel.com/?p=9731)). Tricount users sum it up as "Create a group, invite friends, enter expenses, done" ([Trustpilot](https://ca.trustpilot.com/review/tricount.com)).
- **One big + inside the group, then amount, payer and split.** This is the Splid flow ([WhistleOut](https://www.whistleout.com/CellPhones/Apps/splid-app-for-splitting-group-expenses)). Splitwise shows a single sentence-style button that defaults to paid by you and split equally; tapping it changes either part ([TapSmart](https://www.tapsmart.com/tips-and-tricks/shared-bills-splitwise)). Splito target, which is our own estimate since I found no verified tap counts for competitors: **+ → amount (keypad already focused) → Save = 3 taps**, with defaults of payer = me, equal split among group members, today's date, the group currency and an auto-suggested category.
- **Pick "who are you" once per group.** Spliit (#7) and Tricount links both do this, and every later default ("paid by") follows from it.
- **Show one next action.** Settle Up "shows who pays next". When paying someone, PhonePe shows your current balance with that person up front.
- **Keep chat and expenses in context.** PhonePe ("Chat First") and Expensify (receipt scanned into a group chat) both place expenses inside the conversation. Splito's v2 comments come close.
- **A calm, consistent palette.** Splitwise's green, muted palette is praised, while its clutter and confusing debt display are criticised ([Yellowslice, Mar 2025](https://www.yellowslice.in/blog/splitwise-app-review-ux-ui-improvements)). Settle Up is called "a little dated" (App Store, Feb 2025).
- **Nothing in the way of quick entry.** Splittr's simplicity is loved, but its ads "slow down quick entry" ([Packing Light](https://packinglighttravel.com/?p=9731)).

## 4. Top complaints we can win on

| Complaint | Evidence | How Splito wins |
|---|---|---|
| Daily expense cap of 3–5 a day, plus ads or a ~10 s timer before adding | App Store reviews 12/2023, 02/2024, 06/2024 ([reviews](https://apps.apple.com/us/app/splitwise/id458023433?see-all=reviews)); Trustpilot July 2025 and Apr 2026 ([Trustpilot](https://nl-be.trustpilot.com/review/splitwise.com)); [Packing Light, Aug 2026](https://packinglighttravel.com/?p=9731) | Unlimited, ad-free, instant save |
| Currency conversion, scanning, search and charts paywalled | [Splitwise Pro](https://www.splitwise.com/pro); App Store 06/2024 | All free (most already are in the spec) |
| Per-user subscription; people want a one-time unlock | [Kimola aggregate](https://kimola.com/reports/splitwise-feedback-analysis-unlock-user-sentiments-google-play-154450); [Kittysplit](https://www.kittysplit.com/en/splitwise-alternative) | No subscription for core features |
| Splitwise Pay payments pending for days; bank withdrawal failed | App Store review 09/14/2025 | Splito never holds money; deep links plus an honest "Mark as paid?" |
| Unreliable notifications; cluttered UI; debt display confusing | [Yellowslice, Mar 2025](https://www.yellowslice.in/blog/splitwise-app-review-ux-ui-improvements) | Sync status labels; one clear balance line per person |
| Slow sync; the same expense lands in both a group list and a non-group list | [Kimola](https://kimola.com/reports/splitwise-feedback-analysis-unlock-user-sentiments-google-play-154450) [?] | Offline-first local writes |
| Draft lost when switching to a calculator; "shares" split confusing; can't save until amounts add up | App Store 03/2022 | Inline calculator in the amount field, drafts that persist, a live "remaining" counter with auto-fill |
| Can't fix one person's amount and split the rest equally | Settle Up App Store review 03/2024 | An "equal, with adjustments" split mode |
| Members need accounts (old request: track a family trip alone) | App Store 11/2018 | Already covered by private friends; add link guests (gap 1) |

## 5. Free vs paid

| App | Free | Paid |
|---|---|---|
| Splitwise | Basic splitting, recurring, simplify debts, offline | Pro: unlimited expenses, transaction import, conversion, charts, OCR, itemizing, search, default splits, no ads. About $39.99/yr per user [?] ([Packing Light](https://packinglighttravel.com/?p=9731)) |
| Tricount | Everything; no ads ([tricount.com](https://tricount.com/)) | None. Monetized through bunq accounts and cards |
| Settle Up | Offline, multi-currency, minimum transfers, CSV, web link | Premium: no ads, receipt photos, recurring/future, custom categories, Excel, charts. $3.99/mo, $19.99/yr, **Group Premium** $39.99/yr, trip passes from $5.99/week, lifetime group $149.99 (US App Store; prices vary by region [?]) |
| Splid | 1 group, all features | One-time Splid Plus (~$3.69–3.99): unlimited groups and Excel; an extra group ~$2.89–2.99 ([Packing Light](https://packinglighttravel.com/?p=9731)) |
| Kittysplit | Up to 9 people, unlimited expenses | ~€3 one-time **per group, paid by one person**: 10+ people, currencies, receipts |
| Spliit | Everything (open source) | None; self-hosters pay for their own AI receipt scanning |
| SplitMyExpenses | Unlimited expenses | AI receipt itemizing is Premium [?] |
| Venmo, Google Pay, PhonePe, Cino | Free | Revenue from payments |

**Takeaway.** The market has split into "free with no limits" (Tricount, Spliit) and "per-user subscription" (Splitwise), and the subscription side is the source of most complaints. Splito should give away everything Splitwise paywalls: unlimited expenses, OCR, itemizing, conversion, search, charts, CSV export, recurring, custom categories, and no ads. If revenue is needed later, the least-hated model is **one person pays once for the whole group** (Kittysplit, Settle Up Group Premium) for things that cost money to run, such as AI chat volume or attachment storage. That is the owner's decision.
