# Wave B, slot B4 (F-1204 comments): Opus review, verdict PASS

Branch feat/wB-B4 head 7dd33ba. No critical or important findings. Minors to fix before or at assembly:

1. CommentRow.tsx:115 "Copy link" copies the parent link and nobody else can open it before sync (F-2208): specific toast ("Link copied. It opens this expense on a device that has it.") or hide until F-2208.
2. Discussion.tsx:148 delete prompt says "disappears for everyone": change to "It shows as deleted in this discussion. Earlier versions stay in its history." (en + hi).
3. CommentRow.tsx:266 Edit offered on a deleted target where the composer is hidden: pass canComment, drop Edit (keep Delete); add requireLive on the target in packages/sync/src/comments.ts editComment.
4. DateDivider.tsx:19 Date.now() in render (§ 10), never rolls over at midnight, DST-off: use useToday(tz) and LocalDate compare.
5. EmojiPicker/index.web.tsx:10 emoji-mart core static in main bundle: React.lazy the Picker (or record size + reason in docs/reuse/comments.md).
6. CommentRow.tsx:152 no keyboard path to the row menu at phone-width web; acceptance 6 unproven: e2e at desktop (Tab to comment-menu, Enter) and Shift+F10 / ContextMenu key on the focused bubble at phone width.
7. state/comments.ts:92 every CommentCount reloads on any comment write: add a `ponytail:` comment naming the ceiling.
8. BACKLOG F-1204 status: "in progress (built and tested on feat/wB-B4, unmerged; acceptance 4 with F-2208)".
9. Screenshots predate 7dd33ba: re-shoot phone and desktop expense thread.
Plus: full e2e on a quiet machine (last full run 224/226 before 7dd33ba; both failures passed alone).
