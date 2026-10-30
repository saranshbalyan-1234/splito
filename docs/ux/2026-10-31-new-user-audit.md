# Splito UX audit, 2026-10-31 (local preview http://localhost:8090, newest main)

Reviewer: Opus, acting as a first-time user and then a regular user. Rules checked: ARCHITECTURE § 26.1 owner 212 (simple, instant), owner 213 (finishing pieces, nothing overdone), owners 128/129 (customizable only where it helps, never forced), the rest of § 26, and BACKLOG F-240 (the 2026-10-28 audit).

How it was run: Playwright on system Chrome. Phone 390x844 with touch, desktop 1440x900, light and dark (Dim), English and Hindi. Accounts: a brand-new dev account built up by hand (friends, a trip group, expenses, a payment, a dispute), a demo-mode account, and an email sign-up account. No code was edited.

Screenshots: `/private/tmp/claude-501/-Users-saransh/d9b5b9cb-c228-49c7-a1e0-b67267240766/scratchpad/ux-shots/`. File names below are relative to that folder.

Builder areas (from the brief), used in the "Builder" column:
- **A**: no Home tab; Overview at the top of Analytics; Sort on People and Groups.
- **B**: the avatar opens Profile; Settings becomes a tab; Support and Your data pages; a fuller Profile; Ask leaves the nav.
- **C**: PersonLink; group "Who can join"; pull to refresh; search across fields; animated icons and empty art; the perf sweep.
- **-**: no running builder owns it.

---

## 1. Tap counts per job (what a user does today)

| Job | Path | Taps | Hesitations |
|---|---|---|---|
| First open to signed in (dev account) | Skip (or Next ×4, Get started) → Continue with a dev account | 2 (6 without Skip) | Google and Apple are the two biggest buttons and do nothing (F-10) |
| First open to signed in (email) | Skip → email → Continue → code → Continue → name → Continue → phone → Continue → code → Continue → password → Create account | 7 taps, 5 fields | The phone number and password are forced, and the name is then lost (F-9) |
| Add a friend (name only) | Add a friend → name → Add friend | 2 | "Name (optional)" when it is the only field you need; the email field comes first (F-2) |
| Add an expense with a friend (from the People FAB) | FAB → title → amount → Split with → tick → X → Save | 5 | Split with defaults to "You"; the picker has no Done; Save waits 1.2 s (F-4, F-16, F-26) |
| Same, from the friend's page | Add expense → title → amount → Save | 2 | Good |
| Split unevenly | + Exact → type each share | +1 tap, 2 fields | Shares start blank: "₹900.00 left to assign" (F-27) |
| Itemise a bill | Scroll the chips → Itemize → total → Add item ×N → name and price → assign | ~6 taps plus typing | Wall of charge controls; tapping a name adds a portion (F-6, F-7) |
| Create a trip group, add members | + → name → (where, dates) → tick friends → Create | 3 plus typing | Members are below the fold under 6 fields |
| Add an expense in it, Paid by someone else | FAB → title → amount → Paid by → person → Save | 3 | Good: the payer sheet closes itself |
| See who owes what | Group → Balances | 1 | The per-person list and "Who owes whom" repeat each other |
| Settle up and record a payment | Handshake → Record → Record payment | 3 | The plan is stale for about a second; the success sheet holds the screen (F-11, F-4) |
| Dispute an expense | … → Dispute → reason → Raise dispute | 4 | "Raised by" picker; Dispute and Put on hold look the same (F-15) |
| Comment | Type → Send | 1 | The new comment lands below the fold, so nothing visible happens (F-28) |
| Find an old expense | Search icon → type | 1 | Good, but the icon is the AI sparkle (F-33) |
| See spending by month | Analytics tab | 1 | Tapping a month only shows a tooltip, so you can't get to that month's expenses (F-13) |
| Export | Analytics download icon (CSV at once), or avatar → Settings → scroll → Export → Create | 1, or 4 | The two exports behave differently (F-12) |
| Change the language | Avatar → Settings → Language and region → हिन्दी | 4 | - |
| Change the theme | Avatar → Settings → Appearance → Dark | 4 | 7 sections on Appearance |
| Log out | Avatar → Log out → Log out | 3 | **Wipes every expense** (F-1) |

