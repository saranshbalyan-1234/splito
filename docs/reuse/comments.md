# Reuse: Comments on expenses and repayments (F-1204)

Upstream: bluesky-social/social-app@4e4ad9c (MIT) for rows, divider, composer, emoji picker and menu;
Expensify/App@44387bc7 (MIT) for the single timeline and the keyboard flow (behaviour only, no code copied).

| Splito file | Upstream source | What was copied | What changed |
|---|---|---|---|
| `src/components/comments/CommentRow.tsx` | `src/components/dms/MessageItem.tsx` | Group-chat message layout: own messages right in the accent colour, others left with a 28 px avatar and name above the first of a cluster, 20 px bubble corners squared inside a cluster, emoji-only messages without a bubble | No reactions, replies, embeds, rich text or highlight flash; bubble corners are static; tombstone line for a deleted comment; `@mention` highlighting from `mentionRanges`; time and "Edited" under the last of a cluster; long-press / right-click menu on Splito's `Menu` (Copy text, Edit, Copy link, Delete) with a focusable "..." button on the web and `accessibilityActions` on phones |
| `src/components/comments/DateDivider.tsx` | `src/components/dms/DateDivider.tsx` | Today / Yesterday / weekday / date wording and the "{date} at {time}" line | Uses `Intl` in the Timezone preference instead of date-fns and the user's zone-less clock |
| `src/components/comments/CommentComposer.tsx` | `src/screens/Messages/components/MessageComposer.tsx` | Rounded `contrast_50` field that grows to a maximum, round primary send button with `PressableScale`, emoji button inside the field on the web, haptic on send, double-submit guard, Enter sends and Shift+Enter breaks the line on the web | Plain `TextInput` (Bluesky's rich-text `Composer` is a native module Splito does not have); no glass, no draft store; edit mode banner; Up in the empty field edits my last comment and Escape cancels (Expensify `useLastEditableAction.ts`, `ReportActionItemMessageEdit.tsx`); `@` autocomplete over the expense's participants following `Autocomplete.tsx`'s list (selected row on `bg_contrast_25`, Up / Down / Enter / Tab) |
| `src/components/comments/KeyboardStickyView.tsx` | `src/screens/Messages/components/vendor/KeyboardStickyView.tsx` | Whole file | Header only |
| `src/components/comments/EmojiButton.web.tsx` | `MessageComposer.tsx` (`EmojiPicker.Root` / `Trigger` / `Picker` block) | Trigger placement and hover colour | Hidden on phone-width web (the drawer), where the system keyboard has emoji |
| `src/components/EmojiPicker/index.web.tsx`, `src/components/EmojiPicker/index.tsx`, `src/components/EmojiPicker/types.ts`, `src/components/EmojiPicker/preload.ts`, `src/components/EmojiPicker/preload.web.ts` | `src/components/EmojiPicker/*` | Whole module: Radix dropdown around `@emoji-mart/react`, Shift keeps it open, data loaded as its own chunk, and the picker UI (`@emoji-mart/react`) is `React.lazy` so it stays out of the main bundle | No text-input emitter; loads on first use (focus or open), not on mount; one shared load promise; waits for the data before drawing; `React.lazy` + `Suspense` around the picker (Bluesky imports it statically) |

Best of both (ARCHITECTURE 26.1): Expensify wins the single timeline (`ReportActionsList.tsx`,
`ModifiedExpenseMessage.tsx`: comments and edit lines in one stream) and the keyboard flow; Bluesky wins the
rows, dividers, composer, emoji and menu. Neither app's artwork or icons were copied (Lucide).

Written from scratch (no Bluesky equivalent): `packages/sync/src/comments.ts` (mutations, paged read, live
count, `mentionRanges`), `state/comments.ts` (thread and count projections, actions), `components/comments/timeline.ts`
(merge order and day dividers), `components/comments/mentions.ts` (the `@` token), `Discussion.tsx` (one
discussion shared by the page's timeline and its composer bar), `CommentCount.tsx`, `screens/Repayment/`.
