# Reuse record - group life cycle stream (F-604, F-613, F-615)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT) and `Expensify/App@44387bc7` (MIT).
No file is copied; the screens are Splito code that follows these layouts. Icons are Lucide (ISC).

## Layouts followed

| Splito file | Source followed | Why this one |
|---|---|---|
| `src/screens/Group/components/GroupRows.tsx` (MemberRow menu) | Bluesky `src/screens/Messages/ConversationSettings/Member.tsx`, `MemberMenu.tsx` (row with a "..." menu as a sibling of the row link) | Bluesky wins for list rows and menus |
| `src/screens/Group/components/MemberExitDialog.tsx` | Bluesky `ConversationSettings/prompts.tsx`, `components/dms/LeaveConvoPrompt.tsx` (leave / remove confirmation); Expensify `leaveGroupChat` in `src/libs/actions/Report/index.ts` and `src/pages/DynamicReportParticipantsPage.tsx` (remove member) | Expensify has no balance step; Splito adds the settle / forgive / keep choice with a balance preview (domain), on a Bluesky-style sheet |
| `src/screens/Group/components/DeleteGroupPrompt.tsx`, `GroupLifecycle.tsx` | Bluesky `Prompt.Outer` destructive confirmation | Same component, with a list of what goes |
| Inactive banner and Make active (`GroupNotices`) | Expensify `src/components/ArchivedReportFooter.tsx` (a closed room says so and offers the way back) | Expensify's archived-room footer; Splito keeps the group open for settling |
| `src/screens/RecentlyDeleted/*` group entry | Existing Recently deleted list | A deleted group is one entry that restores whole |