---

## 2. Findings, ranked

Severity: **blocker** (loses data, or a core job can't be finished), **major** (real friction on a core job, or breaks a binding rule), **minor** (polish).

### Blockers

**F-1. Log out deletes all your data, and nothing can bring it back.**
- **Where:** drawer or Settings > Log out. `83-logout-confirm.png`, `84-after-logout.png`, `85-relogin.png`.
- **What the user sees:** "27 changes haven't synced yet and will be lost. This removes all your Splito data from this device." The red **Log out** is the top, primary button. I signed back in with the same dev account and the app was empty.
- **Why it hurts:** there is no sync, so every log-out loses everything for good. People expect logging out to be harmless. The dialog offers no way to save a copy first.
- **Simplest fix:** until sync exists, log out only locks the account and keeps its local data, so signing back in brings it back. Erasing goes to one explicit action, "Delete data from this device", on the Your data page. If wiping must stay, make the dialog's primary "Save a backup first" (it opens Export > Backup), with Log out as the secondary.
- **Severity:** blocker. **Builder:** B (Your data page, Settings tab).

**F-2. A friend added by email or number can never be used.**
- **Where:** Add friend `07-add-friend-sheet.png`, People `10-after-add-friend2.png`, the Split with picker `13-split-with-picker.png`, the New group members list `27b-kind-home.png`.
- **What the user sees:** the sheet leads with "Email or mobile number" and says "They get a request to accept". Afterwards that friend is greyed out everywhere with "Waiting for Kabir to accept" and can't be ticked into an expense or a group. People shows "We'll send it when you're online" while you are online.
- **Why it hurts:** the first field leads straight to a dead end. Nothing can be accepted until a server exists. A first-time user who types an email can't split with that friend at all.
- **Simplest fix:** until sync, adding by email or number creates a normal local friend who can be used at once, and the contact is kept for a later invite. Put the name field first and the email or number second as "(optional, to invite them later)". Drop the "request to accept" and "when you're online" copy (§ 0 rule 6).
- **Severity:** blocker. **Builder:** - (C's PersonLink renders these rows).

**F-3. A group disappears from Groups as soon as it is settled.**
- **Where:** `/groups` after settling the Goa trip. `43-groups-after-settle.png` shows "Groups 0 · All settled up · Show settled".
- **What the user sees:** my running trip vanished from the list. It looks deleted, and getting back into it takes "Show settled".
- **Why it hurts:** a group holds a trip or a flat; it isn't a debt. Settling once mid-trip shouldn't hide it. People does not hide settled friends (Riya shows "Settled up"), so the two lists behave differently.
- **Simplest fix:** Groups always lists active groups. Settled ones sort below the rest with a "Settled up" chip. Only Inactive or hidden groups leave the list. Remove "Show settled" from the Groups filter.
- **Severity:** blocker. **Builder:** A (Sort on Groups).

### Major

**F-4. Saving holds the screen for about 1.2 s on a full-sheet "Expense added" animation, then shows a toast as well.**
- **Where:** Add expense > Save `100-save-100ms.png`, `100-save-500ms.png`, `100-save-1000ms.png`. Record payment shows the same, with a big tick in `36-after-record.png`.
- **What the user sees:** the sheet turns white with a spinning circle and "Expense added". It closes about 1.1 to 1.4 s later, and then an "Expense added · View" toast appears.
- **Why it hurts:** owner 212 says "every tap answers at once", and owner 213 says nothing is added for decoration. The same message appears twice.
- **Simplest fix:** close the sheet on the tap. Show one toast ("Expense added · View") and let the new row animate into the list. Do the same for Record payment.
- **Severity:** major. **Builder:** C (perf sweep, animated icons).

**F-5. Toasts sit just under the header and cover the next screen's main content for several seconds.**
- **Where:**
  - the new friend's "Add expense" and avatar: `09-after-add-friend.png`
  - the group summary: `28-group-created.png`, `33-group-balances.png`
  - "You'll pay ₹3,000": `34-group-settle.png`
  - the Analytics filters (the install hint): `53-analytics-150ms.png`
  - the expense title and amount: `45-after-dispute.png`
- **What the user sees:** the thing you came to see, or the button you want next, is hidden under a toast.
- **Why it hurts:** it slows every next step and adds visual noise.
- **Simplest fix:**
  - Don't toast when the result is already on screen (the new row, the new page).
  - Keep toasts only for Undo or View, and move them clear of the header content: above the tab bar, left of the FAB.
  - Show the install hint once, as a row in Settings, not over content.
- **Severity:** major. **Builder:** -.

**F-6. In Itemize, tapping a name adds a portion instead of choosing that person.**
- **Where:** Add expense > Itemize `23-itemize-two-items.png`, result `24-after-itemize-save.png`.
- **What the user sees:** each item starts as "Everyone". I tapped "You" on Beer to make it mine, and it became "You ×2" with Riya still on it, so Riya was silently charged ₹333.33 for my beer. Removing someone needs a long-press ("hold to take them off").
- **Why it hurts:** the money comes out wrong without any warning, and the gesture is hidden.
- **Simplest fix:**
  - When an item is "Everyone", tapping a name makes it only that person.
  - Further taps toggle people on and off.
  - Portions move to a small "×2" stepper on a chosen chip.
  - No long-press.
- **Severity:** major. **Builder:** -.

**F-7. Itemize opens with every charge control showing, and the total has to be typed first.**
- **Where:** `21-itemize-open.png`.
- **What the user sees:** before a single item there are 5 charge presets plus Tax, Tip, Service charge and Discount, each with an INR/% toggle. The total amount must be typed up front, and the items must add up to it ("₹2,400.00 left to assign").
- **Why it hurts:** owner 129 says power features sit one tap deeper and no screen is a wall of chips. Most bills have no charges at all.
- **Simplest fix:** show "Add item" plus one row, "Add tax, tip or discount", that opens the charge controls. When the amount is empty, the total is the sum of the items.
- **Severity:** major. **Builder:** -.

**F-8. Settle up does different things from a friend and from a group (F-240 #8, still open).**
- **Where:** the person header handshake opens Record payment directly (`38-person-settle.png`). The group header handshake opens the plan (`34-group-settle.png`).
- **Why it hurts:** the same icon and the same word lead to two different flows.
- **Simplest fix:** the person's Settle up opens the same plan screen, filtered to that person and listing one row per currency, each with Record.
- **Severity:** major. **Builder:** -.

**F-9. Email sign-up is 6 screens long, forces a phone number and a password, then throws away the name.**
- **Where:** `86-code-filled.png`, `88-after-name.png`, `90-phone-code.png`, `91-after-phone.png`, `92-after-password.png`, then Profile `94-profile.png`.
- **What the user sees:** email, code, name, phone ("Every account has a verified phone number and email"), a second code, password, then in. Afterwards the avatar still shows "M", and Profile says "Add your name" although I had typed "Asha".
- **Why it hurts:** owner 212 says no choice before you can start. Codes and a password do the same job. Asking for the name and then dropping it breaks trust.
- **Simplest fix:** email (or phone), code, name, done. Phone and password become optional rows in Profile. Save the name typed here.
- **Severity:** major. **Builder:** B (fuller Profile shows the name); the sign-in flow itself is -.

**F-10. Google and Apple are the two biggest sign-in buttons and are not built.**
- **Where:** `03-continue-screen.png`, after a tap `04-google-tap.png`.
- **What the user sees:** a tap only shows "Sign-in with Google and Apple arrives with sync".
- **Why it hurts:** the first two choices on the first real screen are dead ends, and the buttons claim something that isn't built (§ 0 rule 6).
- **Simplest fix:** hide both until they work. Email or phone becomes the primary, and the dev account stays below.
- **Severity:** major. **Builder:** -.

**F-11. The settle plan stays stale after you record a payment and asks you to "Update plan".**
- **Where:** `36-after-record.png`.
- **What the user sees:** behind the success sheet, the plan still shows "You pay Dev ₹3,000" plus the banner "Balances or rules changed since this plan was made. Update plan". It corrects itself once the sheet closes (`40-after-record-4s.png`).
- **Why it hurts:** it makes you wonder whether the payment counted. "Plan" and "rules" are jargon.
- **Simplest fix:** recompute the plan the moment a payment is saved and remove the banner. After a recorded payment, show the row as "Paid ✓" for a moment.
- **Severity:** major. **Builder:** -.

**F-12. Two Export buttons that behave differently.**
- **Where:** the Analytics header download icon instantly saves `splito-INR-2026-01-01-to-2026-12-31.csv` (INR and the current period only, no choice): `60-analytics-export.png`. Settings > Export opens a sheet with PDF, CSV or Backup and filters: `61-settings-export.png`.
- **Why it hurts:** the same job works two ways, and the Analytics icon gives no chance to pick a format or currency.
- **Simplest fix:** one Export sheet everywhere. From Analytics it opens prefilled with that screen's currency and period.
- **Severity:** major. **Builder:** A (Analytics header with the Overview), B (Your data page).

**F-13. The Analytics filter bar runs off a phone screen, and tapping a month leads nowhere.**
- **Where:** `59-analytics-bar-tap.png`. The "Table" toggle starts at x=386 on a 390 px screen.
- **What the user sees:** Table is cut off. Tapping September shows a tooltip and nothing else.
- **Why it hurts:** a control is hidden, and "see spending by month" stops at a number.
- **Simplest fix:** let the filter row wrap or scroll, or move "Table" into the header "…". Tapping a bar opens search or Activity filtered to that month (`march 2026` already works as a search).
- **Severity:** major. **Builder:** A (Overview at the top of Analytics).

**F-14. Turning demo mode on blocks the app for about 70 s.**
- **Where:** Settings > Data > Demo mode. `51-demo-progress.png` shows "Setting up the demo… 5%". This was observed, not benchmarked.
- **Why it hurts:** owner 212, instant taps; the owner uses this switch himself.
- **Simplest fix:** seed in the background without a modal, open on whatever is ready, and fill the rest in place. Or ship a prebuilt snapshot (which is the F-252 direction).
- **Severity:** major. **Builder:** C (perf sweep).

**F-15. "Dispute" and "Put on hold" are two flows that do the same thing, and Dispute asks too much.**
- **Where:** the expense "…" menu `42-expense-menu.png`, Dispute `44-dispute-sheet.png`, Hold `104-hold.png`.
- **What the user sees:** both say "still counts in balances, but Settle up leaves it out", and both have a "Raised by" person picker and reason chips. Dispute has 8 reason chips and a two-sentence explanation that reads as a contradiction. After raising one, the dispute appears three times (badge, card, discussion line): `45-after-dispute.png`.
- **Why it hurts:** two ways to do one job. "Raised by" is a choice before you can start, since you nearly always raise it yourself.
- **Simplest fix:** merge them into one "Report a problem" with short reasons ("Wrong amount", "Wrong split", "Waiting for refund", "Duplicate", "Other"). Raised by is always me. Show it once on the expense, as one card.
- **Severity:** major. **Builder:** -.

**F-16. Add expense shows everything at once, and some controls repeat.**
- **Where:** `11-add-expense-open.png`, `12-expense-filled.png`, `105-adjust.png`.
- **What the user sees:**
  - When the sheet opens, focus is on Close, not on the title or the amount.
  - Four rows, six split chips, a per-person list, "Round shares to cash" and Notes all show from the start, even when the only person is you.
  - The "Split with" row and the "Add people" button open the same picker.
  - "Itemize" is still off-screen at 390 px (F-240 #5).
  - "Adjust" is jargon.
- **Why it hurts:** owner 129 asks for one primary action and the essentials first.
- **Simplest fix:**
  - Autofocus the amount.
  - Show the Split section only once 2 or more people are in.
  - Remove the "Add people" button.
  - Move "Round shares to cash" into a "More" row.
  - Let the split chips wrap.
  - Rename "Adjust" to "Equal + extra".
- **Severity:** major. **Builder:** -.

**F-17. Empty screens: no FAB on empty Home and People, weak calls to action, and Activity has none.**
- **Where:** `06-dev-account.png` and `101-empty-people.png` (no FAB), `25-groups-empty.png` and `101-empty-analytics.png` (FAB plus a duplicate grey CTA), `101-empty-activity.png` (no CTA, while the All/Me/Others tabs, filter and mark-read show on nothing).
- **Why it hurts:** owner 213 says each empty list has one clear CTA. The F-240 #1 FAB rule is still open.
- **Simplest fix:**
  - Mount the FAB once in the shell.
  - Give the empty-state CTA the primary style.
  - On empty Activity, CTA "Add an expense".
  - Hide tabs, filter and mark-read until there is something to show.
  - Analytics empty: drop its duplicate "Add expense" pill, since the FAB covers it.
- **Severity:** major. **Builder:** C (empty art), A (Home is going).

**F-18. The group "…" menu has 9 items, two of them repeated, and "Payment rules" is a wall of controls.**
- **Where:** the menu `79-group-more.png` (Edit group, Export, Members, Add members, Payment rules, Make inactive, Hide group, Leave group, Delete group); rules `103-payment-rules.png` (20 pairs × 4 options for 5 people).
- **Why it hurts:**
  - Members and Add members repeat the Members tab (F-240 #11).
  - Make inactive and Hide group are two ways to get a group out of sight.
  - "Payment rules" is jargon, and the screen breaks owner 129.
- **Simplest fix:**
  - Menu: Edit group, Export, Archive (merging inactive and hide), Leave, Delete.
  - Rules move to Edit group > "Who pays whom (advanced)", shown as "Never pair" and "Prefer" lists instead of a 4-way control on every pair.
- **Severity:** major. **Builder:** C ("Who can join" lives in group settings).

**F-19. Settings shows controls for features that don't exist yet.**
- **Where:** Notifications `102-settings-notifications.png` (3 of 4 toggles "start once sync is on"), Privacy `102-settings-privacy.png` ("applies once the directory is live"). The Settings list `48b-settings-full.png` summarises them as "Notifications On" and "Privacy Findable".
- **Why it hurts:** owner 212 says "nothing shown that they cannot act on", and the summaries claim features that aren't built.
- **Simplest fix:** hide toggles for unbuilt features. Notifications keeps "Reminders" only, and Privacy keeps the "No tracking / saved on this device" statement.
- **Severity:** major. **Builder:** B (Settings tab).

**F-20. The Activity badge stays at "30+" after you open Activity (F-240 #4, still open).**
- **Where:** `75-badge-after-visit.png`.
- **Severity:** major. **Builder:** -.

**F-21. Contrast is still below AA (F-240 #7, still open).**
- **Where:** checked automatically on People, Groups, Analytics and Activity.
- **Measurements:**
  - light green money #04904A on white: 4.12:1
  - dark red #EB2452 on #151D28: 3.96:1, and 3.74:1 on unread Activity rows
  - chart axes: 2.94:1 light, 3.17:1 dark
  - the "30+" badge: 4.27:1
- **Severity:** major. **Builder:** -.

**F-22. Tap targets are too small.**
- **Where:**
  - every header icon button is 33×33 (F-240 #6)
  - the radio rows on Settings > Appearance and Language are 23 px tall
  - the drawer and sidebar footer links (Feedback, Help, Privacy, About) are 15 px tall
  - the language chip on sign-in is 25 px tall
- **Simplest fix:** give every control a hit area of at least 44 px.
- **Severity:** major. **Builder:** B (drawer and Settings pages).

### Minor

| # | Where (screenshot) | What happens | Simplest fix | Builder |
|---|---|---|---|---|
| F-23 | Person and group pages `09`, `28`, `81-cold-goa-900` | Two "Add expense" buttons (the header pill and the FAB), so two primaries | Phone: FAB only. Desktop: keep the pill (no FAB there) | - |
| F-24 | Add friend `09` vs `10` | Adding by name lands on the friend's page; adding by email stays on People | Always open the new friend's page | C (PersonLink) |
| F-25 | New friend `09`, People `10` | A friend with no history shows "Settled up" | "No expenses yet" until the first one | C (PersonLink) |
| F-26 | Split with picker `14` | No Done button; X looks like cancel | Footer "Done (2)" | - |
| F-27 | Exact split `18`, `19` | Shares start blank, "₹900.00 left to assign" | Prefill equal shares and rebalance the last one as you type | - |
| F-28 | Expense comments `46` | After Send, the comment lands off-screen with no visible change | Scroll to the new comment and flash it | - |
| F-29 | Groups list `29`, empty `25` | A "Create group" footer shows next to the header "+" (F-240 #12); the empty state says "New group" while the header says "Create group" | Footer only when empty; one word, "New group" | A |
| F-30 | Groups list `54-groups` | The type "Other" is shown as "Group" | Use the same word everywhere | A |
| F-31 | People and Groups rows `54-people`, `54-groups` | "owes you ↙" or "you are owed ↙" repeats on every currency line, and the arrow glyphs add noise | Say it once per row ("owes you") with the amounts stacked; colour carries the direction | C (PersonLink), A (Sort) |
| F-32 | Ask answer `58` | The answer opens scrolled to the bottom; the question and the first card are off-screen | Scroll to the start of the answer | B (Ask leaves the nav) |
| F-33 | Search `55`, `57` | The header search icon is the AI sparkle while the sheet uses a magnifier; results lead with "123 · BHD … · € … · ₹ …" totals and include deleted items | Magnifier in the header; drop the totals line; put deleted items behind a "Show deleted" toggle | C (search across fields) |
| F-34 | Activity header `54-activity` | The title wraps to two lines next to three icons | Move filter and mark-read into one "…" | - |
| F-35 | Activity row "…" `74` | "Delete expense" is offered from the feed | Remove it; delete lives on the expense | - |
| F-36 | Settle, all paid `40` | "You're not part of any of these payments" shows above "Everyone is settled up" | Show just "Everyone is settled up" | - |
| F-37 | Settle and Record `35` | "Splito never moves money" appears twice | Keep it only on the Record sheet | - |
| F-38 | Hindi Add expense `67` | Category "Other" is not translated (F-240 #21) | Translate the default category names | - |
| F-39 | Appearance `62` | 7 sections (Color mode, Dark style, Accent, Text size, Money colours, Animations, Haptics) | Re-check against owner 128: Money colours and Accent are candidates to drop, and the OS covers text size | B |
| F-40 | Sign-in `03` | The language chip sits flush to the left edge (x=0), below the footer links | Centre it with the footer links | - |
| F-41 | Avatar on every screen `06` | The red dot means "On this device only", but red reads as an error or a notification | Neutral or no dot while sync doesn't exist; red only for failures | B (avatar opens Profile) |
| F-42 | Settings `48b` | "Log out" is the third row, right under Friends and invites | Move it to the bottom of Settings or Profile | B |
| F-43 | Settings, Profile `48b`, `94` | Settings says "Me" while Profile says "Add your name" (F-240 #17) | One wording | B |

---

## 3. Owner 213, screen by screen (finishing pieces and overdoing)

| Screen | Loading | Motion | Icons | Empty state | Calls to action |
|---|---|---|---|---|---|
| Intro slides `01`, `02-*` | - | Fine | Original art, fine | - | One primary (Next), fine |
| Sign-in `03` | - | - | - | - | **Three competing top buttons**, two of them dead (F-10) |
| Home `06`, `52` | The splash covers the cold load; no blank seen | - | **Sparkle used for Search** (F-33) | Art and one sentence, but **no FAB, and the CTA is a grey pill** (F-17) | Overview is a wall of 7 currency cards on demo data (A is moving it) |
| People `54-people` | Content in under 150 ms | - | **Gear in the Friends header opens Settings > Friends**, which reads as "list settings" | Same two-person art as Home and person history (**reused art**) | FAB covers the third row's amounts |
| Person `09`, `17` | - | Toast over the header (F-5) | **Handshake = Settle up, and also Record payment** depending on state | Reused art | **Two Add expense** (F-23) |
| Groups `54-groups`, `25`, `43` | Fine | - | **The Groups tab glyph is a scan frame**, which does not read as groups | Three-person art reused on empty Groups, empty group expenses and "All settled up" | Header +, footer Create group and empty New group: **three CTAs for one job** (F-29) |
| Group `28`, `81-cold-goa-900` | The splash fades over real content, fine | - | Fine | Fine | Two Add expense (F-23) |
| Add expense `11`, `100-*` | Composer skeleton exists | **Full-sheet success animation, about 1.2 s: overdone** (F-4) | Fine | - | Save, fine |
| Settle `34`, `36` | - | Success sheet with a big tick: overdone (F-4) | Handshake | "All settled up", fine | Record per row, fine |
| Expense `41`, `45` | - | - | Fine | "No comments yet", fine | Edit and Comment; the dispute card repeats (F-15) |
| Analytics `54-analytics`, `101-empty-analytics` | Fine | - | Download icon = instant CSV (F-12) | Own art, fine, but **duplicate CTA next to the FAB** | - |
| Activity `54-activity`, `101-empty-activity` | Fine | - | Double-check = mark all read, fine | **No CTA**; tabs and filters show on empty (F-17) | - |
| Search `55`, `57` | Fine | - | Magnifier in the sheet but sparkle in the header | Helpful tips, fine | - |
| Settings > Demo `51` | **A blocking modal with a % counter for about 70 s** (F-14) | - | - | - | - |

**Skeletons:** `Skeleton`, `ComposerSkeleton`, the Activity `LoadingSkeleton` and `Shimmer` exist in `apps/client/src`. On this machine, local reads were faster than a frame, so no list ever showed a blank area or a spinner. Skeleton coverage should be re-checked on a throttled Android device in C's perf sweep.

**Decoration that adds nothing:**
- the save and record success sheets (F-4)
- toasts after actions whose result is already on screen (F-5)
- the repeated "owes you" or "you are owed" words and arrow glyphs on every currency line (F-31)
- the three-times dispute display (F-15)

**Guided tour (F-253, not built yet; no tour appeared after the first sign-in).** Proposed minimal tour, shown once after the first sign-in, skippable, with a blur around each control:
1. **FAB or "Add expense"**: "Add your first expense. Pick who was there; Splito works out the shares."
2. **People (or the first balance row)**: "Who owes whom shows here, per currency."
3. **Settle up (handshake)**: "When someone pays you back, record it here."

That is all. Search, Activity, Groups "+" and Analytics are discoverable without a coach mark, so leave them out (owner 213: "guided tour for required part only").

---

## 4. Top 10 changes that would make Splito feel simplest

1. **Make log out safe** (F-1): it keeps the local data, and erasing becomes an explicit action on the Your data page.
2. **Let a friend be used the moment they're added** (F-2): name first, email or number optional for a later invite, no "waiting to accept" until sync exists.
3. **Keep groups in the list after settling** (F-3): settled groups sort lower with a chip, and only archived ones leave.
4. **Make Save and Record instant** (F-4, F-5): close on the tap, one toast with View or Undo, no full-sheet animation, no toast over the next screen's content.
5. **Strip Add expense to the essentials** (F-16):
   - Autofocus the amount.
   - Split section only once 2 or more people are in.
   - No duplicate "Add people".
   - "Round to cash" goes under More.
   - Wrap the chips so Itemize shows.
   - Show a Done button on the people picker (F-26).
6. **Make Itemize behave as people expect** (F-6, F-7): a tap chooses a person, portions use a stepper, charges sit behind one row, and the total adds up from the items.
7. **One Settle up flow** (F-8, F-11): the plan screen from both a friend and a group, updated live after each payment.
8. **One "Report a problem"** (F-15): merge Dispute and Put on hold, with no "Raised by" picker and one card on the expense.
9. **Cut sign-up to email, code, name** (F-9, F-10): no forced phone or password, keep the name, hide Google and Apple until they work.
10. **Show only what works today, one primary per screen** (F-12, F-17, F-18, F-19, F-23):
    - one Export sheet
    - the FAB on every empty tab, with a primary-style empty CTA
    - a group "…" menu of 5 items
    - no toggles for unbuilt features
    - no second "Add expense" next to the FAB

Still open from the 2026-10-28 audit (F-240), confirmed in this build: #1 (FAB on empty Home), #4 (Activity badge), #5 (Itemize off-screen), #6 (33 px icon buttons), #7 (contrast), #8 (Settle up mismatch), #11 (Members in the group menu), #12 (Create group footer), #17 (Me vs Add your name), #21 (Hindi "Other").
