## PAUSED 2026-10-26 (owner: "lets stop for now, will do it later")
Branch state:
- main = main line: domain + sync packages, docs (spec, AGENTS.md rules 1-9, COMPLETION_MATRIX).
- ui/polish-2 (f510c2d, WIP commit) = most complete app: shell + brand + 5 features merged (ui/final -> ui/final-fix -> ui/polish-1 -> polish-2 WIP). Design judges scored ~6/10 (target 8.5).
- ui/preview-shell-fix (6ed46d4) = latest owner UI decisions 1-4 + native fixes (expo-build-properties RN from source, formatjs Intl polyfills, StrictMode store guard, a demo switch, EXPO_PUBLIC_TOUR, Activity in nav). iOS sim verified.
- fan2/api (8d7add4) = paused backend with 13 open review findings (scratchpad fan2-results.json - may be gone; re-review if so).
Next, in order:
1. Merge ui/preview-shell-fix into ui/polish-2 (resolve duplicate header/nav/drawer code in favour of preview-shell-fix), then implement AGENTS.md rules 5-9 (item portions, Activity rows, FormSheet everywhere, group/friends balances+filters, overview+expanding search) and the polish findings in this ledger (FAB bottom inset, 30+ a11y label, badge offsets).
2. Re-run design-judge polish loop to >= 8.5; send web + iOS simulator screenshots (owner wants screenshots after every change).
3. Merge result into main.
4. Wave 2 features (COMPLETION_MATRIX), then backend (fix fan2/api findings, auth, sync client).
iOS sim: worktree .claude/worktrees/wf_5ebea8ed-d38-3, `EXPO_PUBLIC_TOUR=1 npx expo start --dev-client --clear` then open exp+splito://?__expo_url=http%3A%2F%2Flocalhost%3A8081 ; restart Metro after edits (watcher misses worktree changes).

## Old demo rows in a real database (F-228a)
Dev and e2e builds erase, once per device, the `demo-large-` rows that the old large-set URL switch and "Add demo data" wrote into the real database. The old small set (its URL switch) used random ids and cannot be told apart: a device that loaded it uses Settings > Data > Erase this device's data.

## Build order after splito-resume-1 (decided 2026-10-26)
1. Architecture batch first (docs/ARCHITECTURE-BACKLOG.md A-001..A-010): rule tests with ratcheting baseline, oxlint, move client money arithmetic into packages/domain (51 sites in 8 files), never-throw decoders, golden money tests, outbox lifecycle, delete-after-undo-window, single sync-status component, id validation. Also fix data/hooks.ts re-running every store read after every save (speed rule 10).
2. Then docs/BACKLOG.md feature batches in order (front-end first), each batch: Bluesky-first copy (rule 11), speed + animation (rule 10), judges >= 8.5, web + iOS screenshots.
3. Then backend foundation (fix fan2/api findings, auth, sync client), then backend-dependent batches.

## Backlog decisions (assistant's calls, 2026-10-26; owner delegated all decisions)
- docs/BACKLOG.md is the master list (296 features, 23 epics, 31 front-end batches + 6 backend batches). Build strictly in batch order; Batch 0 = architecture items (ARCHITECTURE-BACKLOG A-001/A-014/A-019 = F-108).
- Backend timing: keep owner's instruction "build backend later once done with UI" - backend batches start after the front-end batches. Exception allowed only for backend work that unblocks nothing user-visible (none planned). Cost if wrong: sharing with friends arrives late; owner can reorder.
- F-2230 (Splitwise API import): build only after verifying Splitwise API terms; until then the file-import (F-2003) is the path.
- F-2231 (bank feed): deferred; needs a provider + country choice, which is a business decision - parked, not built.
